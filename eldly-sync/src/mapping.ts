import { validGoalTarget } from "./trackerChanges";
export const HABITS = [
  { id: "tennis", label: "Tennis", color: "yellow", kind: "duration" },
  { id: "fitness", label: "Fitness", color: "yellow", kind: "duration" },
  { id: "recovery", label: "Recovery", color: "green", kind: "check" },
  { id: "praying", label: "Praying", color: "green", kind: "prayer" },
  { id: "sleep", label: "Sleep", color: "green", kind: "sleep" },
  { id: "reading", label: "Reading", color: "blue", kind: "check" },
  { id: "journaling", label: "Journaling", color: "blue", kind: "check" },
  { id: "no-phone", label: "No phone · first 15 min", color: "blue", kind: "check" },
  { id: "homework", label: "Finish all homework", color: "pink", kind: "check" },
  { id: "coaching", label: "Coaching", color: "pink", kind: "check" },
  { id: "porn", label: "Porn", color: "red", kind: "check" },
  { id: "goyslop", label: "Goyslop", color: "red", kind: "check" },
  { id: "screen-time", label: "Phone use", color: "purple", kind: "phone" },
] as const;
export const DAILY_CHECK_METRICS = ["recovery", "reading", "journaling"] as const;
export const isDailyCheckMetric = (id: string) => DAILY_CHECK_METRICS.some(metric => metric === id);
export const isCountMetric = (id: string, data?:MappingData) => getHabits(data).some(h => h.id === id && h.kind === "check");
export type HabitColor = typeof HABITS[number]["color"];
export type Habit = {id:string;label:string;color:HabitColor;kind:"check"|"duration"|"prayer"|"sleep"|"phone";previousGoals?:{target:number;maximum:boolean;from:string;until?:string}[];archived?:boolean;goal?:{target:number;maximum:boolean;from:string}};
export type HabitId = string;
export const getHabits=(data?:MappingData):readonly Habit[]=>((data?.habits??HABITS) as readonly Habit[]).filter(h=>!h.archived);
export const mappingStart=(data:MappingData)=>data.startedOn??"2026-10-15";
export type MappingEntry =
  | { kind: "check"; source?: "checkly" }
  | { kind: "duration"; minutes: number }
  | { kind: "phone"; minutes?: number; pickups?: number }
  | { kind: "prayer"; count: number }
  | { kind: "sleep"; nightMinutes: number; dayMinutes: number };
