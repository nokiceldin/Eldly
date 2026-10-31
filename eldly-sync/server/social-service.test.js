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
 now=new Date('2026-10-23T16:00:00Z');await db.exec('truncate myspace_login_attempts');await db.exec('truncate myspace_notifications,myspace_coin_proposals,myspace_coin_controls,myspace_best_members,myspace_best_pairs,myspace_best_requests,myspace_friends,myspace_profiles,myspace_users cascade');
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
 await act(b,'review_rules',{id:proposal.id,decision:'approve',adjustments:{'tennis-test':{amount:6,weeklyCap:30}},bonuses:{goal:0,record:0}});const policy=await service.policy(a);expect(policy.legacy.habits[0].xp.amount).toBe(10);expect(policy.periods).toHaveLength(1);expect(policy.periods[0].config.habits[0].xp).toEqual({amount:6,basis:'entry',weeklyCap:50});expect(policy.periods[0].from>=policy.starts_on).toBe(true);
 await expect(act(b,'review_rules',{id:proposal.id,decision:'approve'})).rejects.toThrow('not available');await act(a,'propose_rules',{config:{habits:[]}});const pending=(await dash(a)).proposals.find(p=>p.status==='pending');expect(pending.config.habits).toHaveLength(1);expect((await service.policy(a)).periods).toEqual(policy.periods);await act(b,'review_rules',{id:pending.id,decision:'decline'});expect((await service.policy(a)).periods).toEqual(policy.periods);
});
it('preserves the policy on leave or unfriend and blocks stale reviews',async()=>{
 await pair();const pending=(await dash(b)).proposals.find(p=>p.incoming);await act(a,'best_leave');expect((await dash(a)).bestFriend).toBeNull();expect((await dash(b)).bestFriend).toBeNull();expect((await dash(a)).friends[0].status).toBe('accepted');expect(await service.policy(a)).not.toBeNull();await expect(act(b,'review_rules',{id:pending.id,decision:'approve'})).rejects.toThrow('not available');await expect(act(a,'propose_rules')).rejects.toThrow('Choose a best friend');await act(a,'best_request',{userId:b});await act(b,'best_accept',{id:(await dash(b)).bestRequests[0].id});await act(a,'friend_remove',{id:(await dash(a)).friends[0].id});expect((await dash(b)).bestFriend).toBeNull();expect((await dash(b)).friends).toHaveLength(0);expect(await service.policy(a)).not.toBeNull();
});
it('emits private generic goal milestones once and sends one celebration back',async()=>{
 await friends();await act(a,'friend_request',{username:'carol'});await act(a,'visit',{timezone:'America/Indiana/Indianapolis'});expect((await dash(b)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(0);
 await save(a,{...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'tennis-secret',label:'PRIVATE-GOAL-LABEL',kind:'check',color:'blue',xp:{amount:10,basis:'entry'},goal:{target:5,maximum:false,from:'2026-10-19'}}],entries:Object.fromEntries([19,20,21,22,23].map(d=>[`2026-10-${d}`,{'tennis-secret':{kind:'check'}}]))}});await service.milestones(a);await service.milestones(a);const inbox=await dash(b);expect(inbox.notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(1);expect(inbox.notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0]).toMatchObject({kind:'goal',username:'alice',read:false});expect(JSON.stringify(inbox)).not.toMatch(/tennis-secret|PRIVATE-GOAL-LABEL/);expect((await dash(c)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(0);const id=inbox.notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0].id;await expect(act(c,'celebrate',{id})).rejects.toThrow('unavailable');await act(b,'celebrate',{id});expect((await dash(a)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0]).toMatchObject({kind:'celebration',username:'bob'});expect((await dash(b)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0].celebrated).toBe(true);await expect(act(b,'celebrate',{id})).rejects.toThrow('already celebrated');expect((await dash(a)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')).toHaveLength(1);await act(a,'notifications_read');expect((await dash(a)).notifications.filter(n=>n.kind==='goal'||n.kind==='celebration')[0].read).toBe(true);
});
it('counts tracked days instead of visits, ignores forged counts, and repairs deleted days',async()=>{
 await friends();await act(a,'visit',{timezone:'America/Indiana/Indianapolis'});expect((await dash(a)).profile.streak).toBe(0);
 const data={...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[],entries:{}}};
 for(let d=19;d<=25;d++){now=new Date(`2026-10-${d}T16:00:00Z`);data.mapping.entries[`2026-10-${d}`]={practice:{kind:'check'}};await save(a,data);await act(a,'visit',{timezone:'Pacific/Kiritimati',day:'2099-01-01',streak:1000});}
 let state=await dash(a);expect(state.profile).toMatchObject({streak:7,longest:7,timezone:'America/Indiana/Indianapolis'});expect((await dash(b)).notifications.filter(n=>n.kind==='streak')).toHaveLength(1);
 await act(a,'visit');expect((await dash(b)).notifications.filter(n=>n.kind==='streak')).toHaveLength(1);
 now=new Date('2026-10-26T16:00:00Z');await act(a,'visit');expect((await dash(a)).profile.streak).toBe(7);
 now=new Date('2026-10-27T16:00:00Z');await act(a,'visit');expect((await dash(a)).profile).toMatchObject({streak:0,longest:7});
 data.mapping.entries['2026-10-27']={practice:{kind:'check'}};await save(a,data);await service.milestones(a);expect((await dash(a)).profile).toMatchObject({streak:1,longest:7});
 delete data.mapping.entries['2026-10-27'];await db.query("update eldinos_account_records set deleted=true where user_id=$1 and record_key like '%2026-10-27%'",[a]);await save(a,data);await service.milestones(a);expect((await dash(a)).profile.streak).toBe(0);
 await expect(act(a,'track_streak',{streak:999})).rejects.toThrow('Unknown action');
 expect(dayAt('America/Indiana/Indianapolis',new Date('2026-10-24T02:00:00Z'))).toBe('2026-10-23');
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
 const current=(await dash(b)).proposals.find(p=>p.incoming&&p.status==='pending');await act(b,'review_rules',{id:current.id,decision:'approve',adjustments:{'tennis-test':{weeklyCap:null}}});expect((await service.policy(a)).periods[0].config.habits[0].xp.weeklyCap).toBe(50);
});
it('can rerun the additive migration without deleting profiles or existing policies',async()=>{
 await pair();const before=await service.policy(a);const another=createSocialService({query:async(q,p)=>(await db.query(q,p)).rows},{now:()=>now});await another.ensure();expect(await another.policy(a)).toEqual(before);
});
it('keeps maximum-goal notifications until the week is complete',async()=>{
 const {achievedGoals}=await import('./coin-config.js');
 const data={mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'limit',label:'Private limit',kind:'check',goal:{target:2,maximum:true,from:'2026-10-19'}}],entries:{'2026-10-19':{limit:{kind:'check'}}}}};
 expect(achievedGoals(data,'2026-10-19','2026-10-23')).toEqual([]);expect(achievedGoals(data,'2026-10-19','2026-10-25',true)).toEqual(['limit']);
});

