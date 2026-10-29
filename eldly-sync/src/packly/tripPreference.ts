import {scopedKey} from '../accountScope';
import type {TripType} from './data';
const types:TripType[]=['normal','tennis','match','weekend','custom'];
export function preferredTripType():TripType {
 try {const value=localStorage.getItem(scopedKey('pack-trip-type'));return types.includes(value as TripType)?value as TripType:'normal';}catch{return 'normal';}
}
export function rememberTripType(type:TripType){try{localStorage.setItem(scopedKey('pack-trip-type'),type);}catch{/* Packing remains available without preferences. */}}
