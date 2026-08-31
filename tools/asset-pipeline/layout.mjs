// layout.mjs — P-6：动画族共享缩放 / 脚底对齐 / 时间轴门禁 / pivot 元数据
// 不写入 Phaser 帧级 pivot 字段（会自动 setOrigin，打乱现有碰撞中心）。

const VARIANT_RE = /-(?:v|skill-a|skill-b|skill-c|entrance|walk-a|walk-b|broken|tombstone)$/;

/** 循环剥后缀：`enemy-stonewolf-broken-v` → `enemy-stonewolf`（只 replace 一次会停在 `-broken`）。 */
export function familyKey(frameName) {
  let s = frameName;
  let prev;
  do {
    prev = s;
    s = s.replace(VARIANT_RE, '');
  } while (s !== prev);
  return s;
}

/**
 * 环 / 弹体 / 标记：视觉中心 = 画布中心。禁止套角色「脚底贴边」——
 * 否则空心环会被掀到画布下沿，冲击波/技能环缩放原点错位。
 */
export function isCenteredFxFrame(frameName) {
  if (frameName.startsWith('marker-')) return true;
  if (frameName.startsWith('skill-')) return true; // skill-ring-* 与 UI skill-*
  if (frameName.startsWith('proj-')) return true;
  if (frameName.startsWith('orb')) return true;
  if (frameName.startsWith('aura-')) return true;
  if (frameName.startsWith('ring-')) return true;
  if (frameName.startsWith('super-')) return true;
  if (frameName.startsWith('beam-')) return true;
  if (frameName.startsWith('p-')) return true;
  if (frameName.startsWith('decal-')) return true;
  if (frameName.startsWith('wslot-') || frameName.startsWith('hud-') || frameName.startsWith('upg-') || frameName.startsWith('codex-')) return true;
  if (frameName.startsWith('relic-') || frameName.startsWith('exw-card-') || frameName.startsWith('exw-emblem-') || frameName.startsWith('sticon-')) return true;
  if (frameName.startsWith('tree-') || frameName.startsWith('seat-') || frameName.startsWith('badge-') || frameName.startsWith('reso-')) return true;
  if (frameName === 'decor-church-glasslight' || frameName === 'chest') return true;
  return frameName === 'missile' || frameName === 'shockwave' || frameName === 'gem' || frameName === 'heal';
}

export function isAnimationVariant(frameName) {
  return VARIANT_RE.test(frameName);
}

/** idle 呼吸 / 技能姿态 / Boss 出场 / 破甲 / 墓碑 / 基帧 */
export function variantKind(frameName) {
  if (frameName.includes('-broken')) return 'broken';
  if (frameName.includes('-tombstone')) return 'tombstone';
  if (frameName.endsWith('-entrance')) return 'entrance';
  if (/-(?:skill-a|skill-b|skill-c)$/.test(frameName)) return 'skill';
  if (/-(?:walk-a|walk-b)$/.test(frameName)) return 'walk';
  if (frameName.endsWith('-v')) return 'idle';
  return 'base';
}

/** 四足 / 低重心：脚底允许 1px */
export function isQuadrupedFamily(family) {
  return /(?:hound|greywolf|shadowwolf|stonewolf|moonwolf|beetle|bat|fleshmass|fenrir)$/.test(family);
}

/** 无落地脚（幽灵等）：脚底允许 1px，避免 1px 量化误杀 */
export function isFloatingFamily(family) {
  return /wraith$/.test(family);
}

/** 犬科冲刺姿态面积门禁放宽到 20% */
export function isCanineFamily(family) {
  return /(?:hound|greywolf|shadowwolf|stonewolf|moonwolf|fenrir)$/.test(family);
}

/**
 * 时间轴门禁。idle `-v` 最严（呼吸帧）；skill / entrance 允许姿态变化，仍锁脚底。
 * @param {string} [variantName] 变体帧名（决定 kind）；缺省按 idle 口径
 */
