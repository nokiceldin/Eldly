import {it,expect} from 'vitest';
import {coinChanges} from './friend-rules.js';
const config=xp=>({habits:[{id:'reading',label:'Reading',xp,goal:{target:2,maximum:false,from:'2026-10-19'}}],goalPlans:[],coinBonusPlans:[{goal:3,record:20}]});
it('ignores reordered JSON properties and absent optional fields',()=>{
 const before=config({basis:'entry',amount:10,threshold:{minutes:60,comparison:'over'},secondary:{belowMinutes:30,amount:20}});
 const after=config({amount:10,basis:'entry',weeklyCap:undefined,threshold:{comparison:'over',minutes:60},secondary:{amount:20,belowMinutes:30}});
 after.habits[0].goal={from:'2026-10-26',maximum:false,target:2};
 expect(coinChanges(before,after)).toEqual([]);
});
it('lists just the changed amount and leaves unchanged limits and conditions out',()=>{
 const xp={amount:10,basis:'entry',weeklyCap:50,threshold:{comparison:'over',minutes:60}};
 expect(coinChanges(config(xp),config({...xp,amount:-100}))).toEqual(['Reading: 10 coins → -100 coins']);
});
it('reports changed limits, conditions, goals and bonuses without repeating the amount',()=>{
 const before=config({amount:10,basis:'entry',weeklyCap:50});
 const after=config({amount:10,basis:'entry',threshold:{comparison:'under',minutes:120}});
 after.habits[0].goal.target=3;after.coinBonusPlans[0].goal=5;
 expect(coinChanges(before,after)).toEqual(['Reading goal: at least 2 → at least 3','Reading weekly coin cap: 50/week → no limit','Reading condition: none → under 2h','Coins per weekly goal: 3 → 5']);
});
