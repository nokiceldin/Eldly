import { describe, expect, it } from "vitest";
import { HABITS, emptyMapping, setMappingEntry, mappingProgress, validateMapping } from "./mapping";
import { empty, seed, saveTaskInput } from "./engine";
import { validate } from "./storage";
describe("monthly mapping records", () => {
  it("has the original activities and screen time with their colors", () => {
    expect(HABITS).toHaveLength(13);
    const colors = (color: string) => HABITS.filter(h => h.color === color).map(h => h.id);
    expect(colors("yellow")).toEqual(["tennis", "fitness"]);
    expect(colors("green")).toEqual(["recovery", "praying", "sleep"]);
    expect(colors("blue")).toEqual(["reading", "journaling", "no-phone"]);
    expect(colors("pink")).toEqual(["homework", "coaching"]);
    expect(colors("red")).toEqual(["porn", "goyslop"]);
  });
  it("edits one date and activity without duplicates or changing other cells", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-04", "tennis", { kind: "duration", minutes: 90 });
    m = setMappingEntry(m, "2026-10-05", "tennis", { kind: "duration", minutes: 60 });
    m = setMappingEntry(m, "2026-10-04", "reading", { kind: "duration", minutes: 30 });
    m = setMappingEntry(m, "2026-10-04", "tennis", { kind: "duration", minutes: 120 });
    expect(m.entries["2026-10-04"].tennis).toEqual({ kind: "duration", minutes: 120 });
    expect(m.entries["2026-10-04"].reading).toEqual({ kind: "duration", minutes: 30 });
    expect(m.entries["2026-10-05"].tennis).toEqual({ kind: "duration", minutes: 60 });
    expect(Object.keys(m.entries)).toHaveLength(2);
  });
  it("removes only the chosen record and cleans up empty dates", () => {
    const m = setMappingEntry(emptyMapping(), "2026-10-04", "goyslop", { kind: "check" });
    const cleared = setMappingEntry(m, "2026-10-04", "goyslop");
    expect(cleared).toEqual(emptyMapping());
    expect(m.entries["2026-10-04"].goyslop).toBeDefined();
  });
  it("keeps night/day sleep separate for future chart series", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-04", "sleep", { kind: "sleep", nightMinutes: 480, dayMinutes: 60 });
    m = setMappingEntry(m, "2026-10-04", "praying", { kind: "prayer", count: 5 });
    m = setMappingEntry(m, "2026-10-04", "tennis", { kind: "duration", minutes: 90 });
    expect(mappingProgress(m, "2026-10-01", "2026-10-31")[0]).toMatchObject({ date: "2026-10-04", sleep: { nightMinutes: 480, dayMinutes: 60 }, prayers: 5, durationMinutes: { tennis: 90 } });
    expect(mappingProgress(m, "2026-11-01", "2026-11-30")).toEqual([]);
  });
  it("records actual sleep below eight hours and daytime-only sleep", () => {
    expect(validateMapping(setMappingEntry(emptyMapping(), "2026-10-04", "sleep", { kind: "sleep", nightMinutes: 360, dayMinutes: 0 }))).toBe(true);
    expect(validateMapping(setMappingEntry(emptyMapping(), "2026-10-04", "sleep", { kind: "sleep", nightMinutes: 0, dayMinutes: 60 }))).toBe(true);
  });
  it("survives backup roundtrip with checklist edits and old backups", () => {
    const mapping = setMappingEntry(emptyMapping(), "2026-10-04", "fitness", { kind: "duration", minutes: 60 });
    const d = seed({ ...empty(), mapping }, "2026-10-15");
    const updated = saveTaskInput(d, { id: "personal", title: "New task", notes: "", category: "", scheduled: "2026-10-15", original: "2026-10-15", carry: true, important: false, order: 0 });
    const restored = JSON.parse(JSON.stringify(updated));
    expect(validate(restored)).toBe(true);
    expect(restored.mapping).toEqual(mapping);
    expect(validate(empty())).toBe(true);
  });
  it("rejects invalid dates, units, durations and prayer counts", () => {
    for (const [id, entry] of [["tennis", { kind: "check" }], ["fitness", { kind: "duration", minutes: -1 }], ["reading", { kind: "duration", minutes: 0 }], ["journaling", { kind: "duration", minutes: Infinity }], ["sleep", { kind: "sleep", nightMinutes: 1200, dayMinutes: 300 }], ["praying", { kind: "prayer", count: 1.5 }], ["unknown", { kind: "check" }]]) {
      expect(validateMapping({ version: 1, entries: { "2026-10-04": { [String(id)]: entry } } })).toBe(false);
    }
    expect(() => setMappingEntry(emptyMapping(), "2026-02-30", "coaching", { kind: "check" })).toThrow();
    expect(validate({ ...empty(), mapping: { version: 1, entries: [] } })).toBe(false);
  });
  it("keeps calendar dates across month/year and daylight saving boundaries", () => {
    let m = emptyMapping();
    for (const day of ["2026-10-31", "2026-11-01", "2026-12-31", "2027-01-01", "2028-02-29"]) m = setMappingEntry(m, day, "coaching", { kind: "check" });
    expect(validateMapping(m)).toBe(true);
    expect(mappingProgress(m, "2026-10-31", "2026-11-01").map(x => x.date)).toEqual(["2026-10-31", "2026-11-01"]);
    expect(validateMapping({ version: 1, entries: { "2027-02-29": { coaching: { kind: "check" } } } })).toBe(false);
  });
});

it('converts old timed reading, recovery and journaling to daily check-offs', async()=>{
 const { normalizeDailyChecks }=await import('./mapping');
 let data=emptyMapping();
 for(const id of ['reading','recovery','journaling'] as const)data=setMappingEntry(data,'2026-10-16',id,{kind:'duration',minutes:20});
 const migrated=normalizeDailyChecks(data);
 for(const id of ['reading','recovery','journaling'] as const)expect(migrated.entries['2026-10-16'][id]).toEqual({kind:'check'});
 expect(validateMapping(migrated)).toBe(true);
 expect(data.entries['2026-10-16'].reading).toEqual({kind:'duration',minutes:20});
});
