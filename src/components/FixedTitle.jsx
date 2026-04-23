// Subtitle block — pinned to the top of the viewport, centred over
// the white left-side panel. The h1 title has been removed; only the
// "Collect" prompt remains, set in Libre Baskerville.
export default function FixedTitle({ containerWidth = "50vw" }) {
  return (
    <div
      className="fixed top-0 left-0 z-30 pt-5 md:pt-6 pb-2 pointer-events-none select-none text-center"
      style={{ width: containerWidth }}
    >
      <p
        className="font-serif text-charcoal/85 leading-snug"
        style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.25rem)" }}
      >
        Collect the 6 pink <em>Water lilies</em> from the pond.
      </p>
    </div>
  );
}
