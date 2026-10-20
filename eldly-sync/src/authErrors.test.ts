import {afterEach,expect,it,vi} from 'vitest';
import {authErrorMessage,SERVICE_RESTRICTED,sessionSafeFetch} from './authErrors';
afterEach(()=>vi.unstubAllGlobals());
it('distinguishes quota outages from wrong passwords, rate limits and network errors',()=>{
 expect(authErrorMessage({status:402,message:'exceed_egress_quota'})).toBe(SERVICE_RESTRICTED);
 expect(authErrorMessage({status:400,code:'invalid_credentials'})).toBe('Incorrect username or password.');
 expect(authErrorMessage({status:429})).toContain('Too many');expect(authErrorMessage({status:503})).toContain('connection');
});
it('treats refresh-token quota restrictions as temporary without masking invalid tokens or password errors',async()=>{
 const response=(status:number)=>new Response(JSON.stringify({message:'restricted'}),{status,headers:{'Content-Type':'application/json'}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(402)).mockResolvedValueOnce(response(402)).mockResolvedValueOnce(response(401)));
 const refresh='https://example.supabase.co/auth/v1/token?grant_type=refresh_token';
 const temporary=await sessionSafeFetch(refresh);expect(temporary.status).toBe(503);expect(await temporary.json()).toEqual({message:'restricted'});
 expect((await sessionSafeFetch('https://example.supabase.co/auth/v1/token?grant_type=password')).status).toBe(402);
 expect((await sessionSafeFetch(refresh)).status).toBe(401);
});
