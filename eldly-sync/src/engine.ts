import type { WeeklyGoalPlan } from "./goals";
import { emptyMapping, setMappingEntry, type MappingData } from "./mapping";
import {
  CHECKLIST_RULES,
  CHECKLIST_START_WEEK,
  IMPORTANT_DATES,
  type ChecklistRule,
} from "./checklist";
export type Day = string;
export interface Task {
  id: string;
  title: string;
  scheduled: Day;
  original: Day;
  category: string;
  notes: string;
  due?: Day;
  carry: boolean;
  important: boolean;
  completed?: Day;
  routineId?: string;
  deadline?: boolean;
  sample?: boolean;
  order: number;
  deleted?: boolean;
}
export interface Routine {
  id: string;
  title: string;
  category: string;
  notes: string;
  start: Day;
  end?: Day;
  weekdays: number[];
  frequency: "weekly" | "daily" | "odd" | "even" | "interval" | "weeks";
  schoolWeeks?: number[];
  dueOffsetDays?: number;
  interval: number;
  paused: boolean;
  pausedFrom?: Day;
  skipped?: { from: Day; to: Day }[];
  carry: boolean;
  important: boolean;
  sample?: boolean;
}
export interface Data {
  recapSeen?: Record<string, true>;
  goalPlans?: WeeklyGoalPlan[];
  personalRoutinesVersion?: 1;
  mapping?: MappingData;
  version: 1;
  tasks: Task[];
  routines: Routine[];
  overrides: Record<string, Task>;
  categories: string[];
  sampleLoaded: boolean;
  sound: boolean;
  soundDesignVersion?: 1;
}
export const localDay = (d = new Date()): Day =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parse = (s: Day) =>
  new Date(
    Number(s.slice(0, 4)),
    Number(s.slice(5, 7)) - 1,
    Number(s.slice(8, 10)),
    12,
  );
export const add = (s: Day, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return localDay(d);
};
export const diff = (a: Day, b: Day) =>
  Math.round(
    (Date.UTC(parse(a).getFullYear(), parse(a).getMonth(), parse(a).getDate()) -
      Date.UTC(
        parse(b).getFullYear(),
        parse(b).getMonth(),
        parse(b).getDate(),
      )) /
      86400000,
  );
