import type {BeforeSendEvent} from '@vercel/analytics/react';
const pages:Record<string,string>={checkly:'/check',trackly:'/track',mapping:'/track',progress:'/data',packly:'/pack'};
export function analyticsPath(hash:string){return pages[hash.replace(/^#/,'').split('/')[0]]||'/';}
/** Analytics receives only public section names, never query strings or private detail paths. */
export function publicPageview(event:BeforeSendEvent):BeforeSendEvent|null{
 if(event.type!=='pageview')return null;
 try{const url=new URL(event.url);url.pathname=url.hash?analyticsPath(url.hash):['/','/check','/track','/data','/pack'].includes(url.pathname)?url.pathname:'/';url.search='';url.hash='';return {...event,url:url.toString()};}catch{return null;}
}
