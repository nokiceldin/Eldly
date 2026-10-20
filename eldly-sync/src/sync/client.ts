import { authClient } from "../auth";
import { accountScope, isGuest } from "../accountScope";
// Authenticated RPCs derive account ownership on the server.
const env = (import.meta as ImportMeta & {env: Record<string,string>}).env;
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudNamespace = url || 'local';
export const configured = !!(url && key);
export function createPublicClient(url:string|undefined,key:string|undefined) { return {
  async rpc(name: string, args: unknown = {}): Promise<{data?: any; error?: {message:string}}> {
    if (!url || !key) return {error:{message:'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.'}};
    const scope=accountScope();
    if(isGuest()) return {error:{message:'Guest data stays on this device.'}};
    const session=scope ? (await authClient?.auth.getSession())?.data.session : null;
    if(scope && (!session || session.user.id!==scope))return {error:{message:'Please sign in again.'}};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${url}/rest/v1/rpc/${scope?name.replace('eldly_shared_','eldinos_account_'):name}`, {
        method:'POST', headers:{apikey:key, 'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},
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
