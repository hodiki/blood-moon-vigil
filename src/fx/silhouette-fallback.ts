/**
 * fx/silhouette-fallback.ts —— 程序剪影兜底帧名集（纯数据，不 import Phaser）
 *
 * asset-spec v1.1 §4.2 兜底映射：M2 用程序剪影（procedural-textures.ts 绘制实现），
 * M4 外部素材按帧名无痛替换。本模块只声明「哪些帧有兜底实现」，
 * 供测试断言 15 敌 + 既有 4 敌全覆盖 → 真机无 __MISSING。
 * 绘制实现（shape 函数）留在 procedural-textures.ts（import Phaser 的环境）。
 *
 * 覆盖（asset-spec §4.2 / content-id-frame-map §3；gdd-enemies-v3 §③-2 增补）：
 * 既有 4（zombie/wolf/tank/boss）+ 16 新敌（beetle/hound/wraith/necro/gravekeeper/
 * decayedknight/acolyte/bat/cupbearer/fleshmass/penitent/greywolf/shadowwolf/
 * stonewolf/wolfhunter）。
 */

/** 有程序剪影兜底的敌帧名（含 base 帧；`-v` 变体帧由 base 形状 pose=1 派生，同集覆盖） */
export const SILHOUETTE_FALLBACK_FRAMES: readonly string[] = [
  'enemy-zombie',
  'enemy-wolf',
  'enemy-tank',
  'enemy-boss',
  'enemy-beetle',
  'enemy-hound',
  'enemy-wraith',
  'enemy-necro',
  'enemy-gravekeeper',
  'enemy-decayedknight',
  'enemy-bonethrower',
  'enemy-acolyte',
  'enemy-bat',
  'enemy-cupbearer',
  'enemy-fleshmass',
  'enemy-penitent',
  'enemy-greywolf',
  'enemy-shadowwolf',
  'enemy-stonewolf',
  'enemy-wolfhunter',
] as const;

/** 某敌帧是否有程序剪影兜底（无 = __MISSING，应列清单报美术侧补） */
export function hasEnemySilhouetteFallback(frame: string): boolean {
  return (SILHOUETTE_FALLBACK_FRAMES as readonly string[]).includes(frame);
}

/** 全部 15 敌配置帧是否兜底覆盖（E4-S4 验收：无缺失） */
export function missingSilhouetteFrames(enemyFrames: readonly string[]): string[] {
  return enemyFrames.filter((f) => !hasEnemySilhouetteFallback(f));
}
