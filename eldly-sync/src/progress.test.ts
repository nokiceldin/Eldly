import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMapping, setMappingEntry, validateMapping } from "./mapping";
import { METRICS, chartSeries, metricStats, periodRange, shiftPeriod } from "./progress";
import { empty } from "./engine";
import { validate } from "./storage";
const october = { from: "2026-10-01", to: "2026-10-31" };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2027, 0, 1, 12)); });
afterEach(() => vi.useRealTimers());
describe("progress statistics and history", () => {
  it("uses Monday to Sunday and real month/year boundaries", () => {
    expect(periodRange("week", "2027-01-01", emptyMapping())).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(periodRange("month", "2028-02-12", emptyMapping())).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodRange("year", "2026-10-15", emptyMapping())).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(shiftPeriod("2026-01-31", "month", 1)).toBe("2026-02-01");
    expect(shiftPeriod("2026-01-31", "year", -1)).toBe("2025-01-01");
  });
  it("counts missing days as zero in averages and preserves recorded zero screen time", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-01", "screen-time", { kind: "duration", minutes: 0 });
    m = setMappingEntry(m, "2026-10-03", "screen-time", { kind: "duration", minutes: 120 });
    expect(metricStats(m, "screen-time", october)).toMatchObject({ days: 31, total: 120, average: 120 / 31 });
    const { bins } = chartSeries(m, "screen-time", october);
    expect(bins[0].value).toBe(0); expect(bins[1].value).toBe(0);
    expect(validateMapping(m)).toBe(true);
    expect(validate({ ...empty(), mapping: JSON.parse(JSON.stringify(m)) })).toBe(true);
  });
  it("records explicit zero sleep without confusing it with an unlogged day", () => {
    const m = setMappingEntry(emptyMapping(), "2026-10-01", "sleep", { kind: "sleep", nightMinutes: 0, dayMinutes: 0 });
    expect(validateMapping(m)).toBe(true);
    expect(metricStats(m, "sleep", october)).toMatchObject({ days: 31, average: 0, eightHourDays: 0 });
    expect(chartSeries(m, "sleep", october).bins[1].value).toBe(0);
  });
  it("totals sessions and prayers only inside the inclusive selected dates", () => {
    let m = setMappingEntry(emptyMapping(), "2026-09-30", "tennis", { kind: "duration", minutes: 100 });
    m = setMappingEntry(m, "2026-10-01", "tennis", { kind: "duration", minutes: 90 });
    m = setMappingEntry(m, "2026-10-31", "tennis", { kind: "duration", minutes: 30 });
    m = setMappingEntry(m, "2026-10-31", "praying", { kind: "prayer", count: 5 });
    expect(metricStats(m, "tennis", october)).toMatchObject({ total: 120, days: 31, average: 120 / 31 });
    expect(metricStats(m, "praying", october)).toMatchObject({ total: 5, days: 31 });
  });
  it("keeps sleep averages, split chart series and 8+ hour counts accurate", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-01", "sleep", { kind: "sleep", nightMinutes: 480, dayMinutes: 60 });
    m = setMappingEntry(m, "2026-10-03", "sleep", { kind: "sleep", nightMinutes: 360, dayMinutes: 0 });
    expect(metricStats(m, "sleep", october)).toMatchObject({ average: 900 / 31, total: 900, days: 31, eightHourDays: 1 });
    const yearly = chartSeries(m, "sleep", { from: "2026-01-01", to: "2026-12-31" });
    expect(yearly.group).toBe("month");
    expect(yearly.bins[9]).toMatchObject({ value: 840 / 31, secondary: 60 / 31, days: 31 });
    expect(yearly.bins[8].value).toBe(0);
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
    expect(metricStats(emptyMapping(), "sleep", october).average).toBe(0);
  });
  it("updates graphs after edits and clearing, without duplicating a date", () => {
    let m = setMappingEntry(emptyMapping(), "2026-10-01", "reading", { kind: "duration", minutes: 20 });
    m = setMappingEntry(m, "2026-10-01", "reading", { kind: "duration", minutes: 50 });
    expect(metricStats(m, "reading", october)).toMatchObject({ days: 31, total: 50 });
    m = setMappingEntry(m, "2026-10-01", "reading");
    expect(metricStats(m, "reading", october)).toMatchObject({ days: 31, total: 0, average: 0 });
  });
});

describe("blank-day semantics", () => {
  it("counts completely blank days for every metric without modifying saved data", () => {
    const data = emptyMapping();
    for (const metric of METRICS) {
      expect(metricStats(data, metric, { from: "2026-10-01", to: "2026-10-07" })).toMatchObject({ total: 0, average: 0, days: 7 });
    }
    expect(data.entries).toEqual({});
  });
  it("averages tennis over the entire week, including blank days and other-activity days", () => {
    let data = setMappingEntry(emptyMapping(), "2026-10-01", "tennis", { kind: "duration", minutes: 140 });
    data = setMappingEntry(data, "2026-10-02", "reading", { kind: "duration", minutes: 30 });
    expect(metricStats(data, "tennis", { from: "2026-10-01", to: "2026-10-07" })).toMatchObject({ total: 140, average: 20, days: 7 });
  });
  it("excludes future days from totals, averages and chart values", () => {
    vi.setSystemTime(new Date(2026, 9, 3, 12));
    let data = setMappingEntry(emptyMapping(), "2026-10-01", "tennis", { kind: "duration", minutes: 90 });
    data = setMappingEntry(data, "2026-10-05", "tennis", { kind: "duration", minutes: 60 });
    expect(metricStats(data, "tennis", october)).toMatchObject({ total: 90, average: 30, days: 3 });
    const { bins } = chartSeries(data, "tennis", october);
    expect(bins[1].value).toBe(0);
    expect(bins[2].value).toBe(0);
    expect(bins[3].value).toBeNull();
    expect(metricStats(data, "tennis", { from: "2026-11-01", to: "2026-11-07" })).toMatchObject({ days: 0, average: null });
  });
});
