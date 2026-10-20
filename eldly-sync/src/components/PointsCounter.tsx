import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { load } from '../storage';
import { emptyMapping } from '../mapping';
import { format, schoolWeek } from '../engine';
import { formatPoints, POINT_LABELS, pointsStats } from '../points';
import { playXPCollection } from '../sounds';
import { xpMotes, XP_FLIGHT_MS, XP_STAGGER_MS } from '../xpEffects';
import { LOCAL_EVENT, REMOTE_EVENT } from '../sync/local';
function XPLogo(){return <svg viewBox="0 0 36 32" className="xp-logo" aria-hidden="true"><path d="M9 2h18l8 14-8 14H9L1 16Z" fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeWidth="1.4"/><path d="m8 10 7 12m0-12L8 22M21 22V10h4a3 3 0 0 1 0 6h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
type Flight={id:number;delta:number;x:number;y:number;dx:number;dy:number;motes:number[]};
export default function PointsCounter(){
 const read=()=>pointsStats(load().mapping||emptyMapping());
 const [stats,setStats]=useState(read),[open,setOpen]=useState(false),[flights,setFlights]=useState<Flight[]>([]),[shown,setShown]=useState(stats.total),[pulse,setPulse]=useState(0);
 const badge=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null),total=useRef(stats.total),origin=useRef<{x:number;y:number}|null>(null);
 const flightId=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 useEffect(()=>{
  const pointer=(e:PointerEvent)=>{origin.current={x:e.clientX,y:e.clientY};};
  const keyboard=()=>{const r=document.activeElement?.getBoundingClientRect();origin.current=r?{x:r.x+r.width/2,y:r.y+r.height/2}:null;};
  const refresh=(e:Event)=>{
   const next=read(),delta=next.total-total.current;
   total.current=next.total;setStats(next);
   if(!delta)return;
   if(e.type!==LOCAL_EVENT){timers.current.forEach(clearTimeout);timers.current=[];setFlights([]);setShown(next.total);return;}
   const target=badge.current?.getBoundingClientRect();if(!target)return;
   const source=origin.current||{x:target.x+target.width/2,y:target.y-65};
   const id=++flightId.current,motes=xpMotes(Math.abs(delta));
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   setFlights(old=>[...old,{id,delta,x:source.x,y:source.y,dx:target.x+target.width/2-source.x,dy:target.y+target.height/2-source.y,motes}]);
   const schedule=(fn:()=>void,ms:number)=>{const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);fn();},ms);timers.current.push(timer);};
   if(reduced)setShown(n=>n+delta);
   else motes.forEach((value,i)=>schedule(()=>{setShown(n=>n+value*Math.sign(delta));setPulse(n=>n+1);},(delta<0?0:XP_FLIGHT_MS)+i*XP_STAGGER_MS));
   playXPCollection(motes.length,load().sound,reduced||delta<0?0:XP_FLIGHT_MS,XP_STAGGER_MS,delta<0);
   schedule(()=>setFlights(old=>old.filter(f=>f.id!==id)),delta<0?3000:reduced?950:XP_FLIGHT_MS+motes.length*XP_STAGGER_MS+200);
  };
  window.addEventListener('pointerdown',pointer,true);window.addEventListener('keydown',keyboard,true);
  for(const name of [LOCAL_EVENT,REMOTE_EVENT,'storage','focus'])window.addEventListener(name,refresh);
  const timer=setInterval(()=>refresh(new Event('refresh')),60000);
  return()=>{clearInterval(timer);timers.current.forEach(clearTimeout);window.removeEventListener('pointerdown',pointer,true);window.removeEventListener('keydown',keyboard,true);for(const name of [LOCAL_EVENT,REMOTE_EVENT,'storage','focus'])window.removeEventListener(name,refresh);};
 },[]);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const date=(d:string)=>format(d,{month:'short',day:'numeric'});
 return <><button ref={badge} className={`points-badge xp-badge ${flights.some(f=>f.delta<0)?"xp-badge-draining":""}`} onClick={()=>setOpen(true)} aria-label={`${formatPoints(stats.total)} XP. View weekly XP`} title="Your total XP"><XPLogo/><span className="xp-number" key={pulse}>{formatPoints(shown)}</span><span className="sr-only" aria-live="polite" aria-atomic="true">{formatPoints(stats.total)} XP</span></button>
 {open&&<dialog ref={dialog} className="points-dialog" onCancel={e=>{e.preventDefault();setOpen(false);}} aria-labelledby="points-title"><header><div><span>Track XP</span><h2 id="points-title">Your XP</h2></div><button onClick={()=>setOpen(false)} aria-label="Close XP"><X size={21}/></button></header><div className="points-stats"><div><small>This week</small><strong>{formatPoints(stats.current)}</strong></div><div><small>Weekly average</small><strong>{stats.average===null?'—':formatPoints(stats.average)}</strong></div><div><small>Best week</small><strong>{stats.best?formatPoints(stats.best.total):'—'}</strong>{stats.best&&<small>Week {schoolWeek(stats.best.from)} · {date(stats.best.from)}</small>}</div></div><p className="points-caption">Average and best use completed full weeks.</p><div className="points-history">{[...stats.weeks].reverse().map(w=><details key={w.from} open={w.current}><summary><span>Week {schoolWeek(w.from)}<small>{date(w.from)} – {date(w.to)} · {w.from.slice(0,4)}{w.current?' · This week':w.partial?' · Partial week':''}</small></span><strong>{formatPoints(w.total)} <small>XP</small></strong></summary><div className="points-breakdown">{Object.entries(POINT_LABELS).map(([id,label])=><div key={id}><span>{label}</span><b className={(w.breakdown[id]||0)<0?'negative':''}>{formatPoints(w.breakdown[id]||0)}</b></div>)}</div></details>)}</div></dialog>}
 {flights.length>0&&createPortal(<div aria-hidden="true" className="xp-effects">{flights.map(f=><div key={f.id}><div className={f.delta<0?'xp-loss':'xp-gain-label'} style={{left:f.x,top:f.y}}>{f.delta>0?'+':''}{formatPoints(f.delta)} XP</div>{!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&f.motes.map((value,i)=><span key={i} className={`xp-mote ${f.delta<0?'xp-mote-draining':''} ${value<1?'xp-mote-half':''}`} style={{left:f.delta<0?f.x+f.dx:f.x,top:f.delta<0?f.y+f.dy:f.y,'--dx':`${f.delta<0?-f.dx:f.dx}px`,'--dy':`${f.delta<0?-f.dy:f.dy}px`,'--scatter-x':`${Math.sin(i*2.4)*30}px`,'--scatter-y':`${-25-Math.cos(i*1.8)*18}px`,animationDelay:`${i*XP_STAGGER_MS}ms`,animationDuration:`${XP_FLIGHT_MS}ms`} as CSSProperties}><XPLogo/></span>)}</div>)}</div>,document.body)}</>;
}
