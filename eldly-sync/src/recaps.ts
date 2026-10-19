import { TRACKING_START } from "./tracking";
import { add, allTasks, diff, localDay, monday, parse, type Data } from "./engine";
import { emptyMapping, HABITS } from "./mapping";
import { humanValue, METRICS, metricLabel, metricStats, type Range } from "./progress";
export type RecapPeriod = "week" | "month" | "year";
export interface RecapWindow { id: string; period: RecapPeriod; range: Range; previous: Range }
export function recapWindows(today = localDay()): RecapWindow[] {
  const d = parse(today), year = d.getFullYear(), month = d.getMonth();
  const weekEnd = add(monday(today), -1);
  const monthStart = localDay(new Date(year, month - 1, 1, 12));
  const windows: Omit<RecapWindow, "id">[] = [
    { period: "week", range: { from: add(weekEnd, -6), to: weekEnd }, previous: { from: add(weekEnd, -13), to: add(weekEnd, -7) } },
    { period: "month", range: { from: monthStart, to: add(localDay(new Date(year, month, 1, 12)), -1) }, previous: { from: localDay(new Date(year, month - 2, 1, 12)), to: add(monthStart, -1) } },
    { period: "year", range: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }, previous: { from: `${year - 2}-01-01`, to: `${year - 2}-12-31` } },
  ];
  return windows.map(w => ({ ...w, id: `${w.period}:${w.range.from}` }));
}
export function pendingRecaps(data: Data, today = localDay()) {
  const dates = [...Object.keys(data.mapping?.entries || {}), ...data.tasks.map(t => t.scheduled), ...data.routines.map(r => r.start)].sort();
  const first = dates[0];
  return recapWindows(today).filter(w => !data.recapSeen?.[w.id] && first && w.range.to >= TRACKING_START);
}
export function buildRecap(data: Data, window: RecapWindow, today = localDay()) {
  const from = window.range.from < TRACKING_START ? TRACKING_START : window.range.from;
  const mapping = data.mapping || emptyMapping();
  const metrics = METRICS.map(metric => ({ metric, label: metricLabel(metric), current: metricStats(mapping, metric, window.range), previous: metricStats(mapping, metric, window.previous) }));
  const marks = HABITS.filter(h => h.kind === "check").map(h => ({ ...h, days: Object.entries(mapping.entries).filter(([date, row]) => date >= window.range.from && date >= TRACKING_START && date <= window.range.to && !!row[h.id]).length }));
  const tasks = allTasks(data, window.range.to, today).filter(t => !t.deleted && ((t.scheduled >= from && t.scheduled <= window.range.to) || (t.completed && t.completed >= from && t.completed <= window.range.to)));
  const completed = tasks.filter(t => t.completed && t.completed >= from && t.completed <= window.range.to).length;
  const positives: string[] = [], attention: string[] = [];
  for (const row of metrics) {
    const { metric, current, previous, label } = row;
    const red = HABITS.find(h=>h.id===metric)?.color === "red";
    if (red && current.total > 0) attention.push(`${label}: ${humanValue(current.total,metric)}`);
    if (!red && metric !== "screen-time" && metric !== "sleep" && current.total > 0) positives.push(`${label}: ${humanValue(current.total, metric)}${metric === "praying" ? " prayers" : ""}`);
    if (metric === "screen-time" && previous.average && current.average !== null && current.average < previous.average) positives.push(`Phone use down ${humanValue(previous.average - current.average, metric)} per day`);
    if (metric === "screen-time" && previous.days > 0 && previous.average !== null && current.average !== null && current.average > previous.average) attention.push(`Phone use up ${humanValue(current.average - previous.average, metric)} per day`);
    if (metric !== "screen-time" && previous.total > 0) {
      const delta = metric === "sleep" ? (previous.average || 0) - (current.average || 0) : previous.total - current.total;
      if (delta > 0) (red ? positives : attention).push(`${label} down ${humanValue(delta, metric)}${metric === "sleep" ? " per day" : metric === "praying" ? " prayers" : ""}`);
    }
  }
  if (completed) positives.unshift(`${completed} ${completed === 1 ? "task" : "tasks"} completed`);
  return { ...window, metrics, positives, attention, completed, totalTasks: tasks.length, days: Math.max(0, diff(window.range.to, window.range.from < TRACKING_START ? TRACKING_START : window.range.from) + 1) };
}
