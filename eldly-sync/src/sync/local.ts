import {validPackingState,cleanPackingReferences} from '../packly/schema';
import { scopedKey } from "../accountScope";
import { validate } from '../storage';
export const LOCAL_EVENT = 'eldly-local-save';
export const REMOTE_EVENT = 'eldly-cloud-update';
export const KEYS = ['checkly-data-v1', 'packly-v1'] as const;
export type Snapshot = Record<string, unknown>;
export function writeLocal(key: string, value: unknown) {
  const text = JSON.stringify(value);
  if (localStorage.getItem(scopedKey(key)) === text) return;
  localStorage.setItem(scopedKey(key), text);
  window.dispatchEvent(new Event(LOCAL_EVENT));
}
export function snapshot(): Snapshot {
  return Object.fromEntries(KEYS.flatMap(key => { const raw = localStorage.getItem(scopedKey(key)); return raw ? [[key, JSON.parse(raw)]] : []; }));
}
export function validateSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Snapshot;
  if (Object.keys(s).some(k => !KEYS.includes(k as typeof KEYS[number]))) return false;
  if (s[KEYS[0]] !== undefined && !validate(s[KEYS[0]])) return false;
  const p = s[KEYS[1]] as any;
  return p === undefined || validPackingState(cleanPackingReferences(p));
}
export function restore(s: Snapshot) {
  s={...s,...(s[KEYS[1]]?{[KEYS[1]]:cleanPackingReferences(s[KEYS[1]])}:{})};
  if (!validateSnapshot(s)) throw Error('Cloud data is incompatible. Your local data has been kept.');
  const previous = KEYS.map(key => localStorage.getItem(scopedKey(key)));
  if (KEYS.every((key,i) => previous[i] === (key in s ? JSON.stringify(s[key]) : null))) return;
  try { for (const key of KEYS) { if (key in s) localStorage.setItem(scopedKey(key), JSON.stringify(s[key])); else localStorage.removeItem(scopedKey(key)); } }
  catch (error) { KEYS.forEach((key,i) => { if (previous[i] !== null) localStorage.setItem(scopedKey(key),previous[i]!); else localStorage.removeItem(scopedKey(key)); }); throw error; }
  window.dispatchEvent(new Event(REMOTE_EVENT));
}
export function exportDevice() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({version:1, savedAt:new Date().toISOString(),data:snapshot()},null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download='eldly-all-device-data.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
