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
// have been collected, as bonus reveals around the central painting.
const BONUS_PRINTS = ["J2", "J7", "J9"];

// 6 lily slot positions around the central painting, expressed as
// percentages of the viewport. Tuned to roughly mirror the reference
// image: three on the left arc, three on the right arc, with the
// central painting reserving a vertical band in the middle.
const LILY_SLOTS = [
  { top: "20%", left: "26%" },   // 0 — top-left
  { top: "20%", left: "74%" },   // 1 — top-right
  { top: "50%", left: "14%" },   // 2 — mid-left
  { top: "50%", left: "86%" },   // 3 — mid-right
  { top: "78%", left: "26%" },   // 4 — bottom-left
  { top: "78%", left: "74%" },   // 5 — bottom-right
];

// 3 bonus slot positions for the decorative prints — tucked into the
// gaps between the lily ring and the viewport edges so they don't
// crowd the central painting or overlap any lily slot.
const BONUS_SLOTS = [
  { top: "10%", left: "50%" },   // top-center, below the pill
  { top: "90%", left: "30%" },   // bottom-left
  { top: "90%", left: "70%" },   // bottom-right
];

// Mobile slot variants — pulled into a tight ring so 6 + 3 placements
// still fit on a phone-sized viewport.
const LILY_SLOTS_MOBILE = [
  { top: "16%", left: "22%" },
  { top: "16%", left: "78%" },
  { top: "44%", left: "10%" },
  { top: "44%", left: "90%" },
  { top: "82%", left: "22%" },
  { top: "82%", left: "78%" },
];

