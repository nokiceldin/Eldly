import {ArrowUp} from 'lucide-react';
export default function AvatarIntro({onExplore,onDismiss}:{onExplore:()=>void;onDismiss:()=>void}){
 return <section className="avatar-intro" aria-labelledby="avatar-intro-title"><ArrowUp className="avatar-intro-arrow" size={21} aria-hidden="true"/><h3 id="avatar-intro-title">Now you can change your logo!</h3><p>Check them out!</p><div className="social-actions"><button type="button" autoFocus className="social-primary" onClick={onExplore}>See logos</button><button type="button" onClick={onDismiss}>Not now</button></div></section>;
}
