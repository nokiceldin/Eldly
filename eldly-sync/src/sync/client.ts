import { createClient } from '@supabase/supabase-js';
const env = (import.meta as ImportMeta & {env: Record<string,string>}).env;
export const configured = !!(env.VITE_SUPABASE_URL && (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY));
export const supabase = configured ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY) : null;
