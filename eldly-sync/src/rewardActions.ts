import {privateAccounts} from './auth';
import {isGuest,scopeEpoch} from './accountScope';
import {synchronize} from './sync/engine';
import {load,persist} from './storage';
import {buyReward,undoReward} from './rewards';
export async function changeReward(action:'buy'|'refund',id:string){
 const epoch=scopeEpoch();
 if(!privateAccounts||isGuest()){
  const run=()=>persist(action==='buy'?buyReward(load(),id):undoReward(load(),id));
  if(navigator.locks)await navigator.locks.request('myspace-local-reward',run);else run();return;
 }
 if(!navigator.onLine)throw Error('Connect to buy or undo a reward.');
 await synchronize();
 if(epoch!==scopeEpoch())throw Error('Account changed. Reopen your rewards.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('/api/account?action=rewards',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(action==='buy'?{rewardId:id}:{purchaseId:id})}),signal:controller.signal});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not update this reward.');
  if(epoch===scopeEpoch())window.dispatchEvent(new Event('myspace-reward-commit'));
 }finally{clearTimeout(timer);if(epoch===scopeEpoch())await synchronize();}
}
