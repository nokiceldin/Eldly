import { recoverLegacyPending } from "./legacy";
import { useEffect, useState, type ReactNode } from 'react';
import { configured } from './client';
import { capture, enrolled, pull, start, synchronize, initialize, hasLocalData } from './engine';
import { exportDevice, LOCAL_EVENT } from './local';
import { isGuest, scopeEpoch } from '../accountScope';
import { load, persist } from '../storage';
import './cloud.css';
export function CloudBoundary({children}:{children:ReactNode}) {
 const [ready,setReady]=useState(()=>isGuest()||enrolled()&&hasLocalData());
 const [message,setMessage]=useState(''),[settings,setSettings]=useState(false),[status,setStatus]=useState('Opening your account…');
 useEffect(()=>{
  const open=()=>setSettings(true);window.addEventListener('eldly-open-cloud-settings',open);
  if(isGuest())return()=>window.removeEventListener('eldly-open-cloud-settings',open);
  let alive=true,running=false,repeat=false,failures=0,nextAttempt=0,lastInteraction=Date.now();const epoch=scopeEpoch();
  const sync=async(force=false)=>{if(!alive||epoch!==scopeEpoch())return;if(running){if(force)repeat=true;return;}if(!force&&Date.now()<nextAttempt)return;running=true;try{
   if(!configured)throw Error('Cloud service is not configured.');
   if(!navigator.onLine){setStatus('Offline · saved on this device');if(!enrolled()||!hasLocalData())setMessage('Connect once to download this account.');return;}
   if(!enrolled()){
    const remote=await pull();if(!alive||epoch!==scopeEpoch())return;
    if(remote.initialized){start(remote);recoverLegacyPending();}
    else {persist(load());await initialize(true);}
   }
   await synchronize();if(!alive||epoch!==scopeEpoch())return;
   failures=0;nextAttempt=0;setReady(true);setMessage('');setStatus('Saved to your account');
  }catch(e){failures++;nextAttempt=Date.now()+Math.min(900000,60000*2**Math.min(failures-1,4));if(alive&&epoch===scopeEpoch()){setMessage(e instanceof Error?e.message:String(e));setStatus('Sync needs attention');}}finally{running=false;if(repeat){repeat=false;nextAttempt=0;void sync(true);}}};
  const save=()=>{try{capture();void sync();}catch(e){setMessage(String(e));}};
  const interact=()=>{const idle=Date.now()-lastInteraction>=120000;lastInteraction=Date.now();if(idle)void sync(true);};const wake=()=>{lastInteraction=Date.now();nextAttempt=0;void sync(true);};const poll=()=>{if(document.visibilityState==='visible'&&Date.now()-lastInteraction<120000)void sync();};const visibility=()=>{if(document.visibilityState==='visible')wake();};window.addEventListener('pointerdown',interact,{passive:true});window.addEventListener('keydown',interact);window.addEventListener(LOCAL_EVENT,save);window.addEventListener('online',wake);window.addEventListener('myspace-sync-now',wake);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',visibility);const timer=setInterval(poll,30000);void sync();
  return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointerdown',interact);window.removeEventListener('keydown',interact);window.removeEventListener(LOCAL_EVENT,save);window.removeEventListener('online',wake);window.removeEventListener('myspace-sync-now',wake);window.removeEventListener('focus',wake);window.removeEventListener('eldly-open-cloud-settings',open);};
 },[]);
 if(!ready)return <main className="cloud-loading"><img src="/eldly-logo.png" width="100" alt="MySpace"/>{message?<><p role="alert">{message}</p><button onClick={()=>window.location.reload()}>Retry</button><button onClick={exportDevice}>Export device backup</button></>:<div className="cloud-loading-bar" role="progressbar" aria-label="Opening your account"><span/></div>}</main>;
 return <>{children}{message&&<button className="cloud-status cloud-warning" onClick={()=>setSettings(true)}>Sync needs attention</button>}{settings&&<div className="cloud-overlay" onClick={()=>setSettings(false)}><section className="cloud-card" role="dialog" aria-modal="true" aria-label="Cloud sync" onClick={e=>e.stopPropagation()}><h2>{isGuest()?'Guest storage':'Your cloud'}</h2><p>{isGuest()?'Guest data is saved on this device only.':status}</p>{message&&<p role="alert">{message}</p>}{!isGuest()&&<button onClick={()=>window.dispatchEvent(new Event('myspace-sync-now'))}>Retry sync</button>}<button onClick={exportDevice}>Export my backup</button><button onClick={()=>setSettings(false)}>Done</button></section></div>}</>;
}
