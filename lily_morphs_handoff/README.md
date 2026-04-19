# Water Lilies Morph — Frontend Handoff

Pre-rendered diffusion-based morph animations between Monet's 10 *Water Lilies* paintings. This is the frame + manifest bundle the designer's frontend consumes.

## What's in this zip

```
.
├── README.md                  ← this file
├── preview.html               ← zero-dep browser previewer (open via http://, not file://)
└── frames/
    ├── manifest.json          ← everything the frontend needs (schema below)
    ├── 1_to_2/                ← 25 WebP frames per transition folder
    │   ├── frame_0000.webp    ← anchor 1 (start)
    │   ├── frame_0001.webp    ← interpolated
    │   ├── ...
    │   ├── frame_0023.webp    ← interpolated
    │   └── frame_0024.webp    ← anchor 2 (end)
    ├── 2_to_3/
    ├── 3_to_4/
    ├── 4_to_5/
    ├── 5_to_6/
    ├── 6_to_7/
    ├── 7_to_8/
    ├── 8_to_9/
    └── 9_to_10/
```

9 transitions × 25 frames = **225 WebP frames total**, ~18 MB on disk.

Each frame is **1024 × 576 WebP**, quality 90. No upscaler was applied — this is native SVD-XT resolution.

## Quick start — local preview

Run a static server in this folder (so relative paths resolve):

```bash
# From the unzipped folder, any of:
python3 -m http.server 8000
# or
npx serve .
# or any other static server
```

Then open:

```
http://localhost:8000/preview.html?manifest=frames/manifest.json
```

Use **← Back** / **Next →** buttons or arrow keys to scrub through the 10 anchors. Each click plays one 25-frame morph forward or in reverse. The `Speed` dropdown adjusts playback duration (2–10 s per morph).

Opening `preview.html` with `file://` directly will not work — the browser blocks `fetch()` on local files. Use a real HTTP server.

## The 10 anchors

Each morph lands exactly on the white-padded native painting. These are the milestones the **Next** button should commit to:

| Index | Title                      | Catalog | Year       |
|------:|:---------------------------|:--------|:-----------|
| 1.0   | Water Lilies               | W.1501  | 1897–1898  |
| 2.0   | The Lily Pond              | W.1516  | 1899       |
| 3.0   | Water-Lilies               | W.1657  | 1903       |
| 4.0   | Water Lilies               | W.1683  | 1906       |
| 5.0   | Water-Lilies               | W.1706  | 1907       |
| 6.0   | Water-Lilies               | W.1796  | 1915       |
| 7.0   | Water Lilies               | W.1800  | 1916       |
| 8.0   | Water-Lilies               | W.1852  | 1916–1919  |
| 9.0   | Jardin d'eau à Giverny     | W.1878  | 1920       |
| 10.0  | Water-Lily Pond, Evening   | W.1964  | 1920–1926  |

The manifest carries `title` and `catalog_number` on every anchor frame, so you don't need a separate metadata file.

## `manifest.json` schema

```json
{
  "canvas": { "width": 1024, "height": 576, "pad_color": "#FFFFFF" },
  "intermediates_per_segment": 23,
  "transitions": [
    {
      "folder": "1_to_2",
      "start_index": 1.0,
      "end_index": 2.0,
      "frames": [
        {
          "file": "frame_0000.webp",
          "role": "anchor",
          "segment_t": null,
          "index": 1.0,
          "anchor": true,
          "title": "Water Lilies",
          "catalog_number": "W.1501"
        },
        {
          "file": "frame_0001.webp",
          "role": "interpolated",
          "segment_t": 0.0417,
          "between": [1.0, 2.0]
        },
        "... 22 more interpolated frames ...",
        {
          "file": "frame_0024.webp",
          "role": "anchor",
          "segment_t": null,
          "index": 2.0,
          "anchor": true,
          "title": "The Lily Pond",
          "catalog_number": "W.1516"
        }
      ]
    },
    "... 8 more transitions ..."
  ]
}
```

**Field reference:**

- `canvas.{width,height}` — every frame is exactly this size; canvas dimensions never change mid-chain.
- `canvas.pad_color` — the solid background color that the paintings are centered on (for anchors and for the intro/outro crossfade of difficult pairs). You can style surrounding UI to match.
- `intermediates_per_segment` — 23. Number of generated frames between start- and end-anchor of a transition. Plus the two anchor frames = 25 frames per transition.
- `transitions[]` — length 9, ordered by `start_index`. Adjacent transitions share endpoints: `transitions[i].end_index === transitions[i+1].start_index`.
- `transitions[i].folder` — relative directory from `manifest.json` containing the 25 WebP frames.
- `frames[j].role` — `"anchor"` (only at `j==0` and `j==24`) or `"interpolated"` (indices 1–23).
- `frames[j].segment_t` — float in `(0, 1)` for interpolated frames, `null` for anchors. Normalized position along the morph.
- `frames[j].index, .anchor, .title, .catalog_number` — only on anchor frames.
- `frames[j].between` — only on interpolated frames; a pair `[start_index, end_index]` for the transition the frame belongs to.

## Frontend integration — play / scrub / reverse

The UX pattern is: **N** anchor states, **N-1** transitions. The user advances through the chain one anchor at a time. Each click plays exactly one transition; the app lands on an anchor and idles until the next click.

