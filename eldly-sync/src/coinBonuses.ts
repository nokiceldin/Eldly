import { localDay, monday, type Data } from './engine';
import { validDate } from './mapping';
export type CoinBonusPlan={id:string;from:string;goal:number;record:number};
export const validBonus=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1000000&&Math.abs(n*10-Math.round(n*10))<.000001;
export function validBonusPlans(plans:unknown):boolean{
 return plans===undefined||Array.isArray(plans)&&plans.every(p=>p&&typeof p.id==='string'&&validDate(p.from)&&monday(p.from)===p.from&&validBonus(p.goal)&&validBonus(p.record))&&new Set(plans.map(p=>p.id)).size===plans.length;
}
export function bonusPlanAt(data:Pick<Data,'coinBonusPlans'>,week=monday(localDay())){
 return [...(data.coinBonusPlans||[])].filter(p=>p.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0]||{id:'original',from:'1900-01-01',goal:3,record:20};
}
export function saveBonusPlan(data:Data,goal:number,record:number,before:{goal:number;record:number},today=localDay()):Data{
 if(!validBonus(goal)||!validBonus(record))throw Error('Use zero or a positive coin amount, with at most one decimal.');
 const from=monday(today),latest=bonusPlanAt(data,from),changes={goal,record};
 for(const key of ['goal','record'] as const){if(changes[key]!==before[key]&&latest[key]!==before[key])throw Error('This bonus changed on another device. Reopen Customize trackers.');if(changes[key]===before[key])changes[key]=latest[key];}
 return {...data,coinBonusPlans:[...(data.coinBonusPlans||[]).filter(p=>p.from!==from),{id:`coin-bonus:${from}`,from,...changes}]};
}
