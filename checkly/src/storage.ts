import { empty, localDay, type Data } from "./engine";
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
        ["weekly", "daily", "odd", "even", "interval"].includes(r.frequency) &&
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
    typeof d.sound === "boolean"
  );
}
export function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    if (!validate(d))
      throw Error(
        "Saved data is not compatible. Export or restore a valid backup.",
      );
    return d;
  } catch (e) {
    throw e;
  }
}
export const persist = (d: Data) =>
  localStorage.setItem(KEY, JSON.stringify(d));
export function download(d: Data) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }),
  );
  a.download = "checkly-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
