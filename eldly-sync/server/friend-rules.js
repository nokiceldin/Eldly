import {defaultRule} from './coin-config.js';
export function currentFriendConfig(raw,policy,week){
 const active=!policy?raw:week<policy.starts_on?policy.legacy:[...policy.periods].filter(p=>p.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0]?.config;
 return {...raw,habits:raw.habits.map(h=>{const approved=active?.habits.find(a=>a.id===h.id);return {...h,xp:approved?.xp||{amount:0,basis:'entry'},goal:approved?.goal,previousGoals:approved?.previousGoals};}),goalPlans:active?.goalPlans||[],coinBonusPlans:active?.coinBonusPlans||[{id:'pending',from:'1900-01-01',goal:0,record:0}]};
}
export function coinChanges(before,after){
 const changes=[];
 // Compare meaningful fields, never JSON property order or scheduling metadata.
 const condition=r=>r?`${r.comparison} ${r.minutes/60}h`:'none';
 const secondary=r=>r?`${r.amount} coins below ${r.belowMinutes/60}h`:'none';
 const goal=g=>g?`${g.maximum?'at most':'at least'} ${g.target}`:'none';
 for(const h of after.habits){
  const prior=before.habits.find(a=>a.id===h.id);if(!prior)continue;
  if(goal(prior.goal)!==goal(h.goal))changes.push(`${h.label} goal: ${goal(prior.goal)} → ${goal(h.goal)}`);
  const a=prior.xp||defaultRule(h.id),b=h.xp||defaultRule(h.id);
  if(a.amount!==b.amount)changes.push(`${h.label}: ${a.amount} coins → ${b.amount} coins`);
  if(a.basis!==b.basis){const basis=v=>v==='hour'?'hour':v==='count'?'time':'day';changes.push(`${h.label} reward basis: per ${basis(a.basis)} → per ${basis(b.basis)}`);}
  for(const [field,label,unit] of [['weeklyCap','weekly coin cap','/week'],['dailyCountCap','rewarded times','/day']]){
   if((a[field]??null)!==(b[field]??null))changes.push(`${h.label} ${label}: ${a[field]==null?'no limit':`${a[field]}${unit}`} → ${b[field]==null?'no limit':`${b[field]}${unit}`}`);
  }
  if(condition(a.threshold)!==condition(b.threshold))changes.push(`${h.label} condition: ${condition(a.threshold)} → ${condition(b.threshold)}`);
  if(secondary(a.secondary)!==secondary(b.secondary))changes.push(`${h.label} alternate reward: ${secondary(a.secondary)} → ${secondary(b.secondary)}`);
 }
 const oldTargets=before.goalPlans.at(-1)?.targets||{},newTargets=after.goalPlans.at(-1)?.targets||{};for(const [id,target] of Object.entries(newTargets))if(oldTargets[id]!==target)changes.push(`${id.replaceAll('-',' ')} goal: ${oldTargets[id]??'none'} → ${target}`);
 const a=before.coinBonusPlans.at(-1)||{goal:0,record:0},b=after.coinBonusPlans.at(-1)||{goal:0,record:0};
 if(a.goal!==b.goal)changes.push(`Coins per weekly goal: ${a.goal} → ${b.goal}`);
 if(a.record!==b.record)changes.push(`Record-week bonus: ${a.record} → ${b.record}`);
 return changes;
}
