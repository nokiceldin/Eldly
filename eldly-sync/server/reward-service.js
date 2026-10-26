import {randomUUID} from 'node:crypto';
import {inflateRecords} from './coin-config.js';
import {ledgerWallet} from '../shared/coin-ledger.js';
import {dayAt} from './social-service.js';
import {readFileSync} from 'node:fs';
const migration=`DO $install$ BEGIN EXECUTE $reward_schema$${readFileSync(new URL('./reward-schema.sql',import.meta.url),'utf8')}$reward_schema$; END;$install$;`;
const prefix=['checkly-data-v1','rewardPurchases'];
export function receiptChanges(purchases){
 const changes=[{record_key:JSON.stringify(prefix),value:{node:'list',order:purchases.map(p=>p.id)}}];
 for(const p of purchases){const path=[...prefix,p.id];changes.push({record_key:JSON.stringify(path),value:{node:'object'}});for(const [key,value] of Object.entries(p))changes.push({record_key:JSON.stringify([...path,key]),value:{node:'value',value}});}
 return changes;
}
export function touchesReceipts(changes){return changes.some(c=>{try{const p=JSON.parse(c.record_key);return p[0]==='checkly-data-v1'&&(p.length<2||p[1]==='rewardPurchases');}catch{return false;}});}
function applyRecords(records,changes){const next=new Map(records.map(r=>[r.record_key,r]));for(const c of changes)next.set(c.record_key,c);return [...next.values()];}
function verifyReceipts(before,after,balance,rewards=[]){
 const old=new Map((before||[]).map(p=>[p.id,p])),active=new Set();let spending=0;
 for(const p of after||[]){
  if(!p||typeof p.id!=='string'||typeof p.rewardId!=='string'||typeof p.title!=='string'||!Number.isSafeInteger(p.cost)||p.cost<=0||p.cost>1e9||!Number.isFinite(Date.parse(p.at)))throw Error('REWARD: Invalid reward purchase.');
  const prior=old.get(p.id);
  if(prior&&['rewardId','title','cost','at'].some(k=>p[k]!==prior[k]))throw Error('REWARD: A saved receipt cannot be changed.');
  if(!prior&&!p.refunded){const reward=rewards.find(r=>r.id===p.rewardId&&!r.archived);if(!reward||reward.cost!==p.cost)throw Error('REWARD: This reward changed. Reopen your rewards.');}
  if(prior?.refunded&&!p.refunded)throw Error('REWARD: Buy this reward again instead of changing its receipt.');
  if(!p.refunded){if(active.has(p.rewardId))throw Error('REWARD: This reward was already bought.');active.add(p.rewardId);if(!prior||prior.refunded)spending+=p.cost;}
 }
 if(spending>0&&spending>balance)throw Error('REWARD: Keep earning — you need more coins for this reward.');
}
export function createRewardService(sql,{ensure:ensureSocial,now=()=>new Date()}={}){
 let ready;const ensure=async()=>{await ensureSocial();return ready||(ready=sql.query(migration).catch(e=>{ready=null;throw e;}));};
 async function snapshot(id){
  const [pull,controls,profile,gifts]=await Promise.all([sql.query('select myspace_account_pull($1,0) as data',[id]),sql.query('select revision,starts_on::text,legacy,periods from myspace_coin_controls where user_id=$1',[id]),sql.query('select timezone from myspace_profiles where user_id=$1',[id]),sql.query('select coalesce(sum(amount),0) as total from myspace_celebration_coins where recipient=$1',[id])]);
  const state=pull[0].data,data=inflateRecords(state.records)['checkly-data-v1'];
  if(!state.initialized||!data)throw Error('REWARD: Open your account and try again.');
  return {state,data,policy:controls[0]||null,day:dayAt(profile[0]?.timezone||'UTC',now()),gifts:Number(gifts[0].total)};
 }
 async function commit(id,s,changes){const r=await sql.query('select myspace_reward_apply($1,$2,$3,$4::jsonb) as revision',[id,s.state.revision,s.policy?.revision??-1,JSON.stringify(changes)]);return r[0].revision;}
 async function mutate(id,body){
  await ensure();if(!['buy','refund'].includes(body.action))throw Error('REWARD: Unknown reward action.');
  for(let attempt=0;attempt<4;attempt++){
   const s=await snapshot(id),purchases=s.data.rewardPurchases||[];let next,receipt;
   if(body.action==='buy'){
    const reward=s.data.rewards?.find(r=>r.id===body.rewardId&&!r.archived);if(!reward)throw Error('REWARD: This reward is no longer available.');
    receipt=purchases.find(p=>p.rewardId===reward.id&&!p.refunded);if(receipt)return {receipt};
    if(!Number.isSafeInteger(reward.cost)||reward.cost<=0||reward.cost>1e9)throw Error('REWARD: Invalid reward price.');
    if(ledgerWallet(s.data,s.day,s.policy,s.gifts).balance<reward.cost)throw Error('REWARD: Keep earning — you need more coins for this reward.');
    receipt={id:randomUUID(),rewardId:reward.id,title:reward.title,cost:reward.cost,at:now().toISOString()};next=[...purchases,receipt];
   }else{receipt=purchases.find(p=>p.id===body.purchaseId);if(!receipt)throw Error('REWARD: This purchase is no longer available.');if(receipt.refunded)return {receipt};next=purchases.map(p=>p.id===receipt.id?{...p,refunded:true}:p);receipt={...receipt,refunded:true};}
   const revision=await commit(id,s,receiptChanges(next));if(revision!==null)return {receipt};
  }
  throw Error('REWARD: Your account changed. Try again.');
 }
 // Older app versions and imports must obey the same balance/duplicate checks.
 async function apply(id,changes){
  await ensure();for(let attempt=0;attempt<4;attempt++){
   const s=await snapshot(id),next=inflateRecords(applyRecords(s.state.records,changes))['checkly-data-v1'];
   verifyReceipts(s.data.rewardPurchases,next?.rewardPurchases,ledgerWallet(s.data,s.day,s.policy,s.gifts).balance,s.data.rewards);
   const revision=await commit(id,s,changes);if(revision!==null)return revision;
  }throw Error('REWARD: Your account changed. Try again.');
 }
 return {mutate,apply};
}
