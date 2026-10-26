import {localDay} from './engine';
import {mappingStart,type MappingData} from './mapping';
export function canTrack(data:MappingData,id:string,day:string,today=localDay()){
 const start=data.habits?.find(h=>h.id===id)?.startedOn||mappingStart(data);
 return day>=mappingStart(data)&&day>=start&&day<=today;
}
