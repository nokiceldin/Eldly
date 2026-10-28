import type {Habit,XPRule} from '../src/mapping';
export function partnerAmounts(rule:XPRule,approved?:XPRule):XPRule;
export function ownerRulesForWeek(raw:Habit|undefined,approved:Habit|undefined,week:string,rule?:XPRule):Habit|undefined;
