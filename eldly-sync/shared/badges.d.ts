export type BadgeId='welcome'|'streak'|'coins'|'goal'|'reward';
export type ProfileBadge={id:BadgeId;name:string;hint:string;unlocked:boolean;level:number;maxLevel:number;nextHint:string|null};
export function profileBadges(longest:number,earned:number,goals?:number,purchases?:number):ProfileBadge[];
