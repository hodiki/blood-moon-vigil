import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { checkRenders } from './check-renders.mjs';
import { writeRgba } from './read-png.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function solid(w, h, top, foot) {
  const rgba = Buffer.alloc(w * h * 4, 0);
  for (let y = top; y <= foot; y++) rgba[(y * w + 4) * 4 + 3] = 255;
  return rgba;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-c-check-'));
const dir64 = path.join(root, 'x64');
const dir128 = path.join(root, 'x128');
fs.mkdirSync(dir64);
fs.mkdirSync(dir128);
const live = path.join(root, 'live.png');
await writeRgba(live, solid(64, 64, 16, 47), 64, 64);
const pix64 = solid(64, 64, 16, 47);
const pix128 = solid(128, 128, 32, 95);
for (const name of CASSANDRA_FRAMES) {
  await writeRgba(path.join(dir64, `${name}.png`), pix64, 64, 64);
  await writeRgba(path.join(dir128, `${name}.png`), pix128, 128, 128);
}
const result = await checkRenders(dir64, dir128, live);
assert(result.footY64 === 47 && result.footY128 === 95, 'shared feet');
console.log('ok');
