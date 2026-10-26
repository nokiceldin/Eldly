import {it,expect,afterEach,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {empty,syncChecklyHomework} from './engine';
import {HABITS} from './mapping';
import {coinHistory} from './rewards';
import {buildRecap,recapWindows} from './recaps';
import WeeklyRecap from './components/WeeklyRecap';
import {setAccountScope} from './accountScope';
const habit={id:'bad',label:'Limit',kind:'check' as const,color:'red' as const,xp:{amount:-5,basis:'entry' as const},goal:{target:2,maximum:true,from:'2026-10-19'}};
afterEach(()=>{setAccountScope(null as any);vi.useRealTimers();});
it('renders the owner recap safely with any original tracker hidden, including all of them',()=>{
 for(const hidden of [[],...HABITS.map(h=>[h.id]),HABITS.map(h=>h.id)]){
  const d={...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:HABITS.filter(h=>!hidden.includes(h.id)),entries:{}}};
  expect(()=>renderToStaticMarkup(<WeeklyRecap data={d} recap={buildRecap(d,recapWindows('2026-10-26')[0],'2026-10-26')} today="2026-10-26"/>)).not.toThrow();
 }
});
it('stops archived bonuses from the archive week and preserves earlier results across restoration',()=>{
 setAccountScope('guest');const d={...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[{...habit,archived:true,archivedFrom:'2026-10-26'}],entries:{}}};
 expect(coinHistory(d,'2026-11-02',null).slice(0,2).map(w=>w.goalBonus)).toEqual([3,0]);
 d.mapping.habits=[{...habit,archived:false,archiveHistory:[{from:'2026-10-26',until:'2026-11-02'}]}] as any;
 expect(coinHistory(d,'2026-11-09',null).slice(0,3).map(w=>w.goalBonus)).toEqual([3,0,3]);
});
it('does not let a stale approved policy keep a currently archived goal eligible',()=>{
 const d={...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[{...habit,archived:true,archivedFrom:'2026-10-26'}],entries:{}}};
 const config={habits:[habit],goalPlans:[],coinBonusPlans:[]},policy={starts_on:'2026-10-19',legacy:config,periods:[{from:'2026-10-19',config,reviewer:'friend'}]};
 expect(coinHistory(d,'2026-11-02',policy).slice(0,2).map(w=>w.goalBonus)).toEqual([3,0]);
});
it('keeps homework linking after owner tracker customization but never adds it to a friend account',()=>{
 const d={...empty(),mapping:{version:1 as const,habits:[...HABITS],entries:{}},tasks:[{id:'t',title:'Homework',scheduled:'2026-10-26',original:'2026-10-26',category:'',notes:'',carry:true,important:false,completed:'2026-10-26',order:0}]};
 setAccountScope('owner',true);const linked=syncChecklyHomework(d,'2026-10-26');expect(linked.mapping!.entries['2026-10-26'].homework).toMatchObject({kind:'check',source:'checkly'});
 expect(syncChecklyHomework({...linked,tasks:[{...d.tasks[0],completed:undefined}]},'2026-10-26').mapping!.entries['2026-10-26']).toBeUndefined();
 setAccountScope('friend');expect(syncChecklyHomework(d,'2026-10-26').mapping!.entries).toEqual({});
});
