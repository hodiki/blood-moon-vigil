"""Contact sheets for gallery first-batch review. Usage: python make_contact_sheet.py"""
import json
import os
from PIL import Image, ImageDraw

RAW = r"D:\code\WechatMiniProgram\shiguang-pintu\assets\pipeline\raw"
CELL = 256
LABEL = 24
GAP = 6

THEMES_1 = ["cat", "scene", "flower", "ocean"]
THEMES_2 = ["animals", "night", "desk", "sky", "_sample-002"]

def collect(themes):
    items = []
    for th in themes:
        d = os.path.join(RAW, th)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith(".png"):
                sid = f[:-4]
                engine = "?"
                jp = os.path.join(d, sid + ".json")
                if os.path.exists(jp):
                    try:
                        engine = json.load(open(jp, encoding="utf-8")).get("engine", "?")
                    except Exception:
                        pass
                items.append((os.path.join(d, f), sid, engine))
    return items

def build(items, out):
    cols = 4
    rows = (len(items) + cols - 1) // cols
    W = cols * CELL + (cols + 1) * GAP
    H = rows * (CELL + LABEL) + (rows + 1) * GAP
    sheet = Image.new("RGB", (W, H), (245, 242, 235))
    draw = ImageDraw.Draw(sheet)
    for i, (p, sid, engine) in enumerate(items):
        r, c = divmod(i, cols)
        x = GAP + c * (CELL + GAP)
        y = GAP + r * (CELL + LABEL + GAP)
        im = Image.open(p).convert("RGB").resize((CELL, CELL), Image.LANCZOS)
        sheet.paste(im, (x, y))
        draw.text((x + 4, y + CELL + 4), f"{sid} [{engine}]", fill=(60, 55, 50))
    sheet.save(out, optimize=True)
    print(out, sheet.size, os.path.getsize(out) // 1024, "KB")

items1 = collect(THEMES_1)
items2 = collect(THEMES_2)
build(items1, os.path.join(RAW, "_contact-sheet-1.png"))
build(items2, os.path.join(RAW, "_contact-sheet-2.png"))
print(f"items1={len(items1)} items2={len(items2)}")
