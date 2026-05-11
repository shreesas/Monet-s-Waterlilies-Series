import { useState, useEffect, useCallback, useMemo, useRef } from "react";
// eslint-disable-next-line no-unused-vars -- named imports used in JSX
import { motion, AnimatePresence } from "framer-motion";
import ExploreDropdown from "./ExploreDropdown";
import InfluenceGraphPolaroidIntro from "./InfluenceGraphPolaroidIntro";

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

const STRENGTH_SIZE = { direct: 118, critical: 118, documented: 118 };
const STRENGTH_LABEL = { direct: "Artist stated", critical: "Critic-attributed", documented: "Archival" };
const POLAROID_BORDER = 8;  // white border on left / right / top
const CAPTION_H = 30;       // white caption strip below the image

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

export default function InfluenceGraphPolaroid() {
  const [showIntro, setShowIntro] = useState(true);
  const [paintings, setPaintings] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [rotatingPaintings, setRotatingPaintings] = useState([]);
  const [rotateIdx, setRotateIdx] = useState(0);
  const circleRef = useRef(null);
  const [circleCenter, setCircleCenter] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

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

  // Use specific Water Lilies paintings for the center rotation
  useEffect(() => {
    if (!catalog.length) return;
    const ids = ["W.1685", "W.1689", "W.1691", "W.1695", "W.1698", "W.1703", "W.1705", "W.1706"];
    const picked = ids
      .map((id) => catalog.find((c) => c.catalog_number === id))
      .filter((c) => c?.image_url);
    setRotatingPaintings(picked);
  }, [catalog]);

  // Advance the displayed painting every 10 s
  useEffect(() => {
    if (!rotatingPaintings.length) return;
    const timer = setInterval(
      () => setRotateIdx((prev) => (prev + 1) % rotatingPaintings.length),
      10000
    );
    return () => clearInterval(timer);
  }, [rotatingPaintings]);

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Measure the actual pixel center of the circle after every layout change
  // so SVG lines start exactly at the circle's edge rather than at the
  // container center (which is offset by the label below the circle).
  useEffect(() => {
    if (!circleRef.current) return;
    const rect = circleRef.current.getBoundingClientRect();
    setCircleCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [dims, showIntro]);

  const cx = dims.w / 2;
  const cy = dims.h / 2;

  const centerMonet = useMemo(
    () =>
      catalog.find((c) => c.catalog_number === "W.1973") ||
      catalog.find((c) => c.image_url) ||
      null,
    [catalog]
  );

  const nodes = useMemo(() => {
    const sorted = [
      ...paintings.filter((p) => p.connection_strength === "direct"),
      ...paintings.filter((p) => p.connection_strength === "critical"),
      ...paintings.filter((p) => p.connection_strength === "documented"),
    ];
    if (!sorted.length) return [];

    const CENTER_R = 160;
    const CENTER_HALO = 100;
    const BUFFER = 10;
    const ORBIT_RADIAL_JITTER = 40;

    let s = 0x9e3779b9;
    const rand = () => {
      s = Math.imul(s ^ (s >>> 15), 0xd168aaad) ^ 0;
      s = Math.imul(s ^ (s >>> 13), 0xaf723597) ^ 0;
      return (s >>> 0) / 0xffffffff;
    };

    const ORBITS = [
      { count: 6, ringScale: 0.52, sizeScale: 1 },
      { count: 8, ringScale: 0.74, sizeScale: 1 },
      { count: 10, ringScale: 1, sizeScale: 1 },
    ];

    const maxBaseRadius = Math.max(...Object.values(STRENGTH_SIZE)) / 2;
    const maxSafeX = Math.max(260, dims.w / 2 - maxBaseRadius - 16);
    const maxSafeY = Math.max(160, dims.h / 2 - maxBaseRadius - 90);
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
        // Bounding radius for a polaroid card
        const cardW = size + POLAROID_BORDER * 2;
        const cardH = size + POLAROID_BORDER + CAPTION_H;
        const r = Math.hypot(cardW / 2, cardH / 2);
        const imageUrl = resolveImageUrl(painting.image_url);

        const angle = phase + index * step + (rand() - 0.5) * 0.24;
        const radialOffset = (rand() * 2 - 1) * ORBIT_RADIAL_JITTER;
        const rx = Math.max(CENTER_R + CENTER_HALO + r + BUFFER, rxBase + radialOffset);
        const ry = Math.max((CENTER_R + CENTER_HALO + r + BUFFER) * 0.56, ryBase + radialOffset * 0.5);

        let targetX = cx + Math.cos(angle) * rx;
        let targetY = cy + Math.sin(angle) * ry;

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

    if (cursor < sorted.length) {
      const overflow = sorted.slice(cursor);
      const step = (Math.PI * 2) / overflow.length;
      const phase = rand() * Math.PI * 2;
      overflow.forEach((painting, index) => {
        const strength = painting.connection_strength || "critical";
        const size = STRENGTH_SIZE[strength] ?? 116;
        const cardW = size + POLAROID_BORDER * 2;
        const cardH = size + POLAROID_BORDER + CAPTION_H;
        const r = Math.hypot(cardW / 2, cardH / 2);
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

    for (let iter = 0; iter < 400; iter++) {
      let moved = false;

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

      for (const it of placed) {
        const cx2 = Math.max(it.r + 20, Math.min(dims.w - it.r - 20, it.x));
        const cy2 = Math.max(it.r + 90, Math.min(dims.h - it.r - 70, it.y));
        if (cx2 !== it.x || cy2 !== it.y) moved = true;
        it.x = cx2;
        it.y = cy2;

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

    return placed.map(({ painting, x, y, strength, imageUrl, size, r }) => ({
      painting, x, y, strength, imageUrl, size, r,
    }));
  }, [paintings, cx, cy, dims]);

  const pushOffsets = useMemo(() => {
    if (!hoveredId) return {};
    const hovNode = nodes.find((n) => n.painting.id === hoveredId);
    if (!hovNode) return {};

    const HOVER_SCALE = 1.5;
    const GAP = 12;

    const pts = nodes.map((n) => ({
      id: n.painting.id,
      x: n.x,
      y: n.y,
      r: n.r,
      isHov: n.painting.id === hoveredId,
    }));

    const hov = pts.find((p) => p.isHov);
    const hovR = hov.r * HOVER_SCALE;
    const MONET_R = 260;

    for (let iter = 0; iter < 30; iter++) {
      let moved = false;

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
      <AnimatePresence>
        {showIntro && <InfluenceGraphPolaroidIntro onDismiss={() => setShowIntro(false)} />}
      </AnimatePresence>

      {showIntro ? null : (<>

      {/* ── SVG: connection lines ── */}
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
          const ang = Math.atan2(ey - circleCenter.y, ex - circleCenter.x);
          const x1 = circleCenter.x + Math.cos(ang) * 160;
          const y1 = circleCenter.y + Math.sin(ang) * 160;
          const lineOpacity = anyHov ? (isHov ? 1 : 0.25) : 0;
          return (
            <line
              key={painting.id + "-line"}
              x1={x1} y1={y1} x2={ex} y2={ey}
              stroke="black"
              strokeWidth={isHov ? 1.5 : 1}
              opacity={lineOpacity}
              style={{ transition: "opacity 0.3s, stroke-width 0.2s" }}
            />
          );
        })}
      </svg>


      {/* ── Center node: rotating Monet paintings with cross-dissolve ── */}
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
          ref={circleRef}
          style={{
            width: 320,
            height: 320,
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
            position: "relative",
            background: "#d9d4cc",
          }}
        >
          <AnimatePresence mode="sync">
            {rotatingPaintings.length > 0 ? (
              <motion.img
                key={rotateIdx}
                src={rotatingPaintings[rotateIdx].image_url}
                alt={rotatingPaintings[rotateIdx].title || "Monet, Water Lilies"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                draggable={false}
              />
            ) : centerMonet?.image_url ? (
              <img
                src={centerMonet.image_url}
                alt="Monet, Water Lilies"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                draggable={false}
              />
            ) : null}
          </AnimatePresence>
        </div>
        <p
          className="font-serif italic text-black text-center mt-2"
          style={{ fontSize: "1rem", width: 336, marginLeft: -8, lineHeight: 1.3 }}
        >
          Monet, Water Lilies
        </p>
      </div>

      {/* ── Polaroid painting nodes ── */}
      {nodes.map((node, idx) => {
        const { painting, x, y, strength, imageUrl } = node;
        const size = node.size ?? (STRENGTH_SIZE[strength] ?? 68);
        const cardW = size + POLAROID_BORDER * 2;
        const cardH = size + POLAROID_BORDER + CAPTION_H;
        const isHov = hoveredId === painting.id;
        const push = pushOffsets[painting.id] ?? { x: 0, y: 0 };

        return (
          <motion.button
            key={painting.id}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1, x: push.x, y: push.y }}
            transition={
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
              marginLeft: -(cardW / 2),
              marginTop: -(cardH / 2),
              width: cardW,
              height: cardH,
              zIndex: isHov ? 30 : 20,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
            onMouseEnter={() => setHoveredId(painting.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => handleSelectNode(node)}
            aria-label={`${painting.title} by ${painting.artist}`}
          >
            {/* Polaroid card — scales on hover */}
            <motion.div
              className="w-full h-full flex flex-col"
              animate={{ scale: isHov ? 1.45 : 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "white",
                boxShadow: isHov
                  ? "0 12px 40px rgba(0,0,0,0.28)"
                  : "0 4px 18px rgba(0,0,0,0.15)",
                transformOrigin: "center center",
              }}
            >
              {/* Square image area with white border on top/sides */}
              <div
                style={{
                  padding: `${POLAROID_BORDER}px ${POLAROID_BORDER}px 0`,
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={painting.title}
                    style={{
                      display: "block",
                      width: "100%",
                      height: size,
                      objectFit: "cover",
                    }}
                    draggable={false}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: size,
                      background: "#e5e0db",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 7,
                        color: "rgba(0,0,0,0.4)",
                        textAlign: "center",
                        fontFamily: "sans-serif",
                      }}
                    >
                      {painting.artist.split(" ").slice(-1)[0]}
                    </span>
                  </div>
                )}
              </div>

              {/* Caption strip */}
              <div
                style={{
                  height: CAPTION_H,
                  padding: "4px 8px 4px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 1,
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: size < 100 ? 7 : 8,
                    color: "#111",
                    fontFamily: "sans-serif",
                    fontWeight: 500,
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                  }}
                >
                  {painting.artist}
                </span>
                <span
                  style={{
                    fontSize: size < 100 ? 6.5 : 7.5,
                    color: "rgba(0,0,0,0.55)",
                    fontFamily: "serif",
                    fontStyle: "italic",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                  }}
                >
                  {painting.title}
                </span>
              </div>
            </motion.div>

            {/* Strength pill — floats below the polaroid on hover */}
            <AnimatePresence>
              {isHov && (
                <motion.div
                  key="pill"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    top: Math.ceil(cardH / 2 * 2.45) + 2,
                    left: 0,
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      background: "rgba(0,0,0,0.75)",
                      color: "#fff",
                      fontFamily: "sans-serif",
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      lineHeight: 1,
                      padding: "4px 9px",
                      borderRadius: 20,
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}
                  >
                    {STRENGTH_LABEL[strength] ?? strength}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}

      {/* ── SVG B: highlighted spoke above satellite paintings ── */}
      {hoveredId && (() => {
        const hovNode = nodes.find((n) => n.painting.id === hoveredId);
        if (!hovNode) return null;
        const push = pushOffsets[hovNode.painting.id] ?? { x: 0, y: 0 };
        const ex = hovNode.x + push.x;
        const ey = hovNode.y + push.y;
        const ang2 = Math.atan2(ey - circleCenter.y, ex - circleCenter.x);
        const lx1 = circleCenter.x + Math.cos(ang2) * 160;
        const ly1 = circleCenter.y + Math.sin(ang2) * 160;
        const bmx = lx1 + (ex - lx1) * 0.42;
        const bmy = ly1 + (ey - ly1) * 0.42;
        let bdeg = Math.atan2(ey - ly1, ex - lx1) * (180 / Math.PI);
        if (bdeg > 90 || bdeg < -90) bdeg += 180;
        return (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: dims.w, height: dims.h, zIndex: 25 }}
          >
            <line
              x1={lx1} y1={ly1} x2={ex} y2={ey}
              stroke="black"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={1}
            />
          </svg>
        );
      })()}

      {!selected && <ExploreDropdown currentPage="#/abstract-legacy" />}

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
      </>)}
    </div>
  );
}

// Explicit layout overrides for paintings where image crop doesn't match painting proportions
const LAYOUT_OVERRIDES = {
  wrap: new Set([
    'francis-towards-disappearance-ii-1958',
    'frankenthaler-mountains-and-sea-1952',
  ]),
  sideBySide: new Set([
    'rothko-chapel-north-triptych-1966',
    'steir-sixteen-waterfalls-1990',
    'katz-homage-to-monet-5-2009',
  ]),
  // Monet full-width banner at top, influenced painting left + description right below
  monetTopSplit: new Set([
    'bleckner-architecture-of-the-sky-iii-1988',
  ]),
};

function InfluenceDetailOverlay({ painting, imageUrl, monetEntry, monetImageUrl, onClose }) {
  const [paintingAspect, setPaintingAspect] = useState(null);
  const { quotes, addQuote, removeQuote } = useQuotes(painting.id);
  const [quoteText, setQuoteText] = useState("");
  const [editingQuotes, setEditingQuotes] = useState(false);
  const quotesScrollRef = useRef(null);
  const prevQuotesLen = useRef(quotes.length);

  const isTyping = quoteText.trim().length > 0;

  const handleQuoteSubmit = () => {
    const t = quoteText.trim();
    if (!t) return;
    addQuote(t);
    setQuoteText("");
    setEditingQuotes(false);
  };

  // After a new quote is added, scroll the right-panel quotes list to the end.
  useEffect(() => {
    if (quotes.length > prevQuotesLen.current) {
      const target = quotesScrollRef.current;
      if (target) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            target.scrollTo({
              top: target.scrollHeight,
              behavior: "smooth",
            });
          });
        });
      }
    }
    prevQuotesLen.current = quotes.length;
  }, [quotes.length]);

  const overrideWrap = LAYOUT_OVERRIDES.wrap.has(painting.id);
  const overrideSide = LAYOUT_OVERRIDES.sideBySide.has(painting.id);
  const overrideMonetTopSplit = LAYOUT_OVERRIDES.monetTopSplit.has(painting.id);
  // Aspect-ratio fallback: wrap if h/w < 0.67, side by side otherwise
  const sideBySide = !overrideMonetTopSplit && (overrideSide || (!overrideWrap && paintingAspect !== null && paintingAspect >= 0.67));
  const shouldWrap  = !overrideMonetTopSplit && (overrideWrap  || (!overrideSide && paintingAspect !== null && paintingAspect < 0.67));

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
      className="fixed inset-0 z-50 bg-stone"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full h-screen flex flex-row items-stretch overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left section: paintings + description + reader quotes ── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-16 py-12"
          style={{ paddingBottom: "5rem" }}
        >
        {overrideMonetTopSplit ? (
          /* ── Monet banner full-width at top; influenced image left, description right below ── */
          <>
            {/* Monet full-width strip */}
            <div className="mb-6">
              {monetImageUrl ? (
                <img
                  src={monetImageUrl}
                  alt={monetEntry?.title || "Monet, Water Lilies"}
                  style={{ width: "100%", maxHeight: "26vh", objectFit: "cover", objectPosition: "center", display: "block" }}
                  draggable={false}
                />
              ) : (
                <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "26vh" }}>
                  <span className="font-serif italic text-black/40 text-xs text-center px-3">Monet, Water Lilies</span>
                </div>
              )}
              <p className="font-sans text-charcoal font-medium mt-2" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>Claude Monet</p>
              <p className="font-serif italic text-charcoal" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{monetEntry?.title || "Water Lilies"}</p>
              <p className="font-sans text-charcoal/55" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[monetEntry?.year, monetEntry?.collection].filter(Boolean).join(", ")}</p>
            </div>

            {/* Two-column row: influenced painting left, description right */}
            <div className="flex flex-row gap-10 items-start w-full mt-8">
              <div className="flex-1 min-w-0 flex flex-col items-start">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={painting.title}
                    style={{ width: "100%", maxHeight: "46vh", objectFit: "contain", objectPosition: "left top", display: "block" }}
                    draggable={false}
                    onLoad={(e) => setPaintingAspect(e.currentTarget.naturalHeight / (e.currentTarget.naturalWidth || 1))}
                  />
                ) : (
                  <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "36vh" }}>
                    <span className="font-serif italic text-black/40 text-xs text-center px-3">Image rights restricted</span>
                  </div>
                )}
                <p className="font-sans text-charcoal font-medium mt-2" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.artist}</p>
                <p className="font-serif italic text-charcoal" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.title}</p>
                <p className="font-sans text-charcoal/55" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[painting.year, painting.collection].filter(Boolean).join(", ")}</p>
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {painting.connection_claim && (
                  <p className="font-serif italic text-charcoal/80 leading-relaxed text-left" style={{ fontSize: "clamp(14px, 1.1vw, 18px)", textWrap: "pretty" }}>
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
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6h8M6 2l4 4-4 4" /></svg>
                  </a>
                )}
              </div>
            </div>
          </>
        ) : sideBySide ? (
          /* ── Both paintings side by side, description below ── */
          <>
            <div className="flex flex-row gap-8 items-start w-full">
              {/* Left column: painting + captions + description */}
              <div className="flex-1 min-w-0 flex flex-col items-start">
                {monetImageUrl ? (
                  <img src={monetImageUrl} alt={monetEntry?.title || "Monet, Water Lilies"}
                    style={{ height: "48vh", width: "100%", display: "block", objectFit: "contain", objectPosition: "left top" }} draggable={false} />
                ) : (
                  <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "48vh" }}>
                    <span className="font-serif italic text-black/40 text-xs text-center px-3">Monet, Water Lilies</span>
                  </div>
                )}
                <p className="font-sans text-charcoal font-medium mt-2" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>Claude Monet</p>
                <p className="font-serif italic text-charcoal" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{monetEntry?.title || "Water Lilies"}</p>
                <p className="font-sans text-charcoal/55" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[monetEntry?.year, monetEntry?.collection].filter(Boolean).join(", ")}</p>

                {/* Description anchored to left painting edge, ~10-12 words per line */}
                <div className="flex flex-col gap-3 mt-8" style={{ maxWidth: "55ch" }}>
                  {painting.connection_claim && (
                    <p className="font-serif italic text-charcoal/80 leading-relaxed text-left" style={{ fontSize: "clamp(14px, 1.1vw, 18px)", textWrap: "pretty" }}>
                      {painting.connection_claim}
                    </p>
                  )}
                  {painting.citation_url && (
                    <a href={painting.citation_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-sans text-black/60 hover:text-black transition-colors w-fit"
                      style={{ fontSize: "0.82rem", borderBottom: "1px solid rgba(0,0,0,0.25)", paddingBottom: 1 }}
                      onClick={(e) => e.stopPropagation()}>
                      Learn more
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6h8M6 2l4 4-4 4" /></svg>
                    </a>
                  )}
                </div>
              </div>

              {/* Right column: painting + captions only */}
              <div className="flex-1 min-w-0 flex flex-col items-start">
                {imageUrl ? (
                  <img src={imageUrl} alt={painting.title}
                    style={{ height: "48vh", width: "100%", display: "block", objectFit: "contain", objectPosition: "left top" }} draggable={false}
                    onLoad={(e) => setPaintingAspect(e.currentTarget.naturalHeight / (e.currentTarget.naturalWidth || 1))} />
                ) : (
                  <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "48vh" }}>
                    <span className="font-serif italic text-black/40 text-xs text-center px-3">Image rights restricted</span>
                  </div>
                )}
                <p className="font-sans text-charcoal font-medium mt-2" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.artist}</p>
                <p className="font-serif italic text-charcoal" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.title}</p>
                <p className="font-sans text-charcoal/55" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[painting.year, painting.collection].filter(Boolean).join(", ")}</p>
              </div>
            </div>
          </>
        ) : shouldWrap ? (
          /* ── Very different sizes: Monet full-width top, influenced floated with wrap ── */
          <>
            <div className="flex flex-col items-start gap-1.5 mb-10">
              {monetImageUrl ? (
                <img src={monetImageUrl} alt={monetEntry?.title || "Monet, Water Lilies"}
                  className="w-full h-auto object-contain" style={{ maxHeight: "34vh" }} draggable={false}
                  />
              ) : (
                <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "28vh" }}>
                  <span className="font-serif italic text-black/40 text-xs text-center px-3">Monet, Water Lilies</span>
                </div>
              )}
              <p className="font-sans text-charcoal font-medium mt-2 text-left" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>Claude Monet</p>
              <p className="font-serif italic text-charcoal text-left" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{monetEntry?.title || "Water Lilies"}</p>
              <p className="font-sans text-charcoal/55 text-left" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[monetEntry?.year, monetEntry?.collection].filter(Boolean).join(", ")}</p>
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ float: "left", marginRight: "2.5rem", marginBottom: "0.5rem", maxWidth: "44%" }}>
                {imageUrl ? (
                  <img src={imageUrl} alt={painting.title}
                    className="h-auto object-contain" style={{ maxHeight: "46vh", width: "100%" }} draggable={false}
                    onLoad={(e) => setPaintingAspect(e.currentTarget.naturalHeight / (e.currentTarget.naturalWidth || 1))} />
                ) : (
                  <div className="bg-warmgray flex items-center justify-center" style={{ height: "36vh", width: "100%" }}>
                    <span className="font-serif italic text-black/40 text-xs text-center px-3">Image rights restricted</span>
                  </div>
                )}
                <p className="font-sans text-charcoal font-medium mt-2 text-left w-full" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.artist}</p>
                <p className="font-serif italic text-charcoal text-left w-full" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.title}</p>
                <p className="font-sans text-charcoal/55 text-left w-full" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[painting.year, painting.collection].filter(Boolean).join(", ")}</p>
              </div>
              {painting.connection_claim && (
                <p className="font-serif italic text-charcoal/80 leading-relaxed text-left mb-5" style={{ fontSize: "clamp(14px, 1.1vw, 18px)", textWrap: "pretty" }}>
                  {painting.connection_claim}
                </p>
              )}
              {painting.citation_url && (
                <a href={painting.citation_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-sans text-black/60 hover:text-black transition-colors"
                  style={{ fontSize: "0.82rem", borderBottom: "1px solid rgba(0,0,0,0.25)", paddingBottom: 1 }}
                  onClick={(e) => e.stopPropagation()}>
                  Learn more
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6h8M6 2l4 4-4 4" /></svg>
                </a>
              )}
            </div>
          </>
        ) : (
          /* ── Loading / fallback: Monet top, influenced + description stacked ── */
          <>
            <div className="flex flex-col items-start gap-1.5 mb-10">
              {monetImageUrl ? (
                <img src={monetImageUrl} alt={monetEntry?.title || "Monet, Water Lilies"}
                  className="w-full h-auto object-contain" style={{ maxHeight: "34vh" }} draggable={false}
                  />
              ) : (
                <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "28vh" }}>
                  <span className="font-serif italic text-black/40 text-xs text-center px-3">Monet, Water Lilies</span>
                </div>
              )}
              <p className="font-sans text-charcoal font-medium mt-2 text-left" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>Claude Monet</p>
              <p className="font-serif italic text-charcoal text-left" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{monetEntry?.title || "Water Lilies"}</p>
              <p className="font-sans text-charcoal/55 text-left" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[monetEntry?.year, monetEntry?.collection].filter(Boolean).join(", ")}</p>
            </div>
            <div className="flex flex-col items-start gap-1.5 mb-8">
              {imageUrl ? (
                <img src={imageUrl} alt={painting.title}
                  className="w-full h-auto object-contain" style={{ maxHeight: "34vh" }} draggable={false}
                  onLoad={(e) => setPaintingAspect(e.currentTarget.naturalHeight / (e.currentTarget.naturalWidth || 1))} />
              ) : (
                <div className="w-full bg-warmgray flex items-center justify-center" style={{ height: "28vh" }}>
                  <span className="font-serif italic text-black/40 text-xs text-center px-3">Image rights restricted</span>
                </div>
              )}
              <p className="font-sans text-charcoal font-medium mt-2 text-left" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.artist}</p>
              <p className="font-serif italic text-charcoal text-left" style={{ fontSize: "clamp(13px, 1vw, 16px)" }}>{painting.title}</p>
              <p className="font-sans text-charcoal/55 text-left" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>{[painting.year, painting.collection].filter(Boolean).join(", ")}</p>
            </div>
            <div className="flex flex-col gap-4">
              {painting.connection_claim && (
                <p className="font-serif italic text-charcoal/80 leading-relaxed text-left" style={{ fontSize: "clamp(14px, 1.1vw, 18px)", textWrap: "pretty" }}>
                  {painting.connection_claim}
                </p>
              )}
              {painting.citation_url && (
                <a href={painting.citation_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-sans text-black/60 hover:text-black transition-colors w-fit"
                  style={{ fontSize: "0.82rem", borderBottom: "1px solid rgba(0,0,0,0.25)", paddingBottom: 1 }}
                  onClick={(e) => e.stopPropagation()}>
                  Learn more
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6h8M6 2l4 4-4 4" /></svg>
                </a>
              )}
            </div>
          </>
        )}
        </div>

        {/* ── Vertical divider ── */}
        <div
          aria-hidden="true"
          className="flex-shrink-0 self-stretch"
          style={{ width: 1, background: "rgba(0,0,0,0.12)" }}
        />

        {/* ── Right section: reader quotes + input at bottom ── */}
        <div
          className="flex flex-col min-h-0 h-full flex-shrink-0"
          style={{ width: "20%" }}
        >
          <div
            ref={quotesScrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-5 pt-16 pb-4"
          >
            {quotes.length > 0 && (
              <div className="space-y-3">
                <QuotesList
                  quotes={quotes}
                  editing={editingQuotes}
                  onDelete={removeQuote}
                  compact
                />
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-t border-charcoal/12 px-5 pt-4 pb-6">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <QuotePill
                  text={quoteText}
                  onChange={setQuoteText}
                  onSubmit={handleQuoteSubmit}
                  autoFocus
                  maxRows={5}
                />
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTyping) {
                    handleQuoteSubmit();
                  } else {
                    setEditingQuotes((v) => !v);
                  }
                }}
                aria-label={isTyping ? "Submit response" : editingQuotes ? "Done editing" : "Edit responses"}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-charcoal text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors flex-shrink-0"
              >
                {isTyping ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 10 4 15 9 20" />
                    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-transparent hover:bg-black/10 active:bg-black/16 text-black transition-colors duration-150"
        aria-label="Close"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

// Reader-submitted quotes for a single painting, persisted to localStorage.
// Returns the current quotes array along with `addQuote(text)` and
// `removeQuote(ts)` writers so the sticky pill input, the inline quotes
// list, and the editing controls stay in sync.
function useQuotes(paintingId) {
  const STORAGE_KEY = `monet:quotes:${paintingId}`;
  const [quotes, setQuotes] = useState(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode / quota — ignore */
      }
    },
    [STORAGE_KEY]
  );

  const addQuote = useCallback(
    (rawText) => {
      const text = (rawText || "").trim();
      if (!text) return;
      setQuotes((prev) => {
        const next = [...prev, { text, ts: Date.now() }];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeQuote = useCallback(
    (ts) => {
      setQuotes((prev) => {
        const next = prev.filter((q) => q.ts !== ts);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { quotes, addQuote, removeQuote };
}

// Renders submitted quotes as Inter-bold pull quotes with curly quotation
// marks. The sidebar (`compact`) uses Libre Baskerville at 16pt+ on desktop.
// When `editing` is true, a small delete button appears beside each quote.
function QuotesList({ quotes, editing = false, onDelete, centered = false, compact = false }) {
  if (!quotes.length) return null;
  const defaultStyle = {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: "clamp(24px, 2vw, 36px)",
    lineHeight: 1.25,
    color: "#111",
    textWrap: "pretty",
    textAlign: centered ? "center" : "left",
    flex: centered ? "0 1 auto" : 1,
  };

  return (
    <ul className={compact ? "flex flex-col gap-4" : "flex flex-col gap-4"}>
      {quotes.map((q, i) => (
        <li
          key={`${q.ts}-${i}`}
          className={`relative flex gap-2 ${
            compact
              ? "items-start"
              : `items-center ${centered ? "justify-center" : ""}`
          }`}
        >
          {compact ? (
            <p className="min-w-0 flex-1 text-pretty text-left text-[#111] font-serif font-normal text-sm leading-[1.45] md:text-[16pt]">
              &ldquo;{q.text}&rdquo;
            </p>
          ) : (
            <p style={defaultStyle}>
              &ldquo;{q.text}&rdquo;
            </p>
          )}
          {editing && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(q.ts);
              }}
              aria-label="Remove quote"
              className={`flex-shrink-0 flex items-center justify-center rounded-full bg-charcoal/10 hover:bg-charcoal/25 text-charcoal/70 hover:text-charcoal transition-colors w-6 h-6 ${
                compact ? "mt-[0.35em]" : ""
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// Large pill-shaped prompt anchored to the bottom of the overlay viewport.
// Controlled: text/onChange are managed by the parent. Press Enter to
// submit (Shift+Enter inserts a newline); empty submissions are ignored.
function QuotePill({ text, onChange, onSubmit, autoFocus = false, maxRows = null }) {
  const ref = useRef(null);
  const fontSize = 13;
  const lineHeight = 1.45;
  const paddingV = 14;
  const paddingH = 14;
  const cappedHeight = maxRows
    ? Math.ceil(fontSize * lineHeight * maxRows + paddingV * 2)
    : null;

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      value={text}
      rows={maxRows ?? 1}
      placeholder="What commonalities do you see between Monet's work and this piece?"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-stone border border-charcoal/70 text-charcoal placeholder-charcoal/40 focus:outline-none focus:border-charcoal transition-colors resize-none"
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 400,
        fontSize,
        lineHeight,
        padding: `${paddingV}px ${paddingH}px`,
        borderRadius: 10,
        boxShadow: "0 6px 20px rgba(0,0,0,0.10)",
        height: cappedHeight ? `${cappedHeight}px` : undefined,
        maxHeight: cappedHeight ? `${cappedHeight}px` : "55vh",
        overflowY: "auto",
      }}
    />
  );
}
