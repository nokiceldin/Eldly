import {it,expect} from 'vitest';
import {trackingStreak} from '../shared/streak';
import {profileBadges} from './components/ProfileBadges';
import type {MappingData} from './mapping';
const mapping=(entries:MappingData['entries']):MappingData=>({version:1,startedOn:'2026-10-15',entries});
it('leaves today out until something is tracked; any additional entry still counts once',()=>{
 const m=mapping({'2026-10-23':{a:{kind:'check'}},'2026-10-24':{a:{kind:'check'}},'2026-10-25':{}});
 expect(trackingStreak(m,'2026-10-25')).toMatchObject({streak:2,trackedToday:false});
 m.entries['2026-10-25']={a:{kind:'check'},b:{kind:'check'}};expect(trackingStreak(m,'2026-10-25')).toMatchObject({streak:3,longest:3,trackedToday:true});
 delete m.entries['2026-10-25'];expect(trackingStreak(m,'2026-10-25').streak).toBe(2);
});
it('excludes future days, pre-start days, empty rows and zero activity placeholders',()=>{
 const m=mapping({'2026-10-14':{a:{kind:'check'}},'2026-10-15':{},'2026-10-24':{a:{kind:'duration',minutes:0}},'2026-10-26':{a:{kind:'check'}}});
 expect(trackingStreak(m,'2026-10-25')).toMatchObject({streak:0,longest:0,trackedToday:false});
});
it('accepts explicitly logged zero phone time and keeps longest across gaps and year boundaries',()=>{
 const m=mapping({'2026-12-30':{a:{kind:'check'}},'2026-12-31':{a:{kind:'phone',minutes:0}},'2027-01-01':{a:{kind:'prayer',count:1}},'2027-01-04':{a:{kind:'sleep',nightMinutes:0,dayMinutes:0}}});
 expect(trackingStreak(m,'2027-01-03')).toMatchObject({streak:0,longest:3});expect(trackingStreak(m,'2027-01-04')).toMatchObject({streak:1,longest:3});
});
it('unlocks a welcome badge for everyone and uses personal achievement thresholds',()=>{
 expect(profileBadges(0,0).map(b=>b.unlocked)).toEqual([true,false,false,false,false]);expect(profileBadges(3,100,1,1).every(b=>b.unlocked)).toBe(true);expect(profileBadges(2,99).map(b=>b.unlocked)).toEqual([true,false,false,false,false]);
});
