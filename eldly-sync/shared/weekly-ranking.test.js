import {expect,it} from 'vitest';
import {weeklyGoalSummary,rankWeeklyGoals} from './weekly-ranking.js';
const from='2026-10-19',today='2026-10-23';
const habit=(id,extra={})=>({id,kind:'check',goal:{from,target:1,maximum:false},...extra});
const data=(habits,entries={})=>({mapping:{startedOn:from,habits,entries}});
it('counts completed goals rather than partial progress: two of ten is 20%',()=>{
 const habits=Array.from({length:10},(_,i)=>habit(`goal-${i}`));
 expect(weeklyGoalSummary(data(habits,{[today]:{'goal-0':{kind:'check'},'goal-1':{kind:'check'}}}),from,today)).toEqual({total:10,completed:2,percentage:20});
});
it('keeps zero completion but excludes zero goals, sorting percentages before counts',()=>{
 const participants=[{userId:'a',username:'alice',total:10,completed:2,percentage:20},{userId:'b',username:'bob',total:0,completed:0,percentage:0},{userId:'c',username:'carol',total:2,completed:1,percentage:50},{userId:'d',username:'dave',total:3,completed:0,percentage:0}];
 expect(rankWeeklyGoals(participants).map(p=>[p.username,p.rank])).toEqual([['carol',1],['alice',2],['dave',3]]);
});
it('excludes archived, future and expired goals while using the latest effective target',()=>{
 const habits=[habit('archived',{archived:true}),habit('future',{goal:{from:'2026-10-26',target:1,maximum:false}}),habit('ended',{goal:{from,target:1,maximum:false,until:from}}),habit('changed',{previousGoals:[{from:'2026-10-12',target:1,maximum:false}],goal:{from,target:2,maximum:false}})];
 expect(weeklyGoalSummary(data(habits,{[today]:{changed:{kind:'check'}}}),from,today)).toEqual({total:1,completed:0,percentage:0});
});
it('counts upper-limit goals in the denominator without awarding early completion',()=>{
 expect(weeklyGoalSummary(data([habit('limit',{goal:{from,target:2,maximum:true}})]),from,today)).toEqual({total:1,completed:0,percentage:0});
});
it('resets the completed count when a new week begins',()=>{
 const sample=data([habit('a')],{[today]:{a:{kind:'check'}}});
 expect(weeklyGoalSummary(sample,'2026-10-26','2026-10-26')).toEqual({total:1,completed:0,percentage:0});
});
it('uses approved effective goals and does not double-count legacy goal IDs',()=>{
 const sample=data([habit('praying',{kind:'prayer'})],{[today]:{praying:{kind:'prayer',count:7}}});sample.goalPlans=[{from,targets:{praying:7}}];
 expect(weeklyGoalSummary(sample,from,today)).toEqual({total:1,completed:1,percentage:100});
});
