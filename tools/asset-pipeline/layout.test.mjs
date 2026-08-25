// layout.test.mjs — P-6 门禁单元测试（不碰 assets/raw）
// 用法：node layout.test.mjs

import {
  familyKey,
  variantKind,
  temporalLimits,
  computeSharedScale,
  alignOffsets,
} from './layout.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(familyKey('enemy-hound-walk-a') === 'enemy-hound', 'familyKey walk');
assert(variantKind('enemy-hound-walk-b') === 'walk', 'kind walk');
const walk64 = temporalLimits('enemy-hound', 64, 'enemy-hound-walk-a');
assert(walk64.hypotMax === 3 && walk64.footMax === 1 && walk64.areaMax === 0.2, 'walk canine');
assert(familyKey('boss-fenrir-entrance') === 'boss-fenrir', 'familyKey entrance');
assert(variantKind('player-v') === 'idle', 'kind idle');
assert(variantKind('player-skill-a') === 'skill', 'kind skill');
assert(variantKind('boss-cardinal-entrance') === 'entrance', 'kind entrance');

const idle64 = temporalLimits('player', 64, 'player-v');
assert(idle64.hypotMax === 2 && idle64.footMax === 0 && idle64.areaMax === 0.15, 'idle 64');

const skill64 = temporalLimits('player', 64, 'player-skill-a');
assert(skill64.hypotMax === 6 && skill64.footMax === 1 && skill64.areaMax === 0.25, 'skill 64');

const entranceBoss = temporalLimits('boss-fenrir', 240, 'boss-fenrir-entrance');
assert(entranceBoss.hypotMax === 24 && entranceBoss.footMax === 2, 'entrance boss');

const wraith = temporalLimits('enemy-wraith', 64, 'enemy-wraith-v');
assert(wraith.footMax === 1, 'wraith floating foot');

const hound = temporalLimits('enemy-hound', 64, 'enemy-hound-v');
assert(hound.areaMax === 0.2 && hound.footMax === 1, 'canine idle');

const scale = computeSharedScale(
  [{ w: 100, h: 50 }, { w: 80, h: 80 }],
  { w: 54, h: 54 },
);
assert(Math.abs(scale - Math.min(54 / 100, 54 / 80)) < 1e-9, 'shared scale is min contain');

const bb = { minX: 2, minY: 4, maxX: 21, maxY: 40 };
const { ox, oy, footTarget } = alignOffsets(bb, 64, 64, 4, 4);
assert(footTarget === 64 - 4 - 1, 'foot target');
assert(oy + 40 === footTarget, `foot glued, oy=${oy}`);
assert(ox === Math.floor((64 - 20) / 2) - 2, 'horizontal center');

console.log('layout.test.mjs: PASS');
