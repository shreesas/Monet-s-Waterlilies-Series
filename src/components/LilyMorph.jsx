import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const MANIFEST_URL = "/lily_morphs/manifest.json";
const BASE = "/lily_morphs/";
const DURATION_MS = 4000;

const ANCHOR_META = [
  { title: "Water Lilies", year: "1897\u20131898", collection: "Los Angeles County Museum of Art" },
  { title: "The Lily Pond", year: "1899", collection: "National Gallery, London" },
  { title: "Water-Lilies", year: "1903", collection: "Dayton Art Institute" },
  { title: "Water Lilies", year: "1906", collection: "Art Institute of Chicago" },
  { title: "Water-Lilies", year: "1907", collection: "Kawamura Memorial DIC Museum of Art, Sakura" },
  { title: "Water-Lilies", year: "1915", collection: "Neue Pinakothek, Munich" },
  { title: "Water Lilies", year: "1916", collection: "National Museum of Western Art, Tokyo" },
  { title: "Water-Lilies", year: "1916\u20131919", collection: "Mus\u00e9e Marmottan Monet, Paris" },
  { title: "Jardin d'eau \u00e0 Giverny", year: "1920", collection: "Mus\u00e9e de Grenoble" },
  { title: "Water-Lily Pond, Evening", year: "1920\u20131926", collection: "Kunsthaus Z\u00fcrich" },
];

// Short, unique year labels shown beside each timeline dot. Drawn from the
// start (or end) of each anchor's date range so every label is distinct and
// monotonically increases — makes the progression legible at a glance.
const TIMELINE_YEARS = [
  "1897",
  "1899",
  "1903",
  "1906",
  "1907",
  "1915",
  "1916",
  "1919",
  "1920",
  "1926",
];

const TIMELINE_ACTIVE_COLOR = "#86B89A";

// Fixed vertical slot for each timeline item. The timeline container slides
// up/down so the active item's slot lines up with the painting title in the
// right-side text column. See the `titleY` measurement below.
const TIMELINE_ITEM_HEIGHT = 72;

const ANCHOR_DESCRIPTIONS = [
  "Monet didn't just paint a garden, he built one. He diverted a river, dug a pond, and built a Japanese bridge, inspired by the 231 ukiyo-e woodblock prints hanging on his walls at Giverny. These early paintings are the first record of what that pond looked like.",
  "At 59, Monet painted 18 views of this Japanese bridge in a single summer. Eight gardeners and a full-time pond keeper maintained his living canvas. The lilies became the subject.",
  "By 1903, the bridge had vanished from Monet's frame entirely. He was now painting only the surface of the water, no sky, no shore, no horizon. Twenty-five canvases from this new approach were shown in Paris in 1900.",
  "Before this, only white water lilies existed in Europe. Monet ordered the first colored varieties from a nursery in southwest France that had just invented them. Pinks, yellows, deep reds.",
  "Monet wrote around this time: \u201cThese landscapes of water and reflection have become an obsession. This is beyond the strength of an old man.\u201d He painted through doubt and exhaustion, destroying canvases he felt weren't good enough.",
  "Alice, Monet\u2019s second wife, died. Monet barely painted for three years. His gardeners kept the pond alive while its painter grieved. When he returned to the canvas around 1914, the scale had grown vast, as if the pond needed to contain something larger than before.",
  "War came to Giverny in 1914. Neighbors fled; his stepson fought at the front. Monet stayed and kept painting. The colors in these wartime canvases grow heavier and more turbulent, the pond absorbing what was happening just beyond its banks.",
  "During the war years, Monet painted weeping willows over the pond as elegies for the fallen. In French tradition the weeping willow has long been a symbol of grief, planted in cemeteries, worn at funerals. Monet grew them at the pond's edge and let them fall into the painting.",
  "By 1920, Monet was destroying as many canvases as he kept. He had built this garden with his own hands, knew every inch of it, yet still felt he was failing to capture it. Some days he painted in despair. Some days he slashed the canvas. The pond remained but the painter was losing his grip on it.",
  "Cataracts had turned Monet's world red and yellow, this burning canvas is what he saw. Surgery in 1923 restored his sight, but he then repainted these canvases in a panic, correcting colours he could finally see again. He died at 86 in 1926, still retouching.",
];

// Glue the final two words of each description with a non-breaking space so
// the last line never wraps to a single word (a "widow"). Pairs with the
// `text-wrap: pretty` style on the paragraph element in modern browsers.
function avoidWidow(text) {
  const i = text.lastIndexOf(" ");
  if (i === -1) return text;
  return text.slice(0, i) + "\u00A0" + text.slice(i + 1);
}

