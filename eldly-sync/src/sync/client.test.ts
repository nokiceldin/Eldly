import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();});
it('uses only the public API key and never creates or sends an Auth session',async()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://public-example.supabase.co');vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','sb_publishable_test');
 const fetch=vi.fn(async()=>({ok:true,json:async()=>({initialized:true,revision:1,records:[]})}));vi.stubGlobal('fetch',fetch);
 const {createPublicClient}=await import('./client');const supabase=createPublicClient('https://public-example.supabase.co','sb_publishable_test');await supabase.rpc('eldly_shared_pull',{after_revision:0});
 expect(fetch).toHaveBeenCalledOnce();const [url,options]=fetch.mock.calls[0] as unknown as [string,RequestInit];
 expect(url).toBe('https://public-example.supabase.co/rest/v1/rpc/eldly_shared_pull');expect(options.headers).toEqual({apikey:'sb_publishable_test','Content-Type':'application/json'});
});
it('returns HTTP errors instead of claiming a save succeeded',async()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://public-example.supabase.co');vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','sb_publishable_test');vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({message:'Run the migration'})})));
 const {createPublicClient}=await import('./client');const supabase=createPublicClient('https://public-example.supabase.co','sb_publishable_test');expect((await supabase.rpc('eldly_shared_apply',{})).error?.message).toBe('Run the migration');
});
