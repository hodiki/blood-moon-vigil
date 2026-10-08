/**
 * Vf1 B: extract stamp figure, nearest-neighbor into 128, readable card.
 * Does not write assets/frames/. Does not load Vo D2/O3.
 *
 * node vf1-box-b.mjs <label> <stamp.png> <rawName> <boxName> <cardName>
 */
import { createRequire } from "module";
import { copyFileSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const REVIEW =
  process.env.E1_REVIEW ||
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/review-identity-vf1";
const PARK =
  process.env.E1_PARK ||
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/identity-vf1";
const SKIP_CARD = process.env.E1_SKIP_CARD === "1";
const BOX = 128;
const SLATE = { r: 42, g: 52, b: 68, alpha: 1 };

const [label, stampPath, rawName, boxName, cardName] = process.argv.slice(2);
if (!label || !stampPath || !rawName || !boxName || !cardName) {
  console.error(
    "usage: node vf1-box-b.mjs <label> <stamp.png> <rawName> <boxName> <cardName>",
  );
  process.exit(1);
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}
function isInkVoid(r, g, b, a) {
  if (a < 16) return true;
  if (isRed(r, g, b, a)) return false;
  return luma(r, g, b) <= 16 && chroma(r, g, b) <= 16;
}
function isStudio(r, g, b, a) {
  if (a < 16) return true;
  const L = luma(r, g, b);
  const c = chroma(r, g, b);
  return L > 165 && c < 18;
}
function isRed(r, g, b, a) {
  return a > 80 && r > 140 && r > g + 40 && r > b + 30 && g < 120;
}
function isSkin(r, g, b, a) {
  return a > 80 && r > 150 && g > 100 && b > 70 && r > b && luma(r, g, b) > 130 && luma(r, g, b) < 240;
}
function isNavy(r, g, b, a) {
  if (a < 80) return true;
  const L = luma(r, g, b);
  return L <= 28 && b - r >= 6;
}
function isCloth(r, g, b, a) {
  if (a < 80) return false;
  if (isRed(r, g, b, a) || isSkin(r, g, b, a) || isNavy(r, g, b, a)) return false;
  const L = luma(r, g, b);
  const c = chroma(r, g, b);
  return L < 90 && c < 16;
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

async function loadRaw(file) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width, height, data };
}

function cleanKeep(width, height, keep) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!keep[i] || seen[i]) continue;
    const q = [i];
    const comp = [];
    seen[i] = 1;
    let touch = false;
    while (q.length) {
      const j = q.pop();
      comp.push(j);
      const x = j % width;
      const y = (j / width) | 0;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) touch = true;
      const nb = [j - 1, j + 1, j - width, j + width];
      const ok = [x > 0, x + 1 < width, y > 0, y + 1 < height];
      for (let k = 0; k < 4; k++) {
        if (!ok[k]) continue;
        const t = nb[k];
        if (seen[t] || !keep[t]) continue;
        seen[t] = 1;
        q.push(t);
      }
    }
    // 边角碎点丢掉。头和身子若被领口断开，两块都留。
    if (touch && comp.length < 2000) continue;
    for (const j of comp) out[j] = 1;
  }
  return out;
}

function fillInteriorHoles(keep, w, h) {
  const exterior = new Uint8Array(w * h);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (exterior[i] || keep[i]) return;
    exterior[i] = 1;
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
  let filled = 0;
  for (let i = 0; i < keep.length; i++) {
    if (keep[i] || exterior[i]) continue;
    keep[i] = 1;
    filled++;
  }
  return filled;
}

