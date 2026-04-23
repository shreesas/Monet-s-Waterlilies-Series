// Vertical layout for the East Meets West right column.
//
// Blocks render top-to-bottom. `align` alternates left/right for a
// scattered, gallery-wall feel. Lily-bearing prints are ordered so
// the six stories are encountered in text order (0 → 5) as the user
// scrolls — with decorative-only prints interspersed as breathing room.
//
// User-specified pairings:
//   J1 → textIndex 0  (Japanese-style bridge, first painted 1895)
//   J5 → textIndex 1  (bridge cropped off both edges)
//   J6 → textIndex 3  (flat, stacked ukiyo-e perspective)
//
// Remaining pairings (story continues in scroll order):
//   J3 → textIndex 2  (same bridge, different light / mono no aware)
//   J4 → textIndex 4  (saturated unblended color patches)
//   J8 → textIndex 5  (pushed to the limit)
export const PRINT_BLOCKS = [
  { id: "J1", textIndex: 0, align: "left" },
  { id: "J2", align: "right" },
  { id: "J5", textIndex: 1, align: "left" },
  { id: "J3", textIndex: 2, align: "right" },
  { id: "J7", align: "left" },
  { id: "J6", textIndex: 3, align: "right" },
  { id: "J4", textIndex: 4, align: "left" },
  { id: "J9", align: "right" },
  { id: "J8", textIndex: 5, align: "left" },
];
