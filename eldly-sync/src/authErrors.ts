export const SERVICE_RESTRICTED='Sign-in is temporarily unavailable because the cloud service has reached its usage limit. Your password has not been checked. Please try again once service is restored.';
export function authErrorMessage(error:{status?:number;code?:string;message?:string}){
 if(['invalid_username','invalid_password','username_taken','registration_rate_limit'].includes(error.code||''))return error.message||'Could not create your account. Please try again.';
 if(error.status===402||/exceed_egress_quota|service.*restricted|usage.*quota/i.test(error.message||''))return SERVICE_RESTRICTED;
 if(error.code==='invalid_credentials'||/invalid login credentials/i.test(error.message||''))return 'Incorrect username or password.';
 if(error.status===429)return 'Too many sign-in attempts. Please wait a moment and try again.';
 if(!error.status||error.status>=500)return 'Could not reach the sign-in service. Please check your connection and try again.';
 return 'Could not sign in right now. Please try again.';
}
/** A quota outage must not be mistaken for a revoked refresh token by the Auth SDK. */
export async function sessionSafeFetch(input:RequestInfo|URL,init?:RequestInit){
 const response=await fetch(input,init);
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(response.status===402&&url.pathname.endsWith('/auth/v1/token')&&url.searchParams.get('grant_type')==='refresh_token'){
  return new Response(response.body,{status:503,statusText:'Service temporarily unavailable',headers:response.headers});
 }
 return response;
}
