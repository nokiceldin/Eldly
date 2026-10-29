import {TASK_COLORS,type TaskColor} from '../taskColors';
export default function TaskColorPicker({colors,value,onChange,compact=false,label='Task text color'}:{colors:TaskColor[];value?:TaskColor;onChange:(color:TaskColor)=>void;compact?:boolean;label?:string}){
 if(!colors.length)return null;
 return <div className={`task-color-picker ${compact?'is-compact':''}`} role="group" aria-label={label}>{colors.map(id=>{const color=TASK_COLORS.find(c=>c.id===id)!;return <button type="button" key={id} title={color.label} aria-label={`${color.label} text`} aria-pressed={(value??'white')===id} onPointerDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={()=>onChange(id)}><span style={{background:color.hex}}/>{!compact&&<small>{color.label}</small>}</button>;})}</div>;
}
