// tokens.test.mjs — 案 A：§2.2 派生族量化自检（不碰 assets/raw）
// 用法：node tokens.test.mjs

import { nearestRamp } from './tokens.mjs';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function q(hex, opts) {
  return nearestRamp(hexToRgb(hex), opts);
}

const wine = q('#6B3942');
assert(wine.family === 'wine', `酒红族 ${wine.family}`);
assert(wine.hex === '#6b3942', `酒红应钉锚 ${wine.hex}`);
assert(wine.hex !== '#ff3b3b' && wine.hex !== '#4d5157', '酒红不得灰/猩红');

const night = q('#3A4554');
assert(night.family === 'night', `巡夜族 ${night.family}`);
assert(night.hex === '#3a4554', `巡夜应钉锚 ${night.hex}`);

const robe = q('#3A4250');
assert(robe.family === 'night' && robe.hex === '#3a4250', `圣袍 ${robe.family} ${robe.hex}`);
assert(robe.hex !== night.hex, '巡夜与圣袍不得收成同一档');

const ink = q('#2A3038');
assert(ink.family === 'night' && ink.hex === '#2a3038', `墨衣 ${ink.family} ${ink.hex}`);
assert(ink.hex !== robe.hex && ink.hex !== night.hex, '墨衣须与巡夜/圣袍分档');

const olive = q('#4A5C4E');
assert(olive.family === 'olive', `橄榄族 ${olive.family}`);
assert(olive.hex === '#4a5c4e', `橄榄应钉锚 ${olive.hex}`);
assert(olive.hex !== '#2a3b2e', '橄榄不得落到草叶');

const grass = q('#2A3B2E', { allowGrass: true });
assert(grass.family === 'grass' && grass.hex === '#2a3b2e', `草 tile ${grass.family} ${grass.hex}`);

const ash = q('#C4B8A8');
assert(ash.family === 'ash', `骨灰族 ${ash.family}`);
assert(ash.hex === '#c4b8a8', `骨灰应钉锚 ${ash.hex}`);
assert(ash.hex !== '#bec5ce', '骨灰不得冷银');

const pale = q('#D2B4A0');
assert(pale.family === 'skin', `苍白肤 ${pale.family}`);
assert(pale.hex === '#d2b4a0', `苍白肤应钉锚 ${pale.hex}`);
assert(!['#ff3b3b', '#ff3b30'].includes(pale.hex), '苍白肤禁猩红');

const warm = q('#C3996E');
assert(warm.family === 'skin', `暖肤 ${warm.family}`);
assert(warm.hex === '#c3996e', `暖肤应钉锚 ${warm.hex}`);
assert(warm.hex !== '#ff3b3b', '暖肤不得 #FF3B3B');

const blood = q('#7E1E1E');
assert(blood.family === 'blood' && blood.hex === '#7e1e1e', `暗红锚仍走 blood ${blood.hex}`);

const scarlet = q('#FF3B3B');
assert(scarlet.family === 'blood' && scarlet.hex === '#ff3b3b', `猩红锚仍走 blood ${scarlet.hex}`);

const silver = q('#E8F0FA');
assert(silver.family === 'silver' && silver.hex === '#e8f0fa', `月银仍走 silver ${silver.hex}`);

console.log('tokens.test.mjs: PASS');
