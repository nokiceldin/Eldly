import {it,expect} from 'vitest';
import {empty} from './engine';
import {metricGoals} from './metricGoals';
const range={from:'2026-10-19',to:'2026-10-25'};
it('shows owner sleep and both tennis targets with their original weekly/daily units',()=>{
 expect(metricGoals(empty(),'sleep',range,true,'2026-10-26')[0].value).toBe('≥ 8h 30m/day');
 expect(metricGoals(empty(),'tennis',range,true,'2026-10-26').map(g=>g.value)).toEqual(['≥ 6 days/week','≥ 15h/week']);
});
it('uses the historical target and distinguishes maximum goals',()=>{
 const d={...empty(),mapping:{version:1 as const,habits:[{id:'sleep',label:'Sleep',kind:'sleep' as const,color:'blue' as const,xp:{amount:5,basis:'entry' as const},goal:{target:480,maximum:false,from:'2026-10-26'},previousGoals:[{target:450,maximum:false,from:'2026-10-19'}]}],entries:{}}};
 expect(metricGoals(d,'sleep',range,false,'2026-10-26')[0].value).toBe('≥ 7h 30m/day');
 expect(metricGoals(empty(),'screen-time',range,true,'2026-10-26')[0].value).toBe('≤ 4h/day');
 expect(metricGoals(d,'missing',range,false,'2026-10-26')).toEqual([]);
});
