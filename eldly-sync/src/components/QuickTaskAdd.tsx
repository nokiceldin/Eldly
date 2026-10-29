import {useState} from 'react';
import {Plus} from 'lucide-react';
import {format,parseWeeklyTitle} from '../engine';
import {popularTaskColors,type TaskColor,type TaskColorSettings} from '../taskColors';
import TaskColorPicker from './TaskColorPicker';
export default function QuickTaskAdd({date,settings,onAdd}:{date:string;settings?:TaskColorSettings;onAdd:(title:string,color?:TaskColor)=>void}){
 const [title,setTitle]=useState(''),[color,setColor]=useState<TaskColor>();
 return <form className="quick-add" onSubmit={e=>{e.preventDefault();if(!parseWeeklyTitle(title).title)return;onAdd(title.trim(),color);setTitle('');setColor(undefined);}}><input aria-label={`Add a task to ${format(date,{weekday:'long'})}`} enterKeyHint="done" value={title} onChange={e=>setTitle(e.target.value)} maxLength={250}/>{title.trim()&&<><TaskColorPicker compact colors={popularTaskColors(settings)} value={color} onChange={setColor} label="Quick task text color"/><button type="submit" aria-label="Add task"><Plus size={19}/></button></>}</form>;
}
