import Soundtrack from './Soundtrack';
import { useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogOut, UserRound } from 'lucide-react';
import { authClient, usernameEmail } from '../auth';
import { setAccountScope, isGuest } from '../accountScope';
import { exportDevice } from '../sync/local';
import { enrolled, synchronize } from '../sync/engine';
export default function AccountBoundary({children}:{children:ReactNode}) {
 const [identity,setIdentity]=useState<User|'guest'|null>(null),[ready,setReady]=useState(false),[login,setLogin]=useState(false),[menu,setMenu]=useState(false);
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let alive=true;let current:string|null=null;
  const init=async()=>{try{
   const session=authClient?(await authClient.auth.getSession()).data.session:null;
   if(!alive)return;
   if(session){current=session.user.id;setAccountScope(current,session.user.app_metadata.legacy_owner===true,session.user.app_metadata.username||session.user.email?.split("@")[0]||"");setIdentity(session.user);}
   else if(localStorage.getItem('eldinos-guest-mode')==='1'||!authClient){current='guest';setAccountScope('guest');setIdentity('guest');}
   setReady(true);
  }catch{setError('Could not open your session. Please sign in again.');setReady(true);}};
  void init();
  const subscription=authClient?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||current===null)return;
   const next=session?.user.id||null;
   if(next!==current&&!(current==='guest'&&!next)){setIdentity(null);setAccountScope('locked');window.location.reload();}
  });
  return()=>{alive=false;subscription?.data.subscription.unsubscribe();};
 },[]);
 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
  if(!authClient)throw Error('Account service is not configured.');
  const result=await authClient.auth.signInWithPassword({email:usernameEmail(username),password});
  if(result.error)throw Error('Incorrect username or password.');
  localStorage.removeItem('eldinos-guest-mode');window.location.hash='';window.location.reload();
 }catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}finally{setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{
  if(!isGuest()&&enrolled()&&navigator.onLine){try{await synchronize();}catch{/* Pending edits remain in this account's cache; logout must still be available. */}}
  const result=await authClient?.auth.signOut({scope:'local'});if(result?.error)throw result.error;
  localStorage.removeItem('eldinos-guest-mode');setIdentity(null);setAccountScope('locked');window.location.hash='';window.location.reload();
 }catch{setError('Could not finish signing out. Your edits are safe on this device. Retry, or export a backup first.');}finally{setBusy(false);}}
 if(!ready)return <main className="cloud-loading"><img src="/eldly-logo.png" width="100" alt="MySpace"/><div className="cloud-loading-bar"><span/></div></main>;
 if(!identity||login)return <main className="account-login"><form onSubmit={signIn}><img src="/eldly-logo.png" width="76" height="76" alt=""/><h1>MySpace<span>.</span></h1><h2>Sign in</h2><label>Username<input autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="account-primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><button type="button" className="account-guest" onClick={()=>{localStorage.setItem('eldinos-guest-mode','1');window.location.hash='';window.location.reload();}}>Continue as guest</button><small>Guest data stays on this device.</small>{identity&&<button type="button" onClick={()=>setLogin(false)}>Back</button>}</form></main>;
 const name=identity==='guest'?'Guest':identity.app_metadata.username||identity.email?.split('@')[0]||'Account';
 return <>{children}<div className="account-control"><button onClick={()=>setMenu(!menu)} aria-expanded={menu}><UserRound size={15}/>{name}</button><section hidden={!menu} className="account-menu" aria-label="Account"><strong>{name}</strong><Soundtrack/><p>{identity==='guest'?'Saved only on this device':'Your private account · cloud sync'}</p>{identity==='guest'?<button onClick={()=>{setMenu(false);setLogin(true);}}>Sign in</button>:<button disabled={busy} onClick={()=>void logout()}><LogOut size={15}/>Sign out of this device</button>}<button onClick={exportDevice}>Export my backup</button>{error&&<p role="alert">{error}</p>}</section></div></>;
}
