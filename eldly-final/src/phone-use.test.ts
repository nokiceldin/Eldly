import { describe, expect, it } from "vitest";
import { emptyMapping, setMappingEntry, validateMapping, entryDescription } from "./mapping";
import { chartSeries, metricStats } from "./progress";
import { empty } from "./engine";
import { validate } from "./storage";
const range = { from: "2026-10-01", to: "2026-10-31" };
describe("daily phone use", () => {
  it("preserves legacy screen-time values and independent time/count averages", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-12", "screen-time", { kind: "duration", minutes: 120 });
    m = setMappingEntry(m, "2026-10-15", "screen-time", { kind: "phone", pickups: 40 });
    m = setMappingEntry(m, "2026-10-16", "screen-time", { kind: "phone", minutes: 60, pickups: 20 });
    expect(metricStats(m, "screen-time", range)).toMatchObject({ total: 180, average: 90, days: 2 });
    expect(metricStats(m, "screen-time", range, "pickups")).toMatchObject({ total: 60, average: 30, days: 2 });
    expect(chartSeries(m, "screen-time", range, "pickups").bins[11].value).toBeNull();
    expect(chartSeries(m, "screen-time", range).bins[14].value).toBeNull();
    expect(m.entries["2026-10-12"]["screen-time"]).toEqual({ kind: "duration", minutes: 120 });
  });
  it("stores explicit zero values without inventing unrecorded fields", () => {
    const m = setMappingEntry(emptyMapping(), "2026-10-01", "screen-time", { kind: "phone", pickups: 0 });
    expect(metricStats(m, "screen-time", range, "pickups")).toMatchObject({ days: 1, average: 0 });
    expect(metricStats(m, "screen-time", range).average).toBeNull();
    expect(validateMapping(m)).toBe(true);
  });
  it("uses aligned date buckets for both series and preserves original daily history", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-04", "screen-time", { kind: "phone", minutes: 120, pickups: 50 });
    m = setMappingEntry(m, "2026-10-05", "screen-time", { kind: "phone", minutes: 60, pickups: 30 });
    const year = { from: "2026-01-01", to: "2026-12-31" };
    expect(chartSeries(m, "screen-time", year).bins[9].value).toBe(180);
    expect(chartSeries(m, "screen-time", year, "pickups").bins[9].value).toBe(80);
    const restored = JSON.parse(JSON.stringify({ ...empty(), mapping: m }));
    expect(validate(restored)).toBe(true);
    expect(restored.mapping.entries["2026-10-04"]["screen-time"].pickups).toBe(50);
    expect(entryDescription(m.entries["2026-10-05"]["screen-time"]!)).toContain("30 pickups");
  });
  it("rejects blank, fractional, negative or invalid phone-use values", () => {
    for (const value of [{ kind: "phone" }, { kind: "phone", pickups: -1 }, { kind: "phone", pickups: 1.5 }, { kind: "phone", minutes: 1441 }, { kind: "phone", pickups: null }]) expect(validateMapping({ version: 1, entries: { "2026-10-15": { "screen-time": value } } })).toBe(false);
    expect(() => setMappingEntry(emptyMapping(), "2026-10-15", "tennis", { kind: "phone", pickups: 3 })).toThrow();
  });
});
