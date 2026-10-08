/**
 * Vo oath idle: D2 left-figure area box + Krea stamp box + slate x4 board.
 * Does not write assets/frames/. Does not overwrite locked D2 / O-3.
 *
 * node vo-idle-o3d2-box.mjs [krea.png ...]
 */
import { createRequire } from "module";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const ROOT = "d:/code/vampire-survivors-like/assets/ui-menu/preview";
const REPO = "d:/code/vampire-survivors-like";
const D2 = `${ROOT}/locked/color-keys/char-bible-violet-oath-color-key-d2.png`;
const O3 = `${ROOT}/locked/silhouettes/char-bible-violet-oath-lock-o3.png`;
const LIVE = process.env.C64_LIVE || `${REPO}/assets/frames/hero-violet.png`;
const PARK =
  process.env.C64_PARK || `${ROOT}/locked/combat-64/_park/vo-idle-o3d2`;
const REVIEW =
  process.env.C64_REVIEW || `${ROOT}/locked/review-h23-wave11`;
const SHEET = process.env.C64_SHEET || "left";
const BOX = Math.max(16, Number(process.env.C64_BOX || 64) || 64);
const SLATE = [42, 52, 68];
const INK = [0, 4, 12];

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}
function near(a, b, t) {
  return Math.abs(a - b) <= t;
}
function isFlame(r, g, b, a = 255) {
  return a > 80 && r > 170 && g > 70 && b < 130 && r > g + 20 && g > b;
}
function isPlume(r, g, b, a = 255) {
  return a > 80 && r > 140 && r > g + 40 && r > b + 35 && g < 90;
}

async function loadRaw(file) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width, height, data };
}

function sampleCorners(src) {
  const pts = [
    [6, 6],
    [src.width - 7, 6],
    [6, src.height - 7],
    [src.width - 7, src.height - 7],
    [src.width >> 1, 6],
  ];
  let r = 0,
    g = 0,
    b = 0;
  for (const [x, y] of pts) {
    const i = (y * src.width + x) * 4;
    r += src.data[i];
    g += src.data[i + 1];
    b += src.data[i + 2];
  }
  return [r / pts.length, g / pts.length, b / pts.length];
}

function isCoolSilver(r, g, b, a) {
  if (a < 80) return false;
  const L = luma(r, g, b);
  const c = chroma(r, g, b);
  return L > 145 && b - r >= 6 && c < 45;
}

function isPaperLike(r, g, b, a, bg) {
  if (a < 16) return true;
  if (isFlame(r, g, b, a)) return false;
  if (isCoolSilver(r, g, b, a)) return false;
  const L = luma(r, g, b);
  if (L < 110) return false;
  const bgL = luma(bg[0], bg[1], bg[2]);
  if (r >= b && Math.abs(L - bgL) < 48) return true;
  if (r > b + 6 && L > 140) return true;
  return (
    near(r, bg[0], 42) &&
    near(g, bg[1], 42) &&
    near(b, bg[2], 42) &&
    chroma(r, g, b) < 40
  );
}

function isInkVoid(r, g, b, a) {
  if (a < 16) return true;
  if (isFlame(r, g, b, a)) return false;
  // #00040C chroma is 12; 10 会把夜空当实体，整张 512 被当成骑士。
  return luma(r, g, b) <= 16 && chroma(r, g, b) <= 16;
}

function isLightStudio(r, g, b, a) {
  if (a < 16) return true;
  if (isFlame(r, g, b, a)) return false;
  if (isCoolSilver(r, g, b, a)) return false;
  const L = luma(r, g, b);
  const c = chroma(r, g, b);
  if (L > 200 && c < 22) return true;
  // 浅棚中灰。冷中钢（D2 骑士大面）不要当成棚。
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
    if (!pred(data[o], data[o + 1], data[o + 2], data[o + 3], x, y)) return;
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

function bboxFromMask(src, keep, x0, x1, y0, y1) {
  let minX = src.width,
    maxX = 0,
    minY = src.height,
    maxY = 0,
    n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * src.width + x;
      if (!keep(i, x, y)) continue;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, n };
}

