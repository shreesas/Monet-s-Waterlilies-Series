"""Measure the inner-window of the processed frame, scanning OUTWARD
from the centre point (which sits inside the inner cutout) to find the
first opaque (gold) pixel in each direction. That gives the inner edge
of the frame.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "gold-frame.png"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
print(f"Frame image: {w}x{h} px, aspect {w/h:.3f}")
px = img.load()


def opaque(x, y):
    return px[x, y][3] >= 64


def median(vals):
    vals = sorted(v for v in vals if v is not None)
    return vals[len(vals) // 2] if vals else None


def first_opaque_going_left(start_x, y):
    for x in range(start_x, -1, -1):
        if opaque(x, y):
            return x
    return None


def first_opaque_going_right(start_x, y):
    for x in range(start_x, w):
        if opaque(x, y):
            return x
    return None


def first_opaque_going_up(x, start_y):
    for y in range(start_y, -1, -1):
        if opaque(x, y):
            return y
    return None


def first_opaque_going_down(x, start_y):
    for y in range(start_y, h):
        if opaque(x, y):
            return y
    return None


mid_x = w // 2
mid_y = h // 2

# Sample a few rows near the middle (avoiding any decorative tab in the
# centre top/bottom of the frame), take the median of the inner edge.
sample_ys = [int(h * f) for f in (0.40, 0.45, 0.50, 0.55, 0.60)]
sample_xs = [int(w * f) for f in (0.40, 0.45, 0.50, 0.55, 0.60)]

left = median([first_opaque_going_left(mid_x, y) for y in sample_ys])
right = median([first_opaque_going_right(mid_x, y) for y in sample_ys])
top = median([first_opaque_going_up(x, mid_y) for x in sample_xs])
bottom = median([first_opaque_going_down(x, mid_y) for x in sample_xs])

print(f"Inner window pixel bounds (inner edge of gold): left={left}, top={top}, right={right}, bottom={bottom}")
print(
    "  → as % of frame image: "
    f"left={left/w*100:.2f}%, top={top/h*100:.2f}%, "
    f"right={(w-1-right)/w*100:.2f}%, bottom={(h-1-bottom)/h*100:.2f}%"
)
inner_w = right - left
inner_h = bottom - top
print(
    f"  → inner window: {inner_w}x{inner_h} px = "
    f"{inner_w/w*100:.2f}% wide x {inner_h/h*100:.2f}% tall, "
    f"aspect {inner_w/inner_h:.3f}"
)
