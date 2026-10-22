import { saveTask, type Data, type Task } from './engine';

/** Keep conversion tombstones out of the list of user-deleted occurrences. */
export function deletedTasks(data: Data): Task[] {
 const representedOccurrences=new Set(data.tasks.filter(t=>t.routineId).map(t=>`${t.routineId}:${t.original}`));
 return [...data.tasks.filter(t=>t.deleted),...Object.values(data.overrides)
  .filter(t=>t.deleted&&(!t.routineId||!representedOccurrences.has(`${t.routineId}:${t.original}`)))]
  .sort((a,b)=>b.scheduled.localeCompare(a.scheduled)||a.title.localeCompare(b.title));
}

/** Restore only this record, preserving other tasks and edits made since deletion. */
export function restoreDeletedTask(data: Data, id: string): Data {
 const task=data.tasks.find(t=>t.id===id)||data.overrides[id];
 if(!task?.deleted)return data;
 return saveTask(data,{...task,deleted:false});
}
