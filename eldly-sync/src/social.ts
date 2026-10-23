import type {AvatarStyle} from '../shared/avatar-options';
import {cacheCoinPolicy,type CoinConfig,type CoinPolicy} from './coinControl';
import {accountScope,scopeEpoch} from './accountScope';
export type Friend={id:string;userId:string;username:string;avatar:AvatarStyle;status:'pending'|'accepted';incoming:boolean;streak:number};
export type Proposal={id:string;ownerId:string;ownerUsername:string;incoming:boolean;config:CoinConfig;status:string;reviewedConfig:CoinConfig|null;effectiveFrom:string|null;createdAt:string};
export type SocialNotification={id:string;kind:'goal'|'streak'|'celebration';username:string;avatar:AvatarStyle;milestone:number|null;celebrated:boolean;read:boolean;createdAt:string};
export type SocialState={profile:{id:string;username:string;avatarId:string;avatar:AvatarStyle;streak:number;longest:number;timezone:string|null};friends:Friend[];bestRequests:{id:string;username:string;incoming:boolean}[];bestFriend:{id:string;userId:string;username:string;startsOn:string}|null;proposals:Proposal[];notifications:SocialNotification[];coinPolicy:CoinPolicy|null};
export const SOCIAL_EVENT='myspace-social-updated';
export async function socialRequest(body?:Record<string,unknown>):Promise<SocialState>{
 const scope=accountScope(),epoch=scopeEpoch();
 if(!scope||scope==='guest')throw Error('Sign in to use friends.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('/api/account?action=social',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Friends are temporarily unavailable.');
  if(epoch!==scopeEpoch()||scope!==accountScope())throw Error('Account changed. Please reopen your profile.');
  cacheCoinPolicy(data.coinPolicy);
  window.dispatchEvent(new CustomEvent(SOCIAL_EVENT,{detail:data}));return data;
 }finally{clearTimeout(timer);}
}
