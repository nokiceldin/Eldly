import { useReducedMotion } from "../useReducedMotion";
import { useState } from "react";
import { motion, useAnimationControls } from "motion/react";

export default function TaskCheck({
  checked,
  label,
  description,
  onToggle,
}: {
  checked: boolean;
  label: string;
  description: string;
  onToggle: () => void;
}) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  const [pulse, setPulse] = useState(0);
  function toggle() {
    if (!checked && !reduce) {
      setPulse((n) => n + 1);
      void controls.start({
        scale: [0.86, 1.19, 0.96, 1],
        y: [3, -2, 1, 0],
        rotate: [-5, 3, -1, 0],
        transition: { duration: 0.42, times: [0, 0.4, 0.73, 1] },
      });
    } else controls.set({ scale: 1, y: 0, rotate: 0 });
    onToggle();
  }
  return (
    <motion.button
      className="note-check tactile-check"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-description={description}
      onClick={toggle}
      whileHover={reduce ? undefined : { scale: 1.06 }}
      whileTap={reduce ? undefined : { scale: 0.94, y: 3 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
    >
      {pulse > 0 && !reduce && (
        <motion.i
          key={"ring" + pulse}
          className="check-ripple"
          aria-hidden="true"
          initial={{ scale: 0.7, opacity: 0.65 }}
          animate={{ scale: 1.95, opacity: 0 }}
          transition={{ duration: 0.48, ease: "easeOut" }}
        />
      )}
      {pulse > 0 &&
        !reduce &&
        Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3 - Math.PI / 6;
          return (
            <motion.i
              key={`${pulse}-${i}`}
              className="check-spark"
              aria-hidden="true"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
              animate={{
                x: [0, Math.cos(a) * 29, Math.cos(a) * 35],
                y: [0, Math.sin(a) * 29, Math.sin(a) * 35 + 4],
                opacity: [0, 0.85, 0],
                scale: [0.3, 1, 0],
              }}
              transition={{ duration: 0.46, delay: 0.04, times: [0, 0.35, 1] }}
            />
          );
        })}
      <motion.span className="check-face" animate={controls}>
        <motion.b
          className="check-fill"
          aria-hidden="true"
          initial={false}
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 340, damping: 24 }
          }
        />
        <motion.svg
          viewBox="0 0 20 20"
          width="21"
          height="21"
          aria-hidden="true"
          className="check-glyph"
          initial={false}
          animate={{ opacity: checked ? 1 : 0.16 }}
          transition={{ duration: reduce ? 0 : 0.12 }}
        >
          <motion.path
            key={checked ? "done" : "ready"}
            d="m4 10 4 4 8-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: checked && pulse && !reduce ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: reduce ? 0 : 0.22,
              delay: reduce ? 0 : 0.06,
            }}
          />
        </motion.svg>
      </motion.span>
    </motion.button>
  );
}
