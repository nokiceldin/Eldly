import {it,expect,vi,afterEach} from 'vitest';
const mock=vi.hoisted(()=>({set:vi.fn(),cleanups:[] as (()=>void)[],capture:vi.fn()}));
vi.mock('react',async()=>({...await vi.importActual('react'),useState:()=>[false,mock.set],useEffect:(fn:any)=>{const f=fn();if(f)mock.cleanups.push(f);}}));
vi.mock('../src/sync/engine',()=>({capture:mock.capture}));
vi.mock('./diagnostics',()=>({recordDiagnostic:vi.fn()}));
import AppUpdate from './components/AppUpdate';
afterEach(()=>{mock.cleanups.splice(0).forEach(f=>f());mock.set.mockClear();vi.unstubAllGlobals();});
it('offers an update after a controller replacement and removes listeners on cleanup',async()=>{
 const service=Object.assign(new EventTarget(),{controller:{},getRegistration:async()=>({waiting:null})});vi.stubGlobal('navigator',{serviceWorker:service});vi.stubGlobal('window',new EventTarget());AppUpdate();await Promise.resolve();expect(mock.set).not.toHaveBeenCalled();service.dispatchEvent(new Event('controllerchange'));expect(mock.set).toHaveBeenCalledWith(true);mock.cleanups.splice(0).forEach(f=>f());mock.set.mockClear();service.dispatchEvent(new Event('controllerchange'));expect(mock.set).not.toHaveBeenCalled();
});
it('does not mistake a first installation for an app update',()=>{
 const service=Object.assign(new EventTarget(),{controller:null,getRegistration:async()=>undefined});vi.stubGlobal('navigator',{serviceWorker:service});vi.stubGlobal('window',new EventTarget());AppUpdate();service.dispatchEvent(new Event('controllerchange'));expect(mock.set).not.toHaveBeenCalled();
});
