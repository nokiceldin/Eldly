// Date-specific rules shared by notifications, statistics and the coin ledger.
export const weekOf=day=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
export function configAt(policy,week){
 if(!policy)return null;
 if(week<policy.starts_on)return policy.legacy;
 return [...policy.periods].filter(p=>p.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0]?.config||{habits:[],goalPlans:[],coinBonusPlans:[{id:'pending',from:'1900-01-01',goal:0,record:0}]};
}
export function archivedForWeek(habit,week){return !!habit?.archiveHistory?.some(p=>p.from<=week&&week<p.until)||!!habit?.archived&&(!habit.archivedFrom||week>=weekOf(habit.archivedFrom));}
export function effectiveData(data,week,policy){
 const config=configAt(policy,week);if(!config)return data;
 const live=new Map((data.mapping?.habits||[]).map(h=>[h.id,h]));
 // Archiving stops future goals immediately; an old approval cannot keep them alive.
 const habits=config.habits.map(h=>{const raw=live.get(h.id);return raw&&(raw.archivedFrom||raw.archiveHistory)?{...h,archived:!!raw.archived,archivedFrom:raw.archivedFrom,archiveHistory:raw.archiveHistory}:h;});
 return {...data,mapping:{...(data.mapping||{version:1,entries:{}}),habits},goalPlans:config.goalPlans,coinBonusPlans:config.coinBonusPlans};
}
