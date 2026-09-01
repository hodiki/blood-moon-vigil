/**
 * scenes/run/kill-loot-consumer.ts —— 击杀事件消费端（统计/掉落/图鉴/功绩/预警/稀有宝箱）
 * （NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责（E3-S1 / E4 / W-B/W-11 / W-3 / TASK-28 / TASK-39 / M3）：
 * - enemy:killed 消费：击杀统计、组黑板路由、MN-23 同源召唤计数、图鉴首杀、功绩首杀计数、
   质变卡渠道 + Q-f 串联、击杀溅射、经验宝石（noXp 全量跳过）、治疗掉落、吸血、
   狂化击杀延长/回血、踏月而行移速 buff。
 * - gem:collected / heal:collected / player:revived 表现端。
 * - TASK-39 屠夫预警血月印记（预约出生显示 / 落地销毁）。
 * - 血月化身稀有宝箱（本局最多 1；拾取 → 图鉴 toast）。
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；调用期才解引用）。
 */

import { ENEMY_CONFIGS, BOSSES, type EnemyKindId } from '@/config/balance';
import { MOON_AVATAR_ENTRY_ID } from '@/codex/codex';
import { GameEvents, GameEvent } from '@/core/events';
import type { RunStats } from '@/stats/run-stats';
import type { PlayerStats } from '@/player/player-stats';
import type { FxManager } from '@/fx/fx-manager';
import type { RageBuff } from '@/active-skill/active-skill-effects';
import { shouldDropHeal } from '@/xp/heal-manager';

/** enemy:killed 事件负载 */
export interface EnemyKilledPayload {
  enemyType: string;
  /** E4-S6 图鉴：内容 ID（15 敌/Boss；旧 kind 三敌 null） */
  enemyId?: string | null;
  xp: number;
  /** W-12 召唤物 noXp：true = 击杀反馈链跳过宝石生成（零 XP 路径，gdd-spawner-v2 §③-7） */
  noXp?: boolean;
  /** W-B/W-11 组黑板路由（方阵成员击杀 → 槽位置亡/召唤物计数释放） */
  groupId?: string | null;
  groupRole?: string | null;
  groupSlotIndex?: number;
  x: number;
  y: number;
}

export interface KillLootPorts {
  runStats: () => RunStats;
  notifyGroupMemberKilled: (payload: EnemyKilledPayload) => void;
  /** MN-23：Boss 同源召唤死亡释放计数（bossConsumer 转发） */
  onBossSummonKilled: (groupId: string | null | undefined) => void;
  codex: () => {
    recordKill(enemyId: string): boolean;
    recordTrigger(entryId: string): void;
    recordProgress(entryId: string): boolean;
  };
  setCodexToastPending: () => void;
  /** B5-W3 Q-f1/f2/f3 首猎之赏（场景树字段 + upgrades 管线） */
  treeEliteOffers: () => number;
  consumeTreeEliteOffer: () => void;
  notifyEliteKilled: () => void;
  notifyEliteOffers: (n: number) => void;
  fx: () => FxManager;
  dropGem: (xp: number, x: number, y: number) => void;
  dropHeal: (x: number, y: number) => void;
  stats: () => PlayerStats;
  rage: () => RageBuff;
  /** B6-W4 up_d_rage 失控边缘判定（upgradeState.stackOf('up_d_rage') >= 1） */
  hasRageUpgrade: () => boolean;
  /** B6-W4 up_d_rage 失控边缘：狂化期击杀延长 0.5s（上限 +3s；场景持有 rageExtraSeconds） */
  extendRageKill: () => void;
  nowSeconds: () => number;
  /** TASK-39 血月印记生成（fx-ambient p-ring 红圈 + 脉冲 tween；返回可销毁句柄） */
  spawnTankMark: (x: number, y: number) => { destroy(): void };
  eachActiveEnemy: (fn: (e: { active: boolean; x: number; y: number; radius: number; setPosition(x: number, y: number): void }) => void) => void;
  playerX: () => number;
  playerY: () => number;
  /** 稀有宝箱纹理帧是否可用（sceneHasFrame('effects','chest')） */
  hasChestFrame: () => boolean;
  addChestImage: (x: number, y: number) => { x: number; y: number; active: boolean; destroy(): void };
}

