import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";

import FixedTitle from "./FixedTitle";
import PanSlider from "./PanSlider";
import IntroModal from "./IntroModal";
import CentralPainting from "./CentralPainting";
import ScatteredPrint from "./ScatteredPrint";
import LilyTrigger from "./LilyTrigger";
import InfoBlock from "./InfoBlock";
import FullscreenLightbox from "./FullscreenLightbox";

import { SCATTER, INFO_OFFSETS } from "../data/scatterLayout";
import { INFO_BLOCKS } from "../data/infoBlocks";
import {
  monetToLightbox,
  printToLightbox,
  catalogNumberToInt,
} from "../utils/lightboxAdapters";
import lily1 from "../assets/lily-1.png";
import lily2 from "../assets/lily-2.png";
import lily3 from "../assets/lily-3.png";

// Rotate three different lily artworks across the 6 lily positions, mixed
// up so you don't see the same one twice in a row. Lily ids 0-5 map to:
//   0 → lily1, 1 → lily2, 2 → lily3, 3 → lily1, 4 → lily3, 5 → lily2
// (each artwork is used exactly twice).
const LILY_IMAGES = [lily1, lily2, lily3, lily1, lily3, lily2];

// Vite glob import: returns { '../assets/J1.jpg': '/assets/J1-hash.jpg', ... }
const printImageModules = import.meta.glob("../assets/J*.jpg", {
  eager: true,
  import: "default",
});

// Re-key by bare filename ("J1.jpg") for easy lookup against the JSON's
// `file_name` field.
const PRINT_IMAGES = Object.fromEntries(
  Object.entries(printImageModules).map(([path, url]) => {
    const name = path.split("/").pop();
    return [name, url];
  })
);

const INTRO_DISMISSED_KEY = "eastMeetsWest:introDismissed";