export const monday = (s: Day) => add(s, -((parse(s).getDay() + 6) % 7));
export function iso(s: Day) {
  const t = add(monday(s), 3);
  const y = parse(t).getFullYear();
  return {
    year: y,
    week: 1 + Math.round(diff(monday(t), monday(`${y}-01-04`)) / 7),
  };
}
// Change these two values when a new school term begins.
export const SCHOOL_WEEK_REFERENCE_MONDAY: Day = "2026-10-12";
export const SCHOOL_WEEK_REFERENCE_NUMBER = 8;
export function schoolWeek(day: Day): number {
  return (
    SCHOOL_WEEK_REFERENCE_NUMBER +
    Math.floor(diff(monday(day), SCHOOL_WEEK_REFERENCE_MONDAY) / 7)
  );
}
export function schoolDay(week: number, weekday: number): Day {
  return add(
    SCHOOL_WEEK_REFERENCE_MONDAY,
    (week - SCHOOL_WEEK_REFERENCE_NUMBER) * 7 + weekday,
  );
}
export function parseSchoolWeeks(raw: string): number[] | null {
  if (!/^\s*\d+(?:\s*,\s*\d+)*\s*$/.test(raw)) return null;
  const weeks = [...new Set(raw.split(",").map((x) => Number(x.trim())))].sort(
    (a, b) => a - b,
  );
  return weeks.every((w) => Number.isInteger(w) && w >= 1 && w <= 104)
    ? weeks
    : null;
}
export function routineSuffix(r: Routine): string {
  if (r.frequency === "daily") return "";
  if (r.frequency === "odd") return " (odd weeks)";
  if (r.frequency === "even") return " (even weeks)";
  if (r.frequency === "weeks")
    return ` (weeks ${(r.schoolWeeks || []).join(", ")})`;
  if (r.frequency === "interval" && r.interval > 1)
    return ` (every ${r.interval} weeks)`;
  return " (W)";
}
export const format = (
  s: Day,
  opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" },
) => parse(s).toLocaleDateString("en-US", opts);
export const uid = () => crypto.randomUUID();
export const empty = (): Data => ({
  version: 1,
  tasks: [],
  routines: [],
  overrides: {},
  categories: ["CS342", "CS361", "CS362", "BIOS120", "Personal", "Other"],
  sampleLoaded: false,
  sound: true,
  soundDesignVersion: 1,
});
export function matches(r: Routine, d: Day) {
  if (
    d < r.start ||
    (r.end && d > r.end) ||
    r.skipped?.some((s) => d >= s.from && d <= s.to) ||
    (r.paused && d >= (r.pausedFrom || r.start))
  )
    return false;
  const w = Math.abs(schoolWeek(d));
  if (r.frequency === "daily") return true;
  if (!r.weekdays.includes((parse(d).getDay() + 6) % 7)) return false;
  return r.frequency === "weeks"
    ? (r.schoolWeeks || []).includes(schoolWeek(d))
    : r.frequency === "odd"
      ? w % 2 === 1
      : r.frequency === "even"
        ? w % 2 === 0
        : r.frequency === "interval"
          ? Math.floor(diff(monday(d), monday(r.start)) / 7) % r.interval === 0
          : true;
}
export function allTasks(data: Data, through: Day, today: Day): Task[] {
  const result = [...data.tasks];
  for (const r of data.routines) {
    for (let d = r.start; d <= through; d = add(d, 1)) {
      const id = `${r.id}:${d}`;
      const override = data.overrides[id];
      if (override) {
        result.push(override);
        continue;
      }
      if (!matches(r, d)) continue;
      result.push({
        id,
        title: r.title,
        category: r.category,
        notes: r.notes,
        scheduled: d,
        original: d,
        due:
          r.dueOffsetDays === undefined ? undefined : add(d, r.dueOffsetDays),
        carry: r.carry,
        important: r.important,
        routineId: r.id,
        order: 0,
        sample: r.sample,
      });
    }
  }
  // An occurrence can be dragged before its original recurrence date.
  const seen = new Set(result.map(task => task.id));
  for (const override of Object.values(data.overrides)) {
    if (!seen.has(override.id) && (override.scheduled <= through || (override.completed && override.completed <= through))) result.push(override);
  }
  return result.filter((t) => !t.deleted);
}
export function visibleDate(t: Task, today: Day) {
  return t.completed || (t.carry && t.scheduled < today ? today : t.scheduled);
}
export const onDay = (data: Data, day: Day, today: Day) =>
  allTasks(data, day > today ? day : today, today)
    .filter((t) => t.scheduled === day || visibleDate(t, today) === day)
    .sort((a, b) => a.order - b.order || a.original.localeCompare(b.original));
