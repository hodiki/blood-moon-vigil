import path from 'node:path';
import { BOARD_FRAMES } from './frame-set.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

export function boardSize(pairCount, cell = 256, gap = 8) {
  return {
    width: gap + (cell + gap) * 3,
    height: gap + pairCount * (cell + gap),
    cell,
    gap,
  };
}

function blitNearest(dst, dstW, src, srcW, srcH, scale, originX, originY) {
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const si = (y * srcW + x) * 4;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const di = ((originY + y * scale + dy) * dstW + (originX + x * scale + dx)) * 4;
          dst[di] = src[si];
          dst[di + 1] = src[si + 1];
          dst[di + 2] = src[si + 2];
          dst[di + 3] = src[si + 3];
        }
      }
    }
  }
}

export async function buildBoard(liveDir, block64Dir, block128Dir, outFile) {
  const { width, height, cell, gap } = boardSize(BOARD_FRAMES.length);
  const dst = Buffer.alloc(width * height * 4, 0);
  for (let row = 0; row < BOARD_FRAMES.length; row++) {
    const name = BOARD_FRAMES[row];
    const live = await readRgba(path.join(liveDir, `${name}.png`));
    const block64 = await readRgba(path.join(block64Dir, `${name}.png`));
    const block128 = await readRgba(path.join(block128Dir, `${name}.png`));
    if (live.width !== 64 || live.height !== 64) throw new Error(`${name} live is not 64`);
    if (block64.width !== 64 || block64.height !== 64) throw new Error(`${name} block 64 is not 64`);
    if (block128.width !== 128 || block128.height !== 128) throw new Error(`${name} block 128 is not 128`);
    const top = gap + row * (cell + gap);
    blitNearest(dst, width, live.rgba, 64, 64, 4, gap, top);
    blitNearest(dst, width, block64.rgba, 64, 64, 4, gap + cell + gap, top);
    blitNearest(dst, width, block128.rgba, 128, 128, 2, gap + (cell + gap) * 2, top);
  }
  await writeRgba(outFile, dst, width, height);
  return { width, height };
}
