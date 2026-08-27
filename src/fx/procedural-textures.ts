/**
 * fx/procedural-textures.ts —— 程序生成贴图 v3.5（资产审计升级 + TASK-28 美术表现力 + TASK-41 剪影强化）
 *
 * 版本：v3.5（TASK-41 · silhouette-v35-spec · R1 波次3 玩家剪影辨识度强化）
 * 保持「帧名 = 契约」：全部 v1/v2/v3 帧 key 不变，实体代码零感知切换；v3.5 只做「加法/替换」：
 * - 玩家（playerShape）：帽冠圆顶 → 锥形尖顶（两 pose 顶统一 -14，顺带修 v3 pose1 顶 -15 的 0.8px 描边裁切）、
 *   帽檐 22→26px（x±13 = 全身最宽）、披风开衩 1.5×7→2×9、pose0 下摆 ±12→±13.5。
 * - 玩家提灯（drawPlayerLantern）：灯体 3×4→4×5、光晕 r2.8/α0.22 → 内圈 r4/α0.30 + 外圈 r5.2/α0.10（双层）。
 * - 屠夫（tankShape）：屠刀刀身右缘 +1px（最右 x=23）、刃光 α0.55→0.75。
 * 描边纪律：玩家仍 1.12 冷青（方案论证不加粗：1.16 会迫使 pose1 ±14 越界）；移动端 LOD 由渲染缩放天然达成
 * （相机 zoom=1 双端 32px 实渲染；若未来 ≤16px，最近邻 2:1 下采样自然丢弃帽带/开衩/光晕外圈亚像素细节，
 * 16px 下仍保留尖顶/宽檐/提灯核心 —— 收敛位 createCharactersAtlas 的 cfg.isMobile 钩子，见 silhouette-v35-spec §6）。
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
import { TILE, PALETTE, GEM, BOSS, JOYSTICK, HEAL } from '@/config/balance';
import { mulberry32, hexToRgba } from '@/utils/math';
import { applyExternalCharacterFrames, applyExternalEffectsFrames } from '@/fx/external-atlas';

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
 * TASK-42：shape 回调收 `bodyColor?` —— 放大层显式传 `outlineColor`，主体层用 shape 默认
 * （玩家=月银白 / Boss=COLOR_MAIN）。此前 shape 内部写死 fillStyle 覆盖了 outlineColor，
 * 导致玩家冷青描边从未可见（v3 起 pre-existing）。
 */
function drawSilhouette(
  ctx: Ctx,
  shape: (g: Ctx, bodyColor?: string) => void,
  outlineColor?: string,
  outlineScale = 1.12,
): void {
  if (outlineColor) {
    ctx.save();
    ctx.scale(outlineScale, outlineScale);
    shape(ctx, outlineColor); // TASK-42：放大层用 outlineColor（玩家=冷青 accent）
    ctx.restore();
  }
  shape(ctx); // 主体层：shape 默认 bodyColor（玩家=月银白）
}

/**
 * 玩家·守夜人：锥顶宽檐帽 + 披风剪影（art-bible §3 玩家 = 锥顶宽檐帽 + 披风 + 冷青提灯（TASK-41 v3.5）；
 * §4 月银白 + 冷青 2px 常亮描边）。
 * pose=0 基准；pose=1 变体：披风外扩下摆 + 开衩加深（呼吸/移动摆动帧）；帽冠两 pose 同顶，摆动只体现在披风。
 * TASK-41 v3.5（silhouette-v35-spec §2）：帽冠圆顶→锥形尖顶（两 pose 顶统一 -14，修复 v3 pose1 顶 -15 的
 * 0.8px 描边裁切）、帽檐 22→26px（x±13 = 全身最宽）、披风开衩 1.5×7→2×9、pose0 下摆 ±12→±13.5。
 * 中心 (0,0)，范围约 x[-13.5,13.5] y[-14,14]（放大 1.12 后最外 ±15.68 ≤16 帧半，C-1 边界见 silhouette-v35-spec §5）。
 */
function playerShape(ctx: Ctx, pose = 0, bodyColor?: string): void {
  ctx.fillStyle = bodyColor ?? PALETTE.player;
  // TASK-41 P0-1 帽冠：锥形尖顶（两 pose 同顶；肩 y=-6 与帽檐相接；顶 -14 → ×1.12=-15.68 ≤16 ✔ margin 0.32）
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.lineTo(-6, -12.5);
  ctx.lineTo(0, -14);
  ctx.lineTo(6, -12.5);
  ctx.lineTo(8, -6);
  ctx.closePath();
  ctx.fill();
  // TASK-41 P0-2 帽檐（加宽 22→26px：x±13 → ×1.12=±14.56 ≤16 ✔ margin 1.44；26/32=81% 帧宽 = 全身最宽）
  ctx.fillRect(-13, -8, 26, 3);
  // TASK-36 P0-1b 帽带：帽檐下缘 1px 冷青横条（x±10 → ×1.12=11.2 ≤16 ✔；v3.5 决策记录 P1-6 保持原样）
  ctx.fillStyle = hexToRgba(PALETTE.playerAccent, 0.75);
  ctx.fillRect(-10, -5, 20, 1);
  ctx.fillStyle = bodyColor ?? PALETTE.player;
  // TASK-36 P0-1c + TASK-41 P1-4 披风：制式长袍梯形 + 三边开衩（INK 镂空；开衩 1.5×7→2×9 加深加宽）
  if (pose === 1) {
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(9, -6);
    ctx.lineTo(14, 14);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    // 开衩（pose1 底 y=14 与披风对齐；x=±8.5 → ×1.12=9.52 ✔）
    ctx.fillStyle = INK;
    ctx.fillRect(-8.5, 4, 2, 10);
    ctx.fillRect(-1, 4, 2, 10);
    ctx.fillRect(6.5, 4, 2, 10);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-9, -5);
  ctx.lineTo(9, -5);
  ctx.lineTo(13.5, 13);
  ctx.lineTo(-13.5, 13);
  ctx.closePath();
  ctx.fill();
  // 开衩（pose0 底 y=13；x=±8.5 → ×1.12=9.52 ✔）
  ctx.fillStyle = INK;
  ctx.fillRect(-8.5, 4, 2, 9);
  ctx.fillRect(-1, 4, 2, 9);
  ctx.fillRect(6.5, 4, 2, 9);
}

