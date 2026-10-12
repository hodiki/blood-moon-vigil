/**
 * food 修复小样转正（主理人 2026-10-10 终审通过）：
 * _sample-002/sample-foodfix-003/004 → raw/food/food-001/002.png，sidecar 更新 id/batch/status。
 * 原小样保留在 _sample-002 归档。
 * 用法: node promote-food.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const RAW = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/pipeline/raw';
const SRC = path.join(RAW, '_sample-002');
const DST = path.join(RAW, 'food');
fs.mkdirSync(DST, { recursive: true });

const MAP = [
  ['sample-foodfix-003', 'food-001'],
  ['sample-foodfix-004', 'food-002'],
];

for (const [from, to] of MAP) {
  fs.copyFileSync(path.join(SRC, from + '.png'), path.join(DST, to + '.png'));
  const side = JSON.parse(fs.readFileSync(path.join(SRC, from + '.json'), 'utf8'));
  side.id = to;
  side.batch = 'raw-20261010-food-promote';
  side.status = 'raw';
  side.note = 'food 修复验证通过后由小样转正（主理人 2026-10-10 终审）；原小样在 _sample-002';
  fs.writeFileSync(path.join(DST, to + '.json'), JSON.stringify(side, null, 2));
  console.log(`promoted ${from} -> food/${to}.png`);
}
console.log('done');
