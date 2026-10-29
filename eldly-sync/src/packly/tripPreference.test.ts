import {it,expect,vi,afterEach} from 'vitest';
import {setAccountScope} from '../accountScope';
import {preferredTripType,rememberTripType} from './tripPreference';
afterEach(()=>{vi.unstubAllGlobals();setAccountScope(null as unknown as string);});
it('starts general, remembers a trip type, and isolates accounts',()=>{
 const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});
 setAccountScope('guest');expect(preferredTripType()).toBe('normal');rememberTripType('weekend');expect(preferredTripType()).toBe('weekend');
 setAccountScope('alice');expect(preferredTripType()).toBe('normal');setAccountScope('guest');expect(preferredTripType()).toBe('weekend');
});
it('uses a general trip if preferences are unavailable',()=>{vi.stubGlobal('localStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();}});expect(preferredTripType()).toBe('normal');expect(()=>rememberTripType('tennis')).not.toThrow();});
