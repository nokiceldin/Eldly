import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useReducedMotion } from "../useReducedMotion";
const colors = ["#91d4a0", "#d8bc74", "#99c3f2", "#d0bee7"];
export default function DayCelebration() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="day-celebration"
      role="status"
      aria-live="polite"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
      transition={
        reduce
          ? { duration: 0.12 }
          : { type: "spring", stiffness: 370, damping: 23 }
      }
    >
      <div className="celebration-badge" aria-hidden="true">
        {!reduce &&
          Array.from({ length: 10 }, (_, i) => {
            const angle = (i * Math.PI) / 5;
            return (
              <motion.i
                className="celebration-spark"
                key={i}
                style={{ background: colors[i % colors.length] }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                animate={{
                  x: [0, Math.cos(angle) * 55, Math.cos(angle) * 67],
                  y: [0, Math.sin(angle) * 49, Math.sin(angle) * 49 + 15],
                  opacity: [0, 1, 0],
                  scale: [0.3, 1, 0.7],
                  rotate: i * 49,
                }}
                transition={{
                  duration: 0.8,
                  delay: 0.12,
                  times: [0, 0.35, 1],
                  ease: "easeOut",
                }}
              />
            );
          })}
        <motion.span
          className="celebration-circle"
          initial={reduce ? false : { scale: 0.4, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 350,
            damping: 15,
            delay: reduce ? 0 : 0.06,
          }}
        >
          <Check size={26} strokeWidth={3} />
        </motion.span>
      </div>
      <span>Finished everything for the day</span>
    </motion.div>
  );
}
