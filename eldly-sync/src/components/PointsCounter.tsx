import CoinIcon from './CoinIcon';
import { coinStats, coinWallet } from '../rewards';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { load } from '../storage';
import { format, schoolWeek } from '../engine';
import { formatPoints, POINT_LABELS } from '../points';
import { preloadCoinSound, playXPCollection } from '../sounds';
import { xpMotes, XP_FLIGHT_MS, XP_STAGGER_MS } from '../xpEffects';
import { LOCAL_EVENT, REMOTE_EVENT } from '../sync/local';

type Flight={id:number;delta:number;x:number;y:number;dx:number;dy:number;motes:number[];spending:boolean};
export default function PointsCounter(){
 const read=()=>{const data=load();return {...coinStats(data),...coinWallet(data)};};
 const [stats,setStats]=useState(read),[open,setOpen]=useState(false),[flights,setFlights]=useState<Flight[]>([]),[shown,setShown]=useState(stats.balance),[pulse,setPulse]=useState(0);
 const badge=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null),total=useRef(stats.balance),origin=useRef<{x:number;y:number}|null>(null);
 const earned=useRef(stats.earned);
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
   if(e.type!==LOCAL_EVENT){timers.current.forEach(clearTimeout);timers.current=[];setFlights([]);setShown(next.balance);return;}
   const target=badge.current?.getBoundingClientRect();if(!target)return;
   const source=origin.current||{x:target.x+target.width/2,y:target.y-65};
   const id=++flightId.current,motes=xpMotes(Math.abs(delta));
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   setFlights(old=>[...old,{id,delta,spending,x:source.x,y:source.y,dx:target.x+target.width/2-source.x,dy:target.y+target.height/2-source.y,motes}]);
   const schedule=(fn:()=>void,ms:number)=>{const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);fn();},ms);timers.current.push(timer);};
   if(reduced)setShown(n=>n+delta);
   else motes.forEach((value,i)=>schedule(()=>{setShown(n=>n+value*Math.sign(delta));setPulse(n=>n+1);},(delta<0?0:XP_FLIGHT_MS)+i*XP_STAGGER_MS));
   playXPCollection(motes.length,load().sound,reduced||delta<0?0:XP_FLIGHT_MS,XP_STAGGER_MS,delta<0);
   schedule(()=>setFlights(old=>old.filter(f=>f.id!==id)),reduced?950:delta<0?XP_FLIGHT_MS+Math.max(0,motes.length-1)*XP_STAGGER_MS:XP_FLIGHT_MS+motes.length*XP_STAGGER_MS+200);
  };
  window.addEventListener('pointerdown',pointer,true);window.addEventListener('keydown',keyboard,true);
  for(const name of [LOCAL_EVENT,REMOTE_EVENT,'storage','focus'])window.addEventListener(name,refresh);
  const timer=setInterval(()=>refresh(new Event('refresh')),60000);
  return()=>{clearInterval(timer);timers.current.forEach(clearTimeout);window.removeEventListener('pointerdown',pointer,true);window.removeEventListener('keydown',keyboard,true);for(const name of [LOCAL_EVENT,REMOTE_EVENT,'storage','focus'])window.removeEventListener(name,refresh);};
 },[]);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const mapping=load().mapping;
 const labels={...POINT_LABELS,...Object.fromEntries((mapping?.habits||[]).map(h=>[h.id,h.label]))};
 const date=(d:string)=>format(d,{month:'short',day:'numeric'});
 return <><button ref={badge} className={`points-badge xp-badge coin-badge ${flights.some(f=>f.delta<0&&!f.spending)?"xp-badge-draining":""}`} onClick={()=>setOpen(true)} aria-label={`${formatPoints(stats.balance)} coins. View weekly coins`} title="Your available coins"><CoinIcon className="xp-logo"/><span className="xp-number" key={pulse}>{formatPoints(shown)}</span><span className="sr-only" aria-live="polite" aria-atomic="true">{formatPoints(stats.balance)} coins</span></button>
 {open&&<dialog ref={dialog} className="points-dialog" onCancel={e=>{e.preventDefault();setOpen(false);}} aria-labelledby="points-title"><header><div><span>Track coins</span><h2 id="points-title">Your coins</h2></div><button onClick={()=>setOpen(false)} aria-label="Close coins"><X size={21}/></button></header><div className="coin-wallet-summary"><strong>{formatPoints(stats.balance)} <small>available coins</small></strong><span>{formatPoints(stats.earned)} earned · {formatPoints(stats.spent)} spent</span></div><div className="points-stats"><div><small>This week</small><strong>{formatPoints(stats.current)}</strong></div><div><small>Weekly average</small><strong>{stats.average===null?'—':formatPoints(stats.average)}</strong></div><div><small>Best week</small><strong>{stats.best?formatPoints(stats.best.total):'—'}</strong>{stats.best&&<small>Week {schoolWeek(stats.best.from)} · {date(stats.best.from)}</small>}</div></div><p className="points-caption">Average and best use completed full weeks.</p><div className="points-history">{[...stats.weeks].reverse().map(w=><details key={w.from} open={w.current}><summary><span>Week {schoolWeek(w.from)}<small>{date(w.from)} – {date(w.to)} · {w.from.slice(0,4)}{w.current?' · This week':w.partial?' · Partial week':''}</small></span><strong>{formatPoints(w.total)} <small>coins</small></strong></summary><div className="points-breakdown">{w.goalBonus>0&&<div><span>Goals achieved · {w.goalsMet.length} × 3</span><b>+{w.goalBonus}</b></div>}{w.recordBonus>0&&<div><span>New weekly record</span><b>+20</b></div>}{Object.entries(labels).filter(([id])=>mapping?.habits?.some(h=>h.id===id)||w.breakdown[id]!==undefined).map(([id,label])=><div key={id}><span>{label}</span><b className={(w.breakdown[id]||0)<0?'negative':''}>{formatPoints(w.breakdown[id]||0)}</b></div>)}</div></details>)}</div></dialog>}
 {flights.length>0&&createPortal(<div aria-hidden="true" className="xp-effects">{flights.map(f=><div key={f.id} className={f.spending?"coin-spending":""}><div className={f.delta<0?'xp-loss':'xp-gain-label'} style={{left:f.x,top:f.y}}>{f.delta>0?'+':''}{formatPoints(f.delta)} coins</div>{!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&f.motes.map((value,i)=><span key={i} className={`xp-mote ${f.delta<0?'xp-mote-draining':''} ${value<1?'xp-mote-half':''}`} style={{left:f.delta<0?f.x+f.dx:f.x,top:f.delta<0?f.y+f.dy:f.y,'--dx':`${f.delta<0?-f.dx:f.dx}px`,'--dy':`${f.delta<0?-f.dy:f.dy}px`,'--scatter-x':`${Math.sin(i*2.4)*30}px`,'--scatter-y':`${-25-Math.cos(i*1.8)*18}px`,animationDelay:`${i*XP_STAGGER_MS}ms`,animationDuration:`${XP_FLIGHT_MS}ms`} as CSSProperties}><CoinIcon className="xp-logo"/></span>)}</div>)}</div>,document.body)}</>;
}
