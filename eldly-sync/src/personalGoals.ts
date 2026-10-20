import { add, monday,localDay } from './engine';
import { type Habit,type MappingData,mappingStart } from './mapping';
import { metricStats,type Range } from './progress';
export function personalGoalAt(habit:Habit,week:string){return [...(habit.previousGoals||[]),...(habit.goal?[habit.goal]:[])].filter(g=>g.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0];}
export function personalGoalHistory(mapping:MappingData,habit:Habit,range:Range,today=localDay()){
 let total=0,met=0;const first=monday(range.from>mappingStart(mapping)?range.from:mappingStart(mapping));
 for(let week=first;add(week,6)<today&&add(week,6)<=range.to;week=add(week,7)){
  const goal=personalGoalAt(habit,week);if(!goal||week<mappingStart(mapping))continue;
  const stats=metricStats(mapping,habit.id,{from:week,to:add(week,6)});const actual=habit.kind==='sleep'||habit.kind==='phone'?stats.average||0:stats.total;
  total++;if(goal.maximum?actual<=goal.target:actual>=goal.target)met++;
 }
 return {met,total};
}
