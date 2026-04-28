import { useState, useEffect, useCallback, useMemo } from "react";
// eslint-disable-next-line no-unused-vars -- named imports used in JSX
import { motion, AnimatePresence } from "framer-motion";
import ExploreDropdown from "./ExploreDropdown";

const assetModules = import.meta.glob(
  ["../assets/*.jpg", "../assets/*.jpeg", "../assets/*.png", "../assets/*.webp"],
  { eager: true, import: "default" }
);
const ASSETS = Object.fromEntries(
  Object.entries(assetModules).map(([path, url]) => [path.split("/").pop(), url])
);

function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return ASSETS[url.split("/").pop()] ?? null;
}

// Thumbnail size (px) per connection strength — direct is largest.
// Reduced by 15% globally to open more negative space between nodes.
const STRENGTH_SIZE = { direct: 153, critical: 116, documented: 92 };


function findConnectedMonet(painting, catalog) {
  for (const id of painting.monet_paintings_connected || []) {
    const entry = catalog.find((c) => c.catalog_number === id);
    if (entry?.image_url) return entry;
  }
  return (
    catalog.find((c) => c.catalog_number === "W.1973") ||
    catalog.find((c) => c.image_url) ||
    null
  );
}

export default function InfluenceGraph() {
  const [paintings, setPaintings] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    Promise.all([
      fetch("/monet_influenced_paintings.json").then((r) => r.json()),
      fetch("/water_lilies_catalog.json").then((r) => r.json()),
    ])
      .then(([influenced, monet]) => {
        setPaintings(influenced.paintings || []);
        setCatalog(Array.isArray(monet) ? monet : []);
      })
      .catch((err) => console.error("Failed to load influence data", err));
  }, []);

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const cx = dims.w / 2;
  const cy = dims.h / 2;

  const centerMonet = useMemo(
    () =>
      catalog.find((c) => c.catalog_number === "W.1973") ||
      catalog.find((c) => c.image_url) ||
      null,
    [catalog]
  );

  // Elliptical orbital placement with no-overlap safety nudging.
  const nodes = useMemo(() => {
    const sorted = [
      ...paintings.filter((p) => p.connection_strength === "direct"),
      ...paintings.filter((p) => p.connection_strength === "critical"),
      ...paintings.filter((p) => p.connection_strength === "documented"),
    ];
    if (!sorted.length) return [];

    const CENTER_R = 200; // radius of the 400 px central circle
    const CENTER_HALO = 100; // 100px clear gap around the 400px central circle
    const BUFFER = 10; // minimum gap between any two painting edges
    const ORBIT_RADIAL_JITTER = 40;

    // Deterministic LCG — fixed seed gives the same cloud every render
    let s = 0x9e3779b9;
    const rand = () => {
      s = Math.imul(s ^ (s >>> 15), 0xd168aaad) ^ 0;
      s = Math.imul(s ^ (s >>> 13), 0xaf723597) ^ 0;
      return (s >>> 0) / 0xffffffff;
    };

    const ORBITS = [
      { count: 6, ringScale: 0.52, sizeScale: 0.82 },  // Inner orbit
      { count: 8, ringScale: 0.74, sizeScale: 0.92 },  // Middle orbit
      { count: 10, ringScale: 1, sizeScale: 1 },       // Outer orbit
    ];

    const maxBaseRadius = Math.max(...Object.values(STRENGTH_SIZE)) / 2;
    // Use more of the available viewport — tighter margins so orbits fill the screen.
    const maxSafeX = Math.max(260, dims.w / 2 - maxBaseRadius - 16);
    const maxSafeY = Math.max(160, dims.h / 2 - maxBaseRadius - 90);
    // Allow a slightly wider ratio (up to 2.2:1) and use full horizontal safe space.
    const outerRy = Math.min(maxSafeY, maxSafeX * 0.46);
    const outerRx = Math.min(maxSafeX, outerRy * 2.2);

    const placed = [];
    let cursor = 0;

    for (const orbit of ORBITS) {
      const orbitItems = sorted.slice(cursor, cursor + orbit.count);
      cursor += orbit.count;
      if (!orbitItems.length) continue;

      const rxBase = outerRx * orbit.ringScale;
      const ryBase = outerRy * orbit.ringScale;
      const step = (Math.PI * 2) / orbitItems.length;
      const phase = rand() * Math.PI * 2;

      orbitItems.forEach((painting, index) => {
        const strength = painting.connection_strength || "critical";
        const baseSize = STRENGTH_SIZE[strength] ?? 116;
        const size = Math.round(baseSize * orbit.sizeScale);
        const r = size / 2;
        const imageUrl = resolveImageUrl(painting.image_url);

        const angle = phase + index * step + (rand() - 0.5) * 0.24;
        const radialOffset = (rand() * 2 - 1) * ORBIT_RADIAL_JITTER;
        const rx = Math.max(CENTER_R + CENTER_HALO + r + BUFFER, rxBase + radialOffset);
        const ry = Math.max((CENTER_R + CENTER_HALO + r + BUFFER) * 0.56, ryBase + radialOffset * 0.5);

        let targetX = cx + Math.cos(angle) * rx;
        let targetY = cy + Math.sin(angle) * ry;

        // FIX 1: Guarantee every target position clears the central circle.
        // The elliptical ry can be smaller than the circular center radius,
        // so nodes placed at the top/bottom would have targets INSIDE the
        // center — causing the spring-pull and center-push to fight forever.
        const minClear = CENTER_R + CENTER_HALO + r + BUFFER;
        const targetDist = Math.hypot(targetX - cx, targetY - cy) || 1;
        if (targetDist < minClear) {
          const scale = minClear / targetDist;
          targetX = cx + (targetX - cx) * scale;
          targetY = cy + (targetY - cy) * scale;
        }

        placed.push({
          painting,
          strength,
          imageUrl,
          size,
          r,
          x: targetX,
          y: targetY,
          targetX,
          targetY,
        });
      });
    }

    // If there are more than 24 paintings, continue on outer orbit settings.
    if (cursor < sorted.length) {
      const overflow = sorted.slice(cursor);
      const step = (Math.PI * 2) / overflow.length;
      const phase = rand() * Math.PI * 2;
      overflow.forEach((painting, index) => {
        const strength = painting.connection_strength || "critical";
        const size = STRENGTH_SIZE[strength] ?? 116;
        const r = size / 2;
        const imageUrl = resolveImageUrl(painting.image_url);
        const angle = phase + index * step + (rand() - 0.5) * 0.24;
        const radialOffset = (rand() * 2 - 1) * ORBIT_RADIAL_JITTER;
        const rx = Math.max(CENTER_R + CENTER_HALO + r + BUFFER, outerRx + radialOffset);
        const ry = Math.max((CENTER_R + CENTER_HALO + r + BUFFER) * 0.56, outerRy + radialOffset * 0.5);
        let targetX = cx + Math.cos(angle) * rx;
        let targetY = cy + Math.sin(angle) * ry;
        const minClear = CENTER_R + CENTER_HALO + r + BUFFER;
        const td = Math.hypot(targetX - cx, targetY - cy) || 1;
        if (td < minClear) { targetX = cx + (targetX - cx) * (minClear / td); targetY = cy + (targetY - cy) * (minClear / td); }
        placed.push({
          painting,
          strength,
          imageUrl,
          size,
          r,
          x: targetX,
          y: targetY,
          targetX,
          targetY,
        });
      });
    }

    // FIX 3: Loop order — center-push runs first (authority), then pair
    // repulsion, then viewport clamp last. Running clamp before center-push
    // previously snapped nodes back inside the central circle boundary.
    // Spring pull removed — it fought the repulsion and prevented full convergence.
    // Pure repulsion (center-push + pair-separation + clamp) converges cleanly.
    for (let iter = 0; iter < 400; iter++) {
      let moved = false;

      // 1. Center push — push any node that is inside CENTER_R + halo + r + buffer
      //    fully outward. This runs before clamp so clamp cannot override it.
      for (const it of placed) {
        const dx = it.x - cx;
        const dy = it.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const need = CENTER_R + CENTER_HALO + it.r + BUFFER;
        if (dist < need) {
          const push = need - dist;
          it.x += (dx / dist) * push;
          it.y += (dy / dist) * push;
          moved = true;
        }
      }

      // 3. Pair repulsion — resolve painting-vs-painting overlaps.
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i];
          const b = placed[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const need = a.r + b.r + BUFFER;
          if (dist < need) {
            const push = (need - dist) / 2;
            a.x -= (dx / dist) * push;
            a.y -= (dy / dist) * push;
            b.x += (dx / dist) * push;
            b.y += (dy / dist) * push;
            moved = true;
          }
        }
      }

      // 4. Viewport clamp — last so it cannot push nodes back into the center.
      //    Any node that would violate the center boundary after clamping is
      //    re-pushed outward to preserve the minimum clearance.
      for (const it of placed) {
        const cx2 = Math.max(it.r + 20, Math.min(dims.w - it.r - 20, it.x));
        const cy2 = Math.max(it.r + 90, Math.min(dims.h - it.r - 70, it.y));
        if (cx2 !== it.x || cy2 !== it.y) moved = true;
        it.x = cx2;
        it.y = cy2;

        // After clamping, re-enforce center clearance in case clamp moved a
        // node inward (e.g. near the viewport top edge above the center).
        const ddx = it.x - cx;
        const ddy = it.y - cy;
        const dd = Math.hypot(ddx, ddy) || 1;
        const need = CENTER_R + CENTER_HALO + it.r + BUFFER;
        if (dd < need) {
          it.x += (ddx / dd) * (need - dd);
          it.y += (ddy / dd) * (need - dd);
          moved = true;
        }
      }

      if (!moved) break;
    }

    return placed.map(({ painting, x, y, strength, imageUrl, size }) => ({
      painting, x, y, strength, imageUrl, size,
    }));
  }, [paintings, cx, cy, dims]);

  // Push neighbours away when a node is hovered.
  //
  // The hovered node's inner div scales to 1.7×, so its visual radius grows
  // from r to r*1.7. We run a small iterative simulation:
  //   Pass A — push every non-hovered node clear of the expanded hovered node.
  //   Pass B — resolve any cascading neighbor-vs-neighbor overlaps that result.
  // This repeats until nothing moves (or 30 iterations), then returns each
  // node's delta offset from its resting position.
  const pushOffsets = useMemo(() => {
    if (!hoveredId) return {};
    const hovNode = nodes.find((n) => n.painting.id === hoveredId);
    if (!hovNode) return {};

    const HOVER_SCALE = 2;
    const GAP = 12; // minimum gap between circle edges after push

    // Mutable working positions
    const pts = nodes.map((n) => ({
      id: n.painting.id,
      x: n.x,
      y: n.y,
      r: (n.size ?? STRENGTH_SIZE[n.strength] ?? 68) / 2,
      isHov: n.painting.id === hoveredId,
    }));

    const hov = pts.find((p) => p.isHov);
    const hovR = hov.r * HOVER_SCALE; // expanded visual radius
    const MONET_R = 300; // 200px circle radius + 100px clear gap

    for (let iter = 0; iter < 30; iter++) {
      let moved = false;

      // Pass A: clear every node from the expanded hovered circle
      for (const p of pts) {
        if (p.isHov) continue;
        const dx = p.x - hov.x;
        const dy = p.y - hov.y;
        const dist = Math.hypot(dx, dy) || 1;
        const need = hovR + p.r + GAP;
        if (dist < need) {
          const push = need - dist;
          p.x += (dx / dist) * push;
          p.y += (dy / dist) * push;
          moved = true;
        }
      }

      // Pass B: resolve cascading neighbor-vs-neighbor overlaps
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].isHov) continue;
        for (let j = i + 1; j < pts.length; j++) {
          if (pts[j].isHov) continue;
          const a = pts[i];
          const b = pts[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const need = a.r + b.r + GAP;
          if (dist < need) {
            const push = (need - dist) / 2;
            a.x -= (dx / dist) * push;
            a.y -= (dy / dist) * push;
            b.x += (dx / dist) * push;
            b.y += (dy / dist) * push;
            moved = true;
          }
        }
      }

      // Pass C: keep every node clear of the fixed central Monet circle
      for (const p of pts) {
        if (p.isHov) continue;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const need = MONET_R + p.r + GAP;
        if (dist < need) {
          const push = need - dist;
          p.x += (dx / dist) * push;
          p.y += (dy / dist) * push;
          moved = true;
        }
      }

      if (!moved) break;
    }

    // Return deltas from each node's resting position
    const offsets = {};
    for (const p of pts) {
      if (p.isHov) continue;
      const orig = nodes.find((n) => n.painting.id === p.id);
      const dx = p.x - orig.x;
      const dy = p.y - orig.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        offsets[p.id] = { x: dx, y: dy };
      }
    }
    return offsets;
  }, [hoveredId, nodes]);

  const handleSelectNode = useCallback(
    (node) => {
      const monetEntry = findConnectedMonet(node.painting, catalog);
      setSelected({
        ...node,
        monetEntry,
        monetImageUrl: monetEntry ? resolveImageUrl(monetEntry.image_url) : null,
      });
    },
    [catalog]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone">

      {/* ── SVG: connection lines (hidden until hover) ── */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: dims.w, height: dims.h, zIndex: 1 }}
      >
        {nodes.map(({ painting, x, y }) => {
          const push = pushOffsets[painting.id] ?? { x: 0, y: 0 };
          const isHov = hoveredId === painting.id;
          const anyHov = hoveredId !== null;
          const ex = x + push.x;
          const ey = y + push.y;
          // Start line at the Monet circle's perimeter, not its centre,
          // so it never crosses the central painting.
          const ang = Math.atan2(ey - cy, ex - cx);
          const x1 = cx + Math.cos(ang) * 200; // 200 = radius of the 400px central circle
          const y1 = cy + Math.sin(ang) * 200;
          return (
            <line
              key={painting.id + "-line"}
              x1={x1}
              y1={y1}
              x2={ex}
              y2={ey}
              stroke="black"
              strokeWidth={isHov ? 1.5 : 1}
              opacity={anyHov ? (isHov ? 1 : 0.25) : 0}
              style={{ transition: "opacity 0.3s, stroke-width 0.2s" }}
            />
          );
        })}
      </svg>

      {/* ── Full-page backdrop blur — fades in on hover.
           Everything at z<22 (regular nodes, dimmed lines) blurs through it.
           The hovered painting (z-30), Monet (z-28), and connection line
           SVG B (z-25) sit above it and remain sharp. ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 22,
          backdropFilter: "blur(1px)",
          WebkitBackdropFilter: "blur(1px)",
          background: "transparent",
          pointerEvents: "none",
          opacity: hoveredId ? 1 : 0,
          transition: "opacity 0.35s ease",
        }}
      />

      {/* ── Center node: Monet Water Lilies — z-28 when hovering so it stays
           above the backdrop blur overlay ── */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: "translate(-50%, -50%)",
          zIndex: hoveredId ? 28 : 20,
        }}
      >
        <div
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          }}
        >
          {centerMonet?.image_url ? (
            <img
              src={centerMonet.image_url}
              alt="Monet, Water Lilies"
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-warmgray flex items-center justify-center">
              <span className="font-serif italic text-charcoal/60 text-xs text-center px-3">
                Water Lilies
              </span>
            </div>
          )}
        </div>
        <p
          className="font-serif italic text-charcoal/65 text-center mt-2"
          style={{ fontSize: "0.68rem", width: 420, marginLeft: -10, lineHeight: 1.3 }}
        >
          Monet, <em>Water Lilies</em>
        </p>
      </div>

      {/* ── Painting nodes ── */}
      {nodes.map((node, idx) => {
        const { painting, x, y, strength, imageUrl } = node;
        const size = node.size ?? (STRENGTH_SIZE[strength] ?? 68);
        const isHov = hoveredId === painting.id;
        const push = pushOffsets[painting.id] ?? { x: 0, y: 0 };

        return (
          <motion.button
            key={painting.id}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1, x: push.x, y: push.y }}
            transition={
              // On first mount use stagger; on push changes use spring
              hoveredId
                ? { type: "spring", stiffness: 260, damping: 28 }
                : {
                    delay: 0.15 + idx * 0.04,
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
            style={{
              position: "absolute",
              left: x,
              top: y,
              // FIX 2: use margin instead of transform for centering so
              // Framer Motion's animate={{ x, y }} (push offset) doesn't
              // compete with / overwrite the translate(-50%,-50%) centering.
              marginLeft: -(size / 2),
              marginTop: -(size / 2),
              width: size,
              height: size,
              zIndex: isHov ? 30 : 20,
            }}
            onMouseEnter={() => setHoveredId(painting.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => handleSelectNode(node)}
            aria-label={`${painting.title} by ${painting.artist}`}
          >
            <motion.div
              className="w-full h-full overflow-hidden"
              animate={{
                scale: isHov ? 2 : 1,
              }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                borderRadius: "50%",
                boxShadow: "0 4px 18px rgba(0,0,0,0.15)",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={painting.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-warmgray flex items-center justify-center p-1.5">
                  <span
                    className="font-sans text-charcoal/55 text-center leading-tight"
                    style={{ fontSize: 7 }}
                  >
                    {painting.artist.split(" ").slice(-1)[0]}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Artist name — only visible on hover */}
            {isHov && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap"
                style={{ bottom: -24, zIndex: 31 }}
              >
                <span
                  className="font-sans text-charcoal bg-white/95 px-2 py-0.5 rounded-full shadow-sm"
                  style={{ fontSize: "0.63rem" }}
                >
                  {painting.artist}
                </span>
              </motion.div>
            )}
          </motion.button>
        );
      })}
      {/* ── SVG B: highlighted spoke rendered above all satellite paintings ── */}
      {hoveredId && (() => {
        const hovNode = nodes.find((n) => n.painting.id === hoveredId);
        if (!hovNode) return null;
        const push = pushOffsets[hovNode.painting.id] ?? { x: 0, y: 0 };
        const ex = hovNode.x + push.x;
        const ey = hovNode.y + push.y;
        const ang2 = Math.atan2(ey - cy, ex - cx);
        const lx1 = cx + Math.cos(ang2) * 200;
        const ly1 = cy + Math.sin(ang2) * 200;
        return (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: dims.w, height: dims.h, zIndex: 25 }}
          >
            <line
              x1={lx1} y1={ly1} x2={ex} y2={ey}
              stroke="black"
              strokeWidth={1.5}
              opacity={1}
            />
          </svg>
        );
      })()}

      {/* ── Legend: size = strength ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="fixed bottom-6 left-6 z-10 flex flex-col gap-2 pointer-events-none"
      >
        {[
          { label: "Artist stated", strength: "direct" },
          { label: "Critical link", strength: "critical" },
          { label: "Archivally documented", strength: "documented" },
        ].map(({ label, strength }) => {
          const sz = STRENGTH_SIZE[strength];
          // Show a small square proportional to the thumbnail size
          const dot = Math.round(sz * 0.17);
          return (
            <div key={label} className="flex items-center gap-2.5">
              <div
                style={{
                  width: dot,
                  height: dot,
                  background: "rgba(45,45,45,0.4)",
                  flexShrink: 0,
                  borderRadius: 1,
                }}
              />
              <span
                className="font-sans text-charcoal/52"
                style={{ fontSize: "0.63rem" }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </motion.div>

      <ExploreDropdown currentPage="#/water-lilies-influence" />

      {/* ── Detail overlay ── */}
      <AnimatePresence>
        {selected && (
          <InfluenceDetailOverlay
            painting={selected.painting}
            imageUrl={selected.imageUrl}
            monetEntry={selected.monetEntry}
            monetImageUrl={selected.monetImageUrl}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function InfluenceDetailOverlay({ painting, imageUrl, monetEntry, monetImageUrl, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-row w-full h-screen"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left column — 60%: Monet on top, influenced painting below, vertically centered */}
        <div className="flex flex-col justify-center gap-10 overflow-y-auto px-10 py-12" style={{ width: "60%" }}>
          {/* Monet painting */}
          <div className="flex flex-col items-center gap-1.5">
            {monetImageUrl ? (
              <img
                src={monetImageUrl}
                alt={monetEntry?.title || "Monet, Water Lilies"}
                className="w-full h-auto object-contain"
                style={{ maxHeight: "36vh" }}
                draggable={false}
              />
            ) : (
              <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "36vh" }}>
                <span className="font-serif italic text-black/40 text-xs text-center px-3">Monet, Water Lilies</span>
              </div>
            )}
            <p className="font-sans text-black text-xs mt-1 text-center">Claude Monet</p>
            <p className="font-serif italic text-black text-xs text-center">{monetEntry?.title || "Water Lilies"}</p>
            <p className="font-sans text-black/55 text-xs text-center">
              {[monetEntry?.year, monetEntry?.collection].filter(Boolean).join(", ")}
            </p>
          </div>

          {/* Influenced painting */}
          <div className="flex flex-col items-center gap-1.5">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={painting.title}
                className="w-full h-auto object-contain"
                style={{ maxHeight: "36vh" }}
                draggable={false}
              />
            ) : (
              <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "36vh" }}>
                <span className="font-serif italic text-black/40 text-xs text-center px-3">Image rights restricted</span>
              </div>
            )}
            <p className="font-sans text-black text-xs mt-1 text-center">{painting.artist}</p>
            <p className="font-serif italic text-black text-xs text-center">{painting.title}</p>
            <p className="font-sans text-black/55 text-xs text-center">
              {[painting.year, painting.collection].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="self-stretch" style={{ width: 1, background: "rgba(0,0,0,0.08)", flexShrink: 0 }} />

        {/* Right column — 40%: description + learn more, vertically centered, left-aligned */}
        <div className="flex flex-col justify-center gap-6 px-10 py-12 overflow-y-auto" style={{ width: "40%" }}>
          {painting.connection_claim && (
            <p className="font-serif italic text-charcoal/80 leading-relaxed" style={{ fontSize: "clamp(15px, 1.2vw, 20px)", textWrap: "pretty", maxWidth: "55ch" }}>
              {painting.connection_claim}
            </p>
          )}

          {painting.citation_url && (
            <a
              href={painting.citation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-sans text-black/60 hover:text-black transition-colors w-fit"
              style={{ fontSize: "0.82rem", borderBottom: "1px solid rgba(0,0,0,0.25)", paddingBottom: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              Learn more
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6h8M6 2l4 4-4 4" />
              </svg>
            </a>
          )}
        </div>
      </motion.div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/8 hover:bg-black/14 text-black transition-colors"
        aria-label="Close"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}
