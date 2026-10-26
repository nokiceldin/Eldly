import {currentFriendConfig,coinChanges} from './friend-rules.js';
import {celebrationCoins} from './celebration-coins.js';
import {trackingStreak} from '../shared/streak.js';
import {avatarPreset} from '../shared/avatar-options.js';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {coinConfig,reviewConfig,inflateRecords,achievedGoals,legacyGoals,defaults} from './coin-config.js';
const schema=readFileSync(new URL('./social-schema.sql',import.meta.url),'utf8');
const pushSchema=readFileSync(new URL('./push-schema.sql',import.meta.url),'utf8');
const actions=readFileSync(new URL('./social-actions.sql',import.meta.url),'utf8');
export const socialMigration=`DO $migration$ BEGIN PERFORM pg_advisory_xact_lock(782630); EXECUTE $schema$${schema}\n${pushSchema}$schema$; EXECUTE $actions$${actions}$actions$; END $migration$;`;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function dayAt(timezone,now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function addDay(day,days){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function monday(day){const d=new Date(day+'T12:00:00Z');return addDay(day,-((d.getUTCDay()+6)%7));}
function streak(profile,now){if(!profile?.timezone||!profile.last_visit)return 0;const today=dayAt(profile.timezone,now);return profile.last_visit&&profile.last_visit>=addDay(today,-1)&&profile.last_visit<=today?profile.streak:0;}
export function createSocialService(sql,{now=()=>new Date()}={}){
 let ready;
 const ensure=()=>ready||(ready=sql.query(socialMigration).catch(e=>{ready=undefined;throw e;}));
 const run=async(actor,action,p)=>sql.query('select myspace_social_action($1::uuid,$2,$3::jsonb) as data',[actor,action,JSON.stringify(p)]);
 async function accountData(id){
  const rows=await sql.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[id]);
  return inflateRecords(rows)['checkly-data-v1']||{};
 }
 async function config(id){const [data,rows]=await Promise.all([accountData(id),sql.query('select app_metadata from myspace_users where id=$1',[id])]);return coinConfig(data,rows[0]?.app_metadata.legacy_owner===true);}
 async function policy(id){await ensure();return (await sql.query('select starts_on::text,legacy,periods,revision from myspace_coin_controls where user_id=$1',[id]))[0]||null;}
 async function milestones(id){
  await ensure();const profiles=await sql.query('select timezone from myspace_profiles where user_id=$1',[id]);
  if(!profiles[0])return;
  const day=dayAt(profiles[0].timezone,now()),from=monday(day),data=await accountData(id);
  await run(id,'track_streak',{...trackingStreak(data.mapping,day),day});
  const previous=addDay(from,-7);
  const events=[...achievedGoals(data,from,day).map(goal=>`${from}:${goal}`),...(data.mapping&&(data.mapping.startedOn||'2026-10-15')<=previous?achievedGoals(data,previous,addDay(from,-1),true).map(goal=>`${previous}:${goal}`):[])];
  // Friends receive only generic milestones. Goal names stay in the owner’s private inbox.
  if(events.length){const ownGoals=Object.fromEntries(events.map(event=>{const goal=event.slice(11),legacy=legacyGoals.find(g=>g[0]===goal);return [event,data.mapping?.habits?.find(h=>h.id===goal)?.label||(legacy?defaults.find(d=>d[0]===legacy[1])?.[1]||'Weekly goal':'Weekly goal')];}));await run(id,'goal_events',{events,ownGoals});}
 }
 async function gifts(id){await ensure();return Number((await sql.query('select coalesce(sum(amount),0) as total from myspace_celebration_coins where recipient=$1',[id]))[0]?.total||0);}
 async function giftWeek(id){const profile=(await sql.query('select timezone from myspace_profiles where user_id=$1',[id]))[0];return monday(dayAt(profile?.timezone||'UTC',now()));}
 async function activateApproved(id){
  const week=await giftWeek(id);
  const approved=(await sql.query(`select p.reviewer_id,p.reviewed_config,c.revision as policy_revision,s.revision as data_revision,q.id as pair_id from myspace_coin_proposals p join myspace_best_members m on m.user_id=p.owner_id and m.pair_id=p.pair_id join myspace_best_pairs q on q.id=m.pair_id and q.ended_at is null join myspace_coin_controls c on c.user_id=p.owner_id join eldinos_account_state s on s.user_id=p.owner_id left join myspace_profiles profile on profile.user_id=p.owner_id where p.owner_id=$1 and p.status='approved' and p.effective_from>$2::date and exists(select 1 from jsonb_array_elements(c.periods) e where e->>'from'=p.effective_from::text and e->>'reviewer'=p.reviewer_id::text and e->'config'=p.reviewed_config) order by p.reviewed_at desc limit 1`,[id,week]))[0];
  if(!approved)return;
  const [raw,control]=await Promise.all([config(id),policy(id)]);
  // Previously approved changes already have both users' consent. Move only their
  // current/future period forward; completed weeks retain their original rules.
  const changes=coinChanges(currentFriendConfig(raw,control,week),approved.reviewed_config);
  try{await run(approved.reviewer_id,'set_friend_rules',{userId:id,pairId:approved.pair_id,from:week,config:approved.reviewed_config,expectedRevision:Number(approved.policy_revision),dataRevision:Number(approved.data_revision),id:randomUUID(),changes:changes.length?changes:['Your approved coin rules now apply this week.']});}catch(e){if(!/These rules changed|Their trackers changed/.test(e.message))throw e;}
 }
 async function friendRules(id){
  const pair=(await sql.query('select q.id,case when q.a=$1 then q.b else q.a end as other from myspace_best_members m join myspace_best_pairs q on q.id=m.pair_id where m.user_id=$1 and q.ended_at is null',[id]))[0];
  if(!pair)return null;
  await activateApproved(pair.other);
  const [raw,control,state]=await Promise.all([config(pair.other),policy(pair.other),sql.query('select revision from eldinos_account_state where user_id=$1',[pair.other])]);
  const week=await giftWeek(pair.other),version=`${pair.id}:${createHash('sha256').update(JSON.stringify(raw)).digest('hex')}:${control?.revision||0}`;
  const baseline=currentFriendConfig(raw,control,week),editing={...baseline,goalPlans:raw.goalPlans,habits:baseline.habits.map(h=>{const draft=raw.habits.find(d=>d.id===h.id);return {...h,goal:draft?.goal,previousGoals:draft?.previousGoals};})};
  return {userId:pair.other,pairId:pair.id,version,dataRevision:Number(state[0]?.revision||0),policyRevision:Number(control?.revision||0),week,config:editing,baseline};
 }
 async function dashboard(user){
  await ensure();
  await activateApproved(user.id);
  await milestones(user.id);
  const [friends,bestRequests,pairs,proposals,notifications,profiles,control]=await Promise.all([
   sql.query(`select f.id,f.status,f.requested_by,u.id as user_id,u.username,p.avatar_preset,p.timezone,p.last_visit::text,p.streak,p.longest from myspace_friends f join myspace_users u on u.id=case when f.a=$1 then f.b else f.a end left join myspace_profiles p on p.user_id=u.id where $1 in(f.a,f.b) and f.status in('pending','accepted') and u.active order by u.username`,[user.id]),
   sql.query(`select r.id,r.requester,r.recipient,u.username from myspace_best_requests r join myspace_users u on u.id=case when r.requester=$1 then r.recipient else r.requester end where $1 in(r.requester,r.recipient) and r.status='pending' order by r.created_at`,[user.id]),
   sql.query(`select q.id,q.starts_on::text,u.id as user_id,u.username from myspace_best_members m join myspace_best_pairs q on q.id=m.pair_id join myspace_users u on u.id=case when q.a=$1 then q.b else q.a end where m.user_id=$1 and q.ended_at is null`,[user.id]),
   sql.query(`select p.id,p.owner_id,p.reviewer_id,p.config,p.status,p.reviewed_config,p.effective_from::text,p.created_at,p.reviewed_at,u.username as owner_username from myspace_coin_proposals p join myspace_users u on u.id=p.owner_id join myspace_best_members m on m.pair_id=p.pair_id and m.user_id=$1 where $1 in(p.owner_id,p.reviewer_id) order by p.created_at desc limit 30`,[user.id]),
   sql.query(`select n.id,n.kind,n.milestone,n.gift_amount,n.rule_changes,n.celebrated,n.read_at,n.created_at,u.username,p.avatar from myspace_notifications n join myspace_users u on u.id=n.actor left join myspace_profiles p on p.user_id=u.id where n.recipient=$1 order by n.created_at desc,n.id desc limit 100`,[user.id]),
   sql.query('select avatar_preset,timezone,last_visit::text,streak,longest from myspace_profiles where user_id=$1',[user.id]),
   policy(user.id)
  ]);
  const week=await giftWeek(user.id),used=await sql.query('select recipient from myspace_celebration_coins where sender=$1 and week=$2',[user.id,week]);
  const offers=new Map();
  const gifted=new Set(used.map(g=>g.recipient));
  for(const n of notifications.filter(n=>n.kind==='goal'&&!n.celebrated&&friends.some(f=>f.username===n.username&&f.status==='accepted'&&!gifted.has(f.user_id)))){if(!offers.has(n.username)){const friend=friends.find(f=>f.username===n.username);offers.set(n.username,celebrationCoins(await accountData(friend.user_id)));}}
  return {bestFriendRules:await friendRules(user.id),giftBalance:await gifts(user.id),giftedFriends:[...gifted],profile:{id:user.id,username:user.username,avatarId:profiles[0]?.avatar_preset||'original',avatar:avatarPreset(profiles[0]?.avatar_preset).style,streak:streak(profiles[0],now()),longest:profiles[0]?.longest||0,timezone:profiles[0]?.timezone||null},friends:friends.map(f=>({id:f.id,userId:f.user_id,username:f.username,avatar:avatarPreset(f.avatar_preset||'original').style,status:f.status,incoming:f.requested_by!==user.id,streak:streak(f,now())})),bestRequests:bestRequests.map(r=>({id:r.id,username:r.username,incoming:r.recipient===user.id})),bestFriend:pairs[0]?{id:pairs[0].id,userId:pairs[0].user_id,username:pairs[0].username,startsOn:pairs[0].starts_on}:null,proposals:proposals.map(p=>({id:p.id,ownerId:p.owner_id,ownerUsername:p.owner_username,incoming:p.reviewer_id===user.id,config:p.config,status:p.status,reviewedConfig:p.reviewed_config,effectiveFrom:p.effective_from,createdAt:p.created_at})),notifications:notifications.map(n=>({id:n.id,kind:n.kind,milestone:n.milestone,ruleChanges:n.rule_changes||[],giftAmount:Number(n.gift_amount||0),giftOffer:offers.get(n.username)||null,celebrated:n.celebrated,read:!!n.read_at,createdAt:n.created_at,username:n.username,avatar:avatarPreset(n.avatar_preset||'original').style})),coinPolicy:control};
 }
 async function mutate(user,body,ip){
  await ensure();const action=body.action;
  const allowed=['friend_request','friend_accept','friend_decline','friend_cancel','friend_remove','best_request','best_accept','best_decline','best_cancel','best_leave','propose_rules','review_rules','visit','celebrate','notifications_read','save_avatar','set_friend_rules'];
  if(!allowed.includes(action))throw Error('SOCIAL: Unknown action.');
  const p={};
  if(['friend_request','best_request','propose_rules'].includes(action)){
   const key=createHash('sha256').update(`social|${user.id}|${ip}`).digest('hex');
   const r=await sql.query(`insert into myspace_login_attempts(attempt_key) values($1) on conflict(attempt_key) do update set attempts=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then 1 else myspace_login_attempts.attempts+1 end,window_start=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then now() else myspace_login_attempts.window_start end returning attempts`,[key]);
   if(r[0].attempts>30)throw Error('SOCIAL: Too many requests. Try again in 15 minutes.');
  }
  if(action==='save_avatar'){try{if(typeof body.avatarId!=='string')throw Error('Choose one of the available portraits.');p.avatarId=avatarPreset(body.avatarId).id;}catch(e){throw Error('SOCIAL: '+e.message);}}
  if(action==='friend_request'){if(typeof body.username!=='string'||!/^[a-z0-9_]{3,32}$/.test(body.username.trim().toLowerCase()))throw Error('SOCIAL: Enter a valid username.');p.username=body.username;p.id=randomUUID();}
  else if(action==='best_request'){if(!uuid(body.userId))throw Error('SOCIAL: Choose a friend.');p.userId=body.userId;p.id=randomUUID();}
  else if(!['best_leave','visit','propose_rules','notifications_read','save_avatar','set_friend_rules'].includes(action)){if(!uuid(body.id))throw Error('SOCIAL: Choose an available request.');p.id=body.id;}
  if(action==='best_accept'){
   const r=await sql.query("select requester from myspace_best_requests where id=$1 and recipient=$2 and status='pending'",[p.id,user.id]);
   if(!r[0])throw Error('SOCIAL: Best-friend request no longer available.');
   [p.mine,p.theirs]=await Promise.all([config(user.id),config(r[0].requester)]);p.mineId=randomUUID();p.theirsId=randomUUID();
  }
  if(action==='propose_rules'){p.id=randomUUID();p.config=await config(user.id);}
  if(action==='review_rules'){
   if(!['approve','decline'].includes(body.decision))throw Error('SOCIAL: Choose approve or decline.');p.decision=body.decision;
   const rows=await sql.query("select config from myspace_coin_proposals where id=$1 and reviewer_id=$2 and status='pending'",[p.id,user.id]);
   if(!rows[0])throw Error('SOCIAL: This review is not available to you.');
   try{p.config=reviewConfig(rows[0].config,body);}catch(e){throw Error('SOCIAL: '+e.message);}
  }
  if(action==='set_friend_rules'){
   const target=await friendRules(user.id);
   if(!target||body.userId!==target.userId)throw Error('SOCIAL: You can only edit your current best friend’s coin rules.');
   if(body.version!==target.version)throw Error('SOCIAL: These rules changed. Reopen your friend’s profile and try again.');
   try{p.config=reviewConfig(target.config,body);}catch(e){throw Error('SOCIAL: '+e.message);}
   p.changes=coinChanges(target.baseline,p.config);if(!p.changes.length)throw Error('SOCIAL: No coin rules changed.');
   p.userId=target.userId;p.pairId=target.pairId;p.from=target.week;p.expectedRevision=target.policyRevision;p.dataRevision=target.dataRevision;p.id=randomUUID();
  }
  if(action==='visit'){
   const r=await sql.query('select timezone,last_visit,timezone_locked from myspace_profiles where user_id=$1',[user.id]);
   p.timezone=(r[0]?.timezone_locked?r[0].timezone:body.timezone)||r[0]?.timezone||'UTC';
   try{p.day=dayAt(p.timezone,now());}catch{throw Error('SOCIAL: Choose a valid time zone.');}
  }
  if(action==='celebrate'){
   p.newId=randomUUID();
   if(body.withCoins===true){
    const n=(await sql.query("select actor,kind,celebrated from myspace_notifications where id=$1 and recipient=$2",[p.id,user.id]))[0];
    if(!n||n.kind!=='goal'||n.celebrated)throw Error('SOCIAL: Only an uncelebrated goal can receive coins.');
    p.giftAmount=celebrationCoins(await accountData(n.actor));
    if(!p.giftAmount)throw Error('SOCIAL: This friend has no active reward. Send congratulations instead.');
    p.week=await giftWeek(user.id);
   }
  }
  if(action==='notifications_read')await milestones(user.id);
  await run(user.id,action,p);
  return dashboard(user);
 }
 return {ensure,policy,milestones,dashboard,mutate,gifts};
}
