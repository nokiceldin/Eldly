import StreakFlame from './StreakFlame';
export const STREAK_CELEBRATION_MS = 3800;
export default function StreakCelebration({from,to,dismiss}:{from:number;to:number;dismiss:()=>void}){
 return <div className="streak-celebration" role="status" aria-label={`${to} day streak`} onClick={dismiss}>
  <div className="streak-celebration-glow"/>
  <div className="streak-celebration-content">
   <div className="streak-live-fire"><StreakFlame size={150}/>{Array.from({length:7},(_,i)=><i className={`streak-ember ember-${i}`} key={i}/>)}</div>
   <div className="streak-roll" aria-hidden="true"><span>{from}</span><strong>{to}</strong><i className="streak-impact-ring"/></div>
   <div className="streak-celebration-label"><h2>Day streak!</h2></div>
  </div>
 </div>;
}