/**
 * TASK-41 v3.5 P0-3 守夜人冷青提灯：身份光源（描边后正常比例绘制，不参与 1.12 放大层，同帧 32×32 内）。
 * 画序：光晕外圈 → 光晕内圈 → 灯杆 → 灯体 → 灯芯（光晕在最底层）。
 * 最右 x=10.5+5.2=15.7 ≤16 ✔（安全上限，勿加 r≥5.5 会贴 16 裁切）；y∈[-4.7,5.7] ✔、灯杆 y=-6 ✔。
 */
function drawPlayerLantern(ctx: Ctx): void {
  // 光晕外圈（宽柔光，α0.10；移动端 ≤16px 无意义，由渲染缩放自然省略）
  fillCircle(ctx, 10.5, 0.5, 5.2, PALETTE.playerAccent, 0.1);
  // 光晕内圈（比 v3 r2.8/α0.22 大且亮：r4/α0.30）
  fillCircle(ctx, 10.5, 0.5, 4.0, PALETTE.playerAccent, 0.3);
  // 灯杆（从帽檐右下缘伸出，避开加宽后的帽檐区；x 7..8.5, y -6..-1）
  ctx.fillStyle = hexToRgba(PALETTE.uiPaper, 0.55);
  ctx.fillRect(7, -6, 1.5, 5);
  // 灯体（4×5，比 v3 3×4 大 67%；x 8.5..12.5, y -2..3）
  ctx.fillStyle = hexToRgba(PALETTE.playerAccent, 0.95);
  ctx.fillRect(8.5, -2, 4, 5);
  // 灯芯
  fillCircle(ctx, 10.5, 0.5, 2.2, PALETTE.playerAccent, 0.85);
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
  // TASK-36 P0-4a + TASK-41 P1-A 屠刀（右手侧；刀柄 INK + 刀身主体 + 纸白刃光）
  // v3.5：刀身右缘 +1px（22→23 / 21→22），刃光 α0.55→0.75；最右 x=23（刃光 22.5..23.5）≤24 ✔（48px 帧无放大层）
  ctx.fillStyle = hexToRgba(INK, 0.85);
  ctx.fillRect(14, -2, 3, 8); // 刀柄
  ctx.fillStyle = PALETTE.enemyTank;
  ctx.beginPath();
  ctx.moveTo(17, -5);
  ctx.lineTo(23, -3);
  ctx.lineTo(22, 10);
  ctx.lineTo(17, 9);
  ctx.closePath();
  ctx.fill(); // 刀身（右缘 +1px）
  ctx.fillStyle = hexToRgba(PALETTE.uiPaper, 0.75);
  ctx.fillRect(22.5, -3.5, 1, 13); // 刀背刃光（x 22.5..23.5）
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
function bossShape(ctx: Ctx, pose = 0, bodyColor?: string): void {  // 披风主体（倒梯形；变体外扩）
  const w = pose === 1 ? 48 : 42;
  const f = pose === 1 ? 56 : 52;
  ctx.fillStyle = bodyColor ?? BOSS.COLOR_MAIN;
  ctx.beginPath();
  ctx.moveTo(-w, -22);
  ctx.lineTo(w, -22);
  ctx.lineTo(f, 44);
  ctx.lineTo(-f, 44);
  ctx.closePath();
  ctx.fill();
  // TASK-36 P0-5b 仪式权杖（画序：披风后、侧翼前——翼盖杖杆下部 2px 形成"持杖"错觉；
  // 最右 x=53 → ×1.05=55.65 → 60+55.65=115.65 ≤120 ✔；底 y=30 → 91.5 ≤120 ✔）
  ctx.fillStyle = bodyColor ?? BOSS.COLOR_MAIN;
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

// ============================================================================
// E4-S4 程序剪影兜底（asset-spec v1.1 §4.2）：15 新敌 + 变体帧（32×32，无描边 RV-C1）
// 帧名 = 契约（frame-registry），M4 外部素材按帧名无痛替换。
// 颜色：BLOOD 亡者暗红系 / BEAST 兽群灰棕系（PALETTE token，唯一来源）。
// ============================================================================

/** 墓穴甲虫（enemy_g1_3）：圆壳 + 六足 + 触角（暗红） */
function beetleShape(ctx: Ctx, pose = 0, color = PALETTE.enemyZombie): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 2, 11, 9, 0, 0, Math.PI * 2); // 圆壳
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 2, 7, 5.5, 0, 0, Math.PI * 2); // 背甲中线
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-4, -1, 2.2, 2.6, 0, 0, Math.PI * 2); // 眼
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, -1, 2.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // 触角
  ctx.fillStyle = color;
  ctx.fillRect(-11, -6, 2, 4);
  ctx.fillRect(9, -6, 2, 4);
  // 足（pose1 收拢）
  ctx.fillRect(-9, pose === 1 ? 8 : 4, 2, 6);
  ctx.fillRect(-3, pose === 1 ? 9 : 6, 2, 5);
  ctx.fillRect(3, pose === 1 ? 9 : 6, 2, 5);
  ctx.fillRect(7, pose === 1 ? 8 : 4, 2, 6);
}

