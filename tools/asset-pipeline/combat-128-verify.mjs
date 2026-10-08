/**
 * combat-128-verify.mjs — 评 C 画布切换自检（不写 assets/frames/，不改现网 PNG）
 *
 * node combat-128-verify.mjs
 */
import { createRequire } from 'module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  temporalLimits,
  sizeBand,
  alignOffsets,
  familyKey,
} from './layout.mjs';
import {
  resolveFrameSpec,
  specAfterCombat128Lock,
  resizeKernel,
  combatDisplayScale,
  COMBAT_CANVAS,
} from './frame-specs.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATLAS_CAP = 2048 * 2048;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function nearestBox(src, box) {
  const maxH = Math.round((box * 56) / 64);
  const maxW = Math.round((box * 44) / 64);
  const scale = Math.min(maxH / src.height, maxW / src.width);
  const dw = Math.max(1, Math.round(src.width * scale));
  const dh = Math.max(1, Math.round(src.height * scale));
  const fitted = await sharp(src.data, {
    raw: { width: src.width, height: src.height, channels: 4 },
  })
    .resize(dw, dh, { fit: 'fill', kernel: 'nearest' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const canvas = Buffer.alloc(box * box * 4);
  const ox = Math.floor((box - dw) / 2);
  const oy = box - dh;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const si = (y * dw + x) * 4;
      if (fitted.data[si + 3] < 128) continue;
      const tx = ox + x;
      const ty = oy + y;
      const di = (ty * box + tx) * 4;
      canvas[di] = fitted.data[si];
      canvas[di + 1] = fitted.data[si + 1];
      canvas[di + 2] = fitted.data[si + 2];
      canvas[di + 3] = 255;
    }
  }
  return { width: box, height: box, data: canvas, dw, dh };
}

function paintStamp() {
  const w = 512;
  const h = 768;
  const data = Buffer.alloc(w * h * 4);
  const cloak = [58, 66, 80, 255];
  const skin = [210, 180, 160, 255];
  const eye = [24, 20, 28, 255];
  const silver = [200, 208, 218, 255];
  const flame = [255, 201, 60, 255];
  const fill = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4;
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
        data[i + 3] = c[3];
      }
    }
  };
  fill(180, 80, 330, 740, cloak);
  fill(210, 80, 300, 180, skin);
  fill(228, 118, 236, 126, eye);
  fill(268, 118, 276, 126, eye);
  fill(220, 220, 290, 280, silver);
  fill(248, 300, 264, 316, flame);
  return { width: w, height: h, data };
}

function countDarkOnSkin(spr) {
  const box = spr.width;
  let eyes = 0;
  let skin = 0;
  for (let i = 0; i < box * box; i++) {
    const o = i * 4;
    if (spr.data[o + 3] < 128) continue;
    const r = spr.data[o];
    const g = spr.data[o + 1];
    const b = spr.data[o + 2];
    if (r > 150 && g > 100 && b > 70 && r > b) skin++;
    if (r < 50 && g < 50 && b < 50) eyes++;
  }
  return { eyes, skin };
}

