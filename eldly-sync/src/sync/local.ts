import { scopedKey } from "../accountScope";
import { retainChecklist, validate } from '../storage';
export const LOCAL_EVENT = 'eldly-local-save';
export const REMOTE_EVENT = 'eldly-cloud-update';
const KEY = 'checkly-data-v1';
export type Snapshot = Record<string, unknown>;
export function writeLocal(key: string, value: unknown) {
  const text = JSON.stringify(value);
  if (localStorage.getItem(scopedKey(key)) === text) return;
  localStorage.setItem(scopedKey(key), text);
  window.dispatchEvent(new Event(LOCAL_EVENT));
}
export function snapshot(): Snapshot {
  const raw = localStorage.getItem(scopedKey(KEY));
  return raw ? retainSnapshot({ [KEY]: JSON.parse(raw) }) : {};
}
export function validateSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Snapshot;
  if (Object.keys(s).some(k => k !== KEY && k !== 'packly-v1')) return false;
  return s[KEY] === undefined || validate(s[KEY]);
}
export function retainSnapshot(s: Snapshot, advance = true): Snapshot {
  if (!validateSnapshot(s)) throw Error('Cloud data is incompatible. Your local data has been kept.');
  const checklist = s[KEY];
  return validate(checklist) ? { [KEY]: retainChecklist(checklist, advance) } : {};
}
export function pruneLocalHistory() {
  localStorage.removeItem(scopedKey('packly-v1'));
  localStorage.removeItem(scopedKey('packly-recovery-v1'));
  const backupKey = scopedKey('eldly-before-shared-v2');
  const previousBackup = localStorage.getItem(backupKey);
  if (previousBackup) {
    let backup;
    try { backup = JSON.parse(previousBackup); } catch { /* Preserve unreadable recovery data. */ }
    if (validateSnapshot(backup?.data)) {
      const retained = JSON.stringify({ ...backup, data: retainSnapshot(backup.data) });
      if (retained !== previousBackup) localStorage.setItem(backupKey, retained);
    }
  }
  const previous = localStorage.getItem(scopedKey(KEY));
  if (!previous) return;
  const data = JSON.parse(previous);
  if (validate(data)) {
    const retained = retainChecklist(data);
    if (retained !== data) localStorage.setItem(scopedKey(KEY), JSON.stringify(retained));
  }
}
export function restore(s: Snapshot) {
  const retained = retainSnapshot(s);
  localStorage.removeItem(scopedKey('packly-v1'));
  const key = scopedKey(KEY);
  const next = KEY in retained ? JSON.stringify(retained[KEY]) : null;
  if (localStorage.getItem(key) === next) return;
  if (next === null) localStorage.removeItem(key);
  else localStorage.setItem(key, next);
  window.dispatchEvent(new Event(REMOTE_EVENT));
}
export function exportDevice() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({version:1, savedAt:new Date().toISOString(),data:snapshot()},null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download='eldly-all-device-data.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