/** 血犬（enemy_g1_2）：尖牙犬形（复用疾行狼家族，耳更垂、吻更短） */
function houndShape(ctx: Ctx, pose = 0, color = PALETTE.enemyWolf): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(pose === 1 ? 2 : 1, -1, 6.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7.5, -1.5, 3.2, 0, Math.PI * 2); // 头
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8.5, -3.2);
  ctx.lineTo(11, -0.6);
  ctx.lineTo(8.5, 1.6);
  ctx.closePath();
  ctx.fill(); // 吻
  ctx.beginPath();
  ctx.moveTo(3, -5);
  ctx.lineTo(4.5, -7.2); // 垂耳
  ctx.lineTo(6.8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -1.5);
  ctx.lineTo(-9.8, -5.5); // 尾
  ctx.lineTo(-5.5, 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(9.2, 0.8); // 尖牙
  ctx.lineTo(10.2, 3);
  ctx.lineTo(11, 0.6);
  ctx.closePath();
  ctx.fill();
  fillCircle(ctx, 8, -2.6, 1.1, INK);
}

/** 亡魂（enemy_g1_4）：半透明残影（幽紫）+ 波状下摆 + 空洞眼 */
function wraithShape(ctx: Ctx, pose = 0, color = PALETTE.enemyWraith): void {
  ctx.globalAlpha = pose === 1 ? 0.55 : 0.75; // 变体更透明（残影）
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.quadraticCurveTo(0, -14, 8, -10); // 头圆顶
  ctx.lineTo(8, 6);
  // 波状下摆
  ctx.quadraticCurveTo(5, 10, 2, 6);
  ctx.quadraticCurveTo(-1, 10, -4, 6);
  ctx.quadraticCurveTo(-7, 10, -8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // 空洞眼（纸白描边 + 深瞳 = 幽灵危险编码）
  fillCircle(ctx, -4, -6, 3, PAPER);
  fillCircle(ctx, 4, -6, 3, PAPER);
  fillCircle(ctx, -4, -6, 1.6, INK);
  fillCircle(ctx, 4, -6, 1.6, INK);
}

/** 尸巫（enemy_g1_5）：骷髅 + 法杖 + 兜帽（暗红褐） */
function necroShape(ctx: Ctx, pose = 0, color = PALETTE.enemyNecro): void {
  ctx.fillStyle = color;
  // 兜帽（三角兜帽 + 袍身）
  ctx.beginPath();
  ctx.moveTo(-9, -6);
  ctx.lineTo(-6, -13);
  ctx.lineTo(0, -10);
  ctx.lineTo(6, -13);
  ctx.lineTo(9, -6);
  ctx.lineTo(11, 12);
  ctx.lineTo(-11, 12);
  ctx.closePath();
  ctx.fill();
  // 骷髅脸（纸白 + 深瞳 + 牙）
  fillCircle(ctx, 0, -3, 5, PAPER);
  fillCircle(ctx, -2.2, -4, 1.4, INK);
  fillCircle(ctx, 2.2, -4, 1.4, INK);
  ctx.fillStyle = INK;
  ctx.fillRect(-3, -1, 6, 1.4);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-2, 0.5, 1.4, 1.6);
  ctx.fillRect(0.6, 0.5, 1.4, 1.6);
  // 法杖（右手侧，pose1 抬起）
  ctx.fillStyle = color;
  ctx.fillRect(10, pose === 1 ? -14 : -8, 2, 24);
  fillCircle(ctx, 11, pose === 1 ? -16 : -10, 3, PALETTE.enemyBoss); // 杖首红宝石
}

/**
 * 守墓者（enemy_g1_6 精英，R-C3-RULING）：1.5x 巨尸轮廓 + 断碑残冠尖顶剪影（幽紫）。
 * GDD 视觉编码「1.5x·幽紫 3px·断碑残冠」——程序兜底以幽紫主体 + INK 3px 轮廓 rim
 * （断碑深色边，仅用既有 token；M4 素材按 art-spec 幽紫 3px 精确替换）+ 双编码角饰。
 * pose=1 变体：肩部外扩 + 双角外倾 + 断碑尖顶侧倾（蓄力帧，同既有 elite 变体语义）。
 * 中心 (0,0)，主体半宽 ≤14、3px stroke 外扩 1.5 → 最外 15.5 ≤16 帧半 ✔（32×32）。
 */
function gravekeeperShape(ctx: Ctx, pose = 0, color = PALETTE.enemyGravekeeper): void {
  ctx.beginPath();
  // 1.5x 巨尸主体（宽肩倒梯形；变体肩更宽）
  ctx.moveTo(pose === 1 ? -13 : -12, -6);
  ctx.lineTo(pose === 1 ? 13 : 12, -6);
  ctx.lineTo(pose === 1 ? 15 : 14, 13);
  ctx.lineTo(pose === 1 ? -15 : -14, 13);
  ctx.closePath();
  // 双编码角饰（色盲可辨的角形，同 tank 双角语义；变体外倾）
  ctx.moveTo(-11, -6);
  ctx.lineTo(pose === 1 ? -14 : -13, -12);
  ctx.lineTo(-7, -8);
  ctx.closePath();
  ctx.moveTo(11, -6);
  ctx.lineTo(pose === 1 ? 14 : 13, -12);
  ctx.lineTo(7, -8);
  ctx.closePath();
  // 断碑残冠（中心断碑：锯齿尖顶 = 断裂墓碑轮廓；变体侧倾）
  ctx.moveTo(-5, -6);
  ctx.lineTo(pose === 1 ? -3 : -2, -13);
  ctx.lineTo(0, -7);
  ctx.lineTo(pose === 1 ? 1 : 2, -11);
  ctx.lineTo(5, -6);
  ctx.closePath();
  // 幽紫 3px 描边：先以 INK 3px stroke 轮廓（断碑深色 rim），再填幽紫主体
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  // 眼点（深色；变体略下移 = 蓄力低首）
  fillCircle(ctx, -5, -1 + (pose === 1 ? 1 : 0), 1.8, INK);
  fillCircle(ctx, 5, -1 + (pose === 1 ? 1 : 0), 1.8, INK);
  // 断碑裂纹（深色细线）
  ctx.strokeStyle = hexToRgba(INK, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-7, 4);
  ctx.lineTo(-5, 9);
  ctx.moveTo(3, 3);
  ctx.lineTo(5, 8);
  ctx.stroke();
}

