// breathe-from-idle.mjs — 时间轴 FAIL 兜底：以 idle/skill-a raw 为底板，脚锁定、胸腔上扩
// 用法：node breathe-from-idle.mjs <变体帧名>...
// 映射：foo-v ← foo.png；hero-galvan-skill-b ← hero-galvan-skill-a.png

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { resolveFrameSpec } from './frame-specs.mjs';
import { familyKey } from './layout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, '..', '..', 'assets', 'raw');

function sourceFor(variant) {
  if (variant === 'hero-galvan-skill-b') return 'hero-galvan-skill-a';
  if (variant.endsWith('-v')) return variant.slice(0, -2);
  throw new Error(`不支持的变体 ${variant}`);
}

function bbox(data, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 128) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, bw: maxX - minX + 1, bh: maxY - minY + 1 };
}

function puffUp(data, w, h, shift) {
  const bb = bbox(data, w, h);
  if (!bb || shift <= 0) return data;
  const chest0 = bb.minY + Math.floor(bb.bh * 0.22);
  const chest1 = bb.minY + Math.floor(bb.bh * 0.58);
  const out = Buffer.from(data);
  for (let y = chest0; y <= chest1; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const ny = y - shift;
      if (ny < 0) continue;
      const j = (ny * w + x) * 4;
      if (out[j + 3] < 128) {
        out[j] = data[i];
        out[j + 1] = data[i + 1];
        out[j + 2] = data[i + 2];
        out[j + 3] = data[i + 3];
      }
    }
  }
  return out;
}

async function run(variant) {
  const srcName = sourceFor(variant);
  const spec = resolveFrameSpec(variant);
  if (!spec) throw new Error(`未知帧 ${variant}`);
  const srcPath = path.join(RAW_DIR, `${srcName}.png`);
  const dstPath = path.join(RAW_DIR, `${variant}.png`);
  if (!fs.existsSync(srcPath)) throw new Error(`缺底板 ${srcName}.png`);
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bb = bbox(data, info.width, info.height);
  if (!bb) throw new Error(`${srcName} 无主体`);
  const targetOutPx = spec.w >= 240 ? 2.0 : spec.w >= 96 ? 1.4 : 1.15;
  const shift = Math.max(2, Math.round(targetOutPx * bb.bh / spec.h));
  const puffed = puffUp(data, info.width, info.height, shift);
  await sharp(puffed, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(dstPath);
  console.log(`[breathe] ${variant} ← ${srcName}  胸腔上扩 ${shift}px（目标约 ${targetOutPx}px @${spec.w}）`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('用法：node breathe-from-idle.mjs <变体帧名>...');
  process.exit(1);
}
for (const name of args) {
  await run(name);
}
console.log(`[breathe] 族 ${[...new Set(args.map(familyKey))].join(', ')} 已写 raw，接着跑 process.mjs`);