it('gives exactly 1% of the current main reward for a goal, once per friend each week, without debiting the sender',async()=>{
 await friends();await act(a,'visit',{timezone:'America/Indiana/Indianapolis'});await act(b,'visit',{timezone:'America/Indiana/Indianapolis'});
 const data={...empty(),rewards:[{id:'bought',title:'Old reward',cost:999},{id:'main',title:'Private reward name',cost:2501},{id:'next',title:'Next',cost:9000}],rewardPurchases:[{id:'purchase',rewardId:'bought',title:'Old reward',cost:999,at:now.toISOString()}]};await save(a,data);
 await db.query('select myspace_social_action($1,$2,$3::jsonb)',[a,'goal_events',JSON.stringify({events:['2026-10-19:one','2026-10-19:two','2026-10-19:three']})]);
 let state=await dash(b);const goals=state.notifications.filter(n=>n.kind==='goal');expect(goals[0].giftOffer).toBe(25.01);expect(JSON.stringify(state)).not.toContain('Private reward name');
 await act(b,'celebrate',{id:goals[0].id,withCoins:true,giftAmount:999999,userId:c,week:'1900-01-01'});
 expect(await service.gifts(a)).toBe(25.01);expect(await service.gifts(b)).toBe(0);expect(await service.gifts(c)).toBe(0);
 expect((await dash(a)).notifications.find(n=>n.kind==='celebration').giftAmount).toBe(25.01);expect((await dash(b)).giftedFriends).toEqual([a]);
 await expect(act(b,'celebrate',{id:goals[1].id,withCoins:true})).rejects.toThrow('already sent');await act(b,'celebrate',{id:goals[1].id});expect(await service.gifts(a)).toBe(25.01);
 now=new Date('2026-10-26T16:00:00Z');data.rewards[1].cost=100;await save(a,data);await act(b,'celebrate',{id:goals[2].id,withCoins:true});expect(await service.gifts(a)).toBe(26.01);
 await expect(act(b,'celebrate',{id:goals[2].id,withCoins:true})).rejects.toThrow('uncelebrated');
});
it('offers congratulations without coins when there is no reward and blocks third parties and streak coin gifts',async()=>{
 await friends();await db.query('select myspace_social_action($1,$2,$3::jsonb)',[a,'goal_events',JSON.stringify({events:['one']})]);const n=(await dash(b)).notifications.find(n=>n.kind==='goal');expect(n.giftOffer).toBeNull();
 await expect(act(b,'celebrate',{id:n.id,withCoins:true})).rejects.toThrow('no active reward');await expect(act(c,'celebrate',{id:n.id,withCoins:true})).rejects.toThrow('uncelebrated');await act(b,'celebrate',{id:n.id,giftAmount:500});expect(await service.gifts(a)).toBe(0);expect((await dash(b)).giftedFriends).toEqual([]);
});

