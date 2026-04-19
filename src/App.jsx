import { useState, useEffect } from "react";
import EastMeetsWest from "./components/EastMeetsWest";
import LilyMorph from "./components/LilyMorph";

// Tiny hash router: '#/east-meets-west' renders Screen 2; everything else
// falls back to the original Screen 1. TODO: wire up navigation to screens
// 1 and 3 with proper links once they exist.
function useHashRoute() {
  const [hash, setHash] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash
  );
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function HeroSection() {
  return (
    <section className="relative pt-5 md:pt-6 pb-4 px-4 text-center">
      <h1
        className="font-serif text-charcoal leading-[1.05]"
        style={{ fontSize: "clamp(1.25rem, 2.6vw, 2.75rem)" }}
      >
        A garden. A pond. 30 years.
      </h1>
      <p
        className="mt-2"
        style={{ fontSize: "clamp(1.225rem, 2.1vw, 1.75rem)" }}
      >
        <span className="font-sans text-charcoal/85">
          Exploring the shape of{" "}
        </span>
        <span className="font-serif italic text-charcoal/85">
          Monet&rsquo;s obsession with water lilies
        </span>
      </p>
    </section>
  );
}

function ScreenOne() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white">
      <main className="relative z-10">
        <HeroSection />
        <LilyMorph />
      </main>

      <a
        href="#/east-meets-west"
        className="fixed bottom-6 right-6 z-30 rounded-full bg-charcoal text-cream font-sans text-sm px-5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors"
      >
        East Meets West &rarr;
      </a>
    </div>
  );
}

export default function App() {
  const hash = useHashRoute();
  if (hash === "#/east-meets-west") return <EastMeetsWest />;
  return <ScreenOne />;
}
