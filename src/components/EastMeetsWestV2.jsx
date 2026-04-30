import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.div>; project eslint lacks jsx-uses-vars
import { AnimatePresence, motion } from "framer-motion";

import EastMeetsWestIntro from "./EastMeetsWestIntro";
import EastMeetsWestEndPopup from "./EastMeetsWestEndPopup";
import CentralPainting from "./CentralPainting";
import ScatteredPrint from "./ScatteredPrint";
import LilyTrigger from "./LilyTrigger";
import FullscreenLightbox from "./FullscreenLightbox";
import ExploreDropdown from "./ExploreDropdown";

import { INFO_BLOCKS } from "../data/infoBlocks";
import {
  monetToLightbox,
  printToLightbox,
} from "../utils/lightboxAdapters";
import lily1 from "../assets/lily-1.png";
import lily2 from "../assets/lily-2.png";
import lily3 from "../assets/lily-3.png";

// Same lily art rotation as V1: ids 0-5 → lily1, lily2, lily3, lily1, lily3, lily2.
const LILY_IMAGES = [lily1, lily2, lily3, lily1, lily3, lily2];

// Vite glob import: returns { '../assets/J1.jpg': '/assets/J1-hash.jpg', ... }
const printImageModules = import.meta.glob("../assets/J*.jpg", {
  eager: true,
  import: "default",
});

const PRINT_IMAGES = Object.fromEntries(
  Object.entries(printImageModules).map(([path, url]) => {
    const name = path.split("/").pop();
    return [name, url];
  })
);

// Lily index (0..5) → paired J-print id. Mirrors V1's scatterLayout.js
// pairings (J1, J5, J3, J6, J4, J8) so the same six woodblocks back the
// same six stories — just laid out differently here.
const LILY_TO_PRINT = ["J1", "J5", "J3", "J6", "J4", "J8"];

// Three decorative-only prints from V1. These appear once all six lilies
// have been collected, as bonus reveals on an outer ring.
const BONUS_PRINTS = ["J2", "J7", "J9"];

// Evenly space six lilies around a circle, starting at 12 o'clock (-90°).
const LILY_COUNT = 6;

function lilyAngleDeg(index) {
  return -90 + (360 / LILY_COUNT) * index;
}

// Bonus prints sit at the mid-angle between adjacent lilies (outer ring).
const BONUS_ANGLE_OFFSET_DEG = 360 / LILY_COUNT / 2; // 30°

