"""Six 128 walk frames -> one looping GIF, via Pillow.

    & "$VENV/Scripts/python.exe" tools/scheme-c/make-walk-gif.py <frameDir> <prefix> <out.gif> [fps] [scale]

Why Pillow and not sharp: sharp 0.35's gif encoder mangles a raw stacked
page image (frames come out as horizontal slivers), and it only stamps a delay
on the first frame. Pillow writes the eight-bit frames and per-frame duration
directly, and reading the file back verifies both.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ORDER = ["a", "e", "b", "c", "f", "d"]
BG = (20, 16, 24, 255)

dir_arg, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
fps = int(sys.argv[4]) if len(sys.argv) > 4 else 8
scale = int(sys.argv[5]) if len(sys.argv) > 5 else 4

size = 128 * scale
frames = []
for key in ORDER:
    src = Path(dir_arg) / f"{prefix}-walk-{key}.png"
    img = Image.open(src).convert("RGBA")
    img = img.resize((size, size), Image.NEAREST)
    base = Image.new("RGBA", (size, size), BG)
    base.alpha_composite(img)
    frames.append(base.convert("RGB"))

duration = max(20, round(1000 / fps))
# 6 frames at 8 fps is 0.75 s per cycle = ~160 steps/min, which is the engine's
# speed but too fast to judge poses by eye. Preview at 6 fps (1.0 s, ~120
# steps/min) and keep a separate game-speed copy so the two never get confused.
PREVIEW_FPS = 6
frames[0].save(
    out,
    save_all=True,
    append_images=frames[1:],
    duration=duration,
    loop=0,
    disposal=2,
    optimize=False,
)

# read back and confirm
with Image.open(out) as gif:
    durations = []
    for i in range(gif.n_frames):
        gif.seek(i)
        durations.append(gif.info.get("duration"))
    meta = {
        "file": out,
        "size": f"{gif.width}x{gif.height}",
        "frames": gif.n_frames,
        "order": ORDER,
        "fps": fps,
        "durationMs": durations,
        "loop": gif.info.get("loop"),
        "bytes": Path(out).stat().st_size,
    }

# companion GIF at preview cadence, so frame review is not done at game speed
if fps != PREVIEW_FPS:
    preview = str(Path(out).with_name(Path(out).stem + f"-preview{PREVIEW_FPS}fps.gif"))
    frames[0].save(
        preview, save_all=True, append_images=frames[1:],
        duration=max(20, round(1000 / PREVIEW_FPS)), loop=0, disposal=2, optimize=False,
    )
    meta["preview"] = preview

# dump the first and fourth frame for a visual check
with Image.open(out) as gif:
    gif.seek(0)
    gif.convert("RGB").save(str(Path(out).with_suffix(".frame-a.png")))
    gif.seek(3)
    gif.convert("RGB").save(str(Path(out).with_suffix(".frame-c.png")))

print(json.dumps(meta, ensure_ascii=False, indent=2))
