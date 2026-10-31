import {Trophy} from 'lucide-react';
import type {WeeklyRanking} from '../social';
import ProfileAvatar from './ProfileAvatar';
import './weekly-ranking.css';

const medals=['🥇','🥈','🥉'];
const percent=(value:number)=>`${Number(value.toFixed(1))}%`;
const dateLabel=(day:string)=>new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});

export default function WeeklyRankingPanel({ranking,userId}:{ranking?:WeeklyRanking;userId:string}){
 return <section className="weekly-ranking" aria-labelledby="weekly-ranking-title">
  <div className="ranking-heading"><Trophy size={23}/><div><h3 id="weekly-ranking-title">Weekly ranking</h3><p>{ranking?`${dateLabel(ranking.from)} – ${dateLabel(ranking.to)}`:'This week'} · Resets every Monday</p></div></div>
  <p className="ranking-description">Weekly goals completed, ranked among you and your friends.</p>
  {!ranking?<p className="social-empty">Ranking unavailable. Reopen your profile to refresh.</p>:!ranking.participants.length?<p className="social-empty">No active weekly goals yet. Set a weekly goal to join the ranking.</p>:<>
   <p className="ranking-axis-title">Goals completed (%)</p>
   <div className="ranking-chart-scroll" role="region" aria-label="Weekly goal completion chart, highest to lowest" tabIndex={0}>
    <div className="ranking-chart" style={{minWidth:Math.max(260,ranking.participants.length*88+40)}}>
     <div className="ranking-ticks" aria-hidden="true">{[100,75,50,25,0].map(tick=><span key={tick}>{tick}%</span>)}</div>
     <div className="ranking-plot">
      <div className="ranking-grid" aria-hidden="true">{[100,75,50,25,0].map(tick=><span key={tick}/>)}</div>
      <div className="ranking-columns">{ranking.participants.map(person=><div key={person.userId} className={`ranking-column ${person.userId===userId?'is-you':''}`}>
       <div className="ranking-bar-area"><div className={`ranking-bar ranking-place-${person.rank}`} style={{height:`${person.percentage}%`}}><span className="ranking-bar-value">{percent(person.percentage)}</span></div></div>
       <div className="ranking-name"><span className="ranking-medal" role={person.rank<=3?'img':undefined} aria-label={person.rank<=3?['Gold medal','Silver medal','Bronze medal'][person.rank-1]:undefined}>{medals[person.rank-1]||`#${person.rank}`}</span><ProfileAvatar style={person.avatar} size={28}/><span title={`@${person.username}`}>@{person.username}</span>{person.userId===userId&&<small>You</small>}</div>
      </div>)}</div>
     </div>
    </div>
   </div>
   <ol className="ranking-results" aria-label="Weekly ranking details">{ranking.participants.map(person=><li key={person.userId}><span>{medals[person.rank-1]||`#${person.rank}`}</span><strong>@{person.username}{person.userId===userId?' (you)':''}</strong><span>{person.completed} / {person.total} goals</span><b>{percent(person.percentage)}</b></li>)}</ol>
  </>}
  <p className="ranking-note">Only people with active weekly goals appear. Having goals with 0% completed still counts. Ties are ordered by username. Goals with an upper limit count once the week ends.</p>
 </section>;
}
