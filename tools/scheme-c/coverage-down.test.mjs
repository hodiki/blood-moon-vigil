import { coverageDown } from './coverage-down.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rgba = Buffer.alloc(8 * 8 * 4, 0);
for (let i = 0; i < 8; i++) {
  const p = i * 4;
  rgba[p] = 10;
  rgba[p + 3] = 255;
}
const missed = coverageDown(rgba, 8, 8, 8);
assert(missed.rgba[3] === 0, 'one row of eight is not coverage');

for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 4; x++) {
    const p = (y * 8 + x) * 4;
    rgba[p] = 20;
    rgba[p + 1] = 0;
    rgba[p + 2] = 0;
    rgba[p + 3] = 255;
  }
}
const kept = coverageDown(rgba, 8, 8, 8);
assert(kept.width === 1 && kept.height === 1, 'one cell');
assert(kept.rgba[0] === 20 && kept.rgba[3] === 255, 'majority color');
assert(coverageDown(rgba, 8, 8, 4).width === 2, 'factor 4 halves twice');

console.log('ok');
