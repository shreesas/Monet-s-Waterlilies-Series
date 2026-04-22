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
        className="relative w-full"
        style={{ maxWidth: "min(520px, 100%)" }}
      >
        <motion.p
          initial={false}
          animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 8 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif italic text-charcoal/80 text-center leading-relaxed"
          style={{
            fontSize: "clamp(15px, 1.2vw, 20px)",
            textWrap: "pretty",
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
        width: "min(420px, 32vw)",
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif italic text-charcoal/80 text-center leading-relaxed"
            style={{
              fontSize: "clamp(15px, 1.2vw, 20px)",
              textWrap: "pretty",
            }}
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
