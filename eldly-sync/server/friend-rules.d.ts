import type {CoinConfig,CoinPolicy} from '../src/coinControl';
export function currentFriendConfig(raw:CoinConfig,policy:CoinPolicy|null,week:string):CoinConfig;
export function coinChanges(before:CoinConfig,after:CoinConfig):string[];
