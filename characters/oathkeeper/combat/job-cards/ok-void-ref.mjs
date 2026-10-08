/**
 * Edge-flood studio off the hi stamp, composite onto night void 512x1024.
 * Does not paint armor or visor. i2i input only.
 */
import { createRequire } from "module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const SRC =
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/review-h23-wave16/08-raw-hi.png";
const OUT =
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/ok-idle-192/ref-ok-hi-void-512x1024.png";
const INK = { r: 0, g: 4, b: 12, alpha: 1 };
const W = 512;
const H = 1024;

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}
function isFlame(r, g, b, a) {
  return a > 80 && r > 170 && g > 70 && b < 130 && r > g + 20 && g > b;
}
function isCoolSilver(r, g, b, a) {
  if (a < 80) return false;
  const L = luma(r, g, b);
  const c = chroma(r, g, b);
  return L > 145 && b - r >= 6 && c < 45;
}
function isInkVoid(r, g, b, a) {
  if (a < 16) return true;
  if (isFlame(r, g, b, a)) return false;
  return luma(r, g, b) <= 16 && chroma(r, g, b) <= 16;
}
function isLightStudio(r, g, b, a) {
  if (a < 16) return true;
  if (isFlame(r, g, b, a)) return false;
  if (isCoolSilver(r, g, b, a)) return false;
  const L = luma(r, g, b);
  const c = chroma(r, g, b);
  if (L > 200 && c < 22) return true;
  if (L > 170 && L < 200 && c < 12 && Math.abs(b - r) < 6) return true;
  return false;
}

function flood(src, pred) {
  const { width: w, height: h, data } = src;
  const n = w * h;
  const mark = new Uint8Array(n);
  const q = [];
  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (mark[i]) return;
    const o = i * 4;
    if (!pred(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
    mark[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }
  while (q.length) {
    const i = q.pop();
    const x = i % w;
    const y = (i / w) | 0;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }
  return mark;
}

const img = sharp(SRC);
const { width, height } = await img.metadata();
const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const src = { width, height, data };
const paper = flood(src, (r, g, b, a) => isInkVoid(r, g, b, a) || isLightStudio(r, g, b, a));

let minX = width,
  maxX = 0,
  minY = height,
  maxY = 0,
  n = 0;
for (let i = 0; i < width * height; i++) {
  const o = i * 4;
  if (data[o + 3] <= 80 || paper[i]) continue;
  const x = i % width;
  const y = (i / width) | 0;
  n++;
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (y < minY) minY = y;
  if (y > maxY) maxY = y;
}
const fw = maxX - minX + 1;
const fh = maxY - minY + 1;
const crop = Buffer.alloc(fw * fh * 4);
for (let y = 0; y < fh; y++) {
  for (let x = 0; x < fw; x++) {
    const si = ((minY + y) * width + (minX + x)) * 4;
    const di = (y * fw + x) * 4;
    if (data[si + 3] <= 80 || paper[(minY + y) * width + (minX + x)]) {
      crop[di + 3] = 0;
      continue;
    }
    crop[di] = data[si];
    crop[di + 1] = data[si + 1];
    crop[di + 2] = data[si + 2];
    crop[di + 3] = 255;
  }
}

const pad = 16;
const scale = Math.min((W - pad * 2) / fw, (H - pad * 2) / fh);
const dw = Math.max(1, Math.round(fw * scale));
const dh = Math.max(1, Math.round(fh * scale));
const left = Math.floor((W - dw) / 2);
const top = H - pad - dh;

const figure = await sharp(crop, { raw: { width: fw, height: fh, channels: 4 } })
  .resize(dw, dh, { kernel: "lanczos3" })
  .png()
  .toBuffer();

await sharp({
  create: { width: W, height: H, channels: 4, background: INK },
})
  .composite([{ input: figure, left, top }])
  .png()
  .toFile(OUT);

console.log(
  JSON.stringify({ n, box: { minX, maxX, minY, maxY, fw, fh }, placed: { dw, dh, left, top }, out: OUT }),
);
