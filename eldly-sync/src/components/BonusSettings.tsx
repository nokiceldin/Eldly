import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { bonusPlanAt, saveBonusPlan } from '../coinBonuses';
import { load,persist } from '../storage';
export default function BonusSettings(){
 const [before,setBefore]=useState(()=>bonusPlanAt(load())),[goal,setGoal]=useState(()=>String(before.goal)),[record,setRecord]=useState(()=>String(before.record)),[message,setMessage]=useState(''),[error,setError]=useState('');
 return <section className="bonus-settings" aria-labelledby="bonus-settings-title"><h3 id="bonus-settings-title"><Trophy size={16}/>Weekly bonuses</h3><form onSubmit={e=>{e.preventDefault();try{persist(saveBonusPlan(load(),Number(goal),Number(record),before));const saved=bonusPlanAt(load());setBefore(saved);setGoal(String(saved.goal));setRecord(String(saved.record));setMessage('Saved for this week onward.');setError('');}catch(e){setError(e instanceof Error?e.message:'Could not save bonuses.');}}}><div className="settings-pair"><label>Coins per goal hit<input required type="number" min="0" max="1000000" step="0.1" value={goal} onChange={e=>{setGoal(e.target.value);setMessage('');}}/></label><label>New weekly record bonus<input required type="number" min="0" max="1000000" step="0.1" value={record} onChange={e=>{setRecord(e.target.value);setMessage('');}}/></label></div><div className="bonus-settings-footer"><small>Past weeks keep their bonus rates. Zero turns a bonus off.</small><button type="submit">Save bonuses</button></div>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</form></section>;
}