/** 血信徒（enemy_g2_1）：兜帽烛台（暗红，兜帽前伸持烛） */
function acolyteShape(ctx: Ctx, pose = 0, color = PALETTE.enemyZombie): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-9, -6);
  ctx.lineTo(-5, -12);
  ctx.lineTo(0, -8);
  ctx.lineTo(5, -12);
  ctx.lineTo(9, -6);
  ctx.lineTo(11, 12);
  ctx.lineTo(-11, 12);
  ctx.closePath();
  ctx.fill();
  // 兜帽暗面（镂空）
  fillCircle(ctx, 0, -2, 4.4, INK);
  // 烛台（前伸，pose1 微倾）
  ctx.fillStyle = PALETTE.enemyBoss;
  ctx.fillRect(pose === 1 ? 4 : 6, -14, 2, 8);
  fillCircle(ctx, pose === 1 ? 5 : 7, -15, 2.4, PALETTE.uiPaper); // 烛焰
}

/** 血蝠（enemy_g2_2）：翼形（空中=相位；暗红更小） */
function batShape(ctx: Ctx, pose = 0, color = PALETTE.enemyWolf): void {
  ctx.fillStyle = color;
  // 双翼（pose1 展开更宽）
  const wing = pose === 1 ? 14 : 12;
  ctx.beginPath();
  ctx.moveTo(-3, -2);
  ctx.lineTo(-wing, -8);
  ctx.lineTo(-8, 1);
  ctx.lineTo(-wing + 4, 6);
  ctx.lineTo(-2, 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3, -2);
  ctx.lineTo(wing, -8);
  ctx.lineTo(8, 1);
  ctx.lineTo(wing - 4, 6);
  ctx.lineTo(2, 2);
  ctx.closePath();
  ctx.fill();
  // 躯干 + 双耳
  ctx.beginPath();
  ctx.ellipse(0, 2, 3.4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.lineTo(-3, -8);
  ctx.lineTo(0, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -3);
  ctx.lineTo(3, -8);
  ctx.lineTo(0, -4);
  ctx.closePath();
  ctx.fill();
  fillCircle(ctx, -1.4, 1, 0.9, PAPER);
  fillCircle(ctx, 1.4, 1, 0.9, PAPER);
}

/** 圣杯侍僧（enemy_g2_3）：长袍 + 圣杯 + 头顶符文（暗红幽紫调） */
function cupbearerShape(ctx: Ctx, pose = 0, color = PALETTE.enemyTank): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(8, -8);
  ctx.lineTo(10, 12);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  // 头
  fillCircle(ctx, 0, -12, 4, color);
  // 圣杯（胸前，pose1 举起）
  ctx.fillStyle = PALETTE.enemyBoss;
  if (pose === 1) {
    ctx.fillRect(2, -18, 2, 10);
    ctx.fillRect(0, -20, 6, 3);
  } else {
    ctx.fillRect(-2, -4, 4, 3);
  }
  // 头顶符文（纸白十字 = 圣杯语义）
  ctx.fillStyle = PALETTE.uiPaper;
  ctx.fillRect(-1.5, -15, 3, 5);
  ctx.fillRect(-3, -13, 6, 1);
}

/** 血肉畸体（enemy_g2_4 精英）：多臂畸体（幽紫精英，宽大） */
function fleshmassShape(ctx: Ctx, pose = 0, color = PALETTE.enemyTank): void {
  ctx.fillStyle = color;
  // 主躯干（大块头）
  ctx.beginPath();
  ctx.ellipse(0, 2, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // 多臂（pose1 更多伸出）
  const arms = pose === 1 ? 5 : 4;
  for (let i = 0; i < arms; i += 1) {
    const a = -Math.PI / 2 + (i / arms) * Math.PI;
    ctx.save();
    ctx.translate(Math.cos(a) * 11, 2 + Math.sin(a) * 9);
    ctx.rotate(a);
    ctx.fillRect(0, -1.5, 8, 3);
    ctx.restore();
  }
  // 眼点（多处）
  fillCircle(ctx, -4, 0, 1.6, PAPER);
  fillCircle(ctx, 0, -2, 1.6, PAPER);
  fillCircle(ctx, 4, 0, 1.6, PAPER);
  // 大嘴
  ctx.fillStyle = INK;
  ctx.fillRect(-5, 5, 10, 2.4);
}

/** 忏悔者（enemy_g2_5）：长袍持烛（暗红；远程烛火弹语义 = 手持烛） */
function penitentShape(ctx: Ctx, pose = 0, color = PALETTE.enemyZombie): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(8, -8);
  ctx.lineTo(9, 12);
  ctx.lineTo(-9, 12);
  ctx.closePath();
  ctx.fill();
  fillCircle(ctx, 0, -12, 4, color); // 头
  // 持烛（pose1 前伸投掷姿态）
  ctx.fillStyle = PALETTE.enemyBoss;
  ctx.fillRect(pose === 1 ? 7 : -3, pose === 1 ? -6 : 1, 2, 7);
  fillCircle(ctx, pose === 1 ? 8 : -2, pose === 1 ? -8 : 0, 2.2, PALETTE.uiPaper); // 烛焰
}

