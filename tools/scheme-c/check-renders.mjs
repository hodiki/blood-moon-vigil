import fs from 'node:fs';
import path from 'node:path';
import { BOARD_FRAMES, CASSANDRA_FRAMES } from './frame-set.mjs';
import { contentSpan, sameBuffer, spansMatch } from './foot-line.mjs';
import { readRgba } from './read-png.mjs';

export async function checkRenders(dir64, dir128, liveIdlePath) {
  const live = await readRgba(liveIdlePath);
  if (live.width !== 64 || live.height !== 64) throw new Error('live idle is not 64');
  const liveSpan = contentSpan(live.rgba, live.width, live.height);
  const footY64 = await checkSet(dir64, 64, liveSpan);
  const footY128 = await checkSet(dir128, 128, liveSpan);
  if (Math.abs(footY128 - footY64 * 2) > 1) throw new Error('64 and 128 feet diverge');
  if (BOARD_FRAMES.length !== 9) throw new Error('board');
  return { footY64, footY128 };
}

async function checkSet(dir, size, liveSpan) {
  const idle = fs.readFileSync(path.join(dir, 'hero-cassandra.png'));
  const variant = fs.readFileSync(path.join(dir, 'hero-cassandra-v.png'));
  if (!sameBuffer(idle, variant)) throw new Error(`${size} -v is not idle`);
  let footY = null;
  for (const name of CASSANDRA_FRAMES) {
    const image = await readRgba(path.join(dir, `${name}.png`));
    if (image.width !== size || image.height !== size) throw new Error(`${name} is not ${size}`);
    for (let i = 3; i < image.rgba.length; i += 4) {
      const alpha = image.rgba[i];
      if (alpha !== 0 && alpha !== 255) throw new Error(`${name} partial alpha`);
    }
    const span = contentSpan(image.rgba, size, size);
    if (!spansMatch(liveSpan.span, 64, span.span, size)) throw new Error(`${name} span`);
    if (footY === null) footY = span.footY;
    if (span.footY !== footY) throw new Error(`${name} foot ${span.footY} != ${footY}`);
  }
  return footY;
}
