// Hand-tuned scatter coordinates for the East Meets West canvas.
//
// LAYOUT (post equal-gutter refactor):
// The painting fills a 40vw × 100vh slab on the left of the viewport.
// Every Japanese print lives in a single strip on the right ~60vw, on
// the canvas at columns 20% → 96% (9.5% spacing). The strip alternates
// top-row (top:30%) and bottom-row (top:72%) prints to keep the gallery
// scatter feel.
//
// Canvas multiplier is 2.5 on all viewports → canvas = 250vw, max
// pan offset = 150vw. Print half-width is min(13vh, 9vw) (half of
// printMaxSize), so:
//   • At slider 0:    first print J6 (canvas 20%) → viewport 50vw centre
//                     → left edge = 50vw − min(13vh, 9vw) ≈ 41vw
//                     → ~1vw gap to the painting's right edge (40vw)
//                     → MATCHES title and slider left edge exactly.
//   • At slider 1000: last print J2 (canvas 96%)  → viewport 90vw centre
//                     → right edge = 90vw + min(13vh, 9vw) ≈ 99vw
//                     → ~1vw gap to the viewport's right edge (100vw)
//                     → SAME gutter as the left side.
//
// Visible prints by slider (verified, ~3 prints visible at any time):
//   • s=0    → painting + J6 (20),   J9 (29.5), J1 (39)
//   • s=300  → J1 (39),   J7 (48.5), J4 (58)
//   • s=600  → J4 (58),   J3 (67.5), J5 (77)
//   • s=1000 → J5 (77),   J8 (86.5), J2 (96)
//
// Vertical anatomy (painting fills 100vh, prints unchanged):
//   • Top-row prints (top:30%):  y [17, 43]   (vert)
//   • Lilies for top-row prints (top:50%):    y [47, 53]
//   • Top-row text (top:55%, dy:+25): y [55, 63]
//   • Bot-row text (top:40%, dy:-32): y [40, 48]
//   • Lilies for bottom-row prints (top:54%): y [51, 57]
//   • Bottom-row prints (top:72%): y [59, 85]   (vert)
export const SCATTER = [
  // PRINTS — single right-side strip, 9.5% column spacing, alternating rows.
  { type: "print", id: "J6", top: "30%", left: "20%",   textIndex: 0 }, // top
  { type: "print", id: "J9", top: "72%", left: "29.5%" },                 // bot (no text)
  { type: "print", id: "J1", top: "30%", left: "39%" },                   // top (no text)
  { type: "print", id: "J7", top: "72%", left: "48.5%", textIndex: 1 }, // bot
  { type: "print", id: "J4", top: "30%", left: "58%",   textIndex: 2 }, // top
  { type: "print", id: "J3", top: "72%", left: "67.5%", textIndex: 3 }, // bot
  { type: "print", id: "J5", top: "30%", left: "77%",   textIndex: 4 }, // top
  { type: "print", id: "J8", top: "72%", left: "86.5%", textIndex: 5 }, // bot
  { type: "print", id: "J2", top: "30%", left: "96%" },                   // top (no text)

  // LILIES — sit BELOW their top-row prints (top:50%) or ABOVE their
  // bottom-row prints (top:54%). Always centred on the host print's column.
  { type: "lily", id: 0, top: "50%", left: "20%",   textIndex: 0 }, // below J6
  { type: "lily", id: 1, top: "54%", left: "48.5%", textIndex: 1 }, // above J7
  { type: "lily", id: 2, top: "50%", left: "58%",   textIndex: 2 }, // below J4
  { type: "lily", id: 3, top: "54%", left: "67.5%", textIndex: 3 }, // above J3
  { type: "lily", id: 4, top: "50%", left: "77%",   textIndex: 4 }, // below J5
  { type: "lily", id: 5, top: "54%", left: "86.5%", textIndex: 5 }, // above J8
];

// Text offsets relative to the print that owns the textIndex.
export const INFO_OFFSETS = {
  0: { dx: 0, dy: 25 },   // J6 top → text below lily, at left:20%,   top:55%
  1: { dx: 0, dy: -32 },  // J7 bot → text above lily, at left:48.5%, top:40%
  2: { dx: 0, dy: 25 },   // J4 top → text below lily, at left:58%,   top:55%
  3: { dx: 0, dy: -32 },  // J3 bot → text above lily, at left:67.5%, top:40%
  4: { dx: 0, dy: 25 },   // J5 top → text below lily, at left:77%,   top:55%
  5: { dx: 0, dy: -32 },  // J8 bot → text above lily, at left:86.5%, top:40%
};
