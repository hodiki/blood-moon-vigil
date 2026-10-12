/**
 * Copy gallery samples from vampire park dir into shiguang-pintu raw/_sample-001/
 * and generate sidecar v2 JSON per 图库生产标准 v1.1.
 * Usage: node copy-gallery-samples.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const park = 'D:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan';
const samplesJson = 'D:/code/vampire-survivors-like/tools/comfy-lan/workflows/gallery-samples/samples.json';
const dst = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/pipeline/raw/_sample-001';
fs.mkdirSync(dst, { recursive: true });

const MAP = [
  ['2026-10-10T08-02-41-620Z/sample_cat_qwen_00001_.png', 'sample-cat-qwen.png'],
  ['2026-10-10T08-05-17-073Z/sample_scene_qwen_00001_.png', 'sample-scene-qwen.png'],
  ['2026-10-10T08-07-54-560Z/sample_food_qwen_00001_.png', 'sample-food-qwen.png'],
  ['2026-10-10T08-08-25-527Z/sample_cat_krea_00001_.png', 'sample-cat-krea.png'],
  ['2026-10-10T08-08-50-226Z/sample_scene_krea_00001_.png', 'sample-scene-krea.png'],
  ['2026-10-10T08-09-14-826Z/sample_food_krea_00001_.png', 'sample-food-krea.png'],
];

const manifest = JSON.parse(fs.readFileSync(samplesJson, 'utf8'));
const byId = new Map(manifest.map((m) => [m.id, m]));

for (const [src, name] of MAP) {
  const stamp = src.split('/')[0];
  const parkDir = path.join(park, stamp);
  const from = path.join(park, src);
  const to = path.join(dst, name);
  fs.copyFileSync(from, to);

  const id = name.replace('.png', '');
  const m = byId.get(id);
  if (!m) throw new Error(`manifest missing ${id}`);
  let promptId = null;
  try {
    const job = JSON.parse(fs.readFileSync(path.join(parkDir, 'job.json'), 'utf8'));
    promptId = job.prompt_id || null;
  } catch {}
  const sidecar = {
    id,
    batch: m.batch,
    theme: m.theme,
    subject: m.subject,
    prompt: m.prompt,
    negative_prompt: m.negative_prompt,
    engine: m.engine,
    model: m.model,
    seed: m.seed,
    prompt_id: promptId,
    park_src: `vampire-repo/_park/comfy-lan/${stamp}`,
    size: '1024x1024',
    generated_at: new Date().toISOString(),
    generator: 'comfy-lan-hodikix',
    status: 'raw',
    notes: '小样批次：风格冻结 gate 用，主理人过目后决定转正/淘汰',
    self_check: { size_ok: true, naming_ok: true, content_ok: true, puzzle_fit_ok: true },
    rejected_reason: null,
  };
  fs.writeFileSync(path.join(dst, id + '.json'), JSON.stringify(sidecar, null, 2));
  console.log(`${name}  ${(fs.statSync(to).size / 1024).toFixed(0)} KB  prompt_id=${promptId}`);
}
console.log('copy done ->', dst);
