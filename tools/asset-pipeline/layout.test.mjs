// layout.test.mjs — P-6 门禁单元测试（不碰 assets/raw）
// 用法：node layout.test.mjs

import {
  familyKey,
  variantKind,
  temporalLimits,
  computeSharedScale,
  alignOffsets,
  alignOffsetsCentered,
  isCenteredFxFrame,
} from './layout.mjs';
import { resolveFrameSpec } from './frame-specs.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(familyKey('enemy-hound-walk-a') === 'enemy-hound', 'familyKey walk');
assert(familyKey('enemy-stonewolf-broken-v') === 'enemy-stonewolf', 'familyKey broken-v');
assert(familyKey('enemy-stonewolf-broken') === 'enemy-stonewolf', 'familyKey broken');
assert(familyKey('summon-oathkeeper-tombstone') === 'summon-oathkeeper', 'familyKey tombstone');
assert(variantKind('enemy-hound-walk-b') === 'walk', 'kind walk');
assert(variantKind('enemy-stonewolf-broken') === 'broken', 'kind broken');
assert(variantKind('enemy-stonewolf-broken-v') === 'broken', 'kind broken-v not idle');
assert(variantKind('summon-oathkeeper-tombstone') === 'tombstone', 'kind tombstone');
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
assert(entranceBoss.hypotMax === 24 && entranceBoss.footMax === 3, 'entrance boss');

const wraith = temporalLimits('enemy-wraith', 64, 'enemy-wraith-v');
assert(wraith.footMax === 1, 'wraith floating foot');

const hound = temporalLimits('enemy-hound', 64, 'enemy-hound-v');
assert(hound.areaMax === 0.2 && hound.footMax === 1, 'canine idle');

const broken96 = temporalLimits('enemy-stonewolf', 96, 'enemy-stonewolf-broken');
assert(broken96.kind === 'broken' && broken96.hypotMax === 8 && broken96.areaMax === 0.3 && broken96.footMax === 2, 'broken elite');

const tomb48 = temporalLimits('summon-oathkeeper', 48, 'summon-oathkeeper-tombstone');
assert(tomb48.kind === 'tombstone' && tomb48.hypotMax === 6 && tomb48.areaMax === 0.25, 'tombstone skill-tier');

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

assert(isCenteredFxFrame('skill-ring-edmund') && isCenteredFxFrame('missile') && isCenteredFxFrame('marker-stun'), 'centered fx');
assert(isCenteredFxFrame('proj-javelin') && isCenteredFxFrame('super-bloodsea') && isCenteredFxFrame('decal-bloodpool'), 'weapon fx centered');
assert(isCenteredFxFrame('skill-edmund') && isCenteredFxFrame('wslot-missile') && isCenteredFxFrame('decor-church-glasslight'), 'ui and glasslight centered');
assert(isCenteredFxFrame('relic-reliquary') && isCenteredFxFrame('exw-card-lantern') && isCenteredFxFrame('sticon-hard'), 'relic/ui centered');
assert(isCenteredFxFrame('tree-q-a') && isCenteredFxFrame('exw-emblem-lantern') && isCenteredFxFrame('relic-icon-mooneclipse'), 'c1-c3 slots centered');
assert(!isCenteredFxFrame('player') && !isCenteredFxFrame('summon-hound') && !isCenteredFxFrame('summon-oathkeeper'), 'characters still foot-aligned');
assert(!isCenteredFxFrame('obst-grave-tomb') && !isCenteredFxFrame('decor-grave-tree'), 'map objects foot-aligned');
const c = alignOffsetsCentered(bb, 64, 64);
assert(c.ox === Math.floor((64 - 20) / 2) - 2, 'centered ox');
assert(c.oy === Math.floor((64 - 37) / 2) - 4, 'centered oy');

const playerWalk = resolveFrameSpec('player-walk-a');
assert(playerWalk && playerWalk.w === 64 && playerWalk.atlas === 'characters', 'walk inherit player 64');
assert(resolveFrameSpec('hero-cassandra-walk-b')?.w === 64, 'walk inherit cassandra');
assert(resolveFrameSpec('enemy-gravekeeper-walk-a')?.w === 96, 'walk inherit elite 96');
assert(resolveFrameSpec('enemy-stonewolf-broken-walk-a')?.w === 96, 'walk inherit broken→stonewolf 96');
assert(resolveFrameSpec('upg-g-1')?.w === 128 && resolveFrameSpec('upg-g-1')?.atlas === 'ui', 'upg 128 ui');
assert(resolveFrameSpec('wslot-proj-crossbow')?.w === 64 && resolveFrameSpec('wslot-proj-crossbow')?.atlas === 'ui', 'wslot 64 ui');
assert(resolveFrameSpec('unknown-walk-a') === null, 'walk of unknown family still UNKNOWN');

console.log('layout.test.mjs: PASS');
