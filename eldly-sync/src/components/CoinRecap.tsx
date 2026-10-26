import CoinIcon from './CoinIcon';
import {  Trophy, Target, Check } from 'lucide-react';
import type { Data } from '../engine';
import { coinHistory } from '../rewards';
import { formatPoints } from '../points';
export default function CoinRecap({data,from,today}:{data:Data;from:string;today:string}){
 const week=coinHistory(data,today).find(w=>w.from===from);if(!week||week.current)return null;
 return <section className="coin-recap"><span className="rewards-eyebrow"><CoinIcon/> YOUR WEEK, REWARDED</span><h2>{week.recordBonus?'An amazing week.':week.goalBonus?'You kept your promises.':'Every step adds up.'}</h2><div className="coin-recap-total"><CoinIcon/><strong>{formatPoints(week.total)}</strong><span>coins earned</span></div><div className="coin-bonus-row"><span>From your trackers</span><b>{formatPoints(week.baseTotal)}</b></div>{week.goalBonus>0&&<><div className="coin-bonus-row"><span><Target size={16}/>{week.goalsMet.length} {week.goalsMet.length===1?'goal achieved':'goals achieved'}</span><b>+{formatPoints(week.goalBonus)}</b></div><div className="coin-goal-chips">{week.goalsMet.map(g=><span key={g.id}><Check size={12}/>{g.label}<b>+{formatPoints(week.bonusRates.goal)}</b></span>)}</div></>}{week.recordBonus>0&&<div className="coin-record"><Trophy size={23}/><span><strong>A new personal best!</strong>Your best tracking + goal coins.</span><b>+{formatPoints(week.recordBonus)}</b></div>}{week.partial&&<small>Your first full week unlocks weekly bonuses.</small>}</section>;
}
