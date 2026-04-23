import { useEffect, useState } from "react";
// eslint-disable-next-line no-unused-vars -- `motion` is used in JSX; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";

// Two full-bleed intro splashes shown before the home page (LilyMorph).
// Each painting fills the viewport behind the text. Catalog references:
//   • Screen 1 — W.1727 (1908, Private collection)
//   • Screen 2 — W.1731 (1908, Tokyo Fuji Art Museum)
//
// Sequence for each screen:
//   1. Painting layer fades in over SCREEN_FADE_S seconds.
//   2. After TEXT_DELAY_S seconds (painting mostly in), text dissolves in
//      over TEXT_DURATION_S seconds.
//
// The stack layout (all screens mounted, active one on top) keeps total
// opacity at 100% throughout every dissolve so the homepage never shows.

const SCREEN_FADE_S  = 1.8;  // painting cross-dissolve duration
const TEXT_DELAY_S   = 1.2;  // text starts this many seconds after painting
const TEXT_DURATION_S = 1.5; // text fade-in duration
// Lock advance() for this long so clicks during the dissolve don't skip.
const ADVANCE_LOCK_MS = Math.round(SCREEN_FADE_S * 1000);

const SCREENS = [
  {
    id: "garden",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/0/07/Claude_Monet_-_Waterlilies_-_Nympheas_%281908%29.jpg",
    alt: "Claude Monet, Water-Lilies (1908) — soft greens and pinks across the pond",
    objectPosition: "center 45%",
    render: () => (
      <>
        <h1
          className="font-serif text-black leading-[1.05]"
          style={{ fontSize: "clamp(2.25rem, 5.5vw, 4.75rem)" }}
        >
          A garden. A pond. 30 years.
        </h1>
        <p
          className="mt-4"
          style={{ fontSize: "clamp(1.05rem, 2.55vw, 2.2rem)" }}
        >
          <span className="font-sans text-black/85">
            Exploring the shape of{" "}
          </span>
          <span className="font-serif italic text-black/85">
            Monet&rsquo;s obsession with water lilies
          </span>
        </p>
      </>
    ),
  },
  {
    id: "obsession",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/9/9e/Claude_Monet_-_Nymph%C3%A9as_%281908%29.jpg",
    alt: "Claude Monet, Nymphéas (1908) — pale lavender and green pond surface",
    objectPosition: "center 50%",
    render: () => (
      <div className="max-w-[60rem] text-left">
        <h2
          className="font-serif text-black leading-[1.1] md:whitespace-nowrap"
          style={{ fontSize: "clamp(1.75rem, 4vw, 3.25rem)" }}
        >
          Monet&rsquo;s obsession with{" "}
          <span className="italic">water lilies</span>
        </h2>
        <p
          className="mt-6 font-sans text-black/85 leading-snug"
          style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)", textWrap: "pretty" }}
        >
          From 1897 until his death in 1926, Monet painted the same water lily
          pond over and over. Across those three decades his wife died, his
          vision failed, and war reached his doorstep. Each event left its mark
          on the canvas, in the weight of the brushwork, the heat of the color,
          the dissolving of the horizon.
        </p>
        <p
          className="mt-6 font-serif italic text-black/85 leading-snug"
          style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)", textWrap: "pretty" }}
        >
          Follow the pond through life, across 10 paintings.
        </p>
      </div>
    ),
  },
];

export default function HomeIntro({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  // Preload both images so the dissolve doesn't stall on the network.
  useEffect(() => {
    SCREENS.forEach((s) => {
      const img = new Image();
      img.src = s.image;
    });
  }, []);

  function advance() {
    if (transitioning) return;
    if (index < SCREENS.length - 1) {
      setTransitioning(true);
      setIndex(index + 1);
      window.setTimeout(() => setTransitioning(false), ADVANCE_LOCK_MS);
    } else {
      onComplete();
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (["Enter", " ", "ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) {
        e.preventDefault();
        advance();
      } else if (e.key === "Escape") {
        onComplete();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, transitioning]);

  const isLast = index === SCREENS.length - 1;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 overflow-hidden cursor-pointer select-none bg-stone"
      onClick={advance}
      role="button"
      tabIndex={0}
      aria-label={isLast ? "Enter the experience" : "Continue"}
    >
      {SCREENS.map((s, i) => {
        const active = i === index;
        // Screens below the active one stay fully opaque as an opaque backdrop.
        // The active screen fades in on top; screens above active stay hidden.
        const shouldShow = i <= index;

        return (
          <motion.div
            key={s.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: shouldShow ? 1 : 0 }}
            transition={{
              duration: SCREEN_FADE_S,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ zIndex: i, pointerEvents: active ? "auto" : "none" }}
            aria-hidden={!active}
          >
            {/* Painting — fades in as part of the layer transition above */}
            <img
              src={s.image}
              alt={s.alt}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: s.objectPosition }}
              draggable={false}
            />

            {/* Text — delayed so the painting is mostly visible before copy appears */}
            <div className="absolute inset-0 flex items-center justify-start px-12 md:px-20 lg:px-28">
              <motion.div
                className="text-left"
                initial={{ opacity: 0, y: 8 }}
                animate={
                  active
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: 8 }
                }
                transition={{
                  opacity: {
                    duration: TEXT_DURATION_S,
                    delay: active ? TEXT_DELAY_S : 0,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  y: {
                    duration: TEXT_DURATION_S,
                    delay: active ? TEXT_DELAY_S : 0,
                    ease: [0.22, 1, 0.36, 1],
                  },
                }}
              >
                {s.render()}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); advance(); }}
                  className="mt-10 rounded-full bg-black/80 text-white font-sans text-sm tracking-wide px-8 py-3 hover:bg-black transition-colors"
                >
                  {i === SCREENS.length - 1 ? "Begin" : "Continue"}
                </button>
              </motion.div>
            </div>
          </motion.div>
        );
      })}

      {/* Progress dots */}
      <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none">
        <div className="flex items-center gap-2">
          {SCREENS.map((s, i) => (
            <span
              key={s.id}
              className="block rounded-full transition-all duration-500"
              style={{
                width: i === index ? 8 : 6,
                height: i === index ? 8 : 6,
                backgroundColor:
                  i === index ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.3)",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
