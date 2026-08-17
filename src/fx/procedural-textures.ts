/**
 * fx/procedural-textures.ts —— 程序生成贴图 v2（资产审计升级版）
 *
 * 版本：v2（TASK-22 资产审计 + 替换 · Phase 6 并行线 B）
 * 升级要点（保持「帧名 = 契约」：全部 frame key 与 v1 一致，实体代码零感知切换）：
 * - 玩家：圆 → 圆帽披风剪影（月银白 + 冷青 2px 烘焙描边）
 * - 敌人：3 圆 → 骷髅头 / 尖牙鼠形 / 双角精英头饰 剪影（art-bible §3 剪影区分）
 * - Boss：圆 + 双角 → 猩红金王冠披风剪影（猩红主体 + 金饰 + 瞳孔危险编码）
 * - 地形：单色石板 → 石板/草地双材质（art-bible §5：tile 64×64，明度 12–18%）
 * - 弹体/宝石/冲击波：短条/单菱/单环 → 箭头弹体 / 白描边蓝菱 / 双层扩散环
 *
 * E4-S5 draw call 治理口径不变：收敛为「两组程序图集」+ 背景 2 张：
 * - 'characters' 图集：玩家 / 3 普通敌 / Boss / 飞弹 / 环绕球（1 批）
 * - 'effects' 图集：冲击波环 / 经验宝石 / 摇杆底座 / 摇杆拇指（1 批）
 * - 'tile-ground' / 'tile-grass'：地图背景（2 批，背景合批无压力）
 * Boss 描边纪律（RV-C1）：普通敌纯剪影无描边；Boss 允许描边（猩红 4px），且仅
 * `cfg.outlineEnabled`（桌面 true）时烘焙进贴图 —— 移动端 outlineEnabled=false 不描边。
 * 烘焙描边不产生 FX pass（0 额外 draw call），与既有玩家贴图烘焙冷青描边同约定。
 * 图集 ≤2048²（实约 256²/256²），`premultipliedAlpha=false`（createCanvas 默认），保持程序图集优势。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import { TILE, PALETTE, GEM, BOSS, JOYSTICK } from '@/config/balance';
import { mulberry32 } from '@/utils/math';

type Ctx = CanvasRenderingContext2D;

const INK = '#0B0E14'; // 剪影内部镂空/瞳孔深色（= art-bible 基底色，镂空不引入新色板）
const PAPER = '#F2F5F9'; // 纸白（牙齿/高光细节）

function fillCircle(ctx: Ctx, cx: number, cy: number, r: number, color: string, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function strokeCircle(ctx: Ctx, cx: number, cy: number, r: number, color: string, width: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function fillDiamond(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * 剪影绘制（描边 = 放大层 + 主体层，两次绘制同一形状集合）：
 * - 玩家需描边（冷青 2px）→ 先画放大 1.12× 的描边色层，再画正常主体层，露出边缘成描边；
 * - 普通敌纯剪影（RV-C1）→ 单层，无描边。
 * 镂空（眼窝/牙口/瞳孔）画在形状集合内，主体层会盖住放大层对应处，仅边缘露出描边色。
 */
function drawSilhouette(
  ctx: Ctx,
  shape: (g: Ctx) => void,
  outlineColor?: string,
  outlineScale = 1.12,
): void {
  if (outlineColor) {
    ctx.save();
    ctx.scale(outlineScale, outlineScale);
    shape(ctx);
    ctx.restore();
  }
  shape(ctx);
}

/**
 * 玩家·守夜人：圆帽 + 披风剪影（art-bible §3 玩家 = 圆帽披风；§4 月银白 + 冷青 2px 常亮描边）。
 * 中心 (0,0)，范围约 x[-12,12] y[-14,13]（放大 1.12 后仍在 32×32 帧内）。
 */
