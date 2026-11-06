import { outlineOverlap } from './outline-overlap.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function solid(y, x0, x1) {
  const rgba = Buffer.alloc(64 * 64 * 4, 0);
  for (let x = x0; x <= x1; x++) rgba[(y * 64 + x) * 4 + 3] = 255;
  return { rgba, width: 64, height: 64 };
}

const live = solid(40, 10, 12);
const block = solid(41, 10, 14);
const gap = outlineOverlap(live, block);
assert(gap.dy === -1, 'shift block up onto the live foot');
assert(gap.both === 3, 'three shared pixels');
assert(gap.onlyBlock === 2, 'two extra block pixels');
assert(gap.onlyLive === 0, 'live is covered');
assert(Math.abs(gap.iou - 3 / 5) < 1e-9, 'iou');

const shifted = outlineOverlap(live, solid(40, 10, 12));
assert(shifted.dy === 0 && shifted.iou === 1, 'identical masks score 1');

console.log('ok');
