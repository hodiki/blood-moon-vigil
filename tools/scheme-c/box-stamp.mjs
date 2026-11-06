// Turn a 1024/1344 stamp into a hard-alpha 128 battle frame.
//
//   node tools/scheme-c/box-stamp.mjs <raw.png> <out.png> [--fill=114] [--box=128]
//
// Flood-keys the plain background from the four edges, trims to the figure,
// scales so the figure fits the fill box, drops it with the foot on the bottom
// row (the shipped 128 frames all sit at y=127) and thresholds alpha so the
// result is hard, not feathered.
import { createRequire } from 'node:module';
import { readRgba, writeRgba } from './read-png.mjs';

const require = createRequire(new URL('../asset-pipeline/package.json', import.meta.url));
const sharp = require('sharp');

export function floodKey(img, threshold = 26) {
  const { rgba, width: W, height: H } = img;
  const bg = [rgba[0], rgba[1], rgba[2]];
  const near = (i) =>
    Math.abs(rgba[i] - bg[0]) + Math.abs(rgba[i + 1] - bg[1]) + Math.abs(rgba[i + 2] - bg[2]) <= threshold;
  const out = Buffer.from(rgba);
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    const p = y * W + x;
    if (seen[p]) return;
    if (!near(p * 4)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    out[p * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  return { rgba: out, width: W, height: H };
}

export function contentBox(img) {
  const { rgba, width: W, height: H } = img;
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (rgba[(y * W + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('empty after key');
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// A 128 frame gives the face about 8x10 px. Downscaling from 1024 averages the
// eye into the skin and it stops reading. This writes one deterministic pixel at
// the darkest point of the face instead of leaving a smudge: same place every
// time, no hand placement, no added shapes.
function stampEye(out, box, figTop, figH, figX0, figX1) {
  // 1) locate the face: bright, warm pixels in the top quarter of the figure
  const yTop = figTop;
  const yBot = figTop + Math.round(figH * 0.26);
  let fx0 = box, fx1 = -1, fy0 = box, fy1 = -1;
  for (let y = yTop; y <= yBot; y++) {
    for (let x = figX0; x <= figX1; x++) {
      const i = (y * box + x) * 4;
      if (out[i + 3] !== 255) continue;
      const L = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
      if (L < 135) continue;
      if (!(out[i] >= out[i + 1] && out[i + 1] >= out[i + 2])) continue;
      if (x < fx0) fx0 = x;
      if (x > fx1) fx1 = x;
      if (y < fy0) fy0 = y;
      if (y > fy1) fy1 = y;
    }
  }
  if (fx1 < 0) return null;
  // 2) one pixel at the face centre, dropped two steps in value: deterministic,
  //    always lands on the face, never on the jaw shadow.
  const cx = Math.round((fx0 + fx1) / 2);
  const cy = Math.round((fy0 + fy1) / 2);
  const pi = (cy * box + cx) * 4;
  if (out[pi + 3] !== 255) return null;
  const best = pi;
  const bestL = 0.2126 * out[best] + 0.7152 * out[best + 1] + 0.0722 * out[best + 2];
  out[best] = Math.round(out[best] * 0.42);
  out[best + 1] = Math.round(out[best + 1] * 0.30);
  out[best + 2] = Math.round(out[best + 2] * 0.34);
  return { x: (best / 4) % box, y: Math.floor(best / 4 / box), before: +bestL.toFixed(1), face: [fx0, fy0, fx1, fy1] };
}

export async function boxStamp(rawPath, outPath, { box = 128, fill = 114, footRow = null, eye = false } = {}) {
  const img = await readRgba(rawPath);
  const keyed = floodKey(img);
  const bb = contentBox(keyed);

  // area-average the figure down to the fill box, keeping alpha for the threshold
  const scale = Math.min(fill / bb.w, fill / bb.h);
  const w = Math.max(1, Math.round(bb.w * scale));
  const hgt = Math.max(1, Math.round(bb.h * scale));
  const cropped = Buffer.alloc(bb.w * bb.h * 4, 0);
  for (let y = 0; y < bb.h; y++) {
    keyed.rgba.copy(cropped, y * bb.w * 4, ((y + bb.minY) * img.width + bb.minX) * 4, ((y + bb.minY) * img.width + bb.minX + bb.w) * 4);
  }
  const small = await sharp(cropped, { raw: { width: bb.w, height: bb.h, channels: 4 } })
    .resize(w, hgt, { kernel: 'lanczos3' })
    .raw()
    .toBuffer();

  const foot = footRow ?? box - 1;
  const ox = Math.floor((box - w) / 2);
  const oy = foot - hgt + 1;
  const out = Buffer.alloc(box * box * 4, 0);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      if (small[si + 3] < 128) continue;
      const di = ((y + oy) * box + x + ox) * 4;
      out[di] = small[si];
      out[di + 1] = small[si + 1];
      out[di + 2] = small[si + 2];
      out[di + 3] = 255;
    }
  }
  // Area-averaging can leave the last row just under the alpha threshold, which
  // parks the sole a row or two above the foot line. Snap it back down: three
  // separate batches shipped with foot=126 before this was handled here.
  let maxY = -1;
  for (let y = box - 1; y >= 0 && maxY < 0; y--) {
    for (let x = 0; x < box; x++) {
      if (out[(y * box + x) * 4 + 3] === 255) { maxY = y; break; }
    }
  }
  const shift = maxY >= 0 ? foot - maxY : 0;
  if (shift > 0) {
    const moved = Buffer.alloc(out.length, 0);
    for (let y = box - 1; y >= 0; y--) {
      const ty = y + shift;
      if (ty >= box) continue;
      out.copy(moved, ty * box * 4, y * box * 4, (y + 1) * box * 4);
    }
    moved.copy(out);
  }

  let eyeAt = null;
  if (eye) eyeAt = stampEye(out, box, oy, hgt, ox, ox + w);
  await writeRgba(outPath, out, box, box);
  return { w, h: hgt, ox, oy, foot, sourceW: bb.w, sourceH: bb.h, eyeAt };
}

if (process.argv[1]?.endsWith('box-stamp.mjs')) {
  const [rawPath, outPath, ...rest] = process.argv.slice(2);
  if (!rawPath || !outPath) {
    console.error('usage: node tools/scheme-c/box-stamp.mjs <raw.png> <out.png> [--fill=114] [--foot=127]');
    process.exit(1);
  }
  const fill = Number((rest.find((a) => a.startsWith('--fill=')) || '--fill=114').slice(7));
  const foot = Number((rest.find((a) => a.startsWith('--foot=')) || '--foot=127').slice(7));
  const eye = rest.includes('--eye');
  console.log(JSON.stringify(await boxStamp(rawPath, outPath, { fill, footRow: foot, eye })));
}
