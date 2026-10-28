import type {Data} from '../src/engine';
import type {CoinConfig} from '../src/coinControl';
export function coinConfig(data:Partial<Data>,owner?:boolean):CoinConfig;
export function reviewConfig(config:CoinConfig,body:{adjustments?:Record<string,unknown>;bonuses?:{goal:number;record:number}},amountsOnly?:boolean):CoinConfig;
