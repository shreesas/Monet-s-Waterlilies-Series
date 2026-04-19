// Title block — pinned to the TOP of the viewport, LEFT-ALIGNED to the
// exact left edge of the first print. The first print (J6) is centred at
// canvas 20% → viewport 50vw at slider 0, and its half-width is
// `min(13vh, 9vw)` (half of the printMaxSize cap). So the title's left
// edge sits at `calc(50vw - min(13vh, 9vw))`, matching the print's left
// edge pixel-for-pixel across all viewport ratios. Stays fixed as the
// slider pans.
export default function FixedTitle() {
  return (
    <div
      className="fixed top-0 right-4 md:right-8 z-30 pt-5 md:pt-6 pb-2 pointer-events-none select-none text-left"
      style={{ left: "calc(50vw - min(13vh, 9vw))" }}
    >
      <h1
        className="font-serif text-charcoal leading-[1.1]"
        style={{ fontSize: "clamp(1.25rem, 2.4vw, 2.5rem)" }}
      >
        How <span className="italic">ukiyo-e</span> prints shaped Monet&apos;s garden
      </h1>
      <p
        className="mt-2 font-sans text-charcoal/85 leading-snug"
        style={{ fontSize: "clamp(1.05rem, 1.8vw, 1.5rem)" }}
      >
        Collect the 6 pink water lilies from the pond.
      </p>
    </div>
  );
}
