import {expect,it} from 'vitest';
import {xpMotes,coinEffect} from './xpEffects';
it('scales representative bundles instead of one particle per coin',()=>{
 expect(xpMotes(20)).toHaveLength(5);expect(xpMotes(30)).toHaveLength(6);expect(xpMotes(50)).toHaveLength(8);
 for(const n of [1,1.5,4,20,30,50,102.5,1000,1000000]){
  const motes=xpMotes(n);expect(motes.length).toBeLessThanOrEqual(12);expect(motes.reduce((a,b)=>a+b,0)).toBeCloseTo(n);
  if(Number.isInteger(n))expect(motes.every(Number.isInteger)).toBe(true);
 }
 expect(xpMotes(-8)).toEqual([]);expect(xpMotes(0)).toEqual([]);expect(xpMotes(Infinity)).toEqual([]);
});
it('finishes every gain in under a second and losses sooner, regardless of denomination',()=>{
 for(const delta of [1,20,50,100,1000,1000000]){
  const gain=coinEffect(delta),loss=coinEffect(-delta);
  expect(gain.lifetimeMs).toBeLessThanOrEqual(1000);expect(loss.lifetimeMs).toBeLessThan(600);
  expect(loss.lifetimeMs).toBe(loss.flightMs+(loss.motes.length-1)*loss.staggerMs);
 }
});
