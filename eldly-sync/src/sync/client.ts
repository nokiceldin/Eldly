// Plain PostgREST calls: no Auth SDK, sessions, accounts, or persisted tokens.
const env = (import.meta as ImportMeta & {env: Record<string,string>}).env;
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudNamespace = url || 'local';
export const configured = !!(url && key);
export function createPublicClient(url:string|undefined,key:string|undefined) { return {
  async rpc(name: string, args: unknown = {}): Promise<{data?: any; error?: {message:string}}> {
    if (!url || !key) return {error:{message:'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.'}};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method:'POST', headers:{apikey:key, 'Content-Type':'application/json'},
        body:JSON.stringify(args), signal:controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || `Cloud request failed (${response.status}).`);
      return {data};
    } catch (error) { return {error:{message: error instanceof Error ? error.message : String(error)}}; }
    finally { clearTimeout(timeout); }
  },
}; }
export const supabase = createPublicClient(url,key);