const BONUS_SLOTS_MOBILE = [
  { top: "8%",  left: "50%" },
  { top: "94%", left: "30%" },
  { top: "94%", left: "70%" },
];

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

  // Sizing — mirrors V1 numbers so the painting reads at the same scale
  // when V1 and V2 sit side-by-side in the dropdown.
  const lilySize       = isMobile ? "9vh" : "11vh";
  const printMaxSize   = isMobile ? "min(20vh, 36vw)" : "min(22vh, 18vw)";
  const centralMaxWidth = isMobile ? "70vw" : "32vw";
  const topMargin    = isMobile ? "1.25rem" : "1.75rem";
  const bottomMargin = isMobile ? "1.25rem" : "1.75rem";
  const captionReserve = "5.5vh";
  const centralHeight = `calc(100vh - ${topMargin} - ${bottomMargin} - ${captionReserve})`;

  const centralPainting = centralPool[centralIndex];
  const lilySlots  = isMobile ? LILY_SLOTS_MOBILE  : LILY_SLOTS;
  const bonusSlots = isMobile ? BONUS_SLOTS_MOBILE : BONUS_SLOTS;
  const allCollected = usedLilies.size >= INFO_BLOCKS.length;

  // Pixel coords for connection-line endpoints. Recomputed on resize and
  // whenever the painting's bounding box changes (e.g. after the central
  // painting morphs to a different aspect ratio).
  const paintingRef = useRef(null);
  const containerRef = useRef(null);
  const [paintingRect, setPaintingRect] = useState(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    function measure() {
      const c = containerRef.current;
      const p = paintingRef.current?.querySelector("img,div");
      if (c) {
        const cr = c.getBoundingClientRect();
        setContainerSize({ w: cr.width, h: cr.height });
      }
      if (p && c) {
        const pr = p.getBoundingClientRect();
        const cr = c.getBoundingClientRect();
        setPaintingRect({
          left:  pr.left  - cr.left,
          top:   pr.top   - cr.top,
          width: pr.width,
          height: pr.height,
        });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    // Rerun once images settle in. Cheap belt-and-braces.
    const t = window.setTimeout(measure, 250);
    const t2 = window.setTimeout(measure, 1200);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [showIntro, isMobile, centralIndex, centralPainting?.image_url]);

  // Convert a slot's percentage coords into pixel coords inside the
  // viewport-sized container.
  function slotToPx(slot) {
    const x = (parseFloat(slot.left) / 100) * containerSize.w;
    const y = (parseFloat(slot.top)  / 100) * containerSize.h;
    return { x, y };
  }

  // Same shift logic as the print-render block below. Returns the print's
  // pixel center so the connection line and the floating text use the
  // print's true position, not the lily's underlying slot.
  function printPx(slot) {
    const lily = slotToPx(slot);
    const isLeft   = parseFloat(slot.left) < 50;
    const topPct   = parseFloat(slot.top);
    const isMidRow = Math.abs(topPct - 50) < 5;
    const isTop    = topPct < 45;
    // 1vh = containerSize.h / 100; 1vw = containerSize.w / 100.
    const vShiftPx = isMidRow ? 0 : (isTop ? 8 : -8) * (containerSize.h / 100);
    const hShiftPx = (isLeft ? 8 : -8) * (containerSize.w / 100);
    return { x: lily.x + hShiftPx, y: lily.y + vShiftPx };
  }

  // Closest point on the painting's bounding box to a given (x, y) — so
  // the connection line touches the nearest edge instead of the center.
  function closestPointOnPainting(x, y) {
    if (!paintingRect) return { x, y };
    const cx = Math.max(paintingRect.left, Math.min(x, paintingRect.left + paintingRect.width));
    const cy = Math.max(paintingRect.top,  Math.min(y, paintingRect.top  + paintingRect.height));
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
      {/* Central Monet painting — anchored to the viewport center. */}
      <div
        ref={paintingRef}
        className="absolute pointer-events-none z-20 flex flex-col items-center justify-center"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <CentralPainting
          painting={centralPainting}
          maxWidth={centralMaxWidth}
          height={centralHeight}
          onSelect={openCentralLightbox}
        />
        {centralPainting && (
          <div className="mt-2 font-sans text-center px-4 pointer-events-none">
            <p
              className="text-charcoal font-medium leading-tight"
              style={{ fontSize: "clamp(15px, 1.15vw, 19px)" }}
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
                style={{ fontSize: "clamp(12px, 0.9vw, 14px)" }}
              >
                {centralPainting.collection}
              </p>
            )}
          </div>
        )}
      </div>

      {/* SVG overlay — connection lines from each revealed print to the
          central painting. Sits above the painting wrapper so the line
          appears to land on the painting, but pointer-events-none so
          the painting and prints stay clickable through it. */}
      {paintingRect && containerSize.w > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={containerSize.w}
          height={containerSize.h}
          style={{ zIndex: 25 }}
          aria-hidden="true"
        >
          {Array.from(usedLilies).map((lilyIndex) => {
            const slot = lilySlots[lilyIndex];
            if (!slot) return null;
            const start = printPx(slot);
            const end = closestPointOnPainting(start.x, start.y);
            return (
              <motion.line
                key={`line-${lilyIndex}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="rgba(60, 50, 45, 0.45)"
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

      {/* Lilies — always present, fade to "used" once clicked. */}
      {lilySlots.map((slot, lilyIndex) => {
        const used = usedLilies.has(lilyIndex);
        return (
          <div
            key={`lily-${lilyIndex}`}
            className="absolute z-30"
            style={{
              top: slot.top,
              left: slot.left,
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

      {/* Revealed paired prints + descriptions. The print sits just
          inside the lily's slot (offset toward the painting), and the
          description floats above the connection line's midpoint. */}
      {Array.from(usedLilies).map((lilyIndex) => {
        const slot = lilySlots[lilyIndex];
        const printId = LILY_TO_PRINT[lilyIndex];
        const fileName = `${printId}.jpg`;
        const src = PRINT_IMAGES[fileName];
        const entry = printsByFile[fileName];
        if (!slot || !src) return null;

        // Offset the print toward the painting so it sits next to the
        // lily but slightly closer to the central painting. Mid-row
        // lilies (top ≈ 50%) shift only horizontally; top/bottom-row
        // lilies shift on both axes so the print tucks into the
        // diagonal gap toward the painting.
        const isLeft  = parseFloat(slot.left) < 50;
        const topPct  = parseFloat(slot.top);
        const isMidRow = Math.abs(topPct - 50) < 5;
        const isTop    = topPct < 45;
        const vShift  = isMidRow ? "0vh" : isTop ? "8vh" : "-8vh";
        const hShift  = isLeft ? "8vw" : "-8vw";
        const printTop  = `calc(${slot.top} + ${vShift})`;
        const printLeft = `calc(${slot.left} + ${hShift})`;

        // Text sits above the line midpoint between print and painting.
        const startPx = printPx(slot);
        const endPx   = paintingRect
          ? closestPointOnPainting(startPx.x, startPx.y)
          : startPx;
        const midX    = (startPx.x + endPx.x) / 2;
        const midY    = (startPx.y + endPx.y) / 2;

        return (
          <div key={`reveal-${lilyIndex}`}>
            <motion.div
              className="absolute z-30"
              style={{
                top: printTop,
                left: printLeft,
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

            {containerSize.w > 0 && paintingRect && (
              <motion.div
                className="absolute z-30 pointer-events-none"
                style={{
                  top: midY,
                  left: midX,
                  transform: "translate(-50%, calc(-100% - 12px))",
                  width: "min(280px, 28vw)",
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
                    fontSize: "clamp(12px, 0.95vw, 15px)",
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

      {/* Bonus prints — fade in once all 6 lilies are collected. No
          connection line, no text: pure decoration. */}
      <AnimatePresence>
        {allCollected &&
          BONUS_PRINTS.map((printId, i) => {
            const slot = bonusSlots[i];
            const fileName = `${printId}.jpg`;
            const src = PRINT_IMAGES[fileName];
            const entry = printsByFile[fileName];
            if (!slot || !src) return null;
            return (
              <motion.div
                key={`bonus-${printId}`}
                className="absolute z-20"
                style={{
                  top: slot.top,
                  left: slot.left,
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
