// box-128.mjs — 128 角色帧「入盒」：等比缩放 / 内容零裁切 / 脚底基线锁定 / 悬空尖角审计
//
// 背景（2026-11-16 · NV-ENG-EXEC-31）：
//   现网 `assets/frames/hero-violet-walk-{a..f}.png` 的 128 入盒**当年是临时内联代码**做的
//   （`48cb524` 只提交了产物、没提交脚本），不可复现、也没有任何断言。
//   本文件把它固化成契约化的模块，并把「内容被裁」变成**构造上不可能 + 运行期断言**：
//
//   1) 缩放系数 s = min(目标内容高 / bbox 高, 可用宽 / bbox 宽)  —— 两向取小 ⇒ **等比、永不裁**
//   2) 脚底（内容 maxY）贴 FOOT_Y=127                                —— 与现网 / pivots.json 基线一致
//   3) 水平按内容 bbox 居中，四周留透明                               —— 允许留白，不允许裁
//   4) 出图后强制断言四边距 ≥ MIN_MARGIN，违约即抛错（不是 warn）
//
// 「限宽」是显式约束而不是隐性裁切：宽度超出可用宽时**降 s**（内容变小、留白变多），
// 绝不走 `fit:cover` / 直接 blit 溢出丢弃。plan.widthClamped 会记录本轮是否触发了降 s。

export const BOX = 128;
/** 脚底基线：与现网 6 帧、`pivots.json` 的 y≈0.9961 绑定，改动会让角色在局内浮起/陷入。 */
export const FOOT_Y = 127;
/** 内容目标高：与现网 11 帧集合（idle/-v/-walk-s/walk a–f/skill a,b）一致。 */
export const CONTENT_H = 112;
/** 四边最小透明边距（px）：内容贴边 = 可能已被裁。 */
export const MIN_MARGIN = 1;
/** 去背阈值：与 walk 出图当时的边缘洪水口径一致。 */
const KNOCK_THRESH = 30;

export function contentBox(img) {
  const { w, h, data } = img;
  let minX = w, minY = h, maxX = -1, maxY = -1, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 128) continue;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, n };
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 棚拍黑底去背：只从画布四边泛洪，清「连到边」的近黑底。
 * 不做全局阈值抹黑——黑袍/黑鞋会和黑底同色，全局抹会把剪影抠穿。
 */
export function knockStudioBackground(img, { thresh = KNOCK_THRESH } = {}) {
  const { w, h } = img;
  const data = Buffer.from(img.data);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const trySeed = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    const d = Math.hypot(data[i], data[i + 1], data[i + 2]);
    if (d > thresh) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < w; x++) { trySeed(x, 0); trySeed(x, h - 1); }
  for (let y = 0; y < h; y++) { trySeed(0, y); trySeed(w - 1, y); }
  let removed = 0;
  while (stack.length) {
    const idx = stack.pop();
    data[idx * 4 + 3] = 0;
    removed++;
    const x = idx % w;
    const y = (idx / w) | 0;
    trySeed(x - 1, y); trySeed(x + 1, y); trySeed(x, y - 1); trySeed(x, y + 1);
  }
  return { w, h, data, removed };
}

/**
 * 只算几何，不碰像素。s 两向取小 ⇒ 等比 + 不裁。
 * @returns {{scale:number, tw:number, th:number, widthClamped:boolean}}
 */
export function plan128(bb, { box = BOX, contentH = CONTENT_H, minMargin = MIN_MARGIN } = {}) {
  const availW = box - 2 * minMargin;
  const sByH = contentH / bb.h;
  const sByW = availW / bb.w;
  const widthClamped = sByW < sByH;
  const scale = Math.min(sByH, sByW);
  return {
    scale,
    tw: Math.max(1, Math.round(bb.w * scale)),
    th: Math.max(1, Math.round(bb.h * scale)),
    widthClamped,
  };
}

/**
 * 入盒。输入需已去背（RGBA，alpha 二值或带边）。
 * @param {{w:number,h:number,data:Buffer}} img
 * @param {{resize:(raw:object,w:number,h:number,opts:object)=>Promise<{data:Buffer,w:number,h:number}>}} io
 *        缩放入口（注入以便单测；生产用 sharpIo()）
 */
