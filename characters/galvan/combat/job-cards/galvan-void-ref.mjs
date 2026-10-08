/**
 * bulk-a 已是黑底全身。只落到 512×1024 夜空，不洪水抠（披近墨，会吃边）。
 * 不是 128，不写 frames/。
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const SRC =
  "d:/code/vampire-survivors-like/characters/galvan/identity/source/char-bible-portrait-galvan-bulk-a.png";
const OUT_DIR =
  "d:/code/vampire-survivors-like/characters/galvan/stamps";
const REVIEW =
  "d:/code/vampire-survivors-like/characters/galvan/review/20260918-idle-128";
const NAME = "idle-void-ref-512x1024.png";
const INK = { r: 0, g: 4, b: 12, alpha: 1 };

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(REVIEW, { recursive: true });

const buf = await sharp(SRC)
  .ensureAlpha()
  .resize(512, 1024, {
    fit: "contain",
    background: INK,
    kernel: "lanczos3",
  })
  .png()
  .toBuffer();

const a = path.join(OUT_DIR, NAME);
const b = path.join(REVIEW, NAME);
await sharp(buf).toFile(a);
await sharp(buf).toFile(b);
const meta = await sharp(buf).metadata();
console.log(JSON.stringify({ w: meta.width, h: meta.height, a, b }));