it('allows gifts to two friends in one week while blocking repeats for each and preserving gifts through migration',async()=>{
 await friends(a,b);await friends(c,b);
 for(const id of [a,c]){await save(id,{...empty(),rewards:[{id:'main',title:'Reward',cost:id===a?1000:2500}]});await db.query('select myspace_social_action($1,$2,$3::jsonb)',[id,'goal_events',JSON.stringify({events:['first','second']})]);}
 const goals=(await dash(b)).notifications.filter(n=>n.kind==='goal');const alice=goals.filter(n=>n.username==='alice'),carol=goals.filter(n=>n.username==='carol');
 await act(b,'celebrate',{id:alice[0].id,withCoins:true});await db.exec('alter table myspace_celebration_coins add constraint myspace_celebration_coins_sender_week_key unique(sender,week)');await db.exec((await import('./social-service.js')).socialMigration);const after=await dash(b);expect(after.notifications.find(n=>n.id===alice[1].id).giftOffer).toBeNull();expect(after.notifications.find(n=>n.id===carol[0].id).giftOffer).toBe(25);
 await act(b,'celebrate',{id:carol[0].id,withCoins:true});expect(await service.gifts(a)).toBe(10);expect(await service.gifts(c)).toBe(25);expect(await service.gifts(b)).toBe(0);
 await expect(act(b,'celebrate',{id:alice[1].id,withCoins:true})).rejects.toThrow('this friend');await expect(act(b,'celebrate',{id:carol[1].id,withCoins:true})).rejects.toThrow('this friend');
 const {socialMigration}=await import('./social-service.js');await db.exec(socialMigration);expect(await service.gifts(a)).toBe(10);expect(await service.gifts(c)).toBe(25);
 now=new Date('2026-10-26T16:00:00Z');await act(b,'celebrate',{id:alice[1].id,withCoins:true});expect(await service.gifts(a)).toBe(20);
});

