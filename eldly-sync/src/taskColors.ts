import type {Data,Task} from './engine';
export const TASK_COLORS=[
 {id:'white',label:'White',hex:'#e8e8e3'},{id:'blue',label:'Blue',hex:'#8dbdff'},
 {id:'cyan',label:'Cyan',hex:'#83d8ee'},{id:'teal',label:'Teal',hex:'#80d4c4'},
 {id:'green',label:'Green',hex:'#a0d8a4'},{id:'lime',label:'Lime',hex:'#c5dc87'},
 {id:'yellow',label:'Yellow',hex:'#f0d57b'},{id:'orange',label:'Orange',hex:'#efb17d'},
 {id:'red',label:'Red',hex:'#f09c98'},{id:'pink',label:'Pink',hex:'#edabcf'},
 {id:'purple',label:'Purple',hex:'#b8a4f0'},{id:'lavender',label:'Lavender',hex:'#d0bde9'},
 {id:'brown',label:'Brown',hex:'#c9ad96'},{id:'gray',label:'Gray',hex:'#b2b7bc'},
] as const;
export type TaskColor=typeof TASK_COLORS[number]['id'];
export type TaskColorSettings={enabled?:TaskColor[];usage?:Partial<Record<TaskColor,number>>};
export const validTaskColor=(value:unknown):value is TaskColor=>TASK_COLORS.some(c=>c.id===value);
export function validColorSettings(value:unknown):boolean{
 if(value===undefined)return true;if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const s=value as TaskColorSettings;
 return (s.enabled===undefined||Array.isArray(s.enabled)&&s.enabled.every(validTaskColor)&&new Set(s.enabled).size===s.enabled.length)&&(s.usage===undefined||!!s.usage&&typeof s.usage==='object'&&!Array.isArray(s.usage)&&Object.entries(s.usage).every(([id,n])=>validTaskColor(id)&&typeof n==='number'&&Number.isSafeInteger(n)&&n>=0));
}
export function enabledTaskColors(settings?:TaskColorSettings):TaskColor[]{return settings?.enabled??TASK_COLORS.map(c=>c.id);}
export function popularTaskColors(settings?:TaskColorSettings):TaskColor[]{
 const defaults:TaskColor[]=['blue','white','green','yellow',...TASK_COLORS.map(c=>c.id)];
 return [...new Set(defaults)].filter(id=>enabledTaskColors(settings).includes(id)).sort((a,b)=>(settings?.usage?.[b]||0)-(settings?.usage?.[a]||0)).slice(0,4);
}
export const taskColorHex=(color?:TaskColor)=>TASK_COLORS.find(c=>c.id===color)?.hex??TASK_COLORS[0].hex;
export function rememberTaskColor(data:Data,color:TaskColor):Data{
 return {...data,taskColorSettings:{...data.taskColorSettings,usage:{...data.taskColorSettings?.usage,[color]:Math.min(Number.MAX_SAFE_INTEGER,(data.taskColorSettings?.usage?.[color]||0)+1)}}};
}
/** A repeating task has one color across all weeks, including moved/completed occurrences. */
export function setTaskColor(data:Data,task:Pick<Task,'id'|'routineId'>,color:TaskColor):Data{
 const parent=task.routineId||data.tasks.find(t=>t.id===task.id)?.routineId;
 const matches=(t:Task)=>parent?t.routineId===parent:t.id===task.id;
 return {...data,tasks:data.tasks.map(t=>matches(t)?{...t,color}:t),routines:data.routines.map(r=>r.id===parent?{...r,color}:r),overrides:Object.fromEntries(Object.entries(data.overrides).map(([id,t])=>[id,matches(t)?{...t,color}:t]))};
}
