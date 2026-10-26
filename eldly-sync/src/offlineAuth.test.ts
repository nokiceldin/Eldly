import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import {createPrivateAuth} from './privateAuth';
let values:Map<string,string>;
const owner={id:'owner',email:'owner@accounts.eldinos.invalid',app_metadata:{username:'owner',legacy_owner:true,home_name:'Eldinos'}};
const response=(user:unknown)=>({ok:true,json:async()=>({user})});
beforeEach(()=>{values=new Map();vi.stubGlobal('BroadcastChannel',undefined);vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});});
afterEach(()=>vi.unstubAllGlobals());
it('opens the last verified device account offline without storing a password or bearer token',async()=>{
 const fetch=vi.fn().mockResolvedValue(response(owner));vi.stubGlobal('fetch',fetch);
 await createPrivateAuth().auth.getSession();
 expect([...values.values()].join('')).not.toMatch(/access_token|cookie-session|password/);
 vi.stubGlobal('navigator',{onLine:false});fetch.mockRejectedValue(new TypeError('offline'));
 const offline=createPrivateAuth();expect((await offline.auth.getSession()).data.session?.user).toEqual(owner);expect(fetch).toHaveBeenCalledTimes(1);
 vi.stubGlobal('navigator',{onLine:true});fetch.mockResolvedValue(response(null));const event=vi.fn();offline.auth.onAuthStateChange(event);
 expect((await offline.auth.getSession()).data.session).toBeNull();expect(event).toHaveBeenCalledWith('SIGNED_OUT',null);expect(values.has('myspace-verified-device-v1')).toBe(false);
});
it('never falls back to another account on a definitive unauthorized response',async()=>{
 const fetch=vi.fn().mockResolvedValue(response(owner));vi.stubGlobal('fetch',fetch);await createPrivateAuth().auth.getSession();
 fetch.mockResolvedValue({ok:false,status:401,json:async()=>({error:'Sign in again'})});
 expect((await createPrivateAuth().auth.getSession()).data.session).toBeNull();
 vi.stubGlobal('navigator',{onLine:false});expect((await createPrivateAuth().auth.getSession()).data.session).toBeNull();
});
it('keeps an offline sign-out locked after reload and revokes its cookie before reopening',async()=>{
 const fetch=vi.fn().mockResolvedValue(response(owner));vi.stubGlobal('fetch',fetch);const client=createPrivateAuth();await client.auth.getSession();
 fetch.mockRejectedValue(new TypeError('offline'));await client.auth.signOut();
 vi.stubGlobal('navigator',{onLine:false});expect((await createPrivateAuth().auth.getSession()).data.session).toBeNull();
 vi.stubGlobal('navigator',{onLine:true});fetch.mockResolvedValue(response(null));expect((await createPrivateAuth().auth.getSession()).data.session).toBeNull();expect(fetch).toHaveBeenLastCalledWith('/api/account?action=logout',expect.anything());
});
it('does not open an expired cache or replace the active account with an older in-flight verification',async()=>{
 const fetch=vi.fn().mockResolvedValue(response(owner));vi.stubGlobal('fetch',fetch);await createPrivateAuth().auth.getSession();
 const saved=JSON.parse(values.get('myspace-verified-device-v1')!);values.set('myspace-verified-device-v1',JSON.stringify({...saved,at:Date.now()-31*86400000}));
 vi.stubGlobal('navigator',{onLine:false});expect((await createPrivateAuth().auth.getSession()).data.session).toBeNull();
 vi.stubGlobal('navigator',{onLine:true});let resolve!:(v:unknown)=>void;fetch.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const client=createPrivateAuth(),pending=client.auth.getSession();
 fetch.mockResolvedValue(response({...owner,id:'friend'}));await client.auth.signInWithPassword({email:'friend',password:'test'});resolve(response(owner));await pending;
 expect((await client.auth.getSession()).data.session?.user.id).toBe('friend');
});
