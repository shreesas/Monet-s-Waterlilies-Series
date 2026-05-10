// eslint-disable-next-line no-unused-vars -- `motion` is used in JSX; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";
import { useEffect } from "react";

// Full-bleed intro splash for the Water Lilies Influence (Polaroid) experience.
// Mirrors the painting-first dissolve sequence of EastMeetsWestIntro.
// Background: Monet, W.1978 (catalog).

const PAINT_S      = 1.8;
const TEXT_DELAY_S = 1.2;
const TEXT_S       = 1.5;

const BG_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/5/50/Claude_Monet_044.jpg";

export default function InfluenceGraphPolaroidIntro({ onDismiss }) {
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
      aria-label="Enter Abstract Legacy"
    >
      {/* Full-bleed background painting at 70% opacity */}
      <img
        src={BG_IMAGE}
        alt="Claude Monet, Water Lilies (W.1978) — ambient background"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 55%", opacity: 0.7 }}
        draggable={false}
      />

      <div className="absolute inset-0 flex items-center justify-start px-12 md:px-20 lg:px-28">
        <motion.div
          className="text-left max-w-[58rem]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            opacity: { duration: TEXT_S, delay: TEXT_DELAY_S, ease: [0.22, 1, 0.36, 1] },
            y:       { duration: TEXT_S, delay: TEXT_DELAY_S, ease: [0.22, 1, 0.36, 1] },
          }}
        >
          <h2
            className="font-serif text-black leading-[1.1]"
            style={{ fontSize: "clamp(1.75rem, 4vw, 3.25rem)" }}
          >
            The &ldquo;Curated Lineage&rdquo;
          </h2>

          <p
            className="mt-6 font-sans text-black/85 leading-snug"
            style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)", textWrap: "pretty" }}
          >
            Once dismissed as "formless mistakes" caused by failing eyesight, Monet’s late works were ignored for decades. In the 1950s, critics rediscovered them as a precursor to Abstract Expressionism. But was Monet truly the blueprint for artists like Pollock and Rothko, or was this connection a convenient bridge built by mid-century critics?

          </p>

          <p
            className="mt-5 font-serif italic text-black/85 leading-snug"
            style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)", textWrap: "pretty" }}
          >
            Click a painting to uncover the true nature of its connection.
          </p>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="mt-10 rounded-full border-2 border-black/70 bg-transparent text-black font-serif font-bold text-sm tracking-wide px-8 py-3 hover:bg-black hover:text-white hover:border-black transition-colors duration-150"
          >
            Begin
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
