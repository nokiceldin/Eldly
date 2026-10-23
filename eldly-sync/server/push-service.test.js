import {PGlite} from '@electric-sql/pglite';
import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import webPush from 'web-push';
import {createSocialService,dayAt} from './social-service.js';
import {createPushService,nextReminderAt,cleanSubscription,REMINDER} from './push-service.js';
import {flatten} from '../src/sync/records';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
let db,sql,social,push,now,enqueue,deliver,keys;
const users={[a]:{id:a,username:'alice'},[b]:{id:b,username:'bob'}};
const sub=(name='a')=>({endpoint:`https://web.push.apple.com/${name}`,keys:{p256dh:keys.publicKey,auth:randomBytes(16).toString('base64url')}});
const act=(id,action,body={})=>social.mutate(users[id],{action,...body},'test');
const q=(query,args)=>sql.query(query,args);
const reminder=async()=>{const r=(await q('select * from myspace_push_reminders where user_id=$1',[a]))[0];return {kind:'reminder',userId:a,generation:r.generation,dueAt:new Date(r.scheduled_for).toISOString()};};
beforeAll(async()=>{db=new PGlite();await db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));sql={query:async(query,args)=>(await db.query(query,args)).rows};social=createSocialService(sql,{now:()=>now});await social.ensure();keys=webPush.generateVAPIDKeys();},20000);
beforeEach(async()=>{
 await db.exec('truncate myspace_users cascade');now=new Date('2026-10-22T20:00:00Z');enqueue=vi.fn().mockResolvedValue({messageId:'queued'});deliver=vi.fn().mockResolvedValue({statusCode:201});push=createPushService(sql,{ensure:social.ensure,now:()=>now,publicKey:keys.publicKey,privateKey:keys.privateKey,enqueue,deliver});
 for(const [id,username] of [[a,'alice'],[b,'bob']]){await q('insert into myspace_users(id,username,password_hash,app_metadata) values($1,$2,$3,$4)',[id,username,'hash','{}']);await q('insert into eldinos_accounts(user_id,username) values($1,$2)',[id,username]);await q("insert into myspace_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 year')",[username,id]);await act(id,'visit',{timezone:'America/Indiana/Indianapolis'});}
});
afterAll(async()=>{await db?.close();});
it('computes the next local 9pm across DST and non-whole-hour timezones',()=>{
 expect(nextReminderAt('America/Indiana/Indianapolis',new Date('2026-10-22T20:00:00Z')).toISOString()).toBe('2026-10-23T01:00:00.000Z');
 expect(nextReminderAt('America/Indiana/Indianapolis',new Date('2026-11-01T01:01:00Z')).toISOString()).toBe('2026-11-02T02:00:00.000Z');
 expect(nextReminderAt('Asia/Kathmandu',new Date('2026-10-22T10:00:00Z')).toISOString()).toBe('2026-10-22T15:15:00.000Z');
});
it('rejects arbitrary/private endpoints and malformed subscription keys',()=>{
 expect(cleanSubscription(sub()).endpoint).toContain('web.push.apple.com');
 for(const endpoint of ['http://web.push.apple.com/test','https://127.0.0.1/test','https://fcm.googleapis.com.evil.test/test','https://user:pass@web.push.apple.com/test','https://web.push.apple.com:444/test'])expect(()=>cleanSubscription({...sub(),endpoint})).toThrow('PUSH:');
 expect(()=>cleanSubscription({...sub(),keys:{p256dh:'bad',auth:'bad'}})).toThrow('keys');
});
it('subscribes only the signed-in device, schedules once and removes subscriptions on logout',async()=>{
 const subscription=sub();expect((await push.status(a,'alice')).enabled).toBe(false);await push.subscribe(a,'alice',subscription);await push.subscribe(a,'alice',subscription);
 expect((await q('select * from myspace_push_subscriptions')).length).toBe(1);expect(enqueue).toHaveBeenCalledTimes(1);expect(enqueue.mock.calls[0][0]).toMatchObject({kind:'reminder',userId:a});expect(enqueue.mock.calls[0][1].delaySeconds).toBe(18000);
 await push.unsubscribe(b,'bob');expect((await push.status(a,'alice')).enabled).toBe(true);await q('delete from myspace_sessions where token_hash=$1',['alice']);expect((await q('select * from myspace_push_subscriptions')).length).toBe(0);
});
it('creates friend-request and acceptance events, but queues nothing without consent',async()=>{
 await act(a,'friend_request',{username:'bob'});expect(await q('select * from myspace_push_outbox')).toHaveLength(0);
 const request=(await social.dashboard(users[b])).friends[0];await push.subscribe(a,'alice',sub());await act(b,'friend_accept',{id:request.id});expect(await q('select * from myspace_push_outbox')).toHaveLength(1);
 const n=(await q("select id from myspace_notifications where kind='friend_accept'"))[0];await q('update myspace_notifications set created_at=$2 where id=$1',[n.id,now.toISOString()]);await push.publishPending();await push.processMessage({kind:'notification',id:n.id});await push.processMessage({kind:'notification',id:n.id});
 expect(deliver).toHaveBeenCalledTimes(1);expect(deliver.mock.calls[0][1]).toMatchObject({body:'@bob accepted your friend request.',url:'/?inbox=1'});
});
it('sends a 9pm reminder for visiting without tracking, once per day, and schedules tomorrow',async()=>{
 await push.subscribe(a,'alice',sub());const message=await reminder();now=new Date(message.dueAt);await act(a,'visit');await push.processMessage(message);await push.processMessage(message);
 const reminders=await q("select * from myspace_notifications where kind='reminder'");expect(reminders).toHaveLength(1);expect(enqueue.mock.calls.filter(([m])=>m.kind==='reminder')).toHaveLength(2);expect(enqueue.mock.calls.some(([m])=>m.kind==='notification'&&m.id===reminders[0].id)).toBe(true);
 await q('update myspace_notifications set created_at=$2 where id=$1',[reminders[0].id,now.toISOString()]);await push.processMessage({kind:'notification',id:reminders[0].id});expect(deliver.mock.calls[0][1].body).toBe(REMINDER);
});
it('does not remind a user who visited and tracked, and stops after opting out',async()=>{
 await push.subscribe(a,'alice',sub());const message=await reminder();now=new Date(message.dueAt);await act(a,'visit');const data={'checkly-data-v1':{mapping:{version:1,habits:[],entries:{[dayAt('America/Indiana/Indianapolis',now)]:{practice:{kind:'check'}}}}}};
 const records=Object.entries(flatten(data)).map(([record_key,value])=>({record_key,value}));await q('select myspace_account_initialize($1,$2::jsonb)',[a,JSON.stringify(records)]);
 await push.processMessage(message);expect(await q("select * from myspace_notifications where kind='reminder'")).toHaveLength(0);
 const tomorrow=await reminder();await push.unsubscribe(a,'alice');now=new Date(tomorrow.dueAt);await push.processMessage(tomorrow);expect(await q("select * from myspace_notifications where kind='reminder'")).toHaveLength(0);
});
it('never sends reminders early, late the next day, or to expired sessions',async()=>{
 await push.subscribe(a,'alice',sub());const message=await reminder();await expect(push.processMessage(message)).rejects.toThrow('not due');now=new Date(new Date(message.dueAt).getTime()+86400000);await push.processMessage(message);expect(await q("select * from myspace_notifications where kind='reminder'")).toHaveLength(0);
 const next=await reminder();await q("update myspace_sessions set expires_at=now()-interval '1 day' where token_hash='alice'");now=new Date(next.dueAt);await push.processMessage(next);expect(await q('select * from myspace_push_reminders where user_id=$1',[a])).toHaveLength(0);
});
it('retries failures without duplicating successful deliveries and removes expired devices',async()=>{
 await push.subscribe(b,'bob',sub('b'));await act(a,'friend_request',{username:'bob'});const n=(await q("select id from myspace_notifications where kind='friend_request'"))[0];await q('update myspace_notifications set created_at=$2 where id=$1',[n.id,now.toISOString()]);
 deliver.mockRejectedValueOnce({statusCode:503});await expect(push.processMessage({kind:'notification',id:n.id})).rejects.toThrow('retry');await push.processMessage({kind:'notification',id:n.id});expect(deliver).toHaveBeenCalledTimes(2);
 const secondId='99999999-9999-4999-8999-999999999999';await q("insert into myspace_notifications(id,recipient,actor,kind,source_key,created_at) values($1,$2,$3,'friend_accept','another',$4)",[secondId,b,a,now.toISOString()]);deliver.mockRejectedValueOnce({statusCode:410});await push.processMessage({kind:'notification',id:secondId});expect(await q('select * from myspace_push_subscriptions')).toHaveLength(0);
});
it('repairs an unqueued schedule after a temporary queue failure',async()=>{
 enqueue.mockRejectedValueOnce(Error('offline'));await expect(push.subscribe(a,'alice',sub())).rejects.toThrow('offline');expect((await q('select queued from myspace_push_reminders'))[0].queued).toBe(false);await push.repair();expect((await q('select queued from myspace_push_reminders'))[0].queued).toBe(true);
});

it('confirms queue consumption without creating a user notification',async()=>{await push.processMessage({kind:'probe'});expect(await push.queueHealth()).not.toBeNull();expect(await q('select * from myspace_notifications')).toHaveLength(0);});
