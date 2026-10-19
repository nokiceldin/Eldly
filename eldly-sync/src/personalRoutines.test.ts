import { describe, expect, it } from "vitest";
import { empty, onDay } from "./engine";
import { addRequestedRoutines } from "./personalRoutines";
import { validate } from "./storage";
describe("requested recurring tasks",()=>{
 it("adds Monday/Friday and Sunday routines once, starting this week",()=>{
  const data=addRequestedRoutines(empty());
  expect(onDay(data,"2026-10-19","2026-10-19").map(t=>t.title)).toEqual(["Back exercises","Face routine"]);
  expect(onDay(data,"2026-10-23","2026-10-19").map(t=>t.title)).toEqual(["Back exercises","Face routine"]);
  expect(onDay(data,"2026-10-25","2026-10-19").map(t=>t.title)).toEqual(["Vacuuming","Throwing out the trash"]);
  expect(addRequestedRoutines(data).routines).toHaveLength(4);
  expect(validate(data)).toBe(true);
  expect(addRequestedRoutines({...data,routines:[]}).routines).toEqual([]);
 });
});
