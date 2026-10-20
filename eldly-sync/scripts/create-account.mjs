// Server-side operator tool. Never put the service key or credentials in Vite envs.
// Supply ELDINOS_SUPABASE_URL, ELDINOS_SUPABASE_ADMIN_KEY and a JSON file via stdin:
// {"username":"...","password":"..."}. No public signup or owner reassignment.
import {createClient} from '@supabase/supabase-js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {username,password}=JSON.parse(input);
if(typeof username!=='string'||!/^[-a-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||password.length<10)throw Error('Use a lowercase username and a password of at least 10 characters.');
const admin=createClient(process.env.ELDINOS_SUPABASE_URL,process.env.ELDINOS_SUPABASE_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await admin.auth.admin.createUser({email:`${username}@accounts.eldinos.invalid`,password,email_confirm:true,app_metadata:{username,legacy_owner:false}});
if(error)throw error;
const profile=await admin.from('eldinos_accounts').insert({user_id:data.user.id,username,legacy_owner:false});
if(profile.error)throw Error('Auth user was created but profile provisioning failed. Do not recreate it; complete the profile using its Auth user ID. '+profile.error.message);
console.log(`Account ${username} is ready. It starts empty; no existing data was copied.`);