/** 灰狼（enemy_g3_1）：竖耳灰狼（暗灰棕） */
function greywolfShape(ctx: Ctx, pose = 0, color = PALETTE.beastGrey): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(pose === 1 ? 2 : 1, -1, 6.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7.5, -1.5, 3.2, 0, Math.PI * 2); // 头
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8.5, -3.4);
  ctx.lineTo(11.8, -0.6);
  ctx.lineTo(8.5, 1.8);
  ctx.closePath();
  ctx.fill(); // 吻
  // 竖耳（灰狼特征：直立尖耳）
  ctx.beginPath();
  ctx.moveTo(3, -5);
  ctx.lineTo(4.5, -9.5);
  ctx.lineTo(7, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6.5, -4.6);
  ctx.lineTo(8.5, -8.8);
  ctx.lineTo(10, -3.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -1.5); // 尾
  ctx.lineTo(-9.8, -5.5);
  ctx.lineTo(-5.5, 1.2);
  ctx.closePath();
  ctx.fill();
  fillCircle(ctx, 8, -2.6, 1.1, INK);
  fillCircle(ctx, 8.2, -3.4, 0.5, PAPER);
}

/** 暗影狼（enemy_g3_2）：流线暗狼（暗蓝灰，更细长高速） */
function shadowwolfShape(ctx: Ctx, pose = 0, color = PALETTE.beastShadow): void {
  ctx.fillStyle = color;
  // 更细长流线躯干（pose1 拉长奔跑）
  ctx.beginPath();
  ctx.ellipse(pose === 1 ? 3 : 2, -1, pose === 1 ? 8 : 7, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8.5, -1.5, 2.8, 0, Math.PI * 2); // 头（更小更尖）
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9.5, -3);
  ctx.lineTo(12.4, -0.4);
  ctx.lineTo(9.5, 1.6);
  ctx.closePath();
  ctx.fill(); // 尖吻
  ctx.beginPath();
  ctx.moveTo(4, -4.6);
  ctx.lineTo(5.5, -8.6); // 贴耳（流线：耳向后）
  ctx.lineTo(8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6.5, -1);
  ctx.lineTo(-10.4, -4.6); // 细尾
  ctx.lineTo(-6, 0.8);
  ctx.closePath();
  ctx.fill();
  fillCircle(ctx, 9, -2.4, 0.9, PAPER); // 狼眼
  fillCircle(ctx, 9.2, -3.2, 0.4, INK);
}

/** 石甲狼（enemy_g3_3 精英）：石甲纹灰狼（冷灰精英，背部石甲板） */
function stonewolfShape(ctx: Ctx, pose = 0, color = PALETTE.beastStone): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(1, 0, 7.5, 4.6, 0, 0, Math.PI * 2); // 更厚实躯干
  ctx.fill();
  // 头（pose1 低头蓄力 → 头略下移）
  ctx.beginPath();
  ctx.arc(8, -1.5 + (pose === 1 ? 1.2 : 0), 3.4, 0, Math.PI * 2); // 头
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9.2, -3.6);
  ctx.lineTo(12, -0.6);
  ctx.lineTo(9.2, 1.8);
  ctx.closePath();
  ctx.fill(); // 吻
  // 竖耳（石甲短粗耳）
  ctx.beginPath();
  ctx.moveTo(3.4, -5.4);
  ctx.lineTo(4.6, -8.6);
  ctx.lineTo(7, -4.4);
  ctx.closePath();
  ctx.fill();
  // 背部石甲板（冷灰亮块，石甲纹语义）
  ctx.fillStyle = hexToRgba(PALETTE.uiPaper, 0.5);
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(-1, -6);
  ctx.lineTo(3, -4.4);
  ctx.lineTo(0, -1.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  // 石甲裂缝（INK 细线）
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(-2, -3);
  ctx.moveTo(0, -5);
  ctx.lineTo(1, -3);
  ctx.stroke();
  fillCircle(ctx, 8.6, -2.6, 1.2, INK);
  fillCircle(ctx, 8.8, -3.4, 0.5, PAPER);
}

/** 狼裔猎手（enemy_g3_4）：人形狼首（暗褐；持刃/冲锋姿态） */
function wolfhunterShape(ctx: Ctx, pose = 0, color = PALETTE.beastHunter): void {
  ctx.fillStyle = color;
  // 人形躯干（直立）
  ctx.beginPath();
  ctx.moveTo(-5, -6);
  ctx.lineTo(5, -6);
  ctx.lineTo(6, 10);
  ctx.lineTo(-6, 10);
  ctx.closePath();
  ctx.fill();
  // 狼首（竖耳 + 尖吻，侧脸朝右）
  ctx.beginPath();
  ctx.arc(1, -9, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3, -11);
  ctx.lineTo(8, -8);
  ctx.lineTo(3, -6);
  ctx.closePath();
  ctx.fill(); // 吻
  ctx.beginPath();
  ctx.moveTo(-1.5, -13);
  ctx.lineTo(-1, -18);
  ctx.lineTo(1.5, -12.5);
  ctx.closePath();
  ctx.fill(); // 左耳
  ctx.beginPath();
  ctx.moveTo(2.5, -13.4);
  ctx.lineTo(4, -18);
  ctx.lineTo(5.5, -12.6);
  ctx.closePath();
  ctx.fill(); // 右耳
  // 臂持刃（pose1 冲锋前指）
  ctx.fillRect(pose === 1 ? 3 : 4, pose === 1 ? -3 : 0, 2, 8);
  ctx.beginPath();
  ctx.moveTo(pose === 1 ? 10 : 9, pose === 1 ? -8 : -5);
  ctx.lineTo(pose === 1 ? 14 : 13, pose === 1 ? -6 : -3);
  ctx.lineTo(pose === 1 ? 8 : 7, pose === 1 ? -2 : 1);
  ctx.closePath();
  ctx.fill(); // 刃
  fillCircle(ctx, 2, -9.6, 1.1, INK); // 狼眼
  fillCircle(ctx, 2.3, -10.4, 0.5, PAPER);
}

