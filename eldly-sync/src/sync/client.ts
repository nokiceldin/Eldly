import {recordDiagnostic} from '../diagnostics';
import { authClient, privateAccounts } from "../auth";
import { accountScope, isGuest } from "../accountScope";
// Authenticated RPCs derive account ownership on the server.
const env = (import.meta as ImportMeta & {env: Record<string,string>}).env;
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudNamespace = url || 'local';
export const configured = privateAccounts || !!(url && key);
export function createPublicClient(url:string|undefined,key:string|undefined) { return {
  async rpc(name: string, args: unknown = {}): Promise<{data?: any; error?: {message:string}}> {
    if (!privateAccounts&&(!url || !key)) return {error:{message:'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.'}};
    const scope=accountScope();
    if(isGuest()) return {error:{message:'Guest data stays on this device.'}};
    const session=scope ? (await authClient?.auth.getSession())?.data.session : null;
    if(scope && (!session || session.user.id!==scope))return {error:{message:'Please sign in again.'}};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(privateAccounts?'/api/account?action=rpc':`${url}/rest/v1/rpc/${scope?name.replace('eldly_shared_','eldinos_account_'):name}`, {
        method:'POST', credentials:'same-origin', headers:{...(!privateAccounts&&key?{apikey:key}:{}), 'Content-Type':'application/json',...(!privateAccounts&&session?{Authorization:`Bearer ${session.access_token}`}:{})},
        body:JSON.stringify(privateAccounts?{name,args}:args), signal:controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {recordDiagnostic('cloud',data.reference);throw Error(data.error || data.message || `Cloud request failed (${response.status}).`); }
      return {data:privateAccounts?data.data:data};
    } catch (error) { return {error:{message: error instanceof Error ? error.message : String(error)}}; }
    finally { clearTimeout(timeout); }
  },
}; }
export const supabase = createPublicClient(url,key);
