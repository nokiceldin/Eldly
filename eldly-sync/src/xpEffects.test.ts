import {expect,it} from 'vitest';
import {xpMotes} from './xpEffects';
it('sends one mote per XP and preserves half XP',()=>{
 expect(xpMotes(4)).toEqual([1,1,1,1]);expect(xpMotes(1.5)).toEqual([1,.5]);expect(xpMotes(7.5)).toHaveLength(8);
 expect(xpMotes(-8)).toEqual([]);expect(xpMotes(0)).toEqual([]);
});
it('batches unusually large edits without losing XP',()=>{
 const motes=xpMotes(102.5);expect(motes).toHaveLength(40);expect(motes.reduce((a,b)=>a+b,0)).toBe(102.5);
});