it('lets only the current best friend submit immediate coin changes, syncs them and records what changed',async()=>{
 await pair();const view=await dash(b),rules=view.bestFriendRules;expect(rules.userId).toBe(a);expect(rules.config.habits[0].xp.amount).toBe(10);
 const body={userId:a,version:rules.version,adjustments:{'tennis-test':{amount:6,weeklyCap:30}},bonuses:{goal:9,record:40}};
 await expect(act(a,'set_friend_rules',body)).rejects.toThrow('current best friend');await expect(act(c,'set_friend_rules',body)).rejects.toThrow('current best friend');await expect(act(b,'set_friend_rules',{...body,userId:c})).rejects.toThrow('current best friend');
 await act(b,'set_friend_rules',body);const own=await dash(a),policy=await service.policy(a);expect(policy.starts_on).toBe('2026-10-19');expect(policy.periods.at(-1).from).toBe('2026-10-19');expect(policy.periods.at(-1).config.habits[0].xp).toEqual({amount:6,basis:'entry',weeklyCap:50});expect(policy.legacy.habits[0].xp.amount).toBe(10);
 const notice=own.notifications.find(n=>n.kind==='rules_changed');expect(notice.username).toBe('bob');expect(notice.createdAt).toBeTruthy();expect(notice.ruleChanges.join(' ')).toContain('10 coins');expect(notice.ruleChanges.join(' ')).toContain('6 coins');expect(notice.ruleChanges.join(' ')).toContain('Coins per weekly goal: 3 → 9');expect(JSON.stringify(notice)).not.toMatch(/PRIVATE-NOTE|Private task title/);
 expect((await dash(b)).bestFriendRules.config.habits[0].xp.amount).toBe(6);await expect(act(b,'set_friend_rules',body)).rejects.toThrow('changed');
 const current=(await dash(b)).bestFriendRules;await act(a,'best_leave');await expect(act(b,'set_friend_rules',{...body,version:current.version})).rejects.toThrow('current best friend');
});
it('keeps friend-rule editors valid across logging but rejects changed trackers and preserves owner limits',async()=>{
 await pair();const rules=(await dash(b)).bestFriendRules;const rows=(await db.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[a])).rows;const {inflateRecords}=await import('./coin-config.js');const data=inflateRecords(rows)['checkly-data-v1'];data.mapping.entries['2026-10-23']={'tennis-test':{kind:'check'}};await save(a,data);
 await act(b,'set_friend_rules',{userId:a,version:rules.version,adjustments:{'tennis-test':{amount:12,weeklyCap:null}}});expect((await service.policy(a)).periods.at(-1).config.habits[0].xp).toEqual({amount:12,basis:'entry',weeklyCap:50});
 const next=(await dash(b)).bestFriendRules;data.mapping.habits[0].label='New tracker name';await save(a,data);await expect(act(b,'set_friend_rules',{userId:a,version:next.version,adjustments:{'tennis-test':{amount:7}}})).rejects.toThrow('changed');
});
it('applies already approved scheduled rules immediately, preserves past weeks, and notifies only once',async()=>{
 await pair();const proposal=(await dash(b)).proposals.find(p=>p.incoming);await act(b,'review_rules',{id:proposal.id,decision:'approve',adjustments:{'tennis-test':{amount:8}}});
 const policy=await service.policy(a);expect(policy.starts_on).toBe('2026-10-19');expect(policy.periods.at(-1).from).toBe('2026-10-19');expect(policy.periods.at(-1).config.habits[0].xp.amount).toBe(8);expect(policy.legacy.habits[0].xp.amount).toBe(10);
 expect((await dash(a)).notifications.filter(n=>n.kind==='rules_changed')).toHaveLength(1);await dash(a);await dash(b);expect((await dash(a)).notifications.filter(n=>n.kind==='rules_changed')).toHaveLength(1);
});

