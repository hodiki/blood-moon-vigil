import { nearestDown4, nearestDown8 } from './nearest-down.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const width = 8;
const height = 4;
const rgba = Buffer.alloc(width * height * 4);
function put(x, y, r, g, b, a = 255) {
  const i = (y * width + x) * 4;
  rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
}
put(0, 0, 10, 0, 0);
put(4, 0, 0, 20, 0);
rgba[(0 * width + 1) * 4 + 3] = 128;

let threw = false;
try { nearestDown4(rgba, width, height); } catch (e) { threw = e.message === 'partial alpha'; }
assert(threw, 'partial alpha');

rgba[(0 * width + 1) * 4 + 3] = 255;
const out = nearestDown4(rgba, width, height);
assert(out.width === 2 && out.height === 1, 'size');
assert(out.rgba[0] === 10 && out.rgba[4] === 0 && out.rgba[5] === 20, 'samples x*4');
const big = Buffer.alloc(16 * 8 * 4);
big[0] = 30; big[3] = 255;
big[(8) * 4] = 40; big[(8) * 4 + 3] = 255;
const out8 = nearestDown8(big, 16, 8);
assert(out8.width === 2 && out8.height === 1, '64 factor');
assert(out8.rgba[0] === 30 && out8.rgba[4] === 40, 'samples x*8');
console.log('ok');