function cropRgba(src, box) {
  const { minX, minY, w, h } = box;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    src.data.copy(
      data,
      y * w * 4,
      ((minY + y) * src.width + minX) * 4,
      ((minY + y) * src.width + minX + w) * 4,
    );
  }
  return { width: w, height: h, data };
}

function applyAlpha(src, keep) {
  const data = Buffer.from(src.data);
  for (let i = 0; i < src.width * src.height; i++) {
    if (keep(i)) continue;
    const o = i * 4;
    data[o] = 0;
    data[o + 1] = 0;
    data[o + 2] = 0;
    data[o + 3] = 0;
  }
  return { width: src.width, height: src.height, data };
}

function closedKeep(src) {
  const exterior = flood(src, (r, g, b, a) => a < 128);
  return (i) => !exterior[i];
}

function boxInto64(sprite) {
  const maxH = Math.round((BOX * 56) / 64);
  const maxW = Math.round((BOX * 44) / 64);
  let scale = Math.min(maxH / sprite.height, maxW / sprite.width);
  let dw = Math.max(1, Math.round(sprite.width * scale));
  let dh = Math.max(1, Math.round(sprite.height * scale));
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

function stats64(spr) {
  const box = spr.width;
  let opaque = 0,
    flame = 0,
    silver = 0,
    skin = 0,
    holes = 0;
  const keep = closedKeep(spr);
  for (let i = 0; i < box * box; i++) {
    const o = i * 4;
    const r = spr.data[o],
      g = spr.data[o + 1],
      b = spr.data[o + 2],
      a = spr.data[o + 3];
    if (keep(i) && a < 128) holes++;
    if (a < 128) continue;
    opaque++;
    if (isFlame(r, g, b, a)) flame++;
    if (isPlume(r, g, b, a)) flame++;
    if (isCoolSilver(r, g, b, a)) silver++;
    if (r > 150 && g > 100 && b > 70 && r > b && g > b && luma(r, g, b) > 130 && luma(r, g, b) < 210)
      skin++;
  }
  let headTop = box,
    headPx = 0;
  const headH = Math.round((box * 12) / 64);
  for (let y = 0; y < box; y++) {
    let row = 0;
    for (let x = 0; x < box; x++) {
      if (spr.data[(y * box + x) * 4 + 3] >= 128) row++;
    }
    if (row > 0) {
      if (y < headTop) headTop = y;
      if (y < headTop + headH) headPx += row;
    }
  }
  return { opaque, flame, silver, skin, holes, headTop, headPx, box };
}

async function writePng(raw, file) {
  await sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .png()
    .toFile(file);
}

function solidOnSlate(spr, scale) {
  const keep = closedKeep(spr);
  const w = spr.width * scale;
  const h = spr.height * scale;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(y / scale);
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x / scale);
      const i = sy * spr.width + sx;
      const o = (y * w + x) * 4;
      if (!keep(i)) {
        data[o] = SLATE[0];
        data[o + 1] = SLATE[1];
        data[o + 2] = SLATE[2];
        data[o + 3] = 255;
        continue;
      }
      const so = i * 4;
      if (spr.data[so + 3] >= 128) {
        data[o] = spr.data[so];
        data[o + 1] = spr.data[so + 1];
        data[o + 2] = spr.data[so + 2];
        data[o + 3] = 255;
      } else {
        data[o] = INK[0];
        data[o + 1] = INK[1];
        data[o + 2] = INK[2];
        data[o + 3] = 255;
      }
    }
  }
  return { width: w, height: h, data };
}

function blitRaw(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
      const si = (y * src.width + x) * 4;
      const di = (ty * dst.width + tx) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = 255;
    }
  }
}

function fillRect(dst, x0, y0, x1, y1, rgb) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= dst.width || y >= dst.height) continue;
      const i = (y * dst.width + x) * 4;
      dst.data[i] = rgb[0];
      dst.data[i + 1] = rgb[1];
      dst.data[i + 2] = rgb[2];
      dst.data[i + 3] = 255;
    }
  }
}

