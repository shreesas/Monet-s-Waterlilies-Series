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
      aria-label="Enter Curated Lineage"
    >
      {/* Full-bleed background painting */}
      <img
        src={BG_IMAGE}
        alt="Claude Monet, Water Lilies (W.1978) — ambient background"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 55%" }}
        draggable={false}
      />

      {/* Soft dark veil so text stays legible over the painting */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 60%, transparent 100%)" }}
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
          <p
            className="font-sans text-white/70 uppercase tracking-widest mb-3"
            style={{ fontSize: "clamp(0.65rem, 0.9vw, 0.8rem)", letterSpacing: "0.2em" }}
          >
            Water Lilies &amp; Their Legacy
          </p>

          <h2
            className="font-serif text-white leading-[1.1]"
            style={{ fontSize: "clamp(1.75rem, 4vw, 3.25rem)" }}
          >
            The &ldquo;Curated Lineage&rdquo;
          </h2>

          <p
            className="mt-6 font-sans text-white/88 leading-snug"
            style={{ fontSize: "clamp(1rem, 1.55vw, 1.45rem)", textWrap: "pretty" }}
          >
            After his death in 1926, Monet&rsquo;s massive late canvases sat in his
            studio, dismissed as the messy, formless mistakes of a failing eye. For
            nearly thirty years, the art world ignored them. But in the 1950s, as
            American painters began pouring, dripping, and staining massive canvases,
            critics started drawing a connection. Suddenly, Monet&rsquo;s horizonless,
            edge-to-edge ponds looked exactly like the radical new work of the Abstract
            Expressionists. But was Monet truly the blueprint for artists like Pollock
            and Rothko, or was this connection a convenient bridge built by mid-century
            critics?
          </p>

          <p
            className="mt-5 font-serif italic text-white/80 leading-snug"
            style={{ fontSize: "clamp(1rem, 1.55vw, 1.45rem)", textWrap: "pretty" }}
          >
            Click a painting to uncover the true nature of its connection.
          </p>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="mt-10 rounded-full border-2 border-white/75 bg-transparent text-white font-serif font-bold text-sm tracking-wide px-8 py-3 hover:bg-white hover:text-black hover:border-white transition-colors duration-300"
          >
            Begin
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