function extractFigure(src) {
  const { width: sw, height: sh, data: srcData } = src;
  const px = sw * sh;
  const seed = new Uint8Array(px);
  const enter = new Uint8Array(px);
  for (let i = 0; i < px; i++) {
    const o = i * 4;
    const r = srcData[o],
      g = srcData[o + 1],
      b = srcData[o + 2],
      a = srcData[o + 3];
    if (isInkVoid(r, g, b, a) || isStudio(r, g, b, a) || isNavy(r, g, b, a)) continue;
    if (isRed(r, g, b, a) || isSkin(r, g, b, a) || isCloth(r, g, b, a)) {
      seed[i] = 1;
      enter[i] = 1;
      continue;
    }
    const L = luma(r, g, b);
    const c = chroma(r, g, b);
    if (a > 80 && L < 160 && c < 40 && !isNavy(r, g, b, a)) enter[i] = 1;
  }
  const keep = new Uint8Array(px);
  const q = [];
  for (let i = 0; i < px; i++) {
    if (!seed[i]) continue;
    keep[i] = 1;
    q.push(i);
  }
  while (q.length) {
    const j = q.pop();
    const x = j % sw;
    const y = (j / sw) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
        const t = ny * sw + nx;
        if (keep[t] || !enter[t]) continue;
        keep[t] = 1;
        q.push(t);
      }
    }
  }
  // 近墨裙/发会被 isInkVoid / isNavy 打成体内洞。边连到的空是底，体内洞补回。
  const holesFilled = fillInteriorHoles(keep, sw, sh);
  let minX = sw,
    maxX = 0,
    minY = sh,
    maxY = 0,
    kept = 0;
  for (let i = 0; i < keep.length; i++) {
    if (!keep[i]) continue;
    kept++;
    const x = i % sw;
    const y = (i / sw) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const crop = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const gi = (minY + y) * sw + (minX + x);
      const si = gi * 4;
      const di = (y * cw + x) * 4;
      if (!keep[gi]) {
        crop[di + 3] = 0;
        continue;
      }
      crop[di] = srcData[si];
      crop[di + 1] = srcData[si + 1];
      crop[di + 2] = srcData[si + 2];
      crop[di + 3] = 255;
    }
  }
  return {
    box: { minX, maxX, minY, maxY, w: cw, h: ch, n: kept },
    holesFilled,
    cropped: { width: cw, height: ch, data: crop },
  };
}

function boxInto128(sprite) {
  const maxH = Math.round((BOX * 56) / 64);
  const maxW = Math.round((BOX * 44) / 64);
  const scale = Math.min(maxH / sprite.height, maxW / sprite.width);
  const dw = Math.max(1, Math.round(sprite.width * scale));
  const dh = Math.max(1, Math.round(sprite.height * scale));
  const canvas = Buffer.alloc(BOX * BOX * 4);
  const ox = Math.floor((BOX - dw) / 2);
  const oy = BOX - dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sprite.height - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sprite.width - 1, Math.floor(x / scale));
      const si = (sy * sprite.width + sx) * 4;
      if (sprite.data[si + 3] < 128) continue;
      const tx = ox + x;
      const ty = oy + y;
      if (tx < 0 || ty < 0 || tx >= BOX || ty >= BOX) continue;
      const di = (ty * BOX + tx) * 4;
      canvas[di] = sprite.data[si];
      canvas[di + 1] = sprite.data[si + 1];
      canvas[di + 2] = sprite.data[si + 2];
      canvas[di + 3] = 255;
    }
  }
  return { width: BOX, height: BOX, data: canvas, dw, dh, ox, oy, scale };
}

function stats128(spr) {
  let opaque = 0,
    red = 0,
    skin = 0;
  let topY = BOX;
  for (let i = 0; i < BOX * BOX; i++) {
    const o = i * 4;
    const r = spr.data[o],
      g = spr.data[o + 1],
      b = spr.data[o + 2],
      a = spr.data[o + 3];
    if (a < 128) continue;
    opaque++;
    const y = (i / BOX) | 0;
    if (y < topY) topY = y;
    if (isRed(r, g, b, a)) red++;
    if (r > 150 && g > 100 && b > 70 && r > b && luma(r, g, b) > 130 && luma(r, g, b) < 210) {
      skin++;
    }
  }
  return { opaque, red, skin, topY, dw: spr.dw, dh: spr.dh };
}

