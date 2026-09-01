/**
 * combat/contact.ts —— 玩家-敌人接触伤害纯函数（test-framework §1.2：可脱离 Phaser 断言的模块必须抽纯函数）
 *
 * 抽取动机（TASK-37 B1）：原 `PlayScene.onPlayerEnemyOverlap` 把攻击计时门（attackTimer 间隔）
 * 与玩家受击写在闭包内，且通过方法引用传给 `physics.add.overlap` 时丢失 `this` 绑定，
 * 首次玩家-敌人接触即抛 `Cannot read properties of undefined (reading 'hurt')`，
 * 异常沿物理 step 冒泡 → Phaser 主循环崩溃 → 画面卡在最后一帧（"碰到怪物后游戏卡着不动"）。
 *
 * 本模块：把"敌人攻击门 + 玩家受击"抽为纯函数 `playerEnemyContact`，
 * PlayScene 用箭头函数闭包调用之——`this` 由箭头函数词法绑定到 PlayScene，
 * 彻底消除方法引用解绑问题。
 *
 * 攻击间隔语义（enemies §⑥.3 / E8 §⑥.3）：
 * - enemy.attackTimer > 0：尚在冷却，跳过（不扣血、不重置）
 * - enemy.attackTimer ≤ 0：造成一次伤害并重置为 attackInterval
 *
 * 死亡分发：`player.hurt` 内部 HP≤0 时 emit `player:died`（E2-S1 #4），
 * 消费方为 PlayScene.onPlayerDied → finishGame → GAMEOVER + 结算页。
 *
 * **眩晕唯一入口（NV-REVIEW-FIX P0-2）**：硬控期间目标不造成接触伤害，查询只走状态层
 * `cc.stun`（`isStunned`）。旧散落字段 `stunnedUntil` 已从接触路径删除——写入侧统一走
 * `applyStatus`，不再给敌人加平行字段的新消费者（ADR-001 / 审查 §3.2）。
 */

import { isStunned, type StatusState } from '@/combat/status/status-engine';

export interface ContactEnemy {
  readonly active: boolean;
  /** 攻击冷却剩余秒（≤0 可再次造成伤害） */
  attackTimer: number;
  /** 攻击冷却总长秒（造成伤害后 attackTimer = attackInterval） */
  readonly attackInterval: number;
  /** 接触伤害（已乘玩家总倍率，enemy-panel 提供原始值） */
  readonly damage: number;
  /**
   * CC 状态载荷（Enemy 必有；纯测试桩缺省 = 不并线）。
   * 眩晕（硬控）期内阻止接触伤害 —— gdd-status-effects：硬控期间目标不造成接触伤害。
   */
  readonly cc?: StatusState;
}

export interface ContactPlayer {
  /**
   * 玩家受击：无敌帧内免疫，否则扣血 + 设无敌帧 + HP≤0 时死亡分发。
   * 返回是否真正造成伤害（true = 已扣血，false = 无敌帧内被吃）。
   * 语义与 `Player.hurt` 一致（player.ts）。
   */
  hurt(amount: number, nowSeconds: number): boolean;
}

/**
 * 玩家-敌人接触：敌人攻击计时门 + 玩家受击。纯函数（无副作用外的 attackTimer 重置与 player.hurt 内部 emit）。
 *
 * @param enemy 当前重叠的敌人
 * @param nowSeconds 场景时间秒（`scene.time.now / 1000`，无敌帧时间戳比较用）
 * @param player 玩家（提供 hurt）
 * @returns 是否造成伤害（false = 敌人未激活/冷却中/眩晕中，或玩家无敌帧内）
 */
export function playerEnemyContact(
  enemy: ContactEnemy,
  nowSeconds: number,
  player: ContactPlayer,
): boolean {
  // P0-2：硬控（cc.stun）生效即阻止接触伤害（唯一查询入口，不读 stunnedUntil）
  if (!enemy.active || enemy.attackTimer > 0) return false;
  if (enemy.cc && isStunned(enemy.cc, nowSeconds)) return false;
  enemy.attackTimer = enemy.attackInterval;
  return player.hurt(enemy.damage, nowSeconds);
}
