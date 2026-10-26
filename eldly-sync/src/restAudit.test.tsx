import {it,expect,vi,afterEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {empty,add} from './engine';
import {recapFor,buildRecap} from './recaps';
import {personalRecommendations,schedulePersonalGoal,personalWeekGoals} from './personalRecaps';
import {metricGoalTimeline} from './metricGoals';
import {activeRewards,validRewards} from './rewards';
import PersonalWeeklyStory from './components/PersonalWeeklyStory';
import {personalGoalAt} from './personalGoals';
import {setAccountScope} from './accountScope';
import {matchItems,makeConfiguredTrip} from './packly/data';
import {celebrationCoins} from '../server/celebration-coins';
const habit={id:'running',label:'Running',kind:'duration' as const,color:'blue' as const,xp:{amount:5,basis:'entry' as const},goal:{target:240,maximum:false,from:'2026-10-19'}};
const data=()=>({...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[habit],entries:{'2026-10-19':{running:{kind:'duration' as const,minutes:60}},'2026-10-20':{running:{kind:'duration' as const,minutes:60}}}}});
afterEach(()=>{setAccountScope('guest');vi.useRealTimers();});
it('rebuilds arbitrary weekly, monthly and yearly recap windows from corrected data',()=>{
 expect(recapFor('week','2026-10-25').range).toEqual({from:'2026-10-19',to:'2026-10-25'});expect(recapFor('month','2028-02-14').range.to).toBe('2028-02-29');expect(recapFor('year','2026-10-20').previous).toEqual({from:'2025-01-01',to:'2025-12-31'});
 const d=data(),w=recapFor('week','2026-10-19');expect(buildRecap(d,w,'2026-11-02').metrics[0].current.total).toBe(120);d.mapping.entries['2026-10-19'].running.minutes=180;expect(buildRecap(d,w,'2026-11-02').metrics[0].current.total).toBe(240);
});
it('renders a rich personal weekly story with arbitrary or zero trackers',()=>{
 setAccountScope('guest');vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-02T12:00:00'));
 for(const d of [data(),{...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[],entries:{}}}]){const recap=buildRecap(d,recapFor('week','2026-10-19'),'2026-11-02');const html=renderToStaticMarkup(<PersonalWeeklyStory data={d} recap={recap} today="2026-11-02"/>);expect(html).toContain('THE WEEK IN REVIEW');expect(html).not.toContain('on court');}
 expect(personalWeekGoals(data(),'2026-10-19','2026-11-02')[0]).toMatchObject({actual:120,target:240,met:false});
});
it('offers personal monthly recommendations and schedules a dated goal without changing historical targets',()=>{
 setAccountScope('guest');vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-02T12:00:00'));
 const d=data(),proposals=personalRecommendations(d,{from:'2026-10-19',to:'2026-11-01'});expect(proposals[0].proposed).toBe(150);
 const next=schedulePersonalGoal(d,'running',150,'2026-11-02'),h=next.mapping!.habits![0];expect(personalGoalAt(h,'2026-10-19')?.target).toBe(240);expect(personalGoalAt(h,'2026-11-02')?.target).toBe(240);expect(personalGoalAt(h,'2026-11-09')?.target).toBe(150);
});
it('shows goal changes including removed targets across a long range',()=>{
 setAccountScope('guest');const d=data();d.mapping.habits=[{...habit,goal:undefined,previousGoals:[{target:240,maximum:false,from:'2026-10-19',until:'2026-10-26'},{target:180,maximum:false,from:'2026-10-26',until:'2026-11-02'}]} as any];
 expect(metricGoalTimeline(d,'running',{from:'2026-10-19',to:'2026-11-08'},false,'2026-11-09').map(s=>s.value)).toEqual(['≥ 4h/week','≥ 3h/week','No goal']);
});
it('restores archived rewards and uses the explicit main reward for gift calculations',()=>{
 const d={...empty(),rewards:[{id:'one',title:'Shoes',cost:1000},{id:'two',title:'Trip',cost:3000},{id:'old',title:'Watch',cost:2000,archived:true}],mainRewardId:'two'};
 expect(activeRewards(d).map(r=>r.id)).toEqual(['two','one']);expect(celebrationCoins(d)).toBe(30);expect(validRewards(d)).toBe(true);
 const archived={...d,rewards:d.rewards.map(r=>r.id==='two'?{...r,archived:true}:r)};expect(celebrationCoins(archived)).toBe(10);
 const restored={...archived,rewards:archived.rewards.map(r=>r.id==='two'?{...r,archived:false}:r)};expect(activeRewards(restored)[0].id).toBe('two');
});
it('categorizes match keys as essentials in both languages',()=>{
 expect(matchItems.find(i=>i.id==='tennis-01')?.categoryId).toBe('travel');setAccountScope('guest');const t=makeConfiguredTrip('Match','match',{type:'match',startDate:'2026-10-26',returnDate:'2026-10-26',departure:'',destination:'',climate:'unknown',laundry:false,reminderMinutes:[]});expect(t.items.find(i=>i.name==='Keys')?.categoryId).toBe('travel');
});
it('treats phone use below a personal maximum as a win rather than a warning',()=>{
 setAccountScope('guest');const d={...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[{id:'mobile',label:'Mobile',kind:'phone' as const,color:'red' as const,goal:{target:180,maximum:true,from:'2026-10-19'}}],entries:{'2026-10-19':{mobile:{kind:'phone' as const,minutes:120}}}}};const recap=buildRecap(d,recapFor('week','2026-10-19'),'2026-10-26');expect(recap.positives.some(s=>s.startsWith('Mobile:'))).toBe(true);expect(recap.attention.some(s=>s.startsWith('Mobile:'))).toBe(false);
});
