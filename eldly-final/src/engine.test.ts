import { describe, it, expect } from "vitest";
import {
  empty,
  setPaused,
  add,
  diff,
  iso,
  schoolWeek,
  schoolDay,
  parseSchoolWeeks,
  routineSuffix,
  replaceStarterChecklist,
  seed,
  parseWeeklyTitle,
  saveTaskInput,
  normalizeWeeklyMarkers,
  monday,
  matches,
  onDay,
  importantDates,
  weekTasks,
  weekReportTasks,
  saveTask,
  allTasks,
  type Task,
  type Routine,
} from "./engine";
import { validate } from "./storage";
const task = (extra: Partial<Task> = {}): Task => ({
  id: "one",
  title: "Homework",
  category: "CS342",
  notes: "",
  scheduled: "2026-10-11",
  original: "2026-10-11",
  carry: true,
  important: false,
  order: 0,
  ...extra,
});
const routine = (extra: Partial<Routine> = {}): Routine => ({
  id: "routine",
  title: "Quiz",
  category: "CS361",
  notes: "",
  start: "2026-10-05",
  weekdays: [0],
  frequency: "weekly",
  interval: 1,
  paused: false,
  carry: true,
  important: false,
  ...extra,
});
describe("local calendar and ISO weeks", () => {
  it("handles ISO year transitions", () => {
    expect(iso("2021-01-01")).toEqual({ year: 2020, week: 53 });
    expect(iso("2024-12-30")).toEqual({ year: 2025, week: 1 });
    expect(monday("2027-01-01")).toBe("2026-12-28");
  });
  it("uses calendar days over DST", () => {
    expect(add("2026-03-07", 2)).toBe("2026-03-09");
    expect(diff("2026-11-02", "2026-10-31")).toBe(2);
    expect(add("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("matches odd and even school weeks", () => {
    const odd = routine({
      start: "2026-08-24",
      weekdays: [0],
      frequency: "odd",
    });
    const even = { ...odd, frequency: "even" as const };
    expect(matches(odd, "2026-10-12")).toBe(false);
    expect(matches(even, "2026-10-12")).toBe(true);
    expect(matches(odd, "2026-10-19")).toBe(true);
    expect(matches(even, "2026-10-19")).toBe(false);
  });
  it("supports daily, specific days and anchored intervals", () => {
    expect(matches(routine({ frequency: "daily" }), "2026-10-07")).toBe(true);
    expect(matches(routine(), "2026-10-06")).toBe(false);
    expect(
      matches(routine({ frequency: "interval", interval: 2 }), "2026-10-12"),
    ).toBe(false);
    expect(
      matches(routine({ frequency: "interval", interval: 2 }), "2026-10-19"),
    ).toBe(true);
  });
});
describe("carryover identity and history", () => {
  it("carries Sunday to next Monday as one record", () => {
    const d = { ...empty(), tasks: [task()] };
    expect(onDay(d, "2026-10-12", "2026-10-12")).toHaveLength(1);
    expect(onDay(d, "2026-10-11", "2026-10-12")).toHaveLength(1);
    expect(onDay(d, "2026-10-12", "2026-10-12")[0].original).toBe("2026-10-11");
  });
  it("does not project current carryover into future weeks", () => {
    const d = { ...empty(), tasks: [task()] };
    expect(onDay(d, "2026-10-19", "2026-10-14")).toHaveLength(0);
    expect(onDay(d, "2026-10-14", "2026-10-14")).toHaveLength(1);
  });
  it("handles several days away without duplicates", () => {
    const d = { ...empty(), tasks: [task()] };
    expect(onDay(d, "2026-11-01", "2026-11-01")).toHaveLength(1);
    expect(weekTasks(d, "2026-10-26", "2026-11-01")).toHaveLength(1);
  });
  it("completes overdue tasks once and restores them on uncomplete", () => {
    let d = { ...empty(), tasks: [task()] };
    d = saveTask(d, { ...task(), completed: "2026-10-14" });
    expect(onDay(d, "2026-10-14", "2026-10-15")).toHaveLength(1);
    expect(onDay(d, "2026-10-15", "2026-10-15")).toHaveLength(0);
    d = saveTask(d, task());
    expect(onDay(d, "2026-10-15", "2026-10-15")).toHaveLength(1);
  });
  it("keeps recurrence independent with distinct overlapping occurrences", () => {
    const d = { ...empty(), routines: [routine()] };
    const list = onDay(d, "2026-10-13", "2026-10-13");
    expect(list).toHaveLength(2);
    expect(new Set(list.map((t) => t.id)).size).toBe(2);
    expect(onDay(d, "2026-10-19", "2026-10-13")).toHaveLength(1);
  });
  it("uses occurrence overrides without changing routine", () => {
    let d = { ...empty(), routines: [routine()] };
    const t = allTasks(d, "2026-10-12", "2026-10-12")[0];
    d = saveTask(d, { ...t, title: "Edited once", completed: "2026-10-12" });
    expect(
      allTasks(d, "2026-10-19", "2026-10-19").filter((t) => t.completed),
    ).toHaveLength(1);
    expect(d.routines[0].title).toBe("Quiz");
    expect(
      allTasks(d, "2026-10-19", "2026-10-19").find(
        (t) => t.original === "2026-10-19",
      )?.title,
    ).toBe("Quiz");
  });
  it("preserves original deadline and disabled carryover", () => {
    const d = {
      ...empty(),
      tasks: [task({ deadline: true, due: "2026-10-11" })],
    };
    expect(onDay(d, "2026-10-14", "2026-10-14")[0].due).toBe("2026-10-11");
    expect(
      onDay(
        { ...d, tasks: [task({ carry: false })] },
        "2026-10-14",
        "2026-10-14",
      ),
    ).toHaveLength(0);
  });
  it("reschedules without losing original date", () => {
    const d = { ...empty(), tasks: [task({ scheduled: "2026-10-20" })] };
    expect(onDay(d, "2026-10-14", "2026-10-14")).toHaveLength(0);
    expect(onDay(d, "2026-10-20", "2026-10-14")[0].original).toBe("2026-10-11");
  });
  it("pauses future occurrences while preserving old tasks", () => {
    const d = {
      ...empty(),
      routines: [routine({ paused: true, pausedFrom: "2026-10-13" })],
    };
    expect(
      allTasks(d, "2026-10-19", "2026-10-13").map((t) => t.original),
    ).toEqual(["2026-10-05", "2026-10-12"]);
  });
  it("keeps deleted routine history using an end boundary", () => {
    const d = { ...empty(), routines: [routine({ end: "2026-10-13" })] };
    expect(allTasks(d, "2026-10-19", "2026-10-13")).toHaveLength(2);
  });
  it("counts each occurrence once in a weekly summary", () => {
    const d = { ...empty(), tasks: [task()], routines: [routine()] };
    const w = weekTasks(d, "2026-10-12", "2026-10-14");
    expect(new Set(w.map((t) => t.id)).size).toBe(w.length);
  });
});
describe("backup validation", () => {
  it("accepts real data and rejects unsafe shapes", () => {
    expect(validate(empty())).toBe(true);
    expect(validate({ ...empty(), tasks: [{}] })).toBe(false);
    expect(validate({ ...empty(), version: 2 })).toBe(false);
    expect(validate({ ...empty(), routines: [routine({ interval: 0 })] })).toBe(
      false,
    );
  });
});

describe("pause history and restored state", () => {
  it("never backfills a paused range after resuming", () => {
    const r = routine({ skipped: [{ from: "2026-10-06", to: "2026-10-14" }] });
    expect(matches(r, "2026-10-12")).toBe(false);
    expect(matches(r, "2026-10-19")).toBe(true);
  });
  it("keeps paused days suppressed as the local date advances", () => {
    const d = {
      ...empty(),
      routines: [routine({ paused: true, pausedFrom: "2026-10-06" })],
    };
    expect(
      allTasks(d, "2026-10-26", "2026-10-26").map((t) => t.original),
    ).toEqual(["2026-10-05"]);
  });
  it("restores occurrence completion through a JSON round trip", () => {
    const d = { ...empty(), routines: [routine()] };
    const t = allTasks(d, "2026-10-12", "2026-10-12")[0];
    const restored = JSON.parse(
      JSON.stringify(saveTask(d, { ...t, completed: "2026-10-12" })),
    );
    expect(validate(restored)).toBe(true);
    expect(
      onDay(restored, "2026-10-12", "2026-10-14").filter((t) => t.completed),
    ).toHaveLength(1);
  });
  it("rejects impossible calendar dates and malformed pause ranges", () => {
    expect(
      validate({ ...empty(), tasks: [task({ scheduled: "2026-02-30" })] }),
    ).toBe(false);
    expect(
      validate({
        ...empty(),
        routines: [routine({ skipped: [{ from: "oops", to: "2026-10-14" }] })],
      }),
    ).toBe(false);
  });
});

describe("normal task persistence contract", () => {
  it("accepts the explicit non-deadline flag saved by the task editor", () => {
    const saved = JSON.parse(
      JSON.stringify({ ...empty(), tasks: [task({ deadline: false })] }),
    );
    expect(validate(saved)).toBe(true);
  });
  it("requires due dates only for actual deadlines", () => {
    expect(validate({ ...empty(), tasks: [task({ deadline: true })] })).toBe(
      false,
    );
    expect(
      validate({
        ...empty(),
        tasks: [task({ deadline: true, due: "2026-10-18" })],
      }),
    ).toBe(true);
  });
});

describe("pause and resume boundaries", () => {
  it("can resume on the same day without an invalid skipped range", () => {
    const paused = setPaused(routine(), true, "2026-10-12");
    const resumed = setPaused(paused, false, "2026-10-12");
    expect(resumed.skipped).toEqual([]);
    expect(matches(resumed, "2026-10-12")).toBe(true);
    expect(validate({ ...empty(), routines: [resumed] })).toBe(true);
  });
  it("resumes on today while excluding only earlier paused dates", () => {
    const resumed = setPaused(
      setPaused(routine(), true, "2026-10-06"),
      false,
      "2026-10-19",
    );
    expect(matches(resumed, "2026-10-12")).toBe(false);
    expect(matches(resumed, "2026-10-19")).toBe(true);
  });
});

describe("historical weekly summaries", () => {
  it("remembers an unfinished Sunday in its original week after carryover", () => {
    const d = { ...empty(), tasks: [task()] };
    expect(weekReportTasks(d, "2026-10-05", "2026-10-14")).toHaveLength(1);
    expect(weekReportTasks(d, "2026-10-12", "2026-10-14")).toHaveLength(1);
  });
  it("has one record per week despite scheduling and completing within it", () => {
    const d = {
      ...empty(),
      tasks: [task({ scheduled: "2026-10-12", completed: "2026-10-14" })],
    };
    expect(weekReportTasks(d, "2026-10-12", "2026-10-14")).toHaveLength(1);
    expect(weekReportTasks(d, "2026-10-19", "2026-10-20")).toHaveLength(0);
  });
});

describe("school-week defaults", () => {
  it("anchors October 12–18 to school week 8 and advances on Mondays", () => {
    expect(schoolWeek("2026-10-12")).toBe(8);
    expect(schoolWeek("2026-10-18")).toBe(8);
    expect(schoolWeek("2026-10-19")).toBe(9);
    expect(schoolWeek("2026-08-24")).toBe(1);
    expect(schoolWeek("2026-12-28")).toBe(19);
    expect(schoolWeek("2027-01-04")).toBe(20);
  });
  it("loads defaults once and schedules CS342 quiz examples in school weeks", () => {
    const d = seed(empty(), "2026-10-14");
    expect(d.routines.length).toBeGreaterThan(0);
    expect(seed(d, "2026-10-14")).toBe(d);
    const quiz = d.routines.find((r) => r.id === "notes-routine:prepare-342")!;
    expect(quiz.frequency).toBe("weeks");
    expect(quiz.schoolWeeks).toEqual([4, 7, 10]);
    expect(
      allTasks(d, "2026-11-01", "2026-10-14")
        .filter((t) => t.routineId === quiz.id)
        .map((t) => t.scheduled),
    ).toEqual(["2026-10-28"]);
  });
});

describe("weekly title shorthand", () => {
  it("recognizes trailing W with case/space variants and removes repeated markers", () => {
    for (const title of [
      "Homework (W)",
      "Homework(w)",
      "Homework ( w )  ",
      "Homework (W) (w)",
    ])
      expect(parseWeeklyTitle(title)).toEqual({
        title: "Homework",
        weekly: true,
      });
    expect(parseWeeklyTitle("Discuss (W) in class")).toEqual({
      title: "Discuss (W) in class",
      weekly: false,
    });
  });
  it("creates one first occurrence and a new occurrence next week", () => {
    const d = saveTaskInput(
      empty(),
      task({
        title: "Homework (W)",
        scheduled: "2026-10-14",
        original: "2026-10-14",
      }),
    );
    expect(d.routines).toHaveLength(1);
    expect(d.routines[0].weekdays).toEqual([2]);
    expect(onDay(d, "2026-10-14", "2026-10-14")).toHaveLength(1);
    expect(onDay(d, "2026-10-21", "2026-10-14")).toHaveLength(1);
    expect(onDay(d, "2026-10-22", "2026-10-14")).toHaveLength(0);
    expect(d.tasks[0].title).toBe("Homework");
    expect(validate(d)).toBe(true);
  });
  it("preserves original identity, completion, notes, category, due date and priority", () => {
    const original = task({
      title: "Homework(W)",
      completed: "2026-10-14",
      due: "2026-10-11",
      notes: "Keep notes",
      important: true,
      deadline: true,
    });
    const d = saveTaskInput({ ...empty(), tasks: [original] }, original);
    expect(d.tasks[0]).toMatchObject({
      ...original,
      title: "Homework",
      routineId: "weekly:one",
    });
    expect(onDay(d, "2026-10-14", "2026-10-15")).toHaveLength(1);
    expect(onDay(d, "2026-10-15", "2026-10-15")).toHaveLength(0);
  });
  it("keeps a converted task completed after refresh without a stale duplicate", () => {
    let d = saveTaskInput(empty(), task({ title: "Homework(W)" }));
    d = saveTask(d, { ...d.tasks[0], completed: "2026-10-14" });
    d = JSON.parse(JSON.stringify(d));
    expect(validate(d)).toBe(true);
    expect(onDay(d, "2026-10-14", "2026-10-15")).toHaveLength(1);
    expect(onDay(d, "2026-10-15", "2026-10-15")).toHaveLength(0);
    expect(d.overrides["weekly:one:2026-10-11"].deleted).toBe(true);
    d = saveTask(d, { ...d.tasks[0], completed: undefined });
    expect(onDay(d, "2026-10-15", "2026-10-15")).toHaveLength(1);
  });
  it("keeps the original scheduled weekday when converting a carried task", () => {
    const d = saveTaskInput(empty(), task({ title: "Sunday work (W)" }));
    expect(d.routines[0].weekdays).toEqual([6]);
    expect(onDay(d, "2026-10-14", "2026-10-14")).toHaveLength(1);
    expect(onDay(d, "2026-10-18", "2026-10-14")).toHaveLength(1);
  });
  it("does not duplicate existing weekly occurrences or repeated saves", () => {
    let d = saveTaskInput(empty(), task({ title: "Homework(W)" }));
    d = saveTaskInput(d, { ...d.tasks[0], title: "Homework(W)" });
    expect(d.routines).toHaveLength(1);
    expect(onDay(d, "2026-10-14", "2026-10-14")).toHaveLength(1);
    const occurrence = onDay(d, "2026-10-18", "2026-10-14")[0];
    d = saveTaskInput(d, { ...occurrence, title: "Homework (w)" });
    expect(d.routines).toHaveLength(1);
    expect(onDay(d, "2026-10-18", "2026-10-14")).toHaveLength(1);
  });
  it("changes a nonweekly occurrence to weekly without losing completed past history", () => {
    let d = { ...empty(), routines: [routine({ frequency: "daily" })] };
    const old = onDay(d, "2026-10-05", "2026-10-05")[0];
    d = saveTask(d, { ...old, completed: "2026-10-05" });
    const selected = onDay(d, "2026-10-07", "2026-10-07").find(
      (t) => t.scheduled === "2026-10-07",
    )!;
    d = saveTaskInput(d, { ...selected, title: "Quiz (W)" });
    expect(onDay(d, "2026-10-05", "2026-10-07")[0].completed).toBe(
      "2026-10-05",
    );
    expect(onDay(d, "2026-10-14", "2026-10-07")).toHaveLength(1);
    expect(onDay(d, "2026-10-15", "2026-10-07")).toHaveLength(0);
    expect(validate(d)).toBe(true);
  });
  it("migrates saved shorthand only once, and keeps deleted/blank titles out", () => {
    const original = { ...empty(), tasks: [task({ title: "Homework (W)" })] };
    const d = normalizeWeeklyMarkers(original);
    expect(normalizeWeeklyMarkers(d)).toBe(d);
    expect(d.routines).toHaveLength(1);
    expect(
      normalizeWeeklyMarkers({
        ...original,
        tasks: [task({ title: "Homework (W)", deleted: true })],
      }).routines,
    ).toHaveLength(0);
    expect(saveTaskInput(empty(), task({ title: " (W) " })).tasks).toHaveLength(
      0,
    );
  });
  it("deleting the first converted occurrence leaves the future schedule intact", () => {
    let d = saveTaskInput(empty(), task({ title: "Homework(W)" }));
    d = saveTask(d, { ...d.tasks[0], deleted: true });
    expect(onDay(d, "2026-10-14", "2026-10-14")).toHaveLength(0);
    expect(onDay(d, "2026-10-18", "2026-10-14")).toHaveLength(1);
  });
});

describe("exact Apple Notes schedule", () => {
  const notes = () => seed(empty(), "2026-10-14");
  const r = (key: string) =>
    notes().routines.find((r) => r.id === `notes-routine:${key}`)!;
  const planned = (week: number) =>
    allTasks(notes(), schoolDay(week, 6), schoolDay(week, 0)).filter(
      (t) =>
        t.scheduled >= schoolDay(week, 0) && t.scheduled <= schoolDay(week, 6),
    );
  it("keeps every unmarked item in week 8 only", () => {
    const d = notes();
    for (const key of [
      "hw-342-tuesday",
      "lab-362-tuesday",
      "sa",
      "dator",
      "lab-361-email",
      "grades",
      "project-342-part1",
      "demo-lab5",
      "laptop",
    ]) {
      const item = d.tasks.find((t) => t.id === `notes-task:${key}`)!;
      expect(item).toBeDefined();
      expect(schoolWeek(item.scheduled)).toBe(8);
      expect(d.routines.some((r) => r.id === `notes-routine:${key}`)).toBe(
        false,
      );
      expect(planned(9).some((t) => t.id === item.id)).toBe(false);
    }
  });
  it("runs the five odd-week quiz/preparation/milestone rules on their exact weekdays", () => {
    const expected: [string, number][] = [
      ["prepare-361", 0],
      ["quiz-361", 1],
      ["prepare-362", 2],
      ["quiz-362", 3],
      ["milestone-362", 3],
    ];
    for (const [key, weekday] of expected) {
      expect(r(key).weekdays).toEqual([weekday]);
      expect(matches(r(key), schoolDay(8, weekday))).toBe(false);
      expect(matches(r(key), schoolDay(9, weekday))).toBe(true);
      expect(matches(r(key), schoolDay(10, weekday))).toBe(false);
    }
  });
  it("plans HW 361 only on Mondays in 4,7,9,12, due the same-week Wednesday", () => {
    const rule = { ...r("hw-361"), start: schoolDay(1, 0) };
    for (let week = 1; week <= 14; week++)
      expect(matches(rule, schoolDay(week, 0))).toBe(
        [4, 7, 9, 12].includes(week),
      );
    const item = planned(9).find((t) => t.routineId === rule.id)!;
    expect(item.scheduled).toBe("2026-10-19");
    expect(item.due).toBe("2026-10-21");
    expect(
      onDay(notes(), "2026-10-21", "2026-10-19").some(
        (t) => t.routineId === rule.id,
      ),
    ).toBe(false);
  });
  it("plans CS342 quiz preparation only on Wednesdays in school weeks 4,7,10", () => {
    const rule = { ...r("prepare-342"), start: schoolDay(1, 0) };
    for (let week = 1; week <= 14; week++)
      expect(matches(rule, schoolDay(week, 2))).toBe([4, 7, 10].includes(week));
    expect(planned(10).find((t) => t.routineId === rule.id)?.scheduled).toBe(
      "2026-10-28",
    );
  });
  it("plans Thursday HW342 only in 3,7,10,12; its Sunday due date does not move it", () => {
    const rule = { ...r("hw-342-thursday"), start: schoolDay(1, 0) };
    for (let week = 1; week <= 14; week++)
      expect(matches(rule, schoolDay(week, 3))).toBe(
        [3, 7, 10, 12].includes(week),
      );
    const item = planned(10).find((t) => t.routineId === rule.id)!;
    expect(item.scheduled).toBe("2026-10-29");
    expect(item.due).toBe("2026-11-01");
    expect(matches(rule, "2026-11-01")).toBe(false);
  });
  it("repeats both 342 lectures and Friday 361 review every week", () => {
    for (const [key, weekday] of [
      ["lecture-342-tuesday", 1],
      ["lecture-342-friday", 4],
      ["lectures-361", 4],
    ] as const) {
      expect(matches(r(key), schoolDay(8, weekday))).toBe(true);
      expect(matches(r(key), schoolDay(9, weekday))).toBe(true);
    }
  });
  it("keeps Friday Lab362 on Friday and makes its due date next Monday", () => {
    const item = planned(8).find(
      (t) => t.routineId === "notes-routine:lab-362-friday",
    )!;
    expect(item.scheduled).toBe("2026-10-16");
    expect(item.due).toBe("2026-10-19");
    expect(
      onDay(notes(), "2026-10-19", "2026-10-16").some(
        (t) => t.routineId === item.routineId,
      ),
    ).toBe(false);
  });
  it("places HW362 on the Saturday BEFORE odd-week Wednesday, including DST", () => {
    for (const week of [8, 10, 12]) {
      const item = planned(week).find(
        (t) => t.routineId === "notes-routine:hw-362",
      )!;
      expect(item.scheduled).toBe(schoolDay(week, 5));
      expect(item.due).toBe(schoolDay(week + 1, 2));
      expect(schoolWeek(item.due!) % 2).toBe(1);
    }
    expect(planned(9).some((t) => t.routineId === "notes-routine:hw-362")).toBe(
      false,
    );
    expect(
      planned(10).find((t) => t.routineId === "notes-routine:hw-362")?.due,
    ).toBe("2026-11-04");
  });
  it("links the project Tuesday work and Sunday deadline as one record", () => {
    const d = notes(),
      project = d.tasks.find((t) => t.id === "notes-task:project-342-part1")!;
    expect(project.scheduled).toBe("2026-10-13");
    expect(project.due).toBe("2026-10-18");
    expect(project.deadline).toBe(true);
    expect(d.tasks.filter((t) => t.due === "2026-10-18")).toHaveLength(1);
    expect(
      onDay(d, "2026-10-18", "2026-10-14").some((t) => t.id === project.id),
    ).toBe(false);
  });
  it("does not assume unfinished school weeks before the screenshot week", () => {
    expect(
      allTasks(notes(), "2026-10-14", "2026-10-14").some(
        (t) => t.scheduled < "2026-10-12",
      ),
    ).toBe(false);
  });
  it("preserves obligation due dates when work carries over and completes", () => {
    let d = notes();
    const item = planned(9).find(
      (t) => t.routineId === "notes-routine:hw-361",
    )!;
    const late = onDay(d, "2026-10-22", "2026-10-22").find(
      (t) => t.id === item.id,
    )!;
    expect(late.due).toBe("2026-10-21");
    expect(late.original).toBe("2026-10-19");
    d = saveTask(d, { ...late, completed: "2026-10-22" });
    expect(
      onDay(d, "2026-10-22", "2026-10-23").filter((t) => t.id === item.id),
    ).toHaveLength(1);
    expect(
      onDay(d, "2026-10-23", "2026-10-23").some((t) => t.id === item.id),
    ).toBe(false);
  });
  it("accepts specific-week backups and rejects malformed schedules", () => {
    expect(validate(notes())).toBe(true);
    expect(parseSchoolWeeks("4, 7,9,12")).toEqual([4, 7, 9, 12]);
    expect(parseSchoolWeeks("4,4,7")).toEqual([4, 7]);
    expect(parseSchoolWeeks("0,7")).toBeNull();
    expect(parseSchoolWeeks("4,no")).toBeNull();
    expect(
      validate({ ...notes(), routines: [{ ...r("hw-361"), schoolWeeks: [] }] }),
    ).toBe(false);
    expect(
      validate({
        ...notes(),
        routines: [{ ...r("hw-361"), dueOffsetDays: "2" }],
      }),
    ).toBe(false);
  });
  it("distinguishes every-week W from odd and specific-week schedules", () => {
    expect(routineSuffix(r("lecture-342-tuesday"))).toBe(" (W)");
    expect(routineSuffix(r("quiz-361"))).toBe(" (odd weeks)");
    expect(routineSuffix(r("hw-361"))).toBe(" (weeks 4, 7, 9, 12)");
  });
  it("keeps W shorthand working and repeats a due date relative to each work day", () => {
    const d = saveTaskInput(
      empty(),
      task({
        title: "My work (w)",
        scheduled: "2026-10-16",
        original: "2026-10-16",
        due: "2026-10-19",
      }),
    );
    const future = onDay(d, "2026-10-23", "2026-10-16")[0];
    expect(future.title).toBe("My work");
    expect(future.due).toBe("2026-10-26");
  });
});

describe("replace the old starter guesses without losing personal data", () => {
  it("keeps personal tasks, routines and their completion untouched", () => {
    const personal = task({ title: "My own task", completed: "2026-10-14" }),
      personalRoutine = routine();
    const d = {
      ...empty(),
      sampleLoaded: true,
      tasks: [personal],
      routines: [personalRoutine],
    };
    const result = replaceStarterChecklist(d, "2026-10-14");
    expect(result.tasks.find((t) => t.id === personal.id)).toEqual(personal);
    expect(result.routines.find((r) => r.id === personalRoutine.id)).toEqual(
      personalRoutine,
    );
    expect(validate(result)).toBe(true);
  });
  it("retains a completed old recurring occurrence once and suppresses its fresh twin", () => {
    const old = routine({
      id: "old",
      title: "CS342 lecture",
      weekdays: [1],
      sample: true,
      start: "2026-10-12",
    });
    let d = { ...empty(), sampleLoaded: true, routines: [old] };
    const t = onDay(d, "2026-10-13", "2026-10-13")[0];
    d = saveTask(d, { ...t, completed: "2026-10-13" });
    const result = replaceStarterChecklist(d, "2026-10-14");
    const same = allTasks(result, "2026-10-18", "2026-10-14").filter(
      (x) => x.original === "2026-10-13" && /lecture/i.test(x.title),
    );
    expect(same).toHaveLength(1);
    expect(same[0].id).toBe(t.id);
    expect(same[0].completed).toBe("2026-10-13");
    expect(validate(result)).toBe(true);
    const again = replaceStarterChecklist(result, "2026-10-14");
    expect(
      allTasks(again, "2026-10-18", "2026-10-14").filter(
        (x) => x.original === "2026-10-13" && /lecture/i.test(x.title),
      ),
    ).toHaveLength(1);
  });
  it("keeps completed history from an earlier week but does not mark week8 grades complete", () => {
    const old = task({
      title: "Check grades in all classes",
      scheduled: schoolDay(7, 6),
      original: schoolDay(7, 6),
      completed: schoolDay(7, 6),
      sample: true,
    });
    const result = replaceStarterChecklist(
      { ...empty(), sampleLoaded: true, tasks: [old] },
      "2026-10-14",
    );
    expect(result.tasks.find((t) => t.id === old.id)?.completed).toBe(
      schoolDay(7, 6),
    );
    expect(
      result.tasks.find((t) => t.id === "notes-task:grades")?.completed,
    ).toBeUndefined();
  });
  it("moves the old project deadline to Tuesday work without adding a second Sunday task", () => {
    const old = task({
      title: "CS342 Project 2 Part 1",
      scheduled: "2026-10-18",
      original: "2026-10-18",
      due: "2026-10-18",
      deadline: true,
      sample: true,
    });
    const result = replaceStarterChecklist(
      { ...empty(), sampleLoaded: true, tasks: [old] },
      "2026-10-14",
    );
    const items = allTasks(result, "2026-10-18", "2026-10-14").filter(
      (t) => t.due === "2026-10-18",
    );
    expect(items).toHaveLength(1);
    expect(items[0].scheduled).toBe("2026-10-13");
    expect(items[0].id).toBe(old.id);
    expect(items[0].due).toBe("2026-10-18");
  });
  it("does not resurrect a completed project through an old pending duplicate", () => {
    const complete = task({
      id: "done",
      title: "CS342 project work",
      scheduled: "2026-10-13",
      original: "2026-10-13",
      sample: true,
      completed: "2026-10-14",
    });
    const pending = task({
      id: "pending",
      title: "CS342 Project 2 Part 1",
      scheduled: "2026-10-18",
      original: "2026-10-18",
      due: "2026-10-18",
      deadline: true,
      sample: true,
    });
    const result = replaceStarterChecklist(
      { ...empty(), sampleLoaded: true, tasks: [pending, complete] },
      "2026-10-14",
    );
    expect(result.tasks.find((t) => t.id === "done")?.completed).toBe(
      "2026-10-14",
    );
    expect(
      allTasks(result, "2026-10-18", "2026-10-14").filter((t) =>
        /project.*(?:work|Part 1)/i.test(t.title),
      ),
    ).toHaveLength(1);
    expect(validate(result)).toBe(true);
  });
  it("keeps user-edited old incomplete occurrences even if their guessed schedule no longer exists", () => {
    const old = routine({ id: "old", title: "CS361 quiz", sample: true });
    const edited = task({
      id: "old:2026-10-12",
      title: "My edited quiz reminder",
      routineId: "old",
      sample: true,
      notes: "Important personal note",
    });
    const result = replaceStarterChecklist(
      {
        ...empty(),
        sampleLoaded: true,
        routines: [old],
        overrides: { [edited.id]: edited },
      },
      "2026-10-14",
    );
    expect(result.tasks.find((t) => t.id === edited.id)?.notes).toBe(
      edited.notes,
    );
    expect(validate(result)).toBe(true);
  });
});


describe("linked original-day checklist history", () => {
  it("keeps unfinished work on its scheduled day and carries the same ID to today", () => {
    const d = { ...empty(), tasks: [task()] };
    const past = onDay(d, "2026-10-11", "2026-10-14")[0];
    const current = onDay(d, "2026-10-14", "2026-10-14")[0];
    expect(past.id).toBe(current.id);
    expect(past.completed).toBeUndefined();
    expect(onDay(d, "2026-10-12", "2026-10-14")).toHaveLength(0);
    expect(d.tasks).toHaveLength(1);
  });
  it("checks both appearances together, survives reload, and reverses from either", () => {
    let d = { ...empty(), tasks: [task()] };
    d = saveTask(d, { ...onDay(d, "2026-10-14", "2026-10-14")[0], completed: "2026-10-14" });
    d = JSON.parse(JSON.stringify(d));
    expect(validate(d)).toBe(true);
    for (const day of ["2026-10-11", "2026-10-14"])
      expect(onDay(d, day, "2026-10-15")[0]).toMatchObject({ id: "one", completed: "2026-10-14" });
    expect(weekTasks(d, "2026-10-05", "2026-10-15")).toHaveLength(1);
    expect(weekTasks(d, "2026-10-12", "2026-10-15")).toHaveLength(1);
    d = saveTask(d, { ...onDay(d, "2026-10-11", "2026-10-15")[0], completed: undefined });
    expect(onDay(d, "2026-10-11", "2026-10-15")[0].completed).toBeUndefined();
    expect(onDay(d, "2026-10-15", "2026-10-15")[0].id).toBe("one");
    expect(onDay(d, "2026-10-14", "2026-10-15")).toHaveLength(0);
  });
  it("retains recurring occurrence identity without checking another week's occurrence", () => {
    const r = routine({ start: "2026-10-12" });
    let d = { ...empty(), routines: [r] };
    const mondayTask = onDay(d, "2026-10-12", "2026-10-20")[0];
    d = saveTask(d, { ...mondayTask, completed: "2026-10-20" });
    expect(onDay(d, "2026-10-12", "2026-10-20")[0].completed).toBe("2026-10-20");
    expect(onDay(d, "2026-10-20", "2026-10-20").find(t => t.id === mondayTask.id)?.completed).toBe("2026-10-20");
    expect(onDay(d, "2026-10-19", "2026-10-20")[0].completed).toBeUndefined();
    const week = weekTasks(d, "2026-10-19", "2026-10-20");
    expect(new Set(week.map(t => t.id)).size).toBe(week.length);
  });
  it("removes both appearances when deleted and honors manual rescheduling", () => {
    let d = { ...empty(), tasks: [task()] };
    d = saveTask(d, { ...task(), deleted: true });
    expect(onDay(d, "2026-10-11", "2026-10-14")).toHaveLength(0);
    expect(onDay(d, "2026-10-14", "2026-10-14")).toHaveLength(0);
    d = saveTask(d, { ...task(), scheduled: "2026-10-20" });
    expect(onDay(d, "2026-10-11", "2026-10-14")).toHaveLength(0);
    expect(onDay(d, "2026-10-20", "2026-10-14")[0].id).toBe("one");
  });
});


describe("important date reminders", () => {
  it("lists incomplete deadlines in due order including overdue ones, not ordinary tasks", () => {
    const d = { ...empty(), tasks: [task(), task({ id: "later", deadline: true, due: "2026-11-06" }), task({ id: "earlier", deadline: true, due: "2026-10-18" }), task({ id: "done", deadline: true, due: "2026-10-12", completed: "2026-10-12" }), task({ id: "deleted", deadline: true, due: "2026-10-14", deleted: true })] };
    expect(importantDates(d).map(t => t.id)).toEqual(["earlier", "later"]);
  });
  it("removes the reminder when its daily task is checked and restores it on undo", () => {
    const original = task({ deadline: true, due: "2026-10-18" });
    let d = { ...empty(), tasks: [original] };
    d = saveTask(d, { ...onDay(d, "2026-10-15", "2026-10-15")[0], completed: "2026-10-15" });
    expect(importantDates(d)).toHaveLength(0);
    d = saveTask(d, { ...d.tasks[0], completed: undefined });
    expect(importantDates(d)[0]).toMatchObject({ id: original.id, due: "2026-10-18" });
    d = saveTask(d, { ...importantDates(d)[0], completed: "2026-10-15" });
    expect(onDay(d, "2026-10-11", "2026-10-15")[0].completed).toBe("2026-10-15");
    expect(d.tasks).toHaveLength(1);
  });
});
