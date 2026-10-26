import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {empty,saveTaskInput,syncChecklyHomework,type Task} from './engine';
import {buildRecap,recapWindows} from './recaps';
import TaskEditor from './components/TaskEditor';
const task:Task={id:'homework',title:'Homework',scheduled:'2026-10-25',original:'2026-10-25',category:'Personal',notes:'',carry:true,important:false,order:1};
it('offers an optional completion date and places corrected completion in the original week recap',()=>{
 const current={...empty(),tasks:[{...task,completed:'2026-10-26'}]},window=recapWindows('2026-10-26')[0];
 expect(buildRecap(current,window,'2026-10-26').completed).toBe(0);
 const corrected=saveTaskInput(current,{...task,completed:'2026-10-25'});expect(buildRecap(corrected,window,'2026-10-26').completed).toBe(1);
 expect(syncChecklyHomework(corrected,'2026-10-26').mapping?.entries['2026-10-25']?.homework).toMatchObject({source:'checkly'});
 expect(renderToStaticMarkup(<TaskEditor editor={{task:current.tasks[0],date:'2026-10-25'}} categories={['Personal']} close={()=>{}} onDelete={()=>{}} onSave={()=>{}}/>)).toContain('Completed on');
});
it('corrects only one recurring occurrence and keeps the default completion date unchanged unless edited',()=>{
 const occurrence={...task,id:'weekly:2026-10-25',routineId:'weekly',completed:'2026-10-26'},other={...task,id:'weekly:2026-11-01',scheduled:'2026-11-01',routineId:'weekly'};
 const d={...empty(),overrides:{[occurrence.id]:occurrence,[other.id]:other}};
 expect(saveTaskInput(d,{...occurrence,title:'Updated homework'}).overrides[occurrence.id].completed).toBe('2026-10-26');
 const next=saveTaskInput(d,{...occurrence,completed:'2026-10-25'});expect(next.overrides[other.id]).toEqual(other);expect(next.overrides[occurrence.id].completed).toBe('2026-10-25');
});
