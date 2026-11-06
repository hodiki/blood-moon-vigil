import fs from 'node:fs';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { contentSpan, sameBuffer } from './foot-line.mjs';
import { readRgba } from './read-png.mjs';

export const TRIAL_SIZE = 128;
export const TRIAL_FOOT_Y = 127;

export function trialSetDir(reviewRoot, name) {
  if (name === '09') return path.join(reviewRoot, 'sets', '09-3quarter');
  if (name === '10') return path.join(reviewRoot, 'sets', '10-profile');
  throw new Error('set must be 09 or 10');
}

export async function assertTrialSet(dir) {
  const idle = fs.readFileSync(path.join(dir, 'hero-cassandra.png'));
  const variant = fs.readFileSync(path.join(dir, 'hero-cassandra-v.png'));
  if (!sameBuffer(idle, variant)) throw new Error('-v is not idle');
  for (const name of CASSANDRA_FRAMES) {
    const image = await readRgba(path.join(dir, `${name}.png`));
    if (image.width !== TRIAL_SIZE || image.height !== TRIAL_SIZE) {
      throw new Error(`${name} is not ${TRIAL_SIZE}`);
    }
    for (let i = 3; i < image.rgba.length; i += 4) {
      const alpha = image.rgba[i];
      if (alpha !== 0 && alpha !== 255) throw new Error(`${name} partial alpha`);
    }
    const span = contentSpan(image.rgba, image.width, image.height);
    if (span.footY !== TRIAL_FOOT_Y) throw new Error(`${name} foot ${span.footY}`);
  }
  return { size: TRIAL_SIZE, footY: TRIAL_FOOT_Y, frames: CASSANDRA_FRAMES.length };
}
