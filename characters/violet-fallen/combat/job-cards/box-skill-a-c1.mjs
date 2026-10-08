/**
 * 魔化 skill-a 候选：E1 C1 A 跟已过 B-lo idle 共用近邻缩放，脚底钉 idle footY。
 * 不写 assets/frames/。
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  alignOffsets,
  comparePair,
  computeSharedScale,
  familyKey,
  silhouetteMetrics,
  temporalLimits,
} from "../../../../tools/asset-pipeline/layout.mjs";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const REPO = "d:/code/vampire-survivors-like";
const CHAR = path.join(REPO, "characters", "violet-fallen");
const BOX = 128;
const MX = Math.max(1, Math.ceil(BOX * 0.05));
const FILL = { w: BOX - 2 * MX, h: BOX - 2 * MX };
const IDLE_128 = path.join(CHAR, "combat", "idle", "12-idle-blo-passed-128.png");
const IDLE_STAMP = path.join(CHAR, "stamps", "idle-blo.png");
const C1_STAMP = path.join(CHAR, "stamps", "poses", "02-e1-c1-a-raw.png");
const REVIEW = path.join(CHAR, "review", "20260918-skill-128");
const OUT = path.join(REVIEW, "shared-scale");
const SKILL = path.join(CHAR, "combat", "skill");
const SLATE = { r: 42, g: 52, b: 68, alpha: 1 };
const INK = { r: 0, g: 4, b: 12, alpha: 1 };

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
  return (
    a > 80 &&
    r > 150 &&
    g > 100 &&
    b > 70 &&
    r > b &&
    luma(r, g, b) > 130 &&
    luma(r, g, b) < 240
  );
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

async function loadRaw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: Buffer.from(data) };
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
    const r = srcData[o];
    const g = srcData[o + 1];
    const b = srcData[o + 2];
    const a = srcData[o + 3];
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
  const holesFilled = fillInteriorHoles(keep, sw, sh);
  let minX = sw;
  let maxX = 0;
  let minY = sh;
  let maxY = 0;
  let kept = 0;
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

function boundingBox(src) {
  let minX = src.width;
  let minY = src.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (src.data[(y * src.width + x) * 4 + 3] < 128) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function hardenAlpha(rgba) {
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = rgba[i] >= 160 ? 255 : 0;
}

async function boxNearest(crop, scale, footY) {
  const tw = Math.max(1, Math.round(crop.width * scale));
  const th = Math.max(1, Math.round(crop.height * scale));
  const fitted = await sharp(crop.data, {
    raw: { width: crop.width, height: crop.height, channels: 4 },
  })
    .resize(tw, th, { fit: "fill", kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const scaledBb = boundingBox({
    width: fitted.info.width,
    height: fitted.info.height,
    data: fitted.data,
  });
  const { ox } = alignOffsets(scaledBb, BOX, BOX, MX, MX);
  let oy = footY - scaledBb.maxY;
  if (oy + scaledBb.minY < 0) oy = -scaledBb.minY;
  if (oy + scaledBb.maxY >= BOX) oy = BOX - 1 - scaledBb.maxY;
  const canvas = Buffer.alloc(BOX * BOX * 4);
  let clipped = 0;
  for (let y = 0; y < fitted.info.height; y++) {
    for (let x = 0; x < fitted.info.width; x++) {
      const si = (y * fitted.info.width + x) * 4;
      if (fitted.data[si + 3] < 128) continue;
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= BOX || dy >= BOX) {
        clipped++;
        continue;
      }
      const di = (dy * BOX + dx) * 4;
      canvas[di] = fitted.data[si];
      canvas[di + 1] = fitted.data[si + 1];
      canvas[di + 2] = fitted.data[si + 2];
      canvas[di + 3] = 255;
    }
  }
  hardenAlpha(canvas);
  return {
    width: BOX,
    height: BOX,
    data: canvas,
    tw,
    th,
    ox,
    oy,
    footTarget: footY,
    clipped,
  };
}

async function writePng(raw, file) {
  await sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .png()
    .toFile(file);
}

async function slateX4(pngPath) {
  const buf = await sharp(pngPath)
    .resize(512, 512, { kernel: "nearest" })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 512, height: 512, channels: 4, background: INK },
  })
    .composite([{ input: buf, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

if (familyKey("hero-violet-fallen-skill-a") !== "hero-violet-fallen") {
  throw new Error("familyKey peeled -fallen; abort");
}

mkdirSync(OUT, { recursive: true });
mkdirSync(SKILL, { recursive: true });

const idle128 = await loadRaw(IDLE_128);
const idleMetrics = silhouetteMetrics(idle128.data, BOX, BOX);
const idlePick = extractFigure(await loadRaw(IDLE_STAMP));
const c1Pick = extractFigure(await loadRaw(C1_STAMP));

await writePng(idlePick.cropped, path.join(OUT, "crop-idle.png"));
await writePng(c1Pick.cropped, path.join(OUT, "crop-skill-a.png"));

const idleScale = computeSharedScale(
  [{ w: idlePick.cropped.width, h: idlePick.cropped.height }],
  FILL,
);

const boxed = await boxNearest(c1Pick.cropped, idleScale, idleMetrics.footY);
await writePng(boxed, path.join(OUT, "skill-a-128.png"));
await writePng(boxed, path.join(SKILL, "skill-a-128.png"));

const metrics = silhouetteMetrics(boxed.data, BOX, BOX);
const limits = temporalLimits("hero-violet-fallen", BOX, "hero-violet-fallen-skill-a");
const gate = comparePair(idleMetrics, metrics, limits);

copyFileSync(C1_STAMP, path.join(CHAR, "stamps", "poses", "skill-a-c1-raw.png"));
copyFileSync(C1_STAMP, path.join(OUT, "stamp-skill-a.png"));

const colW = 512;
const pad = 24;
const labelH = 36;
const titleH = 44;
const w = pad * 3 + colW * 2;
const h = titleH + labelH + 512 + pad + 28;
const idleX4 = await slateX4(IDLE_128);
const aX4 = await slateX4(path.join(OUT, "skill-a-128.png"));
const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${w / 2}" y="30" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="20" fill="#DCD6CC">魔化 skill-a · E1 C1 A · 跟 idle 共用缩放 · 未过 · 不写 frames/</text>
  <text x="${pad + colW / 2}" y="${titleH + 26}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">idle B-lo 128 已过</text>
  <text x="${pad + colW + pad + colW / 2}" y="${titleH + 26}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#E8C36A">skill-a · C1 A 叉腰</text>
  <text x="${pad}" y="${h - 10}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">scale=${idleScale.toFixed(4)} · 脚底 y${idleMetrics.footY} · 空手无烛 · 旧 C1 128 是单帧 contain，本卡重入盒</text>
</svg>`);

await sharp({
  create: { width: w, height: h, channels: 4, background: SLATE },
})
  .composite([
    { input: idleX4, left: pad, top: titleH + labelH },
    { input: aX4, left: pad * 2 + colW, top: titleH + labelH },
    { input: svg, left: 0, top: 0 },
  ])
  .png()
  .toFile(path.join(REVIEW, "05-pick-c1a-shared-card.png"));

const log = {
  pick: { "skill-a": "E1 C1 A (passed pose, reboxed to idle shared scale)" },
  idleScale,
  fill: FILL,
  family: familyKey("hero-violet-fallen-skill-a"),
  idleCrop: idlePick.box,
  idleMetrics,
  frames: [
    {
      id: "skill-a",
      frame: "hero-violet-fallen-skill-a",
      crop: c1Pick.box,
      holesFilled: c1Pick.holesFilled,
      placed: {
        tw: boxed.tw,
        th: boxed.th,
        ox: boxed.ox,
        oy: boxed.oy,
        clipped: boxed.clipped,
      },
      metrics,
      gate,
    },
  ],
};
writeFileSync(path.join(OUT, "box-log.json"), JSON.stringify(log, null, 2));
writeFileSync(path.join(SKILL, "box-log.json"), JSON.stringify(log, null, 2));
console.log(
  JSON.stringify(
    {
      idleScale,
      family: log.family,
      clipped: boxed.clipped,
      gate,
    },
    null,
    2,
  ),
);