/** 15 敌兜底 shape 表（asset-spec §4.2 兜底映射；frame → shape 函数）。
 *  15 敌配置帧中 g1_1 行尸复用既有 enemy-zombie（createCharactersAtlas 单独绘制），
 *  其余 14 帧（13 既有 + R-C3-RULING enemy-gravekeeper）走本表。 */
const ENEMY_SHAPE_FALLBACK: Record<
  string,
  { shape: (ctx: Ctx, pose: number) => void; cell: number }
> = {
  'enemy-beetle': { shape: beetleShape, cell: 32 },
  'enemy-hound': { shape: houndShape, cell: 32 },
  'enemy-wraith': { shape: wraithShape, cell: 32 },
  'enemy-necro': { shape: necroShape, cell: 32 },
  'enemy-gravekeeper': { shape: gravekeeperShape, cell: 32 },
  'enemy-acolyte': { shape: acolyteShape, cell: 32 },
  'enemy-bat': { shape: batShape, cell: 32 },
  'enemy-cupbearer': { shape: cupbearerShape, cell: 32 },
  'enemy-fleshmass': { shape: fleshmassShape, cell: 32 },
  'enemy-penitent': { shape: penitentShape, cell: 32 },
  'enemy-greywolf': { shape: greywolfShape, cell: 32 },
  'enemy-shadowwolf': { shape: shadowwolfShape, cell: 32 },
  'enemy-stonewolf': { shape: stonewolfShape, cell: 32 },
  'enemy-wolfhunter': { shape: wolfhunterShape, cell: 32 },
};

/**
 * 生成全部程序贴图（幂等：已存在的 key 跳过，兼容 scene.restart）。
 * 由 PlayScene.create 调用；不再单独生成散纹理。
 */
