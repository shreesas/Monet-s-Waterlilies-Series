import { useState, useEffect, useCallback, useMemo, useRef } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";

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

const STRENGTH_ORDER = ["direct", "documented", "critical"];

// Elliptical radii as fraction of viewport dimensions (wider x for horizontal spread)
// Slightly large so 13+ nodes on the outer ring can be separated without overlapping.
const RING_X_FRAC = [0.2, 0.33, 0.48];
const RING_Y_FRAC = [0.16, 0.26, 0.4];

// 36° offset per ring — staggers nodes so adjacent rings never align on the same spoke
const RING_ANGLE_OFFSET = Math.PI / 5;

// Max painting thumbnail size per ring. Outer ring is narrower to guarantee
// no two adjacent paintings touch even when both are at max width.
const NODE_MAX_H = [104, 90, 78];
const NODE_MAX_W = [190, 170, 136];

// Monet center node radius (half of 120px circle)
const MONET_R = 60;

const HUB_COLORS = {
  direct: "rgba(212,184,132,0.95)",
  documented: "rgba(90,65,40,0.55)",
  critical: "rgba(45,45,45,0.32)",
};
const HUB_WIDTHS = { direct: 3.5, documented: 2.5, critical: 1.5 };

const RING_DASH = { direct: "3 5", documented: "3 7", critical: "2 9" };
const RING_STROKE = {
  direct: "rgba(212,184,132,0.3)",
  documented: "rgba(45,45,45,0.12)",
  critical: "rgba(45,45,45,0.08)",
};

const STRENGTH_LABELS = {
  direct: "Artist stated",
  documented: "Archivally documented",
  critical: "Critical link",
};

// Ray: rim point on (cx,cy) + hubRimT * d̂, direction d̂ = normalize(target - hub).
// First forward intersection (smallest t > 0) with the AABB, so the spoke matches
// the line from the hub to the work — edge-midpoint shortcuts break that and read
// as lines ending in empty space.
function rayFromHubToImageBox(cx, cy, hubRimT, targetCx, targetCy, w, h) {
  if (w <= 0 || h <= 0) return { x: targetCx, y: targetCy };
  const dx = targetCx - cx;
  const dy = targetCy - cy;
  const len = Math.hypot(dx, dy) || 1e-9;
  const ux = dx / len;
  const uy = dy / len;
  const ox = cx + ux * hubRimT;
  const oy = cy + uy * hubRimT;
  const left = targetCx - w / 2;
  const right = targetCx + w / 2;
  const top = targetCy - h / 2;
  const bottom = targetCy + h / 2;
  const EPS = 1e-5;

  let tHit = Infinity;
  if (Math.abs(ux) > EPS) {
    for (const vx of [left, right]) {
      const s = (vx - ox) / ux;
      if (s <= EPS) continue;
      const yAt = oy + s * uy;
      if (yAt + EPS >= top && yAt - EPS <= bottom) tHit = Math.min(tHit, s);
    }
  }
  if (Math.abs(uy) > EPS) {
    for (const hy of [top, bottom]) {
      const s = (hy - oy) / uy;
      if (s <= EPS) continue;
      const xAt = ox + s * ux;
      if (xAt + EPS >= left && xAt - EPS <= right) tHit = Math.min(tHit, s);
    }
  }

  if (tHit === Infinity) {
    return { x: targetCx, y: targetCy };
  }
  return { x: ox + ux * tHit, y: oy + uy * tHit };
}

