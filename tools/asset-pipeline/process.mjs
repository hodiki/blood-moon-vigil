// process.mjs — 主入口：AI 原图 → 边缘洪水抠图 → 动画族共享缩放 + 脚底对齐 → 量化 → 校验 → 导出
// P-1 填充装进「画布 − 2×5%边距」（描边环宽度现为 0）
// P-2 边距量填充包围盒
// P-3 外部 AI 轨不后置描边
// P-4 L* 分治：玩家/召唤物须 ≥45 或高亮；其余靠剪影/体型
// P-5 量化：同色相明度阶；角色禁止草地 token；降采样 lanczos3 后再取整，避免 nearest 椒盐
// P-6 动画族：同一实体共用 contain 缩放（矮姿势不再撑满）；脚底对齐；成对时间轴门禁
//
// 用法：
//   node process.mjs <帧名1> <帧名2> ...     # 处理指定帧（同族 raw 会一并纳入共享缩放）
//   node process.mjs --all                   # 处理 assets/raw/ 下所有已识别的原图
//   node process.mjs --list                  # 列出全部契约帧名
//   node process.mjs --check [帧名]          # 只校验不重处理（无帧名 = 校验已有成品 + 时间轴）
//
// 目录约定（相对项目根）：
//   assets/raw/<帧名>.png        ← AI 生成原图（放这）
//   assets/frames/<帧名>.png     → 处理后的契约帧（自动建目录）
//   assets/report.json           → 本轮验收报告（累加）
//
// 抠图：优先用原图 alpha；无 alpha 时从画布边洪水填充，只清「连到边」的底色。
//       禁止按背景色全局抹掉——袍子暗褶会和黑底同色，全局阈值会把剪影抠穿。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { quantizePixels, silhouetteLstats, nearestToken, luminanceL } from './tokens.mjs';
import { resolveFrameSpec, isKnownFrame, allFrameNames } from './frame-specs.mjs';
import {
  familyKey,
  silhouetteMetrics,
  comparePair,
  temporalLimits,
  pivotFromFoot,
  computeSharedScale,
  alignOffsets,
} from './layout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const RAW_DIR = path.join(PROJECT_ROOT, 'assets', 'raw');
const FRAMES_DIR = path.join(PROJECT_ROOT, 'assets', 'frames');
const REPORT_PATH = path.join(PROJECT_ROOT, 'assets', 'report.json');

// ---------- 工具 ----------
function log(prefix, msg) { console.log(`[${prefix}] ${msg}`); }

