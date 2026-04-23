// Vertical layout for the East Meets West right column.
//
// The right side of the screen (everything to the right of the Monet
// painting + its glass strip) is a NATIVELY scrolling column. The
// blocks below render top-to-bottom in a flex column. `align` flips
// each block to the left or right side of that column to keep the
// scattered, gallery-wall feel.
//
// • Blocks WITH a `textIndex` also render a pink water-lily trigger
//   and an info block — placed on the side OPPOSITE the print so
//   the revealed text never overlaps any print.
// • Blocks WITHOUT a `textIndex` are decorative — print only.
//
// Order matters: the user scrolls through them top-to-bottom. The
// three lily-bearing prints (J1, J5, J6) are positioned so their
// stories appear in the order defined by `INFO_BLOCKS`:
//   J1 → text 0 (Japanese-style bridge, 1895)
//   J5 → text 1 (bridge cropped off both edges)
//   J6 → text 2 (flat stacked perspective)
// Left/right alignment strictly alternates so the column zig-zags
// cleanly down the frame.
export const PRINT_BLOCKS = [
  { id: "J1", textIndex: 0, align: "left" },
  { id: "J2", align: "right" },
  { id: "J3", align: "left" },
  { id: "J4", align: "right" },
  { id: "J5", textIndex: 1, align: "left" },
  { id: "J7", align: "right" },
  { id: "J8", align: "left" },
  { id: "J9", align: "right" },
  { id: "J6", textIndex: 2, align: "left" },
];
