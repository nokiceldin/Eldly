import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './client';
import { capture, enrolled, pull, start, synchronize, type Pull } from './engine';
import { exportDevice, LOCAL_EVENT, restore, validateSnapshot } from './local';
import './cloud.css';
export function CloudBoundary({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [checked,setChecked]=useState(!configured);
  const [ready,setReady]=useState(!configured);
  const [choice,setChoice]=useState<Pull|null>(null);
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [message,setMessage]=useState(''),[status,setStatus]=useState('Connecting…');
  const [settings,setSettings]=useState(false),[busy,setBusy]=useState(false);
  const running=useRef(false), uid=useRef<string|null>(null);
  useEffect(()=>{
    if(!supabase) return;
    let alive=true;
    supabase.auth.getSession().then(({data,error})=>{ if(alive){setSession(data.session);setChecked(true);if(error)setMessage(error.message);} });
    const {data}=supabase.auth.onAuthStateChange((_event,s)=>{if(alive){if(uid.current!==s?.user.id){setReady(false);setChoice(null);}setSession(s);setChecked(true);}});
    return()=>{alive=false;data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    const id=session?.user.id; uid.current=id||null;
    if(!id) return;
    let alive=true;
    const sync=async()=>{
      if(running.current || !alive) return;
      running.current=true;
      try {
        if(!enrolled(id)) {setChoice(await pull());setStatus('Choose starting data');return;}
        if(!navigator.onLine){setStatus('Offline · saved on this device');setReady(true);return;}
        setStatus('Syncing…');
        const remaining=await synchronize(id);
        if(alive){setReady(true);setMessage('');setStatus(remaining?'Syncing…':'Saved to cloud');}
      } catch(error){if(alive){setMessage(String(error));setStatus('Sync needs attention');if(enrolled(id))setReady(true);}}
      finally{running.current=false;}
    };
    const save=()=>{try{capture(id);setStatus(navigator.onLine?'Syncing…':'Offline · saved on this device');void sync();}catch(error){setMessage(`Could not queue cloud changes: ${String(error)}`);setStatus('Sync needs attention');}};
    const focus=()=>{if(document.visibilityState==='visible')void sync();};
    const offline=()=>setStatus('Offline · saved on this device');
    window.addEventListener(LOCAL_EVENT,save);
    window.addEventListener('online',focus);window.addEventListener('offline',offline);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    const timer=setInterval(()=>void sync(),3000);void sync();
    return()=>{alive=false;clearInterval(timer);window.removeEventListener(LOCAL_EVENT,save);window.removeEventListener('online',focus);window.removeEventListener('offline',offline);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
  },[session?.user.id]);
  async function choose(useDevice:boolean){
    if(!session||!choice)return;setBusy(true);
    try{
      // Re-read immediately: never let two fresh devices silently replace an existing cloud.
      const current=await pull();
      if(useDevice && current.revision!==choice.revision){setChoice(current);throw Error('Cloud data changed. Review the choices again.');}
      start(session.user.id,current,useDevice);setChoice(null);setStatus('Syncing…');
      const remaining=await synchronize(session.user.id);setReady(true);setMessage('');setStatus(remaining?'Syncing…':'Saved to cloud');
    }catch(error){setMessage(String(error));}finally{setBusy(false);}
  }
  async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const {error}=await supabase!.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('');}catch(error){setMessage(String(error));}finally{setBusy(false);}}
  const panel=(content:ReactNode)=><main className="cloud-page"><section className="cloud-card"><img src="/eldly-logo.png" alt="" width="72" height="72"/><h1>Eldly</h1>{content}{message&&<p role="alert" className="cloud-error">{message}</p>}</section></main>;
  if(!checked)return panel(<p>Opening your space…</p>);
  if(configured&&!session)return panel(<><p>Your space, on every device.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><small>Use the account you created in Supabase. Sign in with the same account on your phone and laptop.</small><button className="cloud-secondary" onClick={exportDevice}>Back up this device</button></>);
  if(choice&&!ready)return panel(<><p>{choice.revision?'Cloud data already exists. Which copy should this device use?':'Start sync with the device that has your latest data.'}</p><button disabled={busy} onClick={()=>void choose(false)} hidden={!choice.revision}>Use cloud data on this device</button><button className={choice.revision?'cloud-secondary':''} disabled={busy} onClick={()=>{if(choice.revision&&!confirm('Replace cloud data with this device’s data? This also changes your other devices. Export a backup first.'))return;void choose(true);}}>{choice.revision?'Replace cloud with this device':'Start with this device’s data'}</button><button className="cloud-secondary" onClick={exportDevice}>Back up this device first</button><small>A safety copy is also kept on this device before switching.</small></>);
  if(!ready)return panel(<><p>{status}</p><button onClick={()=>location.reload()}>Retry</button><button className="cloud-secondary" onClick={exportDevice}>Back up this device</button></>);
  return <>{children}<button className={`cloud-status ${message?'cloud-warning':''}`} onClick={()=>setSettings(true)} aria-label="Cloud sync settings">{configured?status:'Set up sync'}</button>{settings&&<div className="cloud-overlay" onClick={()=>setSettings(false)}><section role="dialog" aria-modal="true" aria-label="Cloud sync" className="cloud-card" onClick={e=>e.stopPropagation()}><h2>Cloud sync</h2><p>{configured?status:'This copy saves only on this device. Follow CLOUD-SETUP.md to connect your free Supabase project.'}</p>{session&&<small>{session.user.email}</small>}{message&&<p className="cloud-error" role="alert">{message}</p>}<button className="cloud-secondary" onClick={exportDevice}>Export all device data</button><label className="cloud-import">Restore device backup<input type="file" accept="application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const json=JSON.parse(await file.text());if(json.version!==1||!validateSnapshot(json.data))throw Error('Invalid all-device backup.');if(!confirm('Replace this device’s data with this backup? When signed in, this change also syncs to your other devices.'))return;restore(json.data);window.dispatchEvent(new Event(LOCAL_EVENT));location.reload();}catch(error){setMessage(String(error));}}}/></label>{session&&<button className="cloud-secondary" onClick={async()=>{if(!confirm('Sign out? Any pending offline changes remain on this device for this account.'))return;await supabase!.auth.signOut({scope:'local'});setSettings(false);}}>Sign out</button>}<button onClick={()=>setSettings(false)} autoFocus>Done</button></section></div>}</>;
}
