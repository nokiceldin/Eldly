import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Coins, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { load } from '../storage';
import { emptyMapping } from '../mapping';
import { format, schoolWeek } from '../engine';
import { formatPoints, POINT_LABELS, pointsStats } from '../points';
import { LOCAL_EVENT, REMOTE_EVENT } from '../sync/local';
export default function PointsCounter(){
 const read=()=>pointsStats(load().mapping||emptyMapping());
 const [stats,setStats]=useState(read),[open,setOpen]=useState(false),[flight,setFlight]=useState<{id:number;delta:number;x:number;y:number;dx:number;dy:number}|null>(null);
 const badge=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null),total=useRef(stats.total),origin=useRef<{x:number;y:number}|null>(null);
 const flightId=useRef(0),timeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{
  const pointer=(e:PointerEvent)=>{origin.current={x:e.clientX,y:e.clientY};};
  const keyboard=()=>{const r=document.activeElement?.getBoundingClientRect();origin.current=r?{x:r.x+r.width/2,y:r.y+r.height/2}:null;};
  const refresh=(e:Event)=>{
   const next=read(),delta=next.total-total.current;
   total.current=next.total;setStats(next);
   if(e.type!==LOCAL_EVENT||!delta)return;
   const target=badge.current?.getBoundingClientRect();if(!target)return;
   const source=origin.current||{x:target.x+target.width/2,y:target.y-65};
   setFlight({id:++flightId.current,delta,x:source.x,y:source.y,dx:target.x+target.width/2-source.x,dy:target.y+target.height/2-source.y});
   clearTimeout(timeout.current);timeout.current=setTimeout(()=>setFlight(null),950);
  };
  window.addEventListener('pointerdown',pointer,true);window.addEventListener('keydown',keyboard,true);
  for(const name of [LOCAL_EVENT,REMOTE_EVENT,'storage','focus'])window.addEventListener(name,refresh);
  const timer=setInterval(()=>refresh(new Event('refresh')),60000);
  return()=>{clearInterval(timer);clearTimeout(timeout.current);window.removeEventListener('pointerdown',pointer,true);window.removeEventListener('keydown',keyboard,true);for(const name of [LOCAL_EVENT,REMOTE_EVENT,'storage','focus'])window.removeEventListener(name,refresh);};
 },[]);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const date=(d:string)=>format(d,{month:'short',day:'numeric'});
 return <><button ref={badge} className="points-badge" onClick={()=>setOpen(true)} aria-label={`${formatPoints(stats.total)} points. View weekly points`} title="Your total points"><Coins size={16}/><span aria-live="polite" aria-atomic="true">{formatPoints(stats.total)}</span></button>
 {open&&<dialog ref={dialog} className="points-dialog" onCancel={e=>{e.preventDefault();setOpen(false);}} aria-labelledby="points-title"><header><div><span>Your Track points</span><h2 id="points-title">Your points</h2></div><button onClick={()=>setOpen(false)} aria-label="Close points"><X size={21}/></button></header><div className="points-stats"><div><small>This week</small><strong>{formatPoints(stats.current)}</strong></div><div><small>Weekly average</small><strong>{stats.average===null?'—':formatPoints(stats.average)}</strong></div><div><small>Best week</small><strong>{stats.best?formatPoints(stats.best.total):'—'}</strong>{stats.best&&<small>Week {schoolWeek(stats.best.from)} · {date(stats.best.from)}</small>}</div></div><p className="points-caption">Average and best use completed full weeks.</p><div className="points-history">{[...stats.weeks].reverse().map(w=><details key={w.from} open={w.current}><summary><span>Week {schoolWeek(w.from)}<small>{date(w.from)} – {date(w.to)} · {w.from.slice(0,4)}{w.current?' · This week':w.partial?' · Partial week':''}</small></span><strong>{formatPoints(w.total)} <small>pts</small></strong></summary><div className="points-breakdown">{Object.entries(POINT_LABELS).map(([id,label])=><div key={id}><span>{label}</span><b className={(w.breakdown[id]||0)<0?'negative':''}>{formatPoints(w.breakdown[id]||0)}</b></div>)}</div></details>)}</div></dialog>}
 {flight&&createPortal(<div key={flight.id} aria-hidden="true" className={`points-flight ${flight.delta<0?'negative':''}`} style={{left:flight.x,top:flight.y,'--dx':`${flight.dx}px`,'--dy':`${flight.dy}px`} as CSSProperties}><Coins size={18}/>{flight.delta>0?'+':''}{formatPoints(flight.delta)}</div>,document.body)}</>;
}