it('preserves a negative best-friend rate in saved policy, editor and change notification',async()=>{
 await pair();const rules=(await dash(b)).bestFriendRules;
 await act(b,'set_friend_rules',{userId:a,version:rules.version,adjustments:{'tennis-test':{amount:-100,weeklyCap:null}}});
 expect((await service.policy(a)).periods.at(-1).config.habits[0].xp.amount).toBe(-100);
 expect((await dash(b)).bestFriendRules.config.habits[0].xp.amount).toBe(-100);
 expect((await dash(a)).notifications.find(n=>n.kind==='rules_changed').ruleChanges.join(' ')).toContain('-100 coins');
});
it('omits untouched tracker rules when submitting only a bonus change',async()=>{
 await pair();const rules=(await dash(b)).bestFriendRules;
 await act(b,'set_friend_rules',{userId:a,version:rules.version,adjustments:Object.fromEntries(rules.config.habits.map(h=>[h.id,{...h.xp,weeklyCap:h.xp.weeklyCap??null,dailyCountCap:h.xp.dailyCountCap??null,threshold:h.xp.threshold??null,secondary:h.xp.secondary??null}])),bonuses:{goal:9,record:20}});
 expect((await dash(a)).notifications.find(n=>n.kind==='rules_changed').ruleChanges).toEqual(['Coins per weekly goal: 3 → 9']);
 const next=(await dash(b)).bestFriendRules;
 await expect(act(b,'set_friend_rules',{userId:a,version:next.version,adjustments:Object.fromEntries(next.config.habits.map(h=>[h.id,{...h.xp}]))})).rejects.toThrow('No coin rules changed');
});
it('notifies the owner of a named goal privately once per week without sending push or allowing self gifts',async()=>{
 await act(a,'visit',{timezone:'America/Chicago'});
 const d={...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'reading',label:'Private reading',kind:'check',color:'blue',xp:{amount:3,basis:'entry'},goal:{target:1,maximum:false,from:'2026-10-19'}}],entries:{'2026-10-23':{reading:{kind:'check'}}}}};
 await save(a,d);await service.milestones(a);await service.milestones(a);
 const own=(await dash(a)).notifications.filter(n=>n.kind==='goal_self');expect(own).toHaveLength(1);expect(own[0]).toMatchObject({read:false,ruleChanges:['Private reading']});
 expect((await db.query('select * from myspace_push_outbox where notification_id=$1',[own[0].id])).rows).toHaveLength(0);
 await expect(act(a,'celebrate',{id:own[0].id,withCoins:true})).rejects.toThrow();
 await act(a,'notifications_read');expect((await dash(a)).notifications.find(n=>n.id===own[0].id).read).toBe(true);
 await friends();expect(JSON.stringify((await dash(b)).notifications)).not.toContain('Private reading');
 now=new Date('2026-10-26T16:00:00Z');d.mapping.entries['2026-10-26']={reading:{kind:'check'}};await save(a,d);
 expect((await dash(a)).notifications.filter(n=>n.kind==='goal_self')).toHaveLength(2);
});
it('allows confirming unchanged initial rules once, carries the starting rates into next week, and prevents no-op spam afterward',async()=>{
 await pair();const rules=(await dash(b)).bestFriendRules;expect(rules.needsApproval).toBe(true);
 await act(b,'set_friend_rules',{userId:a,version:rules.version,adjustments:Object.fromEntries(rules.config.habits.map(h=>[h.id,h.xp]))});
 const next=(await dash(b)).bestFriendRules;expect(next.needsApproval).toBe(false);expect((await service.policy(a)).periods.at(-1).config.habits[0].xp.amount).toBe(10);
 await expect(act(b,'set_friend_rules',{userId:a,version:next.version})).rejects.toThrow('No coin rules changed');
 now=new Date('2026-11-02T16:00:00Z');expect((await dash(b)).bestFriendRules.config.habits[0].xp.amount).toBe(10);
});
it('offers original starting rates rather than zero when a new agreement has not yet been confirmed',async()=>{
 await pair();now=new Date('2026-11-02T16:00:00Z');const rules=(await dash(b)).bestFriendRules;expect(rules.needsApproval).toBe(true);expect(rules.config.habits[0].xp.amount).toBe(10);
 await act(b,'set_friend_rules',{userId:a,version:rules.version});expect((await service.policy(a)).periods.at(-1).config.habits[0].xp.amount).toBe(10);
});
it('uses approved goals for notifications until the friend confirms a draft, preserving earlier weeks',async()=>{
 await act(a,'visit',{timezone:'America/Chicago'});await pair();let rules=(await dash(b)).bestFriendRules;await act(b,'set_friend_rules',{userId:a,version:rules.version,adjustments:{'tennis-test':{amount:9}}});
 const {inflateRecords}=await import('./coin-config.js');const rows=(await db.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[a])).rows;const d=inflateRecords(rows)['checkly-data-v1'];d.mapping.habits[0].goal.target=1;d.mapping.entries['2026-10-23']={'tennis-test':{kind:'check'}};await save(a,d);
 expect((await dash(a)).notifications.filter(n=>n.kind==='goal_self')).toHaveLength(0);
 rules=(await dash(b)).bestFriendRules;await act(b,'set_friend_rules',{userId:a,version:rules.version});
 expect((await dash(a)).notifications.filter(n=>n.kind==='goal_self')).toHaveLength(1);expect((await service.policy(a)).legacy.habits[0].goal.target).toBe(5);
});
it('adds archive dates to old records once without changing earlier history or existing policy',async()=>{
 const {socialMigration}=await import('./social-service.js');const {inflateRecords}=await import('./coin-config.js');
 const rows=(await db.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[a])).rows;const d=inflateRecords(rows)['checkly-data-v1'];d.mapping.habits[0].archived=true;await save(a,d);
 await db.query("delete from myspace_app_migrations where name='dated-tracker-archives-v1'");await db.exec(socialMigration);
 const first=inflateRecords((await db.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[a])).rows)['checkly-data-v1'];expect(first.mapping.habits[0].archivedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);expect(first.tasks).toEqual(d.tasks);
 const revision=(await db.query('select revision from eldinos_account_state where user_id=$1',[a])).rows[0].revision;await db.exec(socialMigration);expect((await db.query('select revision from eldinos_account_state where user_id=$1',[a])).rows[0].revision).toBe(revision);
});
it('uses elapsed days for a current daily-average goal while withholding maximum goals until completion',async()=>{
 const {achievedGoals}=await import('./coin-config.js');const d={mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'sleep',kind:'sleep',label:'Sleep',goal:{target:480,maximum:false,from:'2026-10-19'}},{id:'phone',kind:'phone',label:'Phone',goal:{target:240,maximum:true,from:'2026-10-19'}}],entries:Object.fromEntries([19,20,21,22,23].map(day=>[`2026-10-${day}`,{sleep:{kind:'sleep',nightMinutes:480,dayMinutes:0}}]))}};
 expect(achievedGoals(d,'2026-10-19','2026-10-23')).toEqual(['sleep']);expect(achievedGoals(d,'2026-10-19','2026-10-25',true)).toEqual(['phone']);
});
it('syncs owner-controlled hourly rules and goals while a partner can edit only monetary amounts',async()=>{
 await act(a,'visit',{timezone:'America/Chicago'});await pair();let rules=(await dash(b)).bestFriendRules;
 await act(b,'set_friend_rules',{userId:a,version:rules.version,adjustments:{'tennis-test':{amount:10}}});
 const {inflateRecords}=await import('./coin-config.js');
 const rows=(await db.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[a])).rows;
 const data=inflateRecords(rows)['checkly-data-v1'];
 now=new Date('2026-10-27T16:00:00Z');
 data.mapping.habits[0]={...data.mapping.habits[0],kind:'duration',previousKinds:['check'],rulesFrom:'2026-10-26',xp:{amount:999,basis:'hour',weeklyCap:80,threshold:{comparison:'over',minutes:30}},previousGoals:[{target:5,maximum:false,from:'2026-10-19',until:'2026-10-26'}],goal:{target:120,maximum:false,from:'2026-10-26'}};
 data.mapping.entries={'2026-10-20':{'tennis-test':{kind:'check'}},'2026-10-27':{'tennis-test':{kind:'duration',minutes:120}}};
 await save(a,data);
 expect((await dash(a)).notifications.some(n=>n.kind==='goal_self')).toBe(true);
 rules=(await dash(b)).bestFriendRules;
 expect(rules.config.habits[0]).toMatchObject({kind:'duration',goal:{target:120},xp:{amount:10,basis:'hour',weeklyCap:80,threshold:{minutes:30}}});
 await act(b,'set_friend_rules',{userId:a,version:rules.version,adjustments:{'tennis-test':{amount:-20,basis:'entry',weeklyCap:null,threshold:null}}});
 const policy=await service.policy(a);
 expect(policy.periods.at(-1).config.habits[0].xp).toEqual({amount:-20,basis:'hour',weeklyCap:80,threshold:{comparison:'over',minutes:30}});
 const {ledgerWallet}=await import('../shared/coin-ledger.js');
 expect(ledgerWallet(data,'2026-10-27',policy).earned).toBe(-30);
 expect((await dash(a)).notifications.filter(n=>n.kind==='rules_changed')[0].ruleChanges).toEqual(['Tennis: 10 coins → -20 coins']);
 expect(policy.legacy.habits[0]).toMatchObject({kind:'check',goal:{target:5},xp:{amount:10,basis:'entry'}});
});

