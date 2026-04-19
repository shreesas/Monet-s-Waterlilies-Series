import { useEffect, useMemo, useRef, useState } from "react";

const MANIFEST_URL = "/lily_morphs/manifest.json";
const BASE = "/lily_morphs/";
const DURATION_MS = 4000;

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
  "Cataracts had turned Monet's world red and yellow, this burning canvas is what he saw. Surgery in 1923 restored his sight, but he then repainted these canvases in a panic, correcting colours he could finally see again. He died at 86 in 1926, still retouching. The Orangerie opened five months later.",
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

  const imgRef = useRef(null);
  const animatingRef = useRef(false);
  const anchorIdxRef = useRef(0);

  useEffect(() => {
    animatingRef.current = animating;
  }, [animating]);
  useEffect(() => {
    anchorIdxRef.current = anchorIdx;
  }, [anchorIdx]);

  // Load manifest and preload all 225 frames in parallel. Each frame's
  // HTMLImageElement is kept on the transitions structure so playback
  // is just `imgRef.current.src = frame.img.src` per rAF tick — no
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

  // Anchors: first frame of transition 0, then last frame of every
  // transition. transitions[i].frames[24] is byte-identical to
  // transitions[i+1].frames[0] per the README, so either is fine.
  const anchors = useMemo(() => {
    if (!transitions || !transitions.length) return [];
    const out = [{ value: transitions[0].info.start_index, frame: transitions[0].frames[0] }];
    for (const t of transitions) {
      const last = t.frames[t.frames.length - 1];
      out.push({ value: t.info.end_index, frame: last });
    }
    return out;
  }, [transitions]);

  // Idle state: whenever anchorIdx changes (and on first load), pin the
  // visible <img> to that anchor's source.
  useEffect(() => {
    if (!anchors.length || !imgRef.current) return;
    if (animatingRef.current) return;
    imgRef.current.src = anchors[anchorIdx].frame.img.src;
  }, [anchors, anchorIdx]);

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
    playFrames(frames, () => setAnchorIdx(target));
  }

  useEffect(() => {
    function onKey(e) {
      if (animatingRef.current) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") step(+1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [transitions, anchors.length]);

  // Hijack the wheel so each scroll gesture (up or down) plays one morph
  // instead of moving the page. Trackpad inertia can fire wheel events for
  // several hundred ms after a swipe ends, so we (a) ignore everything while
  // a morph is playing and (b) keep a 700ms cooldown after each transition
  // commits to swallow the trailing inertia tail. Touchpad/mouse-wheel only;
  // touchscreen swipes go through the buttons.
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
    <section className="pt-4 pb-10">
      <div
        className="relative w-full overflow-hidden mx-auto flex items-center justify-center"
        style={{
          aspectRatio: "1024 / 576",
          maxHeight: "calc(100vh - 280px)",
        }}
      >
        <img
          ref={imgRef}
          alt=""
          className="block w-full h-full object-contain"
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-charcoal/50 font-sans text-sm bg-white">
            loading…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-700 font-sans text-sm bg-white px-6 text-center">
            Couldn’t load morph frames: {error}
          </div>
        )}
      </div>

      <div className="px-4 md:px-16 lg:px-24">
        <div className="mt-5 mx-auto max-w-3xl text-center">
          <p
            className="font-serif italic text-charcoal/80 leading-relaxed"
            style={{
              fontSize: "clamp(15px, 1.4vw, 19px)",
              textWrap: "pretty",
            }}
          >
            {avoidWidow(ANCHOR_DESCRIPTIONS[anchorIdx])}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-5">
          <button
            type="button"
            aria-label="Previous painting (or scroll up)"
            onClick={() => step(-1)}
            disabled={!ready || anchorIdx === 0 || animating}
            className="w-11 h-11 flex items-center justify-center bg-charcoal text-cream rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-charcoal"
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
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: anchors.length || 10 }).map((_, k) => (
              <span
                key={k}
                className="block rounded-full transition-all"
                style={{
                  width: k === anchorIdx ? 10 : 6,
                  height: k === anchorIdx ? 10 : 6,
                  backgroundColor:
                    k === anchorIdx
                      ? "rgba(45,45,45,0.85)"
                      : k < anchorIdx
                      ? "rgba(45,45,45,0.4)"
                      : "rgba(45,45,45,0.18)",
                }}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next painting (or scroll down)"
            onClick={() => step(+1)}
            disabled={!ready || anchorIdx >= anchors.length - 1 || animating}
            className="w-11 h-11 flex items-center justify-center bg-charcoal text-cream rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-charcoal"
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
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-center font-sans text-[11px] uppercase tracking-[0.18em] text-charcoal/40">
          scroll or use arrows to advance
        </p>

        {totalCount > 0 && !preloadDone && (
          <p className="mt-2 text-center font-sans text-xs text-charcoal/40 tabular-nums">
            preloading {loadedCount} / {totalCount} frames
          </p>
        )}
      </div>
    </section>
  );
}
