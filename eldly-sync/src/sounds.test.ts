import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEEDBACK_TONES, tracklySound } from "./sounds";
describe("completion feedback", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  beforeEach(() => { vi.resetModules(); });
  it("uses distinct short sounds and a longer richer day celebration", () => {
    expect(FEEDBACK_TONES.check).not.toEqual(FEEDBACK_TONES.track);
    expect(FEEDBACK_TONES["day-complete"].length).toBeGreaterThan(FEEDBACK_TONES.check.length);
    const duration = (kind: keyof typeof FEEDBACK_TONES) => Math.max(...FEEDBACK_TONES[kind].map(t => t.at + t.length));
    expect(duration("day-complete")).toBeGreaterThan(duration("check"));
    expect(duration("day-complete")).toBeLessThan(1);
  });
  it("uses a descending red cue, a gentle green chime, and keeps other colors unchanged", () => {
    for (const id of ["porn", "goyslop"] as const) expect(tracklySound(id)).toBe("track-red");
    for (const id of ["recovery", "praying", "sleep"] as const) expect(tracklySound(id)).toBe("track-green");
    for (const id of ["tennis", "fitness", "reading", "journaling", "homework", "coaching", "screen-time"] as const) expect(tracklySound(id)).toBe("track");
    expect(FEEDBACK_TONES["track-red"][0].endFrequency).toBeLessThan(FEEDBACK_TONES["track-red"][0].frequency);
  });
  it("does not create audio when muted and tolerates unavailable audio", async () => {
    const create = vi.fn(); vi.stubGlobal("window", { AudioContext: create });
    const { playFeedback } = await import("./sounds");
    playFeedback("check", false); expect(create).not.toHaveBeenCalled();
    vi.stubGlobal("window", {}); expect(() => playFeedback("check", true)).not.toThrow();
  });
  it("reuses one audio context and resumes it from a user action", async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
    const createOscillator = vi.fn(() => ({ frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null }));
    const context = { state: "suspended", currentTime: 0, resume, destination: {}, createOscillator, createGain: () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }) };
    const constructor = vi.fn(function() { return context; });
    vi.stubGlobal("window", { AudioContext: constructor });
    const { playFeedback } = await import("./sounds");
    playFeedback("check", true); playFeedback("track", true);
    expect(constructor).toHaveBeenCalledTimes(1); expect(resume).toHaveBeenCalled();
    expect(createOscillator).toHaveBeenCalledTimes(4);
  });
});


describe("media-volume playback", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses playback audio when supported without changing device volume", async () => {
    const session = { type: "auto" };
    vi.stubGlobal("navigator", { audioSession: session });
    const { configurePlaybackAudio } = await import("./sounds");
    configurePlaybackAudio();
    expect(session.type).toBe("playback");
  });
  it("tolerates browsers without audio sessions and rejected session changes", async () => {
    const { configurePlaybackAudio } = await import("./sounds");
    vi.stubGlobal("navigator", {});
    expect(() => configurePlaybackAudio()).not.toThrow();
    vi.stubGlobal("navigator", { get audioSession() { throw Error("unavailable"); } });
    expect(() => configurePlaybackAudio()).not.toThrow();
  });
});

it('uses each account’s current custom tracker color, including recoloring',()=>{
 const mapping={version:1 as const,entries:{},habits:[{id:'custom-habit',label:'My habit',kind:'check' as const,color:'red' as const}]};
 expect(tracklySound('custom-habit',mapping)).toBe('track-red');
 expect(tracklySound('custom-habit',{...mapping,habits:[{...mapping.habits[0],color:'green'}]})).toBe('track-green');
 expect(tracklySound('custom-habit',{...mapping,habits:[{...mapping.habits[0],color:'blue'}]})).toBe('track');
 expect(tracklySound('porn',{...mapping,habits:[{...mapping.habits[0],id:'porn',color:'blue'}]})).toBe('track');
});

