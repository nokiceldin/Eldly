import { describe, expect, it } from "vitest";
import { empty, syncChecklyHomework, type Task } from "./engine";
import { emptyMapping, setMappingEntry } from "./mapping";
import { validate } from "./storage";
const day = "2026-10-15";
const task = (extra: Partial<Task> = {}): Task => ({ id: "task", title: "Homework", scheduled: day, original: day, category: "", notes: "", carry: true, important: false, order: 0, ...extra });
describe("Checkly to Mapping homework completion", () => {
  it("marks the date only when a nonempty checklist is fully finished", () => {
    expect(syncChecklyHomework(empty(), day).mapping).toBeUndefined();
    const partial = { ...empty(), tasks: [task({ completed: day }), task({ id: "second" })] };
    expect(syncChecklyHomework(partial, day).mapping).toBeUndefined();
    const done = syncChecklyHomework({ ...empty(), tasks: [task({ completed: day })] }, day);
    expect(done.mapping?.entries[day].homework).toEqual({ kind: "check", source: "checkly" });
    expect(syncChecklyHomework(done, day)).toBe(done);
  });
  it("removes automatic marks after undo or adding unfinished work", () => {
    const done = syncChecklyHomework({ ...empty(), tasks: [task({ completed: day })] }, day);
    const undone = syncChecklyHomework({ ...done, tasks: [task()] }, day);
    expect(undone.mapping?.entries[day]?.homework).toBeUndefined();
    const added = syncChecklyHomework({ ...done, tasks: [...done.tasks, task({ id: "new" })] }, day);
    expect(added.mapping?.entries[day]?.homework).toBeUndefined();
  });
  it("preserves manual homework marks and unrelated activity values", () => {
    let mapping = setMappingEntry(emptyMapping(), day, "homework", { kind: "check" });
    mapping = setMappingEntry(mapping, day, "tennis", { kind: "duration", minutes: 90 });
    const data = { ...empty(), tasks: [task()], mapping };
    expect(syncChecklyHomework(data, day).mapping).toEqual(mapping);
  });
  it("credits late completions to the finishing day rather than the missed day", () => {
    const result = syncChecklyHomework({ ...empty(), tasks: [task({ scheduled: "2026-10-11", original: "2026-10-11", completed: day })] }, day);
    expect(result.mapping?.entries[day]?.homework).toBeDefined();
    expect(result.mapping?.entries["2026-10-11"]).toBeUndefined();
  });
  it("requires carried-over work to be complete too", () => {
    const result = syncChecklyHomework({ ...empty(), tasks: [task({ completed: day }), task({ id: "old", scheduled: "2026-10-11", original: "2026-10-11" })] }, day);
    expect(result.mapping?.entries[day]?.homework).toBeUndefined();
  });
  it("does not pre-credit future checklists and clears empty automatic days", () => {
    const future = syncChecklyHomework({ ...empty(), tasks: [task({ scheduled: "2026-10-20", original: "2026-10-20", completed: "2026-10-20" })] }, day);
    expect(future.mapping).toBeUndefined();
    const mapping = setMappingEntry(emptyMapping(), day, "homework", { kind: "check", source: "checkly" });
    expect(syncChecklyHomework({ ...empty(), mapping }, day).mapping?.entries[day]).toBeUndefined();
  });
  it("retains completed historical days and validates backup provenance", () => {
    const result = syncChecklyHomework({ ...empty(), tasks: [task({ completed: day })] }, "2027-01-01");
    expect(result.mapping?.entries[day].homework).toBeDefined();
    expect(validate(JSON.parse(JSON.stringify(result)))).toBe(true);
    expect(validate({ ...empty(), mapping: { version: 1, entries: { [day]: { coaching: { kind: "check", source: "checkly" } } } } })).toBe(false);
  });
});