function extractFigure(src, { voidInk = true, sheetLeft = false, sheetRight = false } = {}) {
  const bg = sampleCorners(src);
  const light = luma(bg[0], bg[1], bg[2]) > 90;
  const paper = flood(src, (r, g, b, a) => {
    if (!voidInk) return isPaperLike(r, g, b, a, bg);
    // 从边往里：墨空 + 浅棚。不要在 keep 里再按浅灰抹一次，否则中钢甲会被挖空。
    return isInkVoid(r, g, b, a) || isLightStudio(r, g, b, a);
  });
  let x0 = 0;
  let x1 = src.width - 1;
  let y0 = 0;
  let y1 = src.height - 1;
  if (sheetLeft && !sheetRight) {
    x1 = Math.floor(src.width * 0.48);
    y0 = Math.floor(src.height * 0.06);
    y1 = Math.floor(src.height * 0.82);
  }
  if (sheetRight) {
    x0 = Math.floor(src.width * 0.5);
    y0 = Math.floor(src.height * 0.04);
    y1 = Math.floor(src.height * 0.9);
  }
  const keepIdx = (i) => {
    const o = i * 4;
    const r = src.data[o],
      g = src.data[o + 1],
      b = src.data[o + 2],
      a = src.data[o + 3];
    if (a <= 80) return false;
    if (paper[i]) return false;
    return true;
  };
  const box = bboxFromMask(src, keepIdx, x0, x1, y0, y1);
  const keyed = applyAlpha(src, keepIdx);
  const cropped = cropRgba(keyed, box);
  return { bg, box, cropped, mode: voidInk ? "void" : "paper" };
}

function liveToRgba(src) {
  const data = Buffer.from(src.data);
  for (let i = 0; i < src.width * src.height; i++) {
    const o = i * 4;
    if (isInkVoid(data[o], data[o + 1], data[o + 2], data[o + 3])) {
      data[o + 3] = 0;
    }
  }
  return { width: src.width, height: src.height, data };
}

