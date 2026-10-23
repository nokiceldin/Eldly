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
it('registers with only username and password and immediately exposes the saved cookie session',async()=>{
 vi.stubGlobal('BroadcastChannel',undefined);
 const user={id:'new-friend',app_metadata:{username:'new_friend',legacy_owner:false}};
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({user})});vi.stubGlobal('fetch',fetch);
 const client=createPrivateAuth(),event=vi.fn();client.auth.onAuthStateChange(event);
 expect((await client.auth.signUp({email:'new_friend@accounts.eldinos.invalid',password:'my-password',avatarId:'cedar'})).error).toBeNull();
 expect(fetch).toHaveBeenCalledWith('/api/account?action=register',expect.objectContaining({method:'POST',credentials:'same-origin',body:JSON.stringify({username:'new_friend',password:'my-password',avatarId:'cedar'})}));
 expect((await client.auth.getSession()).data.session?.user).toEqual(user);
 expect(event).toHaveBeenCalledWith('SIGNED_IN',expect.objectContaining({user}));expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps registration errors visible without opening a session',async()=>{
 vi.stubGlobal('BroadcastChannel',undefined);
 const error={error:'That username is already taken. Please choose another.',code:'username_taken'};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:false,status:409,json:async()=>error}).mockResolvedValueOnce({ok:true,json:async()=>({user:null})}));
 const client=createPrivateAuth(),event=vi.fn();client.auth.onAuthStateChange(event);
 expect((await client.auth.signUp({email:'taken',password:'my-password'})).error).toMatchObject({status:409,code:'username_taken'});
 expect(event).not.toHaveBeenCalled();expect((await client.auth.getSession()).data.session).toBeNull();
});