it('announces new badge levels only to accepted friends and never repeats a regained level',async()=>{
 await friends();await act(a,'friend_request',{username:'carol'});await act(a,'visit',{timezone:'UTC'});
 const data={...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'read',label:'Private reading',kind:'check',color:'blue',xp:{amount:100,basis:'entry'}}],entries:{'2026-10-23':{read:{kind:'check'}}}}};
 await save(a,data);await service.milestones(a);await service.milestones(a);
 expect((await dash(b)).notifications.filter(n=>n.kind==='badge')).toMatchObject([{username:'alice',ruleChanges:['Coin collector'],milestone:1}]);
 expect((await dash(c)).notifications.filter(n=>n.kind==='badge')).toHaveLength(0);
 await save(a,{...data,mapping:{...data.mapping,entries:{}}});await service.milestones(a);await save(a,data);await service.milestones(a);
 expect((await dash(b)).notifications.filter(n=>n.kind==='badge')).toHaveLength(1);
 await save(a,{...data,mapping:{...data.mapping,habits:[{...data.mapping.habits[0],xp:{amount:500,basis:'entry'}}]}});await service.milestones(a);
 expect((await dash(b)).notifications.filter(n=>n.kind==='badge').map(n=>n.milestone).sort()).toEqual([1,2]);
 await expect(act(a,'badge_events',{badges:[{id:'coins',name:'Forged',level:6}]})).rejects.toThrow('Unknown action');
});
it('baselines existing badges without broadcasting historical achievements on rollout',async()=>{
 await friends();await act(a,'visit',{timezone:'UTC'});await db.query('delete from myspace_badge_levels where user_id=$1',[a]);
 await save(a,{...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'read',label:'Read',kind:'check',color:'blue',xp:{amount:1000,basis:'entry'}}],entries:{'2026-10-23':{read:{kind:'check'}}}}});
 await service.milestones(a);expect((await dash(b)).notifications.filter(n=>n.kind==='badge')).toHaveLength(0);
 expect((await db.query("select level from myspace_badge_levels where user_id=$1 and badge='coins'",[a])).rows[0].level).toBe(3);
});

