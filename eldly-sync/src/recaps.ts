import {coinDataForWeek} from './coinControl';
import { personalGoalAt } from "./personalGoals";
import { goalPlan } from "./goals";
import { TRACKING_START } from "./tracking";
import { add, allTasks, diff, localDay, monday, parse, type Data } from "./engine";
import { emptyMapping, HABITS, getHabits, mappingStart } from "./mapping";
import { humanValue, METRICS, getMetrics, metricLabel, metricStats, type Range } from "./progress";
export type RecapPeriod = "week" | "month" | "year";
export interface RecapWindow { id: string; period: RecapPeriod; range: Range; previous: Range }
export function recapWindows(today = localDay()): RecapWindow[] {
  const d = parse(today), year = d.getFullYear(), month = d.getMonth();
  const weekEnd = add(monday(today), -1);
  const monthStart = localDay(new Date(year, month - 1, 1, 12));
  const windows: Omit<RecapWindow, "id">[] = [
    { period: "week", range: { from: add(weekEnd, -6), to: weekEnd }, previous: { from: add(weekEnd, -13), to: add(weekEnd, -7) } },
    { period: "month", range: { from: monthStart, to: add(localDay(new Date(year, month, 1, 12)), -1) }, previous: { from: localDay(new Date(year, month - 2, 1, 12)), to: add(monthStart, -1) } },
    { period: "year", range: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }, previous: { from: `${year - 2}-01-01`, to: `${year - 2}-12-31` } },
  ];
  return windows.map(w => ({ ...w, id: `${w.period}:${w.range.from}` }));
}
export function pendingRecaps(data: Data, today = localDay(), hour = new Date().getHours()) {
  const dates = [...Object.keys(data.mapping?.entries || {}), ...data.tasks.map(t => t.scheduled), ...data.routines.map(r => r.start)].sort();
  const first = dates[0] || data.mapping?.startedOn;
  return recapWindows(today).filter(w => (w.period!=="week"||today!==add(w.range.to,1)||hour>=18) && !data.recapSeen?.[w.id] && first && w.range.to >= mappingStart(data.mapping||emptyMapping()));
}
export function buildRecap(data: Data, window: RecapWindow, today = localDay()) {
  const from = window.range.from < mappingStart(data.mapping||emptyMapping()) ? mappingStart(data.mapping||emptyMapping()) : window.range.from;
  const mapping = data.mapping || emptyMapping();
  const metrics = getMetrics(mapping).map(metric => ({ metric, label: metricLabel(metric,mapping), current: metricStats(mapping, metric, window.range), previous: metricStats(mapping, metric, window.previous) }));
  const tasks = allTasks(data, window.range.to, today).filter(t => !t.deleted && ((t.scheduled >= from && t.scheduled <= window.range.to) || (t.completed && t.completed >= from && t.completed <= window.range.to)));
  const completed = tasks.filter(t => t.completed && t.completed >= from && t.completed <= window.range.to).length;
  const positives: string[] = [], attention: string[] = [];
  for (const row of metrics) {
    const { metric, current, previous, label } = row;
    const effective=coinDataForWeek(data,monday(window.range.to));
    const habit=getHabits(effective.mapping).find(h=>h.id===metric);
    const average=habit?.kind==='sleep'||habit?.kind==='phone';
    const value=average?current.average||0:current.total;
    const old=average?previous.average||0:previous.total;
    const red=habit?.color==='red'||!!habit?.goal?.maximum;
    const lower=red||habit?.kind==='phone';
    const recorded=Object.entries(mapping.entries).some(([day,entries])=>day>=from&&day<=window.range.to&&!!entries[metric]);
    const suffix=average?' daily average':metric==='praying'?' prayers':'';
    const approvedHabit=habit;
    const personalTarget=approvedHabit?personalGoalAt(approvedHabit,monday(window.range.to)):undefined;
    const ownerTarget=goalPlan(effective,monday(window.range.to))?.targets;
    const target=personalTarget?.target??((!mapping.habits||data.goalPlans?.length)?(metric==='sleep'?ownerTarget?.sleep??510:metric==='screen-time'?ownerTarget?.['screen-time']??240:undefined):undefined);
    if(recorded){
      if(lower){if(target!==undefined){(value<=target?positives:attention).push(`${label}: ${humanValue(value,metric,mapping)}${suffix}`);}else if(red&&value>0)attention.push(`${label}: ${humanValue(value,metric,mapping)}${suffix}`);}
      else if(value>0&&(!average||target===undefined||value>=target))positives.push(`${label}: ${humanValue(value,metric,mapping)}${suffix}`);
    }
    // Compare daily averages across unequal periods; only compare totals when
    // both periods contain the same number of elapsed tracking days.
    if(previous.days>0&&(average||previous.days===current.days)){
      const delta=value-old;
      const units=average?' per day':metric==='praying'?' prayers':'';
      if(delta<0)(lower?positives:attention).push(`${label} down ${humanValue(-delta,metric,mapping)}${units}`);
      if(delta>0)(lower?attention:positives).push(`${label} up ${humanValue(delta,metric,mapping)}${units}`);
    }
  }
  if (completed) positives.unshift(`${completed} ${completed === 1 ? "task" : "tasks"} completed`);
  return { ...window, metrics, positives, attention, completed, totalTasks: tasks.length, days: Math.max(0, diff(window.range.to, from) + 1) };
}

/** Rebuild a historical recap from current records, including late corrections. */
export function recapFor(period:RecapPeriod,anchor:string):RecapWindow{
 const d=parse(anchor),year=d.getFullYear(),month=d.getMonth();
 const from=period==='week'?monday(anchor):period==='month'?localDay(new Date(year,month,1,12)):`${year}-01-01`;
 const to=period==='week'?add(from,6):period==='month'?localDay(new Date(year,month+1,0,12)):`${year}-12-31`;
 const previousFrom=period==='week'?add(from,-7):period==='month'?localDay(new Date(year,month-1,1,12)):`${year-1}-01-01`;
 return {id:`${period}:${from}`,period,range:{from,to},previous:{from:previousFrom,to:add(from,-1)}};
}
