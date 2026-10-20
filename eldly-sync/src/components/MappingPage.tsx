import TrackerEditor from "./TrackerEditor";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { localDay, parse, format } from "../engine";
import { useMappingData } from "../useMappingData";
import { HABITS, getHabits, entryDescription, type Habit, type MappingEntry } from "../mapping";
const COLORS = { yellow: "#f3cf6d", green: "#9cdaa8", blue: "#93c9f0", pink: "#efa9ca", red: "#f09898", purple: "#baa8ed" };
export default function MappingPage({ onHome }: { onHome: () => void }) {
  const today = localDay();
  const [manage,setManage]=useState(false);
  const [month, setMonth] = useState(today.slice(0, 7) + "-01");
  const { data, error, save: write, sound, setSound } = useMappingData();
  const [editor, setEditor] = useState<{ habit: Habit; day: string } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const current = parse(month);
  const days = Array.from({ length: new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate() }, (_, i) => month.slice(0, 8) + String(i + 1).padStart(2, "0"));
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = month.slice(0, 7) === today.slice(0, 7) ? Math.max(0, Number(today.slice(-2)) - 2) * 44 : 0;
  }, [month, today]);
  const shift = (amount: number) => setMonth(localDay(new Date(current.getFullYear(), current.getMonth() + amount, 1, 12)));
  return (
    <main className="mapping-page">
      <button className="eldly-back" onClick={onHome}><ChevronLeft size={20} /> Home</button>
      <header className="mapping-title trackly-title"><div><h1 ref={heading} tabIndex={-1}>Track</h1></div><button className="trackly-sound" aria-label={sound ? "Mute Check and Track sounds" : "Enable Check and Track sounds"} aria-pressed={sound} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button></header>
      <button className="track-manage" onClick={()=>setManage(true)}>Customize trackers</button>
      {!getHabits(data).length&&<p className="personal-empty">Add your first tracker to start your own activity map.</p>}
      <div className="mapping-month-bar">
        <button aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={21} /></button>
        <button className="mapping-month-title" aria-label="Return to current month" onClick={() => setMonth(today.slice(0, 7) + "-01")}>{format(month, { month: "long", year: "numeric" })}</button>
        <button aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={21} /></button>
      </div>
      {error && <p className="mapping-error" role="alert">{error}</p>}
      <div ref={scroll} className="mapping-scroll" role="region" aria-label="Monthly activity grid, scroll for more dates" tabIndex={0}>
        <table className="mapping-grid">
          <caption className="sr-only">{format(month, { month: "long", year: "numeric" })} activity map. Select a square to record or edit an activity.</caption>
          <thead><tr><th scope="col" className="mapping-corner">{format(month, { month: "short" })}</th>{days.map((day, i) => <th scope="col" key={day} className={day === today ? "mapping-today" : ""} aria-current={day === today ? "date" : undefined}><span>{i + 1}</span><small>{format(day, { weekday: "narrow" })}</small></th>)}</tr></thead>
          <tbody>{getHabits(data).map((habit) => <tr key={habit.id} style={{ "--habit-color": COLORS[habit.color] } as CSSProperties}>
            <th scope="row"><span className="mapping-marker">{habit.label}</span></th>
            {days.map((day) => {
              const entry = data.entries[day]?.[habit.id];
              return <td key={day} className={day === today ? "mapping-today" : ""}>
                <button className={"mapping-cell" + (entry ? " is-marked" : "")} role="checkbox" aria-checked={!!entry}
                  aria-label={`${habit.label}, ${format(day)}`}
                  aria-description={entry ? entry.kind === "check" && entry.source === "checkly" ? entryDescription(entry) : `${entryDescription(entry)}. ${habit.kind === "check" ? "Select to unmark." : "Select to edit or clear."}` : "Not recorded"}
                  title={entry ? entryDescription(entry) : undefined}
                  onClick={() => entry?.kind === "check" && entry.source === "checkly" ? undefined : habit.kind === "check" ? write(day, habit.id, entry ? undefined : { kind: "check" }) : setEditor({ habit, day })}>
                  <span aria-hidden="true">{entry ? "×" : ""}</span>
                </button>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      {manage&&<TrackerEditor close={()=>setManage(false)}/>}
      {editor && <EntryEditor key={`${editor.habit.id}:${editor.day}`} habit={editor.habit} day={editor.day} entry={data.entries[editor.day]?.[editor.habit.id]}
        close={() => setEditor(null)} save={(entry) => write(editor.day, editor.habit.id, entry)} />}
    </main>
  );
}
export function EntryEditor({ habit, day, entry, close, save }: { habit: Habit; day: string; entry?: MappingEntry; close: () => void; save: (entry?: MappingEntry) => string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [hours, setHours] = useState((entry?.kind === "duration" || entry?.kind === "phone") && entry.minutes !== undefined ? String(Math.floor(entry.minutes / 60)) : "");
  const [minutes, setMinutes] = useState((entry?.kind === "duration" || entry?.kind === "phone") && entry.minutes !== undefined ? String(entry.minutes % 60) : "");
  const [pickups, setPickups] = useState(entry?.kind === "phone" && entry.pickups !== undefined ? String(entry.pickups) : "");
  const [count, setCount] = useState(entry?.kind === "prayer" ? String(entry.count) : "");
  const [night, setNight] = useState(entry?.kind === "sleep" ? String(entry.nightMinutes / 60) : "");
  const [daytime, setDaytime] = useState(entry?.kind === "sleep" ? String(entry.dayMinutes / 60) : "");
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previousOverflow; previous?.focus({ preventScroll: true }); };
  }, []);
  const commit = (value?: MappingEntry) => {
    const error = save(value);
    if (error) setError(error);
    else close();
  };
  return <dialog ref={dialog} className="mapping-dialog" aria-labelledby="mapping-entry-title" onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === dialog.current) close(); }}>
    <div className="mapping-dialog-heading"><div><span className="mapping-dialog-date">{format(day)}</span><h2 id="mapping-entry-title">{habit.label}</h2></div><button aria-label="Close entry" onClick={close}><X size={21} /></button></div>
    <form onSubmit={(e) => {
      e.preventDefault();
      if (habit.kind === "phone") {
        const hasTime = hours !== "" || minutes !== "";
        const time = hasTime ? Number(hours || 0) * 60 + Number(minutes || 0) : undefined;
        const count = pickups === "" ? undefined : Number(pickups);
        if ((time === undefined && count === undefined) || (time !== undefined && (!Number.isInteger(time) || time < 0 || time > 1440)) || (count !== undefined && (!Number.isInteger(count) || count < 0 || count > 1000000))) { setError("Enter screen time, pickups, or both. Use zero for a recorded zero."); return; }
        commit({ kind: "phone", ...(time !== undefined ? { minutes: time } : {}), ...(count !== undefined ? { pickups: count } : {}) });
      } else if (habit.kind === "duration") {
        const total = Number(hours || 0) * 60 + Number(minutes || 0);
        if ((!hours && !minutes) || !Number.isInteger(total) || total < 1 || total > 1440) { setError("Enter a duration between 1 minute and 24 hours."); return; }
        commit({ kind: "duration", minutes: total });
      } else if (habit.kind === "prayer") {
        const n = Number(count);
        if (!Number.isInteger(n) || n < 1 || n > 1000) { setError("Enter a whole-number count."); return; }
        commit({ kind: "prayer", count: n });
      } else if (habit.kind === "sleep") {
        const nightMinutes = Math.round(Number(night || 0) * 60), dayMinutes = Math.round(Number(daytime || 0) * 60);
        if ((!night && !daytime) || !Number.isFinite(nightMinutes + dayMinutes) || nightMinutes < 0 || dayMinutes < 0 || nightMinutes + dayMinutes < 0 || nightMinutes + dayMinutes > 1440) { setError("Enter your sleep, up to 24 hours in total."); return; }
        commit({ kind: "sleep", nightMinutes, dayMinutes });
      }
    }}>
      {(habit.kind === "duration" || habit.kind === "phone") && <><p>{habit.kind === "phone" ? "Screen time" : "How long?"}</p><div className="mapping-fields"><label>Hours<input autoFocus type="number" inputMode="numeric" min="0" max="24" step="1" placeholder="0" value={hours} onChange={(e) => setHours(e.target.value)} /></label><label>Minutes<input type="number" inputMode="numeric" min="0" max="59" step="1" placeholder="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label></div></>}
      {habit.kind === "phone" && <label className="phone-pickups-field">Pickups<input type="number" inputMode="numeric" min="0" max="1000000" step="1" placeholder="Not recorded" value={pickups} onChange={e => setPickups(e.target.value)} /></label>}
      {habit.kind === "prayer" && <label>How many times?<input autoFocus required type="number" inputMode="numeric" min="1" max="1000" step="1" value={count} onChange={(e) => setCount(e.target.value)} /></label>}
      {habit.kind === "sleep" && <><div className="mapping-fields"><label>Night · hours<input autoFocus type="number" inputMode="decimal" min="0" max="24" step="any" placeholder="0" value={night} onChange={(e) => setNight(e.target.value)} /></label><label>Daytime · hours<input type="number" inputMode="decimal" min="0" max="24" step="any" placeholder="0" value={daytime} onChange={(e) => setDaytime(e.target.value)} /></label></div></>}
      {error && <p className="mapping-error" role="alert">{error}</p>}
      <div className="mapping-dialog-actions">{entry && <button type="button" className="mapping-clear" onClick={() => commit()}>Clear</button>}<button type="button" className="secondary" onClick={close}>Cancel</button><button className="primary" type="submit">Save</button></div>
    </form>
  </dialog>;
}
