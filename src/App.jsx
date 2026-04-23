import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars -- `AnimatePresence` is used in JSX; project eslint lacks jsx-uses-vars
import { AnimatePresence } from "framer-motion";
import EastMeetsWest from "./components/EastMeetsWest";
import LilyMorph from "./components/LilyMorph";
import HomeIntro from "./components/HomeIntro";

const HOME_INTRO_DISMISSED_KEY = "home:introDismissed";

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

function ScreenOne() {
  // Two full-bleed splash screens precede the home page on first visit. We
  // remember dismissal in sessionStorage so internal navigation (e.g.
  // bouncing between routes) doesn't replay the intro.
  const [showIntro, setShowIntro] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(HOME_INTRO_DISMISSED_KEY) !== "1"
  );

  const handleIntroComplete = () => {
    sessionStorage.setItem(HOME_INTRO_DISMISSED_KEY, "1");
    setShowIntro(false);
  };

  // Hold the LilyMorph mount until the intro is dismissed. Otherwise the
  // morph component starts loading 225 image frames immediately and the
  // already-rendered homepage flickers through any transparent frame in the
  // splash transitions.
  return (
    <div className="relative h-screen overflow-hidden bg-stone flex flex-col">
      {!showIntro && (
        <>
          <main className="relative z-10 flex-1 min-h-0">
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
  if (hash === "#/east-meets-west") return <EastMeetsWest />;
  return <ScreenOne />;
}
