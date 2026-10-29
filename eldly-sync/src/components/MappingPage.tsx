import {useLocalDay} from '../useLocalDay';
import DailyAppShortcut from './DailyAppShortcut';
import {readTrackingView,rememberTrackingView,type TrackingView} from '../trackingView';
import {splitSleepMinutes,sleepEntry} from '../sleepEntry';
import {canTrack} from '../trackingBounds';
import NumberInput from './NumberInput';
import TrackerSettings from './TrackerSettings';
import RewardsCard from './RewardsCard';
import TrackerEditor from "./TrackerEditor";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X, Plus, Check } from "lucide-react";
import { localDay, parse, format, add } from "../engine";
import { useMappingData } from "../useMappingData";
import { HABITS, getHabits, entryDescription, type Habit, type MappingEntry } from "../mapping";
const COLORS = { yellow: "#f3cf6d", green: "#9cdaa8", blue: "#93c9f0", pink: "#efa9ca", red: "#f09898", purple: "#baa8ed" };
export default function MappingPage({ onHome }: { onHome: () => void }) {
  const today = useLocalDay();
  const [manage,setManage]=useState(() => window.location.hash.endsWith('/new'));
  const [view,setView]=useState<TrackingView>(readTrackingView);
  const [day,setDay]=useState(today);
  const previousToday=useRef(today);
  useEffect(()=>{const previous=previousToday.current;setDay(selected=>selected===previous?today:selected);previousToday.current=today;},[today]);
  const closeManage=()=>{setManage(false);if(window.location.hash.endsWith('/new'))window.location.hash='trackly';};
  const [settings,setSettings]=useState<string|null>(null);
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
  }, [month, today, view, data.habits?.length]);
  const shift = (amount: number) => setMonth(localDay(new Date(current.getFullYear(), current.getMonth() + amount, 1, 12)));
  return (
    <main className="mapping-page">
      <DailyAppShortcut to="check"/>
      <button className="eldly-back" onClick={onHome}><ChevronLeft size={20} /> Home</button>
      <header className="mapping-title trackly-title"><div><h1 ref={heading} tabIndex={-1}>Track</h1></div><button className="trackly-sound" aria-label={sound ? "Mute Check and Track sounds" : "Enable Check and Track sounds"} aria-pressed={sound} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button></header>
      <div className="tracking-toolbar"><div className="tracking-views" role="group" aria-label="Tracking view">{(['monthly','daily'] as const).map(mode=><button key={mode} aria-pressed={view===mode} onClick={()=>{setView(mode);rememberTrackingView(mode);}}>{mode==='monthly'?'Monthly':'Daily'}</button>)}</div>{getHabits(data).length>0&&<button className="track-manage" onClick={()=>setManage(true)}>Customize trackers</button>}</div>
      {!getHabits(data).length?<section className="app-empty"><h2>Start with one habit.</h2><p>Check off a habit or log your time.</p><button className="empty-action" onClick={()=>setManage(true)}><Plus size={17}/> Add your first tracker</button></section>:view==='daily'?<section className="tracking-daily" aria-label="Daily tracking">
        <div className="mapping-month-bar"><button aria-label="Previous day" onClick={()=>setDay(add(day,-1))}><ChevronLeft size={21}/></button><button className="mapping-month-title" onClick={()=>setDay(today)} aria-label="Return to today">{day===today?'Today':format(day,{weekday:'long'})}<small>{format(day,{month:'short',day:'numeric',year:'numeric'})}</small></button><button aria-label="Next day" disabled={day>=today} onClick={()=>setDay(add(day,1))}><ChevronRight size={21}/></button></div>
        <div className="daily-trackers">{getHabits(data).map(habit=>{
          const entry=data.entries[day]?.[habit.id];
          const linked=entry?.kind==='check'&&entry.source==='checkly';
          return <div className="daily-tracker" key={habit.id} style={{'--habit-color':COLORS[habit.color]} as CSSProperties}><i aria-hidden="true"/><div><strong>{habit.label}</strong><span>{entry?entryDescription(entry,habit):'Not recorded'}{linked?' · Managed in Check':''}</span></div><button disabled={!canTrack(data,habit.id,day,today)||linked} aria-label={`${habit.kind==='check'?(entry?'Unmark':'Complete'):(entry?'Edit':'Log')} ${habit.label}`} aria-pressed={habit.kind==='check'?!!entry:undefined} className={entry?'is-recorded':''} onClick={()=>habit.kind==='check'?write(day,habit.id,entry?undefined:{kind:'check'}):setEditor({habit,day})}>{habit.kind==='check'?(entry?<Check size={21}/>:<Plus size={21}/>):entry?'Edit':'Log'}</button></div>;
        })}</div>
      </section>:<>
      <div className="mapping-month-bar">
        <button aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={21} /></button>
        <button className="mapping-month-title" aria-label="Return to current month" onClick={() => setMonth(today.slice(0, 7) + "-01")}>{format(month, { month: "long", year: "numeric" })}</button>
        <button aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={21} /></button>
      </div>
      <div ref={scroll} className="mapping-scroll" role="region" aria-label="Monthly activity grid, scroll for more dates" tabIndex={0}>
        <table className="mapping-grid">
          <caption className="sr-only">{format(month, { month: "long", year: "numeric" })} activity map. Select a square to record or edit an activity.</caption>
          <thead><tr><th scope="col" className="mapping-corner">{format(month, { month: "short" })}</th>{days.map((day, i) => <th scope="col" key={day} className={day === today ? "mapping-today" : ""} aria-current={day === today ? "date" : undefined}><span>{i + 1}</span><small>{format(day, { weekday: "narrow" })}</small></th>)}</tr></thead>
          <tbody>{getHabits(data).map((habit) => <tr key={habit.id} style={{ "--habit-color": COLORS[habit.color] } as CSSProperties}>
            <th scope="row"><button className="mapping-marker tracker-name-button" aria-label={`Edit ${habit.label} tracker`} onClick={()=>setSettings(habit.id)}>{habit.label}</button></th>
            {days.map((day) => {
              const entry = data.entries[day]?.[habit.id];
              return <td key={day} className={day === today ? "mapping-today" : ""}>
                <button className={"mapping-cell" + (entry ? " is-marked" : "")} role="checkbox" aria-checked={!!entry}
                  aria-label={`${habit.label}, ${format(day)}`}
                  aria-description={entry ? entry.kind === "check" && entry.source === "checkly" ? entryDescription(entry,habit) : `${entryDescription(entry,habit)}. ${habit.kind === "check" ? "Select to unmark." : "Select to edit or clear."}` : "Not recorded"}
                  title={entry ? entryDescription(entry,habit) : undefined}
                  disabled={!canTrack(data,habit.id,day,today)}
                  onClick={() => entry?.kind === "check" && entry.source === "checkly" ? undefined : habit.kind === "check" ? write(day, habit.id, entry ? undefined : { kind: "check" }) : setEditor({ habit, day })}>
                  <span aria-hidden="true">{entry ? "×" : ""}</span>
                </button>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      </>}
      {error && <p className="mapping-error" role="alert">{error}</p>}
      <RewardsCard/>
      {settings&&<TrackerSettings key={settings} id={settings} close={()=>setSettings(null)}/>}
      {manage&&<TrackerEditor close={closeManage} onEdit={id=>{closeManage();setSettings(id);}}/>}
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
  const [night, setNight] = useState(entry?.kind === "sleep" ? splitSleepMinutes(entry.nightMinutes).hours : "");
  const [daytime, setDaytime] = useState(entry?.kind === "sleep" ? splitSleepMinutes(entry.dayMinutes).hours : "");
  const [nightMins,setNightMins]=useState(entry?.kind==='sleep'?splitSleepMinutes(entry.nightMinutes).minutes:'');
  const [dayMins,setDayMins]=useState(entry?.kind==='sleep'?splitSleepMinutes(entry.dayMinutes).minutes:'');
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
        const value=sleepEntry(night,nightMins,daytime,dayMins);
        if(!value){setError("Enter whole hours and minutes, up to 24 hours in total.");return;}
        commit(value);
      }
    }}>
      {(habit.kind === "duration" || habit.kind === "phone") && <><p>{habit.kind === "phone" ? "Screen time" : "How long?"}</p><div className="mapping-fields"><label>Hours<NumberInput autoFocus inputMode="numeric" min="0" max="24" step="1" placeholder="0" value={hours} onChange={(e) => setHours(e.target.value)} /></label><label>Minutes<NumberInput inputMode="numeric" min="0" max="59" step="1" placeholder="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label></div></>}
      {habit.kind === "phone" && <label className="phone-pickups-field">Pickups<NumberInput inputMode="numeric" min="0" max="1000000" step="1" placeholder="Not recorded" value={pickups} onChange={e => setPickups(e.target.value)} /></label>}
      {habit.kind === "prayer" && <label>How many times?<NumberInput autoFocus required inputMode="numeric" min="1" max="1000" step="1" value={count} onChange={(e) => setCount(e.target.value)} /></label>}
      {habit.kind === "sleep" && <>
        <p>Night</p><div className="mapping-fields"><label>Hours<NumberInput aria-label="Night hours" autoFocus inputMode="numeric" min="0" max="24" step="1" placeholder="0" value={night} onChange={e=>setNight(e.target.value)}/></label><label>Minutes<NumberInput aria-label="Night minutes" inputMode="numeric" min="0" max="59" step="1" placeholder="0" value={nightMins} onChange={e=>setNightMins(e.target.value)}/></label></div>
        <p>Daytime</p><div className="mapping-fields"><label>Hours<NumberInput aria-label="Daytime hours" inputMode="numeric" min="0" max="24" step="1" placeholder="0" value={daytime} onChange={e=>setDaytime(e.target.value)}/></label><label>Minutes<NumberInput aria-label="Daytime minutes" inputMode="numeric" min="0" max="59" step="1" placeholder="0" value={dayMins} onChange={e=>setDayMins(e.target.value)}/></label></div>
      </>}
      {error && <p className="mapping-error" role="alert">{error}</p>}
      <div className="mapping-dialog-actions">{entry && <button type="button" className="mapping-clear" onClick={() => commit()}>Clear</button>}<button type="button" className="secondary" onClick={close}>Cancel</button><button className="primary" type="submit">Save</button></div>
    </form>
  </dialog>;
}
