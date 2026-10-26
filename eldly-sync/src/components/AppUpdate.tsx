import {useEffect,useState} from 'react';
import {recordDiagnostic} from '../diagnostics';
import {capture} from '../sync/engine';
export default function AppUpdate(){
 const [available,setAvailable]=useState(false);
 useEffect(()=>{const hadController=!!navigator.serviceWorker?.controller;const changed=()=>{if(hadController)setAvailable(true);};navigator.serviceWorker?.addEventListener('controllerchange',changed);void navigator.serviceWorker?.getRegistration().then(r=>{if(r?.waiting)setAvailable(true);});const error=()=>recordDiagnostic('app');window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);return()=>{navigator.serviceWorker?.removeEventListener('controllerchange',changed);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);};},[]);
 return available?<button className="app-update" onClick={()=>{try{capture();}catch{}window.location.reload();}}>Reload to update</button>:null;
}
