import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {BellRing,BellOff} from 'lucide-react';
import {scopedKey} from '../accountScope';
type Status={available:boolean;enabled:boolean;publicKey:string|null};
const CHANGED='myspace-push-changed';
async function request(body?:Record<string,unknown>):Promise<Status>{const response=await fetch('/api/account?action=push',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not update notifications.');return data;}
function applicationKey(value:string){const bytes=atob(value.replaceAll('-','+').replaceAll('_','/'));return Uint8Array.from(bytes,c=>c.charCodeAt(0));}
function wasAsked(){try{return localStorage.getItem(scopedKey('push-asked-v1'))==='true';}catch{return false;}}
export function NotificationPrompt(){return <NotificationSettings prompt/>;}
export default function NotificationSettings({prompt=false}:{prompt?:boolean}){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[dismissed,setDismissed]=useState(wasAsked);
 const alive=useRef(true),dialog=useRef<HTMLDialogElement>(null);
 const supported=typeof Notification!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window;
 useEffect(()=>{
  alive.current=true;void request().then(value=>{if(alive.current)setStatus(value);}).catch(()=>{if(alive.current&&!prompt)setMessage('Notifications could not load.');});
  const changed=(event:Event)=>{if(alive.current)setStatus((event as CustomEvent<Status>).detail);};window.addEventListener(CHANGED,changed);
  return()=>{alive.current=false;window.removeEventListener(CHANGED,changed);};
 },[prompt]);
 const show=prompt&&!dismissed&&status?.available&&!status.enabled;
 useEffect(()=>{if(show&&document.visibilityState==='visible')dialog.current?.showModal();const visible=()=>{if(show&&document.visibilityState==='visible')dialog.current?.showModal();};document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[show]);
 function dismiss(){try{localStorage.setItem(scopedKey('push-asked-v1'),'true');}catch{/* Keep this session quiet. */}setDismissed(true);}
 async function toggle(){
  if(busy)return;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const installed=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
  if(ios&&!installed){setMessage('Add MySpace to your Home Screen first.');return;}
  if(!supported){setMessage('This browser does not support phone notifications.');return;}
  if(!status?.available||!status.publicKey){setMessage('Notifications are temporarily unavailable.');return;}
  setBusy(true);setMessage('');
  try{
   let next:Status;
   if(status.enabled){next=await request({action:'unsubscribe'});const registration=await navigator.serviceWorker.ready;await (await registration.pushManager.getSubscription())?.unsubscribe();}
   else {
    // The system permission request must be directly triggered by the Allow tap.
    const permission=await Notification.requestPermission();if(permission!=='granted'){if(prompt)dismiss();throw Error('Allow notifications in your phone’s settings.');}
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(status.publicKey)});
    next=await request({action:'subscribe',subscription:subscription.toJSON(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
   }
   if(alive.current){setStatus(next);dismiss();window.dispatchEvent(new CustomEvent(CHANGED,{detail:next}));}
  }catch(error){if(alive.current)setMessage(error instanceof Error?error.message:'Could not update notifications.');}finally{if(alive.current)setBusy(false);}
 }
 if(prompt)return show?createPortal(<dialog ref={dialog} className="social-dialog notification-prompt" aria-labelledby="notification-prompt-title" onCancel={event=>{event.preventDefault();dismiss();}}><BellRing size={25}/><h2 id="notification-prompt-title">Notifications?</h2><p>Friend requests and a 9pm nudge.</p>{message&&<p role="status">{message}</p>}<div className="social-actions"><button type="button" disabled={busy} onClick={dismiss}>Not now</button><button type="button" className="social-primary" disabled={busy} onClick={()=>void toggle()}>{busy?'Enabling…':'Allow'}</button></div></dialog>,document.body):null;
 const label=status?.enabled?'Turn phone notifications off':'Enable phone notifications';
 return <div className="phone-notifications"><button type="button" disabled={busy||!status} aria-label={label} title={label} aria-pressed={!!status?.enabled} onClick={()=>void toggle()}>{status?.enabled?<BellRing size={18}/>:<BellOff size={18}/>}</button>{message&&<small role="status">{message}</small>}</div>;
}
