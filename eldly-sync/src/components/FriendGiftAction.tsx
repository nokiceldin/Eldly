import {useEffect,useState} from 'react';
import {Check,Gift,PartyPopper} from 'lucide-react';
import CoinIcon from './CoinIcon';
import {formatPoints} from '../points';
import type {SocialNotification} from '../social';

export default function FriendGiftAction({notification:n,giftUsed,busy,onSend,onCheer,justSent=false}:{notification:SocialNotification;giftUsed:boolean;busy:boolean;onSend:(amount:number)=>void;onCheer:()=>void;justSent?:boolean}){
 const [preview,setPreview]=useState(false);
 useEffect(()=>setPreview(false),[n.giftOffer,n.celebrated]);
 if(n.sentGiftAmount&&n.sentGiftAmount>0)return <div className={`friend-gift-sent ${justSent?'gift-pop':''}`} role="status"><span className="friend-gift-seal"><Gift size={22}/></span><div><strong>You sent +{formatPoints(n.sentGiftAmount)} coins</strong><span>Celebration + gift delivered to @{n.username}.</span></div><Check size={18}/></div>;
 if(n.celebrated)return <div className={`friend-gift-sent ${justSent?'gift-pop':''}`} role="status"><span className="friend-gift-seal"><PartyPopper size={22}/></span><div><strong>You celebrated @{n.username}!</strong><span>Encouragement sent · No coins gifted</span></div><Check size={18}/></div>;
 const offer=n.giftOffer;
 return <div className="friend-gift-action">{offer&&offer>0?!preview?<><div className="friend-celebration-choices" role="group" aria-label="How would you like to celebrate?"><button className="friend-cheer-button" disabled={busy} onClick={onCheer}><PartyPopper size={18}/> Just celebrate</button><button className="friend-gift-button" disabled={busy} onClick={()=>setPreview(true)}><Gift size={19}/> Celebrate + gift</button></div><small>Gift: +{formatPoints(offer)} coins · 1% of their next reward · Free to send</small></>:<section className="friend-gift-preview" aria-label={`Gift for ${n.username}`}><span className="friend-gift-seal"><Gift size={27}/></span><h3>A little boost for @{n.username}</h3><div className="friend-gift-amount"><CoinIcon/>+{formatPoints(offer)}</div><p>1% of their next reward. Your balance stays the same.</p><small>One gift per friend each week · Resets Monday</small><div className="social-actions"><button disabled={busy} onClick={()=>setPreview(false)}>Cancel</button><button className="friend-gift-button" disabled={busy} onClick={()=>onSend(offer)}><Gift size={18}/>{busy?'Sending…':`Celebrate + send ${formatPoints(offer)} coins`}</button></div></section>:<><button className="friend-cheer-button" disabled={busy} onClick={onCheer}><PartyPopper size={18}/> Celebrate</button>{giftUsed&&<small>Gift sent this week. You can still cheer them on.</small>}</>}</div>;
}
export function FriendGiftReceived({username,amount}:{username:string;amount:number}){
 return <div className="friend-gift-received"><span className="friend-gift-seal"><Gift size={27}/></span><div><span className="friend-gift-kicker">A LITTLE BOOST FROM @{username}</span><strong><CoinIcon/>+{formatPoints(amount)} coins</strong><p>Closer to your next reward. Already added to your balance.</p></div></div>;
}
