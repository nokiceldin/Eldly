import { useReducedMotion } from "../useReducedMotion";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";

/** Horizontal intent is required; normal vertical page scrolling remains native. */
export default function SwipeToDelete({
  children,
  onDelete,
  disabled = false,
}: {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [width, setWidth] = useState(360);
  const start = useRef<{
    x: number;
    y: number;
    id: number;
    locked: boolean;
  } | null>(null);
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reduce = useReducedMotion();
  useEffect(() => () => clearTimeout(timer.current), []);
  function down(e: PointerEvent<HTMLDivElement>) {
    if (disabled || deleting || !e.isPrimary || e.button !== 0) return;
    moved.current = false;
    if ((e.target as HTMLElement).closest("details")) return;
    setWidth(e.currentTarget.clientWidth);
    start.current = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      locked: false,
    };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (disabled) { start.current=null; setOffset(0); return; }
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      if (dx >= -10 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      s.locked = true;
      moved.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setOffset(Math.max(-width, Math.min(0, dx)));
  }
  function end(e: PointerEvent<HTMLDivElement>, cancel = false) {
    if (disabled) { start.current=null; setOffset(0); return; }
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    const distance = Math.max(0, s.x - e.clientX);
    if (!cancel && s.locked && distance >= Math.min(110, width * 0.32)) {
      setDeleting(true);
      timer.current = setTimeout(onDelete, reduce ? 0 : 260);
    } else setOffset(0);
  }
  return (
    <motion.div
      className={"swipe-shell " + (dragging || deleting ? "swipe-active" : "")}
      initial={false}
      animate={{ height: deleting ? 0 : "auto", opacity: deleting ? 0 : 1 }}
      transition={{
        height: { duration: reduce ? 0 : 0.15, delay: reduce ? 0 : 0.12 },
        opacity: { duration: reduce ? 0 : 0.1, delay: reduce ? 0 : 0.16 },
      }}
    >
      <div
        className="swipe-red"
        aria-hidden="true"
        style={{ opacity: offset < 0 || deleting ? 1 : 0 }}
      >
        <Trash2 size={20} />
        <span>Delete</span>
      </div>
      <motion.div
        className="swipe-content"
        style={{ touchAction: "pan-y" }}
        animate={{ x: deleting ? -width : offset }}
        transition={
          dragging
            ? { duration: 0 }
            : deleting
              ? { duration: reduce ? 0 : 0.2, ease: "easeOut" }
              : { type: "spring", stiffness: 500, damping: 38 }
        }
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => end(e)}
        onPointerCancel={(e) => end(e, true)}
        onLostPointerCapture={(e) => {
          if (e.target === e.currentTarget && start.current) {
            start.current = null;
            setDragging(false);
            setOffset(0);
          }
        }}
        onClickCapture={(e) => {
          if (moved.current || deleting) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