function separateOverlappingNodes(rawNodes) {
  const n = rawNodes.length;
  if (n < 2) return rawNodes;
  const items = rawNodes.map((node) => {
    const w = NODE_MAX_W[node.ringIndex];
    const h = NODE_MAX_H[node.ringIndex];
    const r = 0.5 * Math.hypot(w, h) + 4;
    return { node, r, x: node.x, y: node.y };
  });
  const pad = 6;
  for (let it = 0; it < 160; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const need = a.r + b.r + pad;
        if (d >= need) continue;
        const push = 0.5 * (need - d);
        const k = push / d;
        const mx = (dx * k) / 2;
        const my = (dy * k) / 2;
        a.x -= mx;
        a.y -= my;
        b.x += mx;
        b.y += my;
      }
    }
  }
  return items.map((it) => ({ ...it.node, x: it.x, y: it.y }));
}

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
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  // Actual rendered pixel sizes keyed by painting id — populated as images load.
  // Used to terminate spoke lines at the real painting edge, not the max bounding box.
  const [imageSizes, setImageSizes] = useState({});
  const wasDragging = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch("/monet_influenced_paintings.json").then((r) => r.json()),
      fetch("/water_lilies_catalog.json").then((r) => r.json()),
    ])
      .then(([influenced, monet]) => {
        setPaintings(influenced.paintings || []);
        setCatalog(Array.isArray(monet) ? monet : []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const onResize = () =>
      setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Graph is laid out in viewport coordinates — no oversized canvas needed
  const CCX = dims.w / 2;
  const CCY = dims.h / 2;

  const centerMonet = useMemo(
    () =>
      catalog.find((c) => c.catalog_number === "W.1973") ||
      catalog.find((c) => c.image_url) ||
      null,
    [catalog]
  );

  const groups = useMemo(
    () => ({
      direct: paintings.filter((p) => p.connection_strength === "direct"),
      documented: paintings.filter((p) => p.connection_strength === "documented"),
      critical: paintings.filter((p) => p.connection_strength === "critical"),
    }),
    [paintings]
  );

  const rawNodes = useMemo(() => {
    return STRENGTH_ORDER.flatMap((strength, ringIndex) => {
      const group = groups[strength] || [];
      if (!group.length) return [];
      const xR = RING_X_FRAC[ringIndex] * dims.w;
      const yR = RING_Y_FRAC[ringIndex] * dims.h;
      // Each ring is rotated 36° more than the previous so nodes never
      // stack directly on top of cross-ring neighbours.
      const startAngle = -Math.PI / 2 + ringIndex * RING_ANGLE_OFFSET;
      return group.map((painting, i) => {
        const angle = startAngle + (i / group.length) * 2 * Math.PI;
        const x = CCX + Math.cos(angle) * xR;
        const y = CCY + Math.sin(angle) * yR;
        return {
          painting,
          x,
          y,
          strength,
          ringIndex,
          imageUrl: resolveImageUrl(painting.image_url),
        };
      });
    });
  }, [groups, dims, CCX, CCY]);

  const nodes = useMemo(
    () => separateOverlappingNodes(rawNodes),
    [rawNodes]
  );

  // Drag constraints — only non-zero when a painting bleeds past the viewport
  // edge. This disables panning entirely when the graph fits on screen.
  const dragConstraints = useMemo(() => {
    if (!nodes.length) return { left: 0, right: 0, top: 0, bottom: 0 };
    const HEADER = 90; // header height reserve
    const PAD = 20;
    const minX = Math.min(...nodes.map((n) => n.x - NODE_MAX_W[n.ringIndex] / 2)) - PAD;
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_MAX_W[n.ringIndex] / 2)) + PAD;
    const minY = Math.min(...nodes.map((n) => n.y - NODE_MAX_H[n.ringIndex] / 2)) - HEADER;
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_MAX_H[n.ringIndex] / 2)) + PAD;
    return {
      right: minX < 0 ? -minX : 0,
      left: maxX > dims.w ? dims.w - maxX : 0,
      bottom: minY < 0 ? -minY : 0,
      top: maxY > dims.h ? dims.h - maxY : 0,
    };
  }, [nodes, dims]);

  const canDrag =
    dragConstraints.left !== 0 ||
    dragConstraints.right !== 0 ||
    dragConstraints.top !== 0 ||
    dragConstraints.bottom !== 0;

  // Record the actual rendered size of each image so spoke lines terminate
  // at the real painting edge rather than the max bounding box.
  const handleImageLoad = useCallback((paintingId, ringIndex, e) => {
    const img = e.target;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return;
    const maxW = NODE_MAX_W[ringIndex];
    const maxH = NODE_MAX_H[ringIndex];
    const scale = Math.min(1, maxW / natW, maxH / natH);
    setImageSizes((prev) => ({
      ...prev,
      [paintingId]: { w: Math.round(natW * scale), h: Math.round(natH * scale) },
    }));
  }, []);

  const handleSelectNode = useCallback(
    (node) => {
      if (wasDragging.current) return;
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
      {/* ── Fixed header ── */}
      <div className="fixed top-0 left-0 right-0 z-30 flex flex-col items-center pt-5 pointer-events-none">
        <h2
          className="font-serif italic text-charcoal text-center"
          style={{ fontSize: "clamp(0.95rem, 1.55vw, 1.35rem)" }}
        >
          Water Lilies: A Chain of Influence
        </h2>
        <p
          className="font-sans text-charcoal/45 mt-1 text-center"
          style={{ fontSize: "clamp(0.62rem, 0.82vw, 0.78rem)" }}
        >
          {canDrag
            ? "Closer paintings share stronger connections · drag to explore · click to learn"
            : "Closer paintings share stronger connections · click to learn"}
        </p>
      </div>

      {/* ── Scene: draggable only when content overflows ── */}
      <motion.div
        drag={canDrag || undefined}
        dragMomentum
        dragElastic={0.06}
        dragConstraints={dragConstraints}
        dragTransition={{ power: 0.35, timeConstant: 280 }}
        onDragStart={() => {
          wasDragging.current = true;
        }}
        onDragEnd={() => {
          setTimeout(() => {
            wasDragging.current = false;
          }, 60);
        }}
        style={{
          width: dims.w,
          height: dims.h,
          position: "absolute",
          left: 0,
          top: 0,
          cursor: canDrag ? "grab" : "default",
        }}
        whileDrag={{ cursor: "grabbing" }}
      >
        {/* ── SVG: orbit rings + spokes ── */}
        <svg
          style={{
            position: "absolute",
            width: dims.w,
            height: dims.h,
            top: 0,
            left: 0,
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          {/* Dashed elliptical orbit guides */}
          {STRENGTH_ORDER.map((strength, ringIndex) => (
            <ellipse
              key={`ring-${strength}`}
              cx={CCX}
              cy={CCY}
              rx={RING_X_FRAC[ringIndex] * dims.w}
              ry={RING_Y_FRAC[ringIndex] * dims.h}
              fill="none"
              stroke={RING_STROKE[strength]}
              strokeWidth={1}
              strokeDasharray={RING_DASH[strength]}
            />
          ))}

          {/* Spokes: Monet circle edge → first hit on the painting’s AABB (radial
              to the work). Uses measured size from onLoad. */}
          {nodes.map(({ painting, x, y, strength, ringIndex, imageUrl }) => {
            const angle = Math.atan2(y - CCY, x - CCX);
            const x1 = CCX + Math.cos(angle) * MONET_R;
            const y1 = CCY + Math.sin(angle) * MONET_R;
            const size =
              imageSizes[painting.id] ??
              (imageUrl
                ? { w: NODE_MAX_W[ringIndex], h: NODE_MAX_H[ringIndex] }
                : {
                    w: NODE_MAX_W[ringIndex] * 0.6,
                    h: NODE_MAX_H[ringIndex],
                  });
            const ep = rayFromHubToImageBox(CCX, CCY, MONET_R, x, y, size.w, size.h);
            return (
              <line
                key={painting.id + "-spoke"}
                x1={x1}
                y1={y1}
                x2={ep.x}
                y2={ep.y}
                stroke={HUB_COLORS[strength]}
                strokeWidth={HUB_WIDTHS[strength]}
              />
            );
          })}
        </svg>

        {/* ── Monet center node ── */}
        <div
          style={{
            position: "absolute",
            left: CCX,
            top: CCY,
            transform: "translate(-50%, -50%)",
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: MONET_R * 2,
              height: MONET_R * 2,
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow:
                "0 0 0 3px rgba(212,184,132,0.9), 0 0 0 7px rgba(212,184,132,0.22), 0 10px 32px rgba(0,0,0,0.25)",
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
            style={{ fontSize: "0.68rem", width: 134, marginLeft: -7, lineHeight: 1.3 }}
          >
            Monet, <em>Water Lilies</em>
          </p>
        </div>

        {/* ── Painting nodes ── */}
        {nodes.map(({ painting, x, y, ringIndex, imageUrl, strength }, idx) => (
          <motion.button
            key={painting.id}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.15 + idx * 0.04,
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              zIndex: 20,
            }}
            className="group"
            onClick={() =>
              handleSelectNode({ painting, x, y, strength, ringIndex, imageUrl })
            }
            aria-label={`${painting.title} by ${painting.artist}`}
          >
            <motion.div
              whileHover={{ scale: 1.13 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "inline-block" }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={painting.title}
                  draggable={false}
                  onLoad={(e) => handleImageLoad(painting.id, ringIndex, e)}
                  style={{
                    display: "block",
                    maxHeight: NODE_MAX_H[ringIndex],
                    maxWidth: NODE_MAX_W[ringIndex],
                    width: "auto",
                    height: "auto",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
                  }}
                />
              ) : (
                <div
                  className="bg-warmgray flex items-center justify-center"
                  style={{
                    width: NODE_MAX_W[ringIndex] * 0.6,
                    height: NODE_MAX_H[ringIndex],
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  }}
                >
                  <span
                    className="font-sans text-charcoal/50 text-center leading-tight px-1"
                    style={{ fontSize: 8 }}
                  >
                    {painting.artist.split(" ").slice(-1)[0]}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Hover label */}
            <div
              className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap"
              style={{ bottom: -22, zIndex: 30 }}
            >
              <span
                className="font-sans text-charcoal bg-white/95 px-2 py-0.5 rounded-full shadow-sm"
                style={{ fontSize: "0.63rem" }}
              >
                {painting.artist}
              </span>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* ── Fixed legend ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="fixed bottom-6 left-6 z-30 flex flex-col gap-2 pointer-events-none"
      >
        {STRENGTH_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-2.5">
            <svg width="30" height="10" style={{ flexShrink: 0 }}>
              <line
                x1="0"
                y1="5"
                x2="30"
                y2="5"
                stroke={
                  s === "direct"
                    ? "rgba(212,184,132,1)"
                    : s === "documented"
                      ? "rgba(90,65,40,0.65)"
                      : "rgba(45,45,45,0.4)"
                }
                strokeWidth={HUB_WIDTHS[s]}
              />
            </svg>
            <span className="font-sans text-charcoal/52" style={{ fontSize: "0.63rem" }}>
              {STRENGTH_LABELS[s]}
            </span>
          </div>
        ))}
      </motion.div>

      {/* ── Back navigation ── */}
      <a
        href="#/east-meets-west"
        className="fixed bottom-6 right-6 z-30 rounded-full bg-charcoal text-cream font-sans text-sm px-5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-charcoal/85 transition-colors"
      >
        ← East Meets West
      </a>

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

  const metaRows = [
    { label: "Artist", value: painting.artist },
    { label: "Date", value: painting.year },
    { label: "Collection", value: painting.collection },
  ].filter((r) => r.value);

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
        style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col xl:flex-row items-center xl:items-end gap-6 xl:gap-10 max-w-[95vw] max-h-[90vh] overflow-y-auto xl:overflow-visible px-4 xl:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Side-by-side images */}
        <div className="flex flex-row items-end gap-5 xl:gap-7 flex-shrink-0">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-end justify-center" style={{ height: "clamp(150px, 34vh, 310px)" }}>
              {monetImageUrl ? (
                <img
                  src={monetImageUrl}
                  alt={monetEntry?.title || "Monet, Water Lilies"}
                  className="block max-h-full w-auto h-auto object-contain museum-frame-lightbox"
                  style={{ maxWidth: "clamp(130px, 28vw, 280px)" }}
                  draggable={false}
                />
              ) : (
                <div className="museum-frame-lightbox bg-warmgray flex items-center justify-center" style={{ width: 180, height: "clamp(130px, 26vh, 240px)" }}>
                  <span className="font-serif italic text-charcoal/50 text-xs text-center px-3">Monet, Water Lilies</span>
                </div>
              )}
            </div>
            <p className="font-serif italic text-white/55 text-center" style={{ fontSize: "clamp(0.6rem, 0.75vw, 0.72rem)", maxWidth: 200, lineHeight: 1.35 }}>
              Monet, <em>{monetEntry?.title || "Water Lilies"}</em>
              {monetEntry?.year && <span className="text-white/38">, {monetEntry.year}</span>}
            </p>
          </div>

          <div className="self-stretch hidden md:block" style={{ width: 1, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-end justify-center" style={{ height: "clamp(150px, 34vh, 310px)" }}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={painting.title}
                  className="block max-h-full w-auto h-auto object-contain museum-frame-lightbox"
                  style={{ maxWidth: "clamp(130px, 28vw, 280px)" }}
                  draggable={false}
                />
              ) : (
                <div className="museum-frame-lightbox bg-warmgray flex items-center justify-center" style={{ width: 180, height: "clamp(130px, 26vh, 240px)" }}>
                  <span className="font-serif italic text-charcoal/50 text-xs text-center px-3">Image rights restricted</span>
                </div>
              )}
            </div>
            <p className="font-serif italic text-white/55 text-center" style={{ fontSize: "clamp(0.6rem, 0.75vw, 0.72rem)", maxWidth: 200, lineHeight: 1.35 }}>
              {painting.artist}, <em>{painting.title}</em>
              {painting.year && <span className="text-white/38">, {painting.year}</span>}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="text-white flex flex-col gap-4 xl:max-w-xs xl:pb-3 w-full xl:w-auto">
          <div>
            <h3 className="font-serif italic text-white leading-snug" style={{ fontSize: "clamp(1rem, 1.6vw, 1.35rem)" }}>
              {painting.title}
            </h3>
            <dl className="mt-3 space-y-1.5">
              {metaRows.map((r) => (
                <div key={r.label} className="flex gap-2">
                  <dt className="font-sans text-neutral-400 uppercase tracking-wider text-xs whitespace-nowrap pt-0.5" style={{ minWidth: "5rem" }}>
                    {r.label}
                  </dt>
                  <dd className="font-sans text-neutral-200" style={{ fontSize: "clamp(0.78rem, 0.95vw, 0.875rem)" }}>
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {painting.connection_claim && (
            <div>
              <p className="font-sans text-neutral-400 uppercase tracking-wider mb-1.5" style={{ fontSize: "0.62rem" }}>
                Connection
              </p>
              <div className="overflow-y-auto pr-1" style={{ maxHeight: "clamp(80px, 17vh, 180px)", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.18) transparent" }}>
                <p className="font-sans text-neutral-300 leading-relaxed" style={{ fontSize: "clamp(0.73rem, 0.9vw, 0.82rem)", textWrap: "pretty" }}>
                  {painting.connection_claim}
                </p>
              </div>
            </div>
          )}

          {painting.citation_url && (
            <a
              href={painting.citation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-sans text-cream/70 hover:text-cream transition-colors w-fit"
              style={{ fontSize: "clamp(0.72rem, 0.88vw, 0.82rem)", borderBottom: "1px solid rgba(255,248,240,0.3)", paddingBottom: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "rgba(255,248,240,0.65)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "rgba(255,248,240,0.3)")}
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

      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}
