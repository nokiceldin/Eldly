import QuickTaskAdd from './components/QuickTaskAdd';
import TaskColorPicker from './components/TaskColorPicker';
import TaskColorSettings from './components/TaskColorSettings';
import {popularTaskColors,taskColorHex,rememberTaskColor,setTaskColor,type TaskColor} from './taskColors';
import DailyAppShortcut from './components/DailyAppShortcut';
import SiteAnalytics from './components/SiteAnalytics';
import {useContext} from "react";
import {ProfileContext} from "./profileContext";
import ProfileAvatar from "./components/ProfileAvatar";
import { isPersonalOwner, accountHomeName } from "./accountScope";
import AccountBoundary from "./components/AccountBoundary";
import { TaskDragArea, TaskDropDay, DraggableTask } from "./components/TaskDrag";
import { moveTaskOccurrence } from "./taskMoves";
import { deletedTasks, restoreDeletedTask } from "./taskRecovery";
import UndoNotice from "./components/UndoNotice";
import { CloudBoundary } from "./sync/CloudBoundary";
import { REMOTE_EVENT } from "./sync/local";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
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
  Cloud,
  History,
} from "lucide-react";
import { motion, MotionConfig, AnimatePresence, animate, useMotionValue, useTransform } from "motion/react";
import {
  type Data,
  type Task,
  type Routine,
  localDay,
  monday,
  add,
  iso,
  schoolWeek,
  format,
  parse,
  uid,
  empty,
  onDay,
  importantDates,
  visibleDate,
  saveTask,
  saveTaskInput,
  normalizeWeeklyMarkers,
  parseWeeklyTitle,
  seed,
  replaceStarterChecklist,
  routineSuffix,
  setPaused,
} from "./engine";
import { load, persist, download, validate } from "./storage";
import PacklyPage from "./packly/App";
import { playFeedback } from "./sounds";
import AppIcon from "./components/AppIcon";
import ProgressPage from "./components/ProgressPage";
import RecapDialog from "./components/RecapDialog";
import MappingPage from "./components/MappingPage";
import Editor from "./components/TaskEditor";
import SwipeToDelete from "./components/SwipeToDelete";
import TaskCheck from "./components/TaskCheck";
import DayCelebration from "./components/DayCelebration";
import { useWeekSwipe } from "./useWeekSwipe";
import { useReducedMotion } from "./useReducedMotion";
import "./style.css";
function DayProgress({ completed, total, day }: { completed: number; total: number; day: string }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const value = useMotionValue(percent);
  const display = useTransform(value, (n) => `${Math.round(n)}%`);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      value.set(percent);
      return;
    }
    const animation = animate(value, percent, { duration: 0.55, ease: [0.22, 1, 0.36, 1] });
    return () => animation.stop();
  }, [percent, value, reducedMotion]);
  return (
    <span className="day-progress" role="progressbar" aria-label={`${day} completion`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      aria-valuetext={`${completed} of ${total} tasks completed`}>
      <motion.span aria-hidden="true">{display}</motion.span>
    </span>
  );
}
function Checklist({ onHome }: { onHome: () => void }) {
  const [initial] = useState(() => {
    try {
      return {
        data: normalizeWeeklyMarkers(seed(load(), localDay())),
        error: "",
      };
    } catch (e) {
      return { data: empty(), error: String(e) };
    }
  });
  const [data, setData] = useState<Data>(initial.data);
  useEffect(() => { const sync = () => { try { setData(load()); } catch(e) { setError(String(e)); } }; window.addEventListener(REMOTE_EVENT,sync); window.addEventListener("storage",sync); return () => { window.removeEventListener(REMOTE_EVENT,sync); window.removeEventListener("storage",sync); }; }, []);
  const [blocked, setBlocked] = useState(!!initial.error);
  const [error, setError] = useState(initial.error);
  const [today, setToday] = useState(localDay());
  const [week, setWeek] = useState(monday(today));
  const weekX = useMotionValue(0);
  const weekChanging = useRef(false);
  const [taskDragging,setTaskDragging] = useState(false);
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
  const changeWeek = async (direction: number) => {
    if (weekChanging.current || taskDragging) return;
    weekChanging.current = true;
    const width = Math.min(window.innerWidth, 680);
    if (!reduce) await animate(weekX, -direction * width, { duration: .18, ease: [.32, 0, .67, 0] });
    const nextWeek = add(week,direction*7);
    focusDate.current = nextWeek === monday(today) ? today : nextWeek;
    weekX.set(reduce ? 0 : direction * width);
    setWeek(nextWeek);
    setFocusRequest((n) => n + 1);
  };
  useLayoutEffect(() => {
    const animation = animate(weekX, 0, { duration: reduce ? 0 : .3, ease: [.16, 1, .3, 1] });
    void animation.then(() => { weekChanging.current = false; });
    return () => animation.stop();
  }, [week, reduce, weekX]);
  const weekSwipe = useWeekSwipe(changeWeek, offset => {
    if (!reduce && !weekChanging.current) weekX.set(offset);
  }, () => {
    if (!weekChanging.current) animate(weekX, 0, { duration: reduce ? 0 : .25, ease: [.16, 1, .3, 1] });
  });
  const [editor, setEditor] = useState<{
    task?: Task;
    routine?: Routine;
    date: string;
    deadline?: boolean;
    quick?: boolean;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [recentColorTask,setRecentColorTask]=useState<{id:string;routineId?:string;until:number}|null>(null);
  useEffect(()=>{if(!recentColorTask)return;const timer=setTimeout(()=>setRecentColorTask(null),Math.max(0,recentColorTask.until-Date.now()));return()=>clearTimeout(timer);},[recentColorTask]);
  const pickRecentColor=(color:TaskColor)=>{if(!recentColorTask||Date.now()>recentColorTask.until)return;setData(d=>rememberTaskColor(setTaskColor(d,recentColorTask,color),color));setRecentColorTask(null);};
  const [celebration, setCelebration] = useState<{
    day: string;
    id: string;
  } | null>(null);
  const [undoAction, setUndoAction] = useState<{id:string;label:string;restore:(data:Data)=>Data}|null>(null);
  const clearUndo = useCallback(()=>setUndoAction(null),[]);
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
  const update = (task: Task) => setData((d) => saveTaskInput(d, task));
  const deleteTask = (task: Task) => {
    setData(d=>saveTask(d,{...task,deleted:true}));
    setUndoAction({id:uid(),label:`Removed “${task.title}”`,restore:d=>restoreDeletedTask(d,task.id)});
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
    if (!t.completed) {
      const tasks = onDay(next, completionDay, today);
      playFeedback(tasks.length > 0 && tasks.every(task => task.completed) ? "day-complete" : "check", data.sound);
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
      if (task) {
        let next=saveTaskInput(d,task);
        if(task.color&&task.color!==editor?.task?.color){next=setTaskColor(next,{id:task.id,routineId:next.tasks.find(t=>t.id===task.id)?.routineId||task.routineId},task.color);next=rememberTaskColor(next,task.color);}
        return next;
      }
      if (!routine) return d;
      const parsed = parseWeeklyTitle(routine.title);
      if (!parsed.title) return d;
      const updated = {
        ...routine,
        title: parsed.title,
        ...(parsed.weekly ? { frequency: "weekly" as const, interval: 1 } : {}),
      };
      const old = d.routines.find((r) => r.id === updated.id);
      let colored=d;
      if(updated.color&&updated.color!==old?.color)colored=rememberTaskColor(setTaskColor(d,{id:'',routineId:updated.id},updated.color),updated.color);
      if(old&&Object.keys({...old,...updated}).every(key=>key==='color'||JSON.stringify(old[key as keyof Routine])===JSON.stringify(updated[key as keyof Routine])))return {...colored,routines:colored.routines.map(r=>r.id===old.id?updated:r)};
      if (!old) return { ...colored, tasks: editor?.task&&!editor.task.routineId?colored.tasks.filter(t=>t.id!==editor.task!.id):colored.tasks, routines: [...colored.routines, updated] };
      return {
        ...colored,
        routines: [
          ...colored.routines.filter((r) => r.id !== old.id),
          { ...old, color:updated.color, end: add(today, -1) },
          { ...updated, id: uid(), start: today, end: undefined },
        ],
      };
    });
    if(editor?.quick&&task)setNotice(`Added for ${format(task.scheduled,{month:'short',day:'numeric'})}`);
    setEditor(null);
  };
  return (
    <MotionConfig reducedMotion="user">
        <header className="note-toolbar week-toolbar">
          <div className="check-toolbar-inner">
          <button className="toolbar-button eldly-home-button" aria-label={`Back to ${accountHomeName()} home`} onClick={onHome}><Home size={20} /></button>
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
              aria-label={`Week ${schoolWeek(week)}, ${iso(week).year}, ${format(week,{month:"short",day:"numeric"})} through ${format(add(week,6),{month:"short",day:"numeric"})}${week === monday(today) ? ", current week" : ". Return to current week"}`}
              aria-current={week === monday(today) ? "date" : undefined}
              onClick={returnToToday}
            >
              <span>Week {schoolWeek(week)}</span><small className="week-date-range">{format(week,{month:"short",day:"numeric"})}–{format(add(week,6),{month:"short",day:"numeric"})}</small>
            </button>
            <button
              className="week-arrow"
              aria-label="Next week"
              onClick={() => changeWeek(1)}
            >
              <ChevronRight size={20} />
            </button>
          </nav>
          <div className="check-toolbar-actions">
          <button type="button" className="check-add-task" aria-label="Add a task" onClick={() => setEditor({date:today,quick:true})}><Plus size={21}/></button>
          <button
            className="toolbar-button toolbar-options"
            aria-label="More options"
            onClick={() => tools.current?.showModal()}
          >
            Options
          </button>
          </div>
          </div>
        </header>
      <main className={`note-page ${taskDragging?"task-dragging":""}`} {...weekSwipe}>
      <DailyAppShortcut to="track"/>
        {error && (
          <p className="save-error" role="alert">
            {error}
          </p>
        )}
        <TaskDragArea onActive={setTaskDragging} onMove={(task,day,index)=>setData(current=>moveTaskOccurrence(current,task,day,index,today))}>
        <motion.div
          className="days"
          key={week}
          style={{ x: weekX }}
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
                  <div className="day-heading-status">
                    <DayProgress completed={tasks.filter((t) => t.completed).length} total={tasks.length} day={format(date, { weekday: "long" })} />
                    <span className={date === today ? "day-date is-today" : "day-date"}>
                      {format(date, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
                {tasks.length === 0 && <div className="check-empty-day"><p>{date === today ? 'A little space for what matters today.' : 'Nothing planned yet.'}</p><button type="button" className="empty-action" onClick={() => setEditor({date,quick:true})}><Plus size={17}/> Add {data.tasks.length || data.routines.length ? 'a task' : 'your first task'}</button></div>}
                <TaskDropDay day={date} tasks={tasks}>
                <div className="note-tasks">
                  {tasks.map((t) => (
                    <DraggableTask key={t.id} task={t} day={date} tasks={tasks}><SwipeToDelete disabled={taskDragging} onDelete={() => deleteTask(t)}>
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
                            style={{color:taskColorHex(t.color)}}
                            onClick={() =>
                              setEditor({ task: t, date: t.scheduled })
                            }
                          >
                            {t.title}
                            {(() => {
                              const routine = data.routines.find(
                                (r) => r.id === t.routineId,
                              );
                              return routine ? routineSuffix(routine) : "";
                            })()}
                          </button>
                          {recentColorTask?.id===t.id&&<TaskColorPicker compact colors={popularTaskColors(data.taskColorSettings)} value={t.color} onChange={pickRecentColor} label={`Choose text color for ${t.title}`}/>}
                          {!t.completed &&
                            t.due &&
                            !(date === today && t.scheduled < today) && (
                              <small className="task-due-note">
                                Due {format(t.due)} ({format(t.due, { weekday: "long" })})
                              </small>
                            )}
                        </div>
                        <TaskCheck
                          checked={!!t.completed}
                          missed={!t.completed && date === t.scheduled && date < today}
                          label={t.title}
                          description={`${t.routineId ? "Recurring task" : "One-time task"}${!t.completed && date === t.scheduled && date < today ? ", not completed on this day" : ""}${!t.completed && t.carry && t.scheduled < today && date === today ? ", carried over" : ""}`}
                          onToggle={() => toggle(t, date)}
                        />
                      </div>
                    </SwipeToDelete></DraggableTask>
                  ))}
                </div>
                </TaskDropDay>
                <QuickTaskAdd date={date} settings={data.taskColorSettings} onAdd={(title,color)=>{
                  const task:Task={id:uid(),title,color,scheduled:date,original:date,category:'',notes:'',carry:true,important:false,order:Date.now()};
                  setData(d=>{const next=saveTaskInput(d,task);return color?rememberTaskColor(next,color):next;});
                  if(!color)setRecentColorTask({id:task.id,...(parseWeeklyTitle(title).weekly?{routineId:`weekly:${task.id}`} : {}),until:Date.now()+5000});else setRecentColorTask(null);
                }}/>

              </section>
            );
          })}
        </motion.div>
        </TaskDragArea>
        <section className="important-dates" aria-labelledby="important-dates-title">
          <div className="important-dates-heading">
            <h2 id="important-dates-title">Important Dates</h2>
            <button className="toolbar-button" aria-label="Add an important date"
              onClick={() => setEditor({ date: today, deadline: true })}>
              <Plus size={18} />
            </button>
          </div>
          {importantDates(data).length ? (
            <ul className="important-dates-list">
              {importantDates(data).map((t) => (
                <li key={t.id}>
                  <button className="important-date-text" onClick={() => setEditor({ task: t, date: t.scheduled })}>
                    <time dateTime={t.due}>{format(t.due!, { month: "short", day: "numeric", ...(t.due!.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) })}</time>
                    <span style={{color:taskColorHex(t.color)}}>{t.title}</span>
                  </button>
                  <button className="important-date-check" role="checkbox" aria-checked={false}
                    aria-label={`Complete ${t.title}`} onClick={() => toggle(t)}>
                    <Check size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="important-dates-empty">No upcoming deadlines.</p>}
        </section>
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
        <TaskColorSettings settings={data.taskColorSettings} onChange={settings=>setData(d=>({...d,taskColorSettings:{...settings,usage:d.taskColorSettings?.usage}}))}/>
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
                      {routineSuffix(r)}
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
          <summary>Deleted tasks</summary>
          <div className="option-content deleted-task-list">
            {deletedTasks(data).length===0?<p>No deleted tasks.</p>:deletedTasks(data).map(task=><div className="deleted-task-row" key={task.id}>
              <span>{task.title}<small>{parse(task.scheduled).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</small></span>
              <button type="button" className="quiet-action" aria-label={`Restore ${task.title} on ${task.scheduled}`} onClick={()=>{
                setData(d=>restoreDeletedTask(d,task.id));
                clearUndo();
                setNotice(`Restored “${task.title}”`);
              }}>Restore</button>
            </div>)}
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
                    throw Error("This is not a valid Check backup.");
                  if (
                    confirm("Replace your current checklist with this backup?")
                  ) {
                    setBlocked(false);
                    setData(normalizeWeeklyMarkers(d));
                    setNotice("Backup restored");
                  }
                } catch (err) {
                  setNotice(String(err));
                }
                e.target.value = "";
              }}
            />
            <label className="sound-setting">
              <input
                type="checkbox"
                checked={data.sound}
                onChange={(e) =>
                  setData((d) => ({ ...d, sound: e.target.checked }))
                }
              />{" "}
              Check & Track sounds
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
        {isPersonalOwner()&&<details className="option-group">
          <summary>Starter checklist</summary>
          <div className="option-content">
            <button
              className="option-action"
              onClick={() => {
                if (
                  !data.tasks.some((t) => t.sample) &&
                  !data.routines.some((r) => r.sample)
                ) {
                  setData((d) => seed({ ...d, sampleLoaded: false }, today));
                  tools.current?.close();
                } else setNotice("Starter checklist is already loaded");
              }}
            >
              Load starter checklist
            </button>
            <button
              className="option-action"
              onClick={() => {
                if (
                  confirm(
                    "Replace the old starter schedule with the exact Apple Notes checklist? Your own tasks and completed history will stay. Old unfinished starter examples that do not belong to the corrected schedule will be replaced.",
                  )
                ) {
                  setData((d) => replaceStarterChecklist(d, today));
                  tools.current?.close();
                  setNotice("Checklist updated from your notes");
                }
              }}
            >
              Update checklist from my notes
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
                    sampleLoaded: true,
                  }));
              }}
            >
              Remove starter examples
            </button>
          </div>
        </details>}
      </dialog>
      {editor && (
        <Editor
          key={editor.task?.id || editor.routine?.id || "new"}
          editor={editor}
          categories={data.categories}
          colorSettings={data.taskColorSettings}
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
            if (editor.task) deleteTask(editor.task);
            if (editor.routine) {
              const routine=editor.routine, end=add(today,-1);
              setData((d) => ({
                ...d,
                routines: d.routines.map((r) =>
                  r.id === routine.id
                    ? { ...r, end }
                    : r,
                ),
              }));
              setUndoAction({id:uid(),label:`Removed “${routine.title}”`,restore:d=>({...d,routines:d.routines.map(r=>r.id===routine.id&&r.end===end?{...r,end:routine.end}:r)})});
            }
            setEditor(null);
          }}
        />
      )}
      <AnimatePresence>
        {celebration && <DayCelebration key={celebration.id} />}
      </AnimatePresence>
      {undoAction&&<UndoNotice key={undoAction.id} label={undoAction.label} onExpire={clearUndo} onUndo={()=>{
        setData(d=>undoAction.restore(d));
        clearUndo();
      }}/>}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </MotionConfig>
  );
}
type Destination = "home" | "checkly" | "progress" | "mapping" | "packly";
const destinations = [
  { id: "checkly", emoji: "✅", title: "Check", description: "Tasks to do" },
  { id: "mapping", emoji: "🗺️", title: "Track", description: "Habits to log" },
  { id: "progress", emoji: "📈", title: "Data", description: "See how you’re doing" },
  { id: "packly", emoji: "🎒", title: "Pack", description: "Everything for your next trip" },
] as const;
function currentDestination(): Destination {
  const section = window.location.hash.slice(1).split("/")[0];
  const hash = section === "trackly" ? "mapping" : section;
  return destinations.some((d) => d.id === hash) ? hash as Destination : "home";
}
function App() {
  const profileAvatar=useContext(ProfileContext);
  const [destination, setDestination] = useState<Destination>(currentDestination);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const update = () => setDestination(currentDestination());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.title = destination === "home" ? `${accountHomeName()} · MySpace` : `${destinations.find((d) => d.id === destination)?.title} · MySpace`;
    if (destination !== "checkly" && destination !== "mapping") {
      window.scrollTo({ top: 0, behavior: "instant" });
      heading.current?.focus({ preventScroll: true });
    }
  }, [destination]);
  const goHome = () => { window.location.hash = ""; };
  if (destination === "checkly") return <Checklist onHome={goHome} />;
  if (destination === "mapping") return <MappingPage onHome={goHome} />;
  if (destination === "progress") return <ProgressPage onHome={goHome} />;
  if (destination === "packly") return <PacklyPage onHome={goHome} />;
  return (
    <main className="eldly-page">
          <header className="eldly-heading">
            <button className="eldly-recap-settings" aria-label="View recaps" onClick={() => window.dispatchEvent(new Event("eldly-open-recaps"))}><History size={20} /><span>Recaps</span></button>
            <button className="eldly-cloud-settings" aria-label="Cloud sync settings" onClick={() => window.dispatchEvent(new Event("eldly-open-cloud-settings"))}><Cloud size={20} /></button>
            <div className="eldly-brand"><ProfileAvatar style={profileAvatar} className="eldly-logo" size={86} label="Your portrait"/><h1 ref={heading} tabIndex={-1}>{accountHomeName()}<span aria-hidden="true">.</span></h1></div>

          </header>
          <nav className="eldly-grid" aria-label="Your apps">
            {destinations.map((d) => (
              <a key={d.id} href={d.id === "mapping" ? "#trackly" : `#${d.id}`} className={`eldly-tile eldly-tile-${d.id}`}>
                <span className="eldly-tile-icon"><AppIcon app={d.id} /></span>
                <span className="eldly-tile-title">{d.title}</span>
                {(d.id === "checkly" || d.id === "mapping") && <span className="eldly-tile-hint">{d.description}</span>}

              </a>
            ))}
          </nav>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<><SiteAnalytics/><AccountBoundary><CloudBoundary><App /><RecapDialog /></CloudBoundary></AccountBoundary></>);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
