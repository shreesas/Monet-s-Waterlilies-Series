import { useEffect, useMemo, useState } from "react";
// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.div>; project eslint lacks jsx-uses-vars
import { AnimatePresence, motion } from "framer-motion";

import EastMeetsWestIntro from "./EastMeetsWestIntro";
import EastMeetsWestEndPopup from "./EastMeetsWestEndPopup";
import CentralPainting from "./CentralPainting";
import ScatteredPrint from "./ScatteredPrint";
import LilyTrigger from "./LilyTrigger";
import InfoBlock from "./InfoBlock";
import FullscreenLightbox from "./FullscreenLightbox";
import ExploreDropdown from "./ExploreDropdown";

import { PRINT_BLOCKS } from "../data/scatterLayout";
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

// No persistence — the intro shows every time the user navigates
// to this route (component is remounted on each hash change).


export default function EastMeetsWest() {
  // TODO: wire up navigation to screens 1 and 3

  const [monetCatalog, setMonetCatalog] = useState([]);
  const [japanesePrints, setJapanesePrints] = useState([]);
  const [centralIndex, setCentralIndex] = useState(0);
  const [usedLilies, setUsedLilies] = useState(() => new Set());
  const [activeTextIndex, setActiveTextIndex] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  // Always show the intro when this component mounts (i.e. every time
  // the user clicks "East Meets West").
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
        console.error("Failed to load East Meets West data", err);
      });
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // The painting cycles through this exact list, in this exact order.
  // Catalog numbers come from the JSON in the form "W.1509".
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
    return order
      .map((cat) => byCatalog.get(cat))
      .filter(Boolean);
  }, [monetCatalog]);

  const backgroundEntry = useMemo(
    () =>
      monetCatalog.find(
        (p) => catalogNumberToInt(p.catalog_number) === 1661
      ),
    [monetCatalog]
  );

  // Natural aspect (height / width) of the ambient background painting.
  // We need this to compute the tile height in CSS so the tiled
  // background lines up cleanly without seams.
  const [bgAspect, setBgAspect] = useState(null);
  useEffect(() => {
    if (!backgroundEntry?.image_url) return;
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) {
        setBgAspect(probe.naturalHeight / probe.naturalWidth);
      }
    };
    probe.src = backgroundEntry.image_url;
  }, [backgroundEntry?.image_url]);

  const printsByFile = useMemo(() => {
    const map = {};
    japanesePrints.forEach((p) => {
      if (p.file_name) map[p.file_name] = p;
    });
    return map;
  }, [japanesePrints]);

  const handleDismissIntro = () => {
    setShowIntro(false);
  };

  // Show the end-of-experience popup 10 seconds after the last lily is
  // collected — gives the visitor time to read the final info block before
  // being guided to the next experience.
  useEffect(() => {
    if (usedLilies.size < INFO_BLOCKS.length) return;
    if (showEndPopup) return;
    const timer = window.setTimeout(() => setShowEndPopup(true), 3_000);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedLilies.size]);

  // Each lily is tied to a specific painting in the central pool.
  // The pool is already in chronological order (W.1509 → W.1631).
  // centralIndex starts at 0 (earliest painting, shown before any
  // click). Clicking lily N (0-based scroll order, top → bottom)
  // jumps to pool index N+1, so the six lilies walk the viewer
  // through the remaining six paintings chronologically.
  const handleLilyClick = (lily) => {
    if (usedLilies.has(lily.id)) return;
    setUsedLilies((prev) => {
      const next = new Set(prev);
      next.add(lily.id);
      return next;
    });
    if (lily.textIndex !== undefined) {
      setActiveTextIndex(lily.textIndex);
      // Explicit mapping from lily scroll-position (textIndex 0–5) to
      // painting pool index. Lilies 1 and 2 (2nd and 3rd from top)
      // are swapped relative to strict chronological order.
      const LILY_TO_PAINTING = [1, 3, 2, 4, 5, 6];
      const targetIndex = Math.min(
        LILY_TO_PAINTING[lily.textIndex] ?? lily.textIndex + 1,
        centralPool.length - 1
      );
      setCentralIndex(targetIndex);
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

  // Print sizing — cap on both axes so landscape and portrait prints
  // share the same long-edge length. Bumped 1.5× from the previous
  // pass so the prints feel like proper gallery pieces in the
  // vertical scroll column.
  const printMaxSize = isMobile ? "min(27vh, 45vw)" : "min(39vh, 27vw)";
  // Water-lily trigger icons.
  const lilySize = isMobile ? "10vh" : "12vh";
  // Central painting layout.
  const titleAreaHeight = "0px";
  const centralMaxWidth = "50vw";
  const sideMargin = isMobile ? "1rem" : "2rem";
  const topMargin = isMobile ? "1.25rem" : "1.75rem";   // matches bottom
  const bottomMargin = isMobile ? "1.25rem" : "1.75rem";
  // Reserve space below the painting for the revealed info text.
  const captionReserve = "22vh";
  const centralHeight = `calc(100vh - ${titleAreaHeight} - ${topMargin} - ${bottomMargin} - ${captionReserve})`;

  const centralPainting = centralPool[centralIndex];

  // Right column geometry. The column starts just past the painting's
  // glass strip on the right (sideMargin + max painting slab + 20px
  // glass) and runs to the viewport's right edge. It scrolls
  // vertically; horizontal overflow is hidden so off-axis prints can't
  // create a horizontal scrollbar.
  const rightColumnLeft = `calc(${sideMargin} + ${centralMaxWidth} + 20px)`;

  return (
    <div className="relative w-screen h-screen overflow-hidden overscroll-none bg-stone">
      {/* Intro splash — rendered first. Page content is held back until
          showIntro is false so nothing bleeds through during the dissolve. */}
      <AnimatePresence>
        {showIntro && <EastMeetsWestIntro onDismiss={handleDismissIntro} />}
      </AnimatePresence>

      {showIntro ? null : (<>
      {/* Solid white panel covering the LEFT side of the viewport — the
          area that holds the title and the central Monet painting. This
          sits above the ambient background but below the painting and
          title so those read cleanly against pure white instead of the
          blurry pond. The right column (with the prints) keeps the
          ambient background showing through. */}
      <div
        className="fixed top-0 left-0 bottom-0 pointer-events-none bg-white"
        style={{ width: rightColumnLeft }}
      />

      {/* Right column: vertically scrolling list of print blocks.
          Native overflow handles touch swipe, mouse wheel, and
          trackpad without any custom gesture code. The ambient
          background painting starts at the very top of this scroll
          area (no padding), and the prints column applies its own
          top padding so it clears the title region. */}
      <div
        className="absolute overflow-y-auto overflow-x-hidden overscroll-none"
        style={{
          top: 0,
          left: rightColumnLeft,
          right: 0,
          height: "100vh",
        }}
      >
        <div className="relative w-full">
          {/* Tiled background painting — sits behind the prints,
              starts at the very top of the scroll content, and
              tiles vertically. Every other tile is mirrored
              (scaleY -1) so adjacent edges meet as reflections and
              the seam disappears. The bottom of every tile is
              cropped (~8%) to hide the painter's signature, with
              tile height/positioning adjusted so the crop holds
              even when the tile is mirrored. */}
          {backgroundEntry && bgAspect && (() => {
            const CROP = 0.08; // hide bottom 8% (signature region)
            // Tile height as a percentage of the wrapper width:
            // image natural aspect × (1 − crop).
            const tileHeightPct = bgAspect * (1 - CROP) * 100;
            // For mirrored tiles, shift the image up by crop fraction
            // of the wrapper height (in image-vs-wrapper terms,
            // crop / (1 − crop)) so the signature ends up above
            // the wrapper's top edge after the flip.
            const flipShiftPct = (CROP / (1 - CROP)) * 100;
            // Render enough tiles to cover any plausible scroll
            // height. Extras are clipped by the wrapper's
            // overflow-hidden, so over-rendering is cheap.
            const TILE_COUNT = 30;
            return (
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{ zIndex: 0 }}
              >
                {Array.from({ length: TILE_COUNT }).map((_, i) => {
                  const flipped = i % 2 === 1;
                  return (
                    <div
                      key={i}
                      className="relative w-full overflow-hidden"
                      style={{ paddingBottom: `${tileHeightPct}%` }}
                    >
                      <img
                        src={backgroundEntry.image_url}
                        alt=""
                        draggable={false}
                        className="absolute left-0 w-full h-auto select-none block"
                        style={{
                          top: flipped ? `-${flipShiftPct}%` : 0,
                          transform: flipped ? "scaleY(-1)" : "none",
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  );
                })}
                {/* Soft white tint over the whole tile stack so the
                    prints stay readable against the painting. */}
                <div
                  className="absolute inset-0"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                />
              </div>
            );
          })()}

          {/* Prints column — rendered above the tiled background.
              Top padding clears the floating pill bar at the top
              of the right panel; bottom mirrors the painting margin. */}
        <div
          className="relative flex flex-col items-stretch w-full"
          style={{
            zIndex: 1,
            paddingTop: "11vh",
            paddingBottom: bottomMargin,
          }}
        >
          {PRINT_BLOCKS.map((block, i) => {
            const fileName = `${block.id}.jpg`;
            const src = PRINT_IMAGES[fileName];
            const entry = printsByFile[fileName];
            if (!src) return null;

            const hasText = block.textIndex !== undefined;
            const lilyImg = hasText
              ? LILY_IMAGES[block.textIndex] || lily1
              : null;

            // Vertical breathing room between rows. Text-bearing rows
            // are taller (lily + revealed paragraph stack below the
            // print), so we give them a noticeably larger gap to keep
            // each block's content from crowding the next print.
            const rowGap = hasText ? "7vh" : "4vh";
            const rowMargin = {
              marginTop: i === 0 ? "1vh" : rowGap,
              marginBottom: i === PRINT_BLOCKS.length - 1 ? "1vh" : "0",
            };

            // Decorative print (no lily/text): keep the simple
            // single-column placement so it sits on its assigned
            // side of the column with a touch of inset padding.
            if (!hasText) {
              return (
                <div
                  key={block.id}
                  className={`flex flex-col items-center ${
                    block.align === "left" ? "self-start" : "self-end"
                  }`}
                  style={{
                    maxWidth: "70%",
                    paddingLeft: block.align === "left" ? "2vw" : "0",
                    paddingRight: block.align === "right" ? "2vw" : "0",
                    ...rowMargin,
                  }}
                >
                  <ScatteredPrint
                    flow
                    src={src}
                    alt={entry?.title || block.id}
                    maxSize={printMaxSize}
                    onSelect={() => openPrintLightbox(block.id)}
                  />
                </div>
              );
            }

            // Text-bearing row: stack the print, lily trigger, and
            // revealed description in a single column hugged to the
            // row's assigned side. We deliberately avoid a
            // side-by-side print/text split because the right
            // scroll area (~48vw on desktop) isn't wide enough to
            // host both at the homepage's description font size
            // (15–20px) without the paragraph either overlapping
            // the print on its inside edge or spilling off the
            // viewport on its outside edge. Stacking lets the
            // paragraph use the full column width for wrapping.
            return (
              <div
                key={block.id}
                className={`flex flex-col items-center gap-3 ${
                  block.align === "left" ? "self-start" : "self-end"
                }`}
                style={{
                  // Wider column than decorative rows so the bigger
                  // description type wraps to comfortable line
                  // lengths instead of laddering down at ~12 chars.
                  maxWidth: isMobile ? "85%" : "60%",
                  paddingLeft: block.align === "left" ? "2vw" : "0",
                  paddingRight: block.align === "right" ? "2vw" : "0",
                  ...rowMargin,
                }}
              >
                <ScatteredPrint
                  flow
                  src={src}
                  alt={entry?.title || block.id}
                  maxSize={printMaxSize}
                  onSelect={() => openPrintLightbox(block.id)}
                />
                <LilyTrigger
                  flow
                  src={lilyImg}
                  size={lilySize}
                  used={usedLilies.has(block.textIndex)}
                  onSelect={() =>
                    handleLilyClick({
                      id: block.textIndex,
                      textIndex: block.textIndex,
                    })
                  }
                />
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Central Monet painting — left panel, split into a fixed painting
          zone and a fixed text zone so the painting never shifts when
          text appears or changes below it. */}
      <div
        className="fixed pointer-events-none z-20 flex flex-col items-center"
        style={{
          top: topMargin,
          left: 0,
          width: rightColumnLeft,
          bottom: bottomMargin,
        }}
      >
        {/* Painting zone: fills the space above the text reserve and
            keeps the painting vertically centred within its own area. */}
        <div
          className="flex items-center justify-center w-full"
          style={{ height: centralHeight, flexShrink: 0 }}
        >
          <CentralPainting
            painting={centralPainting}
            maxWidth={centralMaxWidth}
            height={centralHeight}
            onSelect={openCentralLightbox}
          />
        </div>
        {/* Text zone: fixed height at the bottom of the panel so the
            painting position is never affected by text appearing here. */}
        <div
          className="w-full px-6 flex justify-center items-start"
          style={{ height: captionReserve, paddingTop: "0.75rem" }}
        >
          <InfoBlock
            flow
            text={
              activeTextIndex !== null
                ? INFO_BLOCKS[activeTextIndex]
                : "Monet painted 12–18 works depicting the Japanese bridge. On the right are several woodblock prints from his personal collection."
            }
            visible
          />
        </div>
      </div>

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
        <ExploreDropdown currentPage="#/ukiyo-e-influence" />
      )}

      {/* Top-right bar — subtitle prompt + progress counter on one line,
          pinned to the top of the right panel. White pill so it reads
          cleanly against the ambient pond background. */}
      <div
        className="fixed top-4 md:top-6 z-40 pointer-events-none flex items-center"
        style={{ left: rightColumnLeft, right: 0, justifyContent: "center", paddingRight: "9rem" }}
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
