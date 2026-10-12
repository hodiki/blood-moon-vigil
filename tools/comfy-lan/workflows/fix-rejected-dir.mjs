/**
 * Fix rejected location per standard v1.2 §二: pipeline/rejected/ (sibling of raw/), not raw/rejected/.
 * Usage: node fix-rejected-dir.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const pipeline = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/pipeline';
const wrong = path.join(pipeline, 'raw', 'rejected');
const right = path.join(pipeline, 'rejected');
fs.mkdirSync(right, { recursive: true });
for (const f of fs.readdirSync(wrong)) {
  fs.renameSync(path.join(wrong, f), path.join(right, f));
  console.log('moved', f);
}
fs.rmdirSync(wrong);
console.log('rejected now at:', right);
console.log('files:', fs.readdirSync(right).join(', '));
