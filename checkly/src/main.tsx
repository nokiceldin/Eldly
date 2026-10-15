import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Repeat2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
} from "lucide-react";
import { motion, MotionConfig, AnimatePresence } from "motion/react";
import {
  type Data,
  type Task,
  type Routine,
  localDay,
  monday,
  add,
  iso,
  format,
  parse,
  uid,
  empty,
  onDay,
  visibleDate,
  saveTask,
  seed,
  setPaused,
} from "./engine";
import { load, persist, download, validate } from "./storage";
import Editor from "./components/TaskEditor";
import SwipeToDelete from "./components/SwipeToDelete";
import TaskCheck from "./components/TaskCheck";
import DayCelebration from "./components/DayCelebration";
import { useWeekSwipe } from "./useWeekSwipe";
import { useReducedMotion } from "./useReducedMotion";
import "./style.css";
function App() {
  const [initial] = useState(() => {
    try {
      return { data: load(), error: "" };
    } catch (e) {
      return { data: empty(), error: String(e) };
    }
  });
  const [data, setData] = useState<Data>(initial.data);
  const [blocked, setBlocked] = useState(!!initial.error);
  const [error, setError] = useState(initial.error);
  const [today, setToday] = useState(localDay());
  const [week, setWeek] = useState(monday(today));
  const [focusRequest, setFocusRequest] = useState(0);
  const focusDate = useRef(today);
  const reduce = useReducedMotion();
  const returnToToday = useCallback(() => {
    const current = localDay();
    focusDate.current = current;
    setToday(current);
    setWeek(monday(current));
    setFocusRequest((n) => n + 1);
  }, []);
  useLayoutEffect(() => {
    const jump = () =>
      document
        .getElementById("day-" + focusDate.current)
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    jump();
    const frame = requestAnimationFrame(jump);
    return () => cancelAnimationFrame(frame);
  }, [today, focusRequest]);
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);
  const changeWeek = (direction: number) => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(".note-day"),
    );
    const visible =
      sections.find((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= 110 && r.bottom > 110;
      }) ||
      sections.reduce<HTMLElement | undefined>(
        (best, el) =>
          !best ||
          Math.abs(el.getBoundingClientRect().top - 88) <
            Math.abs(best.getBoundingClientRect().top - 88)
            ? el
            : best,
        undefined,
      );
    focusDate.current = add(visible?.dataset.date || week, direction * 7);
    setWeek(add(week, direction * 7));
    setFocusRequest((n) => n + 1);
  };
  const weekSwipe = useWeekSwipe(changeWeek);
  const [editor, setEditor] = useState<{
    task?: Task;
    routine?: Routine;
    date: string;
    deadline?: boolean;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [celebration, setCelebration] = useState<{
    day: string;
    id: string;
  } | null>(null);
  const [undoTask, setUndoTask] = useState<Task | null>(null);
  const tools = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (blocked) return;
    try {
      persist(data);
      setError("");
    } catch {
      setError("Changes could not be saved. Please export a backup.");
    }
  }, [data, blocked]);
  useEffect(() => {
    let lastDate = localDay();
    const refreshDate = () => {
      const next = localDay();
      if (next !== lastDate) {
        lastDate = next;
        returnToToday();
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") returnToToday();
    };
    const timer = setInterval(refreshDate, 30000);
    window.addEventListener("focus", returnToToday);
    window.addEventListener("pageshow", returnToToday);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", returnToToday);
      window.removeEventListener("pageshow", returnToToday);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [returnToToday]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);
  const update = (task: Task) => setData((d) => saveTask(d, task));
  useEffect(() => {
    if (!undoTask) return;
    const timer = setTimeout(() => setUndoTask(null), 6000);
    return () => clearTimeout(timer);
  }, [undoTask]);
  const deleteTask = (task: Task) => {
    update({ ...task, deleted: true });
    setUndoTask(task);
  };
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 3200);
    return () => clearTimeout(timer);
  }, [celebration]);
  useEffect(() => {
    if (!celebration) return;
    const tasks = onDay(data, celebration.day, today);
    if (!tasks.length || tasks.some((t) => !t.completed)) setCelebration(null);
  }, [data, today, celebration]);
  const toggle = (t: Task, day = today) => {
    const completionDay = day > today ? day : today;
    const next = saveTask(data, {
      ...t,
      completed: t.completed ? undefined : completionDay,
    });
    setData(next);
    if (!t.completed) {
      const tasks = onDay(next, completionDay, today);
      if (tasks.length && tasks.every((task) => task.completed))
        setCelebration({ day: completionDay, id: uid() });
    }
    if (!t.completed && data.sound) {
      try {
        const ctx = new AudioContext(),
          o = ctx.createOscillator(),
          g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.025, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        o.frequency.value = 700;
        o.start();
        o.stop(ctx.currentTime + 0.14);
        o.onended = () => ctx.close();
      } catch {}
    }
  };
  const reorder = (task: Task, date: string, direction: number) => {
    const list = onDay(data, date, today);
    const i = list.findIndex((t) => t.id === task.id),
      j = i + direction;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setData((d) =>
      list.reduce((state, t, i) => saveTask(state, { ...t, order: i }), d),
    );
  };
  const newRoutine = () =>
    setEditor({
      routine: {
        id: uid(),
        title: "",
        category: "",
        notes: "",
        start: today,
        weekdays: [(parse(today).getDay() + 6) % 7],
        frequency: "weekly",
        interval: 1,
        paused: false,
        carry: true,
        important: false,
      },
      date: today,
    });
  const save = (task?: Task, routine?: Routine) => {
    setData((d) => {
      if (task) return saveTask(d, task);
      if (!routine) return d;
      const old = d.routines.find((r) => r.id === routine.id);
      if (!old) return { ...d, routines: [...d.routines, routine] };
      return {
        ...d,
        routines: [
          ...d.routines.filter((r) => r.id !== old.id),
          { ...old, end: add(today, -1) },
          { ...routine, id: uid(), start: today, end: undefined },
        ],
      };
    });
    setEditor(null);
  };
  return (
    <MotionConfig reducedMotion="user">
      <main className="note-page" {...weekSwipe}>
        <header className="note-toolbar week-toolbar">
          <nav className="week-switcher" aria-label="Week navigation">
            <button
              className="week-arrow"
              aria-label="Previous week"
              onClick={() => changeWeek(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className={
                "week-label" + (week === monday(today) ? " current-week" : "")
              }
              aria-label={`Week ${iso(week).week}, ${iso(week).year}${week === monday(today) ? ", current week" : ". Return to current week"}`}
              aria-current={week === monday(today) ? "date" : undefined}
              onClick={returnToToday}
            >
              Week {iso(week).week}
            </button>
            <button
              className="week-arrow"
              aria-label="Next week"
              onClick={() => changeWeek(1)}
            >
              <ChevronRight size={20} />
            </button>
          </nav>
          <button
            className="toolbar-button toolbar-options"
            aria-label="More options"
            onClick={() => tools.current?.showModal()}
          >
            Options
          </button>
        </header>
        {error && (
          <p className="save-error" role="alert">
            {error}
          </p>
        )}
        <motion.div
          className="days"
          key={week}
          initial={reduce ? false : { opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
        >
          {Array.from({ length: 7 }, (_, i) => add(week, i)).map((date) => {
            const tasks = onDay(data, date, today);
            const allDone = tasks.length > 0 && tasks.every((t) => t.completed);
            return (
              <section
                className={"note-day" + (date === today ? " is-current" : "")}
                data-date={date}
                id={"day-" + date}
                key={date}
              >
                <div className="day-heading">
                  <h2>
                    {format(date, { weekday: "long" })}
                    {allDone && (
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="day-complete"
                        aria-label="All tasks complete"
                      >
                        ✓
                      </motion.span>
                    )}
                  </h2>
                  <span
                    className={
                      date === today ? "day-date is-today" : "day-date"
                    }
                  >
                    {format(date, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="note-tasks">
                  {tasks.map((t) => (
                    <SwipeToDelete key={t.id} onDelete={() => deleteTask(t)}>
                      <div
                        className={[
                          "note-task",
                          t.completed ? "checked" : "",
                          t.routineId ? "is-recurring" : "is-one-time",
                          !t.completed &&
                          t.carry &&
                          t.scheduled < today &&
                          date === today
                            ? "is-carried"
                            : "",
                        ].join(" ")}
                        key={t.id}
                      >
                        <div className="note-task-content">
                          <button
                            className="note-task-title"
                            onClick={() =>
                              setEditor({ task: t, date: t.scheduled })
                            }
                          >
                            {t.title}
                            {data.routines.some(
                              (r) =>
                                r.id === t.routineId && r.frequency !== "daily",
                            )
                              ? " (W)"
                              : ""}
                          </button>
                          {!t.completed &&
                            t.due &&
                            !(date === today && t.scheduled < today) && (
                              <small className="task-due-note">
                                Due {format(t.due)}
                              </small>
                            )}
                        </div>
                        <TaskCheck
                          checked={!!t.completed}
                          label={t.title}
                          description={`${t.routineId ? "Recurring task" : "One-time task"}${!t.completed && t.carry && t.scheduled < today && date === today ? ", carried over" : ""}`}
                          onToggle={() => toggle(t, date)}
                        />
                      </div>
                    </SwipeToDelete>
                  ))}
                </div>
                <QuickAdd
                  date={date}
                  onAdd={(title) =>
                    update({
                      id: uid(),
                      title,
                      scheduled: date,
                      original: date,
                      category: "",
                      notes: "",
                      carry: true,
                      important: false,
                      order: Date.now(),
                    })
                  }
                />
              </section>
            );
          })}
        </motion.div>
      </main>
      <dialog
        ref={tools}
        className="options-dialog"
        onClick={(e) => {
          if (e.target === tools.current) tools.current?.close();
        }}
      >
        <header>
          <h2>Options</h2>
          <button
            className="toolbar-button"
            aria-label="Close options"
            onClick={() => tools.current?.close()}
          >
            <X size={21} />
          </button>
        </header>
        <p className="options-hint">
          Your checklist saves automatically on this device.
        </p>
        <details className="option-group">
          <summary>
            Repeating tasks <Repeat2 size={16} />
          </summary>
          <div className="option-content">
            {data.routines
              .filter((r) => !r.end)
              .map((r) => (
                <div className="routine-item" key={r.id}>
                  <button
                    onClick={() => {
                      tools.current?.close();
                      setEditor({ routine: r, date: today });
                    }}
                  >
                    {r.title}
                    <small>
                      {r.frequency === "daily"
                        ? "Daily"
                        : r.weekdays
                            .map(
                              (i) =>
                                [
                                  "Mon",
                                  "Tue",
                                  "Wed",
                                  "Thu",
                                  "Fri",
                                  "Sat",
                                  "Sun",
                                ][i],
                            )
                            .join(", ")}
                      {r.paused ? " · paused" : ""}
                    </small>
                  </button>
                  <button
                    className="quiet-action"
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        routines: d.routines.map((x) =>
                          x.id === r.id ? setPaused(x, !x.paused, today) : x,
                        ),
                      }))
                    }
                  >
                    {r.paused ? "Resume" : "Pause"}
                  </button>
                </div>
              ))}
            <button
              className="option-action"
              onClick={() => {
                tools.current?.close();
                newRoutine();
              }}
            >
              <Plus size={16} /> Add a repeating task
            </button>
          </div>
        </details>
        <details className="option-group">
          <summary>Important dates</summary>
          <div className="option-content">
            {data.tasks
              .filter((t) => t.deadline && !t.deleted)
              .sort((a, b) => a.due!.localeCompare(b.due!))
              .map((t) => (
                <div className="deadline-item" key={t.id}>
                  <button
                    className={"tiny-check " + (t.completed ? "done" : "")}
                    role="checkbox"
                    aria-checked={!!t.completed}
                    aria-label={t.title}
                    onClick={() => toggle(t)}
                  >
                    {t.completed && <Check size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      tools.current?.close();
                      setEditor({ task: t, date: t.scheduled });
                    }}
                  >
                    {t.title}
                    <small>
                      {format(t.due!, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </small>
                  </button>
                </div>
              ))}
            <button
              className="option-action"
              onClick={() => {
                tools.current?.close();
                setEditor({ date: today, deadline: true });
              }}
            >
              <Plus size={16} /> Add an important date
            </button>
          </div>
        </details>
        <details className="option-group">
          <summary>Backup & settings</summary>
          <div className="option-content">
            <button className="option-action" onClick={() => download(data)}>
              <Download size={16} /> Export backup
            </button>
            <button
              className="option-action"
              onClick={() => file.current?.click()}
            >
              <Upload size={16} /> Import backup
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const d = JSON.parse(await f.text());
                  if (!validate(d))
                    throw Error("This is not a valid Checkly backup.");
                  if (
                    confirm("Replace your current checklist with this backup?")
                  ) {
                    setBlocked(false);
                    setData(d);
                    setNotice("Backup restored");
                  }
                } catch (err) {
                  setNotice(String(err));
                }
                e.target.value = "";
              }}
            />
            <p className="options-hint">
              Backups move your data between devices. There is no automatic
              sync.
            </p>
            <label className="sound-setting">
              <input
                type="checkbox"
                checked={data.sound}
                onChange={(e) =>
                  setData((d) => ({ ...d, sound: e.target.checked }))
                }
              />{" "}
              Quiet completion sound
            </label>
            <details className="category-settings">
              <summary>Categories</summary>
              {data.categories.map((c) => (
                <div className="category-item" key={c}>
                  <span>{c}</span>
                  <button
                    onClick={() => {
                      const name = prompt("Category name", c)?.trim();
                      if (name && !data.categories.includes(name))
                        setData((d) => ({
                          ...d,
                          categories: d.categories.map((x) =>
                            x === c ? name : x,
                          ),
                          tasks: d.tasks.map((t) =>
                            t.category === c ? { ...t, category: name } : t,
                          ),
                          routines: d.routines.map((r) =>
                            r.category === c ? { ...r, category: name } : r,
                          ),
                          overrides: Object.fromEntries(
                            Object.entries(d.overrides).map(([k, t]) => [
                              k,
                              t.category === c ? { ...t, category: name } : t,
                            ]),
                          ),
                        }));
                    }}
                  >
                    Rename
                  </button>
                  <button
                    aria-label={"Delete " + c}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        categories: d.categories.filter((x) => x !== c),
                        tasks: d.tasks.map((t) =>
                          t.category === c ? { ...t, category: "" } : t,
                        ),
                        routines: d.routines.map((r) =>
                          r.category === c ? { ...r, category: "" } : r,
                        ),
                        overrides: Object.fromEntries(
                          Object.entries(d.overrides).map(([k, t]) => [
                            k,
                            t.category === c ? { ...t, category: "" } : t,
                          ]),
                        ),
                      }))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className="option-action"
                onClick={() => {
                  const name = prompt("New category")?.trim();
                  if (name && !data.categories.includes(name))
                    setData((d) => ({
                      ...d,
                      categories: [...d.categories, name],
                    }));
                }}
              >
                Add category
              </button>
            </details>
          </div>
        </details>
        <details className="option-group">
          <summary>Starter checklist</summary>
          <div className="option-content">
            <p className="options-hint">
              Optional class tasks and dates. Everything is editable.
            </p>
            <button
              className="option-action"
              onClick={() => {
                if (!data.sampleLoaded) {
                  setData((d) => seed(d, today));
                  tools.current?.close();
                } else setNotice("Starter checklist is already loaded");
              }}
            >
              Load starter checklist
            </button>
            <button
              className="option-action delete-text"
              onClick={() => {
                if (
                  confirm(
                    "Remove only the starter examples? Your own tasks will stay.",
                  )
                )
                  setData((d) => ({
                    ...d,
                    tasks: d.tasks.filter((t) => !t.sample),
                    routines: d.routines.filter((r) => !r.sample),
                    overrides: Object.fromEntries(
                      Object.entries(d.overrides).filter(([, t]) => !t.sample),
                    ),
                    sampleLoaded: false,
                  }));
              }}
            >
              Remove starter examples
            </button>
          </div>
        </details>
      </dialog>
      {editor && (
        <Editor
          key={editor.task?.id || editor.routine?.id || "new"}
          editor={editor}
          categories={data.categories}
          close={() => setEditor(null)}
          onSave={save}
          extraActions={
            editor.task && (
              <details className="extra-task-actions">
                <summary>More actions</summary>
                {editor.task.routineId && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditor({
                        routine: data.routines.find(
                          (r) => r.id === editor.task!.routineId,
                        ),
                        date: today,
                      })
                    }
                  >
                    Edit repeating schedule
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    reorder(editor.task!, visibleDate(editor.task!, today), -1);
                    setEditor(null);
                  }}
                >
                  <ArrowUp size={14} /> Move up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reorder(editor.task!, visibleDate(editor.task!, today), 1);
                    setEditor(null);
                  }}
                >
                  <ArrowDown size={14} /> Move down
                </button>
                {!editor.task.routineId && !editor.task.deadline && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = editor.task!;
                      update({
                        ...t,
                        id: uid(),
                        scheduled: add(t.scheduled, 7),
                        original: add(t.scheduled, 7),
                        completed: undefined,
                        sample: false,
                      });
                      setEditor(null);
                      setNotice("Added to next week");
                    }}
                  >
                    Copy to next week
                  </button>
                )}
              </details>
            )
          }
          onDelete={() => {
            if (editor.task) update({ ...editor.task, deleted: true });
            if (editor.routine)
              setData((d) => ({
                ...d,
                routines: d.routines.map((r) =>
                  r.id === editor.routine!.id
                    ? { ...r, end: add(today, -1) }
                    : r,
                ),
              }));
            setEditor(null);
          }}
        />
      )}
      <AnimatePresence>
        {celebration && <DayCelebration key={celebration.id} />}
      </AnimatePresence>
      {undoTask && (
        <div className="undo-notice" role="status">
          <span>Task deleted</span>
          <button
            onClick={() => {
              update(undoTask);
              setUndoTask(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </MotionConfig>
  );
}
function QuickAdd({
  date,
  onAdd,
}: {
  date: string;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim());
        setTitle("");
      }}
    >
      <input
        aria-label={`Add a task to ${format(date, { weekday: "long" })}`}
        enterKeyHint="done"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={250}
      />
      {title.trim() && (
        <button type="submit" aria-label="Add task">
          <Plus size={19} />
        </button>
      )}
    </form>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