export function weekTasks(data: Data, start: Day, today: Day) {
  const days = new Set(Array.from({ length: 7 }, (_, i) => add(start, i)));
  return allTasks(
    data,
    add(start, 6) > today ? add(start, 6) : today,
    today,
  ).filter((t) => days.has(t.scheduled) || days.has(visibleDate(t, today)));
}
/** Open deadlines are reminders of the same records used by the daily checklist. */
export function importantDates(data: Data): Task[] {
  const records = new Map([...data.tasks, ...Object.values(data.overrides)].map((t) => [t.id, t]));
  return [...records.values()]
    .filter((t) => t.deadline && t.due && !t.deleted && !t.completed)
    .sort((a, b) => a.due!.localeCompare(b.due!) || a.title.localeCompare(b.title));
}
export function saveTask(data: Data, t: Task): Data {
  return t.routineId && !data.tasks.some((task) => task.id === t.id)
    ? { ...data, overrides: { ...data.overrides, [t.id]: t } }
    : { ...data, tasks: [...data.tasks.filter((x) => x.id !== t.id), t] };
}
export function seed(data: Data, _today: Day): Data {
  if (data.sampleLoaded) return data;
  const routines: Routine[] = [],
    tasks: Task[] = [];
  for (const [order, rule] of CHECKLIST_RULES.entries()) {
    const start = schoolDay(CHECKLIST_START_WEEK, rule.weekday);
    const base = {
      title: rule.title,
      category: rule.category,
      notes: rule.notes || "",
      carry: true,
      important: !!rule.deadline,
      sample: true,
    };
    if (rule.frequency === "once") {
      tasks.push({
        ...base,
        id: `notes-task:${rule.key}`,
        scheduled: start,
        original: start,
        due: rule.due,
        deadline: rule.deadline,
        order,
      });
    } else {
      routines.push({
        ...base,
        id: `notes-routine:${rule.key}`,
        start: schoolDay(CHECKLIST_START_WEEK, 0),
        weekdays: [rule.weekday],
        frequency: rule.frequency,
        schoolWeeks: rule.schoolWeeks ? [...rule.schoolWeeks] : undefined,
        dueOffsetDays: rule.dueOffsetDays,
        interval: 1,
        paused: false,
      });
    }
  }
  for (const item of IMPORTANT_DATES) {
    tasks.push({
      id: `notes-date:${item.key}`,
      title: item.title,
      category: item.category,
      notes: "",
      scheduled: item.due,
      original: item.due,
      due: item.due,
      deadline: true,
      carry: true,
      important: true,
      sample: true,
      order: tasks.length,
    });
  }
  const existingTasks = new Set(data.tasks.map((t) => t.id)),
    existingRoutines = new Set(data.routines.map((r) => r.id));
  return {
    ...data,
    tasks: [...data.tasks, ...tasks.filter((t) => !existingTasks.has(t.id))],
    routines: [
      ...data.routines,
      ...routines.filter((r) => !existingRoutines.has(r.id)),
    ],
    sampleLoaded: true,
  };
}

