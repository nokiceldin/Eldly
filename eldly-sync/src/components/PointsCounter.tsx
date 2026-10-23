import CoinIcon from './CoinIcon';
import { coinWallet } from '../rewards';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { load } from '../storage';
import { formatPoints } from '../points';
import { preloadCoinSound, playXPCollection, stopCoinFeedback } from '../sounds';
import { coinEffect } from '../xpEffects';
import { LOCAL_EVENT, REMOTE_EVENT } from '../sync/local';
import { COIN_CONTROL_EVENT } from '../coinControl';

type Flight={id:number;delta:number;x:number;y:number;dx:number;dy:number;motes:number[];spending:boolean;flightMs:number;staggerMs:number};
export default function PointsCounter(){
 const read=()=>{const data=load();return coinWallet(data);};
 const [stats,setStats]=useState(read),[flights,setFlights]=useState<Flight[]>([]),[shown,setShown]=useState(stats.balance),[pulse,setPulse]=useState(0);
 const badge=useRef<HTMLSpanElement>(null),total=useRef(stats.balance),origin=useRef<{x:number;y:number}|null>(null);
 const earned=useRef(stats.earned);
 const shownRef=useRef(stats.balance);
 const flightId=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 useEffect(()=>{
  void preloadCoinSound();
  const pointer=(e:PointerEvent)=>{origin.current={x:e.clientX,y:e.clientY};};
  const keyboard=()=>{const r=document.activeElement?.getBoundingClientRect();origin.current=r?{x:r.x+r.width/2,y:r.y+r.height/2}:null;};
  const refresh=(e:Event)=>{
   const next=read(),delta=next.balance-total.current;
   const spending=delta<0&&next.earned===earned.current;earned.current=next.earned;
   total.current=next.balance;setStats(next);
   if(!delta)return;
   timers.current.forEach(clearTimeout);timers.current=[];setFlights([]);
   if(e.type!==LOCAL_EVENT){stopCoinFeedback();shownRef.current=next.balance;setShown(next.balance);return;}
   const target=badge.current?.getBoundingClientRect();if(!target)return;
   const source=origin.current||{x:target.x+target.width/2,y:target.y-65};
   const id=++flightId.current,{motes,flightMs,staggerMs,lifetimeMs}=coinEffect(delta),from=shownRef.current;
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   setFlights([{id,delta,spending,flightMs,staggerMs,x:source.x,y:source.y,dx:target.x+target.width/2-source.x,dy:target.y+target.height/2-source.y,motes}]);
   const schedule=(fn:()=>void,ms:number)=>{const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);fn();},ms);timers.current.push(timer);};
   if(reduced){shownRef.current=next.balance;setShown(next.balance);}
   else {let collected=0;motes.forEach((value,i)=>{collected+=value;const progress=collected/Math.abs(delta);schedule(()=>{const value=i===motes.length-1?next.balance:Math.round((from+(next.balance-from)*progress)*(Number.isInteger(from)&&Number.isInteger(next.balance)?1:10))/(Number.isInteger(from)&&Number.isInteger(next.balance)?1:10);shownRef.current=value;setShown(value);setPulse(n=>n+1);},(delta<0?0:flightMs)+i*staggerMs);});}
   playXPCollection(motes.length,load().sound,reduced||delta<0?0:flightMs,staggerMs,delta<0,spending);
   schedule(()=>setFlights(old=>old.filter(f=>f.id!==id)),reduced?350:lifetimeMs);
  };
  window.addEventListener('pointerdown',pointer,true);window.addEventListener('keydown',keyboard,true);
  for(const name of [LOCAL_EVENT,REMOTE_EVENT,COIN_CONTROL_EVENT,'storage','focus'])window.addEventListener(name,refresh);
  const timer=setInterval(()=>refresh(new Event('refresh')),60000);
  return()=>{stopCoinFeedback();clearInterval(timer);timers.current.forEach(clearTimeout);window.removeEventListener('pointerdown',pointer,true);window.removeEventListener('keydown',keyboard,true);for(const name of [LOCAL_EVENT,REMOTE_EVENT,COIN_CONTROL_EVENT,'storage','focus'])window.removeEventListener(name,refresh);};
 },[]);
 return <><span ref={badge} className={`points-badge xp-badge coin-badge ${flights.some(f=>f.delta<0&&!f.spending)?"xp-badge-draining":""}`} aria-label={`${formatPoints(stats.balance)} coins`} title="Your available coins"><CoinIcon className="xp-logo"/><span className="xp-number" key={pulse}>{formatPoints(shown)}</span><span className="sr-only" aria-live="polite" aria-atomic="true">{formatPoints(stats.balance)} coins</span></span>
 {flights.length>0&&createPortal(<div aria-hidden="true" className="xp-effects">{flights.map(f=><div key={f.id} className={f.spending?"coin-spending":""}><div className={f.delta<0?'xp-loss':'xp-gain-label'} style={{left:f.x,top:f.y}}>{f.delta>0?'+':''}{formatPoints(f.delta)} coins</div>{!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&f.motes.map((value,i)=><span key={i} className={`xp-mote ${f.delta<0?'xp-mote-draining':''} ${value<1?'xp-mote-half':''}`} style={{left:f.delta<0?f.x+f.dx:f.x,top:f.delta<0?f.y+f.dy:f.y,'--dx':`${f.delta<0?-f.dx:f.dx}px`,'--dy':`${f.delta<0?-f.dy:f.dy}px`,'--scatter-x':`${Math.sin(i*2.4)*30}px`,'--scatter-y':`${-25-Math.cos(i*1.8)*18}px`,animationDelay:`${i*f.staggerMs}ms`,animationDuration:`${f.flightMs}ms`} as CSSProperties}><CoinIcon className="xp-logo"/></span>)}</div>)}</div>,document.body)}</>;
}
