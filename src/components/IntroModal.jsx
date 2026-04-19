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
          className="font-serif text-charcoal leading-tight"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}
        >
          Welcome to <span className="italic">East Meets West</span>
        </h2>
        <p
          className="mt-3 font-sans text-charcoal/80"
          style={{ fontSize: "clamp(0.95rem, 1.4vw, 1.1rem)" }}
        >
          This gallery explores how Japanese Ukiyo-e prints shaped Claude
          Monet&rsquo;s Water Lilies.
        </p>

        <div className="mt-6">
          <p className="font-sans font-medium text-charcoal text-sm md:text-base mb-3">
            How to explore:
          </p>
          <ul className="space-y-3 font-serif text-charcoal/85 text-sm md:text-base leading-relaxed">
            <li>
              Collect all <span className="font-semibold">6 pink water lilies</span>{" "}
              floating beside the prints &mdash; each one reveals a story about
              the connection between East and West and rotates the central
              painting.
            </li>
            <li>
              Click <span className="font-semibold">any painting or print</span>{" "}
              to view it fullscreen with its title, artist, year, and
              collection.
            </li>
            <li>
              Drag the <span className="font-semibold">slider</span> at the
              bottom of the screen to explore the gallery from side to side.
            </li>
          </ul>
        </div>

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
