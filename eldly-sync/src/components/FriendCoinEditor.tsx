import NumberInput from './NumberInput';
import {useState} from 'react';
import {Send} from 'lucide-react';
import type {CoinConfig} from '../coinControl';
export default function FriendCoinEditor({rules,busy,submit}:{rules:{userId:string;version:string;config:CoinConfig;needsApproval?:boolean};busy:boolean;submit:(body:Record<string,unknown>)=>Promise<void>}){
 const [initial]=useState(rules);
 const [amounts,setAmounts]=useState(()=>Object.fromEntries(rules.config.habits.map(h=>[h.id,{amount:h.xp?.amount??0,secondary:h.xp?.secondary?.amount}])));
 const latest=rules.config.coinBonusPlans.at(-1)||{goal:0,record:0};
 const [bonuses,setBonuses]=useState({goal:latest.goal,record:latest.record});
 return <form className="friend-coin-editor" onSubmit={e=>{e.preventDefault();void submit({action:'set_friend_rules',userId:initial.userId,version:initial.version,adjustments:Object.fromEntries(Object.entries(amounts).map(([id,r])=>[id,{amount:r.amount,...(r.secondary!==undefined?{secondary:{amount:r.secondary}}:{})}])),bonuses});}}>
  <p className="social-muted">You set coins. Your friend sets rules and goals.</p>
  {initial.config.habits.filter(h=>!h.archived).map(h=>{const r=amounts[h.id],rule=h.xp!;return <section className="friend-coin-rule" key={h.id}>
   <h3>{h.label}</h3>
   <small className="social-muted">Per {rule.basis==='hour'?'hour':rule.basis==='count'?'time':'day logged'}{rule.threshold?` · ${rule.threshold.comparison==='over'?'more than':'less than'} ${rule.threshold.minutes/60}h`:''}{rule.weeklyCap!==undefined?` · max ${rule.weeklyCap} coins/week`:''}</small>
   <label>Coins<NumberInput required aria-label={`${h.label} coins`} min="-1000" max="1000" step="0.1" value={r.amount} onChange={e=>setAmounts(all=>({...all,[h.id]:{...all[h.id],amount:Number(e.target.value)}}))}/></label>
   {rule.secondary&&<label>Coins below {rule.secondary.belowMinutes/60} hours<NumberInput aria-label={`${h.label} alternate coins`} min="-1000" max="1000" step="0.1" value={r.secondary??0} onChange={e=>setAmounts(all=>({...all,[h.id]:{...all[h.id],secondary:Number(e.target.value)}}))}/></label>}
  </section>;})}
  <details className="friend-bonuses"><summary>Weekly bonuses</summary><div className="social-input-pair"><label>Per goal<NumberInput required min="0" max="1000000" step="0.1" value={bonuses.goal} onChange={e=>setBonuses(b=>({...b,goal:Number(e.target.value)}))}/></label><label>Record week<NumberInput required min="0" max="1000000" step="0.1" value={bonuses.record} onChange={e=>setBonuses(b=>({...b,record:Number(e.target.value)}))}/></label></div></details>
  <button className="social-primary friend-rules-submit" disabled={busy}><Send size={16}/>{busy?'Sending…':initial.needsApproval?'Confirm coins':'Submit changes'}</button>
 </form>;
}
