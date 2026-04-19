// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.p>; project eslint lacks jsx-uses-vars
import { motion, AnimatePresence } from "framer-motion";

export default function InfoBlock({ text, visible, style }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        ...style,
        transform: "translate(-50%, 0)",
        // Font reduced 30% from the previous doubled size; box width
        // shrinks in lockstep so the wrapped line count stays similar
        // and the text block doesn't sprawl across the print columns.
        width: "min(280px, 25vw)",
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif text-charcoal text-center leading-snug"
            style={{ fontSize: "clamp(0.7875rem, 1.05vw, 0.98rem)" }}
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
