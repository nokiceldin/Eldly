import {it,expect} from 'vitest';
import {profileBadges} from './badges';
const badge=(id:string,streak=0,coins=0,goals=0,rewards=0)=>profileBadges(streak,coins,goals,rewards).find(b=>b.id===id)!;
it('keeps the welcome badge unlocked and all other badges locked until their first milestone',()=>{
 expect(profileBadges(0,0).map(b=>b.level)).toEqual([1,0,0,0,0]);expect(badge('streak',2)).toMatchObject({level:0,unlocked:false,hint:'3-day streak.',nextHint:null});
});
it('advances streak levels at exact milestones and describes the achieved and next thresholds',()=>{
 for(const [value,level] of [[3,1],[6,1],[7,2],[11,2],[14,3],[30,4],[100,5],[365,6],[999,6]])expect(badge('streak',value).level).toBe(level);
 expect(badge('streak',11)).toMatchObject({hint:'7-day streak.',nextHint:'Next: 14 days',maxLevel:6});expect(badge('streak',365).nextHint).toBeNull();
});
it('levels coin, completed-goal and purchased-reward badges independently',()=>{
 expect(profileBadges(11,1595,5,3).map(b=>b.level)).toEqual([1,2,3,2,2]);expect(badge('coins',0,1000).hint).toBe('1,000 coins earned.');expect(badge('goal',0,0,150).nextHint).toBeNull();expect(badge('reward',0,0,0,50).level).toBe(6);
});
it('does not unlock achievement levels for invalid or negative totals',()=>{
 expect(profileBadges(-1,NaN,Infinity,-10).map(b=>b.level)).toEqual([1,0,0,0,0]);
});
