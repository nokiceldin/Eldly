import {trackedEntry} from '../shared/streak.js';
import {ECDH,randomUUID} from 'node:crypto';
import webPush from 'web-push';
import {QueueClient} from '@vercel/queue';
import {dayAt} from './social-service.js';
import {inflateRecords} from './coin-config.js';
export const pushQueue=new QueueClient({region:'iad1'});
export const PUSH_TOPIC='myspace-notifications';
export const REMINDER='Reminder - track your progress today';
const activeSubscriptions=`select p.* from myspace_push_subscriptions p join myspace_sessions s on s.token_hash=p.session_hash join myspace_users u on u.id=p.user_id where p.user_id=$1 and s.expires_at>now() and u.active`;
function wallTime(date,timezone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);}
export function nextReminderAt(timezone,now=new Date()){
 const today=dayAt(timezone,now);
 const at=day=>{const target=Date.parse(day+'T21:00:00Z');let guess=target;for(let i=0;i<4;i++)guess+=target-wallTime(new Date(guess),timezone);return new Date(guess);};
 const first=at(today);if(first.getTime()>now.getTime())return first;
 const next=new Date(today+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);return at(next.toISOString().slice(0,10));
}
export function cleanSubscription(value){
 let url;try{url=new URL(value?.endpoint);}catch{throw Error('PUSH: Invalid notification subscription.');}
 const host=url.hostname;
 const allowed=host==='web.push.apple.com'||host==='fcm.googleapis.com'||host==='android.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com');
 if(!allowed||url.protocol!=='https:'||url.port||url.username||url.password||url.hash||value.endpoint.length>4096)throw Error('PUSH: Unsupported notification endpoint.');
 const keys=value.keys;
 if(!keys||!['p256dh','auth'].every(k=>typeof keys[k]==='string'&&/^[A-Za-z0-9_-]+={0,2}$/.test(keys[k])))throw Error('PUSH: Invalid notification keys.');
 const p=Buffer.from(keys.p256dh,'base64url'),auth=Buffer.from(keys.auth,'base64url');
 if(p.length!==65||p[0]!==4||auth.length!==16)throw Error('PUSH: Invalid notification keys.');
 try{ECDH.convertKey(p,'prime256v1');}catch{throw Error('PUSH: Invalid notification keys.');}
 return {endpoint:value.endpoint,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function createPushService(sql,{ensure,now=()=>new Date(),publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,enqueue=(body,options)=>pushQueue.send(PUSH_TOPIC,body,options),deliver=(subscription,payload)=>webPush.sendNotification(subscription,JSON.stringify(payload),{TTL:3600,timeout:10000,vapidDetails:{subject:'https://eldly.vercel.app',publicKey,privateKey}})}={}){
 const available=()=>!!(publicKey&&privateKey);
 async function status(userId,sessionHash){await ensure();const r=await sql.query('select 1 from myspace_push_subscriptions where user_id=$1 and session_hash=$2',[userId,sessionHash]);return {available:available(),publicKey:available()?publicKey:null,enabled:r.length>0};}
 async function publishSchedule(row){const due=new Date(row.scheduled_for);await enqueue({kind:'reminder',userId:row.user_id,generation:row.generation,dueAt:due.toISOString()},{delaySeconds:Math.max(1,Math.ceil((due-now())/1000)),retentionSeconds:172800,idempotencyKey:`reminder:${row.generation}`});await sql.query('update myspace_push_reminders set queued=true where user_id=$1 and generation=$2',[row.user_id,row.generation]);}
 async function schedule(userId,expected){
  if(!available())return;
  const [subscriptions,profiles,existing]=await Promise.all([sql.query(activeSubscriptions,[userId]),sql.query('select timezone from myspace_profiles where user_id=$1',[userId]),sql.query('select * from myspace_push_reminders where user_id=$1',[userId])]);
  if(!subscriptions.length||!profiles[0])return;
  let row=existing[0];
  if(expected&&row?.generation!==expected){if(row&&!row.queued)await publishSchedule(row);return;}
  if(!expected&&row&&new Date(row.scheduled_for)>new Date(now().getTime()-7200000)){if(!row.queued)await publishSchedule(row);return;}
  const due=nextReminderAt(profiles[0].timezone,now()),generation=randomUUID();
  const rows=await sql.query(`insert into myspace_push_reminders(user_id,generation,scheduled_for) values($1,$2,$3) on conflict(user_id) do update set generation=excluded.generation,scheduled_for=excluded.scheduled_for,queued=false where ${expected?'myspace_push_reminders.generation=$4':'myspace_push_reminders.scheduled_for<$4'} returning *`,[userId,generation,due.toISOString(),expected||new Date(now().getTime()-7200000).toISOString()]);
  row=rows[0]||(await sql.query('select * from myspace_push_reminders where user_id=$1',[userId]))[0];
  if(row&&!row.queued)await publishSchedule(row);
 }
 async function subscribe(userId,sessionHash,value){
  await ensure();if(!available())throw Error('PUSH: Notifications are not configured yet.');const sub=cleanSubscription(value);
  const count=await sql.query('select count(*)::int as n from myspace_push_subscriptions where user_id=$1 and endpoint<>$2',[userId,sub.endpoint]);if(count[0].n>=10)throw Error('PUSH: Too many notification devices. Turn one off first.');
  await sql.query(`insert into myspace_push_subscriptions(id,user_id,session_hash,endpoint,keys) values($1,$2,$3,$4,$5::jsonb) on conflict(endpoint) do update set user_id=excluded.user_id,session_hash=excluded.session_hash,keys=excluded.keys`,[randomUUID(),userId,sessionHash,sub.endpoint,JSON.stringify(sub.keys)]);
  await sql.query('delete from myspace_push_subscriptions where user_id=$1 and session_hash=$2 and endpoint<>$3',[userId,sessionHash,sub.endpoint]);
  await schedule(userId);return status(userId,sessionHash);
 }
 async function unsubscribe(userId,sessionHash){await ensure();await sql.query('delete from myspace_push_subscriptions where user_id=$1 and session_hash=$2',[userId,sessionHash]);await sql.query('delete from myspace_push_reminders where user_id=$1 and not exists(select 1 from myspace_push_subscriptions where user_id=$1)',[userId]);return status(userId,sessionHash);}
 async function publishPending(){
  if(!available())return;
  await ensure();const rows=await sql.query('select notification_id from myspace_push_outbox where not queued and sent_at is null order by notification_id limit 30');
  await Promise.all(rows.map(async row=>{await enqueue({kind:'notification',id:row.notification_id},{retentionSeconds:86400,idempotencyKey:`notification:${row.notification_id}`});await sql.query('update myspace_push_outbox set queued=true where notification_id=$1',[row.notification_id]);}));
 }
 async function sendNotification(id){
  const rows=await sql.query(`select n.*,u.username,o.sent_at from myspace_push_outbox o join myspace_notifications n on n.id=o.notification_id join myspace_users u on u.id=n.actor where n.id=$1`,[id]);const n=rows[0];if(!n||n.sent_at)return;
  // Old notifications should never wake a phone after a long outage.
  if(new Date(n.created_at)<new Date(now().getTime()-3600000)){await sql.query('update myspace_push_outbox set sent_at=now() where notification_id=$1',[id]);return;}
  if(['goal','badge'].includes(n.kind)&&!(await sql.query("select 1 from myspace_friends where a=least($1::uuid,$2::uuid) and b=greatest($1::uuid,$2::uuid) and status='accepted'",[n.actor,n.recipient])).length){await sql.query('update myspace_push_outbox set sent_at=now() where notification_id=$1',[id]);return;}
  const body=n.kind==='celebration'&&Number(n.gift_amount)>0?`@${n.username} sent you +${Number(n.gift_amount)} coins toward your next reward!`:n.kind==='goal'?`@${n.username} achieved a weekly goal!`:n.kind==='badge'?`@${n.username} earned the ${n.rule_changes?.[0]||'new'} badge${n.milestone>1?` · level ${n.milestone}`:''}!`:n.kind==='rules_changed'?`@${n.username} updated your coin rules. ${n.rule_changes?.[0]||''}`:n.kind==='friend_request'?`@${n.username} sent you a friend request.`:n.kind==='friend_accept'?`@${n.username} accepted your friend request.`:REMINDER;
  const subscriptions=await sql.query(activeSubscriptions,[n.recipient]);
  for(const sub of subscriptions){
   if((await sql.query('select 1 from myspace_push_deliveries where notification_id=$1 and subscription_id=$2',[id,sub.id])).length)continue;
   try{await deliver({endpoint:sub.endpoint,keys:sub.keys},{title:'MySpace',body,tag:`myspace:${id}`,url:'/?inbox=1'});await sql.query('insert into myspace_push_deliveries values($1,$2) on conflict do nothing',[id,sub.id]);}
   catch(error){if([404,410].includes(error.statusCode))await sql.query('delete from myspace_push_subscriptions where id=$1',[sub.id]);else throw Error('Push delivery needs retry.');}
  }
  await sql.query('update myspace_push_outbox set sent_at=now() where notification_id=$1',[id]);
 }
 async function processMessage(message){
  await ensure();if(!available())throw Error('Push configuration unavailable.');
  if(message.kind==='probe'){await sql.query('insert into myspace_push_health(id) values(true) on conflict(id) do update set processed_at=now()');return;}
  if(message.kind==='notification'){await sendNotification(message.id);return;}
  if(message.kind!=='reminder')return;
  const rows=await sql.query('select * from myspace_push_reminders where user_id=$1',[message.userId]);const row=rows[0];if(!row)return;
  if(row.generation!==message.generation){await schedule(message.userId);return;}
  if(now()<new Date(row.scheduled_for))throw Error('Reminder is not due yet.');
  const subscriptions=await sql.query(activeSubscriptions,[message.userId]);if(!subscriptions.length){await sql.query('delete from myspace_push_reminders where user_id=$1 and generation=$2',[message.userId,row.generation]);return;}
  const p=(await sql.query('select timezone,last_visit::text from myspace_profiles where user_id=$1',[message.userId]))[0];
  const today=dayAt(p.timezone,now()),dueDay=dayAt(p.timezone,new Date(row.scheduled_for));
  if(today===dueDay&&new Date(row.scheduled_for)>new Date(now().getTime()-3600000)){
   const records=await sql.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[message.userId]);const data=inflateRecords(records)['checkly-data-v1'];
   const tracked=Object.values(data?.mapping?.entries?.[today]||{}).some(trackedEntry);
   if(!tracked)await sql.query(`insert into myspace_notifications(id,recipient,actor,kind,source_key) values($1,$2,$2,'reminder',$3) on conflict(recipient,source_key) do nothing`,[randomUUID(),message.userId,`reminder:${today}`]);
  }
  await publishPending();await schedule(message.userId,row.generation);
 }
 async function repair(){await ensure();await publishPending();const users=await sql.query('select distinct p.user_id from myspace_push_subscriptions p join myspace_sessions s on s.token_hash=p.session_hash where s.expires_at>now()');for(const user of users)await schedule(user.user_id);}
 async function queueHealth(){await ensure();return (await sql.query('select processed_at from myspace_push_health where id=true'))[0]?.processed_at||null;}
 return {queueHealth,repair,status,subscribe,unsubscribe,schedule,publishPending,processMessage};
}
