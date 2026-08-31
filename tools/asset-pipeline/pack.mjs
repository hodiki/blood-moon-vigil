// pack.mjs — 图集打包：assets/frames/ → atlas PNG + TexturePacker JSON 数组
//
// 用法：
//   node pack.mjs                    # 打包全部
//   node pack.mjs ui-slots           # 只打包指定图集
//   node pack.mjs --check            # 只校验现有图集（尺寸 ≤2048² / JSON 数组格式）
//
// 输出：
//   assets/atlas/<图集>.png
//   assets/atlas/<图集>.json   （TexturePacker JSON 数组：frames[] + meta）
//
// 算法：Shelf / Guillotine 简易 binpack；目标 ≤2048²，不足自动扩容（保持 2 次幂）
// 契约：premultipliedAlpha=false（sharp 默认输出非预乘）；JSON 数组格式（Phaser 3 atlas）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ATLAS_KEYS, resolveFrameSpec } from './frame-specs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FRAMES_DIR = path.join(PROJECT_ROOT, 'assets', 'frames');
const ATLAS_DIR = path.join(PROJECT_ROOT, 'assets', 'atlas');
const REPORT_PATH = path.join(PROJECT_ROOT, 'assets', 'report.json');

function loadFramePivots() {
  try {
    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    const pivots = {};
    for (const [name, entry] of Object.entries(report.frames || {})) {
      if (entry.pivot && typeof entry.pivot.x === 'number' && typeof entry.pivot.y === 'number') {
        pivots[name] = entry.pivot;
      }
    }
    return pivots;
  } catch {
    return {};
  }
}

const MAX_ATLAS = 2048;
const INITIAL_SIZE = 256;

// ---------- 简易 Shelf binpack ----------
// 输入：[{ name, w, h }]；输出：{ placements: [{name,x,y,w,h}], size: {w,h} }
function binpack(items, initial = INITIAL_SIZE, max = MAX_ATLAS) {
  let size = initial;
  while (true) {
    try {
      const result = tryPack(items, size);
      if (result) return result;
    } catch { /* 放不下，扩容 */ }
    if (size >= max) throw new Error(`图集超过 ${max}px 上限，需拆分`);
    size *= 2;
  }
}

function tryPack(items, size) {
  // shelves：一行行堆放
  const shelves = []; // [{ y, h, usedX }]
  const placements = [];
  for (const item of [...items].sort((a, b) => (b.h * b.w) - (a.h * a.w))) {
    let placed = false;
    // 先试现有 shelf
    for (const sh of shelves) {
      if (sh.h >= item.h && sh.usedX + item.w <= size) {
        placements.push({ name: item.name, x: sh.usedX, y: sh.y, w: item.w, h: item.h });
        sh.usedX += item.w;
        placed = true;
        break;
      }
    }
    if (placed) continue;
    // 新开 shelf
    const newY = shelves.length === 0 ? 0 : shelves[shelves.length - 1].y + shelves[shelves.length - 1].h;
    if (newY + item.h > size) throw new Error('shelf 超出');
    shelves.push({ y: newY, h: item.h, usedX: item.w });
    placements.push({ name: item.name, x: 0, y: newY, w: item.w, h: item.h });
  }
  return { placements, size };
}

// ---------- 打包单个图集 ----------
async function packAtlas(atlasKey) {
  // 收集该图集的帧
  const frameFiles = fs.existsSync(FRAMES_DIR)
    ? fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.png'))
    : [];
  const frames = [];
  for (const f of frameFiles) {
    const name = f.replace(/\.png$/, '');
    const spec = resolveFrameSpec(name);
    if (!spec || spec.atlas !== atlasKey) continue;
    const buf = fs.readFileSync(path.join(FRAMES_DIR, f));
    const meta = await sharp(buf).metadata();
    frames.push({ name, w: meta.width, h: meta.height, buf });
  }
  if (frames.length === 0) {
    console.log(`[pack] ${atlasKey}: 无帧可打包（先跑 process）`);
    return;
  }

  // binpack
  const { placements, size } = binpack(frames.map(({ name, w, h }) => ({ name, w, h })));

  // 合成 atlas PNG
  const canvas = sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const layers = placements.map((p) => {
    const f = frames.find((x) => x.name === p.name);
    return { input: f.buf, left: p.x, top: p.y };
  });
  const atlasPng = await canvas.composite(layers).png().toBuffer();

  // TexturePacker JSON 数组格式
  // pivot 写在 meta.framePivots，不要写 frames[].pivot —— Phaser 会 setOrigin 打乱现有碰撞中心
  const framePivots = {};
  const allPivots = loadFramePivots();
  for (const p of placements) {
    if (allPivots[p.name]) framePivots[p.name] = allPivots[p.name];
  }
  const json = {
    frames: placements.map((p) => ({
      filename: p.name,
      frame: { x: p.x, y: p.y, w: p.w, h: p.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
      sourceSize: { w: p.w, h: p.h }
    })),
    meta: {
      app: 'bmv-asset-pipeline',
      version: '1.1',
      image: `${atlasKey}.png`,
      format: 'RGBA8888',
      size: { w: size, h: size },
      scale: 1,
      framePivots
    }
  };

  fs.mkdirSync(ATLAS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ATLAS_DIR, `${atlasKey}.png`), atlasPng);
  fs.writeFileSync(path.join(ATLAS_DIR, `${atlasKey}.json`), JSON.stringify(json, null, 2));

  console.log(`[pack] ${atlasKey}: ${frames.length} 帧 → ${size}x${size}（≤2048 ✔）`);
  return { atlasKey, frames: frames.length, size };
}

