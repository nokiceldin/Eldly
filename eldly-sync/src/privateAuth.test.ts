import {afterEach,it,expect,vi} from 'vitest';
import {createPrivateAuth} from './privateAuth';
afterEach(()=>vi.unstubAllGlobals());
it('opens a cookie session once and reuses it for sync without browser password or token storage',async()=>{
 vi.stubGlobal('BroadcastChannel',undefined);
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({user:{id:'owner',app_metadata:{legacy_owner:true}}})});vi.stubGlobal('fetch',fetch);
 const client=createPrivateAuth();expect((await client.auth.getSession()).data.session?.user.id).toBe('owner');await client.auth.getSession();
 expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][1]).toMatchObject({credentials:'same-origin',cache:'no-store'});
});
it('distinguishes invalid credentials from outages and invalidates a logged-out session',async()=>{
 vi.stubGlobal('BroadcastChannel',undefined);
 const fetch=vi.fn().mockResolvedValueOnce({ok:false,status:400,json:async()=>({error:'Incorrect username or password.',code:'invalid_credentials'})}).mockResolvedValueOnce({ok:true,json:async()=>({user:{id:'friend',app_metadata:{}}})}).mockResolvedValueOnce({ok:true,json:async()=>({ok:true})});vi.stubGlobal('fetch',fetch);
 const client=createPrivateAuth(),event=vi.fn();client.auth.onAuthStateChange(event);
 expect((await client.auth.signInWithPassword({email:'friend',password:'wrong'})).error?.code).toBe('invalid_credentials');
 await client.auth.signInWithPassword({email:'friend',password:'correct'});expect((await client.auth.getSession()).data.session?.user.id).toBe('friend');
 await client.auth.signOut({scope:'local'});expect((await client.auth.getSession()).data.session).toBeNull();expect(event).toHaveBeenLastCalledWith('SIGNED_OUT',null);
});
