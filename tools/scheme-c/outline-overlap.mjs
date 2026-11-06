import { contentSpan } from './foot-line.mjs';

// Compare a block render against the live sprite after putting both feet on the
// same row. Only pixels that stay inside the 64 box after the shift count.
export function outlineOverlap(live, block) {
  if (live.width !== 64 || live.height !== 64) throw new Error('live is not 64');
  if (block.width !== 64 || block.height !== 64) throw new Error('block is not 64');
  const liveFoot = contentSpan(live.rgba, live.width, live.height).footY;
  const blockFoot = contentSpan(block.rgba, block.width, block.height).footY;
  const dy = liveFoot - blockFoot;
  let onlyLive = 0;
  let onlyBlock = 0;
  let both = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const ly = y + dy;
      const liveOn = ly >= 0 && ly < 64 && live.rgba[(ly * 64 + x) * 4 + 3] === 255;
      const blockOn = block.rgba[(y * 64 + x) * 4 + 3] === 255;
      if (liveOn && blockOn) both += 1;
      else if (liveOn) onlyLive += 1;
      else if (blockOn) onlyBlock += 1;
    }
  }
  return { onlyLive, onlyBlock, both, dy, union: both + onlyLive + onlyBlock, iou: both / Math.max(1, both + onlyLive + onlyBlock) };
}
