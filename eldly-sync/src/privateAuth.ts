export type AccountUser={id:string;email?:string;app_metadata:Record<string,any>};
type Session={user:AccountUser;access_token:string};
type AuthError={message:string;status?:number;code?:string};
const CACHE='myspace-verified-device-v1',LOCK='myspace-device-signed-out-v1';
const storage={get:(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}},set:(key:string,value:string)=>{try{localStorage.setItem(key,value);}catch{}},remove:(key:string)=>{try{localStorage.removeItem(key);}catch{}}};
function cachedUser():AccountUser|null{
 try{if(storage.get(LOCK))return null;const saved=JSON.parse(storage.get(CACHE)||'null');return saved&&Date.now()-saved.at<30*86400000&&typeof saved.user?.id==='string'&&saved.user.app_metadata?saved.user:null;}catch{return null;}
}
// This cache opens only this device's existing account data. Server cookies still authorize every cloud request.
export function createPrivateAuth(){
 let session:Session|null=null,known=false,offline=false,generation=0,pending:Promise<{data:{session:Session|null};error:AuthError|null}>|null=null;
 const listeners=new Set<(event:string,session:Session|null)=>void>();
 const broadcast=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('myspace-session-v1'):null;
 const notify=(event:string)=>listeners.forEach(fn=>fn(event,session));
 broadcast?.addEventListener('message',()=>{generation++;known=false;session=null;notify('SIGNED_OUT');});
 async function request(action:string,body?:unknown){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch(`/api/account?action=${action}`,{signal:controller.signal,method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
   const result=await response.json();
   if(!response.ok)throw {message:result.error||'Account service unavailable.',status:response.status,code:result.code};
   return result;
  }finally{clearTimeout(timer);}
 }
 function remember(user:AccountUser|null){
  if(user){const clean={id:user.id,email:user.email,app_metadata:{username:user.app_metadata.username,legacy_owner:user.app_metadata.legacy_owner===true,home_name:user.app_metadata.home_name}};storage.set(CACHE,JSON.stringify({user:clean,at:Date.now()}));}
  else storage.remove(CACHE);
 }
 async function verify(){
  const epoch=generation,prior=session?.user.id;
  try{
   if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new TypeError('Offline');
   if(storage.get(LOCK)){
    // An offline sign-out must revoke the old cookie before it can open an account again.
    await request('logout',{});storage.remove(LOCK);
    if(epoch!==generation)return {data:{session:null},error:null};
    session=null;known=true;remember(null);return {data:{session},error:null};
   }
   const result=await request('session');
   if(epoch!==generation)return {data:{session:null},error:null};
   session=result.user?{user:result.user,access_token:'cookie-session'}:null;known=true;offline=false;remember(result.user||null);
   if(prior&&prior!==session?.user.id)notify('SIGNED_OUT');
   return {data:{session},error:null};
  }catch(e){
   if(epoch!==generation)return {data:{session:null},error:null};
   const error=e as AuthError;
   if(error.status===401||error.status===403){session=null;known=true;remember(null);if(prior)notify('SIGNED_OUT');return {data:{session:null},error};}
   const user=cachedUser();
   if(user){session={user,access_token:'cookie-session'};known=true;offline=true;return {data:{session},error:null};}
   return {data:{session:null},error};
  }
 }
 const auth={
  getSession:async()=>{
   if(known&&(!offline||typeof navigator!=='undefined'&&navigator.onLine===false))return {data:{session},error:null};
   if(pending)return pending;
   pending=verify().finally(()=>{pending=null;});return pending;
  },
  signInWithPassword:async(credentials:{email:string;password:string})=>{try{const result=await request('login',credentials);generation++;storage.remove(LOCK);session={user:result.user,access_token:'cookie-session'};known=true;offline=false;remember(result.user);broadcast?.postMessage('changed');notify('SIGNED_IN');return {error:null};}catch(e){return {error:e as AuthError};}},
  signUp:async(credentials:{email:string;password:string;avatarId?:string})=>{try{const result=await request('register',{username:credentials.email.split('@')[0],password:credentials.password,avatarId:credentials.avatarId});generation++;storage.remove(LOCK);session={user:result.user,access_token:'cookie-session'};known=true;offline=false;remember(result.user);broadcast?.postMessage('changed');notify('SIGNED_IN');return {error:null};}catch(e){return {error:e as AuthError};}},
  signOut:async(_options?:{scope:string})=>{
   generation++;storage.set(LOCK,'1');remember(null);session=null;known=true;offline=false;broadcast?.postMessage('changed');notify('SIGNED_OUT');
   try{await request('logout',{});storage.remove(LOCK);}catch{/* Keep the local lock until this device can revoke its cookie. */}
   return {error:null};
  },
  onAuthStateChange:(fn:(event:string,session:Session|null)=>void)=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
 };
 if(typeof window!=='undefined')window.addEventListener('online',()=>{if(offline||storage.get(LOCK)){known=false;void auth.getSession();}});
 return {auth};
}
