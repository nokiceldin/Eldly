import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {empty,onDay,matches,saveTask,saveRoutineInput,type Task,type Routine} from './engine';
import {validate} from './storage';
import {flatten,inflate} from './sync/records';
import TaskEditor from './components/TaskEditor';
const monthly:Routine={id:'monthly',title:'Pay bill',category:'Home',notes:'Keep note',color:'blue',start:'2026-11-02',monthDay:2,weekdays:[],frequency:'monthly',interval:1,paused:false,carry:true,important:false};
const task:Task={id:'original',title:'Pay bill',category:'Home',notes:'Keep note',color:'blue',scheduled:'2026-11-02',original:'2026-11-02',carry:true,important:false,order:1};
it('converts an existing task to the second of every month across different weekdays and years without a duplicate',()=>{
 const data=saveRoutineInput({...empty(),tasks:[task]},monthly,'2026-10-29',task);
 for(const day of ['2026-11-02','2026-12-02','2027-01-02','2027-02-02'])expect(onDay(data,day,'2026-10-29')).toHaveLength(1);
 expect(onDay(data,'2026-11-09','2026-10-29')).toHaveLength(0);
 expect(onDay(data,'2026-12-01','2026-10-29')).toHaveLength(0);
 expect(data.tasks[0]).toMatchObject({...task,routineId:'monthly'});expect(validate(data)).toBe(true);
});
it('uses the last day of short months without drifting from the original 29th, 30th or 31st anchor',()=>{
 for(const anchor of [29,30,31]){
  const r={...monthly,start:`2027-01-${anchor}`,monthDay:anchor};
  expect(matches(r,'2027-02-28')).toBe(true);expect(matches(r,`2027-03-${anchor}`)).toBe(true);
  expect(matches(r,'2027-03-28')).toBe(false);
 }
 expect(matches({...monthly,start:'2028-01-31',monthDay:31},'2028-02-29')).toBe(true);
 expect(matches({...monthly,start:'2028-01-31',monthDay:31},'2028-03-31')).toBe(true);
});
it('preserves completed history and converts only future weekly occurrences to a monthly date',()=>{
 const weekly:Routine={...monthly,id:'weekly',start:'2026-10-26',frequency:'weekly',weekdays:[0],monthDay:undefined};
 let data={...empty(),routines:[weekly]};
 const completed=onDay(data,'2026-10-26','2026-10-26')[0];data=saveTask(data,{...completed,completed:'2026-10-26'});
 const upcoming=onDay(data,'2026-11-02','2026-10-29')[0];
 data=saveRoutineInput(data,{...monthly,id:'weekly'},'2026-10-29',upcoming);
 expect(onDay(data,'2026-10-26','2026-10-29')[0]).toMatchObject({completed:'2026-10-26',notes:'Keep note',color:'blue'});
 expect(onDay(data,'2026-11-02','2026-10-29')).toHaveLength(1);
 expect(onDay(data,'2026-11-09','2026-10-29')).toHaveLength(0);
 expect(onDay(data,'2026-12-02','2026-10-29')).toHaveLength(1);expect(validate(data)).toBe(true);
});
it('keeps the month anchor through backup, sync, edits and pause boundaries',()=>{
 const r={...monthly,start:'2027-02-28',monthDay:31};const data={...empty(),routines:[r]};
 const restored=inflate(flatten(data));expect(restored).toEqual(data);expect(validate(restored)).toBe(true);
 expect(matches(r,'2027-03-31')).toBe(true);expect(matches({...r,paused:true,pausedFrom:'2027-03-01'},'2027-03-31')).toBe(false);
 expect(validate({...data,routines:[{...r,monthDay:32}]})).toBe(false);
});
it('shows monthly scheduling without weekday choices in the task editor',()=>{
 const html=renderToStaticMarkup(<TaskEditor editor={{routine:monthly,date:monthly.start}} categories={[]} close={()=>{}} onSave={()=>{}} onDelete={()=>{}}/>);
 expect(html).toContain('Every month · same date');expect(html).toContain('Repeats on day 2');expect(html).not.toContain('aria-label="Monday"');expect(html).not.toContain('Choose at least one day');
});
