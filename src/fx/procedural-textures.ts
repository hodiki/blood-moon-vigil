/**
 * fx/procedural-textures.ts —— 程序生成贴图 v3（资产审计升级 + TASK-28 美术表现力专项）
 *
 * 版本：v3（TASK-22 剪影 v2 基础上的画面表现力升级 · Phase 6 穿插）
 * 保持「帧名 = 契约」：全部 v1/v2 帧 key 不变，实体代码零感知切换；v3 只做「加法」：
 * - 角色动画：5 实体（玩家/3 敌/Boss）各 +1 变体帧（`*-v`，pose=1），idle 慢速 / 移动快速两帧循环共用；
 *   characters 图集 256×256 → 512×256（变体帧放入同一图集 → 动画换帧不产生额外贴图批次）。
 * - 环境氛围：新增 'fx-ambient' 图集（512×256，LINEAR 过滤保证渐晕/光晕平滑）：
 *   血月天幕 moon + 粒子形状（白底可 tint：circle/square/streak/diamond/ring）+ 暗角渐晕 vignette。
 *   全部收敛为 1 个图集 = 1 组批次（设计口径计入 ambient 组）。
 * - 宝石光晕：effects 图集 gem 帧 12×12 → 20×20（烘焙多层冷青光晕，0 额外 draw call；GEM.BODY_SIZE 逻辑值不变）。
 * - 地面贴花：effects 图集新增 decal-rock / decal-grass / decal-blood 三帧（16×16），
 *   随 effects 组批次（不新增贴图），由 MapSystem 确定性散布。
 *
 * E4-S5 draw call 治理口径（TASK-28 更新）：
 * - 'characters' 图集：玩家 / 3 普通敌 / Boss / 飞弹 / 环绕球 / 动画变体帧（1 批）
 * - 'effects' 图集：冲击波环 / 经验宝石 / 摇杆底座 / 摇杆拇指 / 贴花 ×3（1 批）
 * - 'tile-ground' / 'tile-grass' / 'blocker'：地图背景（设计口径并入 background 1）
 * - 'fx-ambient'：血月 + 粒子 + 渐晕（1 批；设计口径 ambient 1，粒子计 extra pass 1）
 * 设计口径合计 ≤ 8（背景 1 + characters 1 + effects 1 + ambient 1 + 粒子 1 = 5），硬预算保持。
 * Boss 描边纪律（RV-C1）不变：普通敌纯剪影无描边；Boss 允许描边（猩红 4px），且仅
 * `cfg.outlineEnabled`（桌面 true）时烘焙进贴图 —— 移动端 outlineEnabled=false 不描边。
 * 图集 ≤2048²（实约 512²/256²），`premultipliedAlpha=false`（createCanvas 默认），保持程序图集优势。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import { TILE, PALETTE, GEM, BOSS, JOYSTICK } from '@/config/balance';
import { mulberry32, hexToRgba } from '@/utils/math';

type Ctx = CanvasRenderingContext2D;

const INK = '#0B0E14'; // 剪影内部镂空/瞳孔深色（= art-bible 基底色，镂空不引入新色板）
const PAPER = '#F2F5F9'; // 纸白（牙齿/高光细节）
const WHITE = '#FFFFFF'; // 粒子形状基色（运行时 tint 染色，白色 × tint = 任意色）

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
 * pose=0 基准；pose=1 变体：帽冠上移 1px + 披风外扩下摆（呼吸/移动摆动帧）。
 * TASK-36 P0-1b/P0-1c：帽带（帽檐下缘冷青横条）+ 三边开衩制式长袍（x=-8/0/+8，帧内等比）。
 * 中心 (0,0)，范围约 x[-12,12] y[-14,13]（放大 1.12 后仍在 32×32 帧内）。
 */
