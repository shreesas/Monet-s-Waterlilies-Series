import { useState } from "react";

const PAGES = [
  { label: "The Journey", href: "#/" },
  { label: "Ukiyo-e Influence", href: "#/ukiyo-e-influence" },
  { label: "Abstract Legacy", href: "#/abstract-legacy" },
];

export default function ExploreDropdown({ currentPage }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed top-6 right-6 z-[70]"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full border border-black/70 bg-transparent text-black font-sans text-sm px-5 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.10)] flex items-center gap-2 select-none cursor-pointer backdrop-blur-sm transition-colors duration-150 hover:bg-black hover:text-white hover:border-black"
      >
        Explore
        <span
          className="transition-transform duration-200 inline-block text-base leading-none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {/* Transparent bridge: pt-2 fills the visual gap so the mouse never
          leaves the parent hover zone while moving from button to items. */}
      <div
        className="absolute top-full right-0 w-52 pt-2"
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <div
          className="rounded-2xl border border-black/15 overflow-hidden transition-all duration-200"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0)" : "translateY(-6px)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            backgroundColor: "rgba(255,255,255,0.55)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          {PAGES.map(({ label, href }) => {
            const isCurrent = currentPage === href;
            return (
              <a
                key={href}
                href={href}
                className={`block px-5 py-3 font-sans text-sm border-b border-black/8 last:border-0 transition-colors ${
                  isCurrent
                    ? "text-black/35 cursor-default pointer-events-none"
                    : "text-black hover:bg-black/6"
                }`}
              >
                {isCurrent && (
                  <span className="mr-1.5 text-black/30">•</span>
                )}
                {label}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
