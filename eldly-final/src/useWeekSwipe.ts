import { useRef, type MouseEvent, type PointerEvent } from "react";
/** Page navigation never competes with task deletion, typing, or vertical scrolling. */
export function useWeekSwipe(changeWeek: (direction: number) => void) {
  const start = useRef<{
    x: number;
    y: number;
    id: number;
    locked: boolean;
  } | null>(null);
  const moved = useRef(false);
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      start.current = null;
      moved.current = false;
      if (
        !e.isPrimary ||
        e.button !== 0 ||
        (e.target as Element).closest(
          ".swipe-shell,input,textarea,select,button,a,dialog,summary",
        )
      )
        return;
      start.current = {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
        locked: false,
      };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x,
        dy = e.clientY - s.y;
      if (!s.locked) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          start.current = null;
          return;
        }
        if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        s.locked = true;
        moved.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      start.current = null;
      if (!s || s.id !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      const dx = e.clientX - s.x;
      if (s.locked && Math.abs(dx) >= Math.min(100, innerWidth * 0.23))
        changeWeek(dx < 0 ? 1 : -1);
    },
    onPointerCancel() {
      start.current = null;
    },
    onLostPointerCapture(e: PointerEvent<HTMLElement>) {
      if (e.target === e.currentTarget) start.current = null;
    },
    onClickCapture(e: MouseEvent<HTMLElement>) {
      if (moved.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