function bonusAngleDeg(index) {
  return -90 + BONUS_ANGLE_OFFSET_DEG + index * (360 / LILY_COUNT);
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function polarPoint(cx, cy, r, angleDeg) {
  const a = degToRad(angleDeg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// Compute concentric ring radii from the square painting's center so lilies,
// revealed prints, and bonus prints read as a radial gallery wall.
function ringGeometry(containerSize, paintingRect, isMobile) {
  const w = containerSize.w;
  const h = containerSize.h;
  const vmin = Math.min(w, h) || 1;
  let cx = w / 2;
  let cy = h / 2 - vmin * 0.02;
  let half = vmin * 0.14;

  if (paintingRect && paintingRect.width > 0) {
    cx = paintingRect.left + paintingRect.width / 2;
    cy = paintingRect.top + paintingRect.height / 2;
    half = paintingRect.width / 2;
  }

  const gap = vmin * (isMobile ? 0.26 : 0.24);
  const rLily = half + gap;
  const rPrint = half + gap * 0.52;
  const rBonus = rLily + vmin * (isMobile ? 0.11 : 0.095);

  return { cx, cy, rLily, rPrint, rBonus };
}

export default function EastMeetsWestV2() {
  const [monetCatalog, setMonetCatalog] = useState([]);
  const [japanesePrints, setJapanesePrints] = useState([]);
  const [centralIndex, setCentralIndex] = useState(0);
  const [usedLilies, setUsedLilies] = useState(() => new Set());
  const [lightbox, setLightbox] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    Promise.all([
      fetch("/water_lilies_catalog.json").then((r) => r.json()),
      fetch("/japanese_print.json").then((r) => r.json()),
    ])
      .then(([monet, prints]) => {
        setMonetCatalog(monet);
        setJapanesePrints(prints);
      })
      .catch((err) => {
        console.error("Failed to load East Meets West V2 data", err);
      });
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Same painting pool + chronological order as V1, so V2 cycles through
  // the same images as the user clicks lilies.
  const centralPool = useMemo(() => {
    const order = [
      "W.1509",
      "W.1511",
      "W.1513",
      "W.1517",
      "W.1518",
      "W.1630",
      "W.1631",
    ];
    const byCatalog = new Map(
      monetCatalog
        .filter((p) => p.image_url)
        .map((p) => [p.catalog_number, p])
    );
    return order.map((cat) => byCatalog.get(cat)).filter(Boolean);
  }, [monetCatalog]);

  const printsByFile = useMemo(() => {
    const map = {};
    japanesePrints.forEach((p) => {
      if (p.file_name) map[p.file_name] = p;
    });
    return map;
  }, [japanesePrints]);

  const handleDismissIntro = () => setShowIntro(false);

  // Same end-popup timing as V1.
  useEffect(() => {
    if (usedLilies.size < INFO_BLOCKS.length) return;
    if (showEndPopup) return;
    const timer = window.setTimeout(() => setShowEndPopup(true), 3_000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedLilies.size]);

  // Lily click → mark used, swap central painting, and (implicitly via
  // `usedLilies`) reveal the paired print + text. Same painting mapping
  // as V1.
  const handleLilyClick = (lilyIndex) => {
    if (usedLilies.has(lilyIndex)) return;
    setUsedLilies((prev) => {
      const next = new Set(prev);
      next.add(lilyIndex);
      return next;
    });
    const LILY_TO_PAINTING = [1, 3, 2, 4, 5, 6];
    const targetIndex = Math.min(
      LILY_TO_PAINTING[lilyIndex] ?? lilyIndex + 1,
      centralPool.length - 1
    );
    setCentralIndex(targetIndex);
  };

  const openCentralLightbox = () => {
    const entry = centralPool[centralIndex];
    if (entry) setLightbox(monetToLightbox(entry));
  };

  const openPrintLightbox = (printId) => {
    const fileName = `${printId}.jpg`;
    const entry = printsByFile[fileName];
    const imgSrc = PRINT_IMAGES[fileName];
    if (entry && imgSrc) setLightbox(printToLightbox(entry, imgSrc));
  };

  // Smaller square Monet at the hub of a circular print + lily ring.
  const lilySize = isMobile ? "8vh" : "10vh";
  const printMaxSize = isMobile ? "min(17vh, 32vw)" : "min(19vh, 15vw)";
  const centralSquareSize = isMobile ? "min(46vw, 32vh)" : "min(19vw, 28vh)";

  const centralPainting = centralPool[centralIndex];
  const allCollected = usedLilies.size >= INFO_BLOCKS.length;

  // Pixel coords for connection-line endpoints. `paintingRef` wraps only
  // the square painting slab (not the caption) so the polar ring aligns
  // to the artwork's true center.
  const paintingRef = useRef(null);
  const containerRef = useRef(null);
  const [paintingRect, setPaintingRect] = useState(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    function measure() {
      const c = containerRef.current;
      const wrap = paintingRef.current;
      if (c) {
        const cr = c.getBoundingClientRect();
        setContainerSize({ w: cr.width, h: cr.height });
      }
      if (wrap && c) {
        const slab = wrap.querySelector(".relative.pointer-events-auto");
        const el = slab || wrap.firstElementChild;
        if (el) {
          const pr = el.getBoundingClientRect();
          const cr = c.getBoundingClientRect();
          setPaintingRect({
            left: pr.left - cr.left,
            top: pr.top - cr.top,
            width: pr.width,
            height: pr.height,
          });
        }
      }
    }
    measure();
    window.addEventListener("resize", measure);
    const t = window.setTimeout(measure, 250);
    const t2 = window.setTimeout(measure, 1200);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [showIntro, isMobile, centralIndex, centralPainting?.image_url]);

  const ring = useMemo(
    () => ringGeometry(containerSize, paintingRect, isMobile),
    [containerSize, paintingRect, isMobile]
  );

  function lilyPixelPos(index) {
    return polarPoint(ring.cx, ring.cy, ring.rLily, lilyAngleDeg(index));
  }

  function printPixelPos(index) {
    return polarPoint(ring.cx, ring.cy, ring.rPrint, lilyAngleDeg(index));
  }

  function bonusPixelPos(index) {
    return polarPoint(ring.cx, ring.cy, ring.rBonus, bonusAngleDeg(index));
  }

  // Closest point on the painting's bounding box to a given (x, y) — so
  // the connection line touches the nearest edge instead of the center.
  function closestPointOnPainting(x, y) {
    if (!paintingRect) return { x, y };
    const cx = Math.max(
      paintingRect.left,
      Math.min(x, paintingRect.left + paintingRect.width)
    );
    const cy = Math.max(
      paintingRect.top,
      Math.min(y, paintingRect.top + paintingRect.height)
    );
    return { x: cx, y: cy };
  }

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden overscroll-none bg-white"
    >
      <AnimatePresence>
        {showIntro && <EastMeetsWestIntro onDismiss={handleDismissIntro} />}
      </AnimatePresence>

      {showIntro ? null : (<>
      {/* Central Monet — smaller square slab + caption, vertically centred. */}
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
      >
        <div
          ref={paintingRef}
          className="pointer-events-auto rounded-sm shadow-[0_14px_44px_rgba(0,0,0,0.14)]"
        >
          <CentralPainting
            painting={centralPainting}
            squareSize={centralSquareSize}
            onSelect={openCentralLightbox}
          />
        </div>
        {centralPainting && (
          <div className="mt-2 font-sans text-center px-4 max-w-[min(90vw,520px)] pointer-events-none">
            <p
              className="text-charcoal font-medium leading-tight"
              style={{ fontSize: "clamp(14px, 1.05vw, 18px)" }}
            >
              {centralPainting.title}
              {centralPainting.year && (
                <span className="text-charcoal/55 font-normal">
                  , {centralPainting.year}
                </span>
              )}
            </p>
            {centralPainting.collection && (
              <p
                className="mt-1 text-charcoal/55"
                style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}
              >
                {centralPainting.collection}
              </p>
            )}
          </div>
        )}
      </div>

      {/* SVG overlay — dashed lines from each revealed print to the painting. */}
      {containerSize.w > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={containerSize.w}
          height={containerSize.h}
          style={{ zIndex: 25 }}
          aria-hidden="true"
        >
          {Array.from(usedLilies).map((lilyIndex) => {
            const start = printPixelPos(lilyIndex);
            const end = closestPointOnPainting(start.x, start.y);
            return (
              <motion.line
                key={`line-${lilyIndex}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="rgba(45, 40, 38, 0.42)"
                strokeWidth={1}
                strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        </svg>
      )}

      {/* Lilies on the outer ring — six positions around the square Monet. */}
      {containerSize.w > 0 &&
        Array.from({ length: LILY_COUNT }, (_, lilyIndex) => {
          const used = usedLilies.has(lilyIndex);
          const { x, y } = lilyPixelPos(lilyIndex);
          return (
            <div
              key={`lily-${lilyIndex}`}
              className="absolute z-30"
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                width: lilySize,
              }}
            >
              <LilyTrigger
                flow
                src={LILY_IMAGES[lilyIndex]}
                size={lilySize}
                used={used}
                onSelect={() => handleLilyClick(lilyIndex)}
              />
            </div>
          );
        })}

      {/* Revealed paired prints + descriptions on the inner ring. */}
      {containerSize.w > 0 &&
        Array.from(usedLilies).map((lilyIndex) => {
          const printId = LILY_TO_PRINT[lilyIndex];
          const fileName = `${printId}.jpg`;
          const src = PRINT_IMAGES[fileName];
          const entry = printsByFile[fileName];
          if (!src) return null;

          const { x: px, y: py } = printPixelPos(lilyIndex);
          const startPx = { x: px, y: py };
          const endPx = closestPointOnPainting(startPx.x, startPx.y);
          const midX = (startPx.x + endPx.x) / 2;
          const midY = (startPx.y + endPx.y) / 2;

          return (
            <div key={`reveal-${lilyIndex}`}>
              <motion.div
                className="absolute z-30"
                style={{
                  left: px,
                  top: py,
                  transform: "translate(-50%, -50%)",
                }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <ScatteredPrint
                  flow
                  src={src}
                  alt={entry?.title || printId}
                  maxSize={printMaxSize}
                  onSelect={() => openPrintLightbox(printId)}
                />
              </motion.div>

              {paintingRect && (
                <motion.div
                  className="absolute z-30 pointer-events-none"
                  style={{
                    top: midY,
                    left: midX,
                    transform: "translate(-50%, calc(-100% - 10px))",
                    width: "min(240px, 26vw)",
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.35,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <p
                    className="font-serif italic text-charcoal/80 text-center leading-snug"
                    style={{
                      fontSize: "clamp(11px, 0.88vw, 14px)",
                      textWrap: "pretty",
                    }}
                  >
                    {INFO_BLOCKS[lilyIndex]}
                  </p>
                </motion.div>
              )}
            </div>
          );
        })}

      {/* Bonus prints — outer ring, mid-angle between lilies. */}
      <AnimatePresence>
        {allCollected &&
          containerSize.w > 0 &&
          BONUS_PRINTS.map((printId, i) => {
            const fileName = `${printId}.jpg`;
            const src = PRINT_IMAGES[fileName];
            const entry = printsByFile[fileName];
            if (!src) return null;
            const { x, y } = bonusPixelPos(i);
            return (
              <motion.div
                key={`bonus-${printId}`}
                className="absolute z-20"
                style={{
                  left: x,
                  top: y,
                  transform: "translate(-50%, -50%)",
                }}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.4 + i * 0.25,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <ScatteredPrint
                  flow
                  src={src}
                  alt={entry?.title || printId}
                  maxSize={printMaxSize}
                  onSelect={() => openPrintLightbox(printId)}
                />
              </motion.div>
            );
          })}
      </AnimatePresence>

      <AnimatePresence>
        {lightbox && (
          <FullscreenLightbox
            data={lightbox}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEndPopup && !lightbox && (
          <EastMeetsWestEndPopup onDismiss={() => setShowEndPopup(false)} />
        )}
      </AnimatePresence>

      {!showIntro && !lightbox && (
        <ExploreDropdown currentPage="#/ukiyo-e-influence-v2" />
      )}

      {/* Top pill — same copy + counter as V1, recentered for the full
          viewport since V2 has no right-column split. */}
      <div
        className="fixed top-4 md:top-6 z-40 pointer-events-none flex items-center justify-center"
        style={{ left: 0, right: 0 }}
      >
        <div
          className="font-serif text-charcoal bg-white rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.18)] whitespace-nowrap flex items-center gap-3"
          style={{
            fontSize: "clamp(12px, 0.9vw, 14px)",
            padding: "10px 22px",
          }}
        >
          <span>
            Collect the 6 pink <em>Water lilies</em> from the pond.
          </span>
          <span className="text-charcoal/40 select-none" aria-hidden="true">·</span>
          <span>{usedLilies.size}/{INFO_BLOCKS.length} collected</span>
        </div>
      </div>
      </>)}
    </div>
  );
}
