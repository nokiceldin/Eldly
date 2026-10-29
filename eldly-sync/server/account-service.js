import {createRewardService,touchesReceipts} from './reward-service.js';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { compare,hash as hashPassword } from 'bcryptjs';
import {avatarPreset} from '../shared/avatar-options.js';
import {createPushService} from './push-service.js';
import {createSocialService} from './social-service.js';
const COOKIE='__Host-myspace-session';
const hash=value=>createHash('sha256').update(value).digest('hex');
const cookie=(value,maxAge)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const publicUser=row=>({id:row.id,email:`${row.username}@accounts.eldinos.invalid`,app_metadata:{...row.app_metadata,username:row.username}});
export function createAccountHandler(sql){
 const social=createSocialService(sql),push=createPushService(sql,{ensure:social.ensure}),rewards=createRewardService(sql,{ensure:social.ensure});
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const action=req.query?.action;
  if(req.method==='GET'&&action==='health')return res.status(200).json({ready:true});
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  if(req.method==='POST'){
   let origin;try{origin=new URL(req.headers.origin).host;}catch{}
   if(!origin||origin!==req.headers.host)return res.status(403).json({error:'Invalid request origin'});
  }
  try{
   let body=req.body||{};if(typeof body==='string')body=JSON.parse(body);
   if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>2097152)return res.status(400).json({error:'Invalid request'});
   const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
   const tokenHash=token.length<=128?hash(token):'';
   if(action==='register'&&req.method==='POST'){
    const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
    if(!/^[a-z0-9_]{3,32}$/.test(username))return res.status(400).json({error:'Use 3–32 letters, numbers or underscores for your username.',code:'invalid_username'});
    if(typeof body.password!=='string'||body.password.length<8||Buffer.byteLength(body.password)>72)return res.status(400).json({error:'Use a password with at least 8 characters and at most 72 bytes.',code:'invalid_password'});
    let portrait;try{portrait=avatarPreset(body.avatarId).id;}catch{return res.status(400).json({error:'Choose one of the available portraits.',code:'invalid_avatar'});}
    await social.ensure();
    const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];
    const attempts=await sql.query(`insert into myspace_login_attempts(attempt_key) values($1) on conflict(attempt_key) do update set attempts=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then 1 else myspace_login_attempts.attempts+1 end,window_start=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then now() else myspace_login_attempts.window_start end returning attempts`,[hash('register|'+ip)]);
    if(attempts[0].attempts>15)return res.status(429).json({error:'Too many account creation attempts. Please wait 15 minutes.',code:'registration_rate_limit'});
    const id=randomUUID(),next=randomBytes(32).toString('base64url');
    const passwordHash=await hashPassword(body.password,12);
    // A single statement commits the user, workspace and session together.
    const users=await sql.query(`with new_user as (
     insert into myspace_users(id,username,password_hash,app_metadata) values($1,$2,$3,$4::jsonb) returning *
    ), new_account as (
     insert into eldinos_accounts(user_id,username,legacy_owner) select id,username,false from new_user returning user_id
    ), new_state as (
     insert into eldinos_account_state(user_id) select user_id from new_account
    ), new_profile as (
     insert into myspace_profiles(user_id,timezone,avatar_preset) select id,'UTC',$6 from new_user
    ), new_session as (
     insert into myspace_sessions(token_hash,user_id,expires_at) select $5,id,now()+interval '1 year' from new_user
    ) select * from new_user`,[id,username,passwordHash,JSON.stringify({username,legacy_owner:false}),hash(next),portrait]);
    res.setHeader('Set-Cookie',cookie(next,31536000));return res.status(201).json({user:publicUser(users[0])});
   }
   if(action==='login'&&req.method==='POST'){
    const username=typeof body.email==='string'?body.email.split('@')[0].trim().toLowerCase():'';
    if(!/^[a-z0-9_]{3,32}$/.test(username)||typeof body.password!=='string'||body.password.length>200)return res.status(400).json({error:'Incorrect username or password.',code:'invalid_credentials'});
    const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];
    const attemptKey=hash(ip+'|'+username);
    const attempts=await sql.query(`insert into myspace_login_attempts(attempt_key) values($1) on conflict(attempt_key) do update set attempts=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then 1 else myspace_login_attempts.attempts+1 end,window_start=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then now() else myspace_login_attempts.window_start end returning attempts`,[attemptKey]);
    if(attempts[0].attempts>15)return res.status(429).json({error:'Too many sign-in attempts. Please wait 15 minutes.'});
    const users=await sql.query('select * from myspace_users where username=$1 and active',[username]);
    // Always compare a hash, including nonexistent usernames.
    const valid=await compare(body.password,users[0]?.password_hash||'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
    if(!users[0]||!valid)return res.status(400).json({error:'Incorrect username or password.',code:'invalid_credentials'});
    const next=randomBytes(32).toString('base64url');
    await sql.query(`insert into myspace_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 year')`,[hash(next),users[0].id]);
    res.setHeader('Set-Cookie',cookie(next,31536000));return res.status(200).json({user:publicUser(users[0])});
   }
   if(action==='logout'&&req.method==='POST'){
    if(tokenHash)await sql.query('delete from myspace_sessions where token_hash=$1',[tokenHash]);
    res.setHeader('Set-Cookie',cookie('',0));return res.status(200).json({ok:true});
   }
   const users=tokenHash?await sql.query('select u.* from myspace_sessions s join myspace_users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now() and u.active',[tokenHash]):[];
   const user=users[0];
   if(action==='session'&&req.method==='GET')return res.status(200).json({user:user?publicUser(user):null});
   if(!user)return res.status(401).json({error:'Please sign in again.'});
   if(action==='diagnostics'&&req.method==='GET'){
    await social.ensure();
    const stats=await sql.query(`select count(*)::int as records,coalesce(sum(octet_length(value::text)),0)::bigint as bytes from eldinos_account_records where user_id=$1 and not deleted`,[user.id]);
    const queued=await sql.query(`select count(*)::int as pending from myspace_push_outbox o join myspace_notifications n on n.id=o.notification_id where n.recipient=$1 and o.sent_at is null`,[user.id]);
    const worker=await sql.query('select processed_at from myspace_push_health where id=true');
    const platform=user.app_metadata?.legacy_owner===true?(await sql.query(`select (select count(*)::int from myspace_users where active) as accounts,count(*)::int as records,coalesce(sum(octet_length(value::text)),0)::bigint as bytes from eldinos_account_records where not deleted`))[0]:null;
    return res.status(200).json({healthy:true,records:Number(stats[0].records),bytes:Number(stats[0].bytes),pendingNotifications:Number(queued[0].pending),lastWorkerCheck:worker[0]?.processed_at||null,platform});
   }
   if(action==='profile'&&req.method==='GET')return res.status(200).json({user:publicUser(user)});
   if(action==='profile'&&req.method==='POST'){
    if(body.action==='rename'){
     const name=typeof body.name==='string'?body.name.trim():'';
     if(!name||name.length>40)return res.status(400).json({error:'Use a name between 1 and 40 characters.'});
     const updated=await sql.query("update myspace_users set app_metadata=app_metadata||jsonb_build_object('home_name',$2::text) where id=$1 returning *",[user.id,name]);
     return res.status(200).json({user:publicUser(updated[0])});
    }
    if(body.action==='password'){
     if(typeof body.currentPassword!=='string'||body.currentPassword.length>200||typeof body.newPassword!=='string'||body.newPassword.length<8||Buffer.byteLength(body.newPassword)>72)return res.status(400).json({error:'Use your current password and a new password of 8–72 bytes.'});
     const attempts=await sql.query(`insert into myspace_login_attempts(attempt_key) values($1) on conflict(attempt_key) do update set attempts=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then 1 else myspace_login_attempts.attempts+1 end,window_start=case when myspace_login_attempts.window_start<now()-interval '15 minutes' then now() else myspace_login_attempts.window_start end returning attempts`,[hash('password|'+user.id)]);
     if(attempts[0].attempts>8)return res.status(429).json({error:'Too many attempts. Please wait 15 minutes.'});
     if(!await compare(body.currentPassword,user.password_hash))return res.status(400).json({error:'Current password is incorrect.'});
     const nextHash=await hashPassword(body.newPassword,12);
     const updated=await sql.query(`with changed as (update myspace_users set password_hash=$2 where id=$1 and password_hash=$3 returning id), revoked as (delete from myspace_sessions where user_id in(select id from changed) and token_hash<>$4) select id from changed`,[user.id,nextHash,user.password_hash,tokenHash]);
     if(!updated.length)return res.status(409).json({error:'Your password changed elsewhere. Sign in again.'});
     return res.status(200).json({ok:true});
    }
    return res.status(400).json({error:'Unknown profile change.'});
   }
   if(action==='rewards'&&req.method==='POST'){
    const result=await rewards.mutate(user.id,body);
    try{await social.milestones(user.id);await push.publishPending();}catch{console.error('Reward milestone delivery will retry on the next visit.');}
    return res.status(200).json(result);
   }
   if(action==='push'&&req.method==='GET')return res.status(200).json(await push.status(user.id,tokenHash));
   if(action==='push'&&req.method==='POST'){
    if(body.action==='subscribe'){await social.mutate(user,{action:'visit',timezone:body.timezone||'UTC'},'push');return res.status(200).json(await push.subscribe(user.id,tokenHash,body.subscription));}
    if(body.action==='unsubscribe')return res.status(200).json(await push.unsubscribe(user.id,tokenHash));
    return res.status(400).json({error:'Unknown notification action.'});
   }
   if(action==='social'&&req.method==='GET'){
    const state=await social.dashboard(user);
    try{await push.publishPending();}catch{console.error('Notification delivery will retry on the next visit.');}
    return res.status(200).json(state);
   }
   if(action==='social'&&req.method==='POST'){
    const state=await social.mutate(user,body,String(req.headers['x-forwarded-for']||'unknown').split(',')[0]);
    try{await push.publishPending();if(body.action==='visit')await push.schedule(user.id);}catch{console.error('Notification scheduling will retry on the next visit.');}
    return res.status(200).json(state);
   }
   if(action!=='rpc'||req.method!=='POST')return res.status(404).json({error:'Not found'});
   const args=body.args||{};let result;
   // Account identity comes exclusively from the server-verified session.
   switch(body.name){
    case 'eldinos_account_pull':case 'eldly_shared_pull':{
     const revision=args.after_revision??0;if(!Number.isSafeInteger(revision)||revision<0)return res.status(400).json({error:'Invalid revision'});
     result=await sql.query('select myspace_account_pull($1::uuid,$2::bigint) as data',[user.id,revision]);
     result[0].data.coinPolicy=await social.policy(user.id);result[0].data.giftBalance=await social.gifts(user.id);break;
    }
    case 'eldinos_account_apply':case 'eldly_shared_apply':
     if(!Array.isArray(args.changes))return res.status(400).json({error:'Invalid changes'});
     result=touchesReceipts(args.changes)?[{data:await rewards.apply(user.id,args.changes)}]:await sql.query('select myspace_account_apply($1::uuid,$2::jsonb) as data',[user.id,JSON.stringify(args.changes)]);
     try{await social.milestones(user.id);await push.publishPending();}catch{console.error('Milestone notification could not be updated. It will retry on the next visit.');}break;
    case 'eldinos_account_initialize':case 'eldly_shared_initialize':
     if(!Array.isArray(args.records))return res.status(400).json({error:'Invalid records'});
     result=await sql.query('select myspace_account_initialize($1::uuid,$2::jsonb) as data',[user.id,JSON.stringify(args.records)]);break;
    default:return res.status(400).json({error:'Unknown operation'});
   }
   return res.status(200).json({data:result[0].data});
  }catch(error){
   if(error?.message?.startsWith('REWARD:'))return res.status(400).json({error:error.message.slice(8).trim(),code:'reward_request'});
   if(error?.message?.startsWith('PUSH:'))return res.status(400).json({error:error.message.slice(6).trim(),code:'push_request'});
   if(error?.message?.startsWith('SOCIAL:'))return res.status(400).json({error:error.message.slice(8).trim(),code:'social_request'});
   if(action==='register'&&error?.code==='23505')return res.status(409).json({error:'That username is already taken. Please choose another.',code:'username_taken'});
   const invalid=error instanceof SyntaxError||['23514','22P02'].includes(error?.code);
   const reference=randomUUID();
   console.error(JSON.stringify({event:'account_error',reference,action:['register','login','profile','rpc','social','push','diagnostics','health','session','logout','rewards'].includes(action)?action:'unknown',code:typeof error?.code==='string'?error.code.slice(0,10):'unavailable'}));
   return res.status(invalid?400:503).json({error:invalid?'Invalid account data.':'Account service temporarily unavailable. Your saved data has been kept.',reference});
  }
 };
}
