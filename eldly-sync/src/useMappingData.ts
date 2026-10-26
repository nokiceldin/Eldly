import {canTrack} from './trackingBounds';
import {COIN_CONTROL_EVENT,displayCoinData} from './coinControl';
import { LOCAL_EVENT, REMOTE_EVENT } from "./sync/local";
import { useEffect, useState } from "react";
import { playFeedback, tracklySound } from "./sounds";
import { load, persist } from "./storage";
import { emptyMapping, setMappingEntry, type HabitId, type MappingEntry } from "./mapping";
export function useMappingData() {
  const [initial] = useState(() => { try { const stored = displayCoinData(load()); return { data: stored.mapping || emptyMapping(), sound: stored.sound, error: "" }; } catch (e) { return { data: emptyMapping(), sound: false, error: String(e) }; } });
  const [data, setData] = useState(initial.data);
  const [sound, setSoundState] = useState(initial.sound);
  const [error, setError] = useState(initial.error);
  useEffect(() => {
    const sync = () => { try { const stored = displayCoinData(load()); setData(displayCoinData(stored).mapping || emptyMapping()); setSoundState(stored.sound); setError(""); } catch (e) { setError(String(e)); } };
    window.addEventListener("storage", sync);
    window.addEventListener(LOCAL_EVENT, sync);
    window.addEventListener(REMOTE_EVENT, sync);window.addEventListener(COIN_CONTROL_EVENT,sync);
    return () => { window.removeEventListener(LOCAL_EVENT, sync); window.removeEventListener("storage", sync); window.removeEventListener(REMOTE_EVENT,sync);window.removeEventListener(COIN_CONTROL_EVENT,sync); };
  }, []);
  const save = (day: string, id: HabitId, entry?: MappingEntry): string | null => {
    try {
      const latest = load();
      const mappingData=latest.mapping||emptyMapping();
      if(entry&&!canTrack(mappingData,id,day))throw Error('Choose a day within this tracker’s history, up to today.');
      const existing = latest.mapping?.entries[day]?.[id];
      // Linked homework is controlled by its tasks, including edits from Data.
      if (existing?.kind === "check" && existing.source === "checkly") return null;
      const wasMarked = !!existing;
      const mapping = setMappingEntry(latest.mapping || emptyMapping(), day, id, entry);
      persist({ ...latest, mapping });
      const stored = displayCoinData(load()); setData(displayCoinData(stored).mapping || emptyMapping()); setSoundState(stored.sound); setError("");
      if (entry && !wasMarked) {
        const feedback = tracklySound(id, stored.mapping);
        playFeedback(feedback, stored.sound);
      }
      return null;
    } catch (e) { const message = `Could not save: ${String(e)}`; setError(message); return message; }
  };
  const setSound = (enabled: boolean) => {
    try { persist({ ...load(), sound: enabled, soundDesignVersion: 1 }); setSoundState(enabled); setError(""); if (enabled) playFeedback("track", true); }
    catch(e) { setError(`Could not save: ${String(e)}`); }
  };
  return { data, error, save, sound, setSound };
}
