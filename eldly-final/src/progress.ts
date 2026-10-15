import { add, diff, format, localDay, monday, parse } from "./engine";
import { HABITS, type HabitId, type MappingData } from "./mapping";
export const METRICS = ["tennis", "fitness", "recovery", "praying", "reading", "journaling", "sleep", "screen-time"] as const satisfies readonly HabitId[];
export type Metric = typeof METRICS[number];
export type Period = "week" | "month" | "year" | "all" | "custom";
export interface Range { from: string; to: string }
export function periodRange(period: Exclude<Period, "custom">, anchor: string, data: MappingData): Range {
  const d = parse(anchor), year = d.getFullYear(), month = d.getMonth();
  if (period === "week") return { from: monday(anchor), to: add(monday(anchor), 6) };
  if (period === "month") return { from: localDay(new Date(year, month, 1, 12)), to: localDay(new Date(year, month + 1, 0, 12)) };
  if (period === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
  const dates = Object.keys(data.entries).sort();
  return { from: dates[0] && dates[0] < anchor ? dates[0] : anchor, to: dates.at(-1) && dates.at(-1)! > anchor ? dates.at(-1)! : anchor };
}
export function shiftPeriod(anchor: string, period: Period, direction: number) {
  const d = parse(anchor);
  if (period === "week") return add(anchor, 7 * direction);
  return localDay(new Date(d.getFullYear() + (period === "year" ? direction : 0), d.getMonth() + (period === "month" ? direction : 0), 1, 12));
}
export function metricValues(data: MappingData, metric: Metric, range: Range, dimension: "primary" | "pickups" = "primary") {
  return Object.entries(data.entries).filter(([date]) => date >= range.from && date <= range.to).sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, row]) => {
    const entry = row[metric];
    if (!entry) return [];
    if (dimension === "pickups") return entry.kind === "phone" && entry.pickups !== undefined ? [{ date, value: entry.pickups, secondary: 0 }] : [];
    if (entry.kind === "phone") return entry.minutes !== undefined ? [{ date, value: entry.minutes, secondary: 0 }] : [];
    if (entry.kind === "duration") return [{ date, value: entry.minutes, secondary: 0 }];
    if (entry.kind === "prayer") return [{ date, value: entry.count, secondary: 0 }];
    if (entry.kind === "sleep") return [{ date, value: entry.nightMinutes, secondary: entry.dayMinutes }];
    return [];
  });
}
export function metricStats(data: MappingData, metric: Metric, range: Range, dimension: "primary" | "pickups" = "primary") {
  const values = metricValues(data, metric, range, dimension);
  const total = values.reduce((sum, d) => sum + d.value + d.secondary, 0);
  const best = values.reduce<typeof values[number] | undefined>((best, d) => !best || d.value + d.secondary > best.value + best.secondary ? d : best, undefined);
  return { days: values.length, total, average: values.length ? total / values.length : null, best, eightHourDays: metric === "sleep" ? values.filter(d => d.value + d.secondary >= 480).length : 0 };
}
export function chartSeries(data: MappingData, metric: Metric, range: Range, dimension: "primary" | "pickups" = "primary") {
  const length = diff(range.to, range.from) + 1;
  const group = length <= 45 ? "day" : length <= 180 ? "week" : length <= 1461 ? "month" : "year";
  const values = metricValues(data, metric, range, dimension);
  const bins: { from: string; to: string; label: string; value: number | null; secondary: number; days: number; exampleDate?: string }[] = [];
  for (let start = range.from; start <= range.to;) {
    const d = parse(start);
    const end = group === "day" ? start : group === "week" ? add(start, 6) : group === "month" ? localDay(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) : `${d.getFullYear()}-12-31`;
    const to = end > range.to ? range.to : end;
    const rows = values.filter(row => row.date >= start && row.date <= to);
    // Sleep always shows an average per recorded day; other grouped metrics show totals.
    const divisor = metric === "sleep" ? rows.length || 1 : 1;
    bins.push({ from: start, to, label: group === "year" ? start.slice(0, 4) : group === "month" ? format(start, { month: "short" }) : format(start, { month: "short", day: "numeric" }), value: rows.length ? rows.reduce((s, r) => s + r.value, 0) / divisor : null, secondary: rows.reduce((s, r) => s + r.secondary, 0) / divisor, days: rows.length, exampleDate: rows[0]?.date });
    start = add(to, 1);
  }
  return { bins, group };
}
export function humanValue(value: number, metric: Metric) {
  if (metric === "praying") return `${Number.isInteger(value) ? value : value.toFixed(1)}`;
  const minutes = Math.round(value);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;
}
export const metricLabel = (metric: Metric) => metric === "sleep" ? "Sleep" : HABITS.find(h => h.id === metric)!.label;
