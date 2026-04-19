// Fixed bottom range slider that drives horizontal pan of the canvas.
// Its LEFT edge is computed the same way as FixedTitle's, so title,
// slider, and the first print all share the exact same left edge. Never
// overlaps the painting. 0 = far left of the canvas, 1000 = far right.
export default function PanSlider({ value, onChange }) {
  return (
    <div
      className="fixed bottom-5 md:bottom-7 right-4 md:right-8 z-40 pointer-events-none"
      style={{ left: "calc(50vw - min(13vh, 9vw))" }}
    >
      <div className="rounded-full bg-white/85 backdrop-blur px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.18)] pointer-events-auto">
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Pan the gallery horizontally"
          className="pan-slider w-full appearance-none bg-transparent cursor-pointer"
        />
      </div>
      <style>{`
        .pan-slider {
          height: 18px;
        }
        .pan-slider::-webkit-slider-runnable-track {
          height: 4px;
          background: rgba(45, 45, 45, 0.18);
          border-radius: 999px;
        }
        .pan-slider::-moz-range-track {
          height: 4px;
          background: rgba(45, 45, 45, 0.18);
          border-radius: 999px;
        }
        .pan-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 26px;
          height: 14px;
          margin-top: -5px;
          border-radius: 999px;
          background: #2D2D2D;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          border: none;
          cursor: grab;
        }
        .pan-slider:active::-webkit-slider-thumb {
          cursor: grabbing;
        }
        .pan-slider::-moz-range-thumb {
          width: 26px;
          height: 14px;
          border-radius: 999px;
          background: #2D2D2D;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          border: none;
          cursor: grab;
        }
      `}</style>
    </div>
  );
}
