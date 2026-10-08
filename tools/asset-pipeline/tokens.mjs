// tokens.mjs — 14 token 色相 + 同色相明度阶 + §2.2 派生族（案 A）
// 契约：asset-spec §2.4「只用 token 色相，允许同色相不同明度；禁止新色相」
// 角色帧禁止落到草地 token（银灰中间调以前被 Lab 最近邻吸进草叶，袍子发碎）

export const TOKENS = [
  { name: '墨夜蓝黑', hex: '#0B0E14' },
  { name: '暗紫灰',   hex: '#131722' },
  { name: '暗草绿',   hex: '#18201C' },
  { name: '草叶',     hex: '#2A3B2E' },
  { name: '月银白',   hex: '#E8F0FA' },
  { name: '冷青',     hex: '#54E6C9' },
  { name: '暗血红',   hex: '#7E1E1E' },
  { name: '幽紫',     hex: '#B06AF0' },
  { name: '猩红',     hex: '#FF3B3B' },
  { name: '金',       hex: '#FFC93C' },
  { name: '血橙红',   hex: '#FF3B30' },
  { name: '电光蓝',   hex: '#4FC3F7' },
  { name: '青绿',     hex: '#43D17C' },
  { name: '纸白',     hex: '#F2F5F9' }
];

export const BACKGROUND_TOKENS = ['墨夜蓝黑', '暗紫灰', '暗草绿'];
export const SILHOUETTE_TOKENS = ['月银白', '冷青', '纸白'];
export const GRASS_TOKEN_NAMES = ['暗草绿', '草叶'];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]) {
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  c = Math.min(1, Math.max(0, c));
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) / 1.0;
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const finv = (t) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  const X = 0.95047 * finv(fx);
  const Y = 1.0 * finv(fy);
  const Z = 1.08883 * finv(fz);
  const R = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  const G = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  const B = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)];
}

export function luminanceL(rgb) {
  return rgbToLab(rgb)[0];
}

function lerpLab(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ramp(fromHex, toHex, steps, family, prefix) {
  const a = rgbToLab(hexToRgb(fromHex));
  const b = rgbToLab(hexToRgb(toHex));
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 1 : i / (steps - 1);
    const lab = lerpLab(a, b, t);
    const rgb = labToRgb(lab);
    out.push({ family, name: `${prefix}-${i}`, rgb, lab, hex: rgbToHex(rgb) });
  }
  return out;
}

function tokenStep(name, family) {
  const t = TOKENS.find((x) => x.name === name);
  const rgb = hexToRgb(t.hex);
  return { family, name, rgb, lab: rgbToLab(rgb), hex: t.hex };
}

function hexStep(hex, family, name) {
  const rgb = hexToRgb(hex);
  return { family, name, rgb, lab: rgbToLab(rgb), hex: rgbToHex(rgb) };
}

// 同色相明度阶：14 token 锚 + art-bible §2.2 战斗层派生（案 A，不算新色相）
const PALETTE = [
  ...ramp('#0B0E14', '#E8F0FA', 7, 'silver', '银'),
  tokenStep('纸白', 'silver'),
  ...ramp('#0B0E14', '#7E1E1E', 4, 'blood', '血暗'),
  ...ramp('#7E1E1E', '#FF3B3B', 3, 'blood', '血亮'),
  tokenStep('血橙红', 'blood'),
  ...ramp('#0B0E14', '#54E6C9', 4, 'cyan', '青'),
  ...ramp('#0B0E14', '#B06AF0', 4, 'purple', '紫'),
  ...ramp('#0B0E14', '#FFC93C', 4, 'gold', '金'),
  ...ramp('#0B0E14', '#4FC3F7', 3, 'blue', '蓝'),
  ...ramp('#0B0E14', '#43D17C', 3, 'heal', '绿'),
  ...ramp('#0B0E14', '#18201C', 3, 'grass', '草暗'),
  ...ramp('#18201C', '#2A3B2E', 3, 'grass', '草叶'),
  // §2.2 派生族：酒/巡夜/肤/橄榄/骨灰（硬禁猩红与草叶）
  hexStep('#3A1F24', 'wine', '酒-0'),
  hexStep('#512C33', 'wine', '酒-1'),
  hexStep('#6B3942', 'wine', '酒-2'),
  hexStep('#8A545C', 'wine', '酒-3'),
  hexStep('#2A3038', 'night', '墨衣'),
  hexStep('#3A4250', 'night', '圣袍灰'),
  hexStep('#3A4554', 'night', '巡夜布'),
  hexStep('#4A5566', 'night', '巡夜亮'),
  hexStep('#3A4A3E', 'olive', '橄-0'),
  hexStep('#4A5C4E', 'olive', '橄-1'),
  hexStep('#6A7C6E', 'olive', '橄-2'),
  hexStep('#8A8074', 'ash', '骨灰-0'),
  hexStep('#C4B8A8', 'ash', '骨灰-1'),
  hexStep('#D8D0C4', 'ash', '骨灰-2'),
  hexStep('#7F664D', 'skin', '肤-0'),
  hexStep('#A07F5E', 'skin', '肤-1'),
  hexStep('#C3996E', 'skin', '肤-2'),
  hexStep('#D2B4A0', 'skin', '肤-3'),
];

