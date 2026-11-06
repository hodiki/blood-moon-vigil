import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { writeRgba } from './read-png.mjs';
import { assertTrialSet, trialSetDir } from './trial-set.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function paint(y, rgb = [10, 20, 30], alpha = 255) {
  const rgba = Buffer.alloc(128 * 128 * 4, 0);
  const i = (y * 128) * 4;
  rgba[i] = rgb[0];
  rgba[i + 1] = rgb[1];
  rgba[i + 2] = rgb[2];
  rgba[i + 3] = alpha;
  return rgba;
}

async function writeSet(dir, mutate) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of CASSANDRA_FRAMES) {
    let rgba = paint(127);
    if (mutate) rgba = mutate(name, rgba);
    await writeRgba(path.join(dir, `${name}.png`), rgba, 128, 128);
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-set-'));
const okDir = path.join(root, 'ok');
await writeSet(okDir);
const pass = await assertTrialSet(okDir);
assert(pass.size === 128 && pass.footY === 127 && pass.frames === 10, 'pass summary');

const highFoot = path.join(root, 'high');
await writeSet(highFoot, (name, rgba) => (name === 'hero-cassandra-walk-f' ? paint(121) : rgba));
let footMsg = '';
try { await assertTrialSet(highFoot); } catch (err) { footMsg = err.message; }
assert(footMsg === 'hero-cassandra-walk-f foot 121', footMsg);

const mirrored = path.join(root, 'mirror');
await writeSet(mirrored, (name, rgba) => (name === 'hero-cassandra-v' ? paint(127, [1, 2, 3]) : rgba));
let variantMsg = '';
try { await assertTrialSet(mirrored); } catch (err) { variantMsg = err.message; }
assert(variantMsg === '-v is not idle', variantMsg);

const soft = path.join(root, 'soft');
await writeSet(soft, (name, rgba) => (name === 'hero-cassandra-skill-a' ? paint(127, [10, 20, 30], 128) : rgba));
let alphaMsg = '';
try { await assertTrialSet(soft); } catch (err) { alphaMsg = err.message; }
assert(alphaMsg === 'hero-cassandra-skill-a partial alpha', alphaMsg);

const reviewRoot = path.join(root, 'review');
assert(trialSetDir(reviewRoot, '09').endsWith(`${path.sep}sets${path.sep}09-3quarter`), '09 dir');
assert(trialSetDir(reviewRoot, '10').endsWith(`${path.sep}sets${path.sep}10-profile`), '10 dir');
let nameMsg = '';
try { trialSetDir(reviewRoot, 'x128'); } catch (err) { nameMsg = err.message; }
assert(nameMsg === 'set must be 09 or 10', nameMsg);
console.log('ok');
