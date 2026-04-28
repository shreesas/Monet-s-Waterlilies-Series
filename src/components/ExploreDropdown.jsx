import { useState } from "react";

const PAGES = [
  { label: "Homepage", href: "#/" },
  { label: "East Meets West", href: "#/east-meets-west" },
  { label: "Influence Map V1", href: "#/water-lilies-influence" },
  { label: "Influence Map V2", href: "#/water-lilies-influence-polaroid" },
];

export default function ExploreDropdown({ currentPage }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed top-6 right-6 z-[60]"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="rounded-full bg-charcoal text-cream font-sans text-sm px-5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.18)] flex items-center gap-2 select-none cursor-default">
        Explore
        <span
          className="transition-transform duration-200 inline-block"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      <div
        className="absolute top-full right-0 mt-2 w-52 rounded-2xl bg-charcoal shadow-[0_8px_32px_rgba(0,0,0,0.28)] overflow-hidden transition-all duration-200"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-6px)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {PAGES.map(({ label, href }) => {
          const isCurrent = currentPage === href;
          return (
            <a
              key={href}
              href={href}
              className={`block px-5 py-3 font-sans text-sm border-b border-white/10 last:border-0 transition-colors ${
                isCurrent
                  ? "text-cream/40 cursor-default pointer-events-none"
                  : "text-cream hover:bg-white/10"
              }`}
            >
              {isCurrent && (
                <span className="mr-1.5 text-cream/40">•</span>
              )}
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
