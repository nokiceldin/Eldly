const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const previous=d=>{const n=new Date(d+'T12:00:00Z');n.setUTCDate(n.getUTCDate()-1);return n.toISOString().slice(0,10);};
export function trackedEntry(e){
 if(!e||typeof e!=='object')return false;
 const n=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 return e.kind==='check'||e.kind==='duration'&&n(e.minutes)&&e.minutes>0||e.kind==='prayer'&&n(e.count)&&e.count>0||e.kind==='sleep'&&n(e.nightMinutes)&&n(e.dayMinutes)||e.kind==='phone'&&(n(e.minutes)||n(e.pickups));
}
export function trackingStreak(mapping,today){
 const days=Object.entries(mapping?.entries||{}).filter(([day,row])=>validDay(day)&&day<=today&&day>=(mapping?.startedOn||'2026-10-15')&&row&&Object.values(row).some(trackedEntry)).map(([day])=>day).sort();
 let longest=0,run=0,last=null;
 for(const day of days){run=last===previous(day)?run+1:1;longest=Math.max(longest,run);last=day;}
 return {streak:last===today||last===previous(today)?run:0,longest,lastTracked:last,trackedToday:last===today};
}
