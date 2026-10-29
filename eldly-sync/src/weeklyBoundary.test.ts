import {it,expect,vi,beforeEach,afterEach} from 'vitest';
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-02T12:00:00'));});
afterEach(()=>vi.useRealTimers());
import {empty,type Data} from './engine';
import {personalWeekGoals} from './personalRecaps';
import {weeklyGoals} from './goals';
it('keeps personal goals Monday–Sunday even when created on Thursday',()=>{
 const data:Data={...empty(),mapping:{version:1,startedOn:'2026-10-29',habits:[{id:'read',label:'Read',kind:'check',color:'blue',startedOn:'2026-10-29',goal:{from:'2026-10-26',target:2,maximum:false}}],entries:{'2026-10-29':{read:{kind:'check'}},'2026-11-01':{read:{kind:'check'}}}}};
 expect(personalWeekGoals(data,'2026-11-01','2026-11-01')[0]).toMatchObject({actual:2,met:true});
 expect(personalWeekGoals(data,'2026-11-02','2026-11-02')[0]).toMatchObject({actual:0,met:false});
 expect(personalWeekGoals(data,'2026-10-26','2026-11-02')[0]).toMatchObject({actual:2,complete:true});
});
it('resets owner progress Monday while preserving Sunday in the preceding week',()=>{
 const data:Data={...empty(),mapping:{version:1,entries:{'2026-11-01':{reading:{kind:'check'}}}}};
 expect(weeklyGoals(data,'2026-11-01','2026-11-01').find(g=>g.id==='reading')).toMatchObject({from:'2026-10-26',to:'2026-11-01',actual:1});
 expect(weeklyGoals(data,'2026-11-02','2026-11-02').find(g=>g.id==='reading')).toMatchObject({from:'2026-11-02',to:'2026-11-08',actual:0});
});
