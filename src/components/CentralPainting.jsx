// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.img>; project eslint lacks jsx-uses-vars
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// The Monet painting, rendered as a single image slab. No frame, no
// glass effect — the painting fills its own slab edge-to-edge and
// the parent component is responsible for placing/centring it.
//
// Sizing: the slab grows to match the painting's *natural* aspect at
// the supplied `height`, capped at `maxWidth` so it never crowds the
// scattered prints. The slab's aspect is locked to the FIRST painting
// loaded so the box doesn't reshape when the user clicks through
// subsequent paintings (those are cropped to fit via `object-cover`).
//
// When `squareSize` is set (e.g. `min(24vw, 32vh)`), the slab is a fixed
// square of that CSS length on both axes — useful for radial scatter
// layouts where the Monet should read as a crop-on-square anchor.
export default function CentralPainting({
  painting,
  height,
  maxWidth,
  onSelect,
  squareSize,
}) {
  const [aspect, setAspect] = useState(null);

  useEffect(() => {
    if (squareSize) return; // square box ignores natural aspect for layout
    if (aspect !== null) return; // already locked; never re-measure
    if (!painting?.image_url) return;
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) {
        setAspect(probe.naturalWidth / probe.naturalHeight);
      }
    };
    probe.src = painting.image_url;
  }, [aspect, painting?.image_url, squareSize]);

  if (!painting) return null;

  // Sensible portrait fallback so the slab renders before the first
  // measurement comes back, then locks to the first painting's aspect.
  const lockedAspect = aspect ?? 0.78;
  const slabWidth = `min(${maxWidth}, calc(${lockedAspect} * ${height}))`;

  const square = Boolean(squareSize);

  return (
    <div
      className="relative pointer-events-auto cursor-pointer overflow-hidden"
      style={
        square
          ? { width: squareSize, height: squareSize }
          : { width: slabWidth, height }
      }
      onClick={onSelect}
    >
      <AnimatePresence>
        <motion.img
          key={painting.catalog_number}
          src={painting.image_url}
          alt={painting.alt_text || painting.title}
          draggable={false}
          className="absolute inset-0 block w-full h-full select-none object-cover"
          initial={
            square ? { opacity: 0 } : aspect === null ? false : { opacity: 0 }
          }
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
      </AnimatePresence>
    </div>
  );
}
