import { add, localDay, monday, type Data } from './engine';
import { getHabits, validXPRule, type Habit, type HabitColor, type XPRule } from './mapping';
import { GOALS, defaultTargets, goalPlan, initialGoalPlan } from './goals';
import { mergeTrackerChanges, validGoalTarget } from './trackerChanges';
export type GoalEdit={id:string;label:string;value:string;maximum:boolean;hours:boolean;days:boolean};
export function trackerGoals(data:Data,habit:Habit,owner:boolean,today=localDay()):GoalEdit[]{
 const legacy=owner?GOALS.filter(g=>g.habit===habit.id):[];
 if(legacy.length){const plan=goalPlan(data,monday(today));return legacy.map(g=>({id:g.id,label:g.mode==='days'?'Days per week':g.mode==='average'?'Daily average · hours':g.habit==='praying'?'Times per week':'Hours per week',value:String((plan?.targets[g.id]??g.target)/(g.mode!=='days'&&g.habit!=='praying'?60:1)),maximum:g.maximum,hours:g.mode!=='days'&&g.habit!=='praying',days:g.mode==='days'}));}
 const hours=['duration','sleep','phone'].includes(habit.kind);
 return [{id:habit.id,label:habit.kind==='check'?'Days per week':habit.kind==='prayer'?'Times per week':habit.kind==='duration'?'Hours per week':'Daily average · hours',value:habit.goal?String(habit.goal.target/(hours?60:1)):'',maximum:habit.goal?.maximum||false,hours,days:habit.kind==='check'}];
}
export function saveTrackerSettings(latest:Data,before:Habit,label:string,rule:XPRule,goals:GoalEdit[],previousGoals:GoalEdit[],owner:boolean,today=localDay(),color?:HabitColor):Data{
 if(!label.trim()||label.trim().length>80||!validXPRule(rule))throw Error('Check the tracker name, coin amount and limits.');
 const legacy=owner&&GOALS.some(g=>g.habit===before.id);
 const from=monday(today),currentHabits=latest.mapping?.habits??getHabits(latest.mapping);
 let habit:Habit={...before,label:label.trim(),color:color??before.color,xp:rule},plans=latest.goalPlans;
 const changed=goals.filter(g=>{const prior=previousGoals.find(p=>p.id===g.id);return g.value!==prior?.value||g.maximum!==prior?.maximum;});
 for(const goal of changed){if(goal.value!==''&&!validGoalTarget(Number(goal.value),goal.maximum,goal.days?'check':before.kind))throw Error('Use a positive goal, or zero for a maximum. Weekly days must be whole numbers from 0 to 7.');}
 if(legacy&&changed.length){
  const current=goalPlan(latest,from),targets={...(current?.targets||defaultTargets())};
  for(const goal of changed){const prior=previousGoals.find(p=>p.id===goal.id)!;if(goal.value==='')throw Error('Enter a target for this goal.');const actual=targets[goal.id as keyof typeof targets]/(goal.hours?60:1);if(actual!==Number(prior.value))throw Error('This goal changed on another device. Close and reopen its settings.');targets[goal.id as keyof typeof targets]=Number(goal.value)*(goal.hours?60:1);}
  plans=[...(latest.goalPlans||[initialGoalPlan(latest)]).filter(p=>p.from!==from),{id:`weekly-goals:${from}`,from,targets}];
 }else if(!legacy&&changed.length){
  const goal=goals[0],old=before.goal;
  const history=(before.previousGoals||[]).filter(g=>g.from<from);
  if(old&&old.from<from)history.push({...old,until:from});
  habit={...habit,previousGoals:history,goal:goal.value===''?undefined:{target:Number(goal.value)*(goal.hours?60:1),maximum:goal.maximum,from}};
 }
 return {...latest,...(plans?{goalPlans:plans}:{}),mapping:{...(latest.mapping||{version:1 as const,entries:{}}),habits:mergeTrackerChanges([before],[habit],currentHabits)}};
}