export async function boxTo128(img, io, opts = {}) {
  const {
    frame = '(unnamed)',
    box = BOX,
    footY = FOOT_Y,
    contentH = CONTENT_H,
    minMargin = MIN_MARGIN,
    kernel = 'nearest',
    harden = true,
    requireBottomMargin = false,
  } = opts;
  const bb = contentBox(img);
  if (!bb) throw new Error(`${frame}: EMPTY（去背后无主体）`);
  const plan = plan128(bb, { box, contentH, minMargin });

  const cropped = { w: bb.w, h: bb.h, data: cropRgba(img, bb) };
  const fitted = await io.resize(cropped, plan.tw, plan.th, { kernel });
  const fbb = contentBox(fitted);
  if (!fbb) throw new Error(`${frame}: EMPTY（缩小时后无主体）`);

  // 水平：按内容 bbox 居中；垂直：脚底贴 footY
  const ox = Math.floor((box - fbb.w) / 2) - fbb.minX;
  const oy = footY - fbb.maxY;

  const canvas = Buffer.alloc(box * box * 4);
  for (let y = 0; y < fitted.h; y++) {
    for (let x = 0; x < fitted.w; x++) {
      const si = (y * fitted.w + x) * 4;
      if (fitted.data[si + 3] < 128) continue;
      const dx = x + ox;
      const dy = y + oy;
      // 几何上不该越界；越界 = 说明 plan128 被绕过，直接抛错而不是静默丢弃
      if (dx < 0 || dy < 0 || dx >= box || dy >= box) {
        throw new Error(`${frame}: BLIT_OOB（dx=${dx} dy=${dy}）—— 内容会被裁，拒绝出图`);
      }
      const di = (dy * box + dx) * 4;
      canvas[di] = fitted.data[si];
      canvas[di + 1] = fitted.data[si + 1];
      canvas[di + 2] = fitted.data[si + 2];
      canvas[di + 3] = 255;
    }
  }
  if (harden) {
    for (let i = 3; i < canvas.length; i += 4) canvas[i] = canvas[i] >= 160 ? 255 : 0;
  }

  const out = { w: box, h: box, data: canvas };
  const audit = auditFrame(out, { footY, minMargin, frame, requireBottomMargin });
  return { ...out, plan, sourceBox: bb, audit };
}

/**
 * 源帧体检（在 384×672 生成帧上跑，入盒之前）。
 * 生成阶段最常见的两种「内容被裁」：
 *   ① 角色漂移到画布边 → 肢体被生成画布切掉（本缺陷直接原因）
 *   ② 肢体在空气里收尖（模型没画完）
 * 只要 bbox 任一方向贴住生成画布边，就**不允许**入盒 —— 否则 128 会把「已被裁」当成正常内容缩放。
 */
export function auditSource(img, { frame = '(unnamed)', minEdge = 2 } = {}) {
  const bb = contentBox(img);
  if (!bb) return { frame, ok: false, violations: ['EMPTY（去背后无主体）'], warnings: [] };
  const edges = {
    top: bb.minY,
    bottom: img.h - 1 - bb.maxY,
    left: bb.minX,
    right: img.w - 1 - bb.maxX,
  };
  const violations = [];
  for (const [side, px] of Object.entries(edges)) {
    if (px < minEdge) violations.push(`源帧内容贴生成画布 ${side} 边（${px}px < ${minEdge}）—— 肢体已被生成画布切掉`);
  }
  const warnings = danglingTips(img, bb).map(
    (t) => `源帧悬空尖角 x${t.x0}-${t.x1} y=${t.y} 宽${t.w}px 亮度${Math.round(t.luma)}`,
  );
  return { frame, ok: violations.length === 0, bb, edges, violations, warnings, width: img.w, height: img.h };
}

function cropRgba(img, bb) {
  const data = Buffer.alloc(bb.w * bb.h * 4);
  for (let y = 0; y < bb.h; y++) {
    const from = ((bb.minY + y) * img.w + bb.minX) * 4;
    img.data.copy(data, y * bb.w * 4, from, from + bb.w * 4);
  }
  return data;
}

/**
 * 出图后审计：四边距 + 脚底 + 悬空尖角。
 * 违约项进 `violations`，调用方必须 check（`assertClean` 会抛）。
 */
export function auditFrame(img, { footY = FOOT_Y, minMargin = MIN_MARGIN, frame = '(unnamed)', requireBottomMargin = false } = {}) {
  const bb = contentBox(img);
  if (!bb) return { frame, ok: false, violations: ['EMPTY'] };
  const margins = {
    top: bb.minY,
    bottom: img.h - 1 - bb.maxY,
    left: bb.minX,
    right: img.w - 1 - bb.maxX,
  };
  const violations = [];
  const warnings = [];
  // 左 / 上 / 右：任何一 px 贴边都视为「可能已被裁」，硬失败。
  for (const side of ['top', 'left', 'right']) {
    if (margins[side] < minMargin) violations.push(`贴边 ${side}=${margins[side]}px < ${minMargin}`);
  }
  // 底边：默认按「脚底贴基线」判定 —— 脚底站在画布最后一行是**设计基线**（现网 11 帧 + pivots.json 依赖它），
  // 不是裁切。只有 requireBottomMargin=true（用户要求严格四边 ≥1px）才要求底边距。
  if (requireBottomMargin) {
    if (margins.bottom < minMargin) violations.push(`贴边 bottom=${margins.bottom}px < ${minMargin}（严格四边模式）`);
  } else if (margins.bottom < 0) {
    violations.push(`内容超出画布底边 ${margins.bottom}px`);
  }
  if (bb.maxY !== footY) violations.push(`脚底 y=${bb.maxY} ≠ 基线 ${footY}`);
  const dangling = danglingTips(img, bb);
  for (const t of dangling) {
    // 已知局限：128 尺度下细尖角常与前腿剪影合并 ⇒ 检不全。故只作 warn，不作门禁。
    warnings.push(`悬空尖角 x${t.x0}-${t.x1} y=${t.y} 宽${t.w}px 亮度${Math.round(t.luma)}（疑似肢体被截断）`);
  }
  return {
    frame,
    ok: violations.length === 0,
    bb,
    margins,
    footY: bb.maxY,
    dangling,
    violations,
    warnings,
    requireBottomMargin,
  };
}

