/**
 * spawner/enemy-spawner.ts —— 敌潮生成器·Phaser 装配（ARCH §3.1 / S5 / E2-S4）
 *
 * 纯逻辑在 spawner/spawner.ts（budget/阶段/抽签/保底/环带），本类只做秒制累加与
 * 池交互：
 * - 预算按秒累加（budget(t)×dt），帧率无关、掉帧不跳怪（S8 §⑥.5）
 * - 同屏达上限：暂停生成 2s 后重试，不丢弃预算（S8-5 / E8-5）
 * - 3–8min 每 30s 保底 1 厚血（spawner §③ / C-7）；保底厚血出生前 2.5s 血月印记预警（TASK-39 E2）
 * - 6:00 Boss 收束钩子：停止生成 + 清场接口（E4-S3 复用）
 * - M2 收口（R-A + R-C3-RULING）：15 敌运行时接入 —— 槽位权重走该图覆盖（weightedWeightsForStage，
 *   教堂/狼穴 wolf ↑），槽位 → 具体敌走地图槽位池（pickEnemyIdForMap），实体注册走
 *   Enemy.spawnByConfig（ENEMY_CONFIGS 唯一数据源）；狼穴敌潮移速 ×1.08（不含 Boss；enemySpeedFor）。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import type { ArcadePoolLike } from '@/core/object-pools';
import { SPAWNER, ENEMY_CONFIGS, type MapId, type EnemyId } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import {
  budget,
  stageForTime,
  pickEnemyKind,
  tankGuaranteeDue,
  bossTriggerDue,
  spawnPosition,
  type StageWeights,
} from '@/spawner/spawner';
import {
  weightedWeightsForStage,
  pickEnemyIdForMap,
  rForSlot,
  enemySpeedFor,
  spawnRingFor,
  type EnemySlot,
} from '@/spawner/map-spawner';
import {
  createGroupSchedulerState,
  stepGroupScheduler,
  rollGroup,
  reportGroupBudget,
  onBossTimeGroups,
  clearGroupQueues,
  accompanyBoostActive,
  boostedWeights,
  type GroupSchedulerState,
  type GroupRollContext,
} from '@/spawner/spawn-group';
import { MAP_CONFIGS, FORMATIONS, type FormationId } from '@/config/balance';
import { FormationRuntime } from '@/enemies/formation-runtime';
import { applyPanelScale } from '@/enemies/panel-scale';
import { rollAffix, AFFIXES, type AffixId } from '@/config/balance';
import type { GroupMemberState } from '@/enemies/group-blackboard';
import type { Enemy } from '@/enemies/enemy';
import type { Player } from '@/player/player';

export class EnemySpawner {
  /** 局时秒（仅 RUNNING 累加；6:00 收束后不再累计） */
  private t = 0;
  /** 预算累计（点，≥1 才生成一只） */
  private budgetAcc = 0;
  /** 达上限暂停剩余秒（2s 后重试，不丢弃预算） */
  private retryCooldown = 0;
  /** 厚血保底累计秒（仅 3–8min 阶段使用） */
  private tankGuaranteeAcc = 0;
  /**
   * TASK-39 E2 屠夫预警：保底厚血已「预约」出生（血月印记标记出生点，等待落地）。
   * remaining 倒计时（SPAWNER.TANK_WARNING_SECONDS=2.5s）结束后在标记位置落地；
   * enemyId 在预约时即从地图 tank 槽位池抽取（M2 收口：保底厚血 = 该图坦克槽敌种）。
   */
  private pendingTank: { x: number; y: number; remaining: number; enemyId: EnemyId } | null = null;
  private stopped = false;
  /** 场景时间戳秒（scene.time.now/1000 等效；update 由 PlayScene RUNNING 秒制驱动） */
  private time_now = 0;
  /** W-14 宝藏护卫横穿移动器（落地成员引用 + 行进向量；到点/离场移除） */
  private treasureMovers: Array<{ enemy: Enemy; dirX: number; dirY: number; speed: number; exitX: number; exitY: number }> = [];
  /**
   * W-A/W-10 方阵组生成（gdd-spawner-v2 §③-4）：默认关闭（存量测试确定性不变），
   * PlayScene 传 true 启用。掷点/预扣/分帧落地全走 spawn-group 纯函数层。
   */
  private readonly groups: GroupSchedulerState | null;
  /** W-B/W-11 组黑板运行时（与 groups 同生命周期；enableFormations 时创建） */
  private readonly formationRuntime: FormationRuntime | null;
  /** 组生成掷点上下文（惰性组装；环带按图双端覆盖） */
  private readonly groupCtx: GroupRollContext;

  /** E4-S3 复用：6:00 到达时回调（PlayScene 在此做清场 + Boss 出场） */
  onBossTime: (() => void) | null = null;
  /** W-A F-2：boss_4 在场停掷（血月化身 4:30 稀有触发；由 PlayScene 出场时置位） */
  boss4OnField = false;

  /** W-8 等级滞后宽容：玩家等级提供器（PlayScene 注入 XpManager.level；缺省 = 不启用宽容） */
  playerLevelProvider: (() => number) | null = null;

  /** QA-FIX（NV-INTEG-FIX ⑤）：方阵掷点观测钩子（?qa=1 时由 PlayScene 注入 console 上报） */
  groupRollLogger?: (info: { time: number; rolled: boolean; reason?: string; formationId?: string; cost: number }) => void;
  /** W-8 c 案 HP 联动系数（难度域裁决后回填；缺省未启用） */
  caseHpLink: number | undefined = undefined;

  constructor(
    private readonly cfg: RuntimeConfig,
    private readonly enemyPool: ArcadePoolLike<Enemy>,
    private readonly player: Player,
    /** M2 收口：当前地图（槽位池 + 权重覆盖 + 移速加权的数据源；E3-S7） */
    private readonly mapId: MapId,
    /** W-A：方阵组生成开关（PlayScene true 启用；测试缺省 false 保确定性） */
    enableFormations = false,
  ) {
    this.groups = enableFormations ? createGroupSchedulerState() : null;
    this.formationRuntime = enableFormations ? new FormationRuntime() : null;
    const ring = spawnRingFor(mapId, cfg.isMobile);
    const map = MAP_CONFIGS[mapId];
    this.groupCtx = {
      mapId,
      mapWidth: map.width,
      mapHeight: map.height,
      playerX: player.x,
      playerY: player.y,
      ringMin: ring[0],
      ringMax: ring[1],
    };
  }

  update(dt: number): void {
    if (this.stopped) return;
    this.time_now += dt;
    this.t += dt;
    // TASK-39 E2 屠夫预警：预约厚血倒计时（随世界冻结 pause，dt 由 PlayScene RUNNING 秒制驱动）
    this.tickPendingTank(dt);
    // E4-S3：6:00 准时触发（±0.1s，RV-C8）——停止生成 + 回调（PlayScene 清场 + Boss 出场）
    if (bossTriggerDue(this.t, SPAWNER.BOSS_TIME)) {
      this.stopped = true;
      this.pendingTank = null; // 收束后不落地
      if (this.groups) onBossTimeGroups(this.groups); // W-A §⑥-4：丢弃未落地预约
      this.onBossTime?.();
      return;
    }
    const budgetGain = budget(this.t) * dt;
    this.budgetAcc += budgetGain;
    this.tickGroups(dt);
    this.tick(dt);
  }

  /** 玩家死亡：立即停止生成（S8 §⑥.2），重开倒计时无残留刷怪、无残留预警 */
  stop(): void {
    this.stopped = true;
    this.pendingTank = null;
    if (this.groups) clearGroupQueues(this.groups); // W-A §⑥-2：方阵预约/在场组全清
    this.treasureMovers = [];
  }

  /**
   * 清场接口（E4-S3：6:00 清场后 Boss 出场）：批量回收全部普通敌。
   * 静默回收（不触发 enemy:killed，避免清场怪掉落经验，语义=「移除」而非「击杀」）。
   */
  clearAll(): void {
    this.enemyPool.eachActive((e) => {
      e.setActive(false).setVisible(false);
      const body = e.body as Phaser.Physics.Arcade.Body;
      body.stop();
      body.enable = false;
    });
  }

  /** 当前局时（秒） */
  get elapsedSeconds(): number {
    return this.t;
  }

  private tick(dt: number): void {
    const stage = stageForTime(this.t);
    // M2 收口（E3-S7）：实际生效权重 = 基准 + 该图覆盖（教堂/狼穴 wolf ↑，权重和 1.00）
    // W-A F-1：方阵伴随窗口内普通槽权重瞬时 +20%（10s 锚；wolf/tank 等比削减）
    const baseWeights = weightedWeightsForStage(this.mapId, stage);
    const weights =
      this.groups && accompanyBoostActive(this.groups)
        ? boostedWeights(baseWeights, true)
        : baseWeights;
    if (Number.isFinite(stage.tankGuaranteeEvery)) {
      this.tankGuaranteeAcc += dt;
    } else {
      this.tankGuaranteeAcc = 0;
    }

    if (this.retryCooldown > 0) {
      this.retryCooldown = Math.max(0, this.retryCooldown - dt);
      return; // 暂停期间预算继续累计，不丢弃
    }

    while (this.budgetAcc >= 1) {
      if (this.enemyPool.activeCount >= this.cfg.maxEnemies) {
        this.retryCooldown = SPAWNER.RETRY_PAUSE_SECONDS;
        return; // 达上限暂停 2s 后重试
      }
      const forceTank = tankGuaranteeDue(this.tankGuaranteeAcc, stage.tankGuaranteeEvery);
      // M2 收口：槽位抽签走该图覆盖权重；保底厚血强制 tank 槽（具体敌由地图槽位池决定）
      const slot: EnemySlot = forceTank ? 'tank' : (pickEnemyKind(weights, Math.random()) as EnemySlot);
      if (slot === 'tank') this.tankGuaranteeAcc = 0; // 自然/保底出厚血都重置累计
      if (forceTank && !this.pendingTank) {
        // TASK-39 E2 屠夫预警：保底厚血先「预约」——出生点血月印记，TANK_WARNING_SECONDS 后落地
        const pos = this.spawnRingPosition();
        const enemyId = pickEnemyIdForMap(this.mapId, weights, rForSlot('tank', weights), Math.random(), this.t);
        this.pendingTank = { x: pos.x, y: pos.y, remaining: SPAWNER.TANK_WARNING_SECONDS, enemyId };
        GameEvents.emit(GameEvent.TankWarning, { x: pos.x, y: pos.y });
      } else {
        this.spawnOne(slot, weights, this.t);
      }
      this.budgetAcc -= 1;
    }
  }

  /** TASK-39 E2：预约厚血倒计时归零 → 在标记位置落地（预约时已定敌种）+ 广播 tank:spawned（消费方销毁印记） */
  private tickPendingTank(dt: number): void {
    if (!this.pendingTank) return;
    this.pendingTank.remaining -= dt;
    if (this.pendingTank.remaining > 0) return;
    const p = this.pendingTank;
    this.pendingTank = null;
    this.spawnOneById(p.enemyId, p.x, p.y, this.t, true);
    GameEvents.emit(GameEvent.TankSpawned, { x: p.x, y: p.y });
  }

  /**
   * W-A/W-10 方阵组生成 tick：掷点（成组预扣）→ 分帧落地（≤5 只/帧，maxEnemies 节流不丢组）。
   * 预扣 = rollGroup 成本从 budgetAcc 扣除（计入总盘会计 ≤25%）；落地走 spawnOneById
   * （ENEMY_CONFIGS 单一数据源；方阵本体成员正常 XP，noXp 语义归 W-B 召唤侧）。
   */
  private tickGroups(dt: number): void {
    const groups = this.groups;
    if (!groups) return;
    // 预扣占比会计分母：budget 总盘同额上报
    reportGroupBudget(groups, budget(this.t) * dt);
    groups.boss4OnField = this.boss4OnField;
    // 掷点（60~90s 节奏位；命中 → 预约 + 预扣 + 阵纹预警事件）
    this.groupCtx.playerX = this.player.x;
    this.groupCtx.playerY = this.player.y;
    const roll = rollGroup(groups, this.groupCtx, Math.random);
    // QA-FIX（NV-INTEG-FIX ⑤）观测点：?qa=1 时上报每次掷点结果（含被拒原因），验证节奏修复
    this.groupRollLogger?.({
      time: groups.time,
      rolled: roll.rolled,
      reason: roll.reason,
      formationId: roll.pending?.formationId,
      cost: roll.cost,
    });
    if (roll.rolled && roll.cost > 0) {
      this.budgetAcc = Math.max(0, this.budgetAcc - roll.cost); // 成组预扣
      if (roll.pending) {
        GameEvents.emit(GameEvent.FormationWarning, {
          formationId: roll.pending.formationId,
          x: roll.pending.centerX,
          y: roll.pending.centerY,
        });
      }
    }
    // 分帧落地（canSpawn = 未达同屏上限；false 帧组不丢，顺延）
    const canSpawn = this.enemyPool.activeCount < this.cfg.maxEnemies;
    const events = stepGroupScheduler(groups, dt, canSpawn);
    for (const land of events.lands) {
      const enemy = this.spawnOneById(land.member.enemyId, land.member.x, land.member.y, this.t);
      // W-14：宝藏护卫横穿——落地成员登记移动器（escort 相位沿 path 40px/s 推进）
      const pendingTreasure = groups.pending.find((g) => g.groupId === land.groupId);
      const activeTreasure = groups.active.find((g) => g.groupId === land.groupId && g.formationId === 'f_treasure_guard');
      const tPath = pendingTreasure?.path ?? (activeTreasure ? { dirX: 0, dirY: 0, speed: 40, exitX: 0, exitY: 0 } : null);
      if (enemy && tPath) {
        this.treasureMovers.push({ enemy, dirX: tPath.dirX, dirY: tPath.dirY, speed: tPath.speed, exitX: tPath.exitX, exitY: tPath.exitY });
      }
      if (enemy && this.formationRuntime) {
        // W-B：组元数据写入 + 承伤路由（受击激活/仪式受击计数）
        enemy.setGroupMeta(land.groupId, land.member.role, land.member.slotIndex);
        this.formationRuntime.bindMember(land.groupId, land.member.slotIndex, enemy, () => {
          this.formationRuntime?.onMemberDamaged(land.groupId, land.member.slotIndex);
        });
      }
      if (land.isGroupStart && this.formationRuntime) {
        const formation = FORMATIONS[land.formationId];
        const states: GroupMemberState[] = [];
        let slot = 0;
        for (const m of formation.members) {
          for (let c = 0; c < m.count; c += 1) {
            states.push({ slotIndex: slot++, enemyId: m.enemyId, role: m.role, alive: true });
          }
        }
        this.formationRuntime.registerGroup(land.groupId, land.formationId as FormationId, states);
        GameEvents.emit(GameEvent.FormationLanded, {
          groupId: land.groupId,
          formationId: land.formationId,
          x: land.member.x,
          y: land.member.y,
        });
      }
    }
    // W-B：黑板状态机推进（仪式/唤尸/治疗/宝藏相位；事件副作用在下方消费）
    this.stepFormations(dt);
    // W-14：宝藏护卫横穿移动（escort 相位沿 path 推进；aggro/depart 交还默认追踪）
    this.stepTreasureMovement(dt);
  }

  /** W-14：横穿移动步进（escort 相位覆写速度 40px/s；到点移除） */
  private stepTreasureMovement(dt: number): void {
    void dt; // 速度直接覆写（帧率无关由 body velocity 承载）
    for (let i = this.treasureMovers.length - 1; i >= 0; i -= 1) {
      const m = this.treasureMovers[i]!;
      const board = this.formationRuntime?.boardFor(m.enemy.groupId ?? '');
      if (!m.enemy.active || (board && board.phase !== 'escort')) {
        // aggro/depart：交还默认追踪/离场（depart 语义由黑板注销）
        if (!m.enemy.active || board?.phase === 'depart') this.treasureMovers.splice(i, 1);
        continue;
      }
      const dx = m.exitX - m.enemy.x;
      const dy = m.exitY - m.enemy.y;
      if (Math.hypot(dx, dy) < 20) {
        // 到点离场（§③-5：到点/BOSS_TIME = 方阵离场，宝藏随队离场）
        m.enemy.kill();
        this.treasureMovers.splice(i, 1);
        continue;
      }
      const len = Math.hypot(m.dirX, m.dirY) || 1;
      (m.enemy.body as { setVelocity(x: number, y: number): void }).setVelocity(m.dirX / len * m.speed, m.dirY / len * m.speed);
    }
  }

  /** W-B 黑板推进与事件副作用消费（召唤生成 noXp 实体 / 治疗结算 / 解散清理） */
  private stepFormations(dt: number): void {
    const runtime = this.formationRuntime;
    if (!runtime || runtime.groupCount === 0) return;
    const now = this.time_now;
    for (const ev of runtime.stepAll(dt, now)) {
      switch (ev.type) {
        case 'summon': {
          // 组召唤实体：noXp=true（F-4 全量）；生成点 = 仪式主体位（缺省玩家环带）
          for (let i = 0; i < ev.count; i += 1) {
            const at = this.groupRitualistPosition(ev.groupId);
            const enemy = this.spawnOneById(ev.enemyId, at.x + (i - (ev.count - 1) / 2) * 24, at.y, this.t);
            if (!enemy) continue;
            enemy.noXp = true;
            enemy.setGroupMeta(ev.groupId, 'summon', -1);
            runtime.bindSummon(ev.groupId, enemy);
          }
          break;
        }
        case 'heal':
          runtime.healMember(ev.groupId, ev.targetSlotIndex, ev.amount);
          break;
        case 'ritual-start':
        case 'ritual-interrupted':
        case 'ritual-complete':
        case 'activated':
        case 'treasure-dropped': {
          // W-14：宝藏落地（MN-21：拾取 = 三选一 offer 直发 1 次，与卡 2 解耦）
          const pos = this.groupAlivePosition(ev.groupId);
          GameEvents.emit(GameEvent.TreasureDropped, { x: pos.x, y: pos.y });
          break;
        }
        case 'aggro':
        case 'depart':
        case 'dissolved':
          // 演出/宝藏实体/横穿 AI 消费点（W-13/W-14 内容批）；黑板状态已生效
          break;
      }
    }
  }

  /** 组内任一存活成员位置（宝藏落地锚；无 → 玩家环带点） */
  private groupAlivePosition(groupId: string): { x: number; y: number } {
    for (const m of this.treasureMovers) {
      if (m.enemy.groupId === groupId && m.enemy.active) return { x: m.enemy.x, y: m.enemy.y };
    }
    const pos = this.spawnRingPosition();
    return { x: pos.x, y: pos.y };
  }

  /** 仪式主体位置（召唤落点基准；未绑定时回退玩家环带点） */
  private groupRitualistPosition(groupId: string): { x: number; y: number } {
    const board = this.formationRuntime?.boardFor(groupId);
    if (board) {
      const idx = board.members.findIndex((s) => s.role === 'healer' || s.role === 'summoner');
      if (idx >= 0) {
        const entry = (this.formationRuntime as unknown as { groups: Map<string, { members: Array<{ x: number; y: number } | null> }> }).groups.get(groupId);
        const m = entry?.members[idx];
        if (m) return { x: m.x, y: m.y };
      }
    }
    const pos = this.spawnRingPosition();
    return { x: pos.x, y: pos.y };
  }

  /**
   * W-1 敌方技能召唤口（圣杯侍僧等；enemies/noxp 判定口径：敌方技能 → noXp=true）。
   * ownerTag = 召唤者实例标识（上限计数按同源扫描；召唤物死亡释放计数由召唤方维护）。
   */
  spawnRuntimeSummon(id: EnemyId, x: number, y: number, ownerTag: string | null): Enemy | null {
    const enemy = this.spawnOneById(id, x, y, this.t);
    if (!enemy) return null;
    enemy.noXp = true; // 敌方技能召唤 → noXp（spawner-v2 §③-7）
    if (ownerTag) enemy.setGroupMeta(ownerTag, 'summon', -1);
    return enemy;
  }

  /**
   * P0-6 月影幻影专用口（审查结论 §P0-6「幻影不要用行尸面板」）——面板在本口显式定义：
   * HP1（受 1 次伤即散）+ noXp（召唤零宝石路径）+ 接触伤按表（boss_4 skill1 phantom.damage = 25）；
   * 底层实体帧仅作视觉/池承载，面板数值（hp/damage/noXp）不继承行尸语义。
   */
  spawnPhantom(x: number, y: number, ownerTag: string | null, contactDamage: number): Enemy | null {
    const enemy = this.spawnOneById('enemy_g1_1', x, y, this.t);
    if (!enemy) return null;
    enemy.noXp = true;
    enemy.hp = 1;
    enemy.maxHp = 1;
    enemy.damage = contactDamage;
    if (ownerTag) enemy.setGroupMeta(ownerTag, 'summon', -1);
    return enemy;
  }

  /** W-13 阵纹预警查询（pending 组落点 + 渐亮进度 0~1；演出层每帧读取） */
  getPendingFormationWarnings(): Array<{ x: number; y: number; progress: number }> {
    if (!this.groups) return [];
    return this.groups.pending.map((g) => ({
      x: g.centerX,
      y: g.centerY,
      progress: 1 - Math.max(0, g.remaining) / 2.5,
    }));
  }

  /** W-B：组内成员/召唤物击杀路由（PlayScene enemy:killed payload 转发） */
  notifyGroupMemberKilled(payload: { groupId?: string | null; groupSlotIndex?: number }): void {
    if (!this.formationRuntime || !payload.groupId) return;
    if (payload.groupSlotIndex === -1) {
      this.formationRuntime.onSummonKilled(payload.groupId);
    } else if (typeof payload.groupSlotIndex === 'number') {
      this.formationRuntime.onMemberKilled(payload.groupId, payload.groupSlotIndex);
    }
  }

  /** 出生环带内随机位置（E3-S7：按地图双端覆盖 —— 教堂桌面 [500,800] / 移动 [420,680]；其余基准） */
  private spawnRingPosition(): { x: number; y: number } {
    const ring = spawnRingFor(this.mapId, this.cfg.isMobile);
    return spawnPosition(this.player.x, this.player.y, ring[0]!, ring[1]!, Math.random() * Math.PI * 2, Math.random());
  }

  /** M2 收口：槽位 → 地图槽位池具体敌（pickEnemyIdForMap）→ 环带位置出生 */
  private spawnOne(slot: EnemySlot, weights: StageWeights, elapsed?: number): void {
    const pos = this.spawnRingPosition();
    this.spawnOneAt(slot, weights, pos.x, pos.y, elapsed);
  }

  /** M2 收口：槽位 → 该图槽位池具体敌（rForSlot 定槽 + subR 选敌）→ spawnByConfig */
  private spawnOneAt(slot: EnemySlot, weights: StageWeights, x: number, y: number, elapsed?: number): void {
    const id = pickEnemyIdForMap(this.mapId, weights, rForSlot(slot, weights), Math.random(), elapsed);
    this.spawnOneById(id, x, y, elapsed, slot === 'tank');
  }

  /** M2 收口：按内容 ID 注册实体（ENEMY_CONFIGS 唯一数据源 + 狼穴移速加权）。
   *  W-B：返回实体供组元数据/召唤 noXp 置位（原调用方忽略返回值不受影响）。
   *  W-8 面板链：精英不吃 scale(t)（独立曲线），基础面板 HP × scale(t) × c 案联动 × 宽容（仅 HP）。 */
  private spawnOneById(id: EnemyId, x: number, y: number, elapsed?: number, allowAffix = false): Enemy | null {
    const cfg = ENEMY_CONFIGS[id];
    // 池契约 acquire(x,y,texture?,frame?) —— 显式 'characters' + 配置帧名（消除 __MISSING 警告）
    const enemy = this.enemyPool.acquire(x, y, 'characters', cfg.frame);
    if (!enemy) return null; // 已检查 activeCount，正常不会为 null
    let hpMult = 1;
    if (elapsed !== undefined && cfg.tier !== 'elite') {
      const scaled = applyPanelScale({
        baseHp: cfg.hp,
        t: elapsed,
        playerLevel: this.playerLevelProvider?.call(null) ?? undefined,
        caseLink: this.caseHpLink,
      });
      hpMult = scaled.hp / cfg.hp;
    }
    // W-6/MN-4 词缀：180s 起 tank 槽精英单词缀（掷骨者/忏悔者排除；方阵成员不走 allowAffix）
    let affix: AffixId | null = null;
    if (allowAffix && elapsed !== undefined && cfg.tier === 'elite') {
      affix = rollAffix(id, elapsed, Math.random());
      if (affix) {
        enemy.affix = affix;
        hpMult *= AFFIXES[affix].hpMult ?? 1;
      }
    }
    enemy.spawnByConfig(cfg, x, y, { hpMult });
    // 迅捷：移速/攻速倍率（在狼穴移速加权后应用）
    if (affix && AFFIXES[affix].speedMult) enemy.speed *= AFFIXES[affix].speedMult!;
    if (affix && AFFIXES[affix].attackIntervalMult) {
      enemy.attackInterval *= AFFIXES[affix].attackIntervalMult!;
      enemy.baseAttackInterval = enemy.attackInterval;
    }
    // 词缀 XP ×1.2 锚（❌ 额外道具——宝箱渠道唯一性）
    // E3-S7：狼穴敌潮移速 ×1.08（不含 Boss；gdd-maps §3.4 移速加权；其余图 ×1.0 恒等）
    enemy.speed = enemySpeedFor(this.mapId, cfg.speed);
    if (affix) enemy.xp = Math.round(enemy.xp * 1.2 * 100) / 100;
    return enemy;
  }
}
