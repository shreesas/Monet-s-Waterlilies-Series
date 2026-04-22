// Title block — pinned to the top of the viewport, centred horizontally
// over the white left-side panel that holds the painting. The parent
// passes `containerWidth` so the title block spans the same area as
// the white background and centres above the painting.
export default function FixedTitle({ containerWidth = "50vw" }) {
  return (
    <div
      className="fixed top-0 left-0 z-30 pt-5 md:pt-6 pb-2 pointer-events-none select-none text-center"
      style={{ width: containerWidth }}
    >
      <h1
        className="font-serif text-charcoal leading-[1.05]"
        style={{ fontSize: "clamp(1.75rem, 2.6vw, 2.75rem)" }}
      >
        How <span className="italic">ukiyo-e</span> shaped Monet&apos;s garden
      </h1>
      <p
        className="mt-2 font-sans text-charcoal/85 leading-snug"
        style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.4rem)" }}
      >
        Collect the 6 pink water lilies from the pond.
      </p>
    </div>
  );
}
