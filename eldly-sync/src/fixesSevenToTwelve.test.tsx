import {it,expect,afterEach,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {empty} from './engine';
import {coinHistory,coinStats} from './rewards';
import {saveTrackerSettings,trackerGoals} from './trackerSettings';
import {metricStats} from './progress';
import {canTrack} from './trackingBounds';
import {personalGoalAt,personalGoalHistory} from './personalGoals';
import {metricGoals} from './metricGoals';
import PersonalGoalsPanel from './components/PersonalGoalsPanel';
import {setAccountScope} from './accountScope';
import {coinConfig} from '../shared/coin-config';
const h={id:'run',label:'Run',color:'blue' as const,kind:'check' as const,xp:{amount:5,basis:'entry' as const},goal:{target:1,maximum:false,from:'2026-10-19'}};
function data(){return {...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[h],entries:{'2026-10-19':{run:{kind:'check' as const}},'2026-10-26':{run:{kind:'check' as const}}}}};}
afterEach(()=>{vi.useRealTimers();setAccountScope(null as any);});
it('freezes earlier rates, weekly caps, and secondary conditions across repeated edits and first pairing',()=>{
 setAccountScope('guest');const d=data(),goals=trackerGoals(d,h,false,'2026-10-26');
 const edited=saveTrackerSettings(d,h,h.label,{amount:50,basis:'entry',weeklyCap:20},goals,goals,false,'2026-10-26');
 expect(coinHistory(edited,'2026-10-26',null).map(w=>w.baseTotal)).toEqual([5,20]);
 const now=edited.mapping!.habits![0];const again=saveTrackerSettings(edited,now,h.label,{amount:-100,basis:'entry'},goals,goals,false,'2026-10-27');
 expect(coinHistory(again,'2026-10-27',null).map(w=>w.baseTotal)).toEqual([5,-100]);
 const config=coinConfig(again,false);const policy={starts_on:'2026-11-02',legacy:config,periods:[]};
 expect(coinHistory(again,'2026-10-27',policy).map(w=>w.baseTotal)).toEqual([5,-100]);
});
it('compares record weeks using tracking plus goal coins, excluding the record prize itself',()=>{
 const d=data();d.mapping.habits=[{...h,goal:{target:2,maximum:false,from:'2026-10-26'},previousGoals:[{target:1,maximum:false,from:'2026-10-19',until:'2026-10-26'}]} as any];
 d.mapping.entries['2026-10-26'].run={kind:'check'};
 // Same base, fewer goal coins is not a record.
 expect(coinHistory(d,'2026-11-02',null)[1].recordBonus).toBe(0);
 const more={...d,coinBonusPlans:[{id:'a',from:'2026-10-19',goal:3,record:20},{id:'b',from:'2026-10-26',goal:10,record:20}],mapping:{...d.mapping,habits:[h]}};
 const weeks=coinHistory(more,'2026-11-02',null);expect(weeks[1]).toMatchObject({baseTotal:5,recordScore:15,recordBonus:20});
 expect(coinStats(more,'2026-11-02').best?.from).toBe('2026-10-26');
});
it('does not invent a target before creation or drop a removed target from its past week',()=>{
 setAccountScope('guest');vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-02T12:00:00'));
 const d=data(),goals=trackerGoals(d,h,false,'2026-10-26');const cleared=saveTrackerSettings(d,h,h.label,h.xp,[{...goals[0],value:''}],goals,false,'2026-10-26');const old=cleared.mapping!.habits![0];
 expect(personalGoalAt(old,'2026-10-12')).toBeUndefined();expect(personalGoalAt(old,'2026-10-19')?.target).toBe(1);expect(personalGoalAt(old,'2026-10-26')).toBeUndefined();
 expect(personalGoalHistory(cleared.mapping!,old,{from:'2026-10-19',to:'2026-11-01'},'2026-11-02')).toEqual({met:1,total:1});
 expect(metricGoals(cleared,'run',{from:'2026-10-19',to:'2026-10-25'},false,'2026-11-02')[0].value).toContain('1 day');
 expect(renderToStaticMarkup(<PersonalGoalsPanel mapping={cleared.mapping!} range={{from:'2026-10-19',to:'2026-10-25'}}/>)).toContain('Run');
});
it('counts missing days only after a new tracker begins and preserves legacy tracker starts',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-28T12:00:00'));
 const d=data().mapping;d.habits=[{...h,startedOn:'2026-10-26'} as any];
 expect(metricStats(d,'run',{from:'2026-10-19',to:'2026-10-28'})).toMatchObject({days:3,total:1,average:1/3});
 expect(canTrack(d,'run','2026-10-25','2026-10-28')).toBe(false);
 expect(canTrack(d,'run','2026-10-29','2026-10-28')).toBe(false);
 expect(canTrack(d,'run','2026-10-26','2026-10-28')).toBe(true);
 d.habits=[h];expect(metricStats(d,'run',{from:'2026-10-19',to:'2026-10-28'}).days).toBe(10);
});