const CORE_ANCHORS = {
  silver: [rgbToLab(hexToRgb('#E8F0FA')), rgbToLab(hexToRgb('#131722'))],
  blood: [rgbToLab(hexToRgb('#7E1E1E')), rgbToLab(hexToRgb('#FF3B3B')), rgbToLab(hexToRgb('#FF3B30'))],
  cyan: [rgbToLab(hexToRgb('#54E6C9'))],
  purple: [rgbToLab(hexToRgb('#B06AF0'))],
  gold: [rgbToLab(hexToRgb('#FFC93C'))],
  blue: [rgbToLab(hexToRgb('#4FC3F7'))],
  heal: [rgbToLab(hexToRgb('#43D17C'))],
  grass: [rgbToLab(hexToRgb('#2A3B2E')), rgbToLab(hexToRgb('#18201C'))],
};

const DERIVED_ANCHORS = {
  wine: [rgbToLab(hexToRgb('#6B3942')), rgbToLab(hexToRgb('#512C33')), rgbToLab(hexToRgb('#8A545C'))],
  night: [rgbToLab(hexToRgb('#3A4554')), rgbToLab(hexToRgb('#3A4250')), rgbToLab(hexToRgb('#2A3038'))],
  olive: [rgbToLab(hexToRgb('#4A5C4E')), rgbToLab(hexToRgb('#6A7C6E'))],
  ash: [rgbToLab(hexToRgb('#C4B8A8')), rgbToLab(hexToRgb('#8A8074'))],
  skin: [rgbToLab(hexToRgb('#D2B4A0')), rgbToLab(hexToRgb('#C3996E')), rgbToLab(hexToRgb('#7F664D'))],
};

function abDist(p, q) {
  const da = p[1] - q[1], db = p[2] - q[2];
  return da * da + db * db;
}

function nearestAnchorFamily(lab, table, { skipGrass = false } = {}) {
  let best = null;
  let bestD = Infinity;
  for (const [family, anchors] of Object.entries(table)) {
    if (skipGrass && family === 'grass') continue;
    for (const anchor of anchors) {
      const d = labDist(lab, anchor);
      if (d < bestD) {
        bestD = d;
        best = family;
      }
    }
  }
  return best ? { family: best, dist: bestD } : null;
}

function classifyFamily(lab, allowGrass) {
  const chroma = Math.hypot(lab[1], lab[2]);
  const derived = nearestAnchorFamily(lab, DERIVED_ANCHORS);
  const core = nearestAnchorFamily(lab, CORE_ANCHORS, { skipGrass: !allowGrass });

  if (allowGrass && core?.family === 'grass' && (!derived || core.dist <= derived.dist + 1e-6)) {
    return 'grass';
  }

  if (derived && (!core || derived.dist <= core.dist + 0.35)) {
    // 高饱和敌潮红 / 危险红不得被酒、肤吸走
    if ((derived.family === 'wine' || derived.family === 'skin') && core?.family === 'blood' && core.dist + 2 < derived.dist) {
      return 'blood';
    }
    // 月银高光保持银，不要收进骨灰
    if (derived.family === 'ash' && chroma < 12 && lab[0] > 82) return 'silver';
    return derived.family;
  }

  // 真正无彩度褶才进银；压饱和布料已在派生族处理
  if (chroma < 16 && !allowGrass) return 'silver';
  return core?.family ?? 'silver';
}

const tokenLab = TOKENS.map((t) => ({ ...t, lab: rgbToLab(hexToRgb(t.hex)), rgb: hexToRgb(t.hex) }));

function labDist(a, b) {
  const dL = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dL * dL * 0.7 + da * da + db * db);
}

export function nearestToken(rgb) {
  let best = null, bestDist = Infinity;
  for (const t of tokenLab) {
    const d = labDist(rgbToLab(rgb), t.lab);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return { name: best.name, rgb: best.rgb, hex: best.hex, dist: bestDist };
}

export function nearestRamp(rgb, { allowGrass = false } = {}) {
  const lab = rgbToLab(rgb);
  const family = classifyFamily(lab, allowGrass);
  let best = null, bestDist = Infinity;
  for (const step of PALETTE) {
    if (step.family !== family) continue;
    const dL = lab[0] - step.lab[0];
    const d = dL * dL + 0.15 * abDist(lab, step.lab);
    if (d < bestDist) { bestDist = d; best = step; }
  }
  if (!best) return nearestToken(rgb);
  return { name: best.name, rgb: best.rgb, hex: best.hex, family: best.family, dist: bestDist };
}

export function quantizePixels(rgba, { allowGrass = false } = {}) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) { rgba[i + 3] = 0; continue; }
    const { rgb } = nearestRamp([rgba[i], rgba[i + 1], rgba[i + 2]], { allowGrass });
    rgba[i] = rgb[0]; rgba[i + 1] = rgb[1]; rgba[i + 2] = rgb[2];
    rgba[i + 3] = 255;
  }
  return rgba;
}

export function silhouetteLstats(rgba) {
  let sum = 0, n = 0, min = 100, max = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const L = luminanceL([rgba[i], rgba[i + 1], rgba[i + 2]]);
    sum += L; n++;
    if (L < min) min = L;
    if (L > max) max = L;
  }
  return n === 0 ? null : { avg: sum / n, min, max, count: n };
}

export const TOKEN_RGB = tokenLab.map((t) => ({ name: t.name, rgb: t.rgb, hex: t.hex }));
export const RAMP_PALETTE = PALETTE;
