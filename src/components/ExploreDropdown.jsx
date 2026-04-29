import { useState } from "react";

const PAGES = [
  { label: "Homepage", href: "#/" },
  { label: "East Meets West", href: "#/east-meets-west" },
  { label: "Influence Map V1", href: "#/water-lilies-influence" },
  { label: "Influence Map V2", href: "#/water-lilies-influence-polaroid" },
];

const R_INNER = 75;
const R_OUTER = 300;
const TRIGGER_R = 70;
const SLICE = 90 / PAGES.length; // 22.5° per page

function toRad(deg) { return (deg * Math.PI) / 180; }

function polarXY(cx, cy, r, deg) {
  return [cx + r * Math.cos(toRad(deg)), cy + r * Math.sin(toRad(deg))];
}

function sectorPath(cx, cy, rIn, rOut, a0, a1) {
  const [x1, y1] = polarXY(cx, cy, rIn, a0);
  const [x2, y2] = polarXY(cx, cy, rOut, a0);
  const [x3, y3] = polarXY(cx, cy, rOut, a1);
  const [x4, y4] = polarXY(cx, cy, rIn, a1);
  const lg = a1 - a0 > 180 ? 1 : 0;
  return `M${x1},${y1} L${x2},${y2} A${rOut},${rOut},0,${lg},1,${x3},${y3} L${x4},${y4} A${rIn},${rIn},0,${lg},0,${x1},${y1}Z`;
}

export default function ExploreDropdown({ currentPage }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);

  // Arc centre sits at the top-right corner of the SVG
  const CX = R_OUTER + 2;
  const CY = 0;
  const SVG_W = R_OUTER + 2;
  const SVG_H = R_OUTER + 2;

  // Scale the fan from the corner point
  const scaleOrigin = `${CX}px ${CY}px`;
  const fanStyle = {
    transformOrigin: scaleOrigin,
    transform: open ? "scale(1)" : "scale(0.04)",
    opacity: open ? 1 : 0,
    transition: "transform 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
  };

  return (
    <div
      className="fixed top-0 right-0 z-40"
      style={{ width: SVG_W, height: SVG_H }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { setOpen(false); setHovered(null); }}
    >
      <svg width={SVG_W} height={SVG_H} style={{ overflow: "visible", display: "block" }}>

        {/* ── Fan slices (hidden until hover) ── */}
        <g style={fanStyle}>
          {PAGES.map(({ label, href }, i) => {
            const a0 = 90 + i * SLICE;
            const a1 = 90 + (i + 1) * SLICE;
            const aMid = (a0 + a1) / 2;
            const rMid = (R_INNER + R_OUTER) / 2;
            const [tx, ty] = polarXY(CX, CY, rMid, aMid);
            const isCurrent = currentPage === href;
            const isHov = hovered === href && !isCurrent;

            const sliceFill = isCurrent
              ? "rgba(210,210,210,0.93)"
              : isHov
              ? "rgba(60,60,60,0.96)"
              : "rgba(22,22,22,0.91)";

            return (
              <g
                key={href}
                onMouseEnter={() => !isCurrent && setHovered(href)}
                onMouseLeave={() => setHovered(null)}
                onClick={isCurrent ? undefined : () => { window.location.href = href; }}
                style={{ cursor: isCurrent ? "default" : "pointer" }}
              >
                {/* Dividing line before each slice */}
                {i > 0 && (() => {
                  const [lx1, ly1] = polarXY(CX, CY, R_INNER - 2, a0);
                  const [lx2, ly2] = polarXY(CX, CY, R_OUTER + 2, a0);
                  return (
                    <line
                      x1={lx1} y1={ly1} x2={lx2} y2={ly2}
                      stroke="white" strokeWidth={1.2} opacity={0.45}
                    />
                  );
                })()}

                <path
                  d={sectorPath(CX, CY, R_INNER, R_OUTER, a0, a1)}
                  fill={sliceFill}
                  style={{ transition: "fill 0.15s" }}
                />

                <text
                  x={tx} y={ty}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="12.5"
                  fontFamily="Inter, system-ui, sans-serif"
                  fill={isCurrent ? "rgba(0,0,0,0.38)" : "white"}
                  transform={`rotate(${aMid - 90}, ${tx}, ${ty})`}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Always-visible corner trigger (quarter-circle) ── */}
        <path
          d={sectorPath(CX, CY, 0, TRIGGER_R, 90, 180)}
          fill={open ? "rgba(215,215,215,0.95)" : "rgba(240,240,240,0.92)"}
          stroke="rgba(0,0,0,0.13)"
          strokeWidth={1}
          style={{ transition: "fill 0.2s" }}
        />
        {/* "Explore" label at centroid of the quarter-circle */}
        <text
          x={CX + TRIGGER_R * 0.60 * Math.cos(toRad(135))}
          y={TRIGGER_R * 0.60 * Math.sin(toRad(135))}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fontFamily="Inter, system-ui, sans-serif"
          fill="rgba(0,0,0,0.62)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          Explore
        </text>
      </svg>
    </div>
  );
}
