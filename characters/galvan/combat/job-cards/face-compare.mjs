/**
 * Side-by-side head crop: void-ref vs rejected B-lo. Review only.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const REVIEW =
  "d:/code/vampire-survivors-like/characters/galvan/review/20260918-idle-128";
const VOID = "d:/code/vampire-survivors-like/characters/galvan/stamps/idle-void-ref-512x1024.png";
const STAMP = path.join(REVIEW, "01-blo-stamp.png");
const STAMP_A = path.join(REVIEW, "05-blo-a-stamp.png");
const OUT = path.join(REVIEW, "04-face-compare.png");
const OUT3 = path.join(REVIEW, "08-face-compare-3.png");
const SLATE = { r: 42, g: 52, b: 68, alpha: 1 };
const CROP = { left: 128, top: 48, width: 256, height: 320 };

mkdirSync(REVIEW, { recursive: true });

const a = await sharp(VOID).extract(CROP).png().toBuffer();
const b = await sharp(STAMP).extract(CROP).png().toBuffer();
const c = await sharp(STAMP_A).extract(CROP).png().toBuffer();
const col = 280;
const pad = 24;
const labelH = 36;
const w2 = pad + col + pad + col + pad;
const w3 = pad + col + pad + col + pad + col + pad;
const h = labelH + 320 + pad;
const svg2 = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w2}" height="${h}">
    <text x="${pad + col / 2}" y="26" fill="#E8EEF6" font-size="18" text-anchor="middle" font-family="Segoe UI,sans-serif">夜空底（锁）</text>
    <text x="${pad + col + pad + col / 2}" y="26" fill="#E8EEF6" font-size="18" text-anchor="middle" font-family="Segoe UI,sans-serif">B-lo 0.48（废）</text>
  </svg>`,
);
const svg3 = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w3}" height="${h}">
    <text x="${pad + col / 2}" y="26" fill="#E8EEF6" font-size="18" text-anchor="middle" font-family="Segoe UI,sans-serif">夜空底（锁）</text>
    <text x="${pad + col + pad + col / 2}" y="26" fill="#E8EEF6" font-size="18" text-anchor="middle" font-family="Segoe UI,sans-serif">0.48（废）</text>
    <text x="${pad + col + pad + col + pad + col / 2}" y="26" fill="#E8EEF6" font-size="18" text-anchor="middle" font-family="Segoe UI,sans-serif">A 0.32（仍换脸）</text>
  </svg>`,
);

await sharp({
  create: { width: w2, height: h, channels: 4, background: SLATE },
})
  .composite([
    { input: svg2, left: 0, top: 0 },
    { input: a, left: pad + Math.floor((col - 256) / 2), top: labelH },
    { input: b, left: pad + col + pad + Math.floor((col - 256) / 2), top: labelH },
  ])
  .png()
  .toFile(OUT);

const x = (i) => pad + i * (col + pad) + Math.floor((col - 256) / 2);
await sharp({
  create: { width: w3, height: h, channels: 4, background: SLATE },
})
  .composite([
    { input: svg3, left: 0, top: 0 },
    { input: a, left: x(0), top: labelH },
    { input: b, left: x(1), top: labelH },
    { input: c, left: x(2), top: labelH },
  ])
  .png()
  .toFile(OUT3);

console.log(OUT);
console.log(OUT3);
