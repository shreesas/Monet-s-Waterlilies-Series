// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.img>; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";

// A pink water lily PNG that can be clicked exactly once. When `used` flips
// true the icon fades to ~40% opacity, the cursor returns to default, and
// click handling is dropped on the floor.
export default function LilyTrigger({
  src,
  style,
  size,
  used,
  onSelect,
}) {
  return (
    <motion.img
      src={src}
      alt="Reveal a story"
      draggable={false}
      onClick={used ? undefined : onSelect}
      animate={
        used
          ? { opacity: 0.4, scale: 1 }
          : { opacity: 1, scale: 1 }
      }
      whileTap={used ? undefined : { scale: 1.15 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute select-none"
      style={{
        ...style,
        width: size,
        height: "auto",
        cursor: used ? "default" : "pointer",
        transform: "translate(-50%, -50%)",
        filter: "drop-shadow(9px 14px 29.1px rgba(0, 0, 0, 0.10))",
      }}
    />
  );
}
