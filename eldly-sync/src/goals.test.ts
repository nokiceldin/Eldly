import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { add, empty } from "./engine";
import { emptyMapping, setMappingEntry } from "./mapping";
import { applyGoalRecommendation, defaultTargets, goalHistory, goalRecommendations, initialGoalPlan, weeklyGoals } from "./goals";
import { validate } from "./storage";
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(2027,5,1,12));});
afterEach(()=>vi.useRealTimers());
describe("personal weekly goals",()=>{
 it("stores every requested target and begins scoring the first complete tracking week",()=>{
  const plan=initialGoalPlan(empty());
  expect(plan.from).toBe("2026-10-19");
  expect(plan.targets).toEqual({praying:7,"tennis-days":6,"tennis-hours":900,fitness:240,recovery:3,sleep:510,reading:2,journaling:1,"no-phone":4,homework:4,porn:2,goyslop:3,"screen-time":240});
  expect(validate({...empty(),goalPlans:[plan]})).toBe(true);
 });
 it("counts precise success totals over 30 completed weeks",()=>{
  let mapping=emptyMapping();
  for(let week=0;week<30;week++)for(let day=0;day<7;day++){
   const date=add("2026-10-19",week*7+day);
   if(week<18)mapping=setMappingEntry(mapping,date,"sleep",{kind:"sleep",nightMinutes:510,dayMinutes:0});
   if(week<22&&day<6)mapping=setMappingEntry(mapping,date,"tennis",{kind:"duration",minutes:150});
  }
  const data={...empty(),mapping};
  const history=goalHistory(data,{from:"2026-10-19",to:add("2026-10-19",30*7-1)});
  expect(history.weeks).toHaveLength(30);
  expect(history.summary.find(g=>g.id==='sleep')).toMatchObject({met:18,total:30});
  expect(history.summary.find(g=>g.id==='tennis')).toMatchObject({met:22,total:30});
 });
 it("handles check-off goals and inclusive maximum limits",()=>{
  let mapping=emptyMapping();
  for(let day=0;day<7;day++){
   const date=add("2026-10-19",day);
   mapping=setMappingEntry(mapping,date,"screen-time",{kind:"phone",minutes:240});
   if(day<3)mapping=setMappingEntry(mapping,date,"recovery",{kind:"check"});
   if(day<2)mapping=setMappingEntry(mapping,date,"porn",{kind:"check"});
  }
  const goals=weeklyGoals({...empty(),mapping},"2026-10-19");
  expect(goals.find(g=>g.id==='screen-time')).toMatchObject({actual:240,met:true});
  expect(goals.find(g=>g.id==='recovery')).toMatchObject({actual:3,met:true});
  expect(goals.find(g=>g.id==='porn')).toMatchObject({actual:2,met:true});
 });
 it("keeps historical targets intact when applying a monthly suggestion",()=>{
  const data={...empty(),goalPlans:[initialGoalPlan(empty())]};
  const next=applyGoalRecommendation(data,"sleep",480,"2026-11-02");
  expect(weeklyGoals(next,"2026-10-19")[5].target).toBe(510);
  expect(weeklyGoals(next,"2026-11-09")[5].target).toBe(480);
  expect(next.goalPlans).toHaveLength(2);
  expect(validate(next)).toBe(true);
 });
 it("suggests a realistic sleep bridge and a higher prayer target without applying either",()=>{
  let mapping=emptyMapping();
  for(let day=0;day<30;day++){
   const date=add("2026-11-01",day);
   mapping=setMappingEntry(mapping,date,"sleep",{kind:"sleep",nightMinutes:450,dayMinutes:0});
   mapping=setMappingEntry(mapping,date,"praying",{kind:"prayer",count:2});
  }
  const data={...empty(),mapping}, suggestions=goalRecommendations(data,{from:"2026-11-01",to:"2026-11-30"});
  expect(suggestions.find(g=>g.id==='sleep')?.proposed).toBe(480);
  expect(suggestions.find(g=>g.id==='praying')?.proposed).toBe(10.5);
  expect(data.goalPlans).toBeUndefined();
 });
});
