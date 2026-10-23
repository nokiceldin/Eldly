import {ProfileContext} from '../profileContext';
import {PortraitChoices} from './AvatarEditor';
import ProfileAvatar from './ProfileAvatar';
import {SOCIAL_EVENT,type SocialState} from '../social';
import {avatarPreset,defaultAvatar,type AvatarStyle} from '../../shared/avatar-options';
import { authErrorMessage } from '../authErrors';
import PointsCounter from './PointsCounter';
import Soundtrack from './Soundtrack';
import SocialBar from './SocialBar';
import { useEffect, useState, type ReactNode } from 'react';
import type {AccountUser as User} from '../privateAuth';
import { LogOut, UserRound } from 'lucide-react';
import { authClient, privateAccounts, usernameEmail } from '../auth';
import { setAccountScope, isGuest } from '../accountScope';
import { enrolled, synchronize } from '../sync/engine';
export default function AccountBoundary({children}:{children:ReactNode}) {
 const [identity,setIdentity]=useState<User|'guest'|null>(null),[ready,setReady]=useState(false),[login,setLogin]=useState(false),[menu,setMenu]=useState(false);
 const [avatar,setAvatar]=useState<AvatarStyle>(defaultAvatar);
 useEffect(()=>{const changed=(e:Event)=>setAvatar((e as CustomEvent<SocialState>).detail.profile.avatar);window.addEventListener(SOCIAL_EVENT,changed);return()=>window.removeEventListener(SOCIAL_EVENT,changed);},[]);
 const [avatarId,setAvatarId]=useState('original');
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[creating,setCreating]=useState(false);
 useEffect(()=>{
  let alive=true;let current:string|null=null;
  const init=async()=>{try{
   const result=authClient?await authClient.auth.getSession():null;
   const session=result?.data.session||null;
   if(result?.error)setError(authErrorMessage(result.error));
   if(!alive)return;
   if(session){current=session.user.id;setAccountScope(current,session.user.app_metadata.legacy_owner===true,session.user.app_metadata.username||session.user.email?.split("@")[0]||"",session.user.app_metadata.home_name);setIdentity(session.user);}
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
 async function signIn(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  if(!authClient)throw Error('Account service is not configured.');
  const credentials={email:usernameEmail(username),password,avatarId};
  const result=creating?await authClient.auth.signUp(credentials):await authClient.auth.signInWithPassword(credentials);
  if(result.error)throw Error(authErrorMessage(result.error));
  localStorage.removeItem('eldinos-guest-mode');window.location.hash='';window.location.reload();
 }catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}finally{setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{
  if(!isGuest()&&enrolled()&&navigator.onLine){try{await synchronize();}catch{/* Pending edits remain in this account's cache; logout must still be available. */}}
  const result=await authClient?.auth.signOut({scope:'local'});if(result?.error)throw result.error;
  localStorage.removeItem('eldinos-guest-mode');setIdentity(null);setAccountScope('locked');window.location.hash='';window.location.reload();
 }catch{setError('Could not finish signing out. Your edits are safe on this device. Please retry.');}finally{setBusy(false);}}
 if(!ready)return <main className="cloud-loading"><img src="/eldly-logo.png" width="100" alt="MySpace"/><div className="cloud-loading-bar"><span/></div></main>;
 if(!identity||login)return <main className="account-login"><form onSubmit={signIn}>
  <ProfileAvatar style={creating?avatarPreset(avatarId).style:defaultAvatar} size={76}/><h1>MySpace<span>.</span></h1>
  <h2>{creating?'Create account':'Sign in'}</h2>
  <label>Username<input autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy} minLength={creating?3:undefined} maxLength={creating?32:undefined} pattern={creating?'[a-zA-Z0-9_]{3,32}':undefined} aria-describedby={creating?'username-help':undefined} value={username} onChange={e=>setUsername(e.target.value)}/></label>
  {creating&&<small id="username-help">3–32 letters, numbers or underscores.</small>}
  <label>Password<input type="password" autoComplete={creating?'new-password':'current-password'} required disabled={busy} minLength={creating?8:undefined} maxLength={creating?72:undefined} aria-describedby={creating?'password-help':undefined} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {creating&&<small id="password-help">At least 8 characters.</small>}
  {creating&&<section className="signup-portraits"><h3>Portrait</h3><PortraitChoices value={avatarId} onChange={setAvatarId} disabled={busy}/></section>}
  {error&&<p role="alert">{error}</p>}
  <button className="account-primary" disabled={busy}>{busy?(creating?'Creating account…':'Signing in…'):(creating?'Create account':'Sign in')}</button>
  {privateAccounts&&<button type="button" className="account-guest" disabled={busy} onClick={()=>{setCreating(!creating);setError('');setPassword('');}}>{creating?'Already have an account? Sign in':'New here? Create account'}</button>}
  <button type="button" className="account-guest" disabled={busy} onClick={()=>{localStorage.setItem('eldinos-guest-mode','1');window.location.hash='';window.location.reload();}}>Continue as guest</button>
  <small>Guest data stays on this device.</small>
  {identity&&<button type="button" disabled={busy} onClick={()=>setLogin(false)}>Back</button>}
 </form></main>;
 const name=identity==='guest'?'Guest':identity.app_metadata.username||identity.email?.split('@')[0]||'Account';
 return <ProfileContext.Provider value={avatar}>{children}<div className="account-control"><button onClick={()=>setMenu(!menu)} aria-expanded={menu}>{identity!=='guest'&&privateAccounts?<ProfileAvatar style={avatar} size={30}/>:<UserRound size={15}/>} {name}</button><PointsCounter/>{identity!=='guest'&&privateAccounts&&<SocialBar/>}<section hidden={!menu} className="account-menu" aria-label="Account"><Soundtrack/>{identity==='guest'?<button onClick={()=>{setMenu(false);setLogin(true);}}>Sign in</button>:<>{privateAccounts&&<button onClick={()=>{setMenu(false);window.dispatchEvent(new Event('myspace-open-profile'));}}>Profile</button>}<button disabled={busy} onClick={()=>void logout()}><LogOut size={15}/>Sign Out</button></>}{error&&<p role="alert">{error}</p>}</section></div></ProfileContext.Provider>;
}
