import {Check,X} from 'lucide-react';
import {useState} from 'react';
import {avatarPreset,avatarPresets} from '../../shared/avatar-options';
import ProfileAvatar from './ProfileAvatar';
export function PortraitChoices({value,onChange,disabled=false}:{value:string;onChange:(id:string)=>void;disabled?:boolean}){
 return <div className="avatar-presets" role="group" aria-label="Choose your portrait">{avatarPresets.map(p=><button key={p.id} type="button" disabled={disabled} title={p.label} aria-label={`Choose ${p.label} portrait`} aria-pressed={value===p.id} onClick={()=>onChange(p.id)}><ProfileAvatar style={p.style} size={58}/></button>)}</div>;
}
export default function AvatarEditor({initial,busy,save,close}:{initial:string;busy:boolean;save:(id:string)=>void;close:()=>void}){
 const [id,setId]=useState(initial);
 return <section className="avatar-editor" aria-label="Choose your portrait">
  <div className="avatar-preview"><ProfileAvatar style={avatarPreset(id).style} size={112} label="Your portrait preview"/></div>
  <PortraitChoices value={id} onChange={setId} disabled={busy}/>
  <div className="social-actions avatar-save"><button type="button" disabled={busy} onClick={close} aria-label="Cancel portrait change" title="Cancel"><X size={18}/></button><button type="button" disabled={busy} className="social-primary" onClick={()=>save(id)} aria-label="Save portrait" title="Save"><Check size={18}/></button></div>
 </section>;
}
