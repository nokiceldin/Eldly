import {it,expect} from 'vitest';
import {celebrationCoins} from './celebration-coins.js';
it('selects the featured unbought reward, handles tiny values exactly and rejects invalid prices',()=>{
 expect(celebrationCoins({})).toBeNull();expect(celebrationCoins({rewards:[{id:'a',cost:1}]})).toBe(.01);
 const d={rewards:[{id:'a',cost:100,archived:true},{id:'b',cost:200},{id:'c',cost:1200}],rewardPurchases:[{rewardId:'b'}]};expect(celebrationCoins(d)).toBe(12);d.rewardPurchases[0].refunded=true;expect(celebrationCoins(d)).toBe(2);
 expect(celebrationCoins({rewards:[{cost:-1}]})).toBeNull();expect(celebrationCoins({rewards:[{cost:Infinity}]})).toBeNull();
});
