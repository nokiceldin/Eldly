import {avatarPreset} from '../shared/avatar-options.js';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSocialService,dayAt} from './social-service.js';
import {defaultRule,defaults} from './coin-config.js';
import {empty} from '../src/engine';
import {flatten} from '../src/sync/records';
import {HABITS} from '../src/mapping';
import {originalCoinRule} from '../src/points';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
let db,service,now;
const users={};
async function save(id,data){const records=Object.entries(flatten({'checkly-data-v1':data})).map(([record_key,value])=>({record_key,value}));const initialized=(await db.query('select initialized from eldinos_account_state where user_id=$1',[id])).rows[0]?.initialized;await db.query(`select ${initialized?'myspace_account_apply':'myspace_account_initialize'}($1,$2::jsonb)`,[id,JSON.stringify(records)]);}
const act=(id,action,body={})=>service.mutate(users[id],{action,...body},'127.0.0.1');
const dash=id=>service.dashboard(users[id]);
async function friends(x=a,y=b){await act(x,'friend_request',{username:users[y].username});const req=(await dash(y)).friends.find(f=>f.userId===x);await act(y,'friend_accept',{id:req.id});return req.id;}
async function pair(){await friends();await act(a,'best_request',{userId:b});await act(b,'best_accept',{id:(await dash(b)).bestRequests[0].id});}
beforeAll(async()=>{db=new PGlite();await db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));service=createSocialService({query:async(q,p)=>(await db.query(q,p)).rows},{now:()=>now});await service.ensure();},20000);
beforeEach(async()=>{
 now=new Date('2026-10-23T16:00:00Z');await db.exec('truncate myspace_notifications,myspace_coin_proposals,myspace_coin_controls,myspace_best_members,myspace_best_pairs,myspace_best_requests,myspace_friends,myspace_profiles,myspace_users cascade');
 for(const [id,username] of [[a,'alice'],[b,'bob'],[c,'carol']]){users[id]={id,username,app_metadata:{}};await db.query('insert into myspace_users(id,username,password_hash,app_metadata) values($1,$2,$3,$4)',[id,username,'hash','{}']);await db.query('insert into eldinos_accounts(user_id,username) values($1,$2)',[id,username]);await save(id,{...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'tennis-test',label:'Tennis',kind:'check',color:'blue',xp:{amount:10,basis:'entry',weeklyCap:50},goal:{target:5,maximum:false,from:'2026-10-19'}}],entries:{}},tasks:[{id:'private',title:'Private task title',notes:'PRIVATE-NOTE',scheduled:'2026-10-23',original:'2026-10-23',category:'',carry:true,important:false,order:0}]});}
});
afterAll(async()=>{await db?.close();});
it('keeps server and client defaults aligned',()=>{expect(defaults.map(d=>d[0])).toEqual(HABITS.map(h=>h.id));for(const h of HABITS)expect(defaultRule(h.id)).toEqual(originalCoinRule(h.id));});
it('requires mutual friendship and rejects self, duplicates and third-party answers',async()=>{
 await expect(act(a,'friend_request',{username:'alice'})).rejects.toThrow('yourself');await expect(act(a,'friend_request',{username:'unknown'})).rejects.toThrow('No account');
 await act(a,'friend_request',{username:' BOB '});const req=(await dash(b)).friends[0];expect(req).toMatchObject({incoming:true,status:'pending',username:'alice'});
 await expect(act(c,'friend_accept',{id:req.id})).rejects.toThrow('no longer');await expect(act(a,'friend_accept',{id:req.id})).rejects.toThrow('not yours');await expect(act(b,'friend_request',{username:'alice'})).rejects.toThrow('pending');await act(b,'friend_accept',{id:req.id});expect((await dash(a)).friends[0].status).toBe('accepted');expect(JSON.stringify(await dash(b))).not.toMatch(/PRIVATE-NOTE|Private task title/);
});
it('allows one mutually accepted best friend and cancels competing invitations',async()=>{
 await expect(act(a,'best_request',{userId:b})).rejects.toThrow('accept this friend');await friends();await friends(c,b);await act(a,'best_request',{userId:b});await act(c,'best_request',{userId:b});const reqs=(await dash(b)).bestRequests;await act(b,'best_accept',{id:reqs.find(r=>r.username==='alice').id});await expect(act(b,'best_accept',{id:reqs.find(r=>r.username==='carol').id})).rejects.toThrow('no longer');expect((await db.query('select * from myspace_best_members')).rows).toHaveLength(2);expect((await dash(a)).bestFriend.username).toBe('bob');expect((await dash(b)).bestFriend.username).toBe('alice');expect((await dash(c)).bestFriend).toBeNull();await expect(act(c,'best_request',{userId:b})).rejects.toThrow('already has');
});
it('only the partner can review, adjusts rates and never copies logs or rewrites the baseline',async()=>{
 await pair();const proposal=(await dash(b)).proposals.find(p=>p.incoming);expect(proposal.config.habits[0].xp.amount).toBe(10);expect(JSON.stringify(proposal)).not.toMatch(/PRIVATE-NOTE|entries/);
 await expect(act(a,'review_rules',{id:proposal.id,decision:'approve'})).rejects.toThrow('not available');await expect(act(c,'review_rules',{id:proposal.id,decision:'approve'})).rejects.toThrow('not available');
 await act(b,'review_rules',{id:proposal.id,decision:'approve',adjustments:{'tennis-test':{amount:6,weeklyCap:30}},bonuses:{goal:0,record:0}});const policy=await service.policy(a);expect(policy.legacy.habits[0].xp.amount).toBe(10);expect(policy.periods).toHaveLength(1);expect(policy.periods[0].config.habits[0].xp).toEqual({amount:6,basis:'entry',weeklyCap:30});expect(policy.periods[0].from>=policy.starts_on).toBe(true);
 await expect(act(b,'review_rules',{id:proposal.id,decision:'approve'})).rejects.toThrow('not available');await act(a,'propose_rules',{config:{habits:[]}});const pending=(await dash(a)).proposals.find(p=>p.status==='pending');expect(pending.config.habits).toHaveLength(1);expect((await service.policy(a)).periods).toEqual(policy.periods);await act(b,'review_rules',{id:pending.id,decision:'decline'});expect((await service.policy(a)).periods).toEqual(policy.periods);
});
it('preserves the policy on leave or unfriend and blocks stale reviews',async()=>{
 await pair();const pending=(await dash(b)).proposals.find(p=>p.incoming);await act(a,'best_leave');expect((await dash(a)).bestFriend).toBeNull();expect((await dash(b)).bestFriend).toBeNull();expect((await dash(a)).friends[0].status).toBe('accepted');expect(await service.policy(a)).not.toBeNull();await expect(act(b,'review_rules',{id:pending.id,decision:'approve'})).rejects.toThrow('not available');await expect(act(a,'propose_rules')).rejects.toThrow('Choose a best friend');await act(a,'best_request',{userId:b});await act(b,'best_accept',{id:(await dash(b)).bestRequests[0].id});await act(a,'friend_remove',{id:(await dash(a)).friends[0].id});expect((await dash(b)).bestFriend).toBeNull();expect((await dash(b)).friends).toHaveLength(0);expect(await service.policy(a)).not.toBeNull();
});
it('emits private generic goal milestones once and sends one celebration back',async()=>{
 await friends();await act(a,'friend_request',{username:'carol'});await act(a,'visit',{timezone:'America/Indiana/Indianapolis'});expect((await dash(b)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(0);
 await save(a,{...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'tennis-secret',label:'PRIVATE-GOAL-LABEL',kind:'check',color:'blue',xp:{amount:10,basis:'entry'},goal:{target:5,maximum:false,from:'2026-10-19'}}],entries:Object.fromEntries([19,20,21,22,23].map(d=>[`2026-10-${d}`,{'tennis-secret':{kind:'check'}}]))}});await service.milestones(a);await service.milestones(a);const inbox=await dash(b);expect(inbox.notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(1);expect(inbox.notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0]).toMatchObject({kind:'goal',username:'alice',read:false});expect(JSON.stringify(inbox)).not.toMatch(/tennis-secret|PRIVATE-GOAL-LABEL/);expect((await dash(c)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(0);const id=inbox.notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0].id;await expect(act(c,'celebrate',{id})).rejects.toThrow('unavailable');await act(b,'celebrate',{id});expect((await dash(a)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0]).toMatchObject({kind:'celebration',username:'bob'});expect((await dash(b)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0].celebrated).toBe(true);await expect(act(b,'celebrate',{id})).rejects.toThrow('already celebrated');expect((await dash(a)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(1);await act(a,'notifications_read');expect((await dash(a)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0].read).toBe(true);
});
it('counts one local-day visit and resets after a missed day',async()=>{
 await friends();for(let d=19;d<=25;d++){now=new Date(`2026-10-${d}T16:00:00Z`);await act(a,'visit',{timezone:'America/Indiana/Indianapolis',day:'2099-01-01',streak:1000});}let state=await dash(a);expect(state.profile.streak).toBe(7);expect(state.profile.longest).toBe(7);expect((await dash(b)).notifications.filter(n=>n.kind==='streak')).toHaveLength(1);await act(a,'visit',{timezone:'Pacific/Kiritimati'});state=await dash(a);expect(state.profile.streak).toBe(7);expect(state.profile.timezone).toBe('America/Indiana/Indianapolis');now=new Date('2026-10-27T16:00:00Z');expect((await dash(a)).profile.streak).toBe(0);await act(a,'visit');expect((await dash(a)).profile).toMatchObject({streak:1,longest:7});expect(dayAt('America/Indiana/Indianapolis',new Date('2026-10-24T02:00:00Z'))).toBe('2026-10-23');
});
it('rejects internal goal-event fanout from clients',async()=>{await expect(act(a,'goal_events',{events:['fake']})).rejects.toThrow('Unknown action');});
it('persists only fixed portrait choices for the caller and shares the portrait with friends',async()=>{
 await friends();await act(a,'visit',{timezone:'UTC'});await act(b,'visit',{timezone:'UTC'});
 const avatar=avatarPreset('cedar').style;
 await act(a,'save_avatar',{avatarId:'cedar',userId:b});expect((await dash(a)).profile.avatar).toEqual(avatar);expect((await dash(b)).profile.avatar).toEqual(avatarPreset().style);expect((await dash(b)).friends[0].avatar).toEqual(avatar);
 await act(a,'visit');expect((await dash(a)).profile.avatar).toEqual(avatar);
 await expect(act(a,'save_avatar',{avatarId:'https://example.com/image.png'})).rejects.toThrow('portraits');
 await expect(act(a,'save_avatar',{avatar:{...avatar,url:'other-picture'}})).rejects.toThrow('portraits');
});
it('supports declined and canceled requests and invalidates superseded reviews',async()=>{
 await act(a,'friend_request',{username:'bob'});let id=(await dash(b)).friends[0].id;await act(a,'friend_cancel',{id});expect((await dash(b)).friends).toEqual([]);
 await act(a,'friend_request',{username:'bob'});id=(await dash(b)).friends[0].id;await act(b,'friend_decline',{id});await friends();
 await act(a,'best_request',{userId:b});id=(await dash(b)).bestRequests[0].id;await act(b,'best_decline',{id});
 await act(a,'best_request',{userId:b});id=(await dash(b)).bestRequests[0].id;await act(a,'best_cancel',{id});
 await act(a,'best_request',{userId:b});await act(b,'best_accept',{id:(await dash(b)).bestRequests[0].id});
 const old=(await dash(b)).proposals.find(p=>p.incoming&&p.status==='pending');await act(a,'propose_rules');
 await expect(act(b,'review_rules',{id:old.id,decision:'approve'})).rejects.toThrow('not available');
 const current=(await dash(b)).proposals.find(p=>p.incoming&&p.status==='pending');await act(b,'review_rules',{id:current.id,decision:'approve',adjustments:{'tennis-test':{weeklyCap:null}}});expect((await service.policy(a)).periods[0].config.habits[0].xp.weeklyCap).toBeUndefined();
});
it('can rerun the additive migration without deleting profiles or existing policies',async()=>{
 await pair();const before=await service.policy(a);const another=createSocialService({query:async(q,p)=>(await db.query(q,p)).rows},{now:()=>now});await another.ensure();expect(await another.policy(a)).toEqual(before);
});
it('keeps maximum-goal notifications until the week is complete',async()=>{
 const {achievedGoals}=await import('./coin-config.js');
 const data={mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'limit',label:'Private limit',kind:'check',goal:{target:2,maximum:true,from:'2026-10-19'}}],entries:{'2026-10-19':{limit:{kind:'check'}}}}};
 expect(achievedGoals(data,'2026-10-19','2026-10-23')).toEqual([]);expect(achievedGoals(data,'2026-10-19','2026-10-25',true)).toEqual(['limit']);
});
