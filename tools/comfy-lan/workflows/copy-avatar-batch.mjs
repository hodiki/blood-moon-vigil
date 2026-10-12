/**
 * Copy avatar batch outputs from the vampire repo park dir to the shiguang-pintu project.
 * Usage: node copy-avatar-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const park = 'D:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan';
const dst = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/avatar/batch-001';
fs.mkdirSync(dst, { recursive: true });

const files = [
  ['2026-10-10T05-54-07-948Z/avatar_A1_qwen_00001_.png', 'avatar-A1-qwen.png'],
  ['2026-10-10T05-56-41-428Z/avatar_B1_qwen_00001_.png', 'avatar-B1-qwen.png'],
  ['2026-10-10T05-59-14-833Z/avatar_C1_qwen_00001_.png', 'avatar-C1-qwen.png'],
  ['2026-10-10T06-01-48-236Z/avatar_D1_qwen_00001_.png', 'avatar-D1-qwen.png'],
  ['2026-10-10T05-42-52-942Z/avatar_A2_krea_00001_.png', 'avatar-A2-krea.png'],
  ['2026-10-10T05-43-17-522Z/avatar_B2_krea_00001_.png', 'avatar-B2-krea.png'],
  ['2026-10-10T05-43-42-164Z/avatar_C2_krea_00001_.png', 'avatar-C2-krea.png'],
  ['2026-10-10T05-44-06-711Z/avatar_D2_krea_00001_.png', 'avatar-D2-krea.png'],
];

for (const [src, name] of files) {
  const from = path.join(park, src);
  const to = path.join(dst, name);
  fs.copyFileSync(from, to);
  const size = fs.statSync(to).size;
  console.log(`${name}  ${(size / 1024).toFixed(0)} KB`);
}
console.log('copy done');
