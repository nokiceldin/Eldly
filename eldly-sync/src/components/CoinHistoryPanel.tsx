import {coinHistory} from '../rewards';
import {format,type Data} from '../engine';
import {formatPoints} from '../points';
import type {Range} from '../progress';
export default function CoinHistoryPanel({data,range}:{data:Data;range:Range}){
 const weeks=coinHistory(data).filter(w=>w.to>=range.from&&w.from<=range.to),closed=weeks.filter(w=>!w.current&&!w.partial),best=closed.reduce<typeof closed[number]|null>((a,b)=>!a||b.recordScore>a.recordScore?b:a,null),average=closed.length?closed.reduce((n,w)=>n+w.total,0)/closed.length:null;
 return <details className="metric-target-history coin-history"><summary>Weekly coin history</summary><div><span>Average completed week</span><strong>{average===null?'—':formatPoints(average)}</strong></div>{best&&<div><span>Best week · {format(best.from,{month:'short',day:'numeric'})}</span><strong>{formatPoints(best.recordScore)} before record bonus</strong></div>}<div className="recap-table-scroll"><table><thead><tr><th>Week of</th><th>Tracking</th><th>Goals</th><th>Record</th><th>Total</th></tr></thead><tbody>{weeks.slice().reverse().map(w=><tr key={w.from}><th>{format(w.from,{month:'short',day:'numeric',year:'numeric'})}{w.current?' · current':''}</th><td>{formatPoints(w.baseTotal)}</td><td>{formatPoints(w.goalBonus)}</td><td>{formatPoints(w.recordBonus)}</td><td>{formatPoints(w.total)}</td></tr>)}</tbody></table></div></details>;
}
