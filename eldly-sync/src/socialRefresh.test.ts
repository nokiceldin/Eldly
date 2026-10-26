import {it,expect,vi,afterEach} from 'vitest';
import {socialRequest} from './social';
import {setAccountScope} from './accountScope';
afterEach(()=>{vi.unstubAllGlobals();setAccountScope('guest');});
it('shares simultaneous friend-panel reads, then allows a fresh read on the next opening',async()=>{
 setAccountScope('test');const values=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});vi.stubGlobal('window',new EventTarget());
 let resolve!:(value:unknown)=>void;const fetch=vi.fn().mockImplementation(()=>new Promise(r=>{resolve=r;}));vi.stubGlobal('fetch',fetch);
 const a=socialRequest(),b=socialRequest();expect(a).toBe(b);expect(fetch).toHaveBeenCalledTimes(1);resolve({ok:true,json:async()=>({coinPolicy:null,giftBalance:0})});await a;
 fetch.mockResolvedValue({ok:true,json:async()=>({coinPolicy:null,giftBalance:0})});await socialRequest();expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not share a pending read across accounts or publish a previous account’s response',async()=>{
 setAccountScope('first');vi.stubGlobal('window',new EventTarget());vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});let resolve!:(value:unknown)=>void;const fetch=vi.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({ok:true,json:async()=>({coinPolicy:null,giftBalance:0})});vi.stubGlobal('fetch',fetch);
 const old=socialRequest();const rejected=expect(old).rejects.toThrow('Account changed');setAccountScope('second');await socialRequest();resolve({ok:true,json:async()=>({coinPolicy:null,giftBalance:0})});await rejected;expect(fetch).toHaveBeenCalledTimes(2);
});
