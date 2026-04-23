// eslint-disable-next-line no-unused-vars -- `motion` is used in JSX; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";
import { useEffect } from "react";

// Full-bleed intro splash for the East Meets West experience.
// Mirrors the painting-first dissolve sequence of HomeIntro screen 2:
//   1. Painting fades in over PAINT_S seconds.
//   2. After TEXT_DELAY_S seconds, text dissolves in over TEXT_S seconds.
// Background painting: W.1661.

const PAINT_S     = 1.8;
const TEXT_DELAY_S = 1.2;
const TEXT_S      = 1.5;

const BG_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/5/52/Monet_-_Wildenstein_1996%2C_1661.jpg";

export default function EastMeetsWestIntro({ onDismiss }) {
  // Preload the background painting.
  useEffect(() => {
    const img = new Image();
    img.src = BG_IMAGE;
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (["Enter", " ", "ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) {
        e.preventDefault();
        onDismiss();
      } else if (e.key === "Escape") {
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
      transition={{ duration: PAINT_S, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 overflow-hidden cursor-pointer select-none bg-stone"
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      aria-label="Enter East Meets West"
    >
      {/* Full-bleed background painting */}
      <img
        src={BG_IMAGE}
        alt="Claude Monet, Water-Lilies (c. 1916) — ambient background"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 40%" }}
        draggable={false}
      />

      {/* Text — same left-aligned layout and scale as HomeIntro screen 2 */}
      <div className="absolute inset-0 flex items-center justify-start px-12 md:px-20 lg:px-28">
        <motion.div
          className="text-left max-w-[60rem]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            opacity: { duration: TEXT_S, delay: TEXT_DELAY_S, ease: [0.22, 1, 0.36, 1] },
            y:       { duration: TEXT_S, delay: TEXT_DELAY_S, ease: [0.22, 1, 0.36, 1] },
          }}
        >
          <h2
            className="font-serif text-black leading-[1.1] md:whitespace-nowrap"
            style={{ fontSize: "clamp(1.75rem, 4vw, 3.25rem)" }}
          >
            How <span className="italic">ukiyo-e</span> shaped Monet&rsquo;s garden
          </h2>

          <p
            className="mt-6 font-sans text-black/85 leading-snug"
            style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)", textWrap: "pretty" }}
          >
            When Japan opened to the West in the 1850s, a flood of woodblock
            prints reached Paris. Monet collected 231 of them. Their influence
            shaped the way he painted it for the rest of his life.
          </p>

          <p
            className="mt-6 font-serif italic text-black/85 leading-snug"
            style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)", textWrap: "pretty" }}
          >
            Pick a lily to see how.
          </p>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="mt-10 rounded-full border-2 border-black/70 bg-transparent text-black/85 font-serif font-bold text-sm tracking-wide px-8 py-3 hover:bg-black hover:text-white hover:border-black transition-colors duration-300"
          >
            Begin
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
