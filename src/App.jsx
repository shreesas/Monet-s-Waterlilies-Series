import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars -- `AnimatePresence` is used in JSX; project eslint lacks jsx-uses-vars
import { AnimatePresence } from "framer-motion";
import EastMeetsWest from "./components/EastMeetsWest";
import EastMeetsWestV2 from "./components/EastMeetsWestV2";
import InfluenceGraphPolaroid from "./components/InfluenceGraphPolaroid";
import LilyMorph from "./components/LilyMorph";
import HomeIntro from "./components/HomeIntro";
import ExploreDropdown from "./components/ExploreDropdown";

// Module-level flag: true once the user has seen the very first intro
// screen (the "A garden. A pond. 30 years." splash). On the first page
// load this is false so the full intro plays. On every subsequent visit
// to The Journey within the same JS session we skip directly to the
// second intro screen ("Monet's obsession with water lilies").
let firstIntroScreenSeen = false;

// Tiny hash router: '#/ukiyo-e-influence' renders Screen 2; everything else
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
  // Always replay the home intro whenever the user navigates back to
  // "The Journey" so the entry experience is consistent from the dropdown,
  // but skip past the first splash on return visits.
  const [showIntro, setShowIntro] = useState(true);
  const [introStartIndex] = useState(() => (firstIntroScreenSeen ? 1 : 0));

  // Mark the very first splash as seen the moment the home intro mounts
  // for the first time, so subsequent navigations start at screen 2.
  useEffect(() => {
    firstIntroScreenSeen = true;
  }, []);

  const handleIntroComplete = () => {
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

          <ExploreDropdown currentPage="#/" />
        </>
      )}

      <AnimatePresence>
        {showIntro && (
          <HomeIntro
            onComplete={handleIntroComplete}
            startIndex={introStartIndex}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const hash = useHashRoute();
  if (hash === "#/abstract-legacy") return <InfluenceGraphPolaroid />;
  if (hash === "#/ukiyo-e-influence-v2") return <EastMeetsWestV2 />;
  if (hash === "#/ukiyo-e-influence") return <EastMeetsWest />;
  return <ScreenOne />;
}
