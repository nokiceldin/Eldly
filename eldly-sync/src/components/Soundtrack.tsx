import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Music2, VolumeX } from 'lucide-react';
import { scopedKey } from '../accountScope';
import { configureMixingAudio } from '../sounds';

/** One player lives above all app pages; the preference belongs to this account/device. */
const SoundtrackContext=createContext({enabled:false,toggle:()=>{}});
export function SoundtrackButton(){const {enabled,toggle}=useContext(SoundtrackContext);return <button type="button" className="soundtrack-toggle" aria-label={enabled?'Turn background music off':'Turn background music on'} aria-pressed={enabled} onClick={toggle}>{enabled?<Music2 size={18}/>:<VolumeX size={18}/>}</button>;}
export default function Soundtrack({children}:{children:ReactNode}) {
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(scopedKey('soundtrack-enabled'))==='true';}catch{return false;}});
 const player=useRef<HTMLAudioElement|null>(null);
 useEffect(()=>{
  if(!enabled)return;
  const audio=player.current;
  if(!audio)return;
  // The playback asset already omits the intro, including when looping.
  audio.src='/myspace-soundtrack-no-intro.mp3';
  audio.preload='metadata';
  let pending=false,disposed=false;
  const play=()=>{
   if(disposed||pending||!audio.paused)return;
   configureMixingAudio();
   pending=true;
   void audio.play().catch(()=>{/* Browser waits for a tap before allowing music. */}).finally(()=>{pending=false;if(disposed)audio.pause();});
  };
  // An older installed worker may fail a range request until its update activates.
  const recover=()=>{if(audio.error){audio.load();play();}};
  navigator.serviceWorker?.addEventListener('controllerchange',recover);
  window.addEventListener('pointerdown',play);
  window.addEventListener('keydown',play);
  play();
  return()=>{
   disposed=true;
   navigator.serviceWorker?.removeEventListener('controllerchange',recover);
   window.removeEventListener('pointerdown',play);
   window.removeEventListener('keydown',play);
   audio.pause();audio.removeAttribute('src');audio.load();
  };
 },[enabled]);
 function toggle(){
  const next=!enabled;
  if(!next)player.current?.pause();
  try{localStorage.setItem(scopedKey('soundtrack-enabled'),String(next));}catch{/* This session can still change music. */}
  setEnabled(next);
 }
 // Player stays mounted while profile controls open and close.
 return <SoundtrackContext.Provider value={{enabled,toggle}}><audio ref={player} loop preload="metadata" aria-hidden="true"/>{children}</SoundtrackContext.Provider>;
}
