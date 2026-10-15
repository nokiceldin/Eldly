import { validate } from '../storage';
export const LOCAL_EVENT = 'eldly-local-save';
export const REMOTE_EVENT = 'eldly-cloud-update';
export const KEYS = ['checkly-data-v1', 'packly-v1'] as const;
export type Snapshot = Record<string, unknown>;
export function writeLocal(key: string, value: unknown) {
  const text = JSON.stringify(value);
  if (localStorage.getItem(key) === text) return;
  localStorage.setItem(key, text);
  window.dispatchEvent(new Event(LOCAL_EVENT));
}
export function snapshot(): Snapshot {
  return Object.fromEntries(KEYS.flatMap(key => { const raw = localStorage.getItem(key); return raw ? [[key, JSON.parse(raw)]] : []; }));
}
export function validateSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Snapshot;
  if (Object.keys(s).some(k => !KEYS.includes(k as typeof KEYS[number]))) return false;
  if (s[KEYS[0]] !== undefined && !validate(s[KEYS[0]])) return false;
  const p = s[KEYS[1]] as any;
  return p === undefined || (!!p && typeof p === 'object' && Array.isArray(p.trips) && p.trips.length > 0 && typeof p.activeId === 'string' && p.trips.every((t: any) => t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.items) && Array.isArray(t.categories) && Array.isArray(t.queue) && t.statuses && typeof t.statuses === 'object' && typeof t.position === 'number'));
}
export function restore(s: Snapshot) {
  if (!validateSnapshot(s)) throw Error('Cloud data is incompatible. Your local data has been kept.');
  const previous = KEYS.map(key => localStorage.getItem(key));
  if (KEYS.every((key,i) => previous[i] === (key in s ? JSON.stringify(s[key]) : null))) return;
  try { for (const key of KEYS) { if (key in s) localStorage.setItem(key, JSON.stringify(s[key])); else localStorage.removeItem(key); } }
  catch (error) { KEYS.forEach((key,i) => { if (previous[i] !== null) localStorage.setItem(key,previous[i]!); else localStorage.removeItem(key); }); throw error; }
  window.dispatchEvent(new Event(REMOTE_EVENT));
}
export function exportDevice() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({version:1, savedAt:new Date().toISOString(),data:snapshot()},null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download='eldly-all-device-data.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
