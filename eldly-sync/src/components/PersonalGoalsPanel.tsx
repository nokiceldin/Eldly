import {archivedForWeek} from '../../shared/effective-goals';
import {coinDataForWeek} from '../coinControl';
import { personalGoalAt, personalGoalHistory } from "../personalGoals";
import { add, monday, localDay } from '../engine';
import { getHabits, mappingStart, type MappingData } from '../mapping';
import { metricStats, humanValue, type Range } from '../progress';
export default function PersonalGoalsPanel({mapping,range}:{mapping:MappingData;range:Range}){
 const today=localDay(),week=monday(range.to<today?range.to:today),effective=coinDataForWeek({mapping},week).mapping!,goals=(effective.habits||getHabits(effective)).filter(h=>!archivedForWeek(h,week)&&(!h.startedOn||h.startedOn<=week)&&personalGoalAt(h,week));
 return <section className="goals-panel"><h2>Your weekly goals</h2>{!goals.length&&<p className="personal-empty">Set an optional goal when you add or edit a tracker.</p>}{goals.map(h=>{const g=personalGoalAt(h,week)!;const average=h.kind==='sleep'||h.kind==='phone';const value=(from:string)=>{const s=metricStats(mapping,h.id,{from,to:add(from,6)});return average?s.average||0:s.total;};const actual=value(week);const {total,met}=personalGoalHistory(mapping,h,range,today);return <div key={h.id} className="goal-row"><div><strong>{h.label}</strong><span>{g.maximum?'At most':'At least'} {humanValue(g.target,h.id,mapping)}{average?'/day':'/week'}</span></div><div><strong>{humanValue(actual,h.id,mapping)}</strong><span>{met} / {total} completed weeks met</span></div></div>;})}</section>;
}