export function temporalLimits(family, specW, variantName = '') {
  const kind = variantKind(variantName || `${family}-v`);
  const sizeHypot = specW >= 240 ? 4 : specW >= 96 ? 3 : 2;
  let hypotMax = sizeHypot;
  let footMax = (isQuadrupedFamily(family) || isFloatingFamily(family)) ? 1 : 0;
  let areaMax = isCanineFamily(family) ? 0.2 : 0.15;

  if (kind === 'skill' || kind === 'tombstone') {
    hypotMax = specW >= 240 ? 12 : specW >= 96 ? 8 : 6;
    footMax += 1;
    areaMax = Math.max(areaMax, 0.25);
  } else if (kind === 'broken') {
    // 剥甲：姿态仍锁脚，面积允许到 30%（岩甲脱落）
    hypotMax = specW >= 240 ? 12 : specW >= 96 ? 8 : 6;
    footMax += 1;
    areaMax = Math.max(areaMax, 0.3);
  } else if (kind === 'walk') {
    hypotMax = specW >= 240 ? 6 : specW >= 96 ? 4 : 3;
    areaMax = Math.max(areaMax, 0.2);
  } else if (kind === 'entrance') {
    hypotMax = specW >= 240 ? 24 : specW >= 96 ? 16 : 12;
    // 256 档出场顶边顶满时脚底无法与 idle 同钉；允许 3px（量化 + 顶边夹）
    footMax = Math.max(footMax, specW >= 240 ? 3 : 2);
    areaMax = 0.3;
  }

  return { hypotMax, footMax, areaMax, kind };
}

export function silhouetteMetrics(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
      n += 1;
    }
  }
  if (n === 0) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
    cx: sumX / n,
    cy: sumY / n,
    footY: maxY,
    topY: minY,
    n,
  };
}

export function comparePair(base, variant, limits) {
  const dCx = Math.abs(base.cx - variant.cx);
  const dCy = Math.abs(base.cy - variant.cy);
  const hypot = Math.hypot(dCx, dCy);
  const dFoot = Math.abs(base.footY - variant.footY);
  const dArea = Math.abs(variant.n - base.n) / Math.max(base.n, 1);
  const issues = [];
  if (hypot > limits.hypotMax + 1e-6) {
    issues.push(`重心 hypot ${hypot.toFixed(1)}px > ${limits.hypotMax}`);
  }
  if (dFoot > limits.footMax) {
    issues.push(`脚底 ΔY ${dFoot}px > ${limits.footMax}`);
  }
  if (dArea > limits.areaMax + 1e-6) {
    issues.push(`面积 Δ ${(dArea * 100).toFixed(1)}% > ${Math.round(limits.areaMax * 100)}%`);
  }
  return {
    hypot: Number(hypot.toFixed(2)),
    dCx: Number(dCx.toFixed(2)),
    dCy: Number(dCy.toFixed(2)),
    dFoot,
    dAreaPct: Number((dArea * 100).toFixed(1)),
    ok: issues.length === 0,
    issues,
  };
}

/** Phaser 归一化原点：脚底像素中心。写入 report / atlas.meta，不要写到 frames[].pivot。 */
export function pivotFromFoot(footY, canvasH) {
  return { x: 0.5, y: Number(((footY + 0.5) / canvasH).toFixed(4)) };
}

/** 同一动画族共用：取「刚好能装下最大姿势」的 contain 缩放，矮姿势不再被撑满。 */
export function computeSharedScale(crops, fillMax) {
  let s = Infinity;
  for (const c of crops) {
    if (c.w <= 0 || c.h <= 0) continue;
    const si = Math.min(fillMax.w / c.w, fillMax.h / c.h);
    if (si < s) s = si;
  }
  return Number.isFinite(s) ? s : 1;
}

/**
 * 水平：不透明包围盒居中。
 * 垂直：脚底（maxY）贴在「画布 − 5% 边距」。
 */
export function alignOffsets(scaledBb, specW, specH, marginX, marginY) {
  const bw = scaledBb.maxX - scaledBb.minX + 1;
  const ox = Math.floor((specW - bw) / 2) - scaledBb.minX;
  const footTarget = specH - marginY - 1;
  let oy = footTarget - scaledBb.maxY;
  const topAfter = oy + scaledBb.minY;
  if (topAfter < marginY) oy = marginY - scaledBb.minY;
  if (oy + scaledBb.maxY >= specH) oy = specH - 1 - scaledBb.maxY;
  if (oy + scaledBb.minY < 0) oy = -scaledBb.minY;
  return { ox, oy, footTarget };
}

/** 包围盒在画布正中（环/弹体/标记） */
export function alignOffsetsCentered(scaledBb, specW, specH) {
  const bw = scaledBb.maxX - scaledBb.minX + 1;
  const bh = scaledBb.maxY - scaledBb.minY + 1;
  let ox = Math.floor((specW - bw) / 2) - scaledBb.minX;
  let oy = Math.floor((specH - bh) / 2) - scaledBb.minY;
  if (ox + scaledBb.minX < 0) ox = -scaledBb.minX;
  if (oy + scaledBb.minY < 0) oy = -scaledBb.minY;
  if (ox + scaledBb.maxX >= specW) ox = specW - 1 - scaledBb.maxX;
  if (oy + scaledBb.maxY >= specH) oy = specH - 1 - scaledBb.maxY;
  return { ox, oy };
}