function loadReport() {
  try { return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')); }
  catch { return { frames: {}, updatedAt: null }; }
}
function saveReport(report) {
  report.updatedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

// 是否为「全幅贴图类」帧（tile/背景/装饰/贴花）：不抠主体，直接缩放铺满
function isFullBleedFrame(frameName) {
  return frameName.startsWith('tile-') || frameName.startsWith('decor-') ||
         frameName.startsWith('decal-') || frameName.startsWith('obst-') ||
         frameName === 'moon' || frameName === 'vignette' || frameName === 'marker-warningline';
}

function rgbDist(p, q) {
  const dr = p[0] - q[0], dg = p[1] - q[1], db = p[2] - q[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// 抠图：原图若有 alpha 直接返回；tile 类帧跳过抠图；否则从画布边缘洪水填充。
// 阈值收紧到 24：清近黑底，尽量不把墨夜蓝黑袍褶当成底（#000↔#0B0E14 ≈ 27）。
async function ensureTransparency(img, frameName) {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) { if (data[i] < 250) { hasAlpha = true; break; } }
  if (hasAlpha) return { data, info, method: 'alpha' };
  if (isFullBleedFrame(frameName)) return { data, info, method: 'full-bleed' };

  const { width, height } = info;
  const sample = (x, y) => { const i = (y * width + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const corners = [
    sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1),
    sample(Math.floor(width / 2), 0), sample(Math.floor(width / 2), height - 1),
    sample(0, Math.floor(height / 2)), sample(width - 1, Math.floor(height / 2))
  ];
  const counts = new Map();
  for (const c of corners) { const k = c.join(','); counts.set(k, (counts.get(k) || 0) + 1); }
  let bg = null, max = 0;
  for (const [k, v] of counts) { if (v > max) { max = v; bg = k.split(',').map(Number); } }
  if (!bg) return { data, info, method: 'none' };

  const THRESH = 24;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const trySeed = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (data[i + 3] < 8) { seen[idx] = 1; return; }
    if (rgbDist([data[i], data[i + 1], data[i + 2]], bg) > THRESH) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < width; x++) { trySeed(x, 0); trySeed(x, height - 1); }
  for (let y = 0; y < height; y++) { trySeed(0, y); trySeed(width - 1, y); }

  let removed = 0;
  while (stack.length) {
    const idx = stack.pop();
    const i = idx * 4;
    data[i + 3] = 0;
    removed++;
    const x = idx % width;
    const y = (idx / width) | 0;
    trySeed(x + 1, y); trySeed(x - 1, y); trySeed(x, y + 1); trySeed(x, y - 1);
  }
  log('cutout', `${frameName}: 边缘洪水抠图，清除 ${removed}px 背景`);
  return { data, info, method: removed > 0 ? 'edge-flood' : 'none' };
}

function hardenAlpha(rgba) {
  for (let i = 3; i < rgba.length; i += 4) {
    rgba[i] = rgba[i] >= 160 ? 255 : 0;
  }
}

// 主体包围盒（剪影），返回 null 表示全透明
function boundingBox(data, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] >= 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function marginPx(size) {
  return Math.max(1, Math.ceil(size * 0.05));
}

function fillMaxSize(specW, specH, outlineW) {
  const mx = marginPx(specW);
  const my = marginPx(specH);
  return {
    w: Math.max(1, specW - 2 * outlineW - 2 * mx),
    h: Math.max(1, specH - 2 * outlineW - 2 * my)
  };
}

// 填充包围盒：剔除外侧 outlineW 环（Chebyshev），描边不计入 90% 边距
function fillBoundingBox(data, width, height, outlineW) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFillPixel(data, width, height, x, y, outlineW)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function isFillPixel(data, width, height, x, y, outlineW) {
  const i = (y * width + x) * 4;
  if (data[i + 3] < 128) return false;
  if (outlineW <= 0) return true;
  for (let dy = -outlineW; dy <= outlineW; dy++) {
    for (let dx = -outlineW; dx <= outlineW; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
      if (data[(ny * width + nx) * 4 + 3] < 128) return false;
    }
  }
  return true;
}

function blit(src, sw, sh, dst, dw, dh, ox, oy) {
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const dx = x + ox, dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      const si = (y * sw + x) * 4;
      if (src[si + 3] < 8) continue;
      const di = (dy * dw + dx) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
}

// 安全边距：填充（不含描边）≤ 帧 90%
function checkSafeMargin(data, width, height, outlineW = 0) {
  const bb = fillBoundingBox(data, width, height, outlineW);
  if (!bb) return { ok: false, reason: 'EMPTY_FRAME' };
  const bw = bb.maxX - bb.minX + 1, bh = bb.maxY - bb.minY + 1;
  const marginOkW = bw <= width * 0.9, marginOkH = bh <= height * 0.9;
  return {
    ok: marginOkW && marginOkH,
    bw, bh, w: width, h: height, marginOkW, marginOkH, outlineW
  };
}

// 描边编码：外部 AI 轨全面关闭（主理人 2026-08-23）。
// 身份靠体型 + 剪影 + 精英双角；程序剪影兜底仍可自绘描边。
function expectedOutlineColor(_frameName) {
  return null;
}

function expectedOutlineWidth(_frameName) {
  return 0;
}

function checkOutlineEncoding(frameName, data, width, height) {
  const expectHex = expectedOutlineColor(frameName);
  if (!expectHex) return { ok: true, note: '普通单位无描边要求' };

  // 采样轮廓像素（非透明且至少一个 4 邻域为透明）
  let found = { name: null, count: 0 };
  const counts = new Map();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const neighborTransparent =
        data[((y - 1) * width + x) * 4 + 3] < 128 ||
        data[((y + 1) * width + x) * 4 + 3] < 128 ||
        data[(y * width + x - 1) * 4 + 3] < 128 ||
        data[(y * width + x + 1) * 4 + 3] < 128;
      if (!neighborTransparent) continue;
      const { name } = nearestToken([data[i], data[i + 1], data[i + 2]]);
      counts.set(name, (counts.get(name) || 0) + 1);
      if (counts.get(name) > found.count) found = { name, count: counts.get(name) };
    }
  }
  const expectedName = expectHex === '#54E6C9' ? '冷青' : expectHex === '#B06AF0' ? '幽紫' : '猩红';
  const ok = found.name === expectedName;
  return { ok, expect: expectedName, found: found.name, count: found.count };
}

// 描边后置补画（兜底：AI 描边在降采样后被稀释时，按契约补画）
// 对剪影边缘外扩 width px 画目标色描边（8 邻域膨胀）
function repaintOutline(frameName, data, width, height) {
  const expectHex = expectedOutlineColor(frameName);
  const outlineW = expectedOutlineWidth(frameName);
  if (!expectHex || outlineW === 0) return false;
  const oc = [parseInt(expectHex.slice(1, 3), 16), parseInt(expectHex.slice(3, 5), 16), parseInt(expectHex.slice(5, 7), 16)];

  const idx = (x, y) => (y * width + x) * 4;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < width && y < height;

  // 多轮膨胀：每轮把「透明且邻接不透明」的像素涂成描边色
  let painted = 0;
  for (let pass = 0; pass < outlineW; pass++) {
    const todo = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[idx(x, y) + 3] >= 128) continue; // 已有内容不覆盖
        // 8 邻域是否有不透明像素
        let adjacent = false;
        for (let dy = -1; dy <= 1 && !adjacent; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (inBounds(nx, ny) && data[idx(nx, ny) + 3] >= 128) { adjacent = true; break; }
          }
        }
        if (adjacent) todo.push([x, y]);
      }
    }
    if (todo.length === 0) break;
    for (const [x, y] of todo) {
      data[idx(x, y)] = oc[0]; data[idx(x, y) + 1] = oc[1]; data[idx(x, y) + 2] = oc[2];
      data[idx(x, y) + 3] = 255;
      painted++;
    }
  }
  return painted > 0;
}

