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
