"""One-off script: remove the black background from the gold-frame PNG.

We treat the alpha for each pixel as a function of its luminance:
  • Very dark pixels (luminance < 25)  → fully transparent (the painting
    will show through here, both in the frame's central window AND in any
    very-dark recess of the gold ornament).
  • Bright pixels (luminance > 80)     → fully opaque (gold detail).
  • In-between pixels                  → linear ramp from 0 → 255, so the
    anti-aliased edge between black and gold stays smooth instead of
    becoming a hard pixelated outline.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "gold-frame-raw.png"
DST = ROOT / "src" / "assets" / "gold-frame.png"

DARK_CUTOFF = 25
BRIGHT_CUTOFF = 80


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    span = BRIGHT_CUTOFF - DARK_CUTOFF
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum <= DARK_CUTOFF:
                a = 0
            elif lum >= BRIGHT_CUTOFF:
                a = 255
            else:
                a = int(round((lum - DARK_CUTOFF) / span * 255))
            pixels[x, y] = (r, g, b, a)

    img.save(DST, optimize=True)
    print(f"Wrote {DST.relative_to(ROOT)} ({DST.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
