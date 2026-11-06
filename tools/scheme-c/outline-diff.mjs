// Visual diff of a 64px block render against the live sprite.
// white = both, red = only live (missing), green = only block (invented).
import path from 'node:path';
import { outlineOverlap } from './outline-overlap.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

const RED = [220, 60, 60, 255];
const GREEN = [70, 210, 120, 255];
const WHITE = [235, 235, 235, 255];

export function diffMasks(live, block) {
  const { dy } = outlineOverlap(live, block);
  const src = Buffer.alloc(64 * 64 * 4, 0);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const ly = y + dy;
      const liveOn = ly >= 0 && ly < 64 && live.rgba[(ly * 64 + x) * 4 + 3] === 255;
      const blockOn = block.rgba[(y * 64 + x) * 4 + 3] === 255;
      let c = null;
      if (liveOn && blockOn) c = WHITE;
      else if (liveOn) c = RED;
      else if (blockOn) c = GREEN;
      if (!c) continue;
      const i = (y * 64 + x) * 4;
      src[i] = c[0];
      src[i + 1] = c[1];
      src[i + 2] = c[2];
      src[i + 3] = 255;
    }
  }
  return { rgba: src, dy };
}

function upscale(src, scale) {
  const out = Buffer.alloc(64 * scale * 64 * scale * 4, 0);
  for (let y = 0; y < 64 * scale; y++) {
    for (let x = 0; x < 64 * scale; x++) {
      const si = ((y / scale | 0) * 64 + (x / scale | 0)) * 4;
      const di = (y * 64 * scale + x) * 4;
      src.copy(out, di, si, si + 4);
    }
  }
  return out;
}

if (process.argv[1]?.endsWith('outline-diff.mjs')) {
  const [livePath, blockPath, outPath, scaleArg] = process.argv.slice(2);
  const scale = Number(scaleArg || 10);
  const live = await readRgba(livePath);
  const block = await readRgba(blockPath);
  const { rgba, dy } = diffMasks(live, block);
  const big = upscale(rgba, scale);
  await writeRgba(outPath, big, 64 * scale, 64 * scale);
  const score = outlineOverlap(live, block);
  console.log(path.basename(outPath), JSON.stringify(score), 'scale', scale, 'dy', dy);
}
