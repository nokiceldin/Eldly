import { HABITS, getHabits, type MappingData, type HabitId } from "./mapping";
export type FeedbackSound = "check" | "day-complete" | "track" | "track-red" | "track-green";
interface Tone { frequency: number; at: number; length: number; volume: number; type?: OscillatorType; endFrequency?: number }
export const FEEDBACK_TONES: Record<FeedbackSound, readonly Tone[]> = {
  check: [
    { frequency: 880, at: 0, length: .16, volume: .13 },
    { frequency: 1320, at: .035, length: .12, volume: .055, type: "triangle" },
  ],
  "day-complete": [
    { frequency: 523.25, at: 0, length: .26, volume: .10 },
    { frequency: 659.25, at: .08, length: .26, volume: .10 },
    { frequency: 783.99, at: .16, length: .3, volume: .10 },
    { frequency: 1046.5, at: .27, length: .48, volume: .11 },
    { frequency: 659.25, at: .28, length: .42, volume: .045 },
  ],
  "track-red": [
    { frequency: 293.66, endFrequency: 220, at: 0, length: .13, volume: .09, type: "triangle" },
    { frequency: 196, at: .075, length: .18, volume: .065 },
  ],
  "track-green": [
    { frequency: 392, at: 0, length: .36, volume: .065 },
    { frequency: 523.25, at: .085, length: .42, volume: .065 },
    { frequency: 784, at: .16, length: .3, volume: .025 },
  ],
  track: [
    { frequency: 440, endFrequency: 680, at: 0, length: .10, volume: .12 },
    { frequency: 960, at: .045, length: .12, volume: .06 },
  ],
};
export function tracklySound(id: HabitId, mapping?:MappingData): FeedbackSound {
  const color = getHabits(mapping).find(habit => habit.id === id)?.color;
  return color === "red" ? "track-red" : color === "green" ? "track-green" : "track";
}
/** Use media volume rather than the iPhone ring/silent switch where supported. */
export function configurePlaybackAudio() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch { /* Older browsers keep their normal audio behavior. */ }
}
let context: AudioContext | undefined;
/** Synthesized locally, unlocked by a click/tap; no audio downloads or new contexts per task. */
export function playFeedback(sound: FeedbackSound, enabled: boolean) {
  if (!enabled) return;
  configurePlaybackAudio();
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!context || context.state === "closed") context = new AudioContextClass({ latencyHint: "interactive" });
    if (context.state === "suspended") void context.resume().catch(() => {});
    const ctx = context;
    const now = ctx.currentTime + .005;
    for (const tone of FEEDBACK_TONES[sound]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + tone.at;
      oscillator.type = tone.type || "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, start + tone.length * .65);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(tone.volume, start + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, start + tone.length);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(start); oscillator.stop(start + tone.length + .015);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  } catch { /* Audio is optional; never interrupt saving a task. */ }
}

let coinBytes:Promise<ArrayBuffer|null>|null=null;
let coinDecoded:Promise<AudioBuffer|null>|null=null;
let reversedCoin:AudioBuffer|null=null;
/** Fetch only: no sound or audio session is started by preloading. */
export function preloadCoinSound(){
 if(!coinBytes)coinBytes=fetch('/audio/coin-jingle.wav').then(r=>{if(!r.ok)throw Error('Coin sound unavailable');return r.arrayBuffer();}).catch(()=>{coinBytes=null;return null;});
 return coinBytes;
}
/** Real recorded coins, one overlapping jingle per arrival; reverse playback for losses. */
export async function playXPCollection(count:number,enabled:boolean,firstArrivalMs=700,staggerMs=95,reverse=false){
 if(!enabled||count<=0)return;
 configurePlaybackAudio();
 try{
  const AudioContextClass=window.AudioContext||(window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!AudioContextClass)return;
  if(!context||context.state==='closed')context=new AudioContextClass({latencyHint:'interactive'});
  const ctx=context;
  if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
  const desiredStart=ctx.currentTime+firstArrivalMs/1000;
  if(!coinDecoded)coinDecoded=preloadCoinSound().then(bytes=>bytes?ctx.decodeAudioData(bytes.slice(0)):null).catch(()=>{coinDecoded=null;return null;});
  const sample=await coinDecoded;
  if(!sample){coinDecoded=null;return;}
  if(reverse&&!reversedCoin){
   reversedCoin=ctx.createBuffer(sample.numberOfChannels,sample.length,sample.sampleRate);
   for(let channel=0;channel<sample.numberOfChannels;channel++)reversedCoin.getChannelData(channel).set(sample.getChannelData(channel).slice().reverse());
  }
  const start=Math.max(desiredStart,ctx.currentTime+.005),volume=.36/Math.sqrt(Math.min(count,10));
  for(let i=0;i<Math.min(count,40);i++){
   const at=start+i*staggerMs/1000,source=ctx.createBufferSource(),gain=ctx.createGain();
   source.buffer=reverse?reversedCoin:sample;
   source.playbackRate.value=reverse?.88-(i%6)*.015:1.02+Math.min(i,8)*.015;
   gain.gain.setValueAtTime(volume,at);
   source.connect(gain);gain.connect(ctx.destination);source.start(at);
   source.onended=()=>{source.disconnect();gain.disconnect();};
  }
 }catch{/* Optional audio must never interrupt a save. */}
}
