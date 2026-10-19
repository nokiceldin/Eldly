import { useSyncExternalStore } from "react";
const query = window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribe = (change: () => void) => {
  query.addEventListener("change", change);
  // Remove the listener when React unsubscribes to avoid retaining stale callbacks.
  return () => query.removeEventListener("change", change);
};
/** React to preference changes immediately, including while the checklist is open. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => query.matches,
    // Default to reduced motion until the client preference is available.
    () => true,
  );
}
