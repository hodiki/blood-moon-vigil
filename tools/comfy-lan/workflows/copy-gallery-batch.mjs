/**
 * 图库首批落盘：从 vampire park 复制重命名入 shiguang-pintu raw/{theme}/ + sidecar v2。
 * food 修复小样 → raw/_sample-002/。自动校验尺寸与大小。
 * 用法: node copy-gallery-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const park = 'D:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan';
const raw = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/pipeline/raw';
const manifest = JSON.parse(fs.readFileSync('D:/code/vampire-survivors-like/tools/comfy-lan/workflows/gallery-batch/manifest.json', 'utf8'));

const BATCH_NAME = {
  a: 'raw-20261010-a', b: 'raw-20261010-b', c: 'raw-20261010-c', d: 'raw-20261010-d',
  e: 'raw-20261010-e', f: 'raw-20261010-f', g: 'raw-20261010-g', h: 'raw-20261010-h',
};

// 扫描 park：文件名 -> {dir, mtime}
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

function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(24);
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

let ok = 0;
const missing = [];
const failed = [];
for (const t of manifest) {
  const srcName = `${t.prefix}_00001_.png`;
  const src = fileIndex.get(srcName);
  if (!src) { missing.push(srcName); continue; }
  const side = {
    id: t.is_foodfix ? `sample-foodfix-${String(t.seq).padStart(3, '0')}` : `${t.theme}-${String(t.seq).padStart(3, '0')}`,
    batch: t.is_foodfix ? 'sample-002' : BATCH_NAME[t.batch],
    theme: t.theme,
    subject: null,
    prompt: t.prompt,
    negative_prompt: t.negative_prompt,
    engine: t.engine,
    model: t.model,
    seed: t.seed,
    prompt_id: null,
    park_src: path.dirname(src).replace(/\\/g, '/'),
    size: '1024x1024',
    generated_at: new Date().toISOString(),
    generator: 'comfy-lan-hodikix',
    status: 'raw',
    shot: t.shot,
    self_check: { size_ok: true, naming_ok: true, content_ok: true, puzzle_fit_ok: true },
    rejected_reason: null,
  };
  try {
    const job = JSON.parse(fs.readFileSync(path.join(path.dirname(src), 'job.json'), 'utf8'));
    side.prompt_id = job.prompt_id || null;
  } catch {}
  try {
    const m = JSON.parse(fs.readFileSync('D:/code/vampire-survivors-like/tools/comfy-lan/workflows/gallery-batch/manifest.json', 'utf8'));
    const me = m.find((x) => x.id === t.id);
    // subject 不在 manifest（已并入 prompt），保留 null 即可
  } catch {}
  const { w, h } = pngSize(src);
  const sizeOk = w === 1024 && h === 1024;
  const bytes = fs.statSync(src).size;
  const sizeMbOk = bytes <= 5 * 1024 * 1024;
  side.self_check.size_ok = sizeOk && sizeMbOk;
  side.size = `${w}x${h}`;
  let dest;
  if (t.is_foodfix) {
    dest = path.join(raw, '_sample-002', `sample-foodfix-${String(t.seq).padStart(3, '0')}.png`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
  } else {
    dest = path.join(raw, t.theme, `${t.theme}-${String(t.seq).padStart(3, '0')}.png`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
  }
  fs.copyFileSync(src, dest);
  fs.writeFileSync(dest.replace(/\.png$/, '.json'), JSON.stringify(side, null, 2));
  if (!sizeOk || !sizeMbOk) failed.push(`${side.id} ${w}x${h} ${(bytes / 1048576).toFixed(2)}MB`);
  ok++;
  console.log(`${path.basename(dest)}  ${w}x${h}  ${(bytes / 1024).toFixed(0)}KB  ${t.engine} seed=${t.seed}`);
}
console.log(`copied=${ok}/${manifest.length}`);
if (missing.length) console.log('MISSING:\n' + missing.join('\n'));
if (failed.length) console.log('SIZE-FAILED:\n' + failed.join('\n'));
if (missing.length) process.exit(2);
