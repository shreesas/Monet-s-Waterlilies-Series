import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars -- `AnimatePresence` is used in JSX; project eslint lacks jsx-uses-vars
import { AnimatePresence } from "framer-motion";
import EastMeetsWest from "./components/EastMeetsWest";
import InfluenceGraphPolaroid from "./components/InfluenceGraphPolaroid";
import LilyMorph from "./components/LilyMorph";
import HomeIntro from "./components/HomeIntro";
import ExploreDropdown from "./components/ExploreDropdown";

// Module-level flag: true until the home intro is dismissed once per
// page load. Resets to true on every full reload; survives within-tab
// hash navigation so going to East Meets West and back doesn't replay
// the intro in the same visit.
let homeIntroDismissed = false;

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

          <ExploreDropdown currentPage="#/" />
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
  if (hash === "#/abstract-legacy") return <InfluenceGraphPolaroid />;
  if (hash === "#/ukiyo-e-influence")
    return (
      <>
        <EastMeetsWest />
        <ExploreDropdown currentPage="#/ukiyo-e-influence" />
      </>
    );
  return <ScreenOne />;
}