export class KillLootConsumer {
  private p: KillLootPorts | null = null;
  /** TASK-39 屠夫预警：血月印记精灵（保底厚血预约出生时显示，落地时销毁；null = 无） */
  private tankMark: { destroy(): void } | null = null;
  /** 批次 4：血月化身稀有宝箱（本局最多 1） */
  private rareChest: { x: number; y: number; active: boolean; destroy(): void } | null = null;
  /** E4-S7 本局首杀 Boss/精英数（功绩 +2/只） */
  private firstBossKills = 0;
  /** E4-S7 本局血月化身击杀（功绩 +5） */
  private avatarKills = 0;

  attach(ports: KillLootPorts): void {
    this.p = ports;
  }

  /** per-run 复位（scene.restart 复用实例；create 期调用） */
  resetRun(): void {
    this.firstBossKills = 0;
    this.avatarKills = 0;
  }

  /** E4-S7 功绩结算数据（finishGame 消费） */
  get firstBossKillCount(): number {
    return this.firstBossKills;
  }

  get avatarKillCount(): number {
    return this.avatarKills;
  }

  /**
   * enemy:killed 消费端（E3-S1 / E4 统计）：
   * - 击杀统计（E4 结算）
   * - 掉落经验宝石（僵尸 1 / 疾行 2 / 厚血 15 / Boss 100；Boss 不落地——终局流程接管）
   * - 吸血回血（upgrade-pool 第 8 项）
   */
  onEnemyKilled(args: unknown): void {
    const p = this.p!;
    const payload = args as EnemyKilledPayload;
    p.runStats().recordKill();
    // W-B/W-11：方阵成员/召唤物击杀 → 组黑板路由（槽位置亡/计数释放/全灭解散）
    if (payload.groupId) {
      p.notifyGroupMemberKilled(payload);
      // MN-23：Boss 同源召唤死亡释放计数（上限 6/8 口径）
      p.onBossSummonKilled(payload.groupId);
    }
    // B6-W5 占比分母近似：击杀敌面板 HP 计入总伤害（1D/沙盘校准口径；精确伤害流留遥测批次）
    const cfg = payload.enemyId ? (ENEMY_CONFIGS as Record<string, { hp?: number }>)[payload.enemyId] ?? (BOSSES as Record<string, { hp?: number }>)[payload.enemyId] : undefined;
    if (cfg?.hp) p.runStats().recordTotalDamage(cfg.hp);
    // E4-S6 图鉴：首杀记录（15 敌/Boss；内容 ID 幂等；旧 kind 三敌 enemyId 为 null 跳过）
    if (payload.enemyId) {
      if (p.codex().recordKill(payload.enemyId)) {
        p.setCodexToastPending(); // 图鉴 toast（同帧合并，update 末尾 emit）
        // 首杀 Boss/精英 → 功绩 +2/只（E4-S7；精英 = tank 运行时类，Boss = boss 类）
        const kind = payload.enemyType as EnemyKindId;
        if (kind === 'boss' || kind === 'tank') this.firstBossKills += 1;
        // B3-W3 渠道 1（默认开）：首精英击杀必掉卡 2（待发队列防卡死 §6.1-4）
        if (kind === 'tank') {
          p.notifyEliteKilled();
          // B5-W3 Q-f1/f2/f3 首猎之赏：每局首个精英击杀 → 连得 N 次额外 offer（GT-10 串联）
          if (p.treeEliteOffers() > 0) {
            p.consumeTreeEliteOffer();
            p.notifyEliteOffers(p.treeEliteOffers());
          }
        }
        // 血月化身（boss_4）：任意图稀有月坠 → 图鉴隐藏条目 + 功绩 +5（gdd-codex §3.2/§3.4）
        if (payload.enemyId === 'boss_4') {
          p.codex().recordTrigger(MOON_AVATAR_ENTRY_ID);
          if (p.codex().recordProgress('codex_event_6')) p.setCodexToastPending();
          this.avatarKills += 1;
          this.dropRareChest(payload.x, payload.y);
        }
      }
    }
    // TASK-28：击杀溅射（颜色/形状按敌人类型分化）
    p.fx().deathBurst(payload.x, payload.y, payload.enemyType as EnemyKindId);
    if (payload.enemyType !== 'boss') {
      // W-12 召唤物 noXp 全量（MN-23）：技能召唤实体零宝石路径（无宝石生成 = 天然区分）
      if (!payload.noXp) {
        p.dropGem(payload.xp, payload.x, payload.y);
      }
    }
    // M3 治疗道具（merit-ui-spec §11 + 平衡模拟调整）：精英（tank 槽）掉率 50% / Boss 保底；
    // 普通怪不掉（防掉落稀释）；Boss 保底 100%（shouldDropHeal 内按 HEAL.ELITE_DROP_CHANCE 判定）
    if (shouldDropHeal(payload.enemyType)) {
      p.dropHeal(payload.x, payload.y);
    }
    if (p.stats().applyLifesteal()) {
      GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
    }
    // B6-W4 up_d_rage 失控边缘：狂化期击杀延长 0.5s（上限 +3s）
    const now = p.nowSeconds();
    if (p.rage().active(now) && p.hasRageUpgrade()) {
      p.extendRageKill();
    }
    // 血月狂化衍生技：狂化中击杀回 1 HP（dv_blood_rage 口径沿旧值；与吸血升级/兽血愈合叠加）
    if (p.rage().active(now)) {
      const before = p.stats().hp;
      p.stats().hp = Math.min(
        p.stats().maxHp,
        p.stats().hp + 1, // dv_blood_rage 口径沿旧值（lifestealOnKill=1）
      );
      if (p.stats().hp > before) {
        GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
      }
    }
    // M3-DESIGN-1 up_g_4 踏月而行：击杀后 2s 移速 +15%（PlayerStats 时间窗，无 HP 变化）
    p.stats().triggerKillSpeedBuff(now);
  }

