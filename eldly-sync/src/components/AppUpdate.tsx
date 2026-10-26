import {useEffect,useState} from 'react';
import {recordDiagnostic} from '../diagnostics';
import {capture} from '../sync/engine';
import {hasNewShell} from '../shellUpdate';
export default function AppUpdate(){
 const [available,setAvailable]=useState(false);
 useEffect(()=>{
  let alive=true;const hadController=!!navigator.serviceWorker?.controller;
  const loaded=document.querySelector('script[type="module"][src]')?.getAttribute('src')||null;
  const check=(worker:ServiceWorker|null)=>{void hasNewShell(worker,loaded).then(newer=>{if(alive&&newer)setAvailable(true);});};
  const changed=()=>{if(hadController)check(navigator.serviceWorker.controller);};
  navigator.serviceWorker?.addEventListener('controllerchange',changed);
  void navigator.serviceWorker?.getRegistration().then(r=>{if(r?.waiting)check(r.waiting);});
  const error=()=>recordDiagnostic('app');window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);
  return()=>{alive=false;navigator.serviceWorker?.removeEventListener('controllerchange',changed);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);};
 },[]);
 return available?<button className="app-update" onClick={()=>{try{capture();}catch{}window.location.reload();}}>Reload to update</button>:null;
}
