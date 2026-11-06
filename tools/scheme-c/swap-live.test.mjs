import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { writeRgba } from './read-png.mjs';
import { applyReview, backupLive, restoreLive } from './swap-live.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-c-swap-'));
const frames = path.join(root, 'frames');
const review = path.join(root, 'review');
const backup = path.join(root, 'backup-live');
fs.mkdirSync(frames);
fs.mkdirSync(review);
const live = Buffer.alloc(64 * 64 * 4, 1);
const scheme64 = Buffer.alloc(64 * 64 * 4, 3);
const block = Buffer.alloc(128 * 128 * 4, 2);
const dir64 = path.join(root, 'x64');
fs.mkdirSync(dir64);
for (const name of CASSANDRA_FRAMES) {
  await writeRgba(path.join(frames, `${name}.png`), live, 64, 64);
  await writeRgba(path.join(dir64, `${name}.png`), scheme64, 64, 64);
  await writeRgba(path.join(review, `${name}.png`), block, 128, 128);
}
await writeRgba(path.join(frames, 'hero-violet.png'), live, 64, 64);
fs.writeFileSync(path.join(root, 'characters.png'), 'atlas');
fs.writeFileSync(path.join(root, 'characters.json'), 'json');
const violetBefore = fs.readFileSync(path.join(frames, 'hero-violet.png'));

backupLive({
  framesDir: frames,
  atlasPng: path.join(root, 'characters.png'),
  atlasJson: path.join(root, 'characters.json'),
  backupDir: backup,
});
await applyReview({ reviewDir: review, framesDir: frames, size: 128 });
assert(fs.readFileSync(path.join(frames, 'hero-violet.png')).equals(violetBefore), 'other hero untouched');
const applied = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra.png'));
assert(applied.width === 128, 'applied 128');

let refused = false;
try { await applyReview({ reviewDir: review, framesDir: frames, size: 64 }); } catch { refused = true; }
assert(refused, 'refuses 128 files when size is 64');
const still = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra-walk-a.png'));
assert(still.width === 128, 'failed apply writes nothing');

restoreLive({
  backupDir: backup,
  framesDir: frames,
  atlasPng: path.join(root, 'characters.png'),
  atlasJson: path.join(root, 'characters.json'),
});
await applyReview({ reviewDir: dir64, framesDir: frames, size: 64 });
const applied64 = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra.png'));
assert(applied64.width === 64 && applied64.rgba[0] === 3, 'applied 64');

restoreLive({
  backupDir: backup,
  framesDir: frames,
  atlasPng: path.join(root, 'characters.png'),
  atlasJson: path.join(root, 'characters.json'),
});
const restored = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra.png'));
assert(restored.width === 64 && restored.rgba[0] === 1, 'restored live');
const src = fs.readFileSync(new URL('./swap-live.mjs', import.meta.url), 'utf8');
assert(!src.includes('process.mjs') && !src.includes('quantizePixels'), 'no quantize path');
console.log('ok');