function playerShape(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.player;
  // 帽冠（上半圆）
  ctx.beginPath();
  ctx.arc(0, -6, 8, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // 帽檐
  ctx.fillRect(-11, -8, 22, 3);
  // 披风：钟形 + 底部开衩（剪影感，便于 3 秒内读型）
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.lineTo(8, -5);
  ctx.lineTo(11, 13);
  ctx.lineTo(7, 13);
  ctx.lineTo(4, 6);
  ctx.lineTo(0, 13);
  ctx.lineTo(-4, 6);
  ctx.lineTo(-7, 13);
  ctx.lineTo(-11, 13);
  ctx.closePath();
  ctx.fill();
}

/** 敌人·行尸（zombie）：骷髅头剪影（art-bible §3 普通敌 = 骷髅头），暗血红纯剪影 */
function zombieShape(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.enemyZombie;
  // 颅骨（椭圆略宽）
  ctx.beginPath();
  ctx.ellipse(0, -1, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // 眼窝（深色镂空）
  fillCircle(ctx, -4.5, -4, 2.8, INK);
  fillCircle(ctx, 4.5, -4, 2.8, INK);
  // 鼻三角
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-1.6, 3);
  ctx.lineTo(1.6, 3);
  ctx.closePath();
  ctx.fill();
  // 牙口：深色横条 + 纸白牙齿（危险编码下仍可辨）
  ctx.fillStyle = INK;
  ctx.fillRect(-7, 6, 14, 4);
  ctx.fillStyle = PAPER;
  for (let i = -2; i <= 2; i += 1) ctx.fillRect(i * 2.6 - 1.2, 6.4, 2.4, 3.4);
}

/** 敌人·血犬（wolf）：尖牙鼠形剪影（art-bible §3 普通敌 = 尖牙鼠形；更小更快，横向流线奔跑感） */
function wolfShape(ctx: Ctx): void {
  // 身体（横长流线）
  ctx.fillStyle = PALETTE.enemyWolf;
  ctx.beginPath();
  ctx.ellipse(1, -1, 6.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // 头部圆 + 吻部尖出（朝右）
  ctx.beginPath();
  ctx.arc(7.5, -1.5, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8.5, -3.4);
  ctx.lineTo(11.8, -0.6);
  ctx.lineTo(8.5, 1.8);
  ctx.closePath();
  ctx.fill();
  // 双尖耳
  ctx.beginPath();
  ctx.moveTo(3, -5);
  ctx.lineTo(5.5, -8.2);
  ctx.lineTo(7.2, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6.5, -4.6);
  ctx.lineTo(9, -7.6);
  ctx.lineTo(10.5, -3.2);
  ctx.closePath();
  ctx.fill();
  // 尾（后翘）
  ctx.beginPath();
  ctx.moveTo(-6, -1.5);
  ctx.lineTo(-9.8, -5.5);
  ctx.lineTo(-5.5, 1.2);
  ctx.closePath();
  ctx.fill();
  // 吻下尖牙（纸白）
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(9.2, 0.8);
  ctx.lineTo(10.4, 3);
  ctx.lineTo(11.2, 0.6);
  ctx.closePath();
  ctx.fill();
  // 眼（深色）
  fillCircle(ctx, 8, -2.6, 1.1, INK);
}

/** 敌人·屠夫（tank）：双角精英头饰剪影（art-bible §4 精英 = 更高更宽 + 双角头饰），幽紫纯剪影 */
function tankShape(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.enemyTank;
  // 宽大体型（倒梯形，肩宽 → 底更宽）
  ctx.beginPath();
  ctx.moveTo(-14, -10);
  ctx.lineTo(14, -10);
  ctx.lineTo(18, 12);
  ctx.lineTo(-18, 12);
  ctx.closePath();
  ctx.fill();
  // 双角头饰（形状编码，色盲可辨）
  ctx.beginPath();
  ctx.moveTo(-12, -10);
  ctx.lineTo(-7, -22);
  ctx.lineTo(-2, -10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -10);
  ctx.lineTo(7, -22);
  ctx.lineTo(12, -10);
  ctx.closePath();
  ctx.fill();
  // 眼点（深色）
  fillCircle(ctx, -7, -3, 2.2, INK);
  fillCircle(ctx, 7, -3, 2.2, INK);
}

/**
 * Boss·血月尊者：猩红金剪影（art-bible §4：猩红主体 + 金饰，独有剪影）。
 * 中心 (0,0)，范围约 x[-58,58] y[-62,44]（放大 1.05 后仍在 120×120 帧内）。
 */
function bossShape(ctx: Ctx): void {
  // 披风主体（倒梯形）
  ctx.fillStyle = BOSS.COLOR_MAIN;
  ctx.beginPath();
  ctx.moveTo(-42, -22);
  ctx.lineTo(42, -22);
  ctx.lineTo(52, 44);
  ctx.lineTo(-52, 44);
  ctx.closePath();
  ctx.fill();
  // 侧翼披风（两侧三角）
  ctx.beginPath();
  ctx.moveTo(-42, -14);
  ctx.lineTo(-58, 34);
  ctx.lineTo(-30, 26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(42, -14);
  ctx.lineTo(58, 34);
  ctx.lineTo(30, 26);
  ctx.closePath();
  ctx.fill();
  // 兜帽/头（中央大圆）
  ctx.beginPath();
  ctx.arc(0, -26, 20, 0, Math.PI * 2);
  ctx.fill();
  // 瞳孔（白底 + 深瞳 = 危险编码）
  fillCircle(ctx, -20, -30, 6, PAPER);
  fillCircle(ctx, 20, -30, 6, PAPER);
  fillCircle(ctx, -20, -30, 2.5, INK);
  fillCircle(ctx, 20, -30, 2.5, INK);
  // 金饰：王冠（三尖）+ 双肩甲
  ctx.fillStyle = BOSS.COLOR_GOLD;
  ctx.beginPath();
  ctx.moveTo(-18, -42);
  ctx.lineTo(-12, -60);
  ctx.lineTo(-2, -46);
  ctx.lineTo(0, -62);
  ctx.lineTo(2, -46);
  ctx.lineTo(12, -60);
  ctx.lineTo(18, -42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-44, -18);
  ctx.lineTo(-58, -2);
  ctx.lineTo(-30, -8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(44, -18);
  ctx.lineTo(58, -2);
  ctx.lineTo(30, -8);
  ctx.closePath();
  ctx.fill();
}

/**
 * 生成全部程序贴图（幂等：已存在的 key 跳过，兼容 scene.restart）。
 * 由 PlayScene.create 调用；不再单独生成散纹理。
 */
export function createProceduralTextures(scene: Phaser.Scene, cfg: RuntimeConfig): void {
  createGroundTile(scene);
  createGrassTile(scene);
  createBlockerTile(scene);
  createCharactersAtlas(scene, cfg);
  createEffectsAtlas(scene);
}

/** 背景地砖·石板：暗紫灰 + 3×3 石缝 + 确定性石斑（art-bible §5 石板材质） */
function createGroundTile(scene: Phaser.Scene): void {
  if (scene.textures.exists('tile-ground')) return;
  const size = TILE.SIZE;
  const canvas = scene.textures.createCanvas('tile-ground', size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();

  ctx.fillStyle = PALETTE.baseLight;
  ctx.fillRect(0, 0, size, size);
  // 石缝（3×3 对称网格，平铺接缝自然）
  ctx.strokeStyle = 'rgba(11,14,20,0.55)';
  ctx.lineWidth = 1;
  const n = 3;
  for (let i = 1; i < n; i += 1) {
    ctx.beginPath();
    ctx.moveTo((size * i) / n, 0);
    ctx.lineTo((size * i) / n, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (size * i) / n);
    ctx.lineTo(size, (size * i) / n);
    ctx.stroke();
  }
  // 石斑/风化（确定性 PRNG，明度波动保持 12–18%）
  const rng = mulberry32(20260817);
  for (let i = 0; i < 40; i += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const r = 0.5 + rng() * 1.6;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(27,34,51,0.5)' : 'rgba(8,10,16,0.45)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  canvas.refresh();
}

/** 背景地砖·草地：暗绿基底 + 确定性草叶（art-bible §5 草地材质；低饱和暗绿，不与「绿=治疗」混淆） */
function createGrassTile(scene: Phaser.Scene): void {
  if (scene.textures.exists('tile-grass')) return;
  const size = TILE.SIZE;
  const canvas = scene.textures.createCanvas('tile-grass', size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();

  ctx.fillStyle = PALETTE.grassBase;
  ctx.fillRect(0, 0, size, size);
  // 草叶：短竖线，确定性分布（随机纹理，边缘截断无碍视觉）
  const rng = mulberry32(20260818);
  ctx.strokeStyle = PALETTE.grassBlade;
  ctx.lineWidth = 1;
  for (let i = 0; i < 140; i += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const len = 2 + Math.floor(rng() * 4);
    const lean = (rng() - 0.5) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean, y - len);
    ctx.stroke();
  }
  // 深草丛斑块
  ctx.fillStyle = 'rgba(10,14,12,0.35)';
  for (let i = 0; i < 8; i += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + rng() * 4, 2 + rng() * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  canvas.refresh();
}

/** 障碍地砖：灰蓝实心 + 顶缘高光 + 底缘阴影 + 风化噪点（art-bible §5 可阻挡物画实心） */
function createBlockerTile(scene: Phaser.Scene): void {
  if (scene.textures.exists('blocker')) return;
  const size = TILE.SIZE;
  const canvas = scene.textures.createCanvas('blocker', size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();

  ctx.fillStyle = PALETTE.blocker;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, size, 3); // 顶缘 1px 高光（拉伸显示后成顶边光带）
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, size - 3, size, 3); // 底缘阴影
  const rng = mulberry32(20260819);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 24; i += 1) {
    ctx.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 2, 2);
  }
  canvas.refresh();
}

/** characters 图集 v2：玩家 / 僵尸 / 疾行 / 厚血 / Boss / 飞弹 / 环绕球（1 批） */
function createCharactersAtlas(scene: Phaser.Scene, cfg: RuntimeConfig): void {
  if (scene.textures.exists('characters')) return;
  const W = 256;
  const H = 256;
  const canvas = scene.textures.createCanvas('characters', W, H);
  if (!canvas) return;
  const ctx = canvas.getContext();

  // 玩家：圆帽披风，冷青 2px 烘焙描边（art-bible §4，帧 32×32 @ (0,0)）
  ctx.save();
  ctx.translate(16, 16);
  drawSilhouette(ctx, playerShape, PALETTE.playerAccent, 1.12);
  ctx.restore();

  // 普通 3 敌：纯剪影无描边（RV-C1 / art-bible §4 普通敌靠剪影）
  ctx.save();
  ctx.translate(40 + 14, 14); // 帧 28×28 @ (40,0)
  zombieShape(ctx);
  ctx.restore();
  ctx.save();
  ctx.translate(72 + 12, 12); // 帧 24×24 @ (72,0)
  wolfShape(ctx);
  ctx.restore();
  ctx.save();
  ctx.translate(100 + 24, 24); // 帧 48×48 @ (100,0)
  tankShape(ctx);
  ctx.restore();

  // Boss：猩红金剪影 @ (0,56)，120×120；桌面烘焙猩红 4px 描边（outlineEnabled=true）
  ctx.save();
  ctx.translate(60, 56 + 60);
  drawSilhouette(ctx, bossShape, cfg.outlineEnabled ? BOSS.COLOR_MAIN : undefined, 1.05);
  ctx.restore();

  // 飞弹：月银白箭头弹体 + 冷青尾焰（帧 16×12 @ (156,0)，朝向 0rad 右）
  ctx.save();
  ctx.translate(156 + 8, 6);
  ctx.fillStyle = PALETTE.playerAccent;
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.missile;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-2, -3.5);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-2, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 环绕球：冷青圆 + 描边 + 高光（帧 20×20 @ (176,0)）
  ctx.save();
  ctx.translate(176 + 10, 10);
  fillCircle(ctx, 0, 0, 9, PALETTE.orb);
  strokeCircle(ctx, 0, 0, 9, PALETTE.orb, 1, 0.9);
  fillCircle(ctx, -3, -3, 2.5, PAPER, 0.7);
  ctx.restore();

  canvas.refresh();

  // 注册帧（frame 名与既有 texture key 一一对应，实体代码零感知切换）
  const tex = scene.textures.get('characters');
  tex.add('player', 0, 0, 0, 32, 32);
  tex.add('enemy-zombie', 0, 40, 0, 28, 28);
  tex.add('enemy-wolf', 0, 72, 0, 24, 24);
  tex.add('enemy-tank', 0, 100, 0, 48, 48);
  tex.add('enemy-boss', 0, 0, 56, BOSS.TEXTURE_SIZE, BOSS.TEXTURE_SIZE);
  tex.add('missile', 0, 156, 0, 16, 12);
  tex.add('orb', 0, 176, 0, 20, 20);
}

/** effects 图集：冲击波环 / 经验宝石 / 摇杆底座 / 摇杆拇指（1 批） */
function createEffectsAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists('effects')) return;
  const W = 256;
  const H = 128;
  const canvas = scene.textures.createCanvas('effects', W, H);
  if (!canvas) return;
  const ctx = canvas.getContext();

  // 冲击波扩散环：血橙红双层环（帧 32×32，shockwave.ts 读取帧宽作 baseSize，尺寸不可变）
  strokeCircle(ctx, 16, 16, 14, PALETTE.shockwave, 3, 0.9);
  strokeCircle(ctx, 16, 16, 10, PALETTE.shockwave, 2, 0.45);
  fillCircle(ctx, 16, 16, 3, PALETTE.shockwave, 0.5);

  // 经验宝石：蓝菱 + 纸白 1px 描边（art-bible §5 拾取物统一白描边）
  fillDiamond(ctx, 40 + 6, 6, 5.5, GEM.COLOR);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(46, 0.5);
  ctx.lineTo(51.5, 6);
  ctx.lineTo(46, 11.5);
  ctx.lineTo(40.5, 6);
  ctx.closePath();
  ctx.stroke();

  // 摇杆底座（常驻 96px 视觉）：冷青 3px 圆环 + 低透明填充
  strokeCircle(ctx, 60 + 48, 48, JOYSTICK.RADIUS - 2, PALETTE.playerAccent, 3, 0.55);
  fillCircle(ctx, 60 + 48, 48, JOYSTICK.RADIUS - 2, PALETTE.playerAccent, 0.08);

  // 摇杆拇指：冷青实心圆 44px
  fillCircle(ctx, 164 + 22, 22, 22, PALETTE.playerAccent, 0.9);

  canvas.refresh();

  const tex = scene.textures.get('effects');
  tex.add('shockwave', 0, 0, 0, 32, 32);
  tex.add('gem', 0, 40, 0, GEM.BODY_SIZE, GEM.BODY_SIZE);
  tex.add('joystick-base', 0, 60, 0, JOYSTICK.RADIUS * 2, JOYSTICK.RADIUS * 2);
  tex.add('joystick-thumb', 0, 164, 0, 44, 44);
}
