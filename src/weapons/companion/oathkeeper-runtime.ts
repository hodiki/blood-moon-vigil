/**
 * weapons/companion/oathkeeper-runtime.ts —— 守誓者运行时驱动（W-4 收官，gdd-exclusive-weapons §4.4）
 *
 * B2-W5 状态机（oathkeeper.ts 纯函数）的运行时消费端（无 Phaser 依赖）：
 * - FQ-2：修女（hero_violet）+ 誓约圣铃（xw_bell）→ 开局自带（setEnabled 启用）
 * - 跟随：companion 相位下距玩家 > 60px → 以 120px/s 移向玩家（x/y 数据点；渲染 = `oathkeeper-view-sprite.ts`）
 * - 索敌切换：friendlyTarget() 供 targeting.pickTarget 消费（150px 替身圈强制索敌，
 *   EnemyAiDirector 每帧消费 → 敌移动目标切守誓者——R-2/B2 遗留「updateMovement 接线」本批收口）
 * - 承伤转移路由：routePlayerHurt = 玩家在替身圈内受伤 → transferDamage（50%，
 *   mc_bell_2 machine 0.65 = R-5 圣域叠加口径，参数层已就绪）→ 剩余伤回玩家
 * - 撕咬/墓碑/复活/重召唤：tickBite/tickTombstone/tickResummon 逐帧推进
 */

import {
  applyCompanionMachine,
  convertHealToRevive,
  createOathkeeperState,
  fillReviveProgress,
  oathkeeperHealFull,
  oathkeeperTargetable,
  syncOathkeeperMaxHp,
  tickBite,
  tickResummon,
  tickTombstone,
  transferDamage,
  type OathkeeperState,
} from '@/weapons/companion/oathkeeper';

/** 替身圈半径（§4.4：150px 强制索敌 + 承伤转移圈） */
export const OATHKEEPER_LEASH = 150;
/** 跟随锚距（玩家身后维持距离；工程锚） */
export const FOLLOW_DISTANCE = 60;
/**
 * 跟随速度 px/s（低于玩家移速，不掉队也不抢位）。
 *
 * ── R6 滑步修正（2026-11-09，NV-ENG-EXEC-25 批 E，主理人裁决④）：**180 → 120** ──
 * 推导：walk 4 帧 × 330ms = **1.32s/圈**，一圈覆盖 2 个半步，美术踏步 ≈ **32px/步**；
 *  - 180px/s × 1.32s = 每步 **119px** ≈ 美术步幅的 3.7 倍 → 肉眼可见"脚不动却在地上滑"；
 *  - 120px/s × 1.32s = 每步 **79px** ≈ 2.5 倍（滑步幅度同比 −33%）。
 * 取区间上界 120 而非 90 的理由：玩家 `MOVE_SPEED = 235px/s`（`config/balance/player.ts:12`），
 * 本跟随是纯"追到 60px 以内"的无提速直线逼近 → **跟随速度越低，玩家持续跑动时稳态掉队越远**
 * （120 时差速 115px/s，90 时 145px/s），而 150px 替身圈（承伤转移/强制索敌，`OATHKEEPER_LEASH`）
 * 要求他别掉太远。故在"美术滑步"与"玩法掉队"之间取 120。
 *
 * **批 F 实测再微调**：若录屏仍见滑步 → 降到 90；若见掉队（>150px 失去承伤转移）→
 * 需在 `update()` 内加"距离 > 200px 时追赶提速"（本批**不做**，另立 ticket，避免与滑步修正混批）。
 */
export const FOLLOW_SPEED = 120;
/** 撕咬射程（聚拢玩家附近最近敌；工程锚） */
export const BITE_RANGE = 120;

/** 索敌消费的最小敌形状（Enemy 满足） */
export interface BiteTargetLike {
  x: number;
  y: number;
  hp: number;
  kill(): void;
}

export class OathkeeperRuntime {
  readonly state: OathkeeperState;
  private enabled = false;

  constructor(x = 0, y = 0, playerMaxHp?: number) {
    this.state = createOathkeeperState(x, y, playerMaxHp);
  }

  /**
   * EN-06 动态跟随：以玩家「当局当前」最大生命同步守誓者上限（×150%，**非入场快照**）。
   * 接线点（工程批 C 已落地 · PlayScene）：
   * - 入场初始化：PlayScene 构造时传入玩家面板 `stats.maxHp`（已含角色初始 HP + 天赋树生存节点）；
   * - 运行期跟随：PlayScene 订阅 `GameEvent.HpChanged`（payload { hp, maxHp }）→ 本方法，
   *   覆盖升级成长（hpPerLevel）与升级池生命上限（up_g_3）等玩家最大生命变更源。
   */
  syncMaxHp(playerMaxHp: number): void {
    syncOathkeeperMaxHp(this.state, playerMaxHp);
  }

