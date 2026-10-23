// Only these rule fields are shared. Logs, notes, tasks and balances never enter a proposal.
export const defaults=[['tennis','Tennis','duration',5,30],['fitness','Fitness','duration',5,20],['recovery','Recovery','check',2,8],['praying','Praying','prayer',1.5],['sleep','Sleep','sleep',5],['reading','Reading','check',3],['journaling','Journaling','check',3],['no-phone','No phone · first 15 min','check',2],['homework','Finish all homework','check',4],['coaching','Coaching','check',1],['porn','Porn','check',-8],['goyslop','Goyslop','check',-4],['screen-time','Phone use','phone',1]];
export const legacyGoals=[['praying','praying','total',7,false],['tennis-days','tennis','days',6,false],['tennis-hours','tennis','total',900,false],['fitness','fitness','total',240,false],['recovery','recovery','days',3,false],['sleep','sleep','average',510,false],['reading','reading','days',2,false],['journaling','journaling','days',1,false],['no-phone','no-phone','days',4,false],['homework','homework','days',4,false],['porn','porn','days',2,true],['goyslop','goyslop','days',3,true],['screen-time','screen-time','average',240,true]];
export function defaultRule(id){
 if(id==='praying')return {amount:1.5,basis:'count',dailyCountCap:5};
 if(id==='sleep')return {amount:5,basis:'entry',threshold:{comparison:'over',minutes:480}};
 if(id==='screen-time')return {amount:1,basis:'entry',threshold:{comparison:'under',minutes:180},secondary:{belowMinutes:120,amount:2}};
 const d=defaults.find(d=>d[0]===id);return {amount:d?.[3]||0,basis:'entry',...(d?.[4]===undefined?{}:{weeklyCap:d[4]})};
}
const number=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function cleanRule(r){
 if(!r||!number(r.amount,-1000,1000)||Math.abs(r.amount*10-Math.round(r.amount*10))>1e-6||!['entry','count','hour'].includes(r.basis))throw Error('Check the coin amount and basis.');
 const result={amount:r.amount,basis:r.basis};
 for(const [key,max] of [['weeklyCap',100000],['dailyCountCap',1000]])if(r[key]!==undefined){if(!number(r[key],0,max)||key==='dailyCountCap'&&(!Number.isInteger(r[key])||r[key]<1))throw Error('Check the coin limits.');result[key]=r[key];}
 if(r.threshold){if(!['over','under'].includes(r.threshold.comparison)||!number(r.threshold.minutes,0,1440))throw Error('Invalid time condition.');result.threshold={comparison:r.threshold.comparison,minutes:r.threshold.minutes};}
 if(r.secondary){if(!number(r.secondary.belowMinutes,0,1440)||!number(r.secondary.amount,-1000,1000))throw Error('Invalid secondary reward.');result.secondary={belowMinutes:r.secondary.belowMinutes,amount:r.secondary.amount};}
 return result;
}
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s));
function goal(g){if(!g)return undefined;if(!number(g.target,0,1000000)||typeof g.maximum!=='boolean'||!date(g.from))throw Error('Invalid goal.');return {target:g.target,maximum:g.maximum,from:g.from,...(date(g.until)?{until:g.until}:{})};}
export function coinConfig(data={},owner=false){
 const habits=data.mapping?.habits??defaults.map(([id,label,kind])=>({id,label,kind,color:'blue'}));
 if(!Array.isArray(habits)||habits.length>100)throw Error('Too many trackers.');
 const clean=habits.map(h=>{
  if(typeof h.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(h.id)||typeof h.label!=='string'||!h.label.trim()||h.label.length>80||!['check','duration','prayer','sleep','phone'].includes(h.kind))throw Error('Invalid tracker.');
  return {id:h.id,label:h.label,kind:h.kind,color:'blue',xp:cleanRule(h.xp||defaultRule(h.id)),...(h.archived?{archived:true}:{}),...(h.goal?{goal:goal(h.goal)}:{}),...(h.previousGoals?{previousGoals:h.previousGoals.slice(-200).map(goal)}:{})};
 });
 if(new Set(clean.map(h=>h.id)).size!==clean.length)throw Error('Duplicate tracker.');
 const plans=owner?(data.goalPlans||[{id:'original',from:'2026-10-19',targets:Object.fromEntries(legacyGoals.map(g=>[g[0],g[3]]))}]):[];
 const goalPlans=plans.slice(-200).map(p=>({id:String(p.id).slice(0,100),from:p.from,targets:Object.fromEntries(legacyGoals.map(g=>{const n=p.targets[g[0]];if(!number(n,0,1000000)||!date(p.from))throw Error('Invalid goal plan.');return [g[0],n];}))}));
 const coinBonusPlans=(data.coinBonusPlans||[{id:'original',from:'1900-01-01',goal:3,record:20}]).slice(-200).map(p=>{
  if(!number(p.goal,0,1000000)||!number(p.record,0,1000000)||!date(p.from))throw Error('Invalid bonuses.');
  return {id:String(p.id).slice(0,100),from:p.from,goal:p.goal,record:p.record};
 });
 return {habits:clean,goalPlans,coinBonusPlans};
}
export function reviewConfig(config,body){
 const adjustments=body.adjustments||{};
 const habits=config.habits.map(h=>({...h,xp:cleanRule({...h.xp,...(adjustments[h.id]||{}),...(adjustments[h.id]?.weeklyCap===null?{weeklyCap:undefined}:{})})}));
 const bonus=body.bonuses;
 if(bonus&&(!number(bonus.goal,0,1000000)||!number(bonus.record,0,1000000)))throw Error('Invalid bonuses.');
 return {...config,habits,...(bonus?{coinBonusPlans:[{id:'reviewed',from:'1900-01-01',goal:bonus.goal,record:bonus.record}]}:{})};
}
export function inflateRecords(rows){
 const nodes=new Map(rows.filter(r=>!r.deleted).map(r=>[r.record_key,r.value])),children=new Map();
 for(const key of nodes.keys()){const p=JSON.parse(key);if(!p.length)continue;const parent=JSON.stringify(p.slice(0,-1));children.set(parent,[...(children.get(parent)||[]),p.at(-1)]);}
 function read(p){const key=JSON.stringify(p),n=nodes.get(key);if(!n)return undefined;if(n.node==='value')return n.value;const keys=children.get(key)||[];if(n.node==='list')return [...new Set([...(n.order||[]),...keys])].map(id=>read([...p,id])).filter(v=>v!==undefined);return Object.fromEntries(keys.map(k=>[k,read([...p,k])]).filter(([,v])=>v!==undefined));}return read([])||{};
}
export function achievedGoals(data,from,to,closed=false){
 const mapping=data.mapping;if(!mapping)return [];
 const entries=Object.entries(mapping.entries||{}).filter(([d])=>d>=from&&d<=to);
 const results=[];
 if(!mapping.habits||data.goalPlans?.length){
  const plan=[...(data.goalPlans||[])].filter(p=>p.from<=from).sort((a,b)=>b.from.localeCompare(a.from))[0];
  for(const [id,habit,mode,target,maximum] of legacyGoals){if(maximum&&!closed)continue;const sum=entries.reduce((n,[,row])=>{const e=row[habit];return n+(!e?0:mode==='days'?1:e.kind==='prayer'?e.count:e.kind==='sleep'?e.nightMinutes+e.dayMinutes:e.minutes||0);},0);const actual=mode==='average'?sum/7:sum;if(maximum?actual<=(plan?.targets[id]??target):actual>=(plan?.targets[id]??target))results.push(id);}
 }
 for(const h of mapping.habits||[]){const g=[...(h.previousGoals||[]),...(h.goal?[h.goal]:[])].filter(g=>g.from<=from&&(!g.until||from<g.until)).sort((a,b)=>b.from.localeCompare(a.from))[0];if(h.archived||!g||g.maximum&&!closed)continue;const sum=entries.reduce((n,[,r])=>{const e=r[h.id];return n+(!e?0:e.kind==='check'?1:e.kind==='prayer'?e.count:e.kind==='sleep'?e.nightMinutes+e.dayMinutes:e.minutes||0);},0);const actual=['sleep','phone'].includes(h.kind)?sum/7:sum;if(g.maximum?actual<=g.target:actual>=g.target)results.push(h.id);}
 return [...new Set(results)];
}
