/** Visual coins represent bundles, never the numeric denomination. */
export function xpMotes(delta:number):number[]{
 if(delta<=0||!Number.isFinite(delta))return [];
 const count=Math.min(12,Math.ceil(Math.sqrt(delta))),scale=Number.isInteger(delta)?1:10,share=Math.floor(delta*scale/count);
 return Array.from({length:count},(_,i)=>i===count-1?delta-share*(count-1)/scale:share/scale);
}
export const XP_FLIGHT_MS=520;
export const XP_STAGGER_MS=26;
export function coinEffect(delta:number){
 const motes=xpMotes(Math.abs(delta)),loss=delta<0;
 const flightMs=loss?380:XP_FLIGHT_MS,staggerMs=loss?18:XP_STAGGER_MS;
 const last=flightMs+Math.max(0,motes.length-1)*staggerMs;
 return {motes,flightMs,staggerMs,lifetimeMs:loss?last:Math.max(950,last+100)};
}