function cropFromBoundingBox(bb, width, height, pad = 1) {
  const left = Math.max(0, bb.minX - pad);
  const top = Math.max(0, bb.minY - pad);
  return {
    left,
    top,
    width: Math.min(width - left, bb.maxX - bb.minX + 1 + pad * 2),
    height: Math.min(height - top, bb.maxY - bb.minY + 1 + pad * 2),
  };
}

function listRawFrames() {
  if (!fs.existsSync(RAW_DIR)) return [];
  return fs.readdirSync(RAW_DIR)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.replace(/\.png$/, ''))
    .filter(isKnownFrame);
}

function expandToFamilies(frameNames) {
  const requested = new Set(frameNames);
  const families = new Set(frameNames.map(familyKey));
  const out = new Set(frameNames);
  for (const raw of listRawFrames()) {
    if (families.has(familyKey(raw))) out.add(raw);
  }
  for (const name of out) {
    if (!requested.has(name) && families.has(familyKey(name))) {
      log('family', `纳入同族 ${name}（共享缩放）`);
    }
  }
  return [...out];
}

function groupByFamily(frameNames) {
  const groups = new Map();
  for (const name of frameNames) {
    const key = isFullBleedFrame(name) ? name : familyKey(name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(name);
  }
  return groups;
}

async function loadPrepared(frameName) {
  const spec = resolveFrameSpec(frameName);
  if (!spec) return { frameName, ok: false, error: 'UNKNOWN_FRAME（不在契约帧名表）' };
  const rawPath = path.join(RAW_DIR, `${frameName}.png`);
  if (!fs.existsSync(rawPath)) return { frameName, ok: false, error: `NO_RAW（缺 assets/raw/${frameName}.png）` };
  const img = sharp(rawPath);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) return { frameName, ok: false, error: 'BAD_IMAGE' };
  const { data: cutData, info: cutInfo, method } = await ensureTransparency(img, frameName);
  return { frameName, spec, rawPath, cutData, cutInfo, method, ok: true };
}

