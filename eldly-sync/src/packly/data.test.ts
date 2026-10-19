import { describe, expect, it } from 'vitest';
import { completed, defaultItems, getStatus, makeConfiguredTrip, newTrip, normalizeTrip, packedCount, remaining, type TripDetails } from './data';
const details: TripDetails = { type:'normal',startDate:'2026-10-16',durationDays:3,returnDate:'2026-10-18',departure:'',destination:'',climate:'mild',laundry:false,reminderMinutes:[] };
describe('integrated Packly data', () => {
  it('retains the full starter packing lists and trip types', () => {
    expect(defaultItems).toHaveLength(76);
    expect(makeConfiguredTrip('Tennis','tennis',{...details,type:'tennis'}).items).toHaveLength(76);
    expect(makeConfiguredTrip('Normal','normal',details).items).toHaveLength(56);
  });
  it('keeps trips independent and preserves packed status through a save/reload', () => {
    const first = newTrip('First'), second = newTrip('Second');
    first.statuses[first.items[0].id] = 'packed';
    const restored = normalizeTrip(JSON.parse(JSON.stringify(first)));
    expect(packedCount(restored)).toBe(1);
    expect(getStatus(second,second.items[0].id)).toBe('todo');
    expect(first.id).not.toBe(second.id);
  });
  it('counts packed and skipped items as resolved while keeping unpacked items for later rounds', () => {
    const trip = newTrip('Packing');
    trip.statuses[trip.items[0].id]='packed';
    trip.statuses[trip.items[1].id]='skipped';
    trip.statuses[trip.items[2].id]='unpacked';
    expect(completed(trip)).toBe(2);
    expect(packedCount(trip)).toBe(1);
    expect(remaining(trip)).toHaveLength(74);
  });
  it('normalizes old trip data and removes deleted items from saved queues', () => {
    const trip = newTrip('Old');
    trip.queue.push('deleted-item');
    const restored = normalizeTrip({...trip,position:999});
    expect(restored.queue).not.toContain('deleted-item');
    expect(restored.position).toBe(restored.queue.length);
    expect(restored.critical).toBeDefined();
  });
});

describe('single-match bag', () => {
  it('packs court essentials without overnight travel items', () => {
    const trip = makeConfiguredTrip('Afternoon match', 'match', {...details, type:'match', durationDays:14, laundry:true});
    expect(trip.items.map(i=>i.name)).toEqual(expect.arrayContaining(['Rack','Skor','Handduk','Vattenflaska','Match snacks / energy bars','Extra overgrips','Phone','NYCKEL']));
    expect(trip.items.map(i=>i.name)).not.toEqual(expect.arrayContaining(['Pass']));
    expect(trip.items.some(i=>['Visum','Shampoo','Skoldator och laddare','Jeans'].includes(i.name))).toBe(false);
    expect(trip.details).toMatchObject({type:'match',durationDays:1,returnDate:details.startDate,laundry:false});
    expect(trip.quantities?.['tennis-02']).toBe(2);
    expect(trip.quantities?.['tennis-07']).toBe(1);
    expect(trip.categories.every(c=>trip.items.some(i=>i.categoryId===c.id))).toBe(true);
    expect(trip.critical).toContain('tennis-02');
    expect(trip.queue).toEqual(trip.items.map(i=>i.id));
    expect(normalizeTrip(JSON.parse(JSON.stringify(trip))).details?.type).toBe('match');
  });
  it('preserves custom match templates and independently resets packed statuses', () => {
    const source=makeConfiguredTrip('First match','match',{...details,type:'match'});
    source.statuses['tennis-02']='packed';
    const template={id:'match-template',name:'My match bag',type:'match' as const,categories:source.categories,items:source.items,quantities:{...source.quantities,'tennis-02':3},critical:source.critical,lastMinute:source.lastMinute};
    const next=makeConfiguredTrip('Next match','match',{...details,type:'match'},[],template);
    expect(next.quantities?.['tennis-02']).toBe(3);
    expect(getStatus(next,'tennis-02')).toBe('todo');
    expect(source.statuses['tennis-02']).toBe('packed');
  });
});

describe('packing memory and equipment updates',()=>{
 it('adds laces and glue once to old tennis lists without changing packed items',()=>{
  const old=makeConfiguredTrip('Tournament','tennis',{...details,type:'tennis'});
  old.items=old.items.filter(i=>!['tennis-19','tennis-20'].includes(i.id));old.queue=old.items.map(i=>i.id);old.statuses['tennis-02']='packed';
  const migrated=normalizeTrip(old);
  expect(migrated.items.map(i=>i.name)).toEqual(expect.arrayContaining(['Shoe laces','Shoe glue']));
  expect(migrated.statuses['tennis-02']).toBe('packed');
  expect(normalizeTrip(migrated).items).toHaveLength(76);
  migrated.items=migrated.items.filter(i=>i.id!=='tennis-19');
  expect(normalizeTrip(migrated).items.some(i=>i.id==='tennis-19')).toBe(false);
 });
 it('retains quantities from completed trips for the next similar packing list',()=>{
  const old=makeConfiguredTrip('Previous','tennis',{...details,type:'tennis',finishedAt:100});
  old.quantities!['tennis-07']=5;old.statuses['tennis-07']='packed';
  const next=makeConfiguredTrip('Next','tennis',{...details,type:'tennis'},[],undefined,[old]);
  expect(next.quantities?.['tennis-07']).toBe(5);
  expect(getStatus(next,'tennis-07')).toBe('todo');
  expect(old.details?.finishedAt).toBe(100);
 });
});
