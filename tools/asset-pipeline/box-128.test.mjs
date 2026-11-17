// box-128.test.mjs — 128 入盒「不裁内容 / 等比 / 脚底基线」单元测试（不碰 assets/）
// 用法：node box-128.test.mjs

import {
  plan128,
  boxTo128,
  auditFrame,
  auditSource,
  danglingTips,
  contentBox,
  knockStudioBackground,
  shoeBlobs,
  BOX,
  FOOT_Y,
  CONTENT_H,
  MIN_MARGIN,
} from './box-128.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

/** 造一张 RGBA 图：在 rect 内填不透明色 */
function makeImg(w, h, rects = [], bg = { r: 30, g: 60, b: 90, a: 255 }) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bg.r; data[i * 4 + 1] = bg.g; data[i * 4 + 2] = bg.b; data[i * 4 + 3] = bg.a;
  }
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = (y * w + x) * 4;
        data[i] = r.r ?? 230; data[i + 1] = r.g ?? 225; data[i + 2] = r.b ?? 210; data[i + 3] = 255;
      }
    }
  }
  return { w, h, data };
}

/** 最近邻缩放的注桩（不依赖 sharp，保证单测可在任意环境跑） */
const stubIo = {
  async resize(src, tw, th) {
    const data = Buffer.alloc(tw * th * 4);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const sx = Math.min(src.w - 1, Math.floor((x * src.w) / tw));
        const sy = Math.min(src.h - 1, Math.floor((y * src.h) / th));
        const si = (sy * src.w + sx) * 4;
        const di = (y * tw + x) * 4;
        data[di] = src.data[si]; data[di + 1] = src.data[si + 1];
        data[di + 2] = src.data[si + 2]; data[di + 3] = src.data[si + 3];
      }
    }
    return { w: tw, h: th, data };
  },
};

// ── 1. plan128：常规人形按高定尺度
{
  const p = plan128({ w: 100, h: 600 });
  assert(!p.widthClamped, 'plan128 常规：不该触发宽降 s');
  eq(p.th, CONTENT_H, 'plan128 常规：内容高 = 112');
  assert(p.tw <= BOX - 2 * MIN_MARGIN, 'plan128 常规：宽在可用宽内');
}

// ── 2. plan128：极宽姿势必须降 s（而不是横向裁切）
{
  const p = plan128({ w: 700, h: 100 });
  assert(p.widthClamped, 'plan128 极宽：必须触发宽降 s');
  assert(p.tw <= BOX - 2 * MIN_MARGIN, `plan128 极宽：缩放后宽 ${p.tw} 必须 ≤ ${BOX - 2 * MIN_MARGIN}`);
  assert(p.th < CONTENT_H, 'plan128 极宽：降 s 后内容变矮（允许留白，不裁）');
}

// ── 3. boxTo128：常规人形，脚底贴基线、四边不贴边
{
  const img = makeImg(200, 600, [{ x: 80, y: 10, w: 60, h: 580 }]);
  const r = await boxTo128(img, stubIo, { frame: 't-normal' });
  eq(r.w, BOX, 'boxTo128 常规：输出宽');
  eq(r.h, BOX, 'boxTo128 常规：输出高');
  const bb = contentBox(r);
  eq(bb.maxY, FOOT_Y, 'boxTo128 常规：脚底 = 127');
  eq(bb.h, CONTENT_H, 'boxTo128 常规：内容高 = 112');
  assert(bb.minX >= MIN_MARGIN, 'boxTo128 常规：左边距 ≥1');
  assert(r.w - 1 - bb.maxX >= MIN_MARGIN, 'boxTo128 常规：右边距 ≥1');
  assert(bb.minY >= MIN_MARGIN, 'boxTo128 常规：上边距 ≥1');
  assert(r.audit.ok, `boxTo128 常规：审计应通过，实际 ${r.audit.violations.join('；')}`);
}

// ── 4. boxTo128：极宽源图不裁（降 s 后左右仍留边）
{
  const img = makeImg(700, 100, [{ x: 0, y: 5, w: 700, h: 90 }]);
  const r = await boxTo128(img, stubIo, { frame: 't-wide' });
  const bb = contentBox(r);
  assert(bb.w <= BOX - 2 * MIN_MARGIN, `boxTo128 极宽：内容宽 ${bb.w} 必须 ≤ ${BOX - 2 * MIN_MARGIN}`);
  assert(bb.minX >= MIN_MARGIN, 'boxTo128 极宽：左边距 ≥1');
  assert(r.audit.ok, `boxTo128 极宽：审计应通过，实际 ${r.audit.violations.join('；')}`);
  assert(r.plan.widthClamped, 'boxTo128 极宽：plan 应记录宽降 s');
}

