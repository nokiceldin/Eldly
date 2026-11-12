import {it,expect,vi,afterEach} from 'vitest';
import {setAccountScope,scopedKey} from './accountScope';
import {empty} from './engine';
import {snapshot,restore,validateSnapshot} from './sync/local';
import {flatten,inflate} from './sync/records';
import {recordDiagnostic,diagnostics} from './diagnostics';
afterEach(()=>{vi.unstubAllGlobals();setAccountScope('guest');});
it('restores Check data and discards legacy Packing in the active account',()=>{
 const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});vi.stubGlobal('window',new EventTarget());
 setAccountScope('backup-source');const original={'checkly-data-v1':{...empty(),sampleLoaded:true}};const legacy={...original,'packly-v1':{trips:[]}};
 localStorage.setItem(scopedKey('packly-v1'),'legacy');
 restore(legacy);expect(localStorage.getItem(scopedKey('packly-v1'))).toBeNull();const exported=JSON.parse(JSON.stringify(snapshot()));const recovered=inflate(flatten(exported));expect(validateSnapshot(recovered)).toBe(true);if(!validateSnapshot(recovered))throw Error('Invalid recovered backup');
 setAccountScope('recovery-exercise');restore(recovered);expect(snapshot()).toEqual(exported);
 setAccountScope('backup-source');expect(snapshot()).toEqual(exported);
 setAccountScope('unrelated');expect(snapshot()).toEqual({});
});
it('keeps diagnostic references bounded and scoped without saving error payloads',()=>{
 const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)});setAccountScope('a');for(let i=0;i<30;i++)recordDiagnostic('cloud',`ref-${i}`);expect(diagnostics()).toHaveLength(20);recordDiagnostic('app','secret with spaces');expect(diagnostics().at(-1)).not.toHaveProperty('reference');setAccountScope('b');expect(diagnostics()).toEqual([]);
});