async function writePng(raw, file) {
  await sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .png()
    .toFile(file);
}

mkdirSync(REVIEW, { recursive: true });
mkdirSync(PARK, { recursive: true });

const abs = path.resolve(stampPath);
const raw = await loadRaw(abs);
const pick = extractFigure(raw);
const boxed = boxInto128(pick.cropped);
const st = stats128(boxed);

copyFileSync(abs, `${REVIEW}/${rawName}`);
copyFileSync(abs, `${PARK}/${rawName}`);
await writePng(pick.cropped, `${PARK}/crop-${label}.png`);
await writePng(boxed, `${REVIEW}/${boxName}`);
await writePng(boxed, `${PARK}/${boxName}`);

if (!SKIP_CARD) {
const colW = 520;
const pad = 24;
const labelH = 40;
const imgH = 512;
const titleH = 44;
const w = pad + colW + pad + colW + pad + colW + pad;
const h = titleH + labelH + imgH + pad + 36;

const stampFit = await sharp(`${REVIEW}/${rawName}`)
  .resize(colW, imgH, { fit: "inside", kernel: "lanczos3", background: SLATE })
  .ensureAlpha()
  .png()
  .toBuffer({ resolveWithObject: true });
const stampX = pad + Math.floor((colW - stampFit.info.width) / 2);
const stampY = titleH + labelH + Math.floor((imgH - stampFit.info.height) / 2);
const INK = { r: 0, g: 4, b: 12, alpha: 1 };
const px1 = await sharp({
  create: { width: 128, height: 128, channels: 4, background: INK },
})
  .composite([{ input: `${REVIEW}/${boxName}`, left: 0, top: 0 }])
  .png()
  .toBuffer();
const px4 = await sharp({
  create: { width: 512, height: 512, channels: 4, background: INK },
})
  .composite([
    {
      input: await sharp(`${REVIEW}/${boxName}`)
        .resize(512, 512, { kernel: "nearest" })
        .png()
        .toBuffer(),
      left: 0,
      top: 0,
    },
  ])
  .png()
  .toBuffer();

const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${w / 2}" y="30" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="20" fill="#DCD6CC">Vf1 ${label} · 左边印戳 · 中间才是入盒 128 · 未过 · 不写 frames/</text>
  <text x="${pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">印戳</text>
  <text x="${pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#E8C36A">入盒 128 · 原大</text>
  <text x="${pad + colW + pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">同一张 128 x4</text>
  <text x="${pad}" y="${h - 12}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">过目只问零件表。丢蕾丝网可以。换头 / 换裙 / 没角 = 废。不是锁稿。</text>
</svg>`);

await sharp({
  create: { width: w, height: h, channels: 4, background: SLATE },
})
  .composite([
    { input: stampFit.data, left: stampX, top: stampY },
    {
      input: px1,
      left: pad + colW + pad + Math.floor((colW - 128) / 2),
      top: titleH + labelH + Math.floor((imgH - 128) / 2),
    },
    {
      input: px4,
      left: pad + colW + pad + colW + pad + Math.floor((colW - 512) / 2),
      top: titleH + labelH,
    },
    { input: svg, left: 0, top: 0 },
  ])
  .png()
  .toFile(`${REVIEW}/${cardName}`);
copyFileSync(`${REVIEW}/${cardName}`, `${PARK}/${cardName}`);
}

const log = {
  label,
  stamp: abs,
  src: { width: raw.width, height: raw.height },
  extract: pick.box,
  holesFilled: pick.holesFilled,
  boxed: { dw: boxed.dw, dh: boxed.dh, ox: boxed.ox, oy: boxed.oy, scale: boxed.scale },
  stats: st,
};
writeFileSync(`${PARK}/box-${label}.json`, JSON.stringify(log, null, 2));
writeFileSync(`${REVIEW}/box-${label}.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log));
