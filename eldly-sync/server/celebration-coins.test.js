import {it,expect} from 'vitest';
import {celebrationCoins} from './celebration-coins.js';
it('selects the featured unbought reward, handles tiny values exactly and rejects invalid prices',()=>{
 expect(celebrationCoins({})).toBeNull();expect(celebrationCoins({rewards:[{id:'a',cost:1}]})).toBe(.01);
 const d={rewards:[{id:'a',cost:100,archived:true},{id:'b',cost:200},{id:'c',cost:1200}],rewardPurchases:[{rewardId:'b'}]};expect(celebrationCoins(d)).toBe(12);d.rewardPurchases[0].refunded=true;expect(celebrationCoins(d)).toBe(2);
 expect(celebrationCoins({rewards:[{cost:-1}]})).toBeNull();expect(celebrationCoins({rewards:[{cost:Infinity}]})).toBeNull();
});
it('uses 1% of the featured upcoming reward full price and skips bought or archived rewards',()=>{
 const data={mainRewardId:'featured',rewards:[{id:'first',cost:200},{id:'featured',cost:2501}],mapping:{entries:{}},rewardPurchases:[]};
 expect(celebrationCoins(data)).toBe(25.01);
 data.rewardPurchases.push({rewardId:'featured'});expect(celebrationCoins(data)).toBe(2);
 data.rewards[0].archived=true;expect(celebrationCoins(data)).toBeNull();
});
