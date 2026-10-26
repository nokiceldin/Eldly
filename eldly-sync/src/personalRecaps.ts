import {validGoalTarget} from './trackerChanges';
import {add,monday,localDay,type Data} from './engine';
import {coinDataForWeek} from './coinControl';
import {archivedForWeek} from '../shared/effective-goals';
import {getHabits,emptyMapping,mappingStart} from './mapping';
import {personalGoalAt} from './personalGoals';
import {metricStats,humanValue,type Range} from './progress';
export function personalWeekGoals(data:Data,from:string,today=localDay()){
 const effective=coinDataForWeek(data,from),mapping=effective.mapping||emptyMapping(),to=add(from,6);
 return (mapping.habits||getHabits(mapping)).flatMap(h=>{
  const g=personalGoalAt(h,from);if(!g||archivedForWeek(h,from)||h.startedOn&&h.startedOn>to)return [];
  const stats=metricStats(mapping,h.id,{from,to:to<today?to:today}),average=h.kind==='sleep'||h.kind==='phone',actual=average?stats.average||0:stats.total;
  return [{id:h.id,label:h.label,habit:h.id,target:g.target,maximum:g.maximum,actual,met:g.maximum?actual<=g.target:actual>=g.target,eligible:from>=mappingStart(mapping)&&(!h.startedOn||from>=h.startedOn),complete:to<today,average}];
 });
}
export function personalRecommendations(data:Data,range:Range,today=localDay()){
 const effective=coinDataForWeek(data,monday(today)),mapping=effective.mapping||emptyMapping();
 return (mapping.habits||getHabits(mapping)).filter(h=>!h.archived).flatMap(h=>{
  const goal=personalGoalAt(h,monday(today));if(!goal)return [];
  const stats=metricStats(mapping,h.id,range);if(!stats.days||!Object.entries(mapping.entries).some(([d,r])=>d>=range.from&&d<=range.to&&r[h.id]))return [];
  const average=['sleep','phone'].includes(h.kind),actual=average?stats.average||0:stats.total/stats.days*7;
  if(goal.target>0&&Math.abs(actual-goal.target)/goal.target<.1)return [];
  const step=h.kind==='check'||h.kind==='prayer'?1:30;
  let proposed=Math.max(goal.maximum?0:step,Math.round((actual+goal.target)/2/step)*step);
  if(h.kind==='check')proposed=Math.min(7,proposed);
  if(proposed===goal.target)return [];
  return [{id:h.id,label:h.label,target:goal.target,proposed,value:humanValue(proposed,h.id,mapping)+(average?'/day':'/week'),current:humanValue(goal.target,h.id,mapping),maximum:goal.maximum}];
 }).slice(0,3);
}
export function schedulePersonalGoal(data:Data,id:string,target:number,today=localDay()):Data{
 const mapping=data.mapping||emptyMapping(),from=add(monday(today),7),habit=mapping.habits?.find(h=>h.id===id);
 if(!habit||!Number.isFinite(target)||target<0)throw Error('This tracker changed. Reopen its goal.');
 const goal=personalGoalAt(habit,monday(today));if(!goal)throw Error('This goal is no longer active.');
 if(!validGoalTarget(target,goal.maximum,habit.kind)||target>1000000)throw Error('Invalid goal target.');
 const history=[...(habit.previousGoals||[]).filter(g=>g.from<from),...(habit.goal&&habit.goal.from<from?[{...habit.goal,until:from}]:[])];
 return {...data,mapping:{...mapping,habits:mapping.habits!.map(h=>h.id===id?{...h,previousGoals:history,goal:{target,maximum:goal.maximum,from}}:h)}};
}