  /** FQ-2 启用判定（修女 + 圣铃开局自带；PlayScene create 末尾调用） */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * P0-7a 质变卡 2（mc_bell_2）写回：转移 65% / 撕咬 14 / 墓碑 4 HP/s / 转化率 70%。
   * 之前 applyCompanionMachine 全仓无调用点（质变卡只写专武 behavior）→ machine 恒空。
   */
  applyCompanionMachine(machine: Record<string, number>): void {
    applyCompanionMachine(this.state, machine);
  }

  /**
   * P0-7c 圣铃治疗同源落点：companion 阶段回 HP（返回实际回复量）；
   * 墓碑阶段按转化率折算复活进度（GDD §4.4「修女治疗命中墓碑」）。
   */
  healCompanion(amount: number): number {
    if (!this.enabled || amount <= 0) return 0;
    const s = this.state;
    if (s.phase === 'companion') {
      const applied = Math.min(amount, s.maxHp - s.hp);
      s.hp += applied;
      return applied;
    }
    if (s.phase === 'tombstone') {
      convertHealToRevive(s, amount);
      return amount;
    }
    return 0;
  }

  /** P0-7b 誓约回响协同：立即回满（墓碑 = 复活进度充满） */
  healFull(): void {
    if (!this.enabled) return;
    oathkeeperHealFull(this.state);
  }

  /** P0-7b 誓约回响协同：墓碑复活进度直接充满（显式语义，与 healFull 同果异名） */
  fillReviveProgress(): void {
    if (!this.enabled) return;
    fillReviveProgress(this.state);
  }

  /** targeting.pickTarget 消费形状（墓碑/消散/未启用 = null → 敌回落玩家） */
  friendlyTarget(): { targetable: boolean; x: number; y: number } | null {
    if (!this.enabled) return null;
    return { targetable: oathkeeperTargetable(this.state), x: this.state.x, y: this.state.y };
  }

  /**
   * 承伤转移路由（玩家受击统一入口消费）：
   * companion 且玩家在替身圈（150px）内 → transferDamage（machine 0.5/0.65 参数化）；
   * 返回玩家实际承受量（= amount − transferred）。
   */
  routePlayerHurt(amount: number, now: number, player: { x: number; y: number }): number {
    if (!this.enabled || this.state.phase !== 'companion') return amount;
    const inLeash = Math.hypot(player.x - this.state.x, player.y - this.state.y) <= OATHKEEPER_LEASH;
    if (!inLeash) return amount;
    const transferred = transferDamage(this.state, amount, now);
    return Math.max(0, amount - transferred);
  }

  /**
   * 逐帧步进：跟随 → 墓碑/重召唤 → 撕咬。
   * healSink = 修女治疗落点（墓碑期回血+复活进度；PlayScene 注入玩家回血）。
   * 返回撕咬目标（调用方已由 tickBite 内部扣血/kill——返回 dealt 供遥测）。
   */
  update(
    dt: number,
    now: number,
    player: { x: number; y: number },
    enemies: BiteTargetLike[],
    healSink: (amount: number) => number,
  ): number {
    if (!this.enabled) return 0;
    // —— 跟随（companion 相位）——
    if (this.state.phase === 'companion') {
      const dx = player.x - this.state.x;
      const dy = player.y - this.state.y;
      const dist = Math.hypot(dx, dy);
      if (dist > FOLLOW_DISTANCE) {
        const step = Math.min(dist - FOLLOW_DISTANCE, FOLLOW_SPEED * dt);
        this.state.x += (dx / dist) * step;
        this.state.y += (dy / dist) * step;
      }
    }
    // —— 墓碑期（回血/复活进度/到期消散）——
    tickTombstone(this.state, dt, now, player, healSink);
    // —— 重召唤计时 ——
    tickResummon(this.state, dt, now);
    // —— 撕咬（最近敌 ≤120px）——
    let target: BiteTargetLike | null = null;
    let bestDist = BITE_RANGE;
    for (const e of enemies) {
      const d = Math.hypot(e.x - this.state.x, e.y - this.state.y);
      if (d < bestDist) {
        bestDist = d;
        target = e;
      }
    }
    return tickBite(this.state, dt, now, target);
  }
}
