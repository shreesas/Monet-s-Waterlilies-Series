import { useEffect, useState } from "react";
// eslint-disable-next-line no-unused-vars -- `motion` / `AnimatePresence` are used in JSX; project eslint lacks jsx-uses-vars
import { motion, AnimatePresence } from "framer-motion";

// Two full-bleed intro splashes shown before the home page (LilyMorph).
// Painting fills the viewport behind the text. No overlay: each background
// painting is luminous enough that body copy reads cleanly directly on top.
// Catalog references picked by the editorial side:
//   • Screen 1 — W.1727 (1908, Private collection)
//   • Screen 2 — W.1731 (1908, Tokyo Fuji Art Museum)

const SCREENS = [
  {
    id: "garden",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/0/07/Claude_Monet_-_Waterlilies_-_Nympheas_%281908%29.jpg",
    alt: "Claude Monet, Water-Lilies (1908) — soft greens and pinks across the pond",
    // object-position keeps the brightest part of the painting behind the
    // text on common laptop aspect ratios.
    objectPosition: "center 35%",
    render: () => (
      <>
        <h1
          className="font-serif text-charcoal leading-[1.05]"
          style={{ fontSize: "clamp(2.25rem, 5.5vw, 4.75rem)" }}
        >
          A garden. A pond. 30 years.
        </h1>
        <p
          className="mt-4"
          style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.5rem)" }}
        >
          <span className="font-sans text-charcoal/85">
            Exploring the shape of{" "}
          </span>
          <span className="font-serif italic text-charcoal/85">
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
    objectPosition: "center 40%",
    render: () => (
      <div className="max-w-[34rem] text-center">
        <h2
          className="font-serif text-charcoal leading-[1.1]"
          style={{ fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)" }}
        >
          Monet&rsquo;s obsession with{" "}
          <span className="italic">water lilies</span>
        </h2>
        <p
          className="mt-6 font-sans text-charcoal/85 leading-relaxed mx-auto"
          style={{ fontSize: "clamp(0.98rem, 1.2vw, 1.1rem)", textWrap: "pretty" }}
        >
          From 1897 until his death in 1926, Monet painted the same water lily
          pond over and over. Across those three decades his wife died, his
          vision failed, and war reached his doorstep. Each event left its mark
          on the canvas, in the weight of the brushwork, the heat of the color,
          the dissolving of the horizon.
        </p>
        <p
          className="mt-6 font-serif italic text-charcoal/85 leading-relaxed"
          style={{ fontSize: "clamp(1rem, 1.3vw, 1.2rem)", textWrap: "pretty" }}
        >
          Follow the pond through life, across 10 paintings.
        </p>
      </div>
    ),
  },
];

export default function HomeIntro({ onComplete }) {
  const [index, setIndex] = useState(0);

  // Preload the next screen's image so the cross-fade isn't jarring on slow
  // connections. Cheap: just two ~1MB JPGs from Wikimedia.
  useEffect(() => {
    SCREENS.forEach((s) => {
      const img = new Image();
      img.src = s.image;
    });
  }, []);

  // Keyboard / click anywhere advances. Last screen → enter home.
  function advance() {
    if (index < SCREENS.length - 1) setIndex(index + 1);
    else onComplete();
  }

  useEffect(() => {
    function onKey(e) {
      if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        advance();
      } else if (e.key === "Escape") {
        onComplete();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const screen = SCREENS[index];
  const isLast = index === SCREENS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden cursor-pointer select-none"
      onClick={advance}
      role="button"
      tabIndex={0}
      aria-label={isLast ? "Enter the experience" : "Continue"}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={screen.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <img
            src={screen.image}
            alt={screen.alt}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: screen.objectPosition }}
            draggable={false}
          />

          <div className="absolute inset-0 flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                duration: 0.7,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-center"
            >
              {screen.render()}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots + hint sit at the bottom across both screens, outside
          the AnimatePresence so they don't fade with each slide. */}
      <div className="absolute bottom-6 inset-x-0 z-10 flex flex-col items-center gap-3 pointer-events-none">
        <div className="flex items-center gap-2">
          {SCREENS.map((s, i) => (
            <span
              key={s.id}
              className="block rounded-full transition-all"
              style={{
                width: i === index ? 8 : 6,
                height: i === index ? 8 : 6,
                backgroundColor:
                  i === index ? "rgba(45,45,45,0.85)" : "rgba(45,45,45,0.3)",
              }}
            />
          ))}
        </div>
        <p className="font-sans text-xs tracking-wide uppercase text-charcoal/55">
          {isLast ? "Click to begin" : "Click to continue"}
        </p>
      </div>
    </div>
  );
}