### Minimal pseudocode

```ts
// Load once at app start
const manifest = await fetch('frames/manifest.json').then(r => r.json());
const base = 'frames/';

// Preload (optional but recommended — frames are small, first play is snappier)
const imgs = {};  // key: "1_to_2/frame_0003.webp" → HTMLImageElement
for (const t of manifest.transitions) {
  for (const f of t.frames) {
    const img = new Image();
    img.src = base + t.folder + '/' + f.file;
    imgs[t.folder + '/' + f.file] = img;
  }
}

// State
let anchorIdx = 0;  // 0..9 — maps to anchor at index (anchorIdx + 1).0

function playTransition(transitionIdx, direction, durationMs = 4000) {
  const t = manifest.transitions[transitionIdx];
  const frames = direction === 'forward'
    ? t.frames
    : [...t.frames].reverse();
  // requestAnimationFrame tick: show frames[Math.floor(p * 24 + 0.5)] where p = elapsed/durationMs
  // on end, update anchorIdx
}

function onNext() {
  if (anchorIdx >= 9) return;  // last anchor
  playTransition(anchorIdx, 'forward');
  // anchorIdx will be incremented in the animation's onDone callback
}

function onBack() {
  if (anchorIdx === 0) return;  // first anchor
  playTransition(anchorIdx - 1, 'reverse');
}
```

See `preview.html` `<script>` block for a complete reference implementation — it handles preloading, keyboard input, progress dots, and per-anchor metadata display. Feel free to port the play-loop (`playFrames()`) and the anchor/transition index bookkeeping.

### Notes for the embed

- **Frames are symmetric across direction.** The same 25 files play forward for `onNext()` and reversed for `onBack()`. No separate reverse render needed.
- **Scrub support** is just frame-picking at a `t` value: `frames[Math.floor(t * 24)]`. No decoding overhead vs. video.
- **Idle state**: when no morph is playing, the visible frame should be the anchor — either `transitions[anchorIdx-1].frames[last]` (if you just landed) or `transitions[anchorIdx].frames[0]` (if next). They're semantically the same anchor but rendered identically, so either works.
- **Preloading**: 225 frames × ~80 KB avg ≈ 18 MB total. You can preload everything at app start without worrying about memory. For mobile, preloading one transition ahead of the current anchor is also reasonable.
- **No CSS interpolation needed**: all motion is in the frames. Just swap `<img src>` on each tick. A single `<img>` element with `src` updates will not flicker in Chrome/Safari/Firefox as long as frames are already loaded.

### Suggested playback timing

- Forward/back morph: **3–4 s per transition** (default in preview.html is 4 s). At 25 frames over 4 s that's ~6.25 fps visible — each frame displayed for ~160 ms. Faster (2 s) reads more like a whip-pan; slower (6 s+) lets viewers study each frame.
- Consider easing: linear stepping is fine, but a subtle `ease-in-out` curve (via Bezier on the `p` parameter) makes the morph feel less mechanical.

## Technical details (how the frames were generated)

- **Model**: [jeanne-wang/svd_keyframe_interpolation](https://github.com/jeanne-wang/svd_keyframe_interpolation) — a fine-tune of **Stable Video Diffusion img2vid-xt** that conditions on both a start frame and end frame via temporal attention flip.
- **Resolution**: 1024×576 native (model training size). No upscaler pass.
- **Inference**: 50 denoising steps, noise injection 5 steps @ ratio 0.5, fp16 on NVIDIA A40.
- **Canvas mode**:
  - **1→2 through 6→7 and 8→9**: white-pad background (paintings centered on `#FFFFFF`).
  - **7→8 and 9→10**: blur-cover background — the white pad is replaced with a blurred zoom-to-cover copy of the same painting, bridging aspect-ratio mismatches (anchor 9 is portrait 486×640, anchor 10 is panorama 2048×707 — the blur gives the diffusion a continuous field to morph across instead of a hard white cliff). A 5-frame crossfade at each end eases the blur backdrop back to white-pad so the boundaries with adjacent transitions stay seamless.
- **Per-pair compute**: ~16 min on a single A40.
- **Seed**: 42 for all pairs.

### Frame roles and anchor pixel-exactness

Anchor frames (`frame_0000.webp` and `frame_0024.webp` of every transition) are written from the normalized source painting, **not** from SVD's output. This means:

- The morph lands **pixel-exact** on the real painting at each anchor. No VAE round-trip drift.
- Adjacent transitions' shared anchors are byte-identical (`transitions[i].frames[24]` == `transitions[i+1].frames[0]`).
- The SVD-generated morph only lives in the 23 interpolated frames in the middle.

### What's NOT in this bundle

- Source paintings (Wikimedia hi-res originals — available via URLs in the original metadata; not shipped here to keep the bundle lean).
- Model weights (~20 GB total; not needed for serving pre-rendered frames).
- Build pipeline source (`render_morphs.py`, etc. — available in the original handoff if you need to regenerate).

## Versions / provenance

- Rendered: April 2026
- Pipeline: `render_morphs.py --backend svd` at commit described in the server-side handoff
- Hardware: NVIDIA A40 (46 GB)

## Questions?

If anything about the manifest format or frame timing is unclear, the authoritative reference is `preview.html` — it's a complete, self-contained consumer of the same manifest the frontend will use, so its behavior defines the intended semantics.