export default function EastMeetsWest() {
  // TODO: wire up navigation to screens 1 and 3

  const [monetCatalog, setMonetCatalog] = useState([]);
  const [japanesePrints, setJapanesePrints] = useState([]);
  const [centralIndex, setCentralIndex] = useState(0);
  const [usedLilies, setUsedLilies] = useState(() => new Set());
  const [userRevealed, setUserRevealed] = useState(() => new Set());
  const [lightbox, setLightbox] = useState(null);
  const [showIntro, setShowIntro] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(INTRO_DISMISSED_KEY) !== "1"
  );
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  const [viewportW, setViewportW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1440
  );
  // Slider starts at 0 (far-left pan) so the user immediately sees the
  // painting on the left of the screen + the first 3 prints in the
  // right-side strip. As they drag right, the print strip scrolls into
  // view from the right.
  const [sliderValue, setSliderValue] = useState(0);

  // Derived: on mobile every block is auto-revealed; on desktop only the ones
  // the user has clicked. We avoid an extra useEffect+setState cascade.
  const revealedTexts = useMemo(() => {
    if (isMobile) return new Set([0, 1, 2, 3, 4, 5]);
    return userRevealed;
  }, [isMobile, userRevealed]);

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
        console.error("Failed to load East Meets West data", err);
      });
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      setViewportW(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const centralPool = useMemo(
    () =>
      monetCatalog.filter((p) => {
        const n = catalogNumberToInt(p.catalog_number);
        return n >= 1509 && n <= 1633 && p.image_url;
      }),
    [monetCatalog]
  );

  const backgroundEntry = useMemo(
    () =>
      monetCatalog.find(
        (p) => catalogNumberToInt(p.catalog_number) === 1731
      ),
    [monetCatalog]
  );

  const printsByFile = useMemo(() => {
    const map = {};
    japanesePrints.forEach((p) => {
      if (p.file_name) map[p.file_name] = p;
    });
    return map;
  }, [japanesePrints]);

  const handleDismissIntro = () => {
    sessionStorage.setItem(INTRO_DISMISSED_KEY, "1");
    setShowIntro(false);
  };

  const handleLilyClick = (lily) => {
    if (usedLilies.has(lily.id)) return;
    setUsedLilies((prev) => {
      const next = new Set(prev);
      next.add(lily.id);
      return next;
    });
    // Only six lilies carry a textIndex (the rest are bonus collectibles).
    if (lily.textIndex !== undefined) {
      setUserRevealed((prev) => {
        const next = new Set(prev);
        next.add(lily.textIndex);
        return next;
      });
    }
    if (centralPool.length > 0) {
      setCentralIndex((i) => (i + 1) % centralPool.length);
    }
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

  // Canvas is much wider than the viewport so the slider can pan across the
  // whole composition (5 prints flank the painting on the left, 4 on the
  // right), so there is breathing room between the outermost prints and
  // the central painting, AND so each text block has horizontal margin to
  // the neighbouring prints (no more text bleeding under prints).
  // Canvas is 2.5x the viewport so the slider can pan the print strip
  // (which now lives entirely to the RIGHT of the painting) across the
  // viewport. ~3 prints visible at any slider position.
  const canvasWidthMultiplier = 2.5;
  // Uniform max bbox (both width and height) so the LONG dimension of every
  // print equals this value. Also capped at 18vw so landscape prints can't
  // grow wider than the painting's right edge on tall viewports — this
  // keeps the first print's half-width predictable (≤9vw) so the title and
  // slider can align with its left edge via matching CSS math.
  const printMaxSize = isMobile ? "min(18vh, 18vw)" : "min(26vh, 18vw)";
  // Pink lily — doubled in size from the previous design.
  const lilySize = isMobile ? "5vh" : "6vh";
  // Central painting is anchored FLUSH to the top-left corner of the
  // viewport with no frame, filling a fixed 40vw × 100vh slab. The img
  // uses object-cover, so paintings get cropped to fit the slab instead
  // of letterboxing — guaranteeing the painting always covers exactly
  // 40% of the page width, top to bottom.
  const centralWidth = "40vw";
  const centralHeight = "100vh";
  const canvasPx = canvasWidthMultiplier * viewportW;
  const maxOffset = Math.max(0, canvasPx - viewportW);
  const offsetX = -(sliderValue / 1000) * maxOffset;

  const centralPainting = centralPool[centralIndex];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone">
      {/* Ambient background painting: viewport-fixed, doesn't pan. */}
      {backgroundEntry && (
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: `url(${backgroundEntry.image_url})`,
            opacity: 0.7,
          }}
        />
      )}

      <FixedTitle />

      {/* Pannable canvas: a single wide div translated horizontally by the
          slider. No drag-to-pan, no zoom. The central painting is rendered
          OUTSIDE this div (see below) so it stays viewport-fixed while the
          prints/lilies/texts slide horizontally behind it. */}
      <div
        className="absolute top-0 left-0 h-full will-change-transform"
        style={{
          width: `${canvasWidthMultiplier * 100}vw`,
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: "transform 60ms linear",
        }}
      >
        {/* Scattered prints + lilies */}
        {SCATTER.map((item) => {
          if (item.type === "print") {
            const fileName = `${item.id}.jpg`;
            const src = PRINT_IMAGES[fileName];
            const entry = printsByFile[fileName];
            if (!src) return null;
            return (
              <ScatteredPrint
                key={`print-${item.id}`}
                src={src}
                alt={entry?.title || item.id}
                style={{ top: item.top, left: item.left }}
                maxSize={printMaxSize}
                onSelect={() => openPrintLightbox(item.id)}
              />
            );
          }
          return (
            <LilyTrigger
              key={`lily-${item.id}`}
              src={LILY_IMAGES[item.id] || lily1}
              style={{ top: item.top, left: item.left }}
              size={lilySize}
              used={usedLilies.has(item.id)}
              onSelect={() => handleLilyClick(item)}
            />
          );
        })}

        {/* Info blocks anchored to the PRINT that owns each textIndex (lilies
            now live in the pond strips above/below the painting, too far from
            the prints to host the texts). */}
        {SCATTER.filter(
          (s) => s.type === "print" && s.textIndex !== undefined
        ).map((print) => {
          const offset = INFO_OFFSETS[print.textIndex] || { dx: 0, dy: 18 };
          const top = `calc(${print.top} + ${offset.dy}%)`;
          const left = `calc(${print.left} + ${offset.dx}%)`;
          return (
            <InfoBlock
              key={`info-${print.textIndex}`}
              text={INFO_BLOCKS[print.textIndex]}
              visible={revealedTexts.has(print.textIndex)}
              style={{ top, left }}
            />
          );
        })}

      </div>

      {/* Central Monet painting — viewport-fixed and above the pannable
          canvas, so the prints/lilies/texts slide horizontally BEHIND it
          when the user drags the slider. The outer wrapper is
          pointer-events-none so clicks elsewhere on screen still reach the
          prints/lilies behind; CentralPainting re-enables pointer events on
          its own bounding box so the painting itself remains clickable. */}
      <div className="fixed inset-0 pointer-events-none z-20">
        <CentralPainting
          painting={centralPainting}
          style={{ top: 0, left: 0 }}
          width={centralWidth}
          height={centralHeight}
          onSelect={openCentralLightbox}
        />
      </div>

      <PanSlider value={sliderValue} onChange={setSliderValue} />

      <AnimatePresence>
        {showIntro && <IntroModal onDismiss={handleDismissIntro} />}
      </AnimatePresence>

      <AnimatePresence>
        {lightbox && (
          <FullscreenLightbox
            data={lightbox}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