async function thumbFit(file, maxW, maxH) {
  const buf = await sharp(file)
    .resize(maxW, maxH, { fit: "inside", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: buf.info.width, height: buf.info.height, data: buf.data };
}

mkdirSync(PARK, { recursive: true });
mkdirSync(REVIEW, { recursive: true });

const d2 = await loadRaw(D2);
const d2Ex = extractFigure(d2, {
  voidInk: false,
  sheetLeft: SHEET !== "right",
  sheetRight: SHEET === "right",
});
const d2Box = boxInto64(d2Ex.cropped);
const d2CropName = SHEET === "right" ? "d2-knight-crop.png" : "d2-woman-crop.png";
const d2CutName = `03-cut-d2-${BOX}.png`;
await writePng(d2Ex.cropped, `${PARK}/${d2CropName}`);
await writePng(d2Box, `${PARK}/${d2CutName}`);

const live = liveToRgba(await loadRaw(LIVE));

const kreaArgs = process.argv.slice(2);
const kreaLabels = (process.env.C64_LABELS || "A,A2,B").split(",");
const kreaShort = (
  process.env.C64_SHORT || "04-krea-a-64.png,05-krea-a2-64.png,06-krea-b-64.png"
).split(",");
const kreaBoxed = [];
for (const file of kreaArgs) {
  const abs = path.resolve(file);
  if (!existsSync(abs)) {
    console.warn("missing", abs);
    continue;
  }
  const raw = await loadRaw(abs);
  const pick = extractFigure(raw, { voidInk: true });
  const boxed = boxInto64(pick.cropped);
  const base = path.basename(abs).replace(/\.png$/i, "");
  const idx = kreaBoxed.length;
  const label = kreaLabels[idx] || `K${idx + 1}`;
  const short = kreaShort[idx] || `${String(4 + idx).padStart(2, "0")}-${base}-64.png`;
  await writePng(pick.cropped, `${PARK}/${base}-crop.png`);
  await writePng(boxed, `${PARK}/${base}-64.png`);
  await writePng(boxed, `${PARK}/${short}`);
  copyFileSync(abs, `${PARK}/krea-${label}-raw.png`);
  kreaBoxed.push({
    file: abs,
    base,
    label,
    short,
    pick: pick.mode,
    box: pick.box,
    boxed,
    stats: stats64(boxed),
  });
}

const panels = [
  { title: process.env.C64_LIVE_TITLE || "live old nun", spr: live },
  { title: process.env.C64_D2_TITLE || "D2 cut (area)", spr: d2Box },
  ...kreaBoxed.map((k) => ({
    title: `${process.env.C64_PREFIX || "Krea "}${k.label}`,
    spr: k.boxed,
  })),
];

const scale1 = 3;
const scale4 = 4;
const gap = 16;
const labelH = 28;
const tile1 = BOX * scale1;
const tile4 = BOX * scale4;
const cols = panels.length;
const boardW = gap + cols * (tile4 + gap);
const boardH = 36 + labelH + tile1 + 24 + labelH + tile4 + 24 + 220;
const board = {
  width: boardW,
  height: boardH,
  data: Buffer.alloc(boardW * boardH * 4),
};
fillRect(board, 0, 0, boardW - 1, boardH - 1, SLATE);

let x = gap;
for (const p of panels) {
  blitRaw(board, solidOnSlate(p.spr, scale1), x + Math.floor((tile4 - tile1) / 2), 36 + labelH);
  x += tile4 + gap;
}
x = gap;
const y4 = 36 + labelH + tile1 + 24 + labelH;
for (const p of panels) {
  blitRaw(board, solidOnSlate(p.spr, scale4), x, y4);
  x += tile4 + gap;
}

const o3t = await thumbFit(O3, 300, 200);
const d2t = await thumbFit(D2, 300, 200);
const footY = y4 + tile4 + 16;
blitRaw(board, o3t, gap, footY);
blitRaw(board, d2t, gap + 320, footY);

const tmpBoard = `${PARK}/06-review-board-raw.png`;
await writePng(board, tmpBoard);

const labels = Buffer.from(
  `<svg width="${boardW}" height="${boardH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${boardW / 2}" y="26" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="18" fill="#DCD6CC">${process.env.C64_BOARD_TITLE || `idle ${BOX} · O-3+D2 · not locked · not frames/`}</text>
    ${panels
      .map((p, i) => {
        const tx = gap + i * (tile4 + gap) + tile4 / 2;
        return `<text x="${tx}" y="${36 + 18}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">${p.title} 1x</text>
    <text x="${tx}" y="${y4 - 8}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">${p.title} x4</text>`;
      })
      .join("\n")}
    <text x="${gap}" y="${footY + 214}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="12" fill="#DCD6CC">${process.env.C64_NOTE || "shape O-3 · color D2 · not locked · not frames/"}</text>
  </svg>`,
);
const labeled = `${PARK}/06-review-board.png`;
await sharp(tmpBoard)
  .composite([{ input: labels, top: 0, left: 0 }])
  .png()
  .toFile(labeled);

copyFileSync(O3, `${REVIEW}/01-silhouette-o3.png`);
copyFileSync(D2, `${REVIEW}/02-color-key-d2.png`);
copyFileSync(`${PARK}/${d2CutName}`, `${REVIEW}/${d2CutName}`);
kreaBoxed.forEach((k) => {
  copyFileSync(`${PARK}/${k.short}`, `${REVIEW}/${k.short}`);
});
copyFileSync(labeled, `${PARK}/07-review-board.png`);
copyFileSync(labeled, `${REVIEW}/07-review-board.png`);
for (const stale of [
  `${REVIEW}/06-review-board.png`,
  `${REVIEW}/04-comfy_lan_vo_idle_a_00001_-64.png`,
  `${REVIEW}/05-comfy_lan_vo_idle_a2_00001_-64.png`,
  `${REVIEW}/06-comfy_lan_vo_idle_b_00001_-64.png`,
]) {
  if (existsSync(stale)) unlinkSync(stale);
}

const log = {
  d2: { box: d2Ex.box, bg: d2Ex.bg, boxed: { dw: d2Box.dw, dh: d2Box.dh }, stats: stats64(d2Box) },
  krea: kreaBoxed.map((k) => ({
    file: k.file,
    label: k.label,
    short: k.short,
    mode: k.pick,
    srcBox: k.box,
    dw: k.boxed.dw,
    dh: k.boxed.dh,
    stats: k.stats,
  })),
};
writeFileSync(`${PARK}/box-log.json`, JSON.stringify(log, null, 2));
writeFileSync(`${REVIEW}/box-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
console.log("park", PARK);
console.log("review", REVIEW);
if (existsSync(tmpBoard)) {
  /* keep raw for debug */
}