// ── 5. auditFrame：内容贴左边 → 硬失败
{
  const img = makeImg(128, 128, [{ x: 0, y: 16, w: 40, h: 112 }], { r: 0, g: 0, b: 0, a: 0 });
  const a = auditFrame(img, { frame: 't-edge' });
  assert(!a.ok, 'auditFrame 贴左边：应失败');
  assert(a.violations.some((v) => v.includes('left')), 'auditFrame 贴左边：违约项应含 left');
}

// ── 6. auditFrame：脚底不在基线 → 硬失败
{
  const img = makeImg(128, 128, [{ x: 40, y: 16, w: 40, h: 108 }], { r: 0, g: 0, b: 0, a: 0 });
  const a = auditFrame(img, { frame: 't-foot' });
  assert(!a.ok, 'auditFrame 脚底错位：应失败');
  assert(a.violations.some((v) => v.includes('脚底')), 'auditFrame 脚底错位：违约项应含脚底');
}

// ── 7. auditSource：内容贴生成画布右边 → 硬失败（本轮缺陷的直接机制）
{
  const img = makeImg(384, 672, [{ x: 240, y: 20, w: 144, h: 600 }], { r: 0, g: 0, b: 0, a: 0 });
  const a = auditSource(img, { frame: 't-src-clip' });
  assert(!a.ok, 'auditSource 贴右边界：应失败');
  assert(a.violations.some((v) => v.includes('right')), 'auditSource 贴右边界：违约项应含 right');
}

// ── 8. auditSource：留边充裕 → 通过
{
  const img = makeImg(384, 672, [{ x: 60, y: 20, w: 200, h: 600 }], { r: 0, g: 0, b: 0, a: 0 });
  const a = auditSource(img, { frame: 't-src-ok' });
  assert(a.ok, `auditSource 留边：应通过，实际 ${a.violations.join('；')}`);
}

// ── 9. danglingTips：白袜在空气里收尖 → 被检出
{
  // 造一条「上宽下窄、末端悬空」的白色楔形（缺陷签名）
  const w = 128, h = 128;
  const data = Buffer.alloc(w * h * 4, 0);
  const paint = (x, y) => {
    const i = (y * w + x) * 4;
    data[i] = 235; data[i + 1] = 232; data[i + 2] = 225; data[i + 3] = 255;
  };
  // 主干（到 y=127 的脚）
  for (let y = 20; y <= 127; y++) for (let x = 50; x <= 62; x++) paint(x, y);
  // 楔形：从 y=60 起向右收尖，末端 y=100 处只剩 1px
  for (let y = 60; y <= 100; y++) {
    const len = Math.max(1, Math.round((100 - y) / 2) + 1);
    for (let k = 0; k < len; k++) paint(64 + k, y);
  }
  const img = { w, h, data };
  const tips = danglingTips(img, contentBox(img));
  assert(tips.length > 0, `danglingTips：应收尖角，实际 ${tips.length}`);
  assert(tips.some((t) => t.y >= 95 && t.y <= 101), `danglingTips：尖角应在 y≈100，实际 ${tips.map((t) => t.y).join(',')}`);
}

// ── 10. knockStudioBackground：只清连到边的底，不抠穿内部同色区
{
  // 黑底 + 中间一块黑（不连边）+ 白框
  const w = 40, h = 40;
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4 + 3] = 255; }
  // 白色环
  for (let x = 10; x < 30; x++) for (const y of [10, 29]) { const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = 240; }
  for (let y = 10; y < 30; y++) for (const x of [10, 29]) { const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = 240; }
  const img = { w, h, data };
  const k = knockStudioBackground(img);
  eq(k.data[0 * 4 + 3], 0, 'knock：角落（连边黑底）应被清');
  const inner = (20 * w + 20) * 4 + 3;
  eq(k.data[inner], 255, 'knock：环内不连边的黑区不应被清（防抠穿）');
}

// ── 11. shoeBlobs：两只分开的鞋 → 2 块；只有一只 → 1 块
{
  const w = 128, h = 128;
  const two = Buffer.alloc(w * h * 4, 0);
  const shoe = (buf, x0, x1, y0, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      buf[i] = 20; buf[i + 1] = 20; buf[i + 2] = 22; buf[i + 3] = 255;
    }
  };
  shoe(two, 40, 55, 118, 127);
  shoe(two, 70, 85, 118, 127);
  eq(shoeBlobs({ w, h, data: two }).count, 2, 'shoeBlobs：两只分开的鞋 = 2 块');
  const one = Buffer.alloc(w * h * 4, 0);
  shoe(one, 40, 55, 118, 127);
  eq(shoeBlobs({ w, h, data: one }).count, 1, 'shoeBlobs：只剩一只鞋 = 1 块');
}

console.log('box-128.test.mjs: all assertions passed');