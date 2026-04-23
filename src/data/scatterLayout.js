// Vertical layout for the East Meets West right column.
//
// The right side of the screen is a natively scrolling column. The
// blocks below render top-to-bottom in a flex column. `align` flips
// each block left or right to keep the scattered, gallery-wall feel.
//
// • Blocks WITH a `textIndex` also render a pink water-lily trigger
//   and an info block — placed OPPOSITE the print so the revealed
//   text never overlaps the print.
// • Blocks WITHOUT a `textIndex` are decorative — print only.
//
// Left/right alignment strictly alternates so the column zig-zags.
//
// The three user-specified pairings are locked in place:
//   J1 → textIndex 0  (Japanese-style bridge, 1895)
//   J5 → textIndex 1  (bridge cropped off both edges)
//   J6 → textIndex 2  (flat stacked perspective)
// The three restored pairings fill the remaining slots:
//   J3 → textIndex 3  (231 woodblock prints)
//   J4 → textIndex 4  (mono no aware)
//   J8 → textIndex 5  (saturated, unblended color)
export const PRINT_BLOCKS = [
  { id: "J1", textIndex: 0, align: "left" },
  { id: "J2", align: "right" },
  { id: "J3", textIndex: 3, align: "left" },
  { id: "J4", textIndex: 4, align: "right" },
  { id: "J5", textIndex: 1, align: "left" },
  { id: "J7", align: "right" },
  { id: "J8", textIndex: 5, align: "left" },
  { id: "J9", align: "right" },
  { id: "J6", textIndex: 2, align: "left" },
];
