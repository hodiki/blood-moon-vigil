import { parseColors, topInteriorColors } from './colors.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const w = 6;
const h = 6;
const rgba = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 255;
  }
}
for (let y = 1; y <= 4; y++) {
  for (let x = 1; x <= 4; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = 120; rgba[i + 1] = 20; rgba[i + 2] = 30;
  }
}
rgba[(2 * w + 2) * 4] = 232;
rgba[(2 * w + 2) * 4 + 1] = 240;
rgba[(2 * w + 2) * 4 + 2] = 250;
rgba[(3 * w + 3) * 4] = 200;
rgba[(3 * w + 3) * 4 + 1] = 206;
rgba[(3 * w + 3) * 4 + 2] = 214;

const top = topInteriorColors(rgba, w, h, 3);
assert(top[0].rgb.join() === '120,20,30', 'coat is the interior mass');
assert(top[0].count === 14, '14 wine pixels');
const colors = parseColors('{"coat":"#78141E","hair":"#E8F0FA","metal":"#C8CED6"}');
assert(colors.coat === '#78141E', 'coat hex');
let bad = false;
try { parseColors('{"coat":"wine","hair":"#E8F0FA","metal":"#C8CED6"}'); } catch { bad = true; }
assert(bad, 'rejects a word');
let zero = false;
try { parseColors('{"coat":"#000000","hair":"#E8F0FA","metal":"#C8CED6"}'); } catch { zero = true; }
assert(zero, 'rejects unset black');
console.log('ok');
