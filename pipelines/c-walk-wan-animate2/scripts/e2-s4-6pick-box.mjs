/**
 * E2 S4: flood-key 12 picks, P-6 shared nearest 128 per gun.
 * Does not write assets/frames/. Does not overwrite idle.
 *
 * node e2-s4-6pick-box.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  alignOffsets,
  comparePair,
  computeSharedScale,
  silhouetteMetrics,
  temporalLimits,
} from "../../../../../../tools/asset-pipeline/layout.mjs";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const BOX = 128;
const MX = Math.max(1, Math.ceil(BOX * 0.05));
const FILL = { w: BOX - 2 * MX, h: BOX - 2 * MX };
const START = 50;
const THRESH = 28;

const PARK =
  "d:/code/vampire-survivors-like/characters/violet-oath/combat/walk/e2-s4-6pick-box";
const IDLE =
  "d:/code/vampire-survivors-like/characters/violet-oath/combat/idle/hero-violet-idle-128-v1.png";

const PHASES = ["a", "e", "b", "c", "f", "d"];
const GUNS = [
  {
    id: "s2-a",
    park: "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/2026-09-12T08-19-52-138Z",
    prefix: "comfy_lan_e2_s4_s2_a",
    frames: { a: 9, e: 12, b: 14, c: 18, f: 20, d: 23 },
  },
  {
    id: "s3c-b",
    park: "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/2026-09-12T08-53-04-910Z",
    prefix: "comfy_lan_e2_s4_s3c_b",
    frames: { a: 9, e: 12, b: 14, c: 17, f: 19, d: 22 },
  },
];

function srcPath(g, f) {
  const n = String(START + f - 1).padStart(5, "0");
  return `${g.park}/${g.prefix}_${n}_.png`;
}

function rgbDist(p, q) {
  const dr = p[0] - q[0];
  const dg = p[1] - q[1];
  const db = p[2] - q[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isInkVoid(r, g, b, a = 255) {
  return a < 16 || (luma(r, g, b) <= 16 && chroma(r, g, b) <= 16);
}

async function loadRaw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: Buffer.from(data) };
}

function knockInk(src) {
  const data = Buffer.from(src.data);
  for (let i = 0; i < src.width * src.height; i++) {
    const o = i * 4;
    if (isInkVoid(data[o], data[o + 1], data[o + 2], data[o + 3])) data[o + 3] = 0;
  }
  return { width: src.width, height: src.height, data };
}

function floodStudio(src) {
  const { width, height, data } = src;
  const out = Buffer.from(data);
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    return [out[i], out[i + 1], out[i + 2]];
  };
  const pts = [sample(8, 8), sample(width - 9, 8), sample(width >> 1, 8)];
  const bg = [0, 1, 2].map((c) =>
    Math.round(pts.reduce((s, p) => s + p[c], 0) / pts.length),
  );
  const seen = new Uint8Array(width * height);
  const stack = [];
  const trySeed = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (rgbDist([out[i], out[i + 1], out[i + 2]], bg) > THRESH) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }
  let removed = 0;
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    out[idx * 4 + 3] = 0;
    removed++;
    trySeed(x - 1, y);
    trySeed(x + 1, y);
    trySeed(x, y - 1);
    trySeed(x, y + 1);
  }
  return { width, height, data: out, bg, removed };
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

function cropRgba(src, box) {
  const pad = 1;
  const left = Math.max(0, box.minX - pad);
  const top = Math.max(0, box.minY - pad);
  const w = Math.min(src.width - left, box.w + pad * 2);
  const h = Math.min(src.height - top, box.h + pad * 2);
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    src.data.copy(
      data,
      y * w * 4,
      ((top + y) * src.width + left) * 4,
      ((top + y) * src.width + left + w) * 4,
    );
  }
  return { width: w, height: h, data };
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
  const footTarget = footY;
  let oy = footTarget - scaledBb.maxY;
  if (oy + scaledBb.minY < 0) oy = -scaledBb.minY;
  if (oy + scaledBb.maxY >= BOX) oy = BOX - 1 - scaledBb.maxY;
  const canvas = Buffer.alloc(BOX * BOX * 4);
  for (let y = 0; y < fitted.info.height; y++) {
    for (let x = 0; x < fitted.info.width; x++) {
      const si = (y * fitted.info.width + x) * 4;
      if (fitted.data[si + 3] < 128) continue;
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= BOX || dy >= BOX) continue;
      const di = (dy * BOX + dx) * 4;
      canvas[di] = fitted.data[si];
      canvas[di + 1] = fitted.data[si + 1];
      canvas[di + 2] = fitted.data[si + 2];
      canvas[di + 3] = 255;
    }
  }
  hardenAlpha(canvas);
  return { width: BOX, height: BOX, data: canvas, tw, th, ox, oy, footTarget };
}

async function writePng(raw, file) {
  await sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .png()
    .toFile(file);
}

mkdirSync(PARK, { recursive: true });

const idleRaw = knockInk(await loadRaw(IDLE));
if (idleRaw.width !== BOX || idleRaw.height !== BOX) {
  throw new Error(`idle is ${idleRaw.width}x${idleRaw.height}, expected ${BOX}`);
}
await writePng(idleRaw, `${PARK}/idle-128-knock.png`);
const idleMetrics = silhouetteMetrics(idleRaw.data, BOX, BOX);

const log = { thresh: THRESH, fill: FILL, margin: MX, shared: {}, frames: [] };

for (const g of GUNS) {
  const keyed = [];
  for (const ph of PHASES) {
    const f = g.frames[ph];
    const flooded = floodStudio(await loadRaw(srcPath(g, f)));
    const bb = boundingBox(flooded);
    if (!bb) throw new Error(`empty ${g.id} ${ph}`);
    const crop = cropRgba(flooded, bb);
    await writePng(crop, `${PARK}/${g.id}-${ph}-crop.png`);
    keyed.push({ ph, f, file: srcPath(g, f).split("/").pop(), bb, crop, bg: flooded.bg });
  }
  const sharedScale = computeSharedScale(
    keyed.map((k) => ({ w: k.crop.width, h: k.crop.height })),
    FILL,
  );
  log.shared[g.id] = sharedScale;
  for (const k of keyed) {
    const boxed = await boxNearest(k.crop, sharedScale, idleMetrics.footY);
    const name = `${g.id}-walk-${k.ph}-128.png`;
    await writePng(boxed, `${PARK}/${name}`);
    const metrics = silhouetteMetrics(boxed.data, BOX, BOX);
    const limits = temporalLimits("hero-violet", BOX, `hero-violet-walk-${k.ph}`);
    const gate = comparePair(idleMetrics, metrics, limits);
    log.frames.push({
      gun: g.id,
      phase: k.ph,
      srcFrame: k.f,
      file: k.file,
      name,
      crop: { w: k.crop.width, h: k.crop.height },
      placed: { tw: boxed.tw, th: boxed.th, ox: boxed.ox, oy: boxed.oy, footTarget: boxed.footTarget },
      metrics,
      gate,
    });
  }
}

writeFileSync(`${PARK}/box-log.json`, JSON.stringify({ idleMetrics, ...log }, null, 2));
console.log(JSON.stringify({ shared: log.shared, n: log.frames.length }, null, 2));
console.log("park", PARK);