function recordedCoinAudio(){
 const starts:number[]=[],rates:{value:number}[]=[],buffers:any[]=[],stops:any[]=[];
 const sample={duration:.52,length:4,sampleRate:24000,numberOfChannels:1,getChannelData:()=>new Float32Array([.1,.4,.2,0])};
 const reversed=new Float32Array(4);
 const audio={state:'running',currentTime:10,destination:{},decodeAudioData:vi.fn().mockResolvedValue(sample),createBuffer:vi.fn(()=>({getChannelData:()=>reversed})),createBufferSource:()=>{const rate={value:1};rates.push(rate);const source:any={buffer:null,playbackRate:rate,connect:vi.fn(),disconnect:vi.fn(),start:(t:number)=>{starts.push(t);buffers.push(source.buffer);},stop:()=>stops.push(source),onended:null};return source;},createOscillator:()=>({type:'',frequency:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn(),start:(t:number)=>starts.push(t),stop:vi.fn(),onended:null}),createGain:()=>({gain:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()})};
 const fetch=vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
 vi.stubGlobal('fetch',fetch);vi.stubGlobal('window',{AudioContext:vi.fn(function(){return audio;})});
 return {starts,rates,buffers,audio,fetch,reversed,stops,sample};
}
it('plays a short bounded collection burst, preloads silently and respects mute',async()=>{
 vi.resetModules();const mock=recordedCoinAudio();
 try{
  const {playXPCollection,preloadCoinSound}=await import('./sounds');
  await preloadCoinSound();expect(mock.starts).toHaveLength(0);
  await playXPCollection(4,false);expect(mock.starts).toHaveLength(0);
  await playXPCollection(4,true,700,95);expect(mock.starts).toHaveLength(2);expect(mock.starts[0]).toBeCloseTo(10.7);expect(mock.starts[1]).toBeCloseTo(10.985);
  expect(mock.rates[1].value).toBeGreaterThan(mock.rates[0].value);expect(mock.fetch).toHaveBeenCalledTimes(1);expect(mock.fetch).toHaveBeenCalledWith('/audio/coin-pickup.wav');
  await playXPCollection(1,true);expect(mock.audio.decodeAudioData).toHaveBeenCalledTimes(1);
 }finally{vi.unstubAllGlobals();vi.resetModules();}
});
it('uses a short non-coin debit sound for losses without downloading the coin sample',async()=>{
 vi.resetModules();const mock=recordedCoinAudio();
 try{const {playXPCollection}=await import('./sounds');await playXPCollection(12,true,0,26,true);expect(mock.starts).toHaveLength(2);expect(mock.starts[1]-mock.starts[0]).toBeLessThan(.1);expect(mock.fetch).not.toHaveBeenCalled();expect(mock.buffers).toHaveLength(0);}finally{vi.unstubAllGlobals();vi.resetModules();}
});
it('caps large sound bursts and stops the previous sequence when another starts',async()=>{
 vi.resetModules();const mock=recordedCoinAudio();
 try{const {playXPCollection,stopCoinFeedback}=await import('./sounds');await playXPCollection(1000,true,520,26);expect(mock.starts).toHaveLength(6);expect(mock.starts.at(-1)!-mock.starts[0]).toBeLessThan(.3);await playXPCollection(1,true);expect(mock.stops).toHaveLength(6);stopCoinFeedback();expect(mock.stops).toHaveLength(7);}finally{vi.unstubAllGlobals();vi.resetModules();}
});
it('treats a failed sound download as optional feedback',async()=>{
 vi.resetModules();const mock=recordedCoinAudio();mock.fetch.mockRejectedValue(Error('Offline'));
 try{const {playXPCollection}=await import('./sounds');await expect(playXPCollection(3,true)).resolves.toBeUndefined();expect(mock.starts).toHaveLength(0);}finally{vi.unstubAllGlobals();vi.resetModules();}
});

it('does not play a late collection sound after a newer interaction cancels decoding',async()=>{
 vi.resetModules();const mock=recordedCoinAudio();let finish!:(sample:any)=>void;
 mock.audio.decodeAudioData.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 try{const {playXPCollection}=await import('./sounds');const first=playXPCollection(8,true);await vi.waitFor(()=>expect(mock.audio.decodeAudioData).toHaveBeenCalled());await playXPCollection(0,false);finish(mock.sample);await first;expect(mock.starts).toHaveLength(0);}finally{vi.unstubAllGlobals();vi.resetModules();}
});
