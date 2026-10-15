import { describe, expect, it } from "vitest";
import { emptyMapping, setMappingEntry, validateMapping } from "./mapping";
import { chartSeries, metricStats, periodRange, shiftPeriod } from "./progress";
import { empty } from "./engine";
import { validate } from "./storage";
const october = { from: "2026-10-01", to: "2026-10-31" };
describe("progress statistics and history", () => {
  it("uses Monday to Sunday and real month/year boundaries", () => {
    expect(periodRange("week", "2027-01-01", emptyMapping())).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(periodRange("month", "2028-02-12", emptyMapping())).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodRange("year", "2026-10-15", emptyMapping())).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(shiftPeriod("2026-01-31", "month", 1)).toBe("2026-02-01");
    expect(shiftPeriod("2026-01-31", "year", -1)).toBe("2025-01-01");
  });
  it("excludes missing days from averages and preserves recorded zero screen time", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-01", "screen-time", { kind: "duration", minutes: 0 });
    m = setMappingEntry(m, "2026-10-03", "screen-time", { kind: "duration", minutes: 120 });
    expect(metricStats(m, "screen-time", october)).toMatchObject({ days: 2, total: 120, average: 60 });
    const { bins } = chartSeries(m, "screen-time", october);
    expect(bins[0].value).toBe(0); expect(bins[1].value).toBeNull();
    expect(validateMapping(m)).toBe(true);
    expect(validate({ ...empty(), mapping: JSON.parse(JSON.stringify(m)) })).toBe(true);
  });
  it("records explicit zero sleep without confusing it with an unlogged day", () => {
    const m = setMappingEntry(emptyMapping(), "2026-10-01", "sleep", { kind: "sleep", nightMinutes: 0, dayMinutes: 0 });
    expect(validateMapping(m)).toBe(true);
    expect(metricStats(m, "sleep", october)).toMatchObject({ days: 1, average: 0, eightHourDays: 0 });
    expect(chartSeries(m, "sleep", october).bins[1].value).toBeNull();
  });
  it("totals sessions and prayers only inside the inclusive selected dates", () => {
    let m = setMappingEntry(emptyMapping(), "2026-09-30", "tennis", { kind: "duration", minutes: 100 });
    m = setMappingEntry(m, "2026-10-01", "tennis", { kind: "duration", minutes: 90 });
    m = setMappingEntry(m, "2026-10-31", "tennis", { kind: "duration", minutes: 30 });
    m = setMappingEntry(m, "2026-10-31", "praying", { kind: "prayer", count: 5 });
    expect(metricStats(m, "tennis", october)).toMatchObject({ total: 120, days: 2, average: 60 });
    expect(metricStats(m, "praying", october)).toMatchObject({ total: 5, days: 1 });
  });
  it("keeps sleep averages, split chart series and 8+ hour counts accurate", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-01", "sleep", { kind: "sleep", nightMinutes: 480, dayMinutes: 60 });
    m = setMappingEntry(m, "2026-10-03", "sleep", { kind: "sleep", nightMinutes: 360, dayMinutes: 0 });
    expect(metricStats(m, "sleep", october)).toMatchObject({ average: 450, total: 900, days: 2, eightHourDays: 1 });
    const yearly = chartSeries(m, "sleep", { from: "2026-01-01", to: "2026-12-31" });
    expect(yearly.group).toBe("month");
    expect(yearly.bins[9]).toMatchObject({ value: 420, secondary: 30, days: 2 });
    expect(yearly.bins[8].value).toBeNull();
  });
  it("shows monthly totals for a year without changing original daily entries", () => {
    let m = setMappingEntry(emptyMapping(), "2025-10-01", "fitness", { kind: "duration", minutes: 60 });
    m = setMappingEntry(m, "2026-10-01", "fitness", { kind: "duration", minutes: 90 });
    const before = JSON.stringify(m);
    const series = chartSeries(m, "fitness", { from: "2025-01-01", to: "2025-12-31" });
    expect(series.bins).toHaveLength(12); expect(series.bins[9].value).toBe(60);
    expect(JSON.stringify(m)).toBe(before);
    expect(m.entries["2025-10-01"].fitness).toEqual({ kind: "duration", minutes: 60 });
  });
  it("handles all time, custom periods, DST and empty statistics", () => {
    let m = setMappingEntry(emptyMapping(), "2025-12-31", "journaling", { kind: "duration", minutes: 10 });
    m = setMappingEntry(m, "2026-11-02", "journaling", { kind: "duration", minutes: 20 });
    expect(periodRange("all", "2026-10-15", m)).toEqual({ from: "2025-12-31", to: "2026-11-02" });
    const bins = chartSeries(m, "journaling", { from: "2026-10-31", to: "2026-11-02" }).bins;
    expect(bins.map(b => b.from)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(bins[2].value).toBe(20);
    expect(metricStats(emptyMapping(), "sleep", october).average).toBeNull();
  });
  it("updates graphs after edits and clearing, without duplicating a date", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-01", "reading", { kind: "duration", minutes: 20 });
    m = setMappingEntry(m, "2026-10-01", "reading", { kind: "duration", minutes: 50 });
    expect(metricStats(m, "reading", october)).toMatchObject({ days: 1, total: 50 });
    m = setMappingEntry(m, "2026-10-01", "reading");
    expect(metricStats(m, "reading", october)).toMatchObject({ days: 0, total: 0, average: null });
  });
});