const liveViolet = resolveFrameSpec('hero-violet');
assert(resolveFrameSpec('hero-violet-fallen').w === 128, '魔化 idle 已过 128（B-lo）');
assert(resolveFrameSpec('hero-violet-fallen-v').w === 128, '魔化 idle-v 128');
assert(familyKey('hero-violet-fallen-skill-b') === 'hero-violet-fallen', '魔化与守誓分族');
assert(resizeKernel(resolveFrameSpec('hero-violet-fallen')) === 'nearest', '魔化 idle 近邻');
assert(specAfterCombat128Lock('hero-violet-fallen').w === COMBAT_CANVAS.newHero, '魔化计划 128');
assert(liveViolet.w === 128, '现网守誓 idle 已过 128');
assert(liveViolet.kernel === 'nearest', 'idle 近邻');
assert(resolveFrameSpec('player').w === 64, 'player 64');
assert(resolveFrameSpec('hero-cassandra').w === 64, 'cassandra 64');
assert(resolveFrameSpec('hero-violet-walk-a').w === 128, '走帧已过 128（E2 S3c-b）');
assert(resolveFrameSpec('hero-violet-skill-a').w === 128, '技能已过 128（A1/B2）');
assert(resolveFrameSpec('hero-violet-skill-b').w === 128, '技能 b 已过 128');
assert(resizeKernel(resolveFrameSpec('hero-violet-skill-a')) === 'nearest', '技能近邻');
assert(specAfterCombat128Lock('hero-violet').w === COMBAT_CANVAS.newHero, '计划仍 128');
assert(specAfterCombat128Lock('hero-violet-walk-f').w === 128, '走帧锁计划仍 128');
assert(resizeKernel(resolveFrameSpec('hero-violet-walk-a')) === 'nearest', '走帧近邻');
assert(specAfterCombat128Lock('player').w === 64, '已过 E 不进计划');
assert(resizeKernel(specAfterCombat128Lock('hero-violet')) === 'nearest', '128 近邻');
assert(resizeKernel(liveViolet) === 'nearest', '现网 idle 近邻');
assert(sizeBand(128) === 128, '128 独立档');
assert(temporalLimits('hero-violet', 128, 'hero-violet-v').hypotMax === 4, 'idle 128 hypot 4');
assert(temporalLimits('hero-violet', 96, 'hero-violet-v').hypotMax === 3, '勿把 128 误写成 96 预算');
assert(specAfterCombat128Lock('summon-oathkeeper').w === COMBAT_CANVAS.oathkeeperNew, '守誓者计划 192');
assert(COMBAT_CANVAS.oathkeeperNew === 192, '192 = 她 128 的 1.5×，旧 64→96 同一比例');
assert(combatDisplayScale(64) === 2, '64 帧要 ×2 才到世界 128');
assert(combatDisplayScale(128) === 1, '128 帧 1:1');
assert(combatDisplayScale(192) === 1, '守誓者 192 不压回 128');

const bb = { minX: 2, minY: 4, maxX: 21, maxY: 40 };
const laid = alignOffsets(bb, 128, 128, 6, 6);
assert(laid.footTarget === 121, '128 脚底钉');

const heroFramesApprox = 4 * 10;
const bytesIfAll128 = heroFramesApprox * 128 * 128;
assert(bytesIfAll128 < ATLAS_CAP * 0.5, 'characters 图集 2048² 装得下约 40 张 128 英雄帧');

const stamp = paintStamp();
const boxed = await nearestBox(stamp, 128);
assert(boxed.width === 128 && boxed.height === 128, '入盒 128');
assert(boxed.dh >= 100, '人站满高');
const vis = countDarkOnSkin(boxed);
assert(vis.eyes >= 2, `4× 近邻后仍有眼点（got ${vis.eyes}）`);
assert(vis.skin >= 8, `128 头有肤块（got ${vis.skin}）`);

const crushed = await nearestBox(stamp, 64);
const vis64 = countDarkOnSkin(crushed);
assert(
  vis.eyes >= vis64.eyes,
  '128 档眼点不少于把同一印戳压到 64',
);

const report = {
  ok: true,
  live: {
    player: resolveFrameSpec('player').w,
    cassandra: resolveFrameSpec('hero-cassandra').w,
    violet: liveViolet.w,
    galvan: resolveFrameSpec('hero-galvan').w,
    fallen: resolveFrameSpec('hero-violet-fallen').w,
    oathkeeper: resolveFrameSpec('summon-oathkeeper').w,
  },
  afterLock: {
    violet: specAfterCombat128Lock('hero-violet').w,
    fallen: specAfterCombat128Lock('hero-violet-fallen').w,
    galvan: specAfterCombat128Lock('hero-galvan').w,
    oathkeeper: specAfterCombat128Lock('summon-oathkeeper').w,
    player: specAfterCombat128Lock('player').w,
  },
  temporal128: temporalLimits('hero-violet', 128, 'hero-violet-v'),
  displayScale: {
    64: combatDisplayScale(64),
    128: combatDisplayScale(128),
    192: combatDisplayScale(192),
  },
  box128: { dw: boxed.dw, dh: boxed.dh, eyes: vis.eyes, skin: vis.skin },
  box64sameStamp: { dw: crushed.dw, dh: crushed.dh, eyes: vis64.eyes },
  atlas: { cap: ATLAS_CAP, heroPixelsIf40x128: bytesIfAll128 },
};
console.log(JSON.stringify(report, null, 2));
console.log('combat-128-verify.mjs: PASS');