export interface MappingData {
  version: 1;
  habits?: Habit[];
  startedOn?:string;
  entries: Record<string, Partial<Record<HabitId, MappingEntry>>>;
}
export const emptyMapping = (): MappingData => ({ version: 1, entries: {} });
export function validDate(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const actual = new Date(y, m - 1, d, 12);
  return y >= 1900 && actual.getFullYear() === y && actual.getMonth() === m - 1 && actual.getDate() === d;
}
export function validEntry(id: string, entry: unknown, habits:readonly Habit[]=HABITS): entry is MappingEntry {
  const habit = habits.find((h) => h.id === id);
  if (!habit || !entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (e.kind !== habit.kind && !((id === "screen-time" || isDailyCheckMetric(id)) && e.kind === "duration")) return false;
  const integer = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
  switch (e.kind) {
    case "check": return e.source === undefined || (id === "homework" && e.source === "checkly");
    case "duration": return integer(e.minutes, id === "screen-time" ? 0 : 1, 1440);
    case "phone": return (e.minutes !== undefined || e.pickups !== undefined) && (e.minutes === undefined || integer(e.minutes, 0, 1440)) && (e.pickups === undefined || integer(e.pickups, 0, 1000000));
    case "prayer": return integer(e.count, 1, 1000);
    case "sleep": return integer(e.nightMinutes, 0, 1440) && integer(e.dayMinutes, 0, 1440) && (e.nightMinutes as number) + (e.dayMinutes as number) >= 0 && (e.nightMinutes as number) + (e.dayMinutes as number) <= 1440;
    default: return false;
  }
}
export function validateMapping(value: unknown): value is MappingData {
  if (!value || typeof value !== "object") return false;
  const data = value as MappingData;
  const habits=data.habits??HABITS;
  if(data.habits!==undefined&&(!Array.isArray(data.habits)||data.habits.length>100||!data.habits.every(h=>h&&/^[-a-zA-Z0-9_]{1,100}$/.test(h.id)&&typeof h.label==='string'&&h.label.trim().length>0&&h.label.length<=80&&["yellow","green","blue","pink","red","purple"].includes(h.color)&&["check","duration","prayer","sleep","phone"].includes(h.kind)&&(!h.previousGoals||(Array.isArray(h.previousGoals)&&h.previousGoals.every(g=>validGoalTarget(g.target,g.maximum,h.kind)&&typeof g.maximum==='boolean'&&validDate(g.from)&&(!g.until||(validDate(g.until)&&g.until>=g.from)))))&&(!h.goal||(validGoalTarget(h.goal.target,h.goal.maximum,h.kind)&&typeof h.goal.maximum==='boolean'&&validDate(h.goal.from))))||new Set(data.habits.map(h=>h.id)).size!==data.habits.length))return false;
  if(data.startedOn!==undefined&&!validDate(data.startedOn))return false;
  return data.version === 1 && !!data.entries && typeof data.entries === "object" && !Array.isArray(data.entries) &&
    Object.entries(data.entries).every(([day, entries]) => validDate(day) && entries && typeof entries === "object" && !Array.isArray(entries) && Object.entries(entries).every(([id, entry]) => validEntry(id, entry,habits)));
}
export function setMappingEntry(data: MappingData, day: string, id: HabitId, entry?: MappingEntry): MappingData {
  if (!validDate(day) || !getHabits(data).some(h => h.id === id) || (entry && !validEntry(id, entry,getHabits(data)))) throw Error("That mapping entry is not valid.");
  const entries = { ...data.entries };
  const row = { ...entries[day] };
  if (entry) row[id] = entry;
  else delete row[id];
  if (Object.keys(row).length) entries[day] = row;
  else delete entries[day];
  return { ...data,version: 1, entries };
}
/** Keep completed legacy sessions as daily check-offs without retaining their timing. */
export function normalizeDailyChecks(data: MappingData): MappingData {
  const entries = Object.fromEntries(Object.entries(data.entries).map(([day,row]) => [day, Object.fromEntries(Object.entries(row).map(([id,entry]) => [id, !data.habits && isDailyCheckMetric(id) && entry?.kind === "duration" ? {kind:"check" as const} : entry]))]));
  return { ...data, entries };
}
/** Shared source for future Progress charts; sleep series stay separate, in minutes. */
export function mappingProgress(data: MappingData, from: string, through: string) {
  return Object.entries(data.entries).filter(([day]) => day >= from && day <= through).sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => {
    const durationMinutes: Partial<Record<HabitId, number>> = {};
    for (const [id, e] of Object.entries(entries)) if (!isDailyCheckMetric(id) && (e?.kind === "duration" || (e?.kind === "phone" && e.minutes !== undefined))) durationMinutes[id as HabitId] = e.minutes;
    const sleep = entries.sleep;
    return {
      date,
      marked: Object.keys(entries) as HabitId[],
      durationMinutes,
      phoneUse: { minutes: entries["screen-time"]?.kind === "duration" || entries["screen-time"]?.kind === "phone" ? entries["screen-time"].minutes : undefined, pickups: entries["screen-time"]?.kind === "phone" ? entries["screen-time"].pickups : undefined },
      prayers: entries.praying?.kind === "prayer" ? entries.praying.count : 0,
      sleep: { nightMinutes: sleep?.kind === "sleep" ? sleep.nightMinutes : 0, dayMinutes: sleep?.kind === "sleep" ? sleep.dayMinutes : 0 },
    };
  });
}
export function entryDescription(entry: MappingEntry, habit?:Habit) {
  if (entry.kind === "check") return entry.source === "checkly" ? "Completed in Check" : "Marked";
  if (entry.kind === "phone") return [entry.minutes !== undefined ? `Screen time ${Math.floor(entry.minutes / 60)}h ${entry.minutes % 60}m` : "", entry.pickups !== undefined ? `${entry.pickups} pickups` : ""].filter(Boolean).join(" · ");
  if (entry.kind === "prayer") return `${entry.count} ${habit&&habit.id!=="praying"?(entry.count===1?"time":"times"):entry.count === 1 ? "prayer" : "prayers"}`;
  const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  if (entry.kind === "sleep") return `Night ${duration(entry.nightMinutes)}, daytime ${duration(entry.dayMinutes)}`;
  return duration(entry.minutes);
}