it('shows the sender an exact gift receipt and rejects a stale reward quote without spending the weekly gift',async()=>{
 await friends();await act(a,'visit',{timezone:'UTC'});await act(b,'visit',{timezone:'UTC'});
 const data={...empty(),rewards:[{id:'main',title:'Private reward',cost:2501}]};await save(a,data);
 await db.query('select myspace_social_action($1,$2,$3::jsonb)',[a,'goal_events',JSON.stringify({events:['gift-preview']})]);
 const n=(await dash(b)).notifications.find(n=>n.kind==='goal');expect(n.giftOffer).toBe(25.01);
 await save(a,{...data,rewards:[{...data.rewards[0],cost:3001}]});
 await expect(act(b,'celebrate',{id:n.id,withCoins:true,expectedGiftAmount:25.01})).rejects.toThrow('reward changed');expect(await service.gifts(a)).toBe(0);
 const next=await act(b,'celebrate',{id:n.id,withCoins:true,expectedGiftAmount:30.01});
 expect(next.notifications.find(item=>item.id===n.id)).toMatchObject({celebrated:true,sentGiftAmount:30.01});
 expect((await dash(a)).notifications.find(n=>n.kind==='celebration')).toMatchObject({giftAmount:30.01,username:'bob'});
 expect(JSON.stringify(next)).not.toContain('Private reward');
});
it('lets friends gift a badge achievement under the same weekly limit and preserves its name in a cheer',async()=>{
 await friends();await act(a,'visit',{timezone:'UTC'});await act(b,'visit',{timezone:'UTC'});await save(a,{...empty(),rewards:[{id:'main',title:'Reward',cost:1000}]});
 await db.query('select myspace_social_action($1,$2,$3::jsonb)',[a,'badge_events',JSON.stringify({badges:[{id:'coins',name:'Coin collector',level:1}]})]);
 const badge=(await dash(b)).notifications.find(n=>n.kind==='badge');expect(badge.giftOffer).toBe(10);
 const state=await act(b,'celebrate',{id:badge.id,withCoins:true,expectedGiftAmount:10});expect(state.notifications.find(n=>n.id===badge.id).sentGiftAmount).toBe(10);
 expect((await dash(a)).notifications.find(n=>n.kind==='celebration')).toMatchObject({giftAmount:10,ruleChanges:['Coin collector']});
});

