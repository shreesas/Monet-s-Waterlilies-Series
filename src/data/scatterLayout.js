// Vertical layout for the East Meets West right column.
//
// The right side of the screen (everything to the right of the Monet
// painting + its glass strip) is now a NATIVELY scrolling column. The
// blocks below render top-to-bottom in a flex column. `align` flips
// each block to the left or right side of that column to keep the
// scattered, gallery-wall feel without the user having to hand-pan a
// horizontal canvas.
//
// • Blocks WITH a `textIndex` also render a pink water-lily trigger
//   underneath the print and an info block beneath the lily.
// • Blocks WITHOUT a `textIndex` are decorative — print only.
//
// Order matters: the user scrolls through them in this order.
export const PRINT_BLOCKS = [
  { id: "J6", textIndex: 0, align: "left" },
  { id: "J9", align: "right" },
  { id: "J1", align: "left" },
  { id: "J7", textIndex: 1, align: "right" },
  { id: "J4", textIndex: 2, align: "left" },
  { id: "J3", textIndex: 3, align: "right" },
  { id: "J5", textIndex: 4, align: "left" },
  { id: "J8", textIndex: 5, align: "right" },
  { id: "J2", align: "left" },
];
