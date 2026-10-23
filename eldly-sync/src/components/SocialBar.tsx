import {useEffect,useRef,useState} from 'react';
import {Bell,Flame} from 'lucide-react';
import {socialRequest,SOCIAL_EVENT,type SocialState} from '../social';
import FriendsPanel from './FriendsPanel';
export default function SocialBar(){
 const [state,setState]=useState<SocialState|null>(null),[open,setOpen]=useState<'friends'|'notifications'|'coins'|null>(null),[error,setError]=useState('');
 const pending=useRef(false);
 useEffect(()=>{
  let alive=true,lastActive=Date.now(),lastVisit=0;
  const refresh=async(visit=false)=>{
   if(pending.current||!navigator.onLine)return;
   pending.current=true;
   try{const data=await socialRequest(visit?{action:'visit',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}:undefined);if(alive){setState(data);setError('');}if(visit)lastVisit=Date.now();}
   catch{if(alive)setError('Friends could not refresh. Your personal data is safe.');}finally{pending.current=false;}
  };
  const receive=(event:Event)=>{if(alive)setState((event as CustomEvent<SocialState>).detail);};
  const activity=()=>{lastActive=Date.now();};
  const visible=()=>{if(document.visibilityState==='visible'){activity();void refresh(true);}};
  const show=()=>{setOpen('friends');void refresh();};
  window.addEventListener(SOCIAL_EVENT,receive);window.addEventListener('myspace-open-profile',show);
  window.addEventListener('pointerdown',activity,{passive:true});window.addEventListener('keydown',activity);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastActive<120000)void refresh(Date.now()-lastVisit>300000);},60000);
  void refresh(document.visibilityState==='visible');
  return()=>{alive=false;clearInterval(timer);window.removeEventListener(SOCIAL_EVENT,receive);window.removeEventListener('myspace-open-profile',show);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const unread=(state?.notifications.filter(n=>!n.read).length||0)+(state?.friends.filter(f=>f.status==='pending'&&f.incoming).length||0)+(state?.bestRequests.filter(r=>r.incoming).length||0)+(state?.proposals.filter(p=>p.incoming&&p.status==='pending').length||0);
 return <><button className="social-bell" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} title={error||'Notifications'} onClick={()=>setOpen('notifications')}><Bell size={16}/>{unread>0&&<span className="social-unread">{unread>9?'9+':unread}</span>}</button><button className="social-streak" onClick={()=>setOpen('friends')} aria-label={`${state?.profile.streak||0} day streak. Open profile`}><Flame size={15}/>{state?.profile.streak||0}</button>{open&&<FriendsPanel initial={state} initialTab={open} initialError={error} close={()=>setOpen(null)}/>}</>;
}
