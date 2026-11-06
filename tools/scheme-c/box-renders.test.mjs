import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BOARD_FRAMES } from './frame-set.mjs';
import { boxRenders } from './box-renders.mjs';
import { sameBuffer } from './foot-line.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-c-box-'));
const src = path.join(root, 'src');
const out = path.join(root, 'out');
fs.mkdirSync(src);
const pix = Buffer.alloc(512 * 512 * 4, 0);
pix[3] = 255;
for (const name of BOARD_FRAMES) {
  await writeRgba(path.join(src, `${name}.png`), pix, 512, 512);
}
await boxRenders(src, out);
const idle64 = fs.readFileSync(path.join(out, 'x64', 'hero-cassandra.png'));
const variant64 = fs.readFileSync(path.join(out, 'x64', 'hero-cassandra-v.png'));
assert(sameBuffer(idle64, variant64), '-v copies idle at 64');
const idle128 = fs.readFileSync(path.join(out, 'x128', 'hero-cassandra.png'));
const variant128 = fs.readFileSync(path.join(out, 'x128', 'hero-cassandra-v.png'));
assert(sameBuffer(idle128, variant128), '-v copies idle at 128');
const boxed64 = await readRgba(path.join(out, 'x64', 'hero-cassandra-walk-a.png'));
const boxed128 = await readRgba(path.join(out, 'x128', 'hero-cassandra-walk-a.png'));
assert(boxed64.width === 64 && boxed64.height === 64, '64');
assert(boxed128.width === 128 && boxed128.height === 128, '128');
console.log('ok');
