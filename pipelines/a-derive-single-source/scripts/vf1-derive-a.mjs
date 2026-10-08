/**
 * A-track derives from 图1′: bust card, flat-black silhouette, few-block color key.
 * Does not paint clothes. Does not write assets/frames/.
 */
import { createRequire } from "module";
import { mkdirSync } from "fs";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const SRC =
  "d:/code/vampire-survivors-like/characters/violet-fallen/identity/source/vf1-clean.png";
const REVIEW =
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/review-identity-vf1";
const PARK =
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/identity-vf1";

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function floodBg(src) {
  const { width: w, height: h, data } = src;
  const n = w * h;
  const mark = new Uint8Array(n);
  const q = [];
  const isBg = (r, g, b, a) => {
    if (a < 16) return true;
    const L = luma(r, g, b);
    const c = chroma(r, g, b);
    return L > 165 && c < 18;
  };
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (mark[i]) return;
    const o = i * 4;
    if (!isBg(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
    mark[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (q.length) {
    const i = q.pop();
    const x = i % w;
    const y = (i / w) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return mark;
}

function bbox(src, keep) {
  let minX = src.width,
    maxX = 0,
    minY = src.height,
    maxY = 0,
    n = 0;
  for (let i = 0; i < src.width * src.height; i++) {
    if (!keep[i]) continue;
    const x = i % src.width;
    const y = (i / src.width) | 0;
    n++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, n };
}

function classify(r, g, b) {
  const L = luma(r, g, b);
  const c = chroma(r, g, b);
  if (r > 140 && r > g + 40 && r > b + 30 && g < 120) return [190, 28, 40];
  if (L > 175 && c < 45 && r > 160 && g > 130 && b > 120) return [232, 214, 200];
  if (L < 70) return [18, 18, 22];
  if (L < 120 && c < 25) return [42, 42, 48];
  if (r > 80 && g < 70 && b < 70 && r > g) return [126, 30, 30];
  return [18, 18, 22];
}

mkdirSync(REVIEW, { recursive: true });
mkdirSync(PARK, { recursive: true });

const img = sharp(SRC);
const { width, height } = await img.metadata();
const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const src = { width, height, data };
const bg = floodBg(src);
const keep = new Uint8Array(width * height);
for (let i = 0; i < keep.length; i++) keep[i] = bg[i] ? 0 : 1;
const box = bbox(src, keep);

const paper = [236, 228, 212];
const sil = Buffer.alloc(width * height * 4);
const key = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  const o = i * 4;
  if (!keep[i]) {
    sil[o] = paper[0];
    sil[o + 1] = paper[1];
    sil[o + 2] = paper[2];
    sil[o + 3] = 255;
    key[o] = paper[0];
    key[o + 1] = paper[1];
    key[o + 2] = paper[2];
    key[o + 3] = 255;
    continue;
  }
  sil[o] = 12;
  sil[o + 1] = 12;
  sil[o + 2] = 14;
  sil[o + 3] = 255;
  const rgb = classify(data[o], data[o + 1], data[o + 2]);
  key[o] = rgb[0];
  key[o + 1] = rgb[1];
  key[o + 2] = rgb[2];
  key[o + 3] = 255;
}

await sharp(sil, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${REVIEW}/03-silhouette-from-clean.png`);
await sharp(key, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${REVIEW}/04-color-key-from-clean.png`);
await sharp(sil, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${PARK}/03-silhouette-from-clean.png`);
await sharp(key, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${PARK}/04-color-key-from-clean.png`);

const padX = Math.round(box.w * 0.12);
const padY = Math.round(box.h * 0.04);
const headH = Math.round(box.h * 0.42);
const cx = Math.max(0, box.minX - padX);
const cy = Math.max(0, box.minY - padY);
const cw = Math.min(width - cx, box.w + padX * 2);
const ch = Math.min(height - cy, headH + padY);
await sharp(SRC)
  .extract({ left: cx, top: cy, width: cw, height: ch })
  .png()
  .toFile(`${REVIEW}/02-card-bust.png`);
await sharp(SRC)
  .extract({ left: cx, top: cy, width: cw, height: ch })
  .png()
  .toFile(`${PARK}/02-card-bust.png`);

console.log(JSON.stringify({ width, height, box, card: { cx, cy, cw, ch } }));
