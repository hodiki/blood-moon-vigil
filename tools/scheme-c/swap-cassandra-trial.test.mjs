import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { writeRgba } from './read-png.mjs';
import { applyReview, backupLive, restoreLive } from './swap-live.mjs';
import { assertTrialSet, trialSetDir } from './trial-set.mjs';
import { runTrial } from './swap-cassandra-trial.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function paint() {
  const rgba = Buffer.alloc(128 * 128 * 4, 0);
  const i = (127 * 128) * 4;
  rgba[i + 3] = 255;
  return rgba;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-swap-'));
const framesDir = path.join(root, 'frames');
const reviewRoot = path.join(root, 'review');
const backupDir = path.join(reviewRoot, 'backup-live');
fs.mkdirSync(framesDir);
const live = Buffer.alloc(64 * 64 * 4, 7);
for (const name of CASSANDRA_FRAMES) {
  await writeRgba(path.join(framesDir, `${name}.png`), live, 64, 64);
}
await writeRgba(path.join(framesDir, 'hero-violet.png'), live, 64, 64);
fs.writeFileSync(path.join(root, 'characters.png'), 'atlas-64');
fs.writeFileSync(path.join(root, 'characters.json'), 'json-64');
for (const setName of ['09-3quarter', '10-profile']) {
  const dir = path.join(reviewRoot, 'sets', setName);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of CASSANDRA_FRAMES) {
    await writeRgba(path.join(dir, `${name}.png`), paint(), 128, 128);
  }
}
const violetBefore = fs.readFileSync(path.join(framesDir, 'hero-violet.png'));
const io = {
  paths: {
    framesDir,
    atlasPng: path.join(root, 'characters.png'),
    atlasJson: path.join(root, 'characters.json'),
    reviewRoot,
    backupDir,
  },
  assertTrialSet,
  trialSetDir,
  backupLive,
  applyReview,
  restoreLive,
  pack() { fs.writeFileSync(path.join(root, 'packed'), 'yes'); },
};

await runTrial(['backup'], io);
assert(fs.readFileSync(path.join(backupDir, 'characters.png')).toString() === 'atlas-64', 'atlas backed up');
assert(fs.existsSync(path.join(backupDir, 'hero-cassandra.png')), 'frame backed up');
let second = '';
try { await runTrial(['backup'], io); } catch (err) { second = err.message; }
assert(second === 'backup-live already exists', second);

let noBackup = '';
const bare = { ...io, paths: { ...io.paths, backupDir: path.join(root, 'missing-backup') } };
try { await runTrial(['apply', '09'], bare); } catch (err) { noBackup = err.message; }
assert(noBackup === 'backup missing', noBackup);

await runTrial(['apply', '09'], io);
const applied = await (await import('./read-png.mjs')).readRgba(path.join(framesDir, 'hero-cassandra-walk-a.png'));
assert(applied.width === 128, 'walk is 128');
assert(fs.readFileSync(path.join(framesDir, 'hero-violet.png')).equals(violetBefore), 'other hero untouched');
assert(fs.readFileSync(path.join(root, 'packed')).toString() === 'yes', 'packed');

await runTrial(['restore'], io);
const restored = await (await import('./read-png.mjs')).readRgba(path.join(framesDir, 'hero-cassandra.png'));
assert(restored.width === 64 && restored.rgba[0] === 7, 'restored 64');
assert(fs.readFileSync(path.join(root, 'characters.png')).toString() === 'atlas-64', 'atlas restored');
console.log('ok');
