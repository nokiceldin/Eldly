import type {MappingEntry} from './mapping';
export function splitSleepMinutes(value?:number){return value===undefined?{hours:'',minutes:''}:{hours:String(Math.floor(value/60)),minutes:String(value%60)};}
export function sleepEntry(nightHours:string,nightMinutes:string,dayHours:string,dayMinutes:string):Extract<MappingEntry,{kind:'sleep'}>|null{
 const fields=[nightHours,nightMinutes,dayHours,dayMinutes];
 if(fields.every(v=>v==='')||fields.some((v,i)=>!Number.isInteger(Number(v))||Number(v)<0||Number(v)>(i%2?59:24)))return null;
 const night=Number(nightHours)*60+Number(nightMinutes),day=Number(dayHours)*60+Number(dayMinutes);
 return night+day>1440?null:{kind:'sleep',nightMinutes:night,dayMinutes:day};
}
