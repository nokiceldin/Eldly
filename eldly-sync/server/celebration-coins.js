// The first unbought reward is the featured reward on Track. Never trust a sent amount.
export function celebrationCoins(data){
 const bought=new Set((data.rewardPurchases||[]).filter(p=>!p.refunded).map(p=>p.rewardId));
 const active=(data.rewards||[]).filter(r=>!r.archived&&!bought.has(r.id));
 const reward=active.find(r=>r.id===data.mainRewardId)||active[0];
 return reward&&Number.isSafeInteger(reward.cost)&&reward.cost>0&&reward.cost<=1e9?reward.cost/100:null;
}
