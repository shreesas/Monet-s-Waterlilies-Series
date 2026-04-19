// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.p>; project eslint lacks jsx-uses-vars
import { motion, AnimatePresence } from "framer-motion";

// `flow` switches the block from absolute-positioned (legacy scatter)
// to document-flow (used inside the vertical scroll column). In flow
// mode we ALWAYS render the paragraph (just toggling opacity) so the
// surrounding column reserves the text's true height up front and
// nothing below shifts when the lily reveals it.
export default function InfoBlock({ text, visible, style, flow = false }) {
  if (flow) {
    return (
      <div
        className="relative"
        style={{ width: "min(260px, 22vw)" }}
      >
        <motion.p
          initial={false}
          animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 8 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-charcoal text-center leading-snug"
          style={{
            fontSize: "clamp(0.72rem, 0.95vw, 0.92rem)",
            // Keep the text laid out (and therefore measured) even
            // when invisible, so the column never re-flows on reveal.
            visibility: "visible",
            pointerEvents: visible ? "auto" : "none",
          }}
          aria-hidden={!visible}
        >
          {text}
        </motion.p>
      </div>
    );
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        ...style,
        transform: "translate(-50%, 0)",
        width: "min(260px, 22vw)",
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif text-charcoal text-center leading-snug"
            style={{ fontSize: "clamp(0.72rem, 0.95vw, 0.92rem)" }}
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
