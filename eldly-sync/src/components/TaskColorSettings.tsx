import {TASK_COLORS,enabledTaskColors,type TaskColorSettings as Settings} from '../taskColors';
export default function TaskColorSettings({settings,onChange}:{settings?:Settings;onChange:(settings:Settings)=>void}){
 const enabled=enabledTaskColors(settings);
 return <details className="option-group"><summary>Colors</summary><div className="option-content"><p className="task-color-help">Choose the colors available for task text. Existing task colors stay the same.</p><div className="task-color-options">{TASK_COLORS.map(c=><label key={c.id}><span style={{background:c.hex}}/>{c.label}<input type="checkbox" checked={enabled.includes(c.id)} onChange={e=>onChange({...settings,enabled:e.target.checked?[...enabled,c.id]:enabled.filter(id=>id!==c.id)})}/></label>)}</div><button className="quiet-action" onClick={()=>onChange({...settings,enabled:TASK_COLORS.map(c=>c.id)})}>Enable all colors</button></div></details>;
}
