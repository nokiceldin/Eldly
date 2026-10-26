import type {MappingData} from '../src/mapping';
export function trackedEntry(entry:unknown):boolean;
export function trackingStreak(mapping:MappingData|undefined,today:string):{streak:number;longest:number;lastTracked:string|null;trackedToday:boolean};
