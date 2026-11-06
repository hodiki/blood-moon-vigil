// Pick six Wan frames, cut the black void, normalise the body size and box them
// to the 128 battle frame.
//
//   node tools/scheme-c/pick-walk-frames.mjs <rawDir> <outDir> <prefix> <indices> [--fill=112]
//
// The drive clip is not walk-in-place: the figure grows ~14% and drifts across
// the canvas. A shared scale would leave the body pulsing, so each frame is
// scaled so its own content height is `fill`, then centred and dropped with the
// foot on the bottom row. Stride survives; camera drift does not.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { readRgba, writeRgba } from "./read-png.mjs";

const require = createRequire(new URL("../asset-pipeline/package.json", import.meta.url));
const sharp = require("sharp");

const LETTERS = ["a", "e", "b", "c", "f", "d"];

function keyBlack(rgba, W, H, threshold = 24) {
  const out = Buffer.alloc(rgba.length, 0);
  const seen = new Uint8Array(W * H);
  const dark = (p) => rgba[p * 4] + rgba[p * 4 + 1] + rgba[p * 4 + 2] <= threshold;
  const stack = [];
  const push = (x, y) => {
    const p = y * W + x;
    if (seen[p] || !dark(p)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  for (let p = 0; p < W * H; p++) {
    if (seen[p]) continue;
    out[p * 4] = rgba[p * 4];
    out[p * 4 + 1] = rgba[p * 4 + 1];
    out[p * 4 + 2] = rgba[p * 4 + 2];
    out[p * 4 + 3] = 255;
  }
  return { rgba: out, width: W, height: H };
}

function bbox(img) {
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
  if (maxX < 0) throw new Error("frame is empty after key");
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const [rawDir, outDir, prefix, indexArg, ...rest] = process.argv.slice(2);
if (!rawDir || !outDir || !prefix || !indexArg) {
  console.error("usage: node tools/scheme-c/pick-walk-frames.mjs <rawDir> <outDir> <prefix> <4,6,9,13,15,18> [--fill=112]");
  process.exit(1);
}
const fill = Number((rest.find((a) => a.startsWith("--fill=")) || "--fill=112").slice(7));
const picks = indexArg.split(",").map(Number);
if (picks.length !== 6) throw new Error("need six indices");

const files = fs.readdirSync(rawDir).filter((f) => f.endsWith(".png") && !f.includes("loop")).sort();
fs.mkdirSync(outDir, { recursive: true });

// Two passes. Pass 1 keys every pick and finds the tallest figure; that height
// sets ONE scale for the whole cycle. Scaling each frame to the same height
// instead makes the body grow and shrink with the stride, which reads as a
// bounce even when the poses are right.
const measured = [];
for (let i = 0; i < 6; i++) {
  const file = files[picks[i] - 1];
  if (!file) throw new Error(`no frame ${picks[i]}`);
  const img = await readRgba(path.join(rawDir, file));
  const keyed = keyBlack(img.rgba, img.width, img.height);
  measured.push({ file, img, keyed, bb: bbox(keyed) });
}
const sharedScale = fill / Math.max(...measured.map((m) => m.bb.h));

const report = [];
for (let i = 0; i < 6; i++) {
  const { file, img, keyed, bb } = measured[i];
  const scale = sharedScale;
  const w = Math.max(1, Math.round(bb.w * scale));
  const h = Math.max(1, Math.round(bb.h * scale));
  const cropped = Buffer.alloc(bb.w * bb.h * 4, 0);
  for (let y = 0; y < bb.h; y++) {
    keyed.rgba.copy(cropped, y * bb.w * 4, ((y + bb.minY) * img.width + bb.minX) * 4, ((y + bb.minY) * img.width + bb.minX + bb.w) * 4);
  }
  const small = await sharp(cropped, { raw: { width: bb.w, height: bb.h, channels: 4 } })
    .resize(w, h, { kernel: "lanczos3" })
    .raw()
    .toBuffer();

  // The bounding box is dominated by the swinging coat and the ponytail, so
  // centring on it makes the body slide left and right every frame (measured
  // 10.5 px of torso drift across six frames). Anchor on the torso instead:
  // the horizontal centroid of the rows between 45% and 62% of the height.
  const BOX = 128;
  const bandTop = Math.round(h * 0.45);
  const bandBot = Math.round(h * 0.62);
  let sumX = 0, count = 0;
  for (let y = bandTop; y < bandBot; y++) {
    for (let x = 0; x < w; x++) {
      if (small[(y * w + x) * 4 + 3] < 128) continue;
      sumX += x;
      count++;
    }
  }
  const torsoCx = count ? sumX / count : w / 2;
  const ox = Math.round(BOX / 2 - torsoCx);
  const oy = BOX - h;
  let out = Buffer.alloc(BOX * BOX * 4, 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      if (small[si + 3] < 128) continue;
      const di = ((y + oy) * BOX + x + ox) * 4;
      out[di] = small[si];
      out[di + 1] = small[si + 1];
      out[di + 2] = small[si + 2];
      out[di + 3] = 255;
    }
  }
  // Lanczos leaves the last row under the alpha threshold on some frames, so the
  // content lands a few rows above the foot line. Snap it down to 127.
  let maxY = -1;
  for (let y = BOX - 1; y >= 0 && maxY < 0; y--) {
    for (let x = 0; x < BOX; x++) {
      if (out[(y * BOX + x) * 4 + 3] === 255) { maxY = y; break; }
    }
  }
  if (maxY >= 0 && maxY !== BOX - 1) {
    const shift = BOX - 1 - maxY;
    const moved = Buffer.alloc(out.length, 0);
    for (let y = BOX - 1; y >= 0; y--) {
      const ty = y + shift;
      if (ty >= BOX) continue;
      out.copy(moved, ty * BOX * 4, y * BOX * 4, (y + 1) * BOX * 4);
    }
    out = moved;
  }

  const name = `${prefix}-walk-${LETTERS[i]}`;
  await writeRgba(path.join(outDir, `${name}.png`), out, BOX, BOX);
  report.push({ name, frame: picks[i], sourceH: bb.h, w, ox, oy });
}
console.log(JSON.stringify(report, null, 2));
