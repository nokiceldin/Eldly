import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { empty } from "./engine";
import { emptyMapping, setMappingEntry } from "./mapping";
import { buildRecap, pendingRecaps, recapWindows } from "./recaps";
import { validate } from "./storage";
import { apply, diff, flatten, inflate } from "./sync/records";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 2, 12)); });
afterEach(() => vi.useRealTimers());
describe("period recaps", () => {
  it("uses the last complete Monday–Sunday and calendar month/year", () => {
    const [week,month,year] = recapWindows("2027-01-01");
    expect(week.range).toEqual({from:"2026-12-21",to:"2026-12-27"});
    expect(month.range).toEqual({from:"2026-12-01",to:"2026-12-31"});
    expect(month.previous).toEqual({from:"2026-11-01",to:"2026-11-30"});
    expect(year.range).toEqual({from:"2026-01-01",to:"2026-12-31"});
    expect(recapWindows("2028-03-01")[1].range).toEqual({from:"2028-02-01",to:"2028-02-29"});
    expect(recapWindows("2026-11-02")[0].range).toEqual({from:"2026-10-26",to:"2026-11-01"});
  });
  it("shows recaps only after a period ends, catches up after Monday, and remembers dismissed recaps", () => {
    const mapping=setMappingEntry(emptyMapping(),"2026-10-28","tennis",{kind:"duration",minutes:90});
    const data={...empty(),mapping};
    expect(pendingRecaps(data,"2026-10-14")).toEqual([]);
    const due=pendingRecaps(data,"2026-11-02");
    expect(due.map(w=>w.period)).toEqual(["week","month"]);
    expect(pendingRecaps(data,"2026-11-03").map(w=>w.id)).toEqual(due.map(w=>w.id));
    const seen={...data,recapSeen:Object.fromEntries(due.map(w=>[w.id,true as const]))};
    expect(validate(seen)).toBe(true);
    expect(pendingRecaps(seen,"2026-11-03")).toEqual([]);
    expect(pendingRecaps(empty(),"2026-11-02")).toEqual([]);
  });
  it("opens Monday’s recap for an established account even when the week has no logs",()=>{
    const data={...empty(),mapping:{version:1 as const,startedOn:"2026-10-19",habits:[],entries:{}}};
    expect(pendingRecaps(data,"2026-10-19")).toEqual([]);
    expect(pendingRecaps(data,"2026-10-26")[0].id).toBe("week:2026-10-19");
  });
  it("compares the complete period with the previous one, counts blanks as zero, and reports factual highlights", () => {
    let mapping=setMappingEntry(emptyMapping(),"2026-10-20","tennis",{kind:"duration",minutes:120});
    mapping=setMappingEntry(mapping,"2026-10-28","tennis",{kind:"duration",minutes:60});
    mapping=setMappingEntry(mapping,"2026-10-28","sleep",{kind:"sleep",nightMinutes:420,dayMinutes:0});
    mapping=setMappingEntry(mapping,"2026-10-28","porn",{kind:"check"});
    const data={...empty(),mapping};
    const recap=buildRecap(data,recapWindows("2026-11-02")[0]);
    expect(recap.metrics.find(m=>m.metric==='tennis')?.current).toMatchObject({total:60,days:7,average:60/7});
    expect(recap.metrics.find(m=>m.metric==='sleep')?.current.average).toBe(60);
    expect(recap.positives).toContain("Tennis: 1h");
    expect(recap.attention).toContain("Tennis down 1h");
    expect(recap.attention).toContain("Porn: 1 day");
  });
  it("merges acknowledgments independently across devices without losing either period", () => {
    const base={...empty(),recapSeen:{}};
    const a={...base,recapSeen:{"week:2026-10-26":true as const}};
    const b={...base,recapSeen:{"month:2026-10-01":true as const}};
    const merged=inflate(apply(apply(flatten(base),diff(flatten(base),flatten(a))),diff(flatten(base),flatten(b))));
    expect(merged).toMatchObject({recapSeen:{"week:2026-10-26":true,"month:2026-10-01":true}});
    expect(validate(merged)).toBe(true);
    expect(validate({...empty(),recapSeen:[] })).toBe(false);
  });
});


it("excludes task completions before day one from the partial opening-week recap",()=>{
 const task=(id:string,scheduled:string,completed:string)=>({id,title:id,scheduled,original:scheduled,completed,category:"",notes:"",carry:false,important:false,order:0});
 const data={...empty(),tasks:[task("before","2026-10-13","2026-10-14"),task("after","2026-10-16","2026-10-17")]};
 expect(buildRecap(data,recapWindows("2026-10-19")[0]).completed).toBe(1);
});

it('uses custom tracker kinds for averages, units and habit direction',()=>{
 let mapping={version:1 as const,startedOn:'2026-10-19',habits:[{id:'custom-sleep',label:'Rest',kind:'sleep' as const,color:'green' as const},{id:'custom-phone',label:'Scrolling',kind:'phone' as const,color:'red' as const}],entries:{}};
 let m=setMappingEntry(mapping,'2026-10-26','custom-sleep',{kind:'sleep',nightMinutes:420,dayMinutes:0});
 m=setMappingEntry(m,'2026-10-26','custom-phone',{kind:'phone',minutes:140});
 const recap=buildRecap({...empty(),mapping:m},recapWindows('2026-11-02')[0]);
 expect(recap.positives).toContain('Rest: 1h daily average');
 expect(recap.attention).toContain('Scrolling: 20m daily average');
});
it('does not celebrate unrecorded phone time as a zero-use achievement',()=>{
 const data={...empty(),mapping:{version:1 as const,entries:{}}};
 expect(buildRecap(data,recapWindows('2026-11-02')[0]).positives.some(s=>s.startsWith('Phone use:'))).toBe(false);
});
