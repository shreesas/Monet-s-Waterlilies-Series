// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.img>; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";

// A pink water lily PNG that can be clicked exactly once. When `used` flips
// true the icon fades to ~40% opacity, the cursor returns to default, and
// click handling is dropped on the floor.
//
// Hover affordance: while the lily is still collectable, a "Collect"
// chip in Libre Baskerville (font-serif) floats above it. The chip is
// pointer-events-none so it never intercepts the click.
//
// `flow` switches from absolute-positioned (legacy scatter) to
// document-flow (used inside the vertical scroll column). When `flow`
// is true the wrapper drops `style` and the centring transform — the
// parent flex column controls placement.
export default function LilyTrigger({
  src,
  style,
  size,
  used,
  onSelect,
  flow = false,
}) {
  return (
    <div
      className={`${flow ? "relative" : "absolute"} group`}
      style={{
        ...(flow ? {} : { ...style, transform: "translate(-50%, -50%)" }),
        width: size,
        cursor: used ? "default" : "pointer",
      }}
      onClick={used ? undefined : onSelect}
    >
      <motion.img
        src={src}
        alt="Reveal a story"
        draggable={false}
        animate={used ? { opacity: 0.4 } : { opacity: 1 }}
        whileTap={used ? undefined : { scale: 1.15 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="block w-full h-auto select-none"
        style={{
          filter: "drop-shadow(9px 14px 29.1px rgba(0, 0, 0, 0.10))",
        }}
      />
      {!used && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <div
            className="font-serif text-charcoal bg-white/95 backdrop-blur rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.18)] whitespace-nowrap"
            style={{
              fontSize: "clamp(0.85rem, 1.05vw, 1rem)",
              padding: "6px 14px",
            }}
          >
            Collect
          </div>
        </div>
      )}
    </div>
  );
}
