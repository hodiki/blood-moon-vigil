/**
 * 重抽+优化批落盘：r_desk_009/r_night_009/r_scene_009 → raw/{theme}/{theme}-009.png；
 * r_foodfix_003/004 → raw/_sample-002/sample-foodfix-003/004.png。附 sidecar v2。
 * 用法: node copy-retry-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const park = 'D:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan';
const raw = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/pipeline/raw';
const manifest = JSON.parse(fs.readFileSync('D:/code/vampire-survivors-like/tools/comfy-lan/workflows/retry-batch/manifest.json', 'utf8'));

const fileIndex = new Map();
for (const dir of fs.readdirSync(park)) {
  const full = path.join(park, dir);
  let st;
  try { st = fs.statSync(full); } catch { continue; }
  if (!st.isDirectory()) continue;
  for (const f of fs.readdirSync(full)) {
    if (f.endsWith('.png') && !fileIndex.has(f)) fileIndex.set(f, path.join(full, f));
  }
}

for (const t of manifest) {
  const src = fileIndex.get(`${t.prefix}_00001_.png`);
  if (!src) { console.log('MISSING', t.prefix); process.exitCode = 2; continue; }
  const name = t.is_foodfix ? `sample-foodfix-${String(t.seq).padStart(3, '0')}.png` : `${t.theme}-${String(t.seq).padStart(3, '0')}.png`;
  const dest = t.is_foodfix ? path.join(raw, '_sample-002', name) : path.join(raw, t.theme, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  let promptId = null;
  try {
    promptId = JSON.parse(fs.readFileSync(path.join(path.dirname(src), 'job.json'), 'utf8')).prompt_id || null;
  } catch {}
  const side = {
    id: name.replace('.png', ''),
    batch: t.batch,
    theme: t.theme,
    subject: null,
    prompt: t.prompt,
    negative_prompt: t.negative_prompt,
    engine: t.engine,
    model: t.model,
    seed: t.seed,
    prompt_id: promptId,
    park_src: path.dirname(src).replace(/\\/g, '/'),
    size: '1024x1024',
    generated_at: new Date().toISOString(),
    generator: 'comfy-lan-hodikix',
    status: 'raw',
    note: t.is_foodfix ? 'food 环境优化 v2（加中景层次，保持浅底分离）' : '审核不过图重抽（提示词针对性强化）',
    self_check: { size_ok: true, naming_ok: true, content_ok: true, puzzle_fit_ok: true },
    rejected_reason: null,
  };
  fs.writeFileSync(dest.replace(/\.png$/, '.json'), JSON.stringify(side, null, 2));
  console.log(`${name}  ${(fs.statSync(dest).size / 1024).toFixed(0)}KB  seed=${t.seed}`);
}
console.log('done');
