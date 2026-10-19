import { TRACKING_START } from "./tracking";
import { add, diff, localDay, monday, type Data } from "./engine";
import { emptyMapping, type HabitId } from "./mapping";
import { humanValue, metricStats, type Metric, type Range } from "./progress";
export const GOALS = [
  { id: "praying", label: "Praying", habit: "praying", mode: "total", target: 7, maximum: false },
  { id: "tennis-days", label: "Tennis days", habit: "tennis", mode: "days", target: 6, maximum: false },
  { id: "tennis-hours", label: "Tennis time", habit: "tennis", mode: "total", target: 900, maximum: false },
  { id: "fitness", label: "Fitness", habit: "fitness", mode: "total", target: 240, maximum: false },
  { id: "recovery", label: "Recovery", habit: "recovery", mode: "days", target: 3, maximum: false },
  { id: "sleep", label: "Sleep", habit: "sleep", mode: "average", target: 510, maximum: false },
  { id: "reading", label: "Reading", habit: "reading", mode: "days", target: 2, maximum: false },
  { id: "journaling", label: "Journaling", habit: "journaling", mode: "days", target: 1, maximum: false },
  { id: "no-phone", label: "No phone · first 15 min", habit: "no-phone", mode: "days", target: 4, maximum: false },
  { id: "homework", label: "Finish all homework", habit: "homework", mode: "days", target: 4, maximum: false },
  { id: "porn", label: "Porn", habit: "porn", mode: "days", target: 2, maximum: true },
  { id: "goyslop", label: "Goyslop", habit: "goyslop", mode: "days", target: 3, maximum: true },
  { id: "screen-time", label: "Phone use", habit: "screen-time", mode: "average", target: 240, maximum: true },
] as const satisfies readonly { id: string; label: string; habit: HabitId; mode: "total" | "days" | "average"; target: number; maximum: boolean }[];
export type Goal = typeof GOALS[number];
export type GoalId = Goal["id"];
export interface WeeklyGoalPlan { id: string; from: string; targets: Record<GoalId, number> }
export const defaultTargets = () => Object.fromEntries(GOALS.map(g => [g.id, g.target])) as Record<GoalId, number>;
export function initialGoalPlan(data: Data, today = localDay()): WeeklyGoalPlan {
  const from = monday(TRACKING_START) === TRACKING_START ? TRACKING_START : add(monday(TRACKING_START), 7);
  return { id: "weekly-goals-v1", from, targets: defaultTargets() };
}
export function goalPlan(data: Data, week: string) {
  return [...(data.goalPlans || [initialGoalPlan(data)])].filter(p => p.from <= week).sort((a,b) => b.from.localeCompare(a.from))[0];
}
export function goalValueLabel(goal: Pick<Goal, "mode" | "habit">, value: number) {
  if (goal.mode === "days") return `${value} ${value === 1 ? "day" : "days"}`;
  if (goal.habit === "praying") return `${value} prayers`;
  return `${humanValue(value, goal.habit as Metric)}${goal.mode === "average" ? "/day" : ""}`;
}
export function weeklyGoals(data: Data, start: string, today = localDay()) {
  const from = monday(start), to = add(from, 6), plan = goalPlan(data, from);
  const mapping = data.mapping || emptyMapping();
  return GOALS.map(goal => {
    const target = plan?.targets[goal.id] ?? goal.target;
    const stats = goal.mode === "days" ? null : metricStats(mapping, goal.habit as Metric, { from, to });
    const actual = goal.mode === "days" ? Object.entries(mapping.entries).filter(([date,row]) => {
      const entry=row[goal.habit];
      return date >= from && date <= to && date <= today && !!entry && (entry.kind !== "duration" || entry.minutes > 0);
    }).length : goal.mode === "average" ? stats?.average ?? 0 : stats?.total ?? 0;
    const met = goal.maximum ? actual <= target : actual >= target;
    return { ...goal, actual, target, met, eligible: !!plan, complete: to < today, from, to };
  });
}
export function goalHistory(data: Data, range: Range, today = localDay()) {
  const first = [...(data.goalPlans || [initialGoalPlan(data, today)])].sort((a,b) => a.from.localeCompare(b.from))[0]?.from;
  const weeks: { from: string; to: string; results: ReturnType<typeof weeklyGoals> }[] = [];
  if (first && range.from <= range.to) {
    const start = monday(range.from) > first ? monday(range.from) : first;
    for (let from=start; add(from,6) <= range.to && add(from,6) < today; from=add(from,7)) {
      const to=add(from,6);
      if(to >= range.from) weeks.push({ from,to,results:weeklyGoals(data,from,today) });
    }
  }
  const summary = GOALS.filter(goal=>goal.id!=="tennis-hours").map(goal=>({
    id:goal.id==="tennis-days"?"tennis":goal.id,
    label:goal.id==="tennis-days"?"Tennis · both targets":goal.label,
    met:weeks.filter(week=>goal.id==="tennis-days"?week.results.filter(result=>result.habit==="tennis").every(result=>result.met):week.results.find(result=>result.id===goal.id)?.met).length,
    total:weeks.length,
  }));
  return {weeks,summary};
}

export function goalRecommendations(data: Data, range: Range) {
  const mapping=data.mapping||emptyMapping();
  const days=metricStats(mapping,"sleep",range).days;
  if(!days)return [];
  const plan=goalPlan(data,monday(range.to));
  return GOALS.flatMap(goal=>{
    const recorded=Object.entries(mapping.entries).filter(([date,row])=>date>=range.from&&date>=TRACKING_START&&date<=range.to&&!!row[goal.habit]);
    if(!recorded.length)return [];
    const target=plan?.targets[goal.id]??goal.target;
    const actual=goal.mode==='days'?recorded.length/days*7:goal.mode==='average'?metricStats(mapping,goal.habit as Metric,range).average||0:metricStats(mapping,goal.habit as Metric,range).total/days*7;
    if(!target||Math.abs(actual-target)/target<.1)return [];
    const step=goal.mode==='days'?1:goal.habit==='praying'?.5:goal.habit==='sleep'?30:60;
    let proposed=Math.round((actual+target)/2/step)*step;
    if(goal.mode==='days')proposed=Math.max(goal.maximum?0:1,Math.min(7,proposed));
    if(goal.habit==='sleep')proposed=Math.max(480,proposed);
    if(proposed===target||proposed<=0)return [];
    return [{...goal,target,actual,proposed,reason:goal.maximum?(actual<target?'Consistently below your limit':'Try an intermediate limit'):(actual>target?'You exceeded your target':'Try an intermediate target'),gap:Math.abs(actual-target)/target}];
  }).sort((a,b)=>b.gap-a.gap).slice(0,3);
}
export function applyGoalRecommendation(data: Data, id: GoalId, target: number, today=localDay()): Data {
  if(!Number.isFinite(target)||target<0)throw Error("Invalid goal target.");
  const from=add(monday(today),7);
  const existing=data.goalPlans||[initialGoalPlan(data,today)];
  const targets={...(goalPlan({...data,goalPlans:existing},from)?.targets||defaultTargets()),[id]:target};
  return {...data,goalPlans:[...existing.filter(p=>p.from!==from),{id:`weekly-goals:${from}`,from,targets}]};
}
