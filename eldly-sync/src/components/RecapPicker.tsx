import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {add,monday} from '../engine';
import {shiftPeriod} from '../progress';
import {recapFor,recapWindows,type RecapWindow} from '../recaps';
export default function RecapPicker({current,start,today,select}:{current:RecapWindow;start:string;today:string;select:(window:RecapWindow)=>void}){
 const value=current.period==='year'?current.range.from.slice(0,4):current.period==='month'?current.range.from.slice(0,7):current.range.from;
 const [draft,setDraft]=useState(value);useEffect(()=>setDraft(value),[value]);
 const valid=(w:RecapWindow)=>w.range.to<today&&w.range.to>=start;
 const previous=recapFor(current.period,shiftPeriod(current.range.from,current.period,-1)),next=recapFor(current.period,shiftPeriod(current.range.from,current.period,1));
 function commit(){const anchor=current.period==='month'?draft+'-01':current.period==='year'?draft+'-01-01':draft;if(/^\d{4}-\d{2}-\d{2}$/.test(anchor)&&Number.isFinite(Date.parse(anchor))){const w=recapFor(current.period,anchor);if(valid(w)){select(w);return;}}setDraft(value);}
 return <div className="recap-archive"><select aria-label="Recap period" value={current.period} onChange={e=>{const w=recapWindows(today).find(w=>w.period===e.target.value);if(w)select(w);}}>{recapWindows(today).filter(w=>w.range.to>=start).map(w=><option key={w.period} value={w.period}>{w.period==='week'?'Weekly':w.period==='month'?'Monthly':'Yearly'}</option>)}</select><button aria-label="Previous recap period" disabled={!valid(previous)} onClick={()=>select(previous)}><ChevronLeft size={18}/></button><input aria-label="Recap date" type={current.period==='month'?'month':current.period==='year'?'number':'date'} min={current.period==='year'?start.slice(0,4):current.period==='month'?start.slice(0,7):monday(start)} max={current.period==='year'?String(Number(today.slice(0,4))-1):current.period==='month'?recapWindows(today)[1].range.from.slice(0,7):add(monday(today),-1)} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}}}/><button aria-label="Next recap period" disabled={!valid(next)} onClick={()=>select(next)}><ChevronRight size={18}/></button></div>;
}
