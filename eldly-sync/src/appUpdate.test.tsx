import {it,expect,vi,afterEach} from 'vitest';
const mock=vi.hoisted(()=>({set:vi.fn(),cleanups:[] as (()=>void)[],capture:vi.fn()}));
vi.mock('react',async()=>({...await vi.importActual('react'),useState:()=>[false,mock.set],useEffect:(fn:any)=>{const f=fn();if(f)mock.cleanups.push(f);}}));
vi.mock('../src/sync/engine',()=>({capture:mock.capture}));
vi.mock('./diagnostics',()=>({recordDiagnostic:vi.fn()}));
import AppUpdate from './components/AppUpdate';
afterEach(()=>{mock.cleanups.splice(0).forEach(f=>f());mock.set.mockClear();vi.unstubAllGlobals();});
it('offers an update after a controller replacement and removes listeners on cleanup',async()=>{
 const service=Object.assign(new EventTarget(),{controller:{postMessage:(_m:any,ports:any[])=>ports[0].postMessage({asset:'/assets/new.js'})},getRegistration:async()=>({waiting:null})});vi.stubGlobal('navigator',{serviceWorker:service});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',{querySelector:()=>({getAttribute:()=>'/assets/old.js'})});AppUpdate();await Promise.resolve();expect(mock.set).not.toHaveBeenCalled();service.dispatchEvent(new Event('controllerchange'));await vi.waitFor(()=>expect(mock.set).toHaveBeenCalledWith(true));mock.cleanups.splice(0).forEach(f=>f());mock.set.mockClear();service.dispatchEvent(new Event('controllerchange'));expect(mock.set).not.toHaveBeenCalled();
});
it('does not mistake a first installation for an app update',()=>{
 const service=Object.assign(new EventTarget(),{controller:null,getRegistration:async()=>undefined});vi.stubGlobal('navigator',{serviceWorker:service});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',{querySelector:()=>({getAttribute:()=>'/assets/old.js'})});AppUpdate();service.dispatchEvent(new Event('controllerchange'));expect(mock.set).not.toHaveBeenCalled();
});

it('does not offer a reload when this tab already loaded the worker’s newest bundle',async()=>{
 const {hasNewShell}=await import('./shellUpdate');const worker={postMessage:(_m:any,ports:any[])=>ports[0].postMessage({asset:'/assets/current.js'})} as unknown as ServiceWorker;expect(await hasNewShell(worker,'/assets/current.js')).toBe(false);expect(await hasNewShell(worker,'/assets/old.js')).toBe(true);
});
