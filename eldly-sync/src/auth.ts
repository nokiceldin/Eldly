import {createPrivateAuth} from './privateAuth';
import { sessionSafeFetch } from './authErrors';
import { createClient } from '@supabase/supabase-js';
const env=(import.meta as ImportMeta & {env: Record<string,string>}).env;
export const privateAccounts=(import.meta as ImportMeta & {env:Record<string,string>}).env.VITE_ACCOUNT_BACKEND==='private';
export const authClient=privateAccounts?createPrivateAuth():env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_PUBLISHABLE_KEY?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{global:{fetch:sessionSafeFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'eldinos-auth-v1'}}):null;
// Internal Auth addresses are identifiers only; only administrator-provisioned accounts have database access.
export const usernameEmail=(name:string)=>`${name.trim().toLowerCase()}@accounts.eldinos.invalid`;
