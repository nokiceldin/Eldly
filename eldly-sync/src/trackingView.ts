import { scopedKey } from './accountScope';
export type TrackingView = 'monthly' | 'daily';
export function readTrackingView(): TrackingView {
  try { return localStorage.getItem(scopedKey('track-view')) === 'daily' ? 'daily' : 'monthly'; }
  catch { return 'monthly'; }
}
export function rememberTrackingView(view: TrackingView) {
  try { localStorage.setItem(scopedKey('track-view'), view); } catch { /* The view still works when storage is unavailable. */ }
}
