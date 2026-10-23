import {useState} from 'react';
import {avatarPreset,avatarPresets} from '../../shared/avatar-options';
import ProfileAvatar from './ProfileAvatar';
export function PortraitChoices({value,onChange,disabled=false}:{value:string;onChange:(id:string)=>void;disabled?:boolean}){
 return <div className="avatar-presets" role="group" aria-label="Choose your portrait">{avatarPresets.map(p=><button key={p.id} type="button" disabled={disabled} aria-label={`Choose ${p.label} portrait`} aria-pressed={value===p.id} onClick={()=>onChange(p.id)}><ProfileAvatar style={p.style} size={58}/><span>{p.label}</span></button>)}</div>;
}
export default function AvatarEditor({initial,busy,save,close}:{initial:string;busy:boolean;save:(id:string)=>void;close:()=>void}){
 const [id,setId]=useState(initial);
 return <section className="avatar-editor" aria-label="Choose your portrait">
  <div className="avatar-preview"><ProfileAvatar style={avatarPreset(id).style} size={138} label="Your portrait preview"/><div><span className="social-eyebrow">YOUR FAMILIAR FACE</span><h3>Find your look.</h3><p>One character. Thirty carefully chosen portraits.</p></div></div>
  <PortraitChoices value={id} onChange={setId} disabled={busy}/>
  <div className="social-actions avatar-save"><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="button" disabled={busy} className="social-primary" onClick={()=>save(id)}>Save portrait</button></div>
 </section>;
}
