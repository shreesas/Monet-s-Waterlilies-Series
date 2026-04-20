// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.div>; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";

export default function IntroModal({ onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-cream/95 backdrop-blur p-8 md:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
      >
        <h2
          className="font-serif text-charcoal leading-[1.05]"
          style={{ fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)" }}
        >
          East meets west
        </h2>

        <p
          className="mt-5 font-sans text-charcoal/85 leading-relaxed"
          style={{ fontSize: "clamp(0.98rem, 1.25vw, 1.1rem)", textWrap: "pretty" }}
        >
          When Japan opened to the West in the 1850s, a flood of woodblock
          prints reached Paris. Monet collected 231 of them. Their influence
          shaped the way he painted it for the rest of his life.
        </p>

        <p
          className="mt-4 font-sans italic text-charcoal/80 leading-relaxed"
          style={{ fontSize: "clamp(0.98rem, 1.25vw, 1.1rem)", textWrap: "pretty" }}
        >
          Pick a lily to see how.
        </p>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full bg-charcoal text-cream font-sans px-6 py-2.5 text-sm md:text-base hover:bg-charcoal/85 transition-colors"
          >
            Begin
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
