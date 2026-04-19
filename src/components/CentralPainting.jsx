// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.div>; project eslint lacks jsx-uses-vars
import { motion, AnimatePresence } from "framer-motion";

// The Monet painting. Anchored to the viewport (parent is a
// `fixed inset-0` wrapper in EastMeetsWest) so it stays put while the
// pannable canvas of prints/lilies/texts slides behind it. The parent
// wrapper is pointer-events-none so clicks pass through to the canvas
// behind; we re-enable pointer-events on this bounding box so the
// painting itself can still be clicked.
//
// All positioning (top/left/transform/etc.) is supplied by the caller via
// `style`. The frame size is fixed by `width` and `height` props — the
// img fills that frame using `object-cover`, so it crops to fit instead
// of letterboxing. This lets us guarantee a constant 40vw × 100vh slab
// on the left of the screen regardless of the underlying painting's
// aspect ratio.
//
// No frame: the painting sits raw on the page (no museum-frame border),
// flush with whatever bounding box the caller positions it in.
export default function CentralPainting({
  painting,
  style,
  width,
  height,
  onSelect,
}) {
  if (!painting) return null;

  return (
    // Default `sync` mode (no `mode` prop) keeps BOTH the outgoing and
    // incoming children mounted simultaneously while they animate, which
    // is exactly what we need for a smooth crossfade dissolve.
    <AnimatePresence>
      <motion.div
        key={painting.catalog_number}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
        className="absolute pointer-events-auto cursor-pointer overflow-hidden"
        style={{ ...style, width, height }}
        onClick={onSelect}
      >
        <img
          src={painting.image_url}
          alt={painting.alt_text || painting.title}
          draggable={false}
          className="block w-full h-full object-cover select-none"
        />
      </motion.div>
    </AnimatePresence>
  );
}
