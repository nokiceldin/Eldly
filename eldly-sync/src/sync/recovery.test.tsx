import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const mock=vi.hoisted(()=>({cleanups:[] as (()=>void)[],setters:[] as ReturnType<typeof vi.fn>[],sync:vi.fn()}));
vi.mock('react',async()=>({...await vi.importActual('react'),useState:(v:any)=>{const setter=vi.fn();mock.setters.push(setter);return [typeof v==='function'?v():v,setter];},useEffect:(fn:any)=>{const clean=fn();if(clean)mock.cleanups.push(clean);}}));
vi.mock('./client',()=>({configured:true}));
vi.mock('./engine',()=>({capture:vi.fn(),enrolled:()=>true,hasLocalData:()=>true,pull:vi.fn(),start:vi.fn(),initialize:vi.fn(),synchronize:mock.sync}));
vi.mock('./legacy',()=>({recoverLegacyPending:vi.fn()}));
vi.mock('../storage',()=>({load:()=>({}),persist:vi.fn()}));
vi.mock('../accountScope',()=>({isGuest:()=>false,isPersonalOwner:()=>false,scopeEpoch:()=>1,scopedKey:(s:string)=>s}));
vi.mock('./local',()=>({exportDevice:vi.fn(),LOCAL_EVENT:'local-save'}));
import {CloudBoundary} from './CloudBoundary';
import {Departure} from '../packly/SmartFeatures';
import {newTrip} from '../packly/data';
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-26T12:00:00'));mock.sync.mockReset();mock.setters=[];mock.cleanups=[];vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));vi.stubGlobal('navigator',{onLine:true});});
afterEach(()=>{mock.cleanups.forEach(fn=>fn());vi.useRealTimers();vi.unstubAllGlobals();});
it('retries immediately on manual retry and reconnect, even inside a long failure backoff',async()=>{
 mock.sync.mockRejectedValue(new Error('Unavailable'));CloudBoundary({children:null});await Promise.resolve();await Promise.resolve();expect(mock.sync).toHaveBeenCalledTimes(1);
 window.dispatchEvent(new Event('myspace-sync-now'));await Promise.resolve();await Promise.resolve();expect(mock.sync).toHaveBeenCalledTimes(2);
 mock.sync.mockResolvedValue(0);window.dispatchEvent(new Event('online'));await Promise.resolve();await Promise.resolve();expect(mock.sync).toHaveBeenCalledTimes(3);
});
it('refreshes on the first interaction after idle, without fetching on every tap',async()=>{
 mock.sync.mockResolvedValue(0);CloudBoundary({children:null});await Promise.resolve();await Promise.resolve();
 Object.assign(document,{visibilityState:'hidden'});await vi.advanceTimersByTimeAsync(180000);Object.assign(document,{visibilityState:'visible'});window.dispatchEvent(new Event('pointerdown'));await Promise.resolve();await Promise.resolve();expect(mock.sync).toHaveBeenCalledTimes(2);
 window.dispatchEvent(new Event('pointerdown'));expect(mock.sync).toHaveBeenCalledTimes(2);
});
it('ticks the departure clock, refreshes after backgrounding and removes timers/listeners',async()=>{
 Departure({trip:newTrip('Departure'),onTrip:vi.fn(),onClose:vi.fn()});const update=mock.setters[0];await vi.advanceTimersByTimeAsync(1000);expect(update).toHaveBeenLastCalledWith(Date.now());
 Object.assign(document,{visibilityState:'hidden'});update.mockClear();await vi.advanceTimersByTimeAsync(60000);expect(update).not.toHaveBeenCalled();window.dispatchEvent(new Event('focus'));expect(update).toHaveBeenLastCalledWith(Date.now());
 mock.cleanups.splice(0).forEach(fn=>fn());expect(vi.getTimerCount()).toBe(0);update.mockClear();window.dispatchEvent(new Event('focus'));expect(update).not.toHaveBeenCalled();
});
it('queues a deliberate retry pressed while another sync is finishing',async()=>{
 let release!:(v:number)=>void;mock.sync.mockImplementationOnce(()=>new Promise(r=>{release=r;})).mockResolvedValue(0);CloudBoundary({children:null});window.dispatchEvent(new Event('myspace-sync-now'));expect(mock.sync).toHaveBeenCalledTimes(1);release(0);await Promise.resolve();await Promise.resolve();expect(mock.sync).toHaveBeenCalledTimes(2);
});
