import { REMOTE_EVENT } from "./sync/local";
import { useEffect, useState } from "react";
import { playFeedback, tracklySound } from "./sounds";
import { load, persist } from "./storage";
import { HABITS, emptyMapping, setMappingEntry, type HabitId, type MappingEntry } from "./mapping";
export function useMappingData() {
  const [initial] = useState(() => { try { const stored = load(); return { data: stored.mapping || emptyMapping(), sound: stored.sound, error: "" }; } catch (e) { return { data: emptyMapping(), sound: false, error: String(e) }; } });
  const [data, setData] = useState(initial.data);
  const [sound, setSoundState] = useState(initial.sound);
  const [encouragement, setEncouragement] = useState<{ id: number; label: string } | null>(null);
  useEffect(() => { if (!encouragement) return; const timer = setTimeout(() => setEncouragement(null), 1400); return () => clearTimeout(timer); }, [encouragement]);
  const [error, setError] = useState(initial.error);
  useEffect(() => {
    const sync = () => { try { const stored = load(); setData(stored.mapping || emptyMapping()); setSoundState(stored.sound); setError(""); } catch (e) { setError(String(e)); } };
    window.addEventListener("storage", sync);
    window.addEventListener(REMOTE_EVENT, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(REMOTE_EVENT,sync); };
  }, []);
  const save = (day: string, id: HabitId, entry?: MappingEntry): string | null => {
    try {
      const latest = load();
      const wasMarked = !!latest.mapping?.entries[day]?.[id];
      const mapping = setMappingEntry(latest.mapping || emptyMapping(), day, id, entry);
      persist({ ...latest, mapping });
      const stored = load(); setData(stored.mapping || emptyMapping()); setSoundState(stored.sound); setError("");
      if (entry && !wasMarked) {
        const feedback = tracklySound(id);
        playFeedback(feedback, stored.sound);
        if (feedback === "track-green") setEncouragement(previous => ({ id: (previous?.id || 0) + 1, label: HABITS.find(h => h.id === id)!.label }));
      }
      return null;
    } catch (e) { const message = `Could not save: ${String(e)}`; setError(message); return message; }
  };
  const setSound = (enabled: boolean) => {
    try { persist({ ...load(), sound: enabled, soundDesignVersion: 1 }); setSoundState(enabled); setError(""); if (enabled) playFeedback("track", true); }
    catch(e) { setError(`Could not save: ${String(e)}`); }
  };
  return { data, error, save, sound, setSound, encouragement };
}
