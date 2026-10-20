import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, Flame, Moon, Target, Trophy } from "lucide-react";
import { add, format, type Data } from "../engine";
import { goalHistory, goalValueLabel, weeklyGoals } from "../goals";
import { emptyMapping } from "../mapping";
import { humanValue, metricValues, type Metric } from "../progress";
import { type buildRecap } from "../recaps";
import { TRACKING_START } from "../tracking";
type Recap = ReturnType<typeof buildRecap>;
const tones: Partial<Record<Metric,string>> = {tennis:"#e8c977",sleep:"#bda8e0",reading:"#9abfd1",praying:"#d7bba1"};
export default function WeeklyRecap({data,recap,today}:{data:Data;recap:Recap;today:string}) {
 const mapping=data.mapping||emptyMapping();
 const rows=recap.metrics;
 const row=(metric:Metric)=>rows.find(r=>r.metric===metric)!;
 const tennis=row("tennis"), sleep=row("sleep"), phone=row("screen-time");
 const goals=weeklyGoals(data,recap.range.from,today);
 const eligible=goalHistory(data,recap.range,today).weeks.length>0;
 const met=goals.filter(g=>g.met).length;
 const days=Array.from({length:7},(_,i)=>add(recap.range.from,i));
 const activeDays=metricValues(mapping,"tennis",recap.range).filter(r=>r.value>0).length;
 const headline=tennis.current.total>0?`${humanValue(tennis.current.total,"tennis")} on court.`:recap.completed?`${recap.completed} things done.`:"Your week, in perspective.";
 const focus=eligible?goals.filter(g=>!g.met&&!g.maximum).sort((a,b)=>b.actual/b.target-a.actual/a.target)[0]:undefined;
 const watch=goals.filter(g=>!g.met&&(eligible||g.mode==="average")).sort((a,b)=>{const gap=(g:typeof a)=>g.maximum?(g.actual-g.target)/g.target:(g.target-g.actual)/g.target;return gap(b)-gap(a);})[0];
 const strongest=eligible?goals.filter(g=>g.met&&!g.maximum).sort((a,b)=>b.actual/b.target-a.actual/a.target)[0]:undefined;
 return <div className="weekly-story">
  <section className="week-hero">
   <span className="week-kicker"><Flame size={15}/> THE WEEK IN REVIEW</span>
   <h2>{headline}</h2>
   <div className="week-hero-bottom"><span>{tennis.current.total>0?`${activeDays} ${activeDays===1?'day':'days'} of tennis`:`${recap.days} days in view`}</span><span>{recap.completed} tasks completed</span></div>
   <div className="week-hero-lines" aria-hidden="true"><i/><i/><i/></div>
  </section>
  <section className="week-rhythm" aria-labelledby="week-rhythm-title">
   <div className="week-section-heading"><h2 id="week-rhythm-title">The rhythm of your week</h2><span>{recap.days<7?"Tracking from Oct 15":"Mon — Sun"}</span></div>
   <div className="week-rhythm-grid"><div/>{days.map(day=><span key={day} className={`week-day-label ${day<TRACKING_START?'week-before-start':''}`}>{format(day,{weekday:"narrow"})}<small>{Number(day.slice(-2))}</small></span>)}
   {(["tennis","sleep","reading","praying"] as Metric[]).map(metric=>{
    const values=metricValues(mapping,metric,recap.range); const max=Math.max(1,...values.map(v=>v.value+v.secondary));
    return <div className="week-rhythm-row" key={metric}><span>{row(metric).label}</span>{days.map(day=>{
     const value=values.find(v=>v.date===day);const amount=value?value.value+value.secondary:0;
     return <div key={day} className={`week-day-cell ${day<TRACKING_START?'week-before-start':''}`} title={`${format(day,{weekday:"long"})}: ${day<TRACKING_START?'Before tracking began':humanValue(amount,metric)}`}><i style={{height:`${amount?Math.max(16,amount/max*100):5}%`,background:tones[metric],opacity:amount?1:.17}}/><span className="sr-only">{day}: {day<TRACKING_START?'Before tracking began':humanValue(amount,metric)}</span></div>;
    })}</div>;
   })}</div>
  </section>
  <div className="week-spotlights">
   <Spotlight label="Sleep / night + naps" value={humanValue(sleep.current.average||0,"sleep")} unit="daily average" delta={sleep.previous.days?(sleep.current.average||0)-(sleep.previous.average||0):null} metric="sleep" icon={<Moon size={18}/>}/>
   <Spotlight label="Phone use" value={humanValue(phone.current.average||0,"screen-time")} unit="daily average" delta={phone.previous.days?(phone.current.average||0)-(phone.previous.average||0):null} metric="screen-time" icon={<Target size={18}/>}/>
  </div>
  <div className="week-observations"><div><span className="week-takeaway-label">A WEEKLY WIN</span><p>{recap.positives[0]||"Your baseline is taking shape."}</p></div>{watch&&<div><span className="week-takeaway-label">ONE THING TO WATCH</span><p>{watch.label}: {goalValueLabel(watch,watch.actual)}<small>{watch.maximum?"Limit":"Goal"}: {goalValueLabel(watch,watch.target)}</small></p></div>}</div>
  {eligible?<section className="week-goal-section"><div className="week-section-heading"><h2><Trophy size={18}/> Goals, at a glance</h2><span>{met} / {goals.length} met</span></div><div className="week-goal-track" aria-label={`${met} of ${goals.length} weekly goals met`}>{goals.map(g=><span key={g.id} className={g.met?'is-met':''} title={`${g.label}: ${g.met?'Met':'Not met'}`}/>)}</div>
   <div className="week-takeaways">{strongest&&<div><span className="week-takeaway-label"><Check size={14}/> A win to keep</span><strong>{strongest.label}</strong><p>{goalValueLabel(strongest,strongest.actual)} · goal {goalValueLabel(strongest,strongest.target)}</p></div>}{focus&&<div><span className="week-takeaway-label">Within reach</span><strong>{focus.label}</strong><p>{goalValueLabel(focus,focus.actual)} of {goalValueLabel(focus,focus.target)}</p></div>}{!focus&&!strongest&&<p>See the breakdown for your results against each target.</p>}</div>
   <details className="week-details"><summary>Every goal <ChevronDown size={16}/></summary><div className="week-goal-list">{goals.map(g=><div key={g.id} className={g.met?'is-met':''}><div><span>{g.label}</span><strong>{g.met?<><Check size={13}/> Met</>:"Not met"}</strong></div><div className="week-goal-meter"><i style={{width:`${Math.min(100,g.maximum?(g.actual===0?100:g.target/g.actual*100):g.actual/g.target*100)}%`}}/></div><small>{goalValueLabel(g,g.actual)} <span>/ {g.maximum?'at most ':'target '}{goalValueLabel(g,g.target)}</span></small></div>)}</div></details>
  </section>:<section className="week-first"><span className="week-takeaway-label">THE BEGINNING</span><h2>Your first chapter.</h2><p>{recap.days} days of tracking. Weekly goal results start with your first full week.</p></section>}
  <details className="week-details week-all-numbers"><summary>All activities <ChevronDown size={16}/></summary><div>{rows.map(r=>{const average=r.metric==='sleep'||r.metric==='screen-time';return <div className="week-number-row" key={r.metric}><span>{r.label}{average&&<small>Daily average</small>}</span><strong>{humanValue(average?r.current.average||0:r.current.total,r.metric)}</strong><span>{r.previous.days?`${humanValue(average?r.previous.average||0:r.previous.total,r.metric)} last week`:"—"}</span></div>;})}</div></details>
 </div>;
}
function Spotlight({label,value,unit,delta,metric,icon}:{label:string;value:string;unit:string;delta:number|null;metric:Metric;icon:React.ReactNode}) {
 const improved=delta!==null&&(metric==='screen-time'?delta<0:delta>0);
 return <section className="week-spotlight"><span className="week-spotlight-label">{icon}{label}</span><strong>{value}</strong><span className="week-unit">{unit}</span><span className={`week-delta ${improved?'is-better':''}`}>{delta===null?'First tracked week':Math.abs(delta)<.5?'Same as last week':<>{delta>0?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {humanValue(Math.abs(delta),metric)} {delta>0?'more':'less'} than last week</>}</span></section>;
}
