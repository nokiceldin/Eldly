import { TRACKING_START } from "../tracking";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { format, localDay, type Data } from "../engine";
import { humanValue } from "../progress";
import { buildRecap, pendingRecaps, recapWindows, type RecapWindow } from "../recaps";
import { initialGoalPlan, goalHistory, goalValueLabel, weeklyGoals, goalRecommendations, applyGoalRecommendation } from "../goals";
import { load, persist } from "../storage";
import { LOCAL_EVENT, REMOTE_EVENT } from "../sync/local";
const labels = { week: "Weekly", month: "Monthly", year: "Yearly" };
export default function RecapDialog() {
  const [data, setData] = useState<Data | null>(null);
  const [today, setToday] = useState(localDay());
  const [manual, setManual] = useState<RecapWindow[] | null>(null);
  const [error, setError] = useState("");
  const [applied,setApplied] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const refresh = () => { try { const latest = load(); if (!latest.goalPlans?.length) { persist({ ...latest, goalPlans: [initialGoalPlan(latest)] }); } setData(load()); setToday(localDay()); } catch { /* Existing save errors are displayed by the app. */ } };
    const open = () => { refresh(); setManual(recapWindows(localDay())); };
    refresh();
    window.addEventListener(LOCAL_EVENT, refresh);
    window.addEventListener(REMOTE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("eldly-open-recaps", open);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener(LOCAL_EVENT, refresh); window.removeEventListener(REMOTE_EVENT, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("eldly-open-recaps", open); };
  }, []);
  const queue = data ? manual ?? pendingRecaps(data, today) : [];
  const current = queue[0];
  const recap = data && current ? buildRecap(data, current, today) : null;
  useLayoutEffect(() => {
    if (current && !dialog.current?.open) dialog.current?.showModal();
  }, [current?.id]);
  function dismiss() {
    if (!current) return;
    try {
      const latest = load();
      persist({ ...latest, recapSeen: { ...latest.recapSeen, [current.id]: true } });
      setData(load());
      if (manual) setManual(manual.length > 1 ? manual.slice(1) : null);
      setError("");
    } catch { setError("Could not save. Please try again."); }
  }
  if (!recap) return null;
  const range = (r: { from: string; to: string }) => `${format(r.from, { month: "short", day: "numeric", year: "numeric" })} – ${format(r.to, { month: "short", day: "numeric", year: "numeric" })}`;
  return <dialog ref={dialog} className="recap-dialog" aria-labelledby="recap-title" onCancel={e => { e.preventDefault(); dismiss(); }}>
    <header className="recap-heading"><div><span className="recap-eyebrow">{labels[recap.period]} recap</span><h1 id="recap-title">{recap.period === "week" ? "Your week" : recap.period === "month" ? "Your month" : "Your year"}</h1><p>{range({ ...recap.range, from: recap.range.from < TRACKING_START ? TRACKING_START : recap.range.from })}</p></div><button aria-label="Close recap" onClick={dismiss}><X size={22} /></button></header>
    <div className="recap-topline"><strong>{recap.completed}<span>tasks completed</span></strong><strong>{recap.days}<span>days</span></strong></div>
    <div className="recap-insights">
      <section><h2>Positives</h2>{recap.positives.length ? <ul>{recap.positives.map(text => <li key={text}>{text}</li>)}</ul> : <p>No completed activities this period.</p>}</section>
      <section><h2>Room to improve</h2>{recap.attention.length ? <ul>{recap.attention.map(text => <li key={text}>{text}</li>)}</ul> : <p>{recap.metrics.some(row=>row.previous.days)?`No declines from the previous ${recap.period}.`:"No earlier tracking period to compare."}</p>}</section>
    </div>
    {data && goalHistory(data,recap.range,today).weeks.length > 0 && <section className="recap-data"><h2>Weekly goals</h2>{recap.period === "week" && data && goalHistory(data,recap.range,today).weeks.length > 0 && <div className="goal-rows">{weeklyGoals(data,recap.range.from,today).map(goal => <div key={goal.id} className={`goal-row ${goal.met?'goal-met':''}`}><div><strong>{goal.label}</strong><span>{goal.maximum?'≤':'≥'} {goalValueLabel(goal,goal.target)}</span></div><div><strong>{goalValueLabel(goal,goal.actual)}</strong><span>{goal.met?'Met':'Not met'}</span></div></div>)}</div>}<div className="recap-goals">{data && goalHistory(data, recap.range, today).summary.map(goal => <div key={goal.id}><span>{goal.label}</span><strong>{goal.met} / {goal.total}<small>weeks met</small></strong></div>)}</div></section>}
    {recap.period === "month" && data && goalRecommendations(data,recap.range).length > 0 && <section className="recap-data"><h2>Next month</h2><div className="goal-suggestions">{goalRecommendations(data,recap.range).map(goal=><div key={goal.id}><div><strong>{goal.label}: {goalValueLabel(goal,goal.proposed)}</strong><p>{goal.reason} · current goal {goalValueLabel(goal,goal.target)}</p></div><button disabled={applied.includes(`${recap.id}:${goal.id}`)} onClick={()=>{try {persist(applyGoalRecommendation(load(),goal.id,goal.proposed,today));setData(load());setApplied(old=>[...old,`${recap.id}:${goal.id}`]);}catch{setError("Could not save the new goal.");}}}>{applied.includes(`${recap.id}:${goal.id}`)?"Scheduled":"Use next week"}</button></div>)}</div></section>}
    <section className="recap-data"><h2>The numbers</h2><p className="recap-comparison">Compared with {range(recap.previous)}</p><div className="recap-table-scroll"><table><thead><tr><th scope="col">Activity</th><th scope="col">This {recap.period}</th><th scope="col">Previous</th></tr></thead><tbody>{recap.metrics.map(row => {
      const average = row.metric === "sleep" || row.metric === "screen-time";
      return <tr key={row.metric}><th scope="row">{row.label}{average ? " · daily avg" : " · total"}</th><td>{humanValue(average ? row.current.average || 0 : row.current.total, row.metric)}</td><td>{row.previous.days ? humanValue(average ? row.previous.average || 0 : row.previous.total, row.metric) : "—"}</td></tr>;
    })}</tbody></table></div></section>
    {error && <p role="alert">{error}</p>}
    <button className="recap-done" onClick={dismiss}>{queue.length > 1 ? "Next recap" : "Done"}<ChevronRight size={18} /></button>
  </dialog>;
}
