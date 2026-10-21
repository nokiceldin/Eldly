import { Gift, Footprints, Headphones, Plane, Gamepad2, Shirt, Coffee, Bike, Sparkles, LockKeyhole } from 'lucide-react';
import CoinIcon from './CoinIcon';
export default function RewardArt({title='',ready=false}:{title?:string;ready?:boolean}){
 const Icon=/shoe|sneaker|trainer/i.test(title)?Footprints:/headphone|airpod|music/i.test(title)?Headphones:/trip|holiday|flight|travel/i.test(title)?Plane:/game|playstation|xbox|console/i.test(title)?Gamepad2:/shirt|clothes|jacket|hoodie/i.test(title)?Shirt:/coffee|dinner|food|meal/i.test(title)?Coffee:/bike|bicycle/i.test(title)?Bike:Gift;
 return <div className={`reward-art ${ready?'is-unlocked':''}`} aria-hidden="true"><div className="reward-art-halo"/><div className="reward-art-orbit"/><span className="reward-art-coin coin-one"><CoinIcon/></span><span className="reward-art-coin coin-two"><CoinIcon/></span><Sparkles className="reward-art-spark spark-one"/><Sparkles className="reward-art-spark spark-two"/><div className="reward-art-pedestal"/><div className="reward-art-prize"><Icon strokeWidth={1.25}/></div><span className="reward-art-lock">{ready?<Sparkles size={13}/>:<LockKeyhole size={12}/>}</span></div>;
}
