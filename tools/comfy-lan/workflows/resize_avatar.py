"""Resize avatar master to upload specs. Usage: python resize_avatar.py"""
from PIL import Image

SRC = r"D:\code\WechatMiniProgram\shiguang-pintu\assets\avatar\batch-001\avatar-D2-krea.png"
DST144 = r"D:\code\WechatMiniProgram\shiguang-pintu\assets\avatar\batch-001\avatar-final-144.png"
DST48 = r"D:\code\WechatMiniProgram\shiguang-pintu\assets\avatar\batch-001\avatar-final-48-check.png"

im = Image.open(SRC).convert("RGB")
print("master:", im.size, im.mode)
im.resize((144, 144), Image.LANCZOS).save(DST144, optimize=True)
im.resize((48, 48), Image.LANCZOS).save(DST48, optimize=True)
import os
for p in (DST144, DST48):
    print(os.path.basename(p), os.path.getsize(p), "bytes")
print("done")
