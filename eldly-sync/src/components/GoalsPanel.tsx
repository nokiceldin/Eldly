import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { empty, format, localDay, monday, type Data } from "../engine";
import { goalHistory, goalValueLabel, weeklyGoals } from "../goals";
import { type MappingData } from "../mapping";
import { type Range } from "../progress";
import { load } from "../storage";
import { LOCAL_EVENT, REMOTE_EVENT } from "../sync/local";
export default function GoalsPanel({ range, mapping, expanded = false }: { range: Range; mapping: MappingData; expanded?: boolean }) {
  const [stored,setStored] = useState<Data>(() => { try { return load(); } catch { return empty(); } });
  useEffect(() => {
    const refresh=()=>{try {setStored(load());} catch { /* Save errors are handled by Data. */ }};
    window.addEventListener(LOCAL_EVENT,refresh); window.addEventListener(REMOTE_EVENT,refresh); window.addEventListener("storage",refresh);
    return ()=>{window.removeEventListener(LOCAL_EVENT,refresh);window.removeEventListener(REMOTE_EVENT,refresh);window.removeEventListener("storage",refresh);};
  },[]);
  const data={...stored,mapping}, today=localDay();
  const from=monday(range.to < today ? range.to : today);
  const results=weeklyGoals(data,from,today), history=goalHistory(data,range,today);
  const dateLabel=(date:string)=>format(date,{month:"short",day:"numeric",year:"numeric"});
  return <details className="goals-panel progress-disclosure" open={expanded}>
    <summary>Goals <ChevronDown size={18}/></summary>
    <h2>{dateLabel(from)} – {dateLabel(results[0].to)}</h2>
    <div className="goal-rows">{results.map(goal=><div key={goal.id} className={`goal-row ${goal.met?'goal-met':''}`}>
      <div><strong>{goal.label}</strong><span>{goal.maximum?'At most':'At least'} {goalValueLabel(goal,goal.target)}</span></div>
      <div><strong>{goalValueLabel(goal,goal.actual)}</strong><span>{!goal.eligible ? "Partial week" : goal.complete ? goal.met?'Met':'Not met' : goal.met ? goal.maximum?'Within limit':'Reached so far':'In progress'}</span></div>
    </div>)}</div>
    <h3>Goal history</h3>
    <p className="goal-period-label">{dateLabel(range.from)} – {dateLabel(range.to)} · completed weeks ending in this period</p>
    <div className="recap-goals">{history.summary.map(goal=><div key={goal.id}><span>{goal.label}</span><strong>{goal.met} / {goal.total}<small>weeks met</small></strong></div>)}</div>
    <details className="goal-week-history"><summary>Week by week <ChevronDown size={16}/></summary>
      {history.weeks.length ? [...history.weeks].reverse().map(week=><details key={week.from}><summary>{dateLabel(week.from)} – {dateLabel(week.to)}</summary><div className="goal-rows">{week.results.map(goal=><div className={`goal-row ${goal.met?'goal-met':''}`} key={goal.id}><div><strong>{goal.label}</strong><span>{goal.maximum?'≤':'≥'} {goalValueLabel(goal,goal.target)}</span></div><div><strong>{goalValueLabel(goal,goal.actual)}</strong><span>{goal.met?'Met':'Not met'}</span></div></div>)}</div></details>) : <p>No completed weeks yet.</p>}
    </details>
  </details>;
}
