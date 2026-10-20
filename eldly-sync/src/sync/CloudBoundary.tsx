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
  let alive=true,running=false,failures=0,nextAttempt=0;const epoch=scopeEpoch();
  const sync=async()=>{if(running||!alive||epoch!==scopeEpoch()||Date.now()<nextAttempt)return;running=true;try{
   if(!configured)throw Error('Cloud service is not configured.');
   if(!navigator.onLine){setStatus('Offline · saved on this device');return;}
   if(!enrolled()){
    const remote=await pull();if(!alive||epoch!==scopeEpoch())return;
    if(remote.initialized){start(remote);recoverLegacyPending();}
    else {persist(load());await initialize(true);}
   }
   await synchronize();if(!alive||epoch!==scopeEpoch())return;
   failures=0;nextAttempt=0;setReady(true);setMessage('');setStatus('Saved to your account');
  }catch(e){failures++;nextAttempt=Date.now()+Math.min(900000,60000*2**Math.min(failures-1,4));if(alive&&epoch===scopeEpoch()){setMessage(e instanceof Error?e.message:String(e));setStatus('Sync needs attention');}}finally{running=false;}};
  const save=()=>{try{capture();void sync();}catch(e){setMessage(String(e));}};
  window.addEventListener(LOCAL_EVENT,save);window.addEventListener('online',sync);window.addEventListener('focus',sync);const poll=()=>{if(document.visibilityState==='visible')void sync();};document.addEventListener('visibilitychange',poll);const timer=setInterval(poll,30000);void sync();
  return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',poll);window.removeEventListener(LOCAL_EVENT,save);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);window.removeEventListener('eldly-open-cloud-settings',open);};
 },[]);
 if(!ready)return <main className="cloud-loading"><img src="/eldly-logo.png" width="100" alt="MySpace"/>{message?<><p role="alert">{message}</p><button onClick={()=>window.location.reload()}>Retry</button><button onClick={exportDevice}>Export device backup</button></>:<div className="cloud-loading-bar" role="progressbar" aria-label="Opening your account"><span/></div>}</main>;
 return <>{children}{message&&<button className="cloud-status cloud-warning" onClick={()=>setSettings(true)}>Sync needs attention</button>}{settings&&<div className="cloud-overlay" onClick={()=>setSettings(false)}><section className="cloud-card" role="dialog" aria-modal="true" aria-label="Cloud sync" onClick={e=>e.stopPropagation()}><h2>{isGuest()?'Guest storage':'Your cloud'}</h2><p>{isGuest()?'Guest data is saved on this device only.':status}</p>{message&&<p role="alert">{message}</p>}<button onClick={exportDevice}>Export my backup</button><button onClick={()=>setSettings(false)}>Done</button></section></div>}</>;
}
