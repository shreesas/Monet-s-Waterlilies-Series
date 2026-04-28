import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars -- `AnimatePresence` is used in JSX; project eslint lacks jsx-uses-vars
import { AnimatePresence } from "framer-motion";
import EastMeetsWest from "./components/EastMeetsWest";
import InfluenceGraph from "./components/InfluenceGraph";
import InfluenceGraphPolaroid from "./components/InfluenceGraphPolaroid";
import LilyMorph from "./components/LilyMorph";
import HomeIntro from "./components/HomeIntro";

// Module-level flag: true until the home intro is dismissed once per
// page load. Resets to true on every full reload; survives within-tab
// hash navigation so going to East Meets West and back doesn't replay
// the intro in the same visit.
let homeIntroDismissed = false;

// Tiny hash router: '#/east-meets-west' renders Screen 2; everything else
// falls back to the original Screen 1.
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

function ScreenOne() {
  // Show the intro on every page load; once dismissed in this JS session
  // (e.g. user navigates away and comes back via the hash router) don't
  // replay it.
  const [showIntro, setShowIntro] = useState(() => !homeIntroDismissed);

  const handleIntroComplete = () => {
    homeIntroDismissed = true;
    setShowIntro(false);
  };

  // Hold the LilyMorph mount until the intro is dismissed. Otherwise the
  // morph component starts loading 225 image frames immediately and the
  // already-rendered homepage flickers through any transparent frame in the
  // splash transitions.
  return (
    <div className="relative h-screen overflow-hidden bg-white flex flex-col">
      {!showIntro && (
        <>
          <main className="relative z-10 flex-1 min-h-0 flex items-center">
            <LilyMorph />
          </main>

          <a
            href="#/east-meets-west"
            className="fixed bottom-6 right-6 z-30 rounded-full bg-charcoal text-cream font-sans text-sm px-5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors"
          >
            East Meets West &rarr;
          </a>
        </>
      )}

      <AnimatePresence>
        {showIntro && <HomeIntro onComplete={handleIntroComplete} />}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const hash = useHashRoute();
  if (hash === "#/water-lilies-influence") return <InfluenceGraph />;
  if (hash === "#/water-lilies-influence-polaroid") return <InfluenceGraphPolaroid />;
  if (hash === "#/east-meets-west")
    return (
      <>
        <EastMeetsWest />
        {/* Navigation to Screen 3 — sits above EastMeetsWest but below its
            z-50 lightbox so the button never fights an open overlay. */}
        <div className="fixed bottom-6 right-6 z-40 flex gap-3">
          <a
            href="#/water-lilies-influence"
            className="rounded-full bg-charcoal text-cream font-sans text-sm px-5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors"
          >
            Influence Map V1 &rarr;
          </a>
          <a
            href="#/water-lilies-influence-polaroid"
            className="rounded-full bg-charcoal text-cream font-sans text-sm px-5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors"
          >
            Influence Map V2 &rarr;
          </a>
        </div>
      </>
    );
  return <ScreenOne />;
}
