import {avatarPreset} from '../shared/avatar-options.js';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {coinConfig,reviewConfig,inflateRecords,achievedGoals} from './coin-config.js';
const schema=readFileSync(new URL('./social-schema.sql',import.meta.url),'utf8');
const actions=readFileSync(new URL('./social-actions.sql',import.meta.url),'utf8');
export const socialMigration=`DO $migration$ BEGIN PERFORM pg_advisory_xact_lock(782630); EXECUTE $schema$${schema}$schema$; EXECUTE $actions$${actions}$actions$; END $migration$;`;
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
 async function policy(id){await ensure();return (await sql.query('select starts_on::text,legacy,periods from myspace_coin_controls where user_id=$1',[id]))[0]||null;}
 async function milestones(id){
  await ensure();const profiles=await sql.query('select timezone from myspace_profiles where user_id=$1',[id]);
  if(!profiles[0])return;
  const day=dayAt(profiles[0].timezone,now()),from=monday(day),data=await accountData(id);
  const previous=addDay(from,-7);
  const events=[...achievedGoals(data,from,day).map(goal=>`${from}:${goal}`),...(data.mapping&&(data.mapping.startedOn||'2026-10-15')<=previous?achievedGoals(data,previous,addDay(from,-1),true).map(goal=>`${previous}:${goal}`):[])];
  // No activity, goal name, target or value leaves this server-side calculation.
  if(events.length)await run(id,'goal_events',{events});
 }
 async function dashboard(user){
  await ensure();
  const [friends,bestRequests,pairs,proposals,notifications,profiles,control]=await Promise.all([
   sql.query(`select f.id,f.status,f.requested_by,u.id as user_id,u.username,p.avatar_preset,p.timezone,p.last_visit::text,p.streak,p.longest from myspace_friends f join myspace_users u on u.id=case when f.a=$1 then f.b else f.a end left join myspace_profiles p on p.user_id=u.id where $1 in(f.a,f.b) and f.status in('pending','accepted') and u.active order by u.username`,[user.id]),
   sql.query(`select r.id,r.requester,r.recipient,u.username from myspace_best_requests r join myspace_users u on u.id=case when r.requester=$1 then r.recipient else r.requester end where $1 in(r.requester,r.recipient) and r.status='pending' order by r.created_at`,[user.id]),
   sql.query(`select q.id,q.starts_on::text,u.id as user_id,u.username from myspace_best_members m join myspace_best_pairs q on q.id=m.pair_id join myspace_users u on u.id=case when q.a=$1 then q.b else q.a end where m.user_id=$1 and q.ended_at is null`,[user.id]),
   sql.query(`select p.id,p.owner_id,p.reviewer_id,p.config,p.status,p.reviewed_config,p.effective_from::text,p.created_at,p.reviewed_at,u.username as owner_username from myspace_coin_proposals p join myspace_users u on u.id=p.owner_id join myspace_best_members m on m.pair_id=p.pair_id and m.user_id=$1 where $1 in(p.owner_id,p.reviewer_id) order by p.created_at desc limit 30`,[user.id]),
   sql.query(`select n.id,n.kind,n.milestone,n.celebrated,n.read_at,n.created_at,u.username,p.avatar from myspace_notifications n join myspace_users u on u.id=n.actor left join myspace_profiles p on p.user_id=u.id where n.recipient=$1 order by n.created_at desc,n.id desc limit 100`,[user.id]),
   sql.query('select avatar_preset,timezone,last_visit::text,streak,longest from myspace_profiles where user_id=$1',[user.id]),
   policy(user.id)
  ]);
  return {profile:{id:user.id,username:user.username,avatarId:profiles[0]?.avatar_preset||'original',avatar:avatarPreset(profiles[0]?.avatar_preset).style,streak:streak(profiles[0],now()),longest:profiles[0]?.longest||0,timezone:profiles[0]?.timezone||null},friends:friends.map(f=>({id:f.id,userId:f.user_id,username:f.username,avatar:avatarPreset(f.avatar_preset||'original').style,status:f.status,incoming:f.requested_by!==user.id,streak:streak(f,now())})),bestRequests:bestRequests.map(r=>({id:r.id,username:r.username,incoming:r.recipient===user.id})),bestFriend:pairs[0]?{id:pairs[0].id,userId:pairs[0].user_id,username:pairs[0].username,startsOn:pairs[0].starts_on}:null,proposals:proposals.map(p=>({id:p.id,ownerId:p.owner_id,ownerUsername:p.owner_username,incoming:p.reviewer_id===user.id,config:p.config,status:p.status,reviewedConfig:p.reviewed_config,effectiveFrom:p.effective_from,createdAt:p.created_at})),notifications:notifications.map(n=>({id:n.id,kind:n.kind,milestone:n.milestone,celebrated:n.celebrated,read:!!n.read_at,createdAt:n.created_at,username:n.username,avatar:avatarPreset(n.avatar_preset||'original').style})),coinPolicy:control};
 }
 async function mutate(user,body,ip){
  await ensure();const action=body.action;
  const allowed=['friend_request','friend_accept','friend_decline','friend_cancel','friend_remove','best_request','best_accept','best_decline','best_cancel','best_leave','propose_rules','review_rules','visit','celebrate','notifications_read','save_avatar'];
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
  else if(!['best_leave','visit','propose_rules','notifications_read','save_avatar'].includes(action)){if(!uuid(body.id))throw Error('SOCIAL: Choose an available request.');p.id=body.id;}
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
  if(action==='visit'){
   const r=await sql.query('select timezone,last_visit from myspace_profiles where user_id=$1',[user.id]);
   p.timezone=(r[0]?.last_visit?r[0].timezone:body.timezone)||'UTC';
   try{p.day=dayAt(p.timezone,now());}catch{throw Error('SOCIAL: Choose a valid time zone.');}
  }
  if(action==='celebrate')p.newId=randomUUID();
  await run(user.id,action,p);
  if(action==='visit')await milestones(user.id);
  return dashboard(user);
 }
 return {ensure,policy,milestones,dashboard,mutate};
}
