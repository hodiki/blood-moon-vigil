/**
 * 审核落榜处理：3 张不过图移入 rejected/ 并回写 sidecar。
 * 用法: node reject-three.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const RAW = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/pipeline/raw';
const REJ = path.join(RAW, 'rejected');
fs.mkdirSync(REJ, { recursive: true });

const ITEMS = [
  {
    file: 'desk/desk-005',
    reason:
      '主理人不过(2026-10-10)：画面下半约40%为纯色空底(违反≤25%规则)，元素仅3件密度过低；桌面光斑呈污渍感。重抽见 desk-009',
  },
  {
    file: 'night/night-005',
    reason:
      '主理人不过(2026-10-10)：夜航主题跑偏——天空呈浅奶油色无星空夜氛围(暖色调色板压过夜色)，中景空旷。重抽见 night-009',
  },
  {
    file: 'scene/scene-004',
    reason:
      '主理人不过(2026-10-10)：Krea版小镇堆叠过满缺乏纵深层次，上下各1/3近似大块纯色。改用Qwen重抽见 scene-009',
  },
];

for (const it of ITEMS) {
  const srcPng = path.join(RAW, it.file + '.png');
  const srcJson = path.join(RAW, it.file + '.json');
  const base = path.basename(it.file);
  fs.renameSync(srcPng, path.join(REJ, base + '.png'));
  if (fs.existsSync(srcJson)) {
    const side = JSON.parse(fs.readFileSync(srcJson, 'utf8'));
    side.status = 'rejected';
    side.rejected_reason = it.reason;
    fs.writeFileSync(path.join(REJ, base + '.json'), JSON.stringify(side, null, 2));
    fs.rmSync(srcJson, { force: true });
  }
  console.log('rejected <-', base);
}
console.log('done');
