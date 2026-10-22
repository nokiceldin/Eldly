export type AccountUser={id:string;email?:string;app_metadata:Record<string,any>};
type Session={user:AccountUser;access_token:string};
type AuthError={message:string;status?:number;code?:string};
export function createPrivateAuth(){
 let session:Session|null=null,known=false,pending:Promise<{data:{session:Session|null};error:AuthError|null}>|null=null;
 const listeners=new Set<(event:string,session:Session|null)=>void>();
 const broadcast=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('myspace-session-v1'):null;
 const notify=(event:string)=>listeners.forEach(fn=>fn(event,session));
 broadcast?.addEventListener('message',()=>{known=false;session=null;notify('SIGNED_OUT');});
 async function request(action:string,body?:unknown){
  const response=await fetch(`/api/account?action=${action}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const result=await response.json();
  if(!response.ok)throw {message:result.error||'Account service unavailable.',status:response.status,code:result.code};
  return result;
 }
 return {auth:{
  getSession:async()=>{
   if(known)return {data:{session},error:null};
   if(pending)return pending;
   pending=(async()=>{try{const result=await request('session');session=result.user?{user:result.user,access_token:'cookie-session'}:null;known=true;return {data:{session},error:null};}catch(e){return {data:{session:null},error:e as AuthError};}finally{pending=null;}})();
   return pending;
  },
  signInWithPassword:async(credentials:{email:string;password:string})=>{try{const result=await request('login',credentials);session={user:result.user,access_token:'cookie-session'};known=true;broadcast?.postMessage('changed');notify('SIGNED_IN');return {error:null};}catch(e){return {error:e as AuthError};}},
  signUp:async(credentials:{email:string;password:string})=>{try{const result=await request('register',{username:credentials.email.split('@')[0],password:credentials.password});session={user:result.user,access_token:'cookie-session'};known=true;broadcast?.postMessage('changed');notify('SIGNED_IN');return {error:null};}catch(e){return {error:e as AuthError};}},
  signOut:async(_options?:{scope:string})=>{try{await request('logout',{});session=null;known=true;broadcast?.postMessage('changed');notify('SIGNED_OUT');return {error:null};}catch(e){return {error:e as AuthError};}},
  onAuthStateChange:(fn:(event:string,session:Session|null)=>void)=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
 }};
}
