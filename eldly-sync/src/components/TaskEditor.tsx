import NumberInput from './NumberInput';
import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Plus,
  Repeat2,
  Flag,
  ChevronDown,
  Star,
  Trash2,
  Check,
} from "lucide-react";
import {
  type Task,
  type Routine,
  parse,
  localDay,
  uid,
  parseWeeklyTitle,
  parseSchoolWeeks,
} from "../engine";
import ModalClose from "./ModalClose";
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export default function Editor({
  editor,
  categories,
  close,
  onSave,
  onDelete,
  extraActions,
}: {
  editor: { task?: Task; routine?: Routine; date: string; deadline?: boolean; quick?: boolean };
  categories: string[];
  extraActions?: ReactNode;
  close: () => void;
  onSave: (t?: Task, r?: Routine) => void;
  onDelete: () => void;
}) {
  const source = editor.task || editor.routine;
  const isExisting = !!source?.title;
  const [title, setTitle] = useState(source?.title || "");
  const [type, setType] = useState(
    editor.routine
      ? "routine"
      : editor.deadline || editor.task?.deadline
        ? "deadline"
        : "task",
  );
  const [category, setCategory] = useState(source?.category || "");
  const [date, setDate] = useState(
    editor.task?.scheduled || editor.routine?.start || editor.date,
  );
  const [due, setDue] = useState(editor.task?.due || "");
  const [completedOn,setCompletedOn]=useState(editor.task?.completed||"");
  const [notes, setNotes] = useState(source?.notes || "");
  const [carry, setCarry] = useState(source?.carry ?? true);
  const [important, setImportant] = useState(source?.important || false);
  const [frequency, setFrequency] = useState<Routine["frequency"]>(
    editor.routine?.frequency || "weekly",
  );
  const [interval, setInterval] = useState(editor.routine?.interval || 1);
  const [weekdaysSelected, setWeekdays] = useState(
    editor.routine?.weekdays || [(parse(date).getDay() + 6) % 7],
  );
  const [schoolWeeksText, setSchoolWeeksText] = useState(
    editor.routine?.schoolWeeks?.join(", ") || "",
  );
  const selectedSchoolWeeks = parseSchoolWeeks(schoolWeeksText);
  const [dueOffset, setDueOffset] = useState(
    editor.routine?.dueOffsetDays?.toString() || "",
  );
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [advanced, setAdvanced] = useState(!!source);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button,input,select,textarea",
          ) || [],
        ).filter((x) => !x.hasAttribute("disabled"));
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        ref={dialog}
        className={"modal editor" + (editor.quick ? " quick-task-editor" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalClose close={close} />

        <h2 id="editor-title">
          {editor.quick ? "New task" : isExisting ? "Make it yours." : "What’s on your mind?"}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !parseWeeklyTitle(title).title ||
              (type === "routine" &&
                frequency === "weeks" &&
                !selectedSchoolWeeks)
            )
              return;
            if (type === "routine") {
              onSave(undefined, {
                id: editor.routine?.id || uid(),
                title: title.trim(),
                category,
                notes,
                start: date,
                weekdays: weekdaysSelected,
                frequency,
                interval,
                schoolWeeks:
                  frequency === "weeks"
                    ? selectedSchoolWeeks || undefined
                    : undefined,
                dueOffsetDays: dueOffset === "" ? undefined : Number(dueOffset),
                paused: editor.routine?.paused || false,
                pausedFrom: editor.routine?.pausedFrom,
                skipped: editor.routine?.skipped,
                carry,
                important,
                sample: source?.sample,
              });
            } else {
              const t = editor.task;
              onSave({
                id: t?.id || uid(),
                title: title.trim(),
                category,
                notes,
                scheduled: date,
                original: t?.original || date,
                due: type === "deadline" ? due || date : due || undefined,
                carry,
                important,
                deadline: type === "deadline",
                completed: completedOn||undefined,
                routineId: t?.routineId,
                order: t?.order ?? Date.now(),
                sample: t?.sample,
              });
            }
          }}
        >
          <label>
            Task name
            <input
              autoFocus
              required
              placeholder={editor.quick ? "Task name" : "e.g. A little progress on my project"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={250}
            />
          </label>
          {!editor.quick && (!source || (editor.task&&!editor.task.routineId&&!editor.task.completed)) && (
            <div className="type-selector">
              {[
                ["task", "One-time"],
                ["routine", "Weekly"],
                ["deadline", "Important date"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  className={type === value ? "selected" : ""}
                  key={value}
                  onClick={() => setType(value)}
                >
                  {value === "routine" ? (
                    <Repeat2 size={14} />
                  ) : value === "deadline" ? (
                    <Flag size={14} />
                  ) : (
                    <Plus size={14} />
                  )}{" "}
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="form-grid">
            <label>
              {type === "deadline"
                ? "Due date"
                : type === "routine"
                  ? "Starts on"
                  : "Scheduled for"}
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (type === "deadline") setDue(e.target.value);
                }}
              />
            </label>
            {!editor.quick && <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>}
          </div>
          {type === "routine" && (
            <div className="recurrence-fields">
              <label>
                Repeat
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as Routine["frequency"])
                  }
                >
                  <option value="weekly">Every week</option>
                  <option value="daily">Every day</option>
                  <option value="interval">
                    Every two / custom number of weeks
                  </option>
                  <option value="odd">Every odd school week</option>
                  <option value="even">Every even school week</option>
                  <option value="weeks">Specific school weeks</option>
                </select>
              </label>
              {frequency === "weeks" && (
                <label>
                  School weeks
                  <input
                    value={schoolWeeksText}
                    onChange={(e) => setSchoolWeeksText(e.target.value)}
                    placeholder="4, 7, 9, 12"
                    inputMode="text"
                    required
                    aria-invalid={!selectedSchoolWeeks}
                  />
                </label>
              )}
              {frequency === "interval" && (
                <label>
                  Repeat every (weeks)
                  <NumberInput
                    min="1"
                    max="104"
                    required
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                  />
                </label>
              )}
              {frequency !== "daily" && (
                <div className="weekday-picks">
                  {weekdays.map((day, i) => (
                    <button
                      type="button"
                      aria-label={day}
                      aria-pressed={weekdaysSelected.includes(i)}
                      className={weekdaysSelected.includes(i) ? "selected" : ""}
                      key={day}
                      onClick={() =>
                        setWeekdays((w) =>
                          w.includes(i) ? w.filter((x) => x !== i) : [...w, i],
                        )
                      }
                    >
                      {day.slice(0, 2)}
                    </button>
                  ))}
                </div>
              )}
              {frequency !== "daily" && !weekdaysSelected.length && (
                <p className="late-label">Choose at least one day.</p>
              )}
            </div>
          )}
          {!editor.quick && <button
            className="advanced-button"
            type="button"
            onClick={() => setAdvanced(!advanced)}
          >
            {advanced ? "Fewer details" : "Add a few details"}
            <ChevronDown size={15} />
          </button>}
          {advanced && (
            <>
              {type === "routine" && (
                <label>
                  Due date
                  <select
                    value={dueOffset}
                    onChange={(e) => setDueOffset(e.target.value)}
                  >
                    <option value="">No separate due date</option>
                    {Array.from({ length: 22 }, (_, i) => i - 7).map((n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? "Same day as the work"
                          : `${Math.abs(n)} ${Math.abs(n) === 1 ? "day" : "days"} ${n < 0 ? "before" : "after"} the work day`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {editor.task&&<label>Completed on<input type="date" max={localDay()} value={completedOn} onChange={e=>setCompletedOn(e.target.value)}/></label>}
              <label>
                Notes
                <textarea
                  placeholder="Anything you’d like to remember…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {type === "task" && (
                <label>
                  Due date (optional)
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={carry}
                  onChange={(e) => setCarry(e.target.checked)}
                />{" "}
                Automatically carry unfinished tasks forward
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={important}
                  onChange={(e) => setImportant(e.target.checked)}
                />
                <Star size={16} /> Mark as important
              </label>
            </>
          )}
          {extraActions}
          {confirmDelete&&<div className="task-delete-confirm" role="alert"><p>{editor.routine?"Stop future occurrences of this routine?":"Delete this task?"}</p><button type="button" className="danger" onClick={onDelete}>Confirm delete</button><button type="button" onClick={()=>setConfirmDelete(false)}>Keep it</button></div>}
          <div className="form-actions">
            {isExisting && (
              <button
                type="button"
                className="icon-button danger"
                aria-label="Delete task or future routine"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={19} />
              </button>
            )}
            <button type="button" className="secondary" onClick={close}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={
                type === "routine" &&
                ((frequency !== "daily" && !weekdaysSelected.length) ||
                  (frequency === "weeks" && !selectedSchoolWeeks))
              }
            >
              <Check size={17} />
              {isExisting
                ? "Save changes"
                : "Add " +
                  (type === "routine"
                    ? "routine"
                    : type === "deadline"
                      ? "date"
                      : "task")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
