import { useEffect } from "react";
// eslint-disable-next-line no-unused-vars -- `motion` is used as <motion.div>; project eslint lacks jsx-uses-vars
import { motion } from "framer-motion";

// Receives a normalized LightboxMetadata. Any missing field is silently
// skipped so we never render "undefined" rows.
export default function FullscreenLightbox({ data, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!data) return null;

  const rows = [
    data.artist && { label: "Artist", value: data.artist },
    data.year && { label: "Year", value: data.year },
    data.location && { label: "Collection", value: data.location },
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col xl:flex-row items-center xl:items-stretch gap-6 xl:gap-10 max-w-[95vw] max-h-[95vh] px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center min-h-0">
          <img
            src={data.imageUrl}
            alt={data.title || "Artwork"}
            className="block max-h-[80vh] xl:max-h-[90vh] max-w-full w-auto h-auto object-contain museum-frame-lightbox"
            draggable={false}
          />
        </div>

        <div className="text-white max-w-md xl:max-w-sm xl:flex xl:flex-col xl:justify-end">
          {data.title && (
            <h3
              className="font-serif italic leading-snug"
              style={{ fontSize: "clamp(1.25rem, 2vw, 1.75rem)" }}
            >
              {data.title}
            </h3>
          )}
          {rows.length > 0 && (
            <dl className="mt-4 space-y-2">
              {rows.map((r) => (
                <div key={r.label} className="flex gap-2">
                  <dt
                    className="font-sans text-neutral-400 uppercase tracking-wider text-xs whitespace-nowrap pt-0.5"
                    style={{ minWidth: "5.5rem" }}
                  >
                    {r.label}
                  </dt>
                  <dd
                    className="font-sans text-neutral-200"
                    style={{ fontSize: "clamp(0.875rem, 1.1vw, 1rem)" }}
                  >
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}
