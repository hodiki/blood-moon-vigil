import { resolveFrameSpec } from '../asset-pipeline/frame-specs.mjs';
import { BOARD_FRAMES, CASSANDRA_FRAMES } from './frame-set.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const expected = [
  'hero-cassandra',
  'hero-cassandra-v',
  'hero-cassandra-walk-a',
  'hero-cassandra-walk-e',
  'hero-cassandra-walk-b',
  'hero-cassandra-walk-c',
  'hero-cassandra-walk-f',
  'hero-cassandra-walk-d',
  'hero-cassandra-skill-a',
  'hero-cassandra-skill-b',
];

assert(CASSANDRA_FRAMES.join() === expected.join(), 'frame order');
assert(BOARD_FRAMES.join() === expected.filter((n) => n !== 'hero-cassandra-v').join(), 'board skips -v');
for (const name of CASSANDRA_FRAMES) {
  const spec = resolveFrameSpec(name);
  assert(spec.w === 64 && spec.h === 64 && spec.atlas === 'characters', `${name} stays 64`);
}
console.log('ok');
