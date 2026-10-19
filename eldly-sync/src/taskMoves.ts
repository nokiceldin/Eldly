import { allTasks, onDay, saveTask, type Data, type Task } from "./engine";
import { validDate } from "./mapping";
/** Save only this occurrence; recurring schedules and other weeks remain untouched. */
export function moveTaskOccurrence(data: Data, task: Task, day: string, index: number, today: string): Data {
  if (!validDate(day)) throw Error("Choose a valid day.");
  const current = allTasks(data, task.original > day ? task.original : day > today ? day : today, today).find(t=>t.id===task.id);
  if (!current || current.deleted) return data;
  const peers = onDay(data,day,today).filter(t=>t.id!==task.id);
  const insert = Math.max(0,Math.min(peers.length,index));
  const previous = peers[insert-1]?.order, next = peers[insert]?.order;
  // Occurrence order values may tie for generated routines; renumber this day's rows only.
  const ordered=[...peers.slice(0,insert),{...current,scheduled:day,completed:current.completed ? day : undefined},...peers.slice(insert)];
  return ordered.reduce((nextData,row,i)=>saveTask(nextData,{...row,order:i*1024}),data);
}
