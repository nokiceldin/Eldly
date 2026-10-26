import type {Data} from '../src/engine';
import type {Habit} from '../src/mapping';
import type {CoinPolicy,CoinConfig} from '../src/coinControl';
export function weekOf(day:string):string;
export function configAt(policy:CoinPolicy|null,week:string):CoinConfig|null;
export function archivedForWeek(habit:Habit|undefined,week:string):boolean;
export function effectiveData<T extends Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'>>(data:T,week:string,policy:CoinPolicy|null):T;

export function ruleAt(habit:Habit|undefined,week:string):Habit['xp'];
