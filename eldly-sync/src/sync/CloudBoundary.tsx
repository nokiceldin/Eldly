import { useEffect, useRef, useState, type ReactNode } from 'react';
import { configured } from './client';
import { capture, enrolled, pull, start, synchronize, initialize, hasLocalData } from './engine';
import { exportDevice, LOCAL_EVENT, restore, validateSnapshot } from './local';
import './cloud.css';
export function CloudBoundary({children}:{children:ReactNode}) {
  const [ready,setReady]=useState(!configured);
  const [migration,setMigration]=useState<false | "initialize" | "join">(false);
  const [message,setMessage]=useState(''),[status,setStatus]=useState('Opening shared checklist…');
  const [settings,setSettings]=useState(false),[busy,setBusy]=useState(false);
  const running=useRef(false);
  const retry=useRef<()=>void>(()=>{});
  useEffect(()=>{
    if(!configured)return;
    let alive=true;
    const sync=async()=>{
      if(running.current||!alive)return;
      running.current=true;
      try {
        if(!navigator.onLine){if(enrolled())setReady(true);setStatus('Offline · saved on this device');return;}
        setStatus('Syncing…');
        if(!enrolled()){
          const remote=await pull();
          if(remote.initialized){
            if(hasLocalData()){setMigration("join");setStatus("Existing device data found");return;}
            start(remote);
          }
          else if(hasLocalData()){setMigration("initialize");setStatus('Choose initial checklist');return;}
          else await initialize(false);
        }
        const remaining=await synchronize();
        if(alive){setReady(true);setMigration(false);setMessage('');setStatus(remaining?'Syncing…':'Saved to cloud');}
      }catch(error){if(alive){setMessage(String(error));setStatus('Sync needs attention');if(enrolled())setReady(true);}}
      finally{running.current=false;}
    };
    retry.current=()=>void sync();
    const save=()=>{try{capture();setStatus(navigator.onLine?'Syncing…':'Offline · saved on this device');void sync();}catch(error){setMessage(`Could not queue changes: ${String(error)}`);setStatus('Sync needs attention');}};
    const focus=()=>{if(document.visibilityState==='visible')void sync();};
    const offline=()=>setStatus('Offline · saved on this device');
    window.addEventListener(LOCAL_EVENT,save);window.addEventListener('online',focus);window.addEventListener('offline',offline);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    const timer=setInterval(()=>void sync(),3000);void sync();
    return()=>{alive=false;clearInterval(timer);window.removeEventListener(LOCAL_EVENT,save);window.removeEventListener('online',focus);window.removeEventListener('offline',offline);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
  },[]);
  async function join(){
    setBusy(true);
    try{start(await pull());setMigration(false);setReady(true);setMessage('');retry.current();}catch(error){setMessage(String(error));}finally{setBusy(false);}
  }
  async function choose(useLocal:boolean){
    if(!useLocal&&!confirm('Start an empty shared checklist? Your previous device data will be kept in a local safety backup.'))return;
    if(useLocal&&!confirm('Publish this device’s saved data as the shared checklist? Anyone with the app or public API can read and change it. Existing shared data will never be overwritten by this import.'))return;
    setBusy(true);
    try{await initialize(useLocal);setMigration(false);setReady(true);setMessage('');retry.current();}catch(error){setMessage(String(error));}finally{setBusy(false);}
  }
  if(!ready)return <main className="cloud-page"><section className="cloud-card"><h1>Eldly</h1>{migration==="join"?<><p>A shared checklist already exists. Your previous device data will be kept in a separate safety backup, without uploading it or duplicating tasks.</p><button disabled={busy} onClick={()=>void join()}>Keep a backup and open shared checklist</button></>:migration?<><p>Your cloud checklist is empty. Keep your existing tasks by importing this device once.</p><button disabled={busy} onClick={()=>void choose(true)}>Import this device’s saved data</button><button className="cloud-secondary" disabled={busy} onClick={()=>void choose(false)}>Start empty</button></>:<p role="status">{status}</p>}{message&&<p role="alert" className="cloud-error">{message}</p>}<button className="cloud-secondary" onClick={exportDevice}>Export device backup</button>{!migration&&<button onClick={()=>retry.current()}>Retry</button>}</section></main>;
  return <>{children}<button className={`cloud-status ${message?'cloud-warning':''}`} onClick={()=>setSettings(true)} aria-label="Cloud sync settings">{configured?status:'Set up sync'}</button>{settings&&<div className="cloud-overlay" onClick={()=>setSettings(false)}><section role="dialog" aria-modal="true" aria-label="Cloud sync" className="cloud-card" onClick={e=>e.stopPropagation()}><h2>Shared checklist</h2><p>{configured?status:'Add the two Supabase environment variables and run supabase/schema.sql. See CLOUD-SETUP.md.'}</p>{message&&<p className="cloud-error" role="alert">{message}</p>}<button className="cloud-secondary" onClick={exportDevice}>Export JSON backup</button><button className="cloud-secondary" onClick={()=>{const raw=localStorage.getItem('eldly-before-shared-v2');if(!raw){setMessage('No pre-migration backup on this device.');return;}const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='eldly-before-shared.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Export pre-migration backup</button><label className="cloud-import">Restore backup<input type="file" accept="application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const json=JSON.parse(await file.text());if(json.version!==1||!validateSnapshot(json.data))throw Error('Invalid all-device backup.');if(!confirm('Replace the shared checklist with this backup? This will also change your other devices. Export the current data first.'))return;restore(json.data);window.dispatchEvent(new Event(LOCAL_EVENT));setSettings(false);}catch(error){setMessage(String(error));}}}/></label><button className="cloud-secondary" onClick={()=>retry.current()}>Retry sync</button><button onClick={()=>setSettings(false)} autoFocus>Done</button></section></div>}</>;
}
