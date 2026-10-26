import type {Data} from '../src/engine';
import type {CoinPolicy} from '../src/coinControl';
import type {CoinBonusPlan} from '../src/coinBonuses';
export function entryCoins(id:string,entry:unknown,rule?:unknown):number;
export function ledgerWeeks(data:Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'>,today:string,policy?:CoinPolicy|null):{from:string;to:string;current:boolean;partial:boolean;breakdown:Record<string,number>;bonusRates:CoinBonusPlan;baseTotal:number;goalBonus:number;recordBonus:number;goalsMet:{id:string;label:string}[];total:number}[];
export function ledgerWallet(data:Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'|'rewardPurchases'>,today:string,policy?:CoinPolicy|null,gifts?:number):{earned:number;spent:number;balance:number};
