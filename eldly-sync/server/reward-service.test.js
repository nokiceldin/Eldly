import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {createSocialService} from './social-service.js';
import {createRewardService,receiptChanges} from './reward-service.js';
import {flatten} from '../src/sync/records';
import {empty} from '../src/engine';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';let db,sql,social,rewards;
const date=new Date('2026-10-26T16:00:00Z');
const seed=()=>({...empty(),mapping:{version:1,startedOn:'2026-10-19',habits:[{id:'reading',label:'Reading',kind:'check',color:'blue',xp:{amount:10,basis:'entry'}}],entries:{'2026-10-26':{reading:{kind:'check'}}}},rewards:[{id:'r',title:'Shoes',cost:10},{id:'r2',title:'Book',cost:10}]});
async function save(data){const rows=Object.entries(flatten({'checkly-data-v1':data})).map(([record_key,value])=>({record_key,value}));await db.query('select myspace_account_initialize($1,$2::jsonb)',[id,JSON.stringify(rows)]);}
async function read(){const {inflateRecords}=await import('./coin-config.js');return inflateRecords((await db.query('select record_key,value,deleted from eldinos_account_records where user_id=$1',[id])).rows)['checkly-data-v1'];}
beforeAll(async()=>{db=new PGlite();await db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));sql={query:async(q,p)=>(await db.query(q,p)).rows};social=createSocialService(sql,{now:()=>date});await social.ensure();rewards=createRewardService(sql,{ensure:social.ensure,now:()=>date});},20000);
beforeEach(async()=>{await db.exec('truncate myspace_users,eldinos_accounts cascade');for(const uid of [id,other]){await db.query("insert into myspace_users(id,username,password_hash,app_metadata) values($1,$2,'hash','{}')",[uid,uid===id?'alice':'bob']);await db.query('insert into eldinos_accounts(user_id,username) values($1,$2)',[uid,uid===id?'alice':'bob']);}await save(seed());});
afterAll(async()=>await db.close());
it('makes simultaneous purchases of the same reward idempotent',async()=>{
 const results=await Promise.all([rewards.mutate(id,{action:'buy',rewardId:'r'}),rewards.mutate(id,{action:'buy',rewardId:'r'})]);expect(results[0].receipt.id).toBe(results[1].receipt.id);expect((await read()).rewardPurchases).toHaveLength(1);
});
it('permits just one of two competing rewards when only one is affordable',async()=>{
 const results=await Promise.allSettled([rewards.mutate(id,{action:'buy',rewardId:'r'}),rewards.mutate(id,{action:'buy',rewardId:'r2'})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await read()).rewardPurchases).toHaveLength(1);
});
it('refunds once, preserves receipt price, and allows buying again after refund',async()=>{
 const first=await rewards.mutate(id,{action:'buy',rewardId:'r'});await Promise.all([rewards.mutate(id,{action:'refund',purchaseId:first.receipt.id}),rewards.mutate(id,{action:'refund',purchaseId:first.receipt.id})]);expect((await read()).rewardPurchases).toEqual([expect.objectContaining({cost:10,refunded:true})]);await rewards.mutate(id,{action:'buy',rewardId:'r'});expect((await read()).rewardPurchases.filter(p=>!p.refunded)).toHaveLength(1);
});
it('rejects another account and insufficient funds without changing stored records',async()=>{
 await expect(rewards.mutate(other,{action:'buy',rewardId:'r'})).rejects.toThrow('Open your account');await rewards.mutate(id,{action:'buy',rewardId:'r'});await expect(rewards.mutate(id,{action:'buy',rewardId:'r2'})).rejects.toThrow('more coins');expect((await read()).rewardPurchases).toHaveLength(1);
});
it('blocks stale legacy clients from merging duplicate receipts or spending twice',async()=>{
 const p={id:'one',rewardId:'r',title:'Shoes',cost:10,at:date.toISOString()};await rewards.apply(id,receiptChanges([p]));await expect(rewards.apply(id,receiptChanges([p,{...p,id:'two'}]))).rejects.toThrow('already bought');await expect(rewards.apply(id,receiptChanges([p,{...p,id:'three',rewardId:'r2'}]))).rejects.toThrow('more coins');expect((await read()).rewardPurchases).toHaveLength(1);
});
it('rechecks a changed price after losing a revision race',async()=>{
 let changed=false;const racing=createRewardService({query:async(q,p)=>{if(!changed&&q.startsWith('select myspace_reward_apply')){changed=true;await db.query('select myspace_account_apply($1,$2::jsonb)',[id,JSON.stringify([{record_key:JSON.stringify(['checkly-data-v1','rewards','r','cost']),value:{node:'value',value:20}}])]);}return sql.query(q,p);}},{ensure:social.ensure,now:()=>date});
 await expect(racing.mutate(id,{action:'buy',rewardId:'r'})).rejects.toThrow('more coins');expect((await read()).rewardPurchases||[]).toHaveLength(0);
});
it('checks current prices for legacy clients as well as the purchase endpoint',async()=>{
 const forged={id:'bad',rewardId:'r',title:'Shoes',cost:1,at:date.toISOString()};await expect(rewards.apply(id,receiptChanges([forged]))).rejects.toThrow('reward changed');expect((await read()).rewardPurchases||[]).toHaveLength(0);
});