function presetRule(task: Task): ChecklistRule | undefined {
  const normalized = (title: string) =>
    parseWeeklyTitle(title).title.toLowerCase().replace(/\s+/g, " ").trim();
  const title = normalized(task.title),
    weekday = (parse(task.original).getDay() + 6) % 7;
  return CHECKLIST_RULES.find(
    (r) =>
      [r.title, ...(r.aliases || [])].some(
        (alias) => normalized(alias) === title,
      ) &&
      (r.weekday === weekday ||
        (r.key === "project-342-part1" && task.due === "2026-10-18")),
  );
}
/** Explicitly replace old starter guesses, preserving user tasks and completion history. */
export function replaceStarterChecklist(data: Data, today: Day): Data {
  const saved = [...data.tasks, ...Object.values(data.overrides)]
    .filter((t) => t.sample)
    .sort(
      (a, b) =>
        Number(!!b.completed) - Number(!!a.completed) ||
        Number(!!a.deleted) - Number(!!b.deleted),
    );
  let next = seed(
    {
      ...data,
      tasks: data.tasks.filter((t) => !t.sample),
      routines: data.routines.filter((r) => !r.sample),
      overrides: Object.fromEntries(
        Object.entries(data.overrides).filter(([, t]) => !t.sample),
      ),
      sampleLoaded: false,
    },
    today,
  );
  const freshTasks = new Map(
    next.tasks.filter((t) => t.sample).map((t) => [t.id, t]),
  );
  const handledOnce = new Set<string>();
  for (const original of saved) {
    const rule = presetRule(original);
    const routine =
      rule && next.routines.find((r) => r.id === `notes-routine:${rule.key}`);
    const fixedAssignment =
      rule && ["project-342-part1", "demo-lab5", "laptop"].includes(rule.key);
    const sameOnceDate =
      rule?.frequency === "once" &&
      (fixedAssignment ||
        original.original === schoolDay(CHECKLIST_START_WEEK, rule.weekday));
    const target = sameOnceDate
      ? freshTasks.get(`notes-task:${rule!.key}`)
      : !rule
        ? [...freshTasks.values()].find(
            (t) =>
              t.deadline &&
              t.title === original.title &&
              t.due === original.due,
          )
        : undefined;
    const matchesRule = !!routine && matches(routine, original.original);
    const explicit = Object.prototype.hasOwnProperty.call(
      data.overrides,
      original.id,
    );
    const unknownCustom = !rule && !target;
    if (
      !original.completed &&
      !target &&
      !matchesRule &&
      !explicit &&
      !unknownCustom
    )
      continue;
    if (target && handledOnce.has(target.id)) {
      if (original.completed && !next.tasks.some((t) => t.id === original.id))
        next = {
          ...next,
          tasks: [
            ...next.tasks,
            { ...original, deleted: true, sample: false, routineId: undefined },
          ],
        };
      continue;
    }
    const completedElsewhere =
      target &&
      next.tasks.find(
        (t) =>
          t.completed &&
          t.id !== original.id &&
          (rule
            ? presetRule(t)?.key === rule.key
            : t.title === original.title && t.due === original.due),
      );
    if (completedElsewhere && target) {
      next = {
        ...next,
        tasks: [
          ...next.tasks.filter((t) => t.id !== target.id),
          { ...target, deleted: true, sample: false },
        ],
      };
      handledOnce.add(target.id);
      continue;
    }
    const preserved: Task = {
      ...original,
      title: original.completed
        ? original.title
        : rule?.title || original.title,
      routineId: !original.completed && matchesRule ? routine!.id : undefined,
      sample: !original.completed && (!!target || matchesRule),
    };
    if (!original.completed) {
      if (target?.due) preserved.due = target.due;
      else if (routine?.dueOffsetDays !== undefined)
        preserved.due = add(original.original, routine.dueOffsetDays);
      if (target?.deadline) preserved.deadline = true;
      // Correct the old duplicate deadline's work date, while retaining its recorded original date.
      if (
        rule?.key === "project-342-part1" &&
        target &&
        original.scheduled === original.due
      )
        preserved.scheduled = target.scheduled;
    }
    if (target) {
      handledOnce.add(target.id);
      next = { ...next, tasks: next.tasks.filter((t) => t.id !== target.id) };
      if (target.id !== preserved.id)
        next.tasks.push({
          ...target,
          deleted: true,
          sample: !original.completed,
        });
    }
    next = {
      ...next,
      tasks: [...next.tasks.filter((t) => t.id !== preserved.id), preserved],
    };
    if (matchesRule) {
      const id = `${routine!.id}:${original.original}`;
      next = {
        ...next,
        overrides: {
          ...next.overrides,
          [id]: {
            ...preserved,
            id,
            scheduled: original.original,
            deleted: true,
            sample: !original.completed,
          },
        },
      };
    }
  }
  return next;
}

export function setPaused(r: Routine, paused: boolean, today: Day): Routine {
  if (paused === r.paused) return r;
  const skipped = [...(r.skipped || [])];
  if (!paused && r.pausedFrom && r.pausedFrom < today) {
    skipped.push({ from: r.pausedFrom, to: add(today, -1) });
  }
  return { ...r, paused, pausedFrom: paused ? today : undefined, skipped };
}

/** Historical summaries include scheduled tasks even after they move to a later week. */
export function weekReportTasks(data: Data, start: Day, today: Day): Task[] {
  const end = add(start, 6);
  return allTasks(data, end > today ? end : today, today).filter(
    (t) =>
      (t.scheduled >= start && t.scheduled <= end) ||
      (t.completed && t.completed >= start && t.completed <= end) ||
      (t.carry &&
        t.scheduled < start &&
        (t.completed ? t.completed >= start : today >= start)),
  );
}

/** A trailing weekly shorthand is case- and whitespace-insensitive. */
export function parseWeeklyTitle(raw: string): {
  title: string;
  weekly: boolean;
} {
  const suffix = /(?:\(\s*w\s*\)\s*)+$/i;
  const trimmed = raw.trim();
  return {
    title: trimmed.replace(suffix, "").trim(),
    weekly: suffix.test(trimmed),
  };
}

