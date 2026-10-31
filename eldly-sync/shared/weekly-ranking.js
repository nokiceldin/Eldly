import {achievedGoals,legacyGoals} from './coin-config.js';
import {archivedForWeek,effectiveData} from './effective-goals.js';

// Return aggregate counts only; tracker names and entries never leave the server.
export function weeklyGoalSummary(data,from,today,policy=null){
 const effective=effectiveData(data,from,policy),mapping=effective.mapping;
 if(!mapping||(mapping.startedOn||'2026-10-15')>today)return {total:0,completed:0,percentage:0};
 const ids=new Set();
 if(!mapping.habits||effective.goalPlans?.some(p=>p.from<=from)){
  for(const [id,habit] of legacyGoals){
   const tracker=mapping.habits?.find(h=>h.id===habit);
   if(mapping.habits&&!tracker||tracker?.startedOn&&tracker.startedOn>today||archivedForWeek(tracker,from))continue;
   ids.add(id);
  }
 }
 for(const habit of mapping.habits||[]){
  if(habit.startedOn&&habit.startedOn>from||archivedForWeek(habit,from))continue;
  const goal=[...(habit.previousGoals||[]),...(habit.goal?[habit.goal]:[])].filter(g=>g.from<=from).sort((a,b)=>b.from.localeCompare(a.from))[0];
  if(goal&&(!goal.until||from<goal.until))ids.add(habit.id);
 }
 const completed=achievedGoals(effective,from,today).filter(id=>ids.has(id)).length,total=ids.size;
 return {total,completed,percentage:total?completed/total*100:0};
}

export function rankWeeklyGoals(participants){
 return participants.filter(p=>p.total>0).sort((a,b)=>b.percentage-a.percentage||a.username.localeCompare(b.username)||a.userId.localeCompare(b.userId)).map((p,index)=>({...p,rank:index+1}));
}
