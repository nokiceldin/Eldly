import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import StreakFlame from './StreakFlame';
import StreakCelebration,{STREAK_CELEBRATION_MS} from './StreakCelebration';
import {trackingStreak} from '../../shared/streak';
import {load} from '../storage';
import {localDay} from '../engine';
import {LOCAL_EVENT,REMOTE_EVENT} from '../sync/local';
import {synchronize} from '../sync/engine';
import {scopedKey} from '../accountScope';
import {useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {socialRequest,SOCIAL_EVENT,type SocialState} from '../social';
import {NotificationPrompt} from './NotificationSettings';
import FriendsPanel from './FriendsPanel';
export default function SocialBar({accountActions}:{accountActions?:ReactNode}){
 const [state,setState]=useState<SocialState|null>(null),[open,setOpen]=useState<'profile'|'friends'|'notifications'|'coins'|null>(()=>new URLSearchParams(window.location.search).has('inbox')?'notifications':null),[error,setError]=useState('');
 const pending=useRef(false);
 const timezone=useRef<string|null>(null);
 const today=()=>timezone.current?new Intl.DateTimeFormat('en-CA',{timeZone:timezone.current,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()):localDay();
 const [localStreak,setLocalStreak]=useState(()=>trackingStreak(load().mapping,today()));
 const [celebration,setCelebration]=useState<{from:number;to:number}|null>(null);
 useEffect(()=>{
  let previousMapping=load().mapping,timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=(event:Event)=>{
   const mapping=load().mapping,previous=trackingStreak(previousMapping,today()),next=trackingStreak(mapping,today());setLocalStreak(next);
   if(event.type===LOCAL_EVENT&&!previous.trackedToday&&next.trackedToday&&next.streak>0){
    const key=scopedKey('streak-celebrated-'+today());
    if(localStorage.getItem(key)!=='1'){localStorage.setItem(key,'1');setCelebration({from:next.streak-1,to:next.streak});clearTimeout(timer);timer=setTimeout(()=>setCelebration(null),STREAK_CELEBRATION_MS);}
   }
   const changed=next.streak!==previous.streak||next.trackedToday!==previous.trackedToday;previousMapping=mapping;
   if(event.type===LOCAL_EVENT&&changed)void synchronize().then(()=>socialRequest()).catch(()=>{});
  };
  window.addEventListener(LOCAL_EVENT,refresh);window.addEventListener(REMOTE_EVENT,refresh);window.addEventListener(SOCIAL_EVENT,refresh);
  const tick=setInterval(()=>refresh(new Event('tick')),60000);
  return()=>{clearTimeout(timer);clearInterval(tick);window.removeEventListener(LOCAL_EVENT,refresh);window.removeEventListener(REMOTE_EVENT,refresh);window.removeEventListener(SOCIAL_EVENT,refresh);};
 },[]);
 useEffect(()=>{
  let alive=true,lastActive=Date.now(),lastVisit=0;
  const refresh=async(visit=false)=>{
   if(pending.current||!navigator.onLine)return;
   pending.current=true;
   try{const data=await socialRequest(visit?{action:'visit',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}:undefined);if(alive){setState(data);setError('');}if(visit)lastVisit=Date.now();}
   catch{if(alive)setError('Friends could not refresh. Your personal data is safe.');}finally{pending.current=false;}
  };
  const receive=(event:Event)=>{const data=(event as CustomEvent<SocialState>).detail;timezone.current=data.profile.timezone;if(alive){setState(data);setLocalStreak(trackingStreak(load().mapping,today()));}};
  const activity=()=>{const idle=Date.now()-lastActive>=120000;lastActive=Date.now();if(idle)void refresh();};
  const visible=()=>{if(document.visibilityState==='visible'){activity();void refresh(true);}};
  const openInbox=(event:MessageEvent)=>{if(event.data?.type==='myspace-open-inbox')setOpen('notifications');};
  navigator.serviceWorker?.addEventListener('message',openInbox);
  const show=(event:Event)=>{setOpen((event as CustomEvent).detail==='coins'?'coins':(event as CustomEvent).detail==='friends'?'friends':'profile');};
  window.addEventListener(SOCIAL_EVENT,receive);window.addEventListener('myspace-open-profile',show);
  window.addEventListener('pointerdown',activity,{passive:true});window.addEventListener('keydown',activity);window.addEventListener('online',visible);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastActive<120000)void refresh(Date.now()-lastVisit>300000);},60000);
  void refresh(document.visibilityState==='visible');
  return()=>{alive=false;navigator.serviceWorker?.removeEventListener('message',openInbox);clearInterval(timer);window.removeEventListener(SOCIAL_EVENT,receive);window.removeEventListener('myspace-open-profile',show);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('online',visible);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const unread=(state?.notifications.filter(n=>!n.read).length||0)+(state?.friends.filter(f=>f.status==='pending'&&f.incoming&&!state.notifications.some(n=>n.kind==='friend_request'&&n.username===f.username&&!n.read)).length||0)+(state?.bestRequests.filter(r=>r.incoming).length||0);
 return <><NotificationPrompt/><button className="social-bell" aria-label={`Inbox${unread?`, ${unread} unread`:''}`} title={error||'Inbox'} onClick={()=>setOpen('notifications')}><Bell size={16}/>{unread>0&&<span className="social-unread">{unread>9?'9+':unread}</span>}</button><span className="social-streak" role="img" aria-label={`${localStreak.streak} day streak`} title={`${localStreak.streak} day streak`}><StreakFlame size={24}/>{localStreak.streak}</span>{open&&<FriendsPanel key={open} initial={state} initialTab={open} initialError={error} accountActions={accountActions} close={()=>setOpen(null)}/>}{celebration&&createPortal(<StreakCelebration from={celebration.from} to={celebration.to} dismiss={()=>setCelebration(null)}/>,document.body)}</>;
}
