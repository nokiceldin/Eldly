import { describe, expect, it } from 'vitest';
import { completed, defaultItems, getStatus, makeConfiguredTrip, newTrip, normalizeTrip, packedCount, remaining, type TripDetails } from './data';
const details: TripDetails = { type:'normal',startDate:'2026-10-16',durationDays:3,returnDate:'2026-10-18',departure:'',destination:'',climate:'mild',laundry:false,reminderMinutes:[] };
describe('integrated Packly data', () => {
  it('retains the full starter packing lists and trip types', () => {
    expect(defaultItems).toHaveLength(74);
    expect(makeConfiguredTrip('Tennis','tennis',{...details,type:'tennis'}).items).toHaveLength(74);
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
    expect(remaining(trip)).toHaveLength(72);
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
