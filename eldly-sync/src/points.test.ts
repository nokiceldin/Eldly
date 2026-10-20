import { describe,it,expect } from 'vitest';
import { entryPoints,pointsHistory,pointsStats } from './points';
import { add } from './engine';
import type { MappingData } from './mapping';
const check={kind:'check'} as const;
const mapping=():MappingData=>({version:1,startedOn:'2026-10-15',entries:{}});
describe('personal Track points',()=>{
 it('scores every requested habit and exact sleep/phone thresholds',()=>{
  for(const [id,score] of Object.entries({tennis:5,fitness:5,recovery:2,reading:3,journaling:3,'no-phone':2,homework:4,coaching:1,porn:-8,goyslop:-4}))expect(entryPoints(id,check)).toBe(score);
  expect(entryPoints('tennis',{kind:'duration',minutes:90})).toBe(5);
  expect(entryPoints('sleep',{kind:'sleep',nightMinutes:480,dayMinutes:0})).toBe(0);
  expect(entryPoints('sleep',{kind:'sleep',nightMinutes:480,dayMinutes:1})).toBe(5);
  expect(entryPoints('screen-time',undefined)).toBe(0);
  expect(entryPoints('screen-time',{kind:'phone',pickups:5})).toBe(0);
  for(const [minutes,score] of [[0,2],[119,2],[120,1],[179,1],[180,0]])expect(entryPoints('screen-time',{kind:'phone',minutes})).toBe(score);
  expect(entryPoints('screen-time',{kind:'duration',minutes:100})).toBe(2);
  expect(entryPoints('praying',{kind:'prayer',count:2})).toBe(3);
  expect(entryPoints('praying',{kind:'prayer',count:8})).toBe(7.5);
  expect(entryPoints('unknown',check)).toBe(0);
 });
 it('caps weekly activity days while preserving prayer and other daily points',()=>{
  const m=mapping();for(let i=0;i<7;i++)m.entries[add('2026-10-19',i)]={tennis:{kind:'duration',minutes:60},fitness:{kind:'duration',minutes:60},recovery:check,praying:{kind:'prayer',count:5},sleep:{kind:'sleep',nightMinutes:510,dayMinutes:0},reading:check,journaling:check,'no-phone':check,homework:check,coaching:check,porn:check,goyslop:check,'screen-time':{kind:'phone',minutes:60}};
  const w=pointsHistory(m,'2026-10-25').at(-1)!;
  expect(w.breakdown).toMatchObject({tennis:30,fitness:20,recovery:8,praying:52.5});expect(w.total).toBe(166.5);
  // Another log reload or a duration edit cannot farm points.
  m.entries['2026-10-19'].tennis={kind:'duration',minutes:120};expect(pointsHistory(m,'2026-10-25').at(-1)?.total).toBe(166.5);
  delete m.entries['2026-10-19'].porn;expect(pointsHistory(m,'2026-10-25').at(-1)?.total).toBe(174.5);
 });
 it('excludes pre-start/future logs, resets weekly caps and computes completed full-week records',()=>{
  const m=mapping();m.entries={'2026-10-14':{reading:check},'2026-10-15':{reading:check},'2026-10-19':{tennis:{kind:'duration',minutes:60}},'2026-10-26':{fitness:{kind:'duration',minutes:60}},'2026-10-28':{reading:check}};
  const s=pointsStats(m,'2026-10-27');expect(s.total).toBe(13);expect(s.current).toBe(5);expect(s.average).toBe(5);expect(s.best?.from).toBe('2026-10-19');expect(s.weeks[0].partial).toBe(true);
  expect(pointsStats(m,'2026-10-20').average).toBeNull();
 });
 it('allows negative totals and reflects removals immediately',()=>{
  const m=mapping();m.entries['2026-10-19']={porn:check,goyslop:check};expect(pointsStats(m,'2026-10-20').total).toBe(-12);
  delete m.entries['2026-10-19'];expect(pointsStats(m,'2026-10-20').total).toBe(0);
 });
});