export function createProceduralTextures(scene: Phaser.Scene, cfg: RuntimeConfig): void {
  createGroundTile(scene);
  createGrassTile(scene);
  createGraveSoilTile(scene);
  createTrapTile(scene);
  createChurchTiles(scene);
  createDenTiles(scene);
  createBlockerTile(scene);
  createCharactersAtlas(scene, cfg);
  applyExternalCharacterFrames(scene);
  createEffectsAtlas(scene);
  createAmbientAtlas(scene);
  applyExternalEffectsFrames(scene);
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

/** 墓地土：比共享石板更「土」、更冷的灰褐（MapSystem 墓地 ground 优先此帧） */
function createGraveSoilTile(scene: Phaser.Scene): void {
  if (scene.textures.exists('tile-grave-soil')) return;
  const size = TILE.SIZE;
  const canvas = scene.textures.createCanvas('tile-grave-soil', size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();
  ctx.fillStyle = '#1A1614';
  ctx.fillRect(0, 0, size, size);
  const rng = mulberry32(20260826);
  for (let i = 0; i < 28; i += 1) {
    ctx.fillStyle = rng() > 0.5 ? '#241F1C' : '#131722';
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size, 2 + rng() * 5, 1.5 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(42,51,70,0.45)';
  for (let i = 0; i < 10; i += 1) {
    ctx.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 2, 2);
  }
  canvas.refresh();
}

/** 危险贴花地砖：暗红 + 斜纹（与地毯装饰语义区分） */
function createTrapTile(scene: Phaser.Scene): void {
  if (scene.textures.exists('tile-trap')) return;
  const size = TILE.SIZE;
  const canvas = scene.textures.createCanvas('tile-trap', size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();
  ctx.fillStyle = '#7E1E1E';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = PALETTE.danger;
  ctx.lineWidth = 3;
  for (let i = -size; i < size * 2; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(242,245,249,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  canvas.refresh();
}

/** 教堂 tile（E4-S4 程序剪影兜底，gdd-maps §3.2）：石砖 + 暗红地毯 */
function createChurchTiles(scene: Phaser.Scene): void {
  const size = TILE.SIZE;
  // 教堂石砖：暗灰基底 + 砖缝网格 + 风化（与墓地石板区分：更冷灰、砖块缝）
  if (!scene.textures.exists('tile-church-stone')) {
    const canvas = scene.textures.createCanvas('tile-church-stone', size, size);
    if (canvas) {
      const ctx = canvas.getContext();
      ctx.fillStyle = '#232A38';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(11,14,20,0.6)';
      ctx.lineWidth = 1;
      const brickW = size / 2;
      const brickH = size / 4;
      for (let row = 0; row < 4; row += 1) {
        const offset = row % 2 === 0 ? 0 : brickW / 2;
        for (let col = -1; col < 3; col += 1) {
          ctx.strokeRect(col * brickW + offset, row * brickH, brickW, brickH);
        }
      }
      const rng = mulberry32(20260820);
      for (let i = 0; i < 24; i += 1) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(43,52,70,0.5)' : 'rgba(8,10,16,0.4)';
        ctx.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 2, 2);
      }
      canvas.refresh();
    }
  }
  // 教堂暗红地毯：低饱和红底 + 菱形纹（装饰语义 α 由 MapSystem 降 0.35，与血池危险区分）
  if (!scene.textures.exists('tile-church-carpet')) {
    const canvas = scene.textures.createCanvas('tile-church-carpet', size, size);
    if (canvas) {
      const ctx = canvas.getContext();
      ctx.fillStyle = '#3A2426';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(84,230,201,0.14)'; // 冷青细纹（圣辉语义，低饱和）
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(size / 2, i * 16);
        ctx.lineTo(i % 2 === 0 ? 8 : size - 8, size / 2);
        ctx.stroke();
      }
      canvas.refresh();
    }
  }
}

/** 狼穴 tile（E4-S4 程序剪影兜底，gdd-maps §3.3）：岩地 + 暗绿草 */
function createDenTiles(scene: Phaser.Scene): void {
  const size = TILE.SIZE;
  // 狼穴岩地：暗褐灰 + 碎石 + 裂纹
  if (!scene.textures.exists('tile-den-earth')) {
    const canvas = scene.textures.createCanvas('tile-den-earth', size, size);
    if (canvas) {
      const ctx = canvas.getContext();
      ctx.fillStyle = '#241F1C';
      ctx.fillRect(0, 0, size, size);
      const rng = mulberry32(20260821);
      for (let i = 0; i < 10; i += 1) {
        ctx.fillStyle = rng() > 0.5 ? '#332B26' : '#1A1614';
        ctx.beginPath();
        ctx.ellipse(rng() * size, rng() * size, 2 + rng() * 4, 1.5 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(11,14,20,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.lineTo(20, 30);
      ctx.moveTo(48, 4);
      ctx.lineTo(40, 28);
      ctx.stroke();
      canvas.refresh();
    }
  }
  // 狼穴暗绿草：暗绿基底 + 短草叶（比墓地草地更暗更密，BEAST 领地）
  if (!scene.textures.exists('tile-den-grass')) {
    const canvas = scene.textures.createCanvas('tile-den-grass', size, size);
    if (canvas) {
      const ctx = canvas.getContext();
      ctx.fillStyle = '#141A16';
      ctx.fillRect(0, 0, size, size);
      const rng = mulberry32(20260822);
      ctx.strokeStyle = '#26332A';
      ctx.lineWidth = 1;
      for (let i = 0; i < 160; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const len = 2 + rng() * 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 2, y - len);
        ctx.stroke();
      }
      canvas.refresh();
    }
  }
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
  drawSilhouette(ctx, (g, color) => playerShape(g, 0, color), PALETTE.playerAccent, 1.12);
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
  drawSilhouette(ctx, (g, color) => bossShape(g, 0, color), cfg.outlineEnabled ? BOSS.COLOR_MAIN : undefined, 1.05);
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
  drawSilhouette(ctx, (g, color) => playerShape(g, 1, color), PALETTE.playerAccent, 1.12);
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
  drawSilhouette(ctx, (g, color) => bossShape(g, 1, color), cfg.outlineEnabled ? BOSS.COLOR_MAIN : undefined, 1.05);
  ctx.restore();

  // E4-S4：15 敌兜底程序剪影（asset-spec §4.2 兜底映射）——
  // 网格 (284,56) 起，7 列 × 4 行 32×32 单元：base 帧（行1-2）+ 变体帧（行3-4）
  const enemyFrames = Object.keys(ENEMY_SHAPE_FALLBACK);
  enemyFrames.forEach((frame, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const spec = ENEMY_SHAPE_FALLBACK[frame]!;
    // base 帧
    ctx.save();
    ctx.translate(284 + col * 32 + 16, 56 + row * 32 + 16);
    spec.shape(ctx, 0);
    ctx.restore();
    // 变体帧（pose1）：行 3-4（vRow = 2 + row；15 敌兜底表 14 帧 = base 2 行 + 变体 2 行）
    const vRow = 2 + row;
    ctx.save();
    ctx.translate(284 + col * 32 + 16, 56 + vRow * 32 + 16);
    spec.shape(ctx, 1);
    ctx.restore();
  });

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

  // E4-S4：15 敌兜底帧注册（base + -v 变体；与绘制网格一致 (284,56) 7 列 32×32）
  enemyFrames.forEach((frame, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    tex.add(frame, 0, 284 + col * 32, 56 + row * 32, 32, 32);
    tex.add(`${frame}-v`, 0, 284 + col * 32, 56 + (2 + row) * 32, 32, 32);
  });
}

/** effects 图集 v3：冲击波环 / 经验宝石（烘焙光晕）/ 摇杆 / 贴花 ×3 + E4-S4 障碍帧（1 批） */
function createEffectsAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists('effects')) return;
  const W = 256;
  const H = 192;
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

  // E4-S4：障碍帧（40×40 @ y=128；实心灰蓝 + 高光/阴影，可阻挡物语义）
  drawObstacleFrames(ctx);

  // 治疗十字（16×16 @ x=240；外部帧覆盖同名）
  ctx.fillStyle = HEAL.COLOR;
  ctx.fillRect(240 + 6, 2, 4, 12);
  ctx.fillRect(240 + 2, 6, 12, 4);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1;
  ctx.strokeRect(240 + 5.5, 1.5, 5, 13);

  canvas.refresh();

  const tex = scene.textures.get('effects');
  tex.add('shockwave', 0, 0, 0, 32, 32);
  tex.add('gem', 0, 40, 0, 20, 20); // v3：12×12 → 20×20（光晕留白）
  tex.add('joystick-base', 0, 60, 0, JOYSTICK.RADIUS * 2, JOYSTICK.RADIUS * 2);
  tex.add('joystick-thumb', 0, 164, 0, 44, 44);
  tex.add('heal', 0, 240, 0, 16, 16);
  tex.add('decal-rock', 0, 0, 96, 16, 16);
  tex.add('decal-grass', 0, 16, 96, 16, 16);
  tex.add('decal-blood', 0, 32, 96, 16, 16);
  // E4-S4：教堂/狼穴障碍帧 + 血池贴花（40×40 @ y=128，MapSystem 圆形碰撞体消费）
  tex.add('obst-church-pillar', 0, 0, 128, 40, 40);
  tex.add('obst-church-bench', 0, 40, 128, 40, 40);
  tex.add('obst-church-altar', 0, 80, 128, 40, 40);
  tex.add('obst-den-rock', 0, 120, 128, 40, 40);
  tex.add('obst-den-log', 0, 160, 128, 40, 40);
  tex.add('decal-bloodpool', 0, 200, 128, 40, 40);
}

/** 障碍帧绘制（E4-S4，40×40 @ y=128）：教堂立柱/长椅/祭坛 + 狼穴巨石/倒木 + 血池贴花 */
function drawObstacleFrames(ctx: Ctx): void {
  // 教堂立柱（obst-church-pillar）：灰蓝柱体 + 柱头/柱基 + 顶缘高光
  ctx.fillStyle = PALETTE.blocker;
  ctx.fillRect(6, 8, 28, 24); // 柱身
  ctx.fillRect(2, 4, 36, 6); // 柱头
  ctx.fillRect(2, 32, 36, 5); // 柱基
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(8, 6, 4, 28); // 高光
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(30, 10, 3, 24); // 阴影

  // 教堂长椅（obst-church-bench）：靠背 + 座面 + 腿
  const bx = 40;
  ctx.fillStyle = PALETTE.blocker;
  ctx.fillRect(bx + 4, 6, 30, 5); // 靠背
  ctx.fillRect(bx + 4, 16, 32, 6); // 座面
  ctx.fillRect(bx + 6, 22, 3, 12); // 腿
  ctx.fillRect(bx + 31, 22, 3, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(bx + 5, 17, 30, 2);

  // 教堂祭坛（obst-church-altar）：石台 + 圣杯剪影
  const ax = 80;
  ctx.fillStyle = PALETTE.blocker;
  ctx.fillRect(ax + 4, 20, 32, 12); // 台面
  ctx.fillRect(ax + 8, 32, 24, 5); // 台基
  ctx.fillStyle = hexToRgba(PALETTE.uiPaper, 0.7);
  ctx.fillRect(ax + 17, 10, 6, 10); // 圣杯
  ctx.fillStyle = hexToRgba(PALETTE.danger, 0.8);
  ctx.beginPath();
  ctx.arc(ax + 20, 8, 3, 0, Math.PI * 2); // 杯口红
  ctx.fill();

  // 狼穴巨石（obst-den-rock）：多棱岩石 + 顶光底影
  const rx = 120;
  ctx.fillStyle = PALETTE.blocker;
  ctx.beginPath();
  ctx.moveTo(rx + 4, 32);
  ctx.lineTo(rx + 10, 6);
  ctx.lineTo(rx + 26, 2);
  ctx.lineTo(rx + 36, 18);
  ctx.lineTo(rx + 32, 34);
  ctx.lineTo(rx + 8, 36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(rx + 10, 6);
  ctx.lineTo(rx + 26, 2);
  ctx.lineTo(rx + 18, 16);
  ctx.closePath();
  ctx.fill();

  // 狼穴倒木（obst-den-log）：横木 + 断口 + 木纹
  const lx = 160;
  ctx.fillStyle = '#3A3028';
  ctx.fillRect(lx + 4, 16, 32, 8); // 木身
  ctx.beginPath();
  ctx.arc(lx + 4, 20, 4.4, 0, Math.PI * 2); // 断口
  ctx.fill();
  ctx.strokeStyle = 'rgba(11,14,20,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lx + 10, 17);
  ctx.lineTo(lx + 10, 23);
  ctx.moveTo(lx + 18, 17);
  ctx.lineTo(lx + 18, 23);
  ctx.moveTo(lx + 26, 17);
  ctx.lineTo(lx + 26, 23);
  ctx.stroke();

  // 血池贴花（decal-bloodpool）：暗红圆池 + 波纹边 + 危险红描边（与地毯区分）
  const px = 200;
  ctx.fillStyle = hexToRgba(PALETTE.enemyZombie, 0.85);
  ctx.beginPath();
  ctx.ellipse(px + 20, 20, 17, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(PALETTE.danger, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px + 20, 20, 17, 15, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hexToRgba(PALETTE.uiPaper, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(px + 20, 20, 12, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * 环境氛围图集 v3（TASK-28）：血月天幕 / 粒子形状 / 暗角渐晕 —— 收敛为 1 个图集 = 1 组批次。
 * 512×256 布局：
 * - moon 128×128 @ (0,0)：暗红血月盘 + 冷青光晕
 * - 粒子形状 @ (128,0)：p-circle 8 / p-square 8 / p-streak 12×4 / p-diamond 8 / p-ring 48（白底，运行时 tint）
 * - vignette 256×256 @ (256,0)：径向暗角渐变（透明中心 → 基底色 55% 边缘）
 * 整图集 LINEAR 过滤（渐晕/光晕放大平滑；粒子轻微柔化无碍剪影风格）。
 */
function createAmbientAtlas(scene: Phaser.Scene): void {  if (scene.textures.exists('fx-ambient')) return;
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
