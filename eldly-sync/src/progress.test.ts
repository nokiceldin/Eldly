import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMapping, setMappingEntry, validateMapping } from "./mapping";
import { METRICS, chartSeries, metricStats, periodRange, shiftPeriod } from "./progress";
const december={from:"2026-12-01",to:"2026-12-31"};
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(2027,0,1,12));});
afterEach(()=>vi.useRealTimers());
describe("progress statistics and history",()=>{
 it("uses real Monday, month and leap-year boundaries",()=>{
  expect(periodRange("week","2027-01-01",emptyMapping())).toEqual({from:"2026-12-28",to:"2027-01-03"});
  expect(periodRange("month","2028-02-12",emptyMapping())).toEqual({from:"2028-02-01",to:"2028-02-29"});
  expect(shiftPeriod("2026-01-31","month",1)).toBe("2026-02-01");
 });
 it("counts blank days as zero for every metric without changing saved entries",()=>{
  const data=emptyMapping();
  for(const metric of METRICS)expect(metricStats(data,metric,december)).toMatchObject({total:0,average:0,days:31});
  expect(data.entries).toEqual({});
 });
 it("preserves explicit zero screen time and averages across the whole month",()=>{
  let data=setMappingEntry(emptyMapping(),"2026-12-01","screen-time",{kind:"duration",minutes:0});
  data=setMappingEntry(data,"2026-12-03","screen-time",{kind:"duration",minutes:120});
  expect(metricStats(data,"screen-time",december)).toMatchObject({days:31,total:120,average:120/31});
  expect(chartSeries(data,"screen-time",december).bins[1].value).toBe(0);
  expect(validateMapping(data)).toBe(true);
 });
 it("totals tennis and prayers only in inclusive selected dates",()=>{
  const range={from:"2026-10-15",to:"2026-10-18"};
  let data=setMappingEntry(emptyMapping(),"2026-10-15","tennis",{kind:"duration",minutes:120});
  data=setMappingEntry(data,"2026-10-18","praying",{kind:"prayer",count:5});
  data=setMappingEntry(data,"2026-10-19","tennis",{kind:"duration",minutes:300});
  expect(metricStats(data,"tennis",range)).toMatchObject({total:120,days:4,average:30});
  expect(metricStats(data,"praying",range).total).toBe(5);
 });
 it("keeps night/day sleep and grouped daily averages accurate",()=>{
  let data=setMappingEntry(emptyMapping(),"2026-12-01","sleep",{kind:"sleep",nightMinutes:480,dayMinutes:60});
  data=setMappingEntry(data,"2026-12-03","sleep",{kind:"sleep",nightMinutes:360,dayMinutes:0});
  expect(metricStats(data,"sleep",december)).toMatchObject({total:900,average:900/31,days:31});
  const yearly=chartSeries(data,"sleep",{from:"2026-01-01",to:"2027-12-31"});
  expect(yearly.group).toBe("month");
  expect(yearly.bins.find(b=>b.from==="2026-12-01")).toMatchObject({value:840/31,secondary:60/31,days:31});
 });
 it("excludes all dates before October 15, including legacy data",()=>{
  let data=setMappingEntry(emptyMapping(),"2026-10-01","tennis",{kind:"duration",minutes:900});
  data=setMappingEntry(data,"2026-10-15","tennis",{kind:"duration",minutes:170});
  expect(metricStats(data,"tennis",{from:"2026-10-01",to:"2026-10-31"})).toMatchObject({total:170,average:10,days:17});
  expect(metricStats(data,"sleep",{from:"2026-10-01",to:"2026-10-14"})).toMatchObject({days:0,average:null});
  expect(chartSeries(data,"tennis",{from:"2026-10-01",to:"2026-10-31"}).bins[0].from).toBe("2026-10-15");
 });
 it("excludes future days from totals, averages and chart values",()=>{
  vi.setSystemTime(new Date(2026,9,17,12));
  let data=setMappingEntry(emptyMapping(),"2026-10-15","tennis",{kind:"duration",minutes:90});
  data=setMappingEntry(data,"2026-10-20","tennis",{kind:"duration",minutes:120});
  const range={from:"2026-10-01",to:"2026-10-31"};
  expect(metricStats(data,"tennis",range)).toMatchObject({total:90,average:30,days:3});
  expect(chartSeries(data,"tennis",range).bins[3].value).toBeNull();
 });
 it("counts legacy reading/recovery/journaling sessions as days, not minutes",()=>{
  for(const metric of ["reading","recovery","journaling"] as const){
   let data=setMappingEntry(emptyMapping(),"2026-12-01",metric,{kind:"duration",minutes:20});
   data=setMappingEntry(data,"2026-12-02",metric,{kind:"check"});
   expect(metricStats(data,metric,december).total).toBe(2);
   data=setMappingEntry(data,"2026-12-01",metric);
   expect(metricStats(data,metric,december).total).toBe(1);
  }
 });
 it("handles all-time history, DST and clearing without rewriting history",()=>{
  let data=setMappingEntry(emptyMapping(),"2026-10-31","journaling",{kind:"check"});
  data=setMappingEntry(data,"2026-11-02","journaling",{kind:"check"});
  const before=JSON.stringify(data);
  expect(periodRange("all","2026-12-01",data).from).toBe("2026-10-15");
  expect(chartSeries(data,"journaling",{from:"2026-10-31",to:"2026-11-02"}).bins.map(b=>b.value)).toEqual([1,0,1]);
  expect(JSON.stringify(data)).toBe(before);
 });
 it("clips the October 14–17 example to the three actual tracking days",()=>{
  let data=setMappingEntry(emptyMapping(),"2026-10-15","tennis",{kind:"duration",minutes:120});
  data=setMappingEntry(data,"2026-10-16","sleep",{kind:"sleep",nightMinutes:480,dayMinutes:0});
  data=setMappingEntry(data,"2026-10-17","sleep",{kind:"sleep",nightMinutes:480,dayMinutes:0});
  const range={from:"2026-10-14",to:"2026-10-17"};
  expect(metricStats(data,"tennis",range)).toMatchObject({total:120,days:3,average:40});
  expect(metricStats(data,"sleep",range).average).toBe(320);
 });
});