it('offers the logo introduction once per unchanged account, including simultaneous devices',async()=>{
 await act(a,'visit',{timezone:'UTC'});await act(b,'visit',{timezone:'UTC'});
 expect((await dash(a)).profile.avatarIntroEligible).toBe(true);
 const responses=await Promise.all([act(a,'claim_avatar_intro'),act(a,'claim_avatar_intro')]);
 expect(responses.filter(r=>r.avatarIntroClaimed)).toHaveLength(1);
 expect((await dash(a)).profile.avatarIntroEligible).toBe(false);
 expect((await dash(b)).profile.avatarIntroEligible).toBe(true);
 expect((await act(a,'claim_avatar_intro')).avatarIntroClaimed).toBe(false);
 expect((await dash(a)).profile.avatarId).toBe('original');
});
it('does not offer the logo introduction after a portrait change, even after returning to original',async()=>{
 await act(a,'visit',{timezone:'UTC'});await act(a,'save_avatar',{avatarId:'cedar'});
 expect((await dash(a)).profile.avatarIntroEligible).toBe(false);
 await act(a,'save_avatar',{avatarId:'original'});
 expect((await dash(a)).profile.avatarIntroEligible).toBe(false);
 expect((await act(a,'claim_avatar_intro')).avatarIntroClaimed).toBe(false);
});
it('backfills existing customized portraits and scopes introduction claims to the signed-in user',async()=>{
 await act(a,'visit',{timezone:'UTC'});await act(b,'visit',{timezone:'UTC'});
 await db.query("update myspace_profiles set avatar_preset='cedar',avatar_changed_at=null where user_id=$1",[a]);
 const fresh=createSocialService({query:async(q,p)=>(await db.query(q,p)).rows},{now:()=>now});await fresh.ensure();
 expect((await db.query('select avatar_changed_at from myspace_profiles where user_id=$1',[a])).rows[0].avatar_changed_at).not.toBeNull();
 expect((await act(a,'claim_avatar_intro',{userId:b})).avatarIntroClaimed).toBe(false);
 expect((await dash(b)).profile.avatarIntroEligible).toBe(true);
 await act(a,'save_avatar',{avatarId:'original'});expect((await dash(a)).profile.avatarIntroEligible).toBe(false);
});

it('shares only aggregate weekly rankings with accepted friends and removes inactive participants',async()=>{
 await friends();await act(a,'friend_request',{username:'carol'});
 await db.query("update eldinos_account_records set deleted=true where user_id=$1 and record_key like '%tennis-test%'",[a]);
 const habits=Array.from({length:10},(_,i)=>({id:`private-${i}`,label:'PRIVATE-RANKING-GOAL',kind:'check',goal:{from:'2026-10-19',target:1,maximum:false}}));
 await save(a,{...empty(),mapping:{version:1,startedOn:'2026-10-19',habits,entries:{'2026-10-23':{'private-0':{kind:'check'},'private-1':{kind:'check'}}}}});
 let ranking=(await dash(a)).weeklyRanking;
 expect(ranking).toMatchObject({from:'2026-10-19',to:'2026-10-25'});
 expect(ranking.participants.map(p=>[p.userId,p.percentage,p.rank])).toEqual([[a,20,1],[b,0,2]]);
 expect(JSON.stringify(ranking)).not.toMatch(/PRIVATE-RANKING-GOAL|private-0|entries/);
 await db.query("update eldinos_account_records set deleted=true where user_id=$1 and record_key like '%tennis-test%'",[b]);
 await save(b,{...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[],entries:{}}});
 ranking=(await dash(a)).weeklyRanking;expect(ranking.participants.map(p=>p.userId)).toEqual([a]);
 await act(a,'friend_remove',{id:(await dash(a)).friends.find(f=>f.userId===b).id});
 expect((await dash(b)).weeklyRanking.participants).toEqual([]);
});