  /** TASK-28：宝石拾取爆点（payload 由 xp-manager 补 x/y） */
  onGemCollected(args: unknown): void {
    const p = this.p!;
    const pos = args as { x?: number; y?: number };
    if (typeof pos.x === 'number' && typeof pos.y === 'number') {
      p.fx().gemPickup(pos.x, pos.y);
    }
  }

  /** B5-W3 复活瞬间周身击退 100px（§④-1 Q-c：防「复活即死」循环） */
  onPlayerRevived(args: unknown): void {
    const p = this.p!;
    const rev = args as { x: number; y: number; knockback: number };
    const kb = rev.knockback ?? 0;
    if (kb <= 0) return;
    p.eachActiveEnemy((e) => {
      if (!e.active) return;
      const dx = e.x - rev.x;
      const dy = e.y - rev.y;
      const len = Math.hypot(dx, dy) || 1;
      if (len > kb + e.radius) return;
      e.setPosition(e.x + (dx / len) * kb, e.y + (dy / len) * kb);
    });
    p.fx().levelUpBurst(rev.x, rev.y); // 复活演出占位（B6 专有演出）
  }

  /** M3 治疗道具拾取：治疗绿发光 + HpChanged（治疗量已由 HealManager 写入 stats） */
  onHealCollected(args: unknown): void {
    const p = this.p!;
    const heal = args as { amount: number; x?: number; y?: number };
    if (typeof heal.x === 'number' && typeof heal.y === 'number') {
      p.fx().healPickup(heal.x, heal.y);
    }
    GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
  }

  /**
   * TASK-39 E2 屠夫预警：保底厚血预约出生 → 出生点生成血月印记（复用 fx-ambient p-ring 红圈，
   * 桌面 edgeWarning 叠加边缘红光脉动由既有机制承担；移动端无全屏红晕，本地印记为主预兆）。
   * 印记脉冲 0.35s×yoyo×3 ≈ 2.5s；落地时（tank:spawned）销毁。
   */
  onTankWarning(args: unknown): void {
    const p = this.p!;
    const pos = args as { x: number; y: number };
    this.destroyTankMark();
    this.tankMark = p.spawnTankMark(pos.x, pos.y);
  }

  /** TASK-39 E2 屠夫预警：预约厚血落地 → 销毁印记 */
  onTankSpawned(): void {
    this.destroyTankMark();
  }

  private destroyTankMark(): void {
    if (this.tankMark) {
      this.tankMark.destroy();
      this.tankMark = null;
    }
  }

  private dropRareChest(x: number, y: number): void {
    const p = this.p!;
    if (this.rareChest) return;
    if (!p.hasChestFrame()) return;
    this.rareChest = p.addChestImage(x, y);
  }

  /** 血月化身稀有宝箱拾取（28px；本局最多 1） */
  updateRareChestPickup(): void {
    const p = this.p!;
    const chest = this.rareChest;
    if (!chest?.active) return;
    const r = 28;
    const dx = chest.x - p.playerX();
    const dy = chest.y - p.playerY();
    if (dx * dx + dy * dy > r * r) return;
    chest.destroy();
    this.rareChest = null;
    p.setCodexToastPending();
  }

  /** 场景 shutdown：清宝箱实体引用 */
  destroyChest(): void {
    this.rareChest?.destroy();
    this.rareChest = null;
  }
}
