import {it,expect} from 'vitest';
import {empty} from './engine';
import {bonusPlanAt,saveBonusPlan,validBonusPlans} from './coinBonuses';
import {coinHistory} from './rewards';
import {validate} from './storage';
import {flatten,inflate} from './sync/records';
it('shows existing defaults and applies editable rates to this week onward only',()=>{
 const data={...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[{id:'run',label:'Run',kind:'check' as const,color:'blue' as const,xp:{amount:5,basis:'entry' as const},goal:{target:1,maximum:false,from:'2026-10-19'}}],entries:{'2026-10-19':{run:{kind:'check' as const}},'2026-10-26':{run:{kind:'check' as const}},'2026-10-27':{run:{kind:'check' as const}}}}};
 const before=bonusPlanAt(data,'2026-10-26');expect(before).toMatchObject({goal:3,record:20});
 const saved=saveBonusPlan(data,30,200,before,'2026-10-27');expect(validate(saved)).toBe(true);
 const weeks=coinHistory(saved,'2026-11-02');expect(weeks[0]).toMatchObject({goalBonus:3,recordBonus:0,total:8});expect(weeks[1]).toMatchObject({goalBonus:30,recordBonus:200,total:240});
 expect(coinHistory(data,'2026-11-02')[1].goalBonus).toBe(3); // Another account has its own defaults.
 const restored=inflate(flatten(saved)) as typeof saved;expect(restored.coinBonusPlans).toEqual(saved.coinBonusPlans);
 expect(bonusPlanAt(saveBonusPlan(saved,0,0,{goal:30,record:200},'2026-11-03'),'2026-11-02')).toMatchObject({goal:0,record:0});
});
it('merges independent edits and refuses conflicts, invalid rates and malformed history',()=>{
 const data=empty(),before=bonusPlanAt(data);
 const remote=saveBonusPlan(data,3,100,before,'2026-10-22');
 expect(bonusPlanAt(saveBonusPlan(remote,30,20,before,'2026-10-22'),'2026-10-19')).toMatchObject({goal:30,record:100});
 expect(()=>saveBonusPlan(remote,3,50,before,'2026-10-22')).toThrow('another device');
 for(const n of [-1,NaN,Infinity,.01])expect(()=>saveBonusPlan(data,n,20,before)).toThrow('positive');
 expect(validBonusPlans([{id:'bad',from:'2026-10-20',goal:3,record:20}])).toBe(false);
});
