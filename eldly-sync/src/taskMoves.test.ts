import { describe, expect, it } from "vitest";
import { empty, onDay, type Routine, type Task } from "./engine";
import { moveTaskOccurrence } from "./taskMoves";
const today="2026-10-19";
const task=(id:string,order:number):Task=>({id,title:id,scheduled:today,original:today,category:"",notes:"",carry:false,important:false,order});
const routine:Routine={id:"homework",title:"Homework",category:"",notes:"",start:today,weekdays:[0],frequency:"weekly",interval:1,paused:false,carry:false,important:false};
describe("dragging task occurrences",()=>{
 it("reorders tied task orders and persists the result without changing completions",()=>{
  const a={...task("a",0),completed:today},b=task("b",0),c=task("c",0);
  const result=moveTaskOccurrence({...empty(),tasks:[a,b,c]},c,today,0,today);
  expect(onDay(result,today,today).map(t=>t.id)).toEqual(["c","a","b"]);
  expect(result.tasks.find(t=>t.id==='a')?.completed).toBe(today);
 });
 it("moves one Monday occurrence to Tuesday without altering any other week",()=>{
  const data={...empty(),routines:[routine]};
  const occurrence=onDay(data,today,today)[0];
  const result=moveTaskOccurrence(data,occurrence,"2026-10-20",0,today);
  expect(onDay(result,today,today)).toEqual([]);
  expect(onDay(result,"2026-10-20",today)[0]).toMatchObject({id:"homework:2026-10-19",scheduled:"2026-10-20",original:today});
  expect(onDay(result,"2026-10-26",today)[0].scheduled).toBe("2026-10-26");
  expect(result.routines).toEqual(data.routines);
  expect(result.overrides[occurrence.id]).toBeDefined();
 });
 it("moves into an empty earlier day without losing the original recurring occurrence",()=>{
  const data={...empty(),routines:[routine]};
  const occurrence=onDay(data,"2026-10-26",today)[0];
  const result=moveTaskOccurrence(data,occurrence,"2026-10-25",0,today);
  expect(onDay(result,"2026-10-25",today)[0].id).toBe(occurrence.id);
  expect(onDay(result,"2026-10-26",today)).toEqual([]);
 });
 it("leaves deadlines and deleted records intact",()=>{
  const original={...task('a',0),due:"2026-10-23",deadline:true};
  const result=moveTaskOccurrence({...empty(),tasks:[original]},original,"2026-10-21",0,today);
  expect(result.tasks[0]).toMatchObject({due:"2026-10-23",original:today,scheduled:"2026-10-21"});
  expect(()=>moveTaskOccurrence(result,original,"invalid",0,today)).toThrow();
 });
});
