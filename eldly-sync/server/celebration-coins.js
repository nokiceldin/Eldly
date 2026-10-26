// The first unbought reward is the featured reward on Track. Never trust a sent amount.
export function celebrationCoins(data){
 const bought=new Set((data.rewardPurchases||[]).filter(p=>!p.refunded).map(p=>p.rewardId));
 const reward=(data.rewards||[]).find(r=>!r.archived&&!bought.has(r.id));
 return reward&&Number.isSafeInteger(reward.cost)&&reward.cost>0&&reward.cost<=1e9?reward.cost/100:null;
}
