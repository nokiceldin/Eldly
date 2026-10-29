import {it,expect} from 'vitest';
import {empty,onDay,saveTask,saveTaskInput,type Task} from './engine';
import {validate} from './storage';
import {enabledTaskColors,popularTaskColors,TASK_COLORS,setTaskColor,rememberTaskColor} from './taskColors';
import {flatten,inflate} from './sync/records';
const task:Task={id:'read',title:'Read (W)',scheduled:'2026-10-29',original:'2026-10-29',category:'School',notes:'Keep this',carry:true,important:false,order:1,color:'blue'};
it('enables the whole palette for existing data and ranks only enabled colors by actual usage',()=>{
 expect(validate(empty())).toBe(true);expect(enabledTaskColors()).toHaveLength(TASK_COLORS.length);
 const data=rememberTaskColor(rememberTaskColor(empty(),'purple'),'purple');
 expect(popularTaskColors(data.taskColorSettings)[0]).toBe('purple');
 expect(popularTaskColors({...data.taskColorSettings,enabled:['blue','white']})).toEqual(['blue','white']);
 expect(popularTaskColors({enabled:[]})).toEqual([]);
});
it('keeps a weekly color on future, completed and moved occurrences without changing their task data',()=>{
 let data=saveTaskInput(empty(),task);const parent=data.tasks[0].routineId!;
 expect(data.routines[0].color).toBe('blue');
 const next=onDay(data,'2026-11-05','2026-10-29')[0];expect(next.color).toBe('blue');
 data=saveTask(data,{...next,scheduled:'2026-11-06',completed:'2026-11-06'});
 const colored=setTaskColor(data,{id:next.id,routineId:parent},'purple');
 expect(colored.overrides[next.id]).toMatchObject({color:'purple',scheduled:'2026-11-06',completed:'2026-11-06',notes:'Keep this'});
 expect(onDay(colored,'2026-10-29','2026-10-29')[0].color).toBe('purple');
 expect(onDay(colored,'2026-11-12','2026-10-29')[0].color).toBe('purple');
 expect(colored.routines).toHaveLength(1);expect(colored.routines[0].start).toBe('2026-10-29');expect(validate(colored)).toBe(true);
});
it('preserves colors and preferences through sync/backup and does not recolor tasks when a palette choice is hidden',()=>{
 const data=rememberTaskColor({...saveTaskInput(empty(),{...task,title:'School'}),taskColorSettings:{enabled:['white' as const]}},'blue');
 const restored=inflate(flatten(data));expect(restored).toEqual(data);expect(validate(restored)).toBe(true);
 expect(data.tasks[0].color).toBe('blue');expect(enabledTaskColors(data.taskColorSettings)).toEqual(['white']);
 expect(validate({...data,tasks:[{...task,color:'url(evil)'}]})).toBe(false);
 expect(validate({...data,taskColorSettings:{enabled:['unknown']}})).toBe(false);
});
