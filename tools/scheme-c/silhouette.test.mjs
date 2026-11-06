import { idleIssues, opaqueRows, strideIssues } from './silhouette.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function paint(width, height, pixels) {
  const rgba = Buffer.alloc(width * height * 4, 0);
  for (const [x, y] of pixels) {
    const i = (y * width + x) * 4;
    rgba[i + 3] = 255;
  }
  return rgba;
}

const column = [];
for (let y = 4; y <= 59; y++) {
  for (let x = 24; x <= 36; x++) column.push([x, y]);
}
const columnIssues = idleIssues(opaqueRows(paint(64, 64, column), 64, 64), 64);
assert(columnIssues.some((item) => item.startsWith('ponytail')), 'column has no ponytail');
assert(columnIssues.some((item) => item.startsWith('waist')), 'column has no waist');
assert(columnIssues.some((item) => item.startsWith('foot')), 'column foot is a bar');

const good = [];
for (let x = 30; x <= 32; x++) good.push([x, 4]);
for (let y = 8; y <= 12; y++) {
  for (let x = 12; x <= 34; x++) good.push([x, y]);
}
for (let y = 16; y <= 24; y++) {
  for (let x = 22; x <= 30; x++) good.push([x, y]);
}
for (let y = 28; y <= 34; y++) {
  for (let x = 16; x <= 32; x++) if (x !== 24) good.push([x, y]);
}
for (let y = 40; y <= 50; y++) {
  const right = 30 + Math.floor((y - 40) / 2);
  for (let x = 14; x <= right; x++) if (x < 20 || x > 26) good.push([x, y]);
}
for (let x = 22; x <= 24; x++) good.push([x, 58]);
const goodIssues = idleIssues(opaqueRows(paint(64, 64, good), 64, 64), 64);
assert(goodIssues.length === 0, `good idle rejected: ${goodIssues.join('; ')}`);

const idleFoot = opaqueRows(paint(64, 64, [[20, 59], [21, 59]]), 64, 64);
const walkPixels = [[30, 59], [31, 59], [12, 52], [13, 52], [28, 54], [14, 54]];
for (let y = 8; y <= 50; y++) walkPixels.push([22, y]);
const walkFoot = opaqueRows(paint(64, 64, walkPixels), 64, 64);
assert(strideIssues(idleFoot, walkFoot, 64).length === 0, 'stride should pass');
console.log('ok');
