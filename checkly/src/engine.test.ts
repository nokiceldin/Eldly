import { describe, it, expect } from "vitest";
import {
  empty,
  setPaused,
  add,
  diff,
  iso,
  schoolWeek,
  seed,
  monday,
  matches,
  onDay,
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
    expect(onDay(d, "2026-10-11", "2026-10-12")).toHaveLength(0);
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
  it("anchors October 12â€“18 to school week 8 and advances on Mondays", () => {
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
    expect(
      d.tasks
        .filter((t) => t.title === "Prepare for CS342 quiz")
        .map((t) => t.scheduled),
    ).toEqual(["2026-09-16", "2026-10-07", "2026-10-28"]);
  });
});
