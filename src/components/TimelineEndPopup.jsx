import { useEffect } from "react";
// eslint-disable-next-line no-unused-vars -- `motion` is used in JSX; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";
import ukiyoePreview from "../assets/J4.jpg";

// Modal that appears after the user has stepped through every anchor in the
// LilyMorph timeline. Hands them off to the next experience (Ukiyo-e
// Influence) with a single primary CTA. The button styling is intentionally
// identical to the "Continue / Begin" buttons in HomeIntro and
// EastMeetsWestIntro so the visual language of the intro splashes carries
// through to the transition between experiences.
export default function TimelineEndPopup({ onDismiss }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="timeline-end-popup-title"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.32)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{
          duration: 0.6,
          delay: 0.08,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative w-full max-w-[44rem] bg-white rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.28)] px-10 md:px-16 py-12 md:py-14 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close affordance — keeps the popup dismissible without forcing the
            CTA, so the visitor can stay on the final painting if they want. */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-black/45 hover:text-black hover:bg-black/5 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <p
          id="timeline-end-popup-title"
          className="font-sans text-black/85 leading-snug"
          style={{
            fontSize: "clamp(1.05rem, 1.55vw, 1.4rem)",
            textWrap: "pretty",
          }}
        >
          30 years of evolution. You&rsquo;ve seen how the pond changed as Monet
          did. But was this vision born in Giverny, or was he looking somewhere
          else entirely?
        </p>

        <p
          className="mt-9 font-serif italic text-black leading-snug"
          style={{
            fontSize: "clamp(1.35rem, 2.2vw, 1.95rem)",
            textWrap: "pretty",
          }}
        >
          What shaped the eye that changed everything?
        </p>

        <div
          className="mt-8 w-full overflow-hidden"
          style={{ borderRadius: 20, maxHeight: 220 }}
        >
          <img
            src={ukiyoePreview}
            alt="Hiroshige, Red Maple Trees at the Tsuten Bridge"
            className="w-full"
            style={{ display: "block", height: "auto" }}
          />
        </div>

        <div className="mt-6 flex justify-center">
          <a
            href="#/ukiyo-e-influence"
            onClick={(e) => {
              // Stop the backdrop dismiss handler from also firing.
              e.stopPropagation();
            }}
            className="inline-flex items-center justify-center rounded-full border-2 border-black/70 bg-transparent text-black/85 font-serif font-bold tracking-wide px-8 py-3 hover:bg-black hover:text-white hover:border-black transition-colors duration-150"
            style={{ fontSize: "clamp(0.95rem, 1.05vw, 1.05rem)" }}
          >
            Look forward: The Ukiyo-e Influence
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
