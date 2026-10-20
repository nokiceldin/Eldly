/** One mote per XP, with a smaller final mote for fractional XP. Batch huge corrections. */
export function xpMotes(delta:number):number[]{
 if(delta<=0||!Number.isFinite(delta))return [];
 if(delta<=40)return Array.from({length:Math.ceil(delta)},(_,i)=>Math.min(1,delta-i));
 const count=40;
 return Array.from({length:count},(_,i)=>i===count-1?delta-Math.floor(delta/count)*(count-1):Math.floor(delta/count));
}
export const XP_FLIGHT_MS=700;
export const XP_STAGGER_MS=95;
