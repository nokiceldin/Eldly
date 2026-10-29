function tier(id,name,value,thresholds,description,next){
 const total=Number.isFinite(value)?Math.max(0,value):0;
 const level=thresholds.filter(target=>total>=target).length;
 return {id,name,level,maxLevel:thresholds.length,unlocked:level>0,hint:description(thresholds[Math.max(0,level-1)]),nextHint:level>0&&level<thresholds.length?next(thresholds[level]):null};
}
export function profileBadges(longest,earned,goals=0,purchases=0){
 return [
  {id:'welcome',name:'First chapter',hint:'Joined MySpace.',unlocked:true,level:1,maxLevel:1,nextHint:null},
  tier('streak','On fire',longest,[3,7,14,30,100,365],n=>`${n}-day streak.`,n=>`Next: ${n} days`),
  tier('coins','Coin collector',earned,[100,500,1000,5000,10000,50000],n=>`${n.toLocaleString('en-US')} coins earned.`,n=>`Next: ${n.toLocaleString('en-US')} coins`),
  tier('goal','Goal getter',goals,[1,5,15,30,75,150],n=>`${n} weekly ${n===1?'goal':'goals'} met.`,n=>`Next: ${n} goals`),
  tier('reward','Treat yourself',purchases,[1,3,5,10,25,50],n=>`${n} ${n===1?'reward':'rewards'} bought.`,n=>`Next: ${n} rewards`),
 ];
}