function playerShape(ctx: Ctx, pose = 0): void {
  ctx.fillStyle = PALETTE.player;
  // 帽冠（上半圆；变体上移 1px = 呼吸上浮）
  ctx.beginPath();
  ctx.arc(0, pose === 1 ? -7 : -6, 8, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // 帽檐
  ctx.fillRect(-11, -8, 22, 3);
  // TASK-36 P0-1b 帽带：帽檐下缘 1px 冷青横条（制式夜巡帽；x±10 → ×1.12=11.2 ≤16 ✔）
  ctx.fillStyle = hexToRgba(PALETTE.playerAccent, 0.75);
  ctx.fillRect(-10, -5, 20, 1);
  ctx.fillStyle = PALETTE.player;
  // TASK-36 P0-1c 披风：制式长袍梯形 + 三边开衩（INK 镂空；变体外扩 + 下摆下移 = 摆动/奔跑）
  if (pose === 1) {
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(9, -6);
    ctx.lineTo(14, 14);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    // 三边开衩（INK 镂空，宽 1.5，从下摆上切；最外点 x=±14 → ×1.12=15.68 ≤16 ✔）
    ctx.fillStyle = INK;
    ctx.fillRect(-8.75, 5, 1.5, 9);
    ctx.fillRect(-0.75, 5, 1.5, 9);
    ctx.fillRect(7.25, 5, 1.5, 9);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-9, -5);
  ctx.lineTo(9, -5);
  ctx.lineTo(12, 13);
  ctx.lineTo(-12, 13);
  ctx.closePath();
  ctx.fill();
  // 三边开衩（INK 镂空，宽 1.5，从下摆上切；最外点 x=±12 → ×1.12=13.44 ≤16 ✔）
  ctx.fillStyle = INK;
  ctx.fillRect(-8.75, 6, 1.5, 7);
  ctx.fillRect(-0.75, 6, 1.5, 7);
  ctx.fillRect(7.25, 6, 1.5, 7);
}

/**
 * TASK-36 P0-1a 守夜人冷青提灯：身份光源（描边后正常比例绘制，同帧 32×32 内）。
 * 灯杆/灯体/灯芯光 + 柔光外圈；最右点 x=14.8 ≤16 ✔，y∈[-6,2] ✔。
 */
function drawPlayerLantern(ctx: Ctx): void {
  // 灯杆：从披风右肩伸出的细杆
  ctx.fillStyle = hexToRgba(PALETTE.uiPaper, 0.55);
  ctx.fillRect(8, -6, 1.5, 5);
  // 灯体：3×4px 方形灯（冷青）
  ctx.fillStyle = hexToRgba(PALETTE.playerAccent, 0.95);
  ctx.fillRect(10.5, -1.5, 3, 4);
  // 灯芯光 + 柔光外圈
  fillCircle(ctx, 12, 0, 1.5, PALETTE.playerAccent, 0.8);
  fillCircle(ctx, 12, 0, 2.8, PALETTE.playerAccent, 0.22);
}

/** 敌人·行尸（zombie）：骷髅头剪影（art-bible §3 普通敌 = 骷髅头），暗血红纯剪影。
 *  pose=1 变体：颅骨收窄 + 下颚张开（饥饿啃咬帧）。 */
function zombieShape(ctx: Ctx, pose = 0): void {
  ctx.fillStyle = PALETTE.enemyZombie;
  // 颅骨（椭圆略宽；变体收窄）
  ctx.beginPath();
  ctx.ellipse(0, -1, pose === 1 ? 9.2 : 10, 12, 0, 0, Math.PI * 2);
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
  // 牙口：深色横条 + 纸白牙齿（变体下颚张开 = 牙口加深、牙齿下移）
  ctx.fillStyle = INK;
  ctx.fillRect(-7, pose === 1 ? 6 : 6, 14, pose === 1 ? 5 : 4);
  ctx.fillStyle = PAPER;
  for (let i = -2; i <= 2; i += 1) ctx.fillRect(i * 2.6 - 1.2, pose === 1 ? 7 : 6.4, 2.4, pose === 1 ? 3.8 : 3.4);
  // TASK-36 P0-2a 颅骨裂纹（额心致死伤；x≤2.5、y≥-13 颅顶内 ✔）
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(0, -12);
  ctx.moveTo(0, -10);
  ctx.lineTo(2.5, -11.5);
  ctx.stroke();
  // TASK-36 P0-2b 眼眶眉骨高光（纸白上半弧；x=±7.9、y=-8.4 ≤14/-13 ✔）
  ctx.strokeStyle = hexToRgba(PAPER, 0.5);
  ctx.beginPath();
  ctx.arc(-4.5, -5, 3.4, Math.PI, 0, true);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(4.5, -5, 3.4, Math.PI, 0, true);
  ctx.stroke();
}

/** 敌人·血犬（wolf）：尖牙鼠形剪影（art-bible §3 普通敌 = 尖牙鼠形；更小更快，横向流线奔跑感）。
 *  pose=1 变体：躯干拉长 + 四足收拢（奔跑帧）。 */
function wolfShape(ctx: Ctx, pose = 0): void {
  // 身体（横长流线；变体拉长）
  ctx.fillStyle = PALETTE.enemyWolf;
  ctx.beginPath();
  ctx.ellipse(pose === 1 ? 2 : 1, -1, pose === 1 ? 7.5 : 6.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // TASK-36 P0-3a 背脊棘刺（腐化骨刺，纯剪影同色；x∈[-4,2.5]、y≥-7.5 不碰耳尖 -8.2 ✔）
  ctx.beginPath();
  ctx.moveTo(-4, -4.5);
  ctx.lineTo(-3, -7.5);
  ctx.lineTo(-1.5, -4.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -4.5);
  ctx.lineTo(1, -6.5);
  ctx.lineTo(2.5, -4.5);
  ctx.closePath();
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
  // 四足（变体奔跑帧：前后腿收拢成奔跑剪影）
  if (pose === 1) {
    ctx.fillRect(-5, 2.4, 2, 3);
    ctx.fillRect(1, 2.6, 2, 2.8);
    ctx.fillRect(4.5, 2.2, 2, 3);
  }
  // 吻下尖牙（纸白）
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(9.2, 0.8);
  ctx.lineTo(10.4, 3);
  ctx.lineTo(11.2, 0.6);
  ctx.closePath();
  ctx.fill();
  // TASK-36 P0-3b 血口涎滴（危险红；x≈11.5 ≤12 ✔；若快照「红=危险」歧义可换 uiPaper 白涎）
  fillCircle(ctx, 10.6, 3.2, 0.9, PALETTE.danger, 0.9);
  // 眼（深色）
  fillCircle(ctx, 8, -2.6, 1.1, INK);
}

/** 敌人·屠夫（tank）：双角精英头饰剪影（art-bible §4 精英 = 更高更宽 + 双角头饰），幽紫纯剪影。
 *  pose=1 变体：肩部外扩 + 双角外倾（蓄力帧）。 */
function tankShape(ctx: Ctx, pose = 0): void {
  ctx.fillStyle = PALETTE.enemyTank;
  // 宽大体型（倒梯形，肩宽 → 底更宽；变体肩更宽）
  ctx.beginPath();
  ctx.moveTo(pose === 1 ? -15 : -14, -10);
  ctx.lineTo(pose === 1 ? 15 : 14, -10);
  ctx.lineTo(pose === 1 ? 19 : 18, 12);
  ctx.lineTo(pose === 1 ? -19 : -18, 12);
  ctx.closePath();
  ctx.fill();
  // TASK-36 P0-4a 屠刀（右手侧；刀柄 INK + 刀身主体 + 纸白刃光；最右 x=22.5 ≤24 ✔）
  ctx.fillStyle = hexToRgba(INK, 0.85);
  ctx.fillRect(14, -2, 3, 8); // 刀柄
  ctx.fillStyle = PALETTE.enemyTank;
  ctx.beginPath();
  ctx.moveTo(17, -5);
  ctx.lineTo(22, -3);
  ctx.lineTo(21, 10);
  ctx.lineTo(17, 9);
  ctx.closePath();
  ctx.fill(); // 刀身
  ctx.fillStyle = hexToRgba(PALETTE.uiPaper, 0.55);
  ctx.fillRect(21.5, -3.5, 1, 13); // 刀背刃光（x 21.5..22.5）
  // TASK-36 P0-4b 围裙带（躯干 y=3..4.5 处 1.5px 深色横带；pose1 肩更宽 x∈[-17,17] ≤24 ✔）
  ctx.fillStyle = hexToRgba(INK, 0.7);
  ctx.fillRect(pose === 1 ? -17 : -15, 3, pose === 1 ? 34 : 30, 1.5);
  // 双角头饰（形状编码，色盲可辨；变体外倾）
  ctx.beginPath();
  ctx.moveTo(-12, -10);
  ctx.lineTo(pose === 1 ? -9 : -7, pose === 1 ? -24 : -22);
  ctx.lineTo(-2, -10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -10);
  ctx.lineTo(pose === 1 ? 9 : 7, pose === 1 ? -24 : -22);
  ctx.lineTo(12, -10);
  ctx.closePath();
  ctx.fill();
  // 眼点（深色）
  fillCircle(ctx, -7, -3, 2.2, INK);
  fillCircle(ctx, 7, -3, 2.2, INK);
}

/**
 * Boss·血月尊者：猩红金剪影（art-bible §4：猩红主体 + 金饰，独有剪影）。
 * pose=1 变体：披风外扩 + 侧翼张开（披风摆动帧）。
 * 中心 (0,0)，范围约 x[-56,56] y[-60,44]（C-1：侧翼/披风收至 56，放大 1.05 后最外点 ≈58.8，
 * 即 60+58.8=118.8 < 120px 帧界 ✔）。
 */
function bossShape(ctx: Ctx, pose = 0): void {
  // 披风主体（倒梯形；变体外扩）
  const w = pose === 1 ? 48 : 42;
  const f = pose === 1 ? 56 : 52;
  ctx.fillStyle = BOSS.COLOR_MAIN;
  ctx.beginPath();
  ctx.moveTo(-w, -22);
  ctx.lineTo(w, -22);
  ctx.lineTo(f, 44);
  ctx.lineTo(-f, 44);
  ctx.closePath();
  ctx.fill();
  // TASK-36 P0-5b 仪式权杖（画序：披风后、侧翼前——翼盖杖杆下部 2px 形成"持杖"错觉；
  // 最右 x=53 → ×1.05=55.65 → 60+55.65=115.65 ≤120 ✔；底 y=30 → 91.5 ≤120 ✔）
  ctx.fillStyle = BOSS.COLOR_MAIN;
  ctx.fillRect(47, -28, 2, 58); // 杖杆 y -28..30
  fillCircle(ctx, 48, -32, 4, PALETTE.danger); // 杖首红宝石
  ctx.strokeStyle = BOSS.COLOR_GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(48, -32, 5, 0, Math.PI * 2);
  ctx.stroke(); // gold 外圈
  // 侧翼披风（两侧三角；变体更张开）
  ctx.beginPath();
  ctx.moveTo(-w, -14);
  ctx.lineTo(pose === 1 ? -56 : -52, 34);
  ctx.lineTo(pose === 1 ? -36 : -30, 26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, -14);
  ctx.lineTo(pose === 1 ? 56 : 52, 34);
  ctx.lineTo(pose === 1 ? 36 : 30, 26);
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
  ctx.lineTo(0, -54);
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
  // TASK-36 P0-5a 冠上血月宝石（王冠中尖 V 底点；危险红 + 纸白高光；
  // 最上 y=-54-2=-56 → 放大 1.05 后绝对 1.2 ≥0 ✔，勿加 gold 外环 r3.5）
  fillCircle(ctx, 0, -54, 2.0, PALETTE.danger);
  fillCircle(ctx, -0.8, -54.8, 0.6, PALETTE.uiPaper, 0.85);
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
  createAmbientAtlas(scene);
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

/** characters 图集 v3：玩家 / 僵尸 / 疾行 / 厚血 / Boss / 飞弹 / 环绕球 + 5 变体帧（1 批，512×256） */
function createCharactersAtlas(scene: Phaser.Scene, cfg: RuntimeConfig): void {
  if (scene.textures.exists('characters')) return;
  const W = 512;
  const H = 256;
  const canvas = scene.textures.createCanvas('characters', W, H);
  if (!canvas) return;
  const ctx = canvas.getContext();

  // 玩家：圆帽披风，冷青 2px 烘焙描边（art-bible §4，帧 32×32 @ (0,0)）
  ctx.save();
  ctx.translate(16, 16);
  drawSilhouette(ctx, (g) => playerShape(g, 0), PALETTE.playerAccent, 1.12);
  drawPlayerLantern(ctx); // TASK-36 P0-1a 冷青提灯（描边后正常比例，避免放大层残色）
  ctx.restore();

  // 普通 3 敌：纯剪影无描边（RV-C1 / art-bible §4 普通敌靠剪影）
  ctx.save();
  ctx.translate(40 + 14, 14); // 帧 28×28 @ (40,0)
  zombieShape(ctx, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(72 + 12, 12); // 帧 24×24 @ (72,0)
  wolfShape(ctx, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(100 + 24, 24); // 帧 48×48 @ (100,0)
  tankShape(ctx, 0);
  ctx.restore();

  // Boss：猩红金剪影 @ (0,56)，120×120；桌面烘焙猩红 4px 描边（outlineEnabled=true）
  ctx.save();
  ctx.translate(60, 56 + 60);
  drawSilhouette(ctx, (g) => bossShape(g, 0), cfg.outlineEnabled ? BOSS.COLOR_MAIN : undefined, 1.05);
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

  // —— TASK-28 动画变体帧（pose=1，与基准帧同图集 → 换帧不产生新批次）——
  // 玩家变体 @ (120,56) 32×32
  ctx.save();
  ctx.translate(120 + 16, 56 + 16);
  drawSilhouette(ctx, (g) => playerShape(g, 1), PALETTE.playerAccent, 1.12);
  drawPlayerLantern(ctx); // TASK-36 P0-1a 冷青提灯（同帧变体）
  ctx.restore();
  // 僵尸变体 @ (120,88) 28×28
  ctx.save();
  ctx.translate(120 + 14, 88 + 14);
  zombieShape(ctx, 1);
  ctx.restore();
  // 疾行变体 @ (120,116) 24×24
  ctx.save();
  ctx.translate(120 + 12, 116 + 12);
  wolfShape(ctx, 1);
  ctx.restore();
  // 厚血变体 @ (120,188) 48×48
  ctx.save();
  ctx.translate(120 + 24, 188 + 24);
  tankShape(ctx, 1);
  ctx.restore();
  // Boss 变体 @ (160,56) 120×120（与玩家/僵尸/疾行变体无重叠，见注释布局）
  ctx.save();
  ctx.translate(160 + 60, 56 + 60);
  drawSilhouette(ctx, (g) => bossShape(g, 1), cfg.outlineEnabled ? BOSS.COLOR_MAIN : undefined, 1.05);
  ctx.restore();

  canvas.refresh();

  // 注册帧（frame 名与既有 texture key 一一对应，实体代码零感知切换；新增 `*-v` 变体帧）
  const tex = scene.textures.get('characters');
  tex.add('player', 0, 0, 0, 32, 32);
  tex.add('enemy-zombie', 0, 40, 0, 28, 28);
  tex.add('enemy-wolf', 0, 72, 0, 24, 24);
  tex.add('enemy-tank', 0, 100, 0, 48, 48);
  tex.add('enemy-boss', 0, 0, 56, BOSS.TEXTURE_SIZE, BOSS.TEXTURE_SIZE);
  tex.add('missile', 0, 156, 0, 16, 12);
  tex.add('orb', 0, 176, 0, 20, 20);
  tex.add('player-v', 0, 120, 56, 32, 32);
  tex.add('enemy-zombie-v', 0, 120, 88, 28, 28);
  tex.add('enemy-wolf-v', 0, 120, 116, 24, 24);
  tex.add('enemy-tank-v', 0, 120, 188, 48, 48);
  tex.add('enemy-boss-v', 0, 160, 56, BOSS.TEXTURE_SIZE, BOSS.TEXTURE_SIZE);
}

/** effects 图集 v3：冲击波环 / 经验宝石（烘焙光晕）/ 摇杆 / 贴花 ×3（1 批） */
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

  // 经验宝石：蓝菱 + 纸白 1px 描边 + 烘焙多层冷青光晕（TASK-28 v3：帧 20×20，0 额外 draw call；
  // GEM.BODY_SIZE=12 为逻辑体尺寸不变，帧扩大仅为光晕留空间）
  const gx = 40 + 10;
  const gy = 10;
  for (let i = 5; i >= 1; i -= 1) {
    fillCircle(ctx, gx, gy, 8 + i * 1.6, GEM.COLOR, 0.07);
  }
  fillDiamond(ctx, gx, gy, 5.5, GEM.COLOR);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx, gy - 5.5);
  ctx.lineTo(gx + 5.5, gy);
  ctx.lineTo(gx, gy + 5.5);
  ctx.lineTo(gx - 5.5, gy);
  ctx.closePath();
  ctx.stroke();

  // 摇杆底座（常驻 96px 视觉）：冷青 3px 圆环 + 低透明填充
  strokeCircle(ctx, 60 + 48, 48, JOYSTICK.RADIUS - 2, PALETTE.playerAccent, 3, 0.55);
  fillCircle(ctx, 60 + 48, 48, JOYSTICK.RADIUS - 2, PALETTE.playerAccent, 0.08);

  // 摇杆拇指：冷青实心圆 44px
  fillCircle(ctx, 164 + 22, 22, 22, PALETTE.playerAccent, 0.9);

  // —— TASK-28 地面贴花帧（16×16 @ y=96，随 effects 组批次）——
  // 碎石：灰蓝小石块 + 高光点
  ctx.fillStyle = hexToRgba(PALETTE.blocker, 0.85);
  ctx.beginPath();
  ctx.ellipse(5, 10, 3.4, 2.6, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11, 9, 2.4, 1.8, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba(WHITE, 0.18);
  ctx.fillRect(4, 8.4, 2, 1);
  // 草叶簇：三根暗绿短叶
  ctx.strokeStyle = PALETTE.grassBlade;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7, 14); ctx.lineTo(5, 8);
  ctx.moveTo(8, 14); ctx.lineTo(9, 7);
  ctx.moveTo(10, 14); ctx.lineTo(12, 9);
  ctx.stroke();
  // 血迹：暗红不规则斑（低透明）
  ctx.fillStyle = hexToRgba(PALETTE.enemyZombie, 0.5);
  ctx.beginPath();
  ctx.ellipse(8, 8, 5.5, 4, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, 11, 3, 1.6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  canvas.refresh();

  const tex = scene.textures.get('effects');
  tex.add('shockwave', 0, 0, 0, 32, 32);
  tex.add('gem', 0, 40, 0, 20, 20); // v3：12×12 → 20×20（光晕留白）
  tex.add('joystick-base', 0, 60, 0, JOYSTICK.RADIUS * 2, JOYSTICK.RADIUS * 2);
  tex.add('joystick-thumb', 0, 164, 0, 44, 44);
  tex.add('decal-rock', 0, 0, 96, 16, 16);
  tex.add('decal-grass', 0, 16, 96, 16, 16);
  tex.add('decal-blood', 0, 32, 96, 16, 16);
}

/**
 * 环境氛围图集 v3（TASK-28）：血月天幕 / 粒子形状 / 暗角渐晕 —— 收敛为 1 个图集 = 1 组批次。
 * 512×256 布局：
 * - moon 128×128 @ (0,0)：暗红血月盘 + 冷青光晕
 * - 粒子形状 @ (128,0)：p-circle 8 / p-square 8 / p-streak 12×4 / p-diamond 8 / p-ring 48（白底，运行时 tint）
 * - vignette 256×256 @ (256,0)：径向暗角渐变（透明中心 → 基底色 55% 边缘）
 * 整图集 LINEAR 过滤（渐晕/光晕放大平滑；粒子轻微柔化无碍剪影风格）。
 */
function createAmbientAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists('fx-ambient')) return;
  const W = 512;
  const H = 256;
  const canvas = scene.textures.createCanvas('fx-ambient', W, H);
  if (!canvas) return;
  const ctx = canvas.getContext();

  drawBloodMoon(ctx, 64, 64);
  drawParticleShapes(ctx, 128, 0);
  drawVignette(ctx, 256, 0);

  canvas.refresh();
  scene.textures.get('fx-ambient').setFilter(Phaser.Textures.FilterMode.LINEAR);

  const tex = scene.textures.get('fx-ambient');
  tex.add('moon', 0, 0, 0, 128, 128);
  tex.add('p-circle', 0, 128, 0, 8, 8);
  tex.add('p-square', 0, 136, 0, 8, 8);
  tex.add('p-streak', 0, 144, 0, 12, 4);
  tex.add('p-diamond', 0, 156, 0, 8, 8);
  tex.add('p-ring', 0, 164, 0, 48, 48);
  tex.add('vignette', 0, 256, 0, 256, 256);
}

/** 血月天幕：冷青光晕 + 暗红月盘 + 环形高光 + 陨坑（色值全部取 PALETTE/BOSS token） */
function drawBloodMoon(ctx: Ctx, cx: number, cy: number): void {
  // 冷青光晕（多层径向渐变，柔和扩散）
  for (let i = 4; i >= 1; i -= 1) {
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 14 + i * 12);
    g.addColorStop(0, hexToRgba(PALETTE.playerAccent, 0.1));
    g.addColorStop(1, hexToRgba(PALETTE.playerAccent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - 62, cy - 62, 124, 124);
  }
  // 月盘：暗红基底（enemyZombie 暗血红 = art-bible「暗红血月」）
  fillCircle(ctx, cx, cy, 26, PALETTE.enemyZombie);
  // 盘面血色高光（危险红渐变，右上偏亮）
  const face = ctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 26);
  face.addColorStop(0, hexToRgba(PALETTE.danger, 0.75));
  face.addColorStop(0.6, hexToRgba(PALETTE.danger, 0.25));
  face.addColorStop(1, hexToRgba(PALETTE.danger, 0));
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();
  // 环形血月边缘（危险红）
  strokeCircle(ctx, cx, cy, 25, PALETTE.danger, 2, 0.45);
  // 陨坑（基底色镂空）
  const rng = mulberry32(20260829);
  for (let i = 0; i < 6; i += 1) {
    const a = rng() * Math.PI * 2;
    const r = 6 + rng() * 15;
    fillCircle(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.6 + rng() * 1.8, PALETTE.base, 0.5);
  }
}

/** 粒子形状（白底，运行时 setTint 染色；p-ring 为轨道残影环，运行时 tint 冷青） */
function drawParticleShapes(ctx: Ctx, ox: number, oy: number): void {
  fillCircle(ctx, ox + 4, oy + 4, 4, WHITE); // p-circle
  ctx.fillStyle = WHITE; // p-square
  ctx.fillRect(ox + 8, oy, 8, 8);
  ctx.fillStyle = WHITE; // p-streak（横长，运动方向用 setAngle 对齐）
  ctx.fillRect(ox + 16, oy, 12, 4);
  fillDiamond(ctx, ox + 20, oy + 4, 4, WHITE); // p-diamond
  strokeCircle(ctx, ox + 60, oy + 24, 22, WHITE, 3, 1); // p-ring（48×48：环心=帧中心 ox+60=188，r=22 → x:166~210 在帧 164~212 内，完整圆环；TASK-34 修复半圆）
}

/** 暗角渐晕：径向渐变（透明中心 → 基底色 55% 边缘，art-bible §5「压暗 20%」） */
function drawVignette(ctx: Ctx, ox: number, oy: number): void {
  const size = 256;
  const g = ctx.createRadialGradient(ox + size / 2, oy + size / 2, size * 0.22, ox + size / 2, oy + size / 2, size * 0.72);
  g.addColorStop(0, hexToRgba(PALETTE.base, 0));
  g.addColorStop(0.65, hexToRgba(PALETTE.base, 0.22));
  g.addColorStop(1, hexToRgba(PALETTE.base, 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, size, size);
}
