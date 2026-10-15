import { describe, expect, it } from 'vitest';
import { acknowledge, apply, diff, flatten, inflate } from './records';
describe('cloud record merges',()=>{
 it('round trips existing documents and IDs with punctuation',()=>{
  const value={tasks:[{id:'a/"[]',title:'Test',done:false}],empty:[],categories:['Personal'],nested:{'__proto__':1}};
  expect(inflate(flatten(value))).toEqual(value);
 });
 it('preserves independent task edits and concurrent additions',()=>{
  const base={tasks:[{id:'a',title:'A',done:false},{id:'b',title:'B',done:false}]};
  const a=structuredClone(base);a.tasks[0].done=true;a.tasks.push({id:'c',title:'C',done:false});
  const b=structuredClone(base);b.tasks[1].title='Changed';b.tasks.push({id:'d',title:'D',done:false});
  const merged=inflate(apply(apply(flatten(base),diff(flatten(base),flatten(a))),diff(flatten(base),flatten(b)))) as typeof base;
  expect(merged.tasks).toHaveLength(4);expect(merged.tasks.find(t=>t.id==='a')?.done).toBe(true);expect(merged.tasks.find(t=>t.id==='b')?.title).toBe('Changed');
 });
 it('does not resurrect a deleted task when a stale device edits its title',()=>{
  const base={tasks:[{id:'a',title:'A'}]};const edit={tasks:[{id:'a',title:'Edited'}]};
  expect(inflate(apply(apply(flatten(base),diff(flatten(base),flatten({tasks:[]}))),diff(flatten(base),flatten(edit))))).toEqual({tasks:[]});
 });
 it('merges night/day sleep and phone pickups/minutes independently',()=>{
  const base={entries:{'2026-10-15':{sleep:{nightMinutes:480,dayMinutes:0},phone:{minutes:60,pickups:10}}}};
  const a=structuredClone(base),b=structuredClone(base);a.entries['2026-10-15'].sleep.dayMinutes=45;a.entries['2026-10-15'].phone.pickups=20;b.entries['2026-10-15'].sleep.nightMinutes=450;b.entries['2026-10-15'].phone.minutes=90;
  const merged=inflate(apply(apply(flatten(base),diff(flatten(base),flatten(a))),diff(flatten(base),flatten(b))));
  expect(merged).toEqual({entries:{'2026-10-15':{sleep:{nightMinutes:450,dayMinutes:45},phone:{minutes:90,pickups:20}}}});
 });
 it('acknowledges only the exact writes sent, keeping newer writes for the same field',()=>{
  const sent=diff(flatten({a:1}),flatten({a:2}));const newer=diff(flatten({a:2}),flatten({a:3}));
  expect(acknowledge([...sent,...newer],sent)).toEqual(newer);
 });
});
