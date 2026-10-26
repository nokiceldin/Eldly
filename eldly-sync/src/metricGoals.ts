import {monday,localDay,type Data} from './engine';
import {GOALS,goalPlan,goalValueLabel} from './goals';
import {getHabits} from './mapping';
import {personalGoalAt} from './personalGoals';
import {coinDataForWeek} from './coinControl';
import {humanValue,type Metric,type Range} from './progress';

/** Targets retain their daily/weekly units even when viewing a longer date range. */
export function metricGoals(data:Data,metric:Metric,range:Range,owner:boolean,today=localDay()){
 const week=monday(range.to<today?range.to:today),effective=coinDataForWeek(data,week);
 const legacy=owner?GOALS.filter(g=>g.habit===metric&&(!effective.mapping?.habits||effective.mapping.habits.some(h=>h.id===metric))):[];
 if(legacy.length){const plan=goalPlan(effective,week);return legacy.map(g=>({id:g.id,label:g.mode==='average'?'Daily goal':'Weekly goal',value:`${g.maximum?'≤':'≥'} ${goalValueLabel(g,plan?.targets[g.id]??g.target)}${g.mode==='average'?'':'/week'}`}));}
 const habit=getHabits(effective.mapping).find(h=>h.id===metric);
 const goal=habit&&personalGoalAt(habit,week);
 if(!habit||!goal)return [];
 const average=habit.kind==='sleep'||habit.kind==='phone';
 return [{id:habit.id,label:average?'Daily goal':'Weekly goal',value:`${goal.maximum?'≤':'≥'} ${humanValue(goal.target,metric,effective.mapping)}${average?'/day':'/week'}`}];
}
