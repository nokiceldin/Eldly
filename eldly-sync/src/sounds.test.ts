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

it('times a metallic clink per coin arrival and respects muted effects',async()=>{
 vi.resetModules();
 const starts:number[]=[];
 const param=()=>({setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
 const audio={state:'running',currentTime:10,destination:{},createOscillator:()=>({frequency:param(),connect:vi.fn(),disconnect:vi.fn(),start:(t:number)=>starts.push(t),stop:vi.fn(),onended:null}),createGain:()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()})};
 const constructor=vi.fn(function(){return audio;});vi.stubGlobal('window',{AudioContext:constructor});
 try{
  const {playXPCollection}=await import('./sounds');
  playXPCollection(4,false);expect(starts).toHaveLength(0);
  playXPCollection(4,true,700,95);expect(starts).toHaveLength(12);expect(new Set(starts).size).toBe(4);expect(starts[0]).toBeCloseTo(10.7);expect(starts[9]).toBeCloseTo(10.985);
 }finally{vi.unstubAllGlobals();vi.resetModules();}
});

it('plays descending XP loss pulses once per lost XP',async()=>{
 vi.resetModules();
 const pitches:{start:number;end:number}[]=[];const starts:number[]=[];
 const audio={state:'running',currentTime:10,destination:{},createOscillator:()=>{const pitch={start:0,end:0};pitches.push(pitch);return {frequency:{setValueAtTime:(v:number)=>{pitch.start=v;},exponentialRampToValueAtTime:(v:number)=>{pitch.end=v;}},connect:vi.fn(),disconnect:vi.fn(),start:(t:number)=>starts.push(t),stop:vi.fn(),onended:null};},createGain:()=>({gain:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()})};
 vi.stubGlobal('window',{AudioContext:vi.fn(function(){return audio;})});
 try{
  const {playXPCollection}=await import('./sounds');playXPCollection(8,true,0,95,true);
  expect(starts).toHaveLength(24);expect(new Set(starts).size).toBe(8);expect(starts[21]-starts[0]).toBeCloseTo(.665);
  expect(pitches.every(p=>p.end<p.start)).toBe(true);expect(pitches[21].end).toBeLessThan(pitches[0].end);
 }finally{vi.unstubAllGlobals();vi.resetModules();}
});
