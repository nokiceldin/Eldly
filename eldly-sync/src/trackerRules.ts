import type {Habit,XPRule} from './mapping';
import {originalCoinRule} from './points';
/** Freeze the preceding rate before replacing this week's rate. */
export function datedCoinRule(habit:Habit,rule:XPRule,from:string):Pick<Habit,'xp'|'xpHistory'>{
 const old=habit.xp||originalCoinRule(habit.id);
 if(JSON.stringify(old)===JSON.stringify(rule))return {xp:rule,xpHistory:habit.xpHistory};
 const history=(habit.xpHistory||[{from:'1900-01-01',rule:old}]).filter(p=>p.from<from);
 return {xp:rule,xpHistory:[...history,{from,rule}]};
}
