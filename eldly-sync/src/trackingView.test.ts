import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {setAccountScope} from './accountScope';
import {readTrackingView,rememberTrackingView} from './trackingView';
beforeEach(()=>{
 const values=new Map<string,string>();
 vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
 setAccountScope('guest');
});
afterEach(()=>{vi.unstubAllGlobals();setAccountScope(null as unknown as string);});
it('starts monthly and remembers either selection across later visits',()=>{
 expect(readTrackingView()).toBe('monthly');
 rememberTrackingView('daily');expect(readTrackingView()).toBe('daily');
 rememberTrackingView('monthly');expect(readTrackingView()).toBe('monthly');
});
it('keeps different accounts and guest preferences separate',()=>{
 rememberTrackingView('daily');setAccountScope('alice');expect(readTrackingView()).toBe('monthly');
 rememberTrackingView('daily');setAccountScope('bob');expect(readTrackingView()).toBe('monthly');
 setAccountScope('alice');expect(readTrackingView()).toBe('daily');
 setAccountScope('guest');expect(readTrackingView()).toBe('daily');
});
it('falls back safely if storage is unavailable or contains an unknown view',()=>{
 localStorage.setItem('eldinos:guest:track-view','unknown');expect(readTrackingView()).toBe('monthly');
 vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('full');}});
 expect(readTrackingView()).toBe('monthly');expect(()=>rememberTrackingView('daily')).not.toThrow();
});