/** Convert once without replacing the original task ID or its history. */
export function saveTaskInput(data: Data, task: Task): Data {
  if (task.deleted) return saveTask(data, task);
  const parsed = parseWeeklyTitle(task.title);
  if (!parsed.title) return data;
  const clean = { ...task, title: parsed.title };
  if (!parsed.weekly) return saveTask(data, clean);
  const parent = data.routines.find((r) => r.id === task.routineId);
  const weekday = (parse(task.scheduled).getDay() + 6) % 7;
  if (
    parent &&
    parent.frequency === "weekly" &&
    parent.interval === 1 &&
    parent.weekdays.includes(weekday) &&
    parent.title === parsed.title
  ) {
    return saveTask(data, clean);
  }
  // Derive the schedule ID from the occurrence so repeated imports/refreshes cannot duplicate it.
  const id = `weekly:${task.id}`;
  const converted = { ...clean, routineId: id };
  const routine: Routine = {
    id,
    title: parsed.title,
    category: task.category,
    notes: task.notes,
    start: task.scheduled,
    weekdays: [weekday],
    frequency: "weekly",
    dueOffsetDays: task.due ? diff(task.due, task.scheduled) : undefined,
    interval: 1,
    paused: false,
    carry: task.carry,
    important: task.important,
    sample: task.sample,
  };
  const overrides = { ...data.overrides };
  if (parent && !data.tasks.some((t) => t.id === task.id))
    overrides[task.id] = { ...task, deleted: true };
  // The original record supplies this occurrence; suppress its generated twin.
  const generatedId = `${id}:${task.scheduled}`;
  overrides[generatedId] = { ...converted, id: generatedId, deleted: true };
  return {
    ...data,
    tasks: [...data.tasks.filter((t) => t.id !== task.id), converted],
    routines: [
      ...data.routines
        .filter((r) => r.id !== id)
        .map((r) => {
          if (r.id !== parent?.id) return r;
          const end = add(task.scheduled, -1);
          return { ...r, end: r.end && r.end < end ? r.end : end };
        }),
      routine,
    ],
    overrides,
  };
}

/** Also recognize shorthand already saved in the browser or imported in a backup. */
export function normalizeWeeklyMarkers(data: Data): Data {
  let next = data;
  for (const r of data.routines) {
    const parsed = parseWeeklyTitle(r.title);
    if (parsed.weekly && parsed.title)
      next = {
        ...next,
        routines: next.routines.map((x) =>
          x.id === r.id
            ? { ...x, title: parsed.title, frequency: "weekly", interval: 1 }
            : x,
        ),
      };
  }
  for (const t of [...data.tasks, ...Object.values(data.overrides)]) {
    if (!t.deleted && parseWeeklyTitle(t.title).weekly)
      next = saveTaskInput(next, t);
  }
  return next;
}

/** Link Checkly's real daily completion to Mapping without retroactively rewarding late work. */
export function syncChecklyHomework(data: Data, today: Day): Data {
  const groups = new Map<Day, Task[]>();
  for (const task of allTasks(data, today, today)) {
    for (const day of new Set([task.scheduled, visibleDate(task, today)])) {
      if (day > today) continue;
      const group = groups.get(day) || [];
      group.push(task);
      groups.set(day, group);
    }
  }
  let mapping = data.mapping || emptyMapping();
  const days = new Set([...groups.keys(), ...Object.keys(mapping.entries)]);
  for (const day of days) {
    const current = mapping.entries[day]?.homework;
    const automatic = current?.kind === "check" && current.source === "checkly";
    const tasks = groups.get(day) || [];
    const finished = day <= today && tasks.length > 0 && tasks.every(t => !!t.completed && t.completed <= day);
    if (finished && !current) mapping = setMappingEntry(mapping, day, "homework", { kind: "check", source: "checkly" });
    else if (!finished && automatic) mapping = setMappingEntry(mapping, day, "homework");
  }
  return mapping === data.mapping || (!data.mapping && !Object.keys(mapping.entries).length) ? data : { ...data, mapping };
}