async function rasterFullBleed(prep) {
  const { spec, cutData, cutInfo } = prep;
  return sharp(cutData, { raw: { width: cutInfo.width, height: cutInfo.height, channels: 4 } })
    .resize(spec.w, spec.h, { fit: 'cover', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function rasterEntity(prep, sharedScale) {
  const { spec, cutData, cutInfo, frameName } = prep;
  const outlineW = expectedOutlineWidth(frameName);
  const fillMax = fillMaxSize(spec.w, spec.h, outlineW);
  const mx = marginPx(spec.w);
  const my = marginPx(spec.h);
  const tw = Math.max(1, Math.round(prep.crop.width * sharedScale));
  const th = Math.max(1, Math.round(prep.crop.height * sharedScale));
  const fitted = await sharp(cutData, { raw: { width: cutInfo.width, height: cutInfo.height, channels: 4 } })
    .extract(prep.crop)
    .resize(tw, th, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const scaledBb = boundingBox(fitted.data, fitted.info.width, fitted.info.height);
  if (!scaledBb) return { error: 'EMPTY（缩放后无主体）' };
  const { ox, oy } = alignOffsets(scaledBb, spec.w, spec.h, mx, my);
  const canvas = Buffer.alloc(spec.w * spec.h * 4);
  blit(fitted.data, fitted.info.width, fitted.info.height, canvas, spec.w, spec.h, ox, oy);
  return {
    data: canvas,
    info: { width: spec.w, height: spec.h, channels: 4 },
    layout: {
      family: familyKey(frameName),
      sharedScale,
      fillMax,
      crop: prep.crop,
      placed: { w: tw, h: th, ox, oy },
    },
  };
}

function finishPixels(frameName, data) {
  hardenAlpha(data);
  quantizePixels(data, { allowGrass: isFullBleedFrame(frameName) });
  const outlineW = expectedOutlineWidth(frameName);
  if (outlineW > 0) {
    const painted = repaintOutline(frameName, data, resolveFrameSpec(frameName).w, resolveFrameSpec(frameName).h);
    log('outline', `${frameName}: 后置描边 ${outlineW}px${painted ? '' : '（未画到像素）'}`);
  }
}

async function writeFramePng(frameName, spec, data) {
  const frameOut = path.join(FRAMES_DIR, `${frameName}.png`);
  const outPng = await sharp(data, { raw: { width: spec.w, height: spec.h, channels: 4 } }).png().toBuffer();
  fs.mkdirSync(path.dirname(frameOut), { recursive: true });
  fs.writeFileSync(frameOut, outPng);
}

async function processPrepared(prep, sharedScale) {
  const { frameName, spec, method } = prep;
  let scaled;
  let layout = null;
  if (method === 'full-bleed' || isFullBleedFrame(frameName)) {
    scaled = await rasterFullBleed(prep);
  } else {
    const bb = boundingBox(prep.cutData, prep.cutInfo.width, prep.cutInfo.height);
    if (!bb) return { frameName, ok: false, error: 'EMPTY（抠图后无主体）' };
    prep.crop = cropFromBoundingBox(bb, prep.cutInfo.width, prep.cutInfo.height);
    const raster = await rasterEntity(prep, sharedScale);
    if (raster.error) return { frameName, ok: false, error: raster.error };
    scaled = raster;
    layout = raster.layout;
  }
  finishPixels(frameName, scaled.data);
  await writeFramePng(frameName, spec, scaled.data);
  const result = validate(frameName, scaled.data, { width: spec.w, height: spec.h }, spec, { method });
  const metrics = roundMetrics(silhouetteMetrics(scaled.data, spec.w, spec.h));
  const pivot = metrics ? pivotFromFoot(metrics.footY, spec.h) : { x: 0.5, y: 0.5 };
  return { ...result, raw: prep.rawPath, layout, metrics, pivot };
}

async function processFamily(memberNames) {
  const prepared = [];
  const results = [];
  for (const name of memberNames) {
    const prep = await loadPrepared(name);
    if (!prep.ok) {
      results.push(prep);
      continue;
    }
    if (prep.method === 'full-bleed' || isFullBleedFrame(name)) {
      const r = await processPrepared(prep, 1);
      results.push(r);
      continue;
    }
    const bb = boundingBox(prep.cutData, prep.cutInfo.width, prep.cutInfo.height);
    if (!bb) {
      results.push({ frameName: name, ok: false, error: 'EMPTY（抠图后无主体）' });
      continue;
    }
    prep.crop = cropFromBoundingBox(bb, prep.cutInfo.width, prep.cutInfo.height);
    prepared.push(prep);
  }
  if (prepared.length === 0) return results;

  const spec = prepared[0].spec;
  const fillMax = fillMaxSize(spec.w, spec.h, expectedOutlineWidth(prepared[0].frameName));
  const sharedScale = computeSharedScale(
    prepared.map((p) => ({ w: p.crop.width, h: p.crop.height })),
    fillMax,
  );
  log('layout', `${familyKey(prepared[0].frameName)}: 共享缩放 ${sharedScale.toFixed(4)}（${prepared.length} 帧）`);
  for (const prep of prepared) {
    results.push(await processPrepared(prep, sharedScale));
  }
  return results;
}

function applyTemporalGates(report) {
  const byFamily = new Map();
  for (const [name, entry] of Object.entries(report.frames)) {
    if (!entry.metrics || isFullBleedFrame(name)) continue;
    const key = familyKey(name);
    if (!byFamily.has(key)) byFamily.set(key, []);
    byFamily.get(key).push(name);
  }
  report.families = report.families || {};
  for (const [family, names] of byFamily) {
    names.sort((a, b) => {
      if (a === family) return -1;
      if (b === family) return 1;
      return a.localeCompare(b);
    });
    const baseName = names.includes(family) ? family : names[0];
    const base = report.frames[baseName];
    if (!base?.metrics) continue;
    const spec = resolveFrameSpec(baseName);
    const pairs = {};
    for (const name of names) {
      if (name === baseName) continue;
      const variant = report.frames[name];
      if (!variant?.metrics) continue;
      const limits = temporalLimits(family, spec?.w ?? 64, name);
      const cmp = comparePair(base.metrics, variant.metrics, limits);
      pairs[name] = { vs: baseName, ...cmp, limits };
      variant.checks = variant.checks || {};
      variant.checks.temporal = cmp;
      if (!cmp.ok) {
        variant.issues = [...(variant.issues || []), ...cmp.issues.map((i) => `时间轴 vs ${baseName}: ${i}`)];
        variant.ok = false;
        variant.passed = 'FAIL';
      }
    }
    report.families[family] = { base: baseName, members: names, pairs };
    const basePivot = base.pivot;
    if (basePivot) {
      for (const name of names) {
        if (report.frames[name]) report.frames[name].pivot = { ...basePivot };
      }
    }
  }
}

async function checkExisting(frameName) {
  const spec = resolveFrameSpec(frameName);
  if (!spec) return { frameName, ok: false, error: 'UNKNOWN_FRAME（不在契约帧名表）' };
  const frameOut = path.join(FRAMES_DIR, `${frameName}.png`);
  if (!fs.existsSync(frameOut)) return { frameName, ok: false, error: 'NO_OUTPUT（先处理）' };
  const { data, info } = await sharp(frameOut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = validate(frameName, data, info, spec, {});
  const metrics = roundMetrics(silhouetteMetrics(data, spec.w, spec.h));
  const pivot = metrics ? pivotFromFoot(metrics.footY, spec.h) : { x: 0.5, y: 0.5 };
  return { ...result, metrics, pivot };
}

// 校验函数（尺寸/安全边距/剪影 L*/描边/透明）
function validate(frameName, data, info, spec, { entry = {}, method = null } = {}) {
  const { width, height } = info;
  const issues = [];
  const checks = {};

  // 尺寸
  checks.size = { ok: width === spec.w && height === spec.h, got: `${width}x${height}`, want: `${spec.w}x${spec.h}` };
  if (!checks.size.ok) issues.push(`尺寸 ${width}x${height} ≠ 契约 ${spec.w}x${spec.h}`);

  // 透明通道（是否有任何非透明像素）
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] >= 128) opaque++;
  checks.alpha = { ok: opaque > 0, opaque };
  if (!checks.alpha.ok) issues.push('帧全透明');

  // 安全边距（全幅贴图类跳过；量填充盒，不含描边）
  const isFullBleed = isFullBleedFrame(frameName);
  const outlineW = expectedOutlineWidth(frameName);
  if (!isFullBleed) {
    const margin = checkSafeMargin(data, width, height, outlineW);
    checks.margin = margin;
    if (!margin.ok) {
      if (margin.reason === 'EMPTY_FRAME') issues.push('主体为空');
      else issues.push(`填充 ${margin.bw}x${margin.bh} 超出帧 90%（${margin.w}x${margin.h}，不含描边）`);
    }
  } else {
    checks.margin = { ok: true, note: '全幅贴图类帧跳过安全边距' };
  }

  // 描边编码（先算：精英/Boss 的 L* 豁免依赖它）
  const outline = checkOutlineEncoding(frameName, data, width, height);
  checks.outline = outline;
  if (!outline.ok) issues.push(`描边主色 ${outline.found || '无'} ≠ 期望 ${outline.expect}`);

  // P-4 L* 分治
  const isBackgroundLike = isFullBleedFrame(frameName) && !frameName.startsWith('obst-');
  const isPlayerLike = frameName.startsWith('player') || frameName.startsWith('hero-') || frameName.startsWith('summon-');
  const isOrdinaryEnemy = frameName.startsWith('enemy-') && !frameName.startsWith('enemy-boss') && outlineW === 0;
  if (!isBackgroundLike) {
    const lstat = silhouetteLstats(data);
    let brightCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const L = luminanceL([data[i], data[i + 1], data[i + 2]]);
      if (L >= 60) brightCount++;
    }
    const total = lstat ? lstat.count : 1;
    const brightRatio = brightCount / total;
    const outlineOk = outline.ok && !outline.note;
    let ok;
    let note;
    if (isPlayerLike) {
      ok = !!(lstat && (lstat.avg >= 45 || brightRatio >= 0.03));
      note = '玩家/召唤物须银主体（L*≥45 或高亮≥3%），描边不能豁免';
    } else if (isOrdinaryEnemy) {
      ok = true;
      note = '暗红普通敌 L*豁免（靠剪影形状）';
    } else {
      // 无管线描边后，精英/Boss 不再靠描边豁免 L*；暗红主体仍靠体型/角饰可读
      ok = true;
      note = '精英/Boss 无描边：L* 不强制（体型 + 双角/独有剪影）';
    }
    checks.luminance = {
      ok,
      avg: lstat ? lstat.avg.toFixed(1) : null,
      brightRatio: (brightRatio * 100).toFixed(1) + '%',
      outlineExempt: !isPlayerLike && outlineOk,
      note
    };
    if (!checks.luminance.ok) {
      issues.push(`剪影 L* ${lstat ? lstat.avg.toFixed(1) : 'N/A'} < 45 且高亮 ${(brightRatio * 100).toFixed(1)}% < 3%（玩家/召唤物不可用描边豁免）`);
    }
    if (!lstat) issues.push('无可统计像素');
  } else {
    checks.luminance = { ok: true, note: '背景类帧跳过剪影 L* 断言' };
  }

  const ok = issues.length === 0;
  return {
    frameName, ok, atlas: spec.atlas, spec: `${spec.w}x${spec.h}`,
    checks, issues, method,
    passed: ok ? 'PASS' : 'FAIL'
  };
}

// ---------- CLI ----------
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    const names = allFrameNames();
    console.log(`契约帧名共 ${names.length} 个：`);
    for (const n of names) {
      const s = resolveFrameSpec(n);
      console.log(`  ${n}  (${s.w}x${s.h} @ ${s.atlas})`);
    }
    return;
  }
  if (args.includes('--all')) {
    if (!fs.existsSync(RAW_DIR)) { log('error', 'assets/raw/ 目录不存在'); return; }
    const frames = listRawFrames();
    if (frames.length === 0) { log('error', 'assets/raw/ 下无 PNG'); return; }
    log('batch', `发现契约帧 ${frames.length} 个`);
    await runBatch(frames);
    return;
  }
  const checkIdx = args.indexOf('--check');
  const frameArgs = args.filter((a) => !a.startsWith('--'));
  if (checkIdx >= 0) {
    const names = frameArgs.length ? frameArgs : (
      fs.existsSync(FRAMES_DIR)
        ? fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')).filter(isKnownFrame)
        : []
    );
    if (names.length === 0) { log('error', '--check 无成品可校验'); return; }
    await runCheck(names);
    return;
  }
  if (frameArgs.length === 0) {
    console.log(`用法：
  node process.mjs <帧名>...      处理指定帧（同族 raw 一并纳入共享缩放）
  node process.mjs --all          批量处理 assets/raw/
  node process.mjs --list         列出契约帧名
  node process.mjs --check [帧名] 校验已有产物（无帧名 = 全部成品 + 时间轴）`);
    return;
  }
  await runBatch(expandToFamilies(frameArgs));
}

