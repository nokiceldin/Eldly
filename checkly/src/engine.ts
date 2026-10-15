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
  frequency: "weekly" | "daily" | "odd" | "even" | "interval";
  interval: number;
  paused: boolean;
  pausedFrom?: Day;
  skipped?: { from: Day; to: Day }[];
  carry: boolean;
  important: boolean;
  sample?: boolean;
}
export interface Data {
  version: 1;
  tasks: Task[];
  routines: Routine[];
  overrides: Record<string, Task>;
  categories: string[];
  sampleLoaded: boolean;
  sound: boolean;
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
  sound: false,
});
export function matches(r: Routine, d: Day) {
  if (
    d < r.start ||
    (r.end && d > r.end) ||
    r.skipped?.some((s) => d >= s.from && d <= s.to) ||
    (r.paused && d >= (r.pausedFrom || r.start))
  )
    return false;
  const w = iso(d).week;
  if (r.frequency === "daily") return true;
  if (!r.weekdays.includes((parse(d).getDay() + 6) % 7)) return false;
  return r.frequency === "odd"
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
        carry: r.carry,
        important: r.important,
        routineId: r.id,
        order: 0,
        sample: r.sample,
      });
    }
  }
  return result.filter((t) => !t.deleted);
}
export function visibleDate(t: Task, today: Day) {
  return t.completed || (t.carry && t.scheduled < today ? today : t.scheduled);
}
export const onDay = (data: Data, day: Day, today: Day) =>
  allTasks(data, day > today ? day : today, today)
    .filter((t) => visibleDate(t, today) === day)
    .sort((a, b) => a.order - b.order || a.original.localeCompare(b.original));
export function weekTasks(data: Data, start: Day, today: Day) {
  const days = new Set(Array.from({ length: 7 }, (_, i) => add(start, i)));
  return allTasks(
    data,
    add(start, 6) > today ? add(start, 6) : today,
    today,
  ).filter((t) => days.has(visibleDate(t, today)));
}
export function saveTask(data: Data, t: Task): Data {
  return t.routineId
    ? { ...data, overrides: { ...data.overrides, [t.id]: t } }
    : { ...data, tasks: [...data.tasks.filter((x) => x.id !== t.id), t] };
}
export function seed(data: Data, today: Day): Data {
  if (data.sampleLoaded) return data;
  const start = monday(today);
  const routines: Routine[] = [];
  const tasks: Task[] = [];
  const groups = [
    ["Prepare for CS361 quiz"],
    [
      "CS361 quiz",
      "CS342 lecture",
      "CS342 homework",
      "CS342 project work",
      "CS362 Lab",
      "SA",
    ],
    ["Prepare for CS362 quiz", "Dator", "CS361 lab and send email"],
    [
      "CS362 quiz",
      "Check CS362 milestone after quiz",
      "Check CS342 homework deadline",
    ],
    [
      "Work on CS362 lab",
      "Review CS361 lectures with ChatGPT",
      "CS342 lecture",
    ],
    ["Work on CS362 homework"],
    ["Check grades in all classes"],
  ];
  groups.forEach((titles, i) =>
    titles.forEach((title) =>
      routines.push({
        id: uid(),
        title,
        category: title.match(/CS\d+/)?.[0] || "Personal",
        notes: "Starter schedule — edit to match your classes.",
        start,
        weekdays: [i],
        frequency: /quiz/.test(title) ? "odd" : "weekly",
        interval: 1,
        paused: false,
        carry: true,
        important: false,
        sample: true,
      }),
    ),
  );
  [
    ["Demo Lab 5", add(start, 2), "CS362"],
    ["Laptop pickup", add(start, 6), "Personal"],
    ["CS361 homework reminder", start, "CS361"],
    ...[4, 7, 10].map((w) => [
      "Prepare for CS342 quiz",
      add(monday(`${parse(today).getFullYear() + 1}-01-04`), (w - 1) * 7 + 2),
      "CS342",
    ]),
  ].forEach(([title, scheduled, category]) =>
    tasks.push({
      id: uid(),
      title,
      scheduled,
      original: scheduled,
      category,
      notes: "Editable starter example",
      carry: true,
      important: false,
      order: tasks.length,
      sample: true,
    }),
  );
  const deadlines = [
    ["2026-10-18", "CS342 Project 2 Part 1", "CS342"],
    ["2026-10-23", "BIOS120 Evolutionary Medicine", "BIOS120"],
    ["2026-10-25", "Project Part 2 · course to confirm", "Other"],
    ["2026-10-26", "CS362 Milestone Design Presentation", "CS362"],
    ["2026-10-28", "BIOS120 Midterm 2", "BIOS120"],
    ["2026-11-06", "BIOS120 Paper", "BIOS120"],
    ["2026-11-09", "BIOS120 Group Project", "BIOS120"],
    ["2026-11-11", "CS362 Lab 7 Report", "CS362"],
    ["2026-11-20", "BIOS120 Assignment", "BIOS120"],
    ["2026-11-23", "CS362 Milestone Presentation", "CS362"],
    ["2026-12-03", "BIOS120 Midterm 3", "BIOS120"],
  ];
  deadlines.forEach(([due, title, category]) =>
    tasks.push({
      id: uid(),
      title,
      scheduled: due,
      original: due,
      due,
      category,
      notes: "",
      carry: true,
      important: true,
      deadline: true,
      sample: true,
      order: tasks.length,
    }),
  );
  return {
    ...data,
    routines: [...data.routines, ...routines],
    tasks: [...data.tasks, ...tasks],
    sampleLoaded: true,
  };
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
