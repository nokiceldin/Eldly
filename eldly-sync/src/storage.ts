import { addRequestedRoutines } from "./personalRoutines";
import { GOALS } from "./goals";
import { writeLocal } from "./sync/local";
import { normalizeDailyChecks, validateMapping } from "./mapping";
import { empty, localDay, syncChecklyHomework, type Data } from "./engine";
const KEY = "checkly-data-v1";
const date = (x: unknown) =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !isNaN(new Date(x + "T12:00:00").getTime()) &&
  localDay(new Date(x + "T12:00:00")) === x;
export function validate(x: unknown): x is Data {
  if (!x || typeof x !== "object") return false;
  const d = x as Data;
  const task = (t: any) =>
    t &&
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    date(t.scheduled) &&
    date(t.original) &&
    typeof t.category === "string" &&
    typeof t.notes === "string" &&
    typeof t.carry === "boolean" &&
    typeof t.important === "boolean" &&
    Number.isFinite(t.order) &&
    (!t.routineId || typeof t.routineId === "string") &&
    (t.deleted === undefined || typeof t.deleted === "boolean") &&
    (t.deadline === undefined ||
      (typeof t.deadline === "boolean" && (!t.deadline || date(t.due)))) &&
    (!t.due || date(t.due)) &&
    (!t.completed || date(t.completed));
  return (
    d.version === 1 &&
    (d.mapping === undefined || validateMapping(d.mapping)) &&
    Array.isArray(d.tasks) &&
    d.tasks.every(task) &&
    Array.isArray(d.routines) &&
    d.routines.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        (!r.pausedFrom || date(r.pausedFrom)) &&
        (!r.skipped ||
          (Array.isArray(r.skipped) &&
            r.skipped.every(
              (s) => s && date(s.from) && date(s.to) && s.from <= s.to,
            ))) &&
        typeof r.title === "string" &&
        typeof r.category === "string" &&
        typeof r.notes === "string" &&
        date(r.start) &&
        (!r.end || date(r.end)) &&
        Array.isArray(r.weekdays) &&
        r.weekdays.every((w) => Number.isInteger(w) && w >= 0 && w < 7) &&
        ["weekly", "daily", "odd", "even", "interval", "weeks"].includes(
          r.frequency,
        ) &&
        (r.frequency !== "weeks" ||
          (Array.isArray(r.schoolWeeks) && r.schoolWeeks.length > 0)) &&
        (r.schoolWeeks === undefined ||
          (Array.isArray(r.schoolWeeks) &&
            r.schoolWeeks.every(
              (w) => Number.isInteger(w) && w >= 1 && w <= 104,
            ))) &&
        (r.dueOffsetDays === undefined ||
          (Number.isInteger(r.dueOffsetDays) &&
            r.dueOffsetDays >= -14 &&
            r.dueOffsetDays <= 365)) &&
        Number.isInteger(r.interval) &&
        r.interval > 0 &&
        typeof r.paused === "boolean" &&
        typeof r.carry === "boolean" &&
        typeof r.important === "boolean",
    ) &&
    !!d.overrides &&
    typeof d.overrides === "object" &&
    !Array.isArray(d.overrides) &&
    Object.entries(d.overrides).every(([id, t]) => task(t) && id === t.id) &&
    new Set(d.tasks.map((t) => t.id)).size === d.tasks.length &&
    new Set(d.routines.map((r) => r.id)).size === d.routines.length &&
    Array.isArray(d.categories) &&
    d.categories.every((c) => typeof c === "string") &&
    typeof d.sampleLoaded === "boolean" &&
    typeof d.sound === "boolean" &&
    (d.personalRoutinesVersion === undefined || d.personalRoutinesVersion === 1) &&
    (d.goalPlans === undefined || (Array.isArray(d.goalPlans) && d.goalPlans.every(p => p && typeof p.id === "string" && date(p.from) && p.targets && GOALS.every(g => typeof p.targets[g.id] === "number" && Number.isFinite(p.targets[g.id]) && p.targets[g.id] >= 0)))) &&
    (d.recapSeen === undefined || (!!d.recapSeen && typeof d.recapSeen === "object" && !Array.isArray(d.recapSeen) && Object.entries(d.recapSeen).every(([key, seen]) => /^(week|month|year):\d{4}-\d{2}-\d{2}$/.test(key) && seen === true))) &&
    (d.soundDesignVersion === undefined || d.soundDesignVersion === 1)
  );
}
export function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return addRequestedRoutines(empty());
    const d = JSON.parse(raw);
    if (!validate(d))
      throw Error(
        "Saved data is not compatible. Export or restore a valid backup.",
      );
    if (d.mapping) d.mapping = normalizeDailyChecks(d.mapping);
    return addRequestedRoutines(syncChecklyHomework(d.soundDesignVersion === 1 ? d : { ...d, sound: true, soundDesignVersion: 1 }, localDay()));
  } catch (e) {
    throw e;
  }
}
export const persist = (d: Data) =>
  writeLocal(KEY, syncChecklyHomework(d.mapping ? { ...d, mapping: normalizeDailyChecks(d.mapping) } : d, localDay()));
export function download(d: Data) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(syncChecklyHomework(d, localDay()), null, 2)], { type: "application/json" }),
  );
  a.download = "eldly-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