export default function LilyMorph() {
  const [transitions, setTransitions] = useState(null);
  const [anchorIdx, setAnchorIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [paintingVisible, setPaintingVisible] = useState(false);

  const imgRef = useRef(null);
  const animatingRef = useRef(false);
  const anchorIdxRef = useRef(0);

  // Refs + state for aligning the timeline with the painting title in the
  // right-side text column. `titleY` is the vertical center of the title
  // measured in the aside's local coordinate space; the timeline container
  // translates by `(titleY - (i+0.5)*ITEM_HEIGHT)` so item `i` lands on that
  // line.
  const asideRef = useRef(null);
  const titleRef = useRef(null);
  const [titleY, setTitleY] = useState(null);

  useEffect(() => {
    animatingRef.current = animating;
  }, [animating]);
  useEffect(() => {
    anchorIdxRef.current = anchorIdx;
  }, [anchorIdx]);

  // Load manifest and preload all 225 frames in parallel. Each frame's
  // HTMLImageElement is kept on the transitions structure so playback
  // is just `imgRef.current.src = frame.img.src` per rAF tick - no
  // network or decode latency once preloading completes.
  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`manifest ${r.status}`);
        return r.json();
      })
      .then((manifest) => {
        if (cancelled) return;
        const tx = manifest.transitions.map((t) => ({
          info: t,
          frames: t.frames.map((f) => {
            const img = new Image();
            img.src = BASE + t.folder + "/" + f.file;
            return { img, ...f };
          }),
        }));
        const total = tx.reduce((s, t) => s + t.frames.length, 0);
        setTotalCount(total);
        let loaded = 0;
        for (const t of tx) {
          for (const f of t.frames) {
            const done = () => {
              loaded += 1;
              if (!cancelled) setLoadedCount(loaded);
            };
            if (f.img.complete && f.img.naturalWidth > 0) done();
            else {
              f.img.addEventListener("load", done, { once: true });
              f.img.addEventListener("error", done, { once: true });
            }
          }
        }
        setTransitions(tx);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anchors = useMemo(() => {
    if (!transitions || !transitions.length) return [];
    const out = [{ value: transitions[0].info.start_index, frame: transitions[0].frames[0] }];
    for (const t of transitions) {
      const last = t.frames[t.frames.length - 1];
      out.push({ value: t.info.end_index, frame: last });
    }
    return out;
  }, [transitions]);

  useEffect(() => {
    if (!anchors.length || !imgRef.current) return;
    if (animatingRef.current) return;
    imgRef.current.src = anchors[anchorIdx].frame.img.src;
  }, [anchors, anchorIdx]);

  // Measure the vertical position of the painting title (in the right-side
  // text column) relative to the timeline aside, so we can slide the timeline
  // to put the active year right next to the title. Runs:
  //   - on anchor change (title text swaps, which may change its height/pos)
  //   - on window resize and any size change of aside/title (via ResizeObserver,
  //     which also catches late font loads and content reflow)
  useLayoutEffect(() => {
    function update() {
      if (!titleRef.current || !asideRef.current) return;
      const asideRect = asideRef.current.getBoundingClientRect();
      const titleRect = titleRef.current.getBoundingClientRect();
      if (asideRect.height === 0 || titleRect.height === 0) return;
      setTitleY(titleRect.top + titleRect.height / 2 - asideRect.top);
    }
    update();
    const ro = new ResizeObserver(update);
    if (asideRef.current) ro.observe(asideRef.current);
    if (titleRef.current) ro.observe(titleRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [anchorIdx]);

  function playFrames(frames, onDone) {
    setAnimating(true);
    animatingRef.current = true;
    const n = frames.length;
    const t0 = performance.now();
    let last = -1;
    function tick(now) {
      const p = Math.min(1, (now - t0) / DURATION_MS);
      const idx = Math.min(n - 1, Math.floor(p * (n - 1) + 0.5));
      if (idx !== last && imgRef.current) {
        imgRef.current.src = frames[idx].img.src;
        last = idx;
      }
      if (p < 1) requestAnimationFrame(tick);
      else {
        animatingRef.current = false;
        setAnimating(false);
        onDone();
      }
    }
    requestAnimationFrame(tick);
  }

  function step(dir) {
    if (animatingRef.current || !transitions) return;
    const current = anchorIdxRef.current;
    const target = current + dir;
    if (target < 0 || target >= anchors.length) return;
    const trIdx = dir > 0 ? current : current - 1;
    const tr = transitions[trIdx];
    const frames = dir > 0 ? tr.frames : [...tr.frames].reverse();
    // Commit the new anchor index up front so the right-column metadata and
    // description swap as soon as the morph starts. The image-update effect
    // bails out while animatingRef is true, so the playing frames aren't
    // disturbed by this state change.
    anchorIdxRef.current = target;
    setAnchorIdx(target);
    playFrames(frames, () => {});
  }

  // Pagination dots: morph if neighbour, snap if farther (replaying every
  // transition would take 4s * N which would feel broken).
  function jumpTo(target) {
    if (animatingRef.current || !transitions) return;
    const current = anchorIdxRef.current;
    if (target === current) return;
    if (target < 0 || target >= anchors.length) return;
    if (Math.abs(target - current) === 1) {
      step(target > current ? +1 : -1);
      return;
    }
    setAnchorIdx(target);
  }

  useEffect(() => {
    function onKey(e) {
      if (animatingRef.current) return;
      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "PageDown"
      )
        step(+1);
      else if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp" ||
        e.key === "PageUp"
      )
        step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [transitions, anchors.length]);

  // Hijack the wheel so each scroll gesture (up or down) plays one morph
  // instead of moving the page. Trackpad inertia can fire wheel events for
  // several hundred ms after a swipe ends, so we (a) ignore everything while
  // a morph is playing and (b) keep a 700ms cooldown after each transition
  // commits to swallow the trailing inertia tail.
  useEffect(() => {
    let lastFire = 0;
    const COOLDOWN_MS = 700;
    function onWheel(e) {
      e.preventDefault();
      if (animatingRef.current) return;
      if (performance.now() - lastFire < COOLDOWN_MS) return;
      if (Math.abs(e.deltaY) < 4) return;
      lastFire = performance.now();
      if (e.deltaY > 0) step(+1);
      else step(-1);
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [transitions, anchors.length]);

  const ready = !!transitions;
  const preloadDone = totalCount > 0 && loadedCount >= totalCount;

  return (
    <section className="h-[80vh] w-full flex flex-col lg:grid lg:grid-cols-[1fr_96px_22%] xl:grid-cols-[1fr_112px_20%] lg:grid-rows-1">
      {/* DESKTOP: vertical year timeline next to the painting.
          A single continuous vertical line runs top-to-bottom behind the
          aside (stationary). The year-dot strip sits in front and slides
          vertically so the active year lines up with the painting title in
          the right-side text column. Items that slide off the top/bottom of
          the aside are clipped by overflow-hidden. */}
      <motion.aside
        ref={asideRef}
        className="hidden lg:block lg:col-start-2 lg:row-start-1 relative overflow-hidden px-2 xl:px-3"
        aria-label="Timeline"
        initial={{ opacity: 0 }}
        animate={{ opacity: paintingVisible ? 1 : 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
        {/* Stationary, always-visible vertical line — gives the timeline a
            continuous spine no matter where the dots translate to. */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-charcoal/15"
          aria-hidden="true"
        />

        {/* Sliding year-dot strip. Each slot is a fixed height so the math
            for aligning slot `i` to `titleY` is a clean linear translate. */}
        <div
          className="absolute inset-x-0 top-0 flex flex-col items-stretch transition-transform duration-500 ease-out"
          style={{
            transform:
              titleY !== null
                ? `translateY(${titleY - (anchorIdx + 0.5) * TIMELINE_ITEM_HEIGHT}px)`
                : `translateY(calc(50% - ${(anchorIdx + 0.5) * TIMELINE_ITEM_HEIGHT}px))`,
          }}
        >
          {TIMELINE_YEARS.map((year, i) => {
            const isActive = i === anchorIdx;
            return (
              <div
                key={i}
                className="relative flex flex-col items-center justify-center"
                style={{ height: TIMELINE_ITEM_HEIGHT }}
              >
                <button
                  type="button"
                  aria-label={`Go to painting ${i + 1}, ${year}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => jumpTo(i)}
                  disabled={!ready || animating}
                  className="relative z-10 flex flex-col items-center gap-1.5 px-2 py-1 rounded group disabled:cursor-not-allowed bg-white"
                >
                  <span
                    className={`font-sans font-medium text-xs tabular-nums transition-colors ${
                      isActive
                        ? "text-charcoal"
                        : "text-charcoal/40 group-hover:text-charcoal/70"
                    }`}
                  >
                    {year}
                  </span>
                  <span
                    className="block rounded-full transition-all"
                    style={{
                      width: isActive ? 10 : 7,
                      height: isActive ? 10 : 7,
                      backgroundColor: isActive
                        ? TIMELINE_ACTIVE_COLOR
                        : `${TIMELINE_ACTIVE_COLOR}55`,
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </motion.aside>

      {/* MOBILE: compact horizontal pagination (chevron / dots / chevron).
          Hidden at lg+ because the vertical timeline takes over. */}
      <motion.div
        className="order-3 lg:hidden flex flex-row items-center justify-center gap-1 shrink-0 px-4 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: paintingVisible ? 1 : 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
        <button
          type="button"
          aria-label="Previous painting"
          onClick={() => step(-1)}
          disabled={!ready || anchorIdx === 0 || animating}
          className="w-9 h-9 flex items-center justify-center rounded-full text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5 transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex flex-row items-center gap-0.5 py-1">
          {Array.from({ length: anchors.length || 10 }).map((_, k) => {
            const isActive = k === anchorIdx;
            return (
              <button
                key={k}
                type="button"
                aria-label={`Go to painting ${k + 1}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => jumpTo(k)}
                disabled={!ready || animating}
                className="p-1.5 group disabled:cursor-not-allowed"
              >
                <span
                  className="block rounded-full transition-all"
                  style={{
                    width: isActive ? 9 : 6,
                    height: isActive ? 9 : 6,
                    backgroundColor: isActive
                      ? TIMELINE_ACTIVE_COLOR
                      : `${TIMELINE_ACTIVE_COLOR}55`,
                  }}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Next painting"
          onClick={() => step(+1)}
          disabled={!ready || anchorIdx >= anchors.length - 1 || animating}
          className="w-9 h-9 flex items-center justify-center rounded-full text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5 transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </motion.div>

      {/* MIDDLE: morph painting */}
      <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:min-w-0 relative min-h-[40vh] lg:min-h-0">
        <img
          ref={imgRef}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setPaintingVisible(true)}
        />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-charcoal/50 font-sans text-sm">
            loading…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-700 font-sans text-sm px-6 text-center">
            Couldn’t load morph frames: {error}
          </div>
        )}
      </div>

      {/* RIGHT: per-anchor metadata + description */}
      <motion.div
        className="order-4 lg:order-none lg:col-start-3 lg:row-start-1 flex flex-col justify-center px-6 md:px-10 lg:px-6 xl:px-8 py-8 lg:py-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: paintingVisible ? 1 : 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
      >
        <div className="max-w-prose">
          <div className="mb-5 font-sans">
            <p
              ref={titleRef}
              className="text-charcoal font-medium leading-tight"
              style={{ fontSize: "clamp(15px, 1.15vw, 19px)" }}
            >
              {ANCHOR_META[anchorIdx].title}
              <span className="text-charcoal/55 font-normal">, {ANCHOR_META[anchorIdx].year}</span>
            </p>
            <p className="mt-1 text-charcoal/55" style={{ fontSize: "clamp(12px, 0.9vw, 14px)" }}>
              {ANCHOR_META[anchorIdx].collection}
            </p>
          </div>

          <p
            className="font-serif italic text-charcoal/80 leading-relaxed"
            style={{
              fontSize: "clamp(15px, 1.2vw, 20px)",
              textWrap: "pretty",
            }}
          >
            {avoidWidow(ANCHOR_DESCRIPTIONS[anchorIdx])}
          </p>

          {/* Advance to next painting. Sits directly under the description so
              the primary "read this, then move on" gesture lives in a single
              column. Disabled (not hidden) at the last anchor so the layout
              doesn't jump on the final step. */}
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={() => step(+1)}
              disabled={!ready || animating || anchorIdx >= anchors.length - 1}
              aria-label="Next painting"
              className="w-11 h-11 flex items-center justify-center rounded-full border border-charcoal/25 text-charcoal/70 hover:text-charcoal hover:border-charcoal/60 hover:bg-charcoal/5 transition-colors disabled:opacity-25 disabled:pointer-events-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {totalCount > 0 && !preloadDone && (
            <p className="mt-4 font-sans text-xs text-charcoal/40 tabular-nums">
              preloading {loadedCount} / {totalCount} frames
            </p>
          )}
        </div>
      </motion.div>
    </section>
  );
}