function roundMetrics(m) {
  if (!m) return m;
  return {
    ...m,
    cx: Number(m.cx.toFixed(2)),
    cy: Number(m.cy.toFixed(2)),
  };
}

async function runBatch(frames) {
  const report = loadReport();
  report.frames = report.frames || {};
  for (const [, members] of groupByFamily(frames)) {
    const results = await processFamily(members);
    for (const r of results) {
      if (!r.frameName) continue;
      report.frames[r.frameName] = {
        ...r,
        metrics: roundMetrics(r.metrics),
        updatedAt: new Date().toISOString(),
      };
    }
  }
  applyTemporalGates(report);
  let pass = 0;
  let fail = 0;
  for (const name of frames) {
    const r = report.frames[name];
    if (!r) continue;
    printResult(r);
    if (r.ok) pass += 1;
    else fail += 1;
  }
  saveReport(report);
  console.log(`\n===== 批次完成：PASS ${pass} / FAIL ${fail}（含时间轴门禁） =====`);
  console.log(`验收报告：${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
}

async function runCheck(names) {
  const report = loadReport();
  report.frames = report.frames || {};
  for (const name of names) {
    const r = await checkExisting(name);
    const prev = report.frames[name] || {};
    report.frames[name] = { ...prev, ...r, layout: prev.layout, updatedAt: new Date().toISOString() };
  }
  applyTemporalGates(report);
  let pass = 0;
  let fail = 0;
  for (const name of names) {
    const r = report.frames[name];
    if (!r) continue;
    printResult(r);
    if (r.ok) pass += 1;
    else fail += 1;
  }
  saveReport(report);
  console.log(`\n===== 校验完成：PASS ${pass} / FAIL ${fail}（含时间轴门禁） =====`);
}

function printResult(r) {
  const tag = r.ok ? '✅' : '❌';
  console.log(`${tag} ${r.frameName}  ${r.passed || ''}${r.error ? ' — ' + r.error : ''}`);
  if (r.checks) {
    if (r.checks.size && !r.checks.size.ok) console.log(`     尺寸: ${r.checks.size.got} != ${r.checks.size.want}`);
    if (r.checks.luminance && !r.checks.luminance.ok) console.log(`     L*: ${r.checks.luminance.avg} (高亮 ${r.checks.luminance.brightRatio})`);
    if (r.checks.outline && !r.checks.outline.ok) console.log(`     描边: ${r.checks.outline.found} != ${r.checks.outline.expect}`);
    if (r.checks.margin && !r.checks.margin.ok && !r.checks.margin.reason) {
      console.log(`     边距(填充): ${r.checks.margin.bw}x${r.checks.margin.bh} / ${r.checks.margin.w}x${r.checks.margin.h}`);
    }
    if (r.checks.temporal && !r.checks.temporal.ok) {
      console.log(`     时间轴: ${r.checks.temporal.issues.join('；')}`);
    }
  }
}

// 调试用导出
export {
  ensureTransparency, boundingBox, quantizePixels, checkOutlineEncoding, repaintOutline,
  silhouetteLstats, resolveFrameSpec, familyKey, applyTemporalGates,
};

main().catch((e) => { console.error(e); process.exit(1); });

