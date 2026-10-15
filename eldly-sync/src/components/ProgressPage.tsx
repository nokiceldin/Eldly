import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Plus, Download, SlidersHorizontal, ChevronDown, Info } from "lucide-react";
import { add, diff, format, localDay } from "../engine";
import { HABITS, entryDescription, validDate, type Habit } from "../mapping";
import { useMappingData } from "../useMappingData";
import { chartSeries, humanValue, metricLabel, metricStats, METRICS, periodRange, shiftPeriod, type Metric, type Period, type Range } from "../progress";
import { download, load } from "../storage";
import { EntryEditor } from "./MappingPage";
const COLORS: Record<Metric, string> = { tennis: "#f3cf6d", fitness: "#f3cf6d", recovery: "#9cdaa8", praying: "#9cdaa8", reading: "#93c9f0", journaling: "#93c9f0", sleep: "#78bd89", "screen-time": "#baa8ed" };
const PERIODS: { id: Period; label: string }[] = [{ id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "year", label: "Year" }, { id: "all", label: "All time" }, { id: "custom", label: "Custom" }];
export default function ProgressPage({ onHome }: { onHome: () => void }) {
  const today = localDay();
  const { data, error, save } = useMappingData();
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(today);
  const [custom, setCustom] = useState<Range>({ from: add(today, -29), to: today });
  const [day, setDay] = useState(today);
  const [editor, setEditor] = useState<Habit | null>(null);
  const [backupError, setBackupError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const dailyLog = useRef<HTMLDetailsElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); heading.current?.focus({ preventScroll: true }); }, []);
  const validRange = period !== "custom" || (validDate(custom.from) && validDate(custom.to) && custom.from <= custom.to);
  const range = period === "custom" && validRange ? custom : periodRange(period === "custom" ? "week" : period, anchor, data);
  const stats = useMemo(() => Object.fromEntries(METRICS.map(metric => [metric, metricStats(data, metric, range)])) as Record<Metric, ReturnType<typeof metricStats>>, [data, range.from, range.to]);
  const loggedDays = Object.entries(data.entries).filter(([date, row]) => date >= range.from && date <= range.to && METRICS.some(id => row[id])).length;
  const rangeLabel = `${format(range.from, { month: "short", day: "numeric", year: "numeric" })} – ${format(range.to, { month: "short", day: "numeric", year: "numeric" })}`;
  const details = data.entries[day];
  return <main className="progress-page">
    <button className="eldly-back" onClick={onHome}><ChevronLeft size={20} /> Home</button>
    <header className="progress-heading progress-heading-minimal">
      <h1 ref={heading} tabIndex={-1}>Progress</h1>
      <div className="progress-header-actions">
        <button className="progress-add-entry" aria-label="Log phone use" title="Log phone use" onClick={() => setEditor(HABITS.find(h => h.id === "screen-time")!)}><Plus size={20} /></button>
        <button className="progress-filter-toggle" aria-expanded={filtersOpen} aria-controls="progress-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} /> Filters</button>
      </div>
    </header>
    {(error || backupError) && <p role="alert" className="mapping-error">{error || backupError}</p>}
    <div className="progress-period-label">{validRange ? period === "year" ? range.from.slice(0,4) : period === "month" ? format(range.from, { month: "long", year: "numeric" }) : period === "all" ? "All time" : `${format(range.from, { month: "short", day: "numeric", ...(range.from.slice(0,4) !== today.slice(0,4) ? { year: "numeric" } : {}) })} – ${format(range.to, { month: "short", day: "numeric", ...(range.to.slice(0,4) !== today.slice(0,4) ? { year: "numeric" } : {}) })}` : "Choose dates"}</div>
    {filtersOpen && <section className="progress-filter-panel" id="progress-filters" aria-label="Date filters">
      <nav className="progress-periods" aria-label="Progress date range">{PERIODS.map(p => <button key={p.id} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}</nav>
      <div className="progress-range">
        {period !== "all" && period !== "custom" && <button aria-label="Previous period" onClick={() => setAnchor(shiftPeriod(anchor, period, -1))}><ChevronLeft size={20} /></button>}
        <span>{validRange ? rangeLabel : "Choose a valid date range"}</span>
        {period !== "all" && period !== "custom" && <button aria-label="Next period" onClick={() => setAnchor(shiftPeriod(anchor, period, 1))}><ChevronRight size={20} /></button>}
        {period !== "all" && period !== "custom" && <button className="progress-current" onClick={() => setAnchor(today)}>Today</button>}
      </div>
      {period === "custom" && <div className="progress-custom"><label>From<input type="date" min="1900-01-01" max="9999-12-31" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} /></label><label>To<input type="date" min="1900-01-01" max="9999-12-31" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} /></label></div>}
      <button className="progress-filter-done" onClick={() => setFiltersOpen(false)}>Done</button>
    </section>}
    {validRange ? <div className="progress-charts">{METRICS.map(metric => <MetricCard key={`${metric}:${range.from}:${range.to}`} metric={metric} data={data} range={range} onSelectDay={date => { setDay(date); if (dailyLog.current) { dailyLog.current.open = true; dailyLog.current.scrollIntoView({ behavior: "auto", block: "start" }); } }} />)}</div> : <p role="alert" className="mapping-error">The start date must be on or before the end date.</p>}
    <details ref={dailyLog} className="progress-daily-log progress-disclosure" id="progress-daily-log">
      <summary>Daily entries <ChevronDown size={18} /></summary>
      <div className="progress-day-switch progress-day-picker">
        <button aria-label="Previous day" onClick={() => setDay(add(day, -1))}><ChevronLeft size={18} /></button>
        <input aria-label="View a day" type="date" min="1900-01-01" max="9999-12-31" value={day} onChange={e => { if (validDate(e.target.value)) setDay(e.target.value); }} />
        <button aria-label="Next day" onClick={() => setDay(add(day, 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="progress-day-values">{METRICS.map(metric => {
        const entry = details?.[metric];
        return <button key={metric} style={{ "--metric-color": COLORS[metric] } as CSSProperties} onClick={() => setEditor(HABITS.find(h => h.id === metric)!)} aria-label={`Edit ${metricLabel(metric)} for ${format(day)}`}><span>{metricLabel(metric)}</span><strong>{entry ? entryDescription(entry) : "Not recorded"}</strong><Plus size={14} aria-hidden="true" /></button>;
      })}</div>
    </details>
    <details className="progress-disclosure progress-more">
      <summary>More <ChevronDown size={18} /></summary>
      {validRange && <div className="progress-highlights">
        <div><span>Days logged</span><strong>{loggedDays}<small> / {diff(range.to, range.from) + 1}</small></strong></div>
        <div><span>Average sleep</span><strong>{stats.sleep.average === null ? "—" : humanValue(stats.sleep.average, "sleep")}</strong></div>
        <div><span>Tennis + fitness</span><strong>{stats.tennis.days + stats.fitness.days ? humanValue(stats.tennis.total + stats.fitness.total, "tennis") : "—"}</strong></div>
      </div>}
      <p className="progress-data-note">Averages use recorded days only. Blank days aren't counted.</p>
      <footer className="progress-backup"><button onClick={() => { try { download(load()); setBackupError(""); } catch(e) { setBackupError(String(e)); } }}><Download size={16} /> Export backup</button></footer>
    </details>
    {editor && <EntryEditor key={`${editor.id}:${day}`} habit={editor} day={day} entry={data.entries[day]?.[editor.id]} close={() => setEditor(null)} save={entry => save(day, editor.id, entry)} />}
  </main>;
}
function MetricCard({ metric, data, range, onSelectDay }: { metric: Metric; data: ReturnType<typeof useMappingData>["data"]; range: Range; onSelectDay: (day: string) => void }) {
  const stats = metricStats(data, metric, range);
  const { bins, group } = chartSeries(data, metric, range);
  const [active, setActive] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const isAverage = metric === "sleep" || metric === "screen-time";
  const primary = isAverage ? stats.average : stats.total;
  const scale = metric === "praying" ? 1 : 60;
  const max = Math.max(metric === "sleep" ? 10 : 1, ...bins.map(b => b.value === null ? 0 : (b.value + b.secondary) / scale));
  const ceiling = Math.ceil(max / (max > 20 ? 10 : max > 5 ? 2 : 1)) * (max > 20 ? 10 : max > 5 ? 2 : 1);
  const isPhone = metric === "screen-time";
  const pickupSeries = isPhone ? chartSeries(data, metric, range, "pickups") : undefined;
  const pickupStats = isPhone ? metricStats(data, metric, range, "pickups") : undefined;
  const pickupMax = Math.max(0, ...(pickupSeries?.bins.map(b => b.value || 0) || []));
  const pickupCeiling = Math.max(2, Math.ceil(pickupMax / (pickupMax > 20 ? 10 : 2)) * (pickupMax > 20 ? 10 : 2));
  const left = 30, top = 12, width = isPhone ? 320 : 350, height = 120;
  const step = width / bins.length;
  const selected = active === null ? undefined : bins[active];
  const selectedPickups = active === null ? undefined : pickupSeries?.bins[active];
  const pickupPath = pickupSeries?.bins.map((b, i, all) => b.value === null ? "" : `${i && all[i-1].value !== null ? "L" : "M"}${left + (i+.5)*step},${top + height - b.value / pickupCeiling * height}`).join(" ");
  return <article className="metric-card" style={{ "--metric-color": COLORS[metric] } as CSSProperties} aria-labelledby={`metric-${metric}`}>
    <div className="metric-card-heading metric-heading-minimal">
      <h2 id={`metric-${metric}`}>{metricLabel(metric)}</h2>
      <div className="metric-value"><strong>{stats.days && primary !== null ? humanValue(primary, metric) : "—"}</strong>{isAverage && <span>avg</span>}
        <button className="metric-info" aria-label={`${metricLabel(metric)} details`} aria-expanded={infoOpen} aria-controls={`metric-info-${metric}`} onClick={() => setInfoOpen(!infoOpen)}><Info size={16} /></button>
      </div>
    </div>
    <div className="metric-chart"><svg viewBox="0 0 390 160" role="group" aria-label={`${metricLabel(metric)} chart, ${group === "day" ? "daily values" : metric === "sleep" ? `${group}ly averages` : `${group} totals`}`}>
      {[0, .5, 1].map(f => <g key={f}><line x1={left} x2={left + width} y1={top + height * (1 - f)} y2={top + height * (1 - f)} stroke="#ffffff12" /><text x={left - 7} y={top + height * (1 - f) + 3} textAnchor="end" fill="#858b81" fontSize={9}>{Number((ceiling * f).toFixed(1))}{metric === "praying" ? "" : "h"}</text></g>)}
      {bins.map((b, i) => {
        const x = left + i * step, w = Math.max(2, step * .64), yScale = height / (ceiling * scale), primaryH = (b.value || 0) * yScale, secondaryH = b.secondary * yScale;
        const tooltip = `${b.label}: ${b.value === null ? "Not recorded" : humanValue(b.value + b.secondary, metric)}${b.days > 1 && metric === "sleep" ? " average" : ""}`;
        return <g key={b.from}>
          {b.value !== null && <g role="button" tabIndex={0} aria-label={`${tooltip}. View day.`} onFocus={() => setActive(i)} onMouseEnter={() => setActive(i)} onClick={() => { setActive(i); onSelectDay(b.exampleDate || b.from); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(i); onSelectDay(b.exampleDate || b.from); } }}>
            <title>{tooltip}</title><rect x={x} y={top} width={step} height={height} fill="transparent" />
            <rect x={x + (step - w) / 2} y={top + height - Math.max(primaryH, b.secondary ? 0 : 2)} width={w} height={Math.max(primaryH, b.secondary ? 0 : 2)} fill={COLORS[metric]} opacity={active === null || active === i ? .95 : .5} rx={Math.min(3, w / 3)} />
            {secondaryH > 0 && <rect x={x + (step - w) / 2} y={top + height - primaryH - secondaryH} width={w} height={secondaryH} fill="#c5edb9" rx={Math.min(3, w / 3)} />}
          </g>}
          {(i === 0 || i === bins.length - 1 || i % Math.ceil(bins.length / 5) === 0) && <text x={x + step / 2} y={152} textAnchor="middle" fill="#92988d" fontSize={8}>{b.label}</text>}
        </g>;
      })}
      {isPhone && <>
        {[0,.5,1].map(f => <text key={f} x={left+width+8} y={top+height*(1-f)+3} fill="#9fcbbb" fontSize={9}>{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(pickupCeiling*f)}</text>)}
        <path d={pickupPath} fill="none" stroke="#9fd5bd" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        {pickupSeries?.bins.map((b,i) => b.value === null ? null : <g key={b.from} role="button" tabIndex={0} aria-label={`${b.label}: ${b.value} pickups. View day.`} onFocus={() => setActive(i)} onMouseEnter={() => setActive(i)} onClick={() => { setActive(i); onSelectDay(b.exampleDate || b.from); }} onKeyDown={e => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(i); onSelectDay(b.exampleDate || b.from); } }}>
          <title>{b.label}: {b.value} pickups</title>
          <circle cx={left+(i+.5)*step} cy={top+height-b.value/pickupCeiling*height} r="11" fill="transparent" />
          <circle cx={left+(i+.5)*step} cy={top+height-b.value/pickupCeiling*height} r="3.5" fill="#9fd5bd" stroke="#21231f" strokeWidth="1.5" pointerEvents="none" />
        </g>)}
      </>}
    </svg>{!stats.days && !pickupStats?.days && <span className="metric-empty">No entries</span>}</div>
    {isPhone && <div className="metric-legend phone-use-legend"><span><i style={{ background: COLORS[metric] }} />Screen time</span><span><i style={{ background: "#9fd5bd", borderRadius: "50%" }} />Pickups{pickupStats?.average !== null && pickupStats?.average !== undefined ? ` · ${Math.round(pickupStats.average)} avg` : ""}</span></div>}
    {metric === "sleep" && <div className="metric-legend"><span><i style={{ background: COLORS.sleep }} />Night</span><span><i style={{ background: "#c5edb9" }} />Daytime</span></div>}
    {selected && (selected.value !== null || selectedPickups?.value !== null && selectedPickups?.value !== undefined) && <div className="metric-foot">{selected.label} · {selected.value !== null ? humanValue(selected.value + selected.secondary, metric) : "—"}{selectedPickups?.value !== null && selectedPickups?.value !== undefined ? ` · ${selectedPickups.value} pickups` : ""}{metric === "sleep" && selected.days > 1 ? " avg" : ""}</div>}
    {infoOpen && <div className="metric-info-panel" id={`metric-info-${metric}`}>
      <p>{stats.days} {stats.days === 1 ? "day" : "days"} logged{stats.days ? ` · ${humanValue(stats.average!, metric)} average` : ""}</p>
      {isPhone && <p>Pickups: {pickupStats?.total || 0} total · {pickupStats?.days || 0} days logged. Hours use the left axis; pickups use the right.</p>}
      {metric === "sleep" && stats.days > 0 && <p>{stats.eightHourDays} of {stats.days} days reached 8 hours</p>}
      <p>{metric === "sleep" ? "Average sleep" : "Totals"} by {group}. Missing days aren't counted in averages.</p>
    </div>}

  </article>;
}