export function assertClean(audit) {
  if (!audit.ok) throw new Error(`${audit.frame}: ${audit.violations.join('；')}`);
  return audit;
}

/**
 * 悬空尖角检测：找「下方没有任何内容」的剪影端点，若它又细（≤3px）又亮（白袜），
 * 就是「腿在空气里收成尖角」——本次缺陷的特征。
 * 只扫下半身（内容高 55% 以下），避开手/袖口这类合法端点。
 */
export function danglingTips(img, bb = contentBox(img), { sectorFrac = 0.55, maxW = 3, minLuma = 70 } = {}) {
  if (!bb) return [];
  const { w, data } = img;
  const yFloor = Math.round(bb.minY + bb.h * sectorFrac);
  const stanceBottom = bb.maxY;
  const tips = [];
  for (let y = stanceBottom - 5; y >= yFloor; y--) {
    let x = 0;
    while (x < w) {
      if (data[(y * w + x) * 4 + 3] < 128) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < w && data[(y * w + x1 + 1) * 4 + 3] >= 128) x1++;
      // 下方一行在 [x-1, x1+1] 内是否还有内容
      let below = false;
      if (y + 1 < img.h) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x1 + 1); xx++) {
          if (data[((y + 1) * w + xx) * 4 + 3] >= 128) { below = true; break; }
        }
      }
      if (!below) {
        const runW = x1 - x + 1;
        let sum = 0, cnt = 0;
        for (let xx = x; xx <= x1; xx++) {
          const i = (y * w + xx) * 4;
          sum += luma(data[i], data[i + 1], data[i + 2]);
          cnt++;
        }
        const mean = cnt ? sum / cnt : 0;
        if (runW <= maxW && mean >= minLuma) tips.push({ x0: x, x1, y, w: runW, luma: mean });
      }
      x = x1 + 1;
    }
  }
  return tips;
}

/**
 * 鞋块统计：在最低 `band` 行里找暗色连通域（luma < darkLuma），块数即「可见的鞋」数上限。
 * 用途：走/站循环的对象量——「应有 2 个鞋块」。
 * 注意：两鞋相邻时会**合并成 1 块**（面积≈两块之和），所以这块数是**必要不充分**指标，
 * 必须配合目视。它擅长抓「只剩一只鞋」这种断腿签名（本项目 2026-11-16 的缺陷）。
 */
export function shoeBlobs(img, { darkLuma = 70, band = 18, minArea = 6 } = {}) {
  const bb = contentBox(img);
  if (!bb) return { count: 0, blobs: [] };
  const { w, data } = img;
  const y0 = Math.max(0, bb.maxY - band);
  const H = bb.maxY + 1;
  const seen = new Uint8Array(w * H);
  const dark = (x, y) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) return false;
    return luma(data[i], data[i + 1], data[i + 2]) < darkLuma;
  };
  const blobs = [];
  for (let y = y0; y <= bb.maxY; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x]) { continue; }
      if (!dark(x, y)) { seen[y * w + x] = 1; continue; }
      const stack = [[x, y]];
      seen[y * w + x] = 1;
      let area = 0, minX = x, maxX = x, minY = y, maxY = y;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny > bb.maxY) continue;
          if (seen[ny * w + nx]) continue;
          seen[ny * w + nx] = 1;
          if (dark(nx, ny)) stack.push([nx, ny]);
        }
      }
      if (area >= minArea) blobs.push({ area, minX, maxX, minY, maxY });
    }
  }
  blobs.sort((a, b) => b.area - a.area);
  return { count: blobs.length, blobs };
}

/** 生产用缩放入口（sharp 只在 Node 侧需要，单测可注桩） */
export async function sharpIo() {  const { createRequire } = await import('node:module');
  const require = createRequire(new URL('./package.json', import.meta.url));
  const sharp = require('sharp');
  return {
    async resize(src, tw, th, { kernel = 'nearest' } = {}) {
      const { data, info } = await sharp(src.data, {
        raw: { width: src.w, height: src.h, channels: 4 },
      })
        .resize(tw, th, { fit: 'fill', kernel })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { w: info.width, h: info.height, data: Buffer.from(data) };
    },
    async load(file) {
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { w: info.width, h: info.height, data: Buffer.from(data) };
    },
    async save(img, file) {
      await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).png().toFile(file);
    },
  };
}
