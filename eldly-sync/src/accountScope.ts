// No account uses the old unscoped keys. They remain a recovery copy for the owner.
let scope: string | null = null;
let owner = false;
let homeName = "MySpace";
let epoch = 0;
export function setAccountScope(id:string,isOwner=false,username="",displayName?:string) {scope=id;owner=isOwner;homeName=displayName?.trim()|| (isOwner?"Eldinos":username.toLowerCase()==="henriquesa"?"Henriques":username||"MySpace");epoch++;}
export function accountScope(){return scope;}
export function scopeEpoch(){return epoch;}
export function isPersonalOwner(){return scope===null||owner;}
export function scopedKey(key:string){return scope===null?key:`eldinos:${scope}:${key}`;}
export function isGuest(){return scope==='guest';}

export function accountHomeName(){return homeName;}
