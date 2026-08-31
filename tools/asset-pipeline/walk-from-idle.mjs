// walk-from-idle.mjs — 走循环：idle 底板只换腿，帽/灯/武器锁住，脚底 ΔY=0
// 用法：node walk-from-idle.mjs <走帧名>...
// 映射：foo-walk-a / foo-walk-b ← foo.png

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { resolveFrameSpec } from './frame-specs.mjs';
import { familyKey } from './layout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, '..', '..', 'assets', 'raw');

function sourceFor(variant) {
  const m = variant.match(/^(.*)-walk-([ab])$/);
  if (!m) throw new Error(`不支持的走帧 ${variant}`);
  return { base: m[1], phase: m[2] };
}

function rgbDist(p, q) {
  const dr = p[0] - q[0], dg = p[1] - q[1], db = p[2] - q[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function floodCut(data, width, height) {
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [
    sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1),
  ];
  const counts = new Map();
  for (const c of corners) {
    const k = c.join(',');
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let bg = corners[0], max = 0;
  for (const [k, v] of counts) {
    if (v > max) { max = v; bg = k.split(',').map(Number); }
  }
  const THRESH = 24;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const trySeed = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (rgbDist([data[i], data[i + 1], data[i + 2]], bg) > THRESH) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < width; x++) { trySeed(x, 0); trySeed(x, height - 1); }
  for (let y = 0; y < height; y++) { trySeed(0, y); trySeed(width - 1, y); }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    trySeed(x + 1, y); trySeed(x - 1, y); trySeed(x, y + 1); trySeed(x, y - 1);
  }
  const mask = Buffer.alloc(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = seen[i] ? 0 : 1;
  return { mask, bg };
}

function bboxFromMask(mask, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, bw: maxX - minX + 1, bh: maxY - minY + 1 };
}

function strideLegs(data, w, h, mask, bg, bb, phase, stride) {
  const out = Buffer.from(data);
  const hipY = bb.minY + Math.floor(bb.bh * 0.58);
  const midX = bb.minX + Math.floor(bb.bw * 0.5);
  const sign = phase === 'a' ? 1 : -1;
  // 钉死最底一截（鞋/袍摆），避免 lanczos 后脚底 ΔY 跳 1px
  const footLockY = bb.maxY - Math.max(8, Math.round(bb.bh * 0.12));
  const moved = [];
  for (let y = hipY; y <= footLockY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const idx = y * w + x;
      if (!mask[idx]) continue;
      const dx = (x >= midX ? sign * stride : -sign * Math.max(1, Math.round(stride * 0.45)));
      let nx = x + dx;
      if (nx < bb.minX) nx = bb.minX;
      if (nx > bb.maxX) nx = bb.maxX;
      if (nx === x) continue;
      moved.push({ x, y, nx });
    }
  }
  for (const { x, y } of moved) {
    const i = (y * w + x) * 4;
    out[i] = bg[0];
    out[i + 1] = bg[1];
    out[i + 2] = bg[2];
    out[i + 3] = data[i + 3];
  }
  for (const { x, y, nx } of moved) {
    const i = (y * w + x) * 4;
    const j = (y * w + nx) * 4;
    out[j] = data[i];
    out[j + 1] = data[i + 1];
    out[j + 2] = data[i + 2];
    out[j + 3] = data[i + 3];
  }
  return out;
}

async function run(variant) {
  const { base, phase } = sourceFor(variant);
  const spec = resolveFrameSpec(variant);
  if (!spec) throw new Error(`未知帧 ${variant}`);
  const srcPath = path.join(RAW_DIR, `${base}.png`);
  const dstPath = path.join(RAW_DIR, `${variant}.png`);
  if (!fs.existsSync(srcPath)) throw new Error(`缺底板 ${base}.png`);
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { mask, bg } = floodCut(data, info.width, info.height);
  const bb = bboxFromMask(mask, info.width, info.height);
  if (!bb) throw new Error(`${base} 抠图后无主体`);
  const targetOutPx = spec.w >= 96 ? 3.0 : 2.4;
  const stride = Math.max(2, Math.round(targetOutPx * bb.bh / spec.h));
  const walked = strideLegs(data, info.width, info.height, mask, bg, bb, phase, stride);
  await sharp(walked, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(dstPath);
  console.log(`[walk] ${variant} ← ${base}  腿横移 ${stride}px（目标约 ${targetOutPx}px @${spec.w}  phase ${phase}）`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('用法：node walk-from-idle.mjs <走帧名>...');
  process.exit(1);
}
for (const name of args) {
  await run(name);
}
console.log(`[walk] 族 ${[...new Set(args.map(familyKey))].join(', ')} 已写 raw，接着跑 process.mjs`);