// ---------- 校验已有图集 ----------
async function checkAtlas(atlasKey) {
  const pngPath = path.join(ATLAS_DIR, `${atlasKey}.png`);
  const jsonPath = path.join(ATLAS_DIR, `${atlasKey}.json`);
  if (!fs.existsSync(pngPath) || !fs.existsSync(jsonPath)) {
    console.log(`[check] ${atlasKey}: 缺产物`);
    return false;
  }
  const meta = await sharp(pngPath).metadata();
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const isArray = Array.isArray(json.frames);
  const sizeOk = meta.width <= MAX_ATLAS && meta.height <= MAX_ATLAS;
  const jsonOk = isArray && json.meta && json.meta.image === `${atlasKey}.png`;
  console.log(`[check] ${atlasKey}: ${meta.width}x${meta.height} ${sizeOk ? '≤2048 ✔' : '超限 ✘'} | JSON ${isArray ? '数组格式 ✔' : '✘'} | 帧数 ${json.frames?.length}`);
  return sizeOk && jsonOk;
}

// ---------- CLI ----------
async function main() {
  const args = process.argv.slice(2);
  const onlyCheck = args.includes('--check');
  const targets = args.filter((a) => !a.startsWith('--'));

  if (onlyCheck) {
    for (const k of targets.length ? targets : ATLAS_KEYS) await checkAtlas(k);
    return;
  }
  if (targets.length) {
    for (const k of targets) {
      if (!ATLAS_KEYS.includes(k)) { console.log(`未知图集: ${k}（可选 ${ATLAS_KEYS.join('/')}）`); continue; }
      await packAtlas(k);
    }
    writePivotsSidecar();
    return;
  }
  for (const k of ATLAS_KEYS) await packAtlas(k);
  writePivotsSidecar();
  await writeReviewSheet();
}

function writePivotsSidecar() {
  const pivots = loadFramePivots();
  if (Object.keys(pivots).length === 0) return;
  fs.mkdirSync(ATLAS_DIR, { recursive: true });
  const dest = path.join(ATLAS_DIR, 'pivots.json');
  fs.writeFileSync(dest, JSON.stringify({
    note: '脚底归一化原点。不要写入 TexturePacker frames[].pivot（Phaser 会自动 setOrigin）。引擎接入时与碰撞圆心做 offset。',
    pivots,
  }, null, 2));
  console.log(`[pack] pivot 元数据 ${Object.keys(pivots).length} 条 → assets/atlas/pivots.json`);
}

const REVIEW_FRAMES = [
  'player', 'player-skill-a', 'hero-cassandra', 'hero-violet', 'hero-galvan',
  'enemy-zombie', 'enemy-gravekeeper', 'enemy-boss'
];

async function writeReviewSheet() {
  const cells = [];
  let x = 8;
  const y = 8;
  let rowH = 0;
  for (const name of REVIEW_FRAMES) {
    const fp = path.join(FRAMES_DIR, `${name}.png`);
    if (!fs.existsSync(fp)) continue;
    const meta = await sharp(fp).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    cells.push({ name, fp, x, y, w, h });
    x += w + 8;
    rowH = Math.max(rowH, h);
  }
  if (cells.length === 0) return;
  const W = x;
  const H = rowH + 16;
  const layers = cells.map((c) => ({ input: c.fp, left: c.x, top: y }));
  const out = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 11, g: 14, b: 20, alpha: 255 } }
  }).composite(layers).png().toBuffer();
  const dest = path.join(PROJECT_ROOT, 'assets', 'preview-64-row.png');
  fs.writeFileSync(dest, out);
  console.log(`[pack] 预览条 ${W}x${H} → assets/preview-64-row.png`);
}

main().catch((e) => { console.error(e); process.exit(1); });
