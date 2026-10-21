import { useEffect, useRef, useState } from 'react';
import { Music2, VolumeX } from 'lucide-react';
import { scopedKey } from '../accountScope';
import { configurePlaybackAudio } from '../sounds';

const START = 16;
/** One player lives above all app pages; the preference belongs to this account/device. */
export default function Soundtrack() {
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(scopedKey('soundtrack-enabled'))==='true';}catch{return false;}});
 const player=useRef<HTMLAudioElement|null>(null);
 useEffect(()=>{
  if(!enabled)return;
  const audio=player.current;
  if(!audio)return;
  audio.src=`/myspace-soundtrack.mp3#t=${START}`;
  audio.preload='metadata';
  let pending=false,disposed=false;
  const play=()=>{
   if(disposed||pending||!audio.paused)return;
   configurePlaybackAudio();
   if(audio.readyState>=1&&audio.currentTime<START)audio.currentTime=START;
   pending=true;
   void audio.play().catch(()=>{/* Browser waits for a tap before allowing music. */}).finally(()=>{pending=false;if(disposed)audio.pause();});
  };
  const seek=()=>{if(audio.currentTime<START)audio.currentTime=START;};
  const repeat=()=>{audio.currentTime=START;play();};
  audio.addEventListener('loadedmetadata',seek);
  audio.addEventListener('ended',repeat);
  window.addEventListener('pointerdown',play);
  window.addEventListener('keydown',play);
  play();
  return()=>{
   disposed=true;
   window.removeEventListener('pointerdown',play);
   window.removeEventListener('keydown',play);
   audio.removeEventListener('loadedmetadata',seek);
   audio.removeEventListener('ended',repeat);
   audio.pause();audio.removeAttribute('src');audio.load();
  };
 },[enabled]);
 function toggle(){
  const next=!enabled;
  if(!next)player.current?.pause();
  try{localStorage.setItem(scopedKey('soundtrack-enabled'),String(next));}catch{/* This session can still change music. */}
  setEnabled(next);
 }
 // Remains mounted when the menu closes, so navigating never restarts the song.
 return <><audio ref={player} preload="metadata" aria-hidden="true"/><button type="button" className="soundtrack-toggle" aria-label={enabled?'Turn background music off':'Turn background music on'} aria-pressed={enabled} onClick={toggle}>{enabled?<Music2 size={18}/>:<VolumeX size={18}/>}</button></>;
}
