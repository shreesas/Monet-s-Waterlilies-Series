import { useEffect, useState } from "react";
// eslint-disable-next-line no-unused-vars -- `motion` is used in JSX; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";

// Two full-bleed intro splashes shown before the home page (LilyMorph).
// Each painting fills the viewport behind the text. Catalog references:
//   • Screen 1 — W.1727 (1908, Private collection)
//   • Screen 2 — W.1731 (1908, Tokyo Fuji Art Museum)
//
// Transition design: the splashes are rendered as a *stack*, all mounted at
// once. The active screen sits on top with full opacity; previous screens stay
// rendered underneath at full opacity so when the next one fades in over them
// there is never a transparent frame. Without this, an opacity cross-fade
// between two absolute-positioned siblings briefly drops total coverage below
// 100% and reveals whatever is mounted behind the intro layer (the homepage).

const SCREENS = [
  {
    id: "garden",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/0/07/Claude_Monet_-_Waterlilies_-_Nympheas_%281908%29.jpg",
    alt: "Claude Monet, Water-Lilies (1908) — soft greens and pinks across the pond",
    objectPosition: "center 35%",
    render: () => (
      // Title and subtitle should sit at roughly equal visual width. The
      // title is ~25 chars and the subtitle is ~45 chars, so the subtitle
      // needs to scale up to about ~55% of the title's font size to match.
      <>
        <h1
          className="font-serif text-charcoal leading-[1.05]"
          style={{ fontSize: "clamp(2.25rem, 5.5vw, 4.75rem)" }}
        >
          A garden. A pond. 30 years.
        </h1>
        <p
          className="mt-5"
          style={{ fontSize: "clamp(1.25rem, 3vw, 2.6rem)" }}
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
      // Title is forced to one line at md+ via whitespace-nowrap; the body
      // copy is widened so it sits at roughly the same column width as the
      // single-line title, and bumped up to read close to the screen-1
      // subtitle. On narrow viewports we let the title wrap normally so it
      // doesn't overflow.
      <div className="max-w-[60rem] text-center mx-auto">
        <h2
          className="font-serif text-charcoal leading-[1.1] md:whitespace-nowrap"
          style={{ fontSize: "clamp(1.75rem, 4vw, 3.25rem)" }}
        >
          Monet&rsquo;s obsession with{" "}
          <span className="italic">water lilies</span>
        </h2>
        <p
          className="mt-6 font-sans text-charcoal/85 leading-snug mx-auto"
          style={{
            fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)",
            textWrap: "pretty",
          }}
        >
          From 1897 until his death in 1926, Monet painted the same water lily
          pond over and over. Across those three decades his wife died, his
          vision failed, and war reached his doorstep. Each event left its mark
          on the canvas, in the weight of the brushwork, the heat of the color,
          the dissolving of the horizon.
        </p>
        <p
          className="mt-6 font-serif italic text-charcoal/85 leading-snug"
          style={{
            fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)",
            textWrap: "pretty",
          }}
        >
          Follow the pond through life, across 10 paintings.
        </p>
      </div>
    ),
  },
];

const FADE_MS = 900;

export default function HomeIntro({ onComplete }) {
  const [index, setIndex] = useState(0);
  // While true, swallow advance attempts so a second click during a dissolve
  // doesn't skip a screen.
  const [transitioning, setTransitioning] = useState(false);

  // Preload both images upfront so the dissolve doesn't wait on the network.
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
      // Re-enable input slightly after the visual fade so a fast clicker
      // can't queue a third advance during the tail of the dissolve.
      window.setTimeout(() => setTransitioning(false), FADE_MS);
    } else {
      onComplete();
    }
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
  }, [index, transitioning]);

  const isLast = index === SCREENS.length - 1;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      // When the parent un-mounts us (intro complete), fade the whole splash
      // out as one piece so we hand off cleanly to the homepage.
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 overflow-hidden cursor-pointer select-none bg-stone"
      onClick={advance}
      role="button"
      tabIndex={0}
      aria-label={isLast ? "Enter the experience" : "Continue"}
    >
      {/* Layer stack: every screen is mounted from the start. Screens with a
          lower index sit underneath fully opaque; screens with index > the
          active one are invisible until they become active and fade in on top
          of whatever is below them. There is no moment where the stack is
          less than 100% opaque. */}
      {SCREENS.map((s, i) => {
        const visible = i <= index;
        return (
          <div
            key={s.id}
            className="absolute inset-0"
            style={{
              opacity: visible ? 1 : 0,
              transition: `opacity ${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              zIndex: i,
              pointerEvents: i === index ? "auto" : "none",
            }}
            aria-hidden={i !== index}
          >
            <img
              src={s.image}
              alt={s.alt}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: s.objectPosition }}
              draggable={false}
            />

            <div className="absolute inset-0 flex items-center justify-center px-6">
              {/* Text rides its own subtle fade-up only on the *active* screen,
                  so the body copy doesn't pop in pre-rendered for inactive
                  layers underneath. */}
              <motion.div
                initial={false}
                animate={
                  i === index
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: 8 }
                }
                transition={{
                  duration: 0.7,
                  delay: i === index ? 0.2 : 0,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="text-center"
              >
                {s.render()}
              </motion.div>
            </div>
          </div>
        );
      })}

      {/* Progress dots + hint sit above the painting stack and stay in place
          across screens so the user always knows where they are. */}
      <div className="absolute bottom-6 inset-x-0 z-20 flex flex-col items-center gap-3 pointer-events-none">
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
    </motion.div>
  );
}
