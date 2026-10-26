import {coinDataForWeek} from './coinControl';
import {archivedForWeek} from '../shared/effective-goals';
import { add, monday,localDay } from './engine';
import { type Habit,type MappingData,mappingStart } from './mapping';
import { metricStats,type Range } from './progress';
export function personalGoalAt(habit:Habit,week:string){
 const plan=[...(habit.previousGoals||[]),...(habit.goal?[habit.goal]:[])].reverse().filter(g=>g.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0];
 return plan&&(!('until' in plan)||!plan.until||week<plan.until)?plan:undefined;
}
export function personalGoalHistory(mapping:MappingData,habit:Habit,range:Range,today=localDay()){
 let total=0,met=0;const first=monday(range.from>mappingStart(mapping)?range.from:mappingStart(mapping));
 for(let week=first;add(week,6)<today&&add(week,6)<=range.to;week=add(week,7)){
  const effective=coinDataForWeek({mapping},week).mapping!;
  const approved=effective.habits?.find(h=>h.id===habit.id)||(!effective.habits?habit:undefined);
  const goal=approved&&personalGoalAt(approved,week);if(!goal||archivedForWeek(approved,week)||week<mappingStart(mapping))continue;
  const stats=metricStats(mapping,habit.id,{from:week,to:add(week,6)});const actual=habit.kind==='sleep'||habit.kind==='phone'?stats.average||0:stats.total;
  total++;if(goal.maximum?actual<=goal.target:actual>=goal.target)met++;
 }
 return {met,total};
}
