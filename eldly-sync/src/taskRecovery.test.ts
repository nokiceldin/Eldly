import { expect,it } from 'vitest';
import { empty,onDay,saveTask,saveTaskInput,type Task,type Routine } from './engine';
import { deletedTasks,restoreDeletedTask } from './taskRecovery';
import { apply,diff,flatten,inflate } from './sync/records';
const tomorrow='2026-10-23';
const task:Task={id:'task',title:'Lab 362',scheduled:tomorrow,original:tomorrow,category:'CS362',notes:'Due Monday',due:'2026-10-26',carry:true,important:false,order:4};
const routine:Routine={id:'lab',title:'Lab 362',start:'2026-10-16',weekdays:[4],frequency:'weekly',interval:1,paused:false,category:'CS362',notes:'Due Monday',carry:true,important:false,dueOffsetDays:3};

it('restores the exact one-time task, including dates, notes, completion and order, without replacing newer edits',()=>{
 const original={...empty(),tasks:[{...task,completed:tomorrow}]};
 const removed=saveTask(original,{...original.tasks[0],deleted:true});
 const current={...removed,tasks:[{...removed.tasks[0],notes:'Updated notes'},{...task,id:'unrelated',title:'Keep this new task'}]};
 const restored=restoreDeletedTask(current,task.id);
 expect(restored.tasks.find(t=>t.id===task.id)).toEqual({...original.tasks[0],notes:'Updated notes',deleted:false});
 expect(restored.tasks.find(t=>t.id==='unrelated')?.title).toBe('Keep this new task');
 expect(deletedTasks(restored)).toHaveLength(0);
 expect(restoreDeletedTask(restored,task.id)).toBe(restored);
});
it('recovers a deleted recurring occurrence without changing the routine or another occurrence',()=>{
 const data={...empty(),routines:[routine]};
 const occurrence=onDay(data,tomorrow,'2026-10-22')[0];
 const removed=saveTask(data,{...occurrence,deleted:true});
 expect(onDay(removed,tomorrow,'2026-10-22')).toHaveLength(0);
 expect(deletedTasks(removed)).toEqual([{...occurrence,deleted:true}]);
 const restored=restoreDeletedTask(removed,occurrence.id);
 expect(onDay(restored,tomorrow,'2026-10-22')).toEqual([{...occurrence,deleted:false}]);
 expect(restored.routines).toEqual(data.routines);
 expect(onDay(restored,'2026-10-30','2026-10-22')).toEqual(onDay(data,'2026-10-30','2026-10-22'));
 expect(restoreDeletedTask(restored,'missing')).toBe(restored);
});
it('keeps weekly conversion suppression records out of the recovery list',()=>{
 const data=saveTaskInput(empty(),{...task,title:'Lab (w)'});
 expect(deletedTasks(data)).toEqual([]);
 const occurrence=onDay(data,tomorrow,'2026-10-22')[0];
 expect(deletedTasks(saveTask(data,{...occurrence,deleted:true})).map(t=>t.id)).toEqual([task.id]);
});
it('persists deletion and restoration through the existing cloud record merge',()=>{
 const original={...empty(),tasks:[task]};
 const before=flatten({'checkly-data-v1':original});
 const removed=flatten({'checkly-data-v1':saveTask(original,{...task,deleted:true})});
 const remote=apply(before,diff(before,removed));
 const reopened=(inflate(remote) as Record<string,typeof original>)['checkly-data-v1'];
 const restored=flatten({'checkly-data-v1':restoreDeletedTask(reopened,task.id)});
 const next=(inflate(apply(remote,diff(remote,restored))) as Record<string,typeof original>)['checkly-data-v1'];
 expect(onDay(next,tomorrow,'2026-10-22')).toEqual([{...task,deleted:false}]);
});
