import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import TaskEditor from './components/TaskEditor';
import {empty,onDay,saveTaskInput} from './engine';
it('keeps quick creation to a name and date and schedules the task only on its chosen future day',()=>{
 const html=renderToStaticMarkup(<TaskEditor editor={{date:'2026-10-28',quick:true}} categories={['School']} close={()=>{}} onSave={()=>{}} onDelete={()=>{}}/>);
 expect(html).toContain('New task');expect(html.match(/<input /g)).toHaveLength(2);
 expect(html).toContain('type="date"');expect(html).not.toContain('Category');expect(html).not.toContain('One-time');
 const d=saveTaskInput(empty(),{id:'future',title:'Dentist',scheduled:'2026-11-28',original:'2026-11-28',category:'',notes:'',carry:true,important:false,order:1});
 expect(onDay(d,'2026-10-28','2026-10-28')).toHaveLength(0);
 expect(onDay(d,'2026-11-28','2026-10-28').map(t=>t.title)).toEqual(['Dentist']);
 expect(d.tasks[0].original).toBe('2026-11-28');
});
