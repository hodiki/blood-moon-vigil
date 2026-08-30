/**
 * enemies/enemy.ts —— 敌人实体（ARCH §3.2/§3.3 / ADR-001 / E2-S2/E2-S5 / S4）
 *
 * 组件式数据字段（ADR-001）：面板值直接写在实体上，跨实体逻辑（移动/伤害）由
 * PlayScene / combat / weapons 统一驱动，实体只持有数据与「被打/死亡」响应。
 * - 普通 3 敌共用一池（classType+maxSize，ARCH §3.3）；Boss 由 E4-S2 单独接入。
 * - 描边纪律 RV-C1：普通敌绝不调用 postFX.addOutline（此处为硬编码纪律，
 *   400 个描边 pass 会直接爆 draw call 预算）。
 * - 敌人互不碰撞（允许重叠成尸潮，enemies §⑥.2）—— 由不设敌-敌 collider 保证。
 */

import Phaser from 'phaser';
import { enemyPanel, runtimeKindForEnemyId, type EnemyKindId } from '@/enemies/enemy-types';
import type { EnemyConfig, EnemyId } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { slowedSpeed } from '@/active-skill/active-skill-effects';
import { emptyStatusState, isStunned, slowMultiplier, clearStatuses, type StatusState } from '@/combat/status/status-engine';
import { SPECIAL_MARKERS } from '@/fx/fx-spec';
import type { Player } from '@/player/player';

/** 敌实体实例计数器（同源召唤计数键 sk_<instanceId>；池复用实例身份稳定） */
let ENEMY_INSTANCE_SEQ = 0;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  /** W-1：实例 ID（EnemyAiDirector 同源召唤计数键） */
  readonly instanceId = ++ENEMY_INSTANCE_SEQ;
  kind: EnemyKindId = 'zombie';
  /** 当前外观帧（M4：tick 按此播 idle/move，避免 15 敌被播回 wolf/zombie 剪影） */
  visualFrame = 'enemy-zombie';
  /** E3-S1 内容 ID（15 敌；旧 kind 三敌/Boss 为 null） */
  enemyId: EnemyId | null = null;
  maxHp = 0;
  hp = 0;
  speed = 0;
  damage = 0;
  xp = 0;
  /**
   * W-12 召唤物 noXp（gdd-spawner-v2 §③-7）：true = 击杀反馈链跳过宝石生成、
   * 不计入击杀 XP 统计口径（kills/xpGained 分账）。静态来源 = ENEMY_CONFIGS.noXp；
   * 动态召唤实体（Boss 技能/尸巫重召/血旗增援/苏生唤尸）由生成侧置 true。
   */
  noXp = false;
  attackInterval = 0;
  /** W-1 光环基准攻击间隔（ENEMY_CONFIGS 原值；光环 stacks 每帧重算 attackInterval） */
  baseAttackInterval = 0;
  /** 碰撞半径（面板值，供武器圆-圆命中检测） */
  radius = 14;
  /** 接触攻击计时（秒）：与玩家 overlap 且 ≤0 才造成伤害，命中后重置为攻击间隔 */
  attackTimer = 0;
  /** 环绕球同目标内置冷却截止（秒时间戳，weapons §⑥.4，Boss 也适用） */
  orbitHitCooldownUntil = 0;
  /** 霸体截止（秒时间戳）：期内不承伤（E4-S2 Boss 出场 0.5s 霸体；普通敌恒 0） */
  graceUntil = 0;
  /** M1b 主动技：眩晕截止（秒时间戳）：> now 期间冻结移动（updateMovement）且不造成接触伤害（contact） */
  stunnedUntil = 0;
  /** E4-S2 主动技「安魂曲」：减速截止（秒时间戳）+ 减速比例（40% = 0.4） */
  slowUntil = 0;
  slowPct = 0;
  /** E4-S2 主动技「血影突袭」：标记截止（秒时间戳）+ 标记武器伤害倍率（+20% = 1.2） */
  markUntil = 0;
  markDamageMult = 1;
  /** 入场时刻（秒）：冲锋周期 / 警告线对齐用 */
  spawnedAt = 0;
  /** Boss 出场姿态截止（秒）：期内切 `-entrance`，尊者无该帧则为 0 */
  entranceUntil = 0;
  /**
   * B2 CC 状态层载荷（gdd-status-effects；专武/衍生技/圣物施加走 status-engine.applyStatus，
   * 抗性按 ccProfile 解析）。旧 4 技散落字段（stunnedUntil/slowUntil/markUntil）保留并行至
   * 旧技能退役（B5 开局重写），消费侧两源合并：任一生效即冻结/减速。
   */
  cc: StatusState = emptyStatusState();
  /** CC 抗性画像（tier 由怪物域重做逐敌配置；普通敌缺省） */
  ccProfile?: import('@/combat/status/status-config').CcProfile;
  /**
   * B2 击杀回调挂点（可选）：专武行为按帧注入（左轮处决装填补弹/巨斧击杀回血等）。
   * 池复用重置清空，防跨局残留。
   */
  onKilled?: (target: Enemy) => void;
  /**
   * W-B/W-11 承伤回调挂点（可选）：方阵成员受击 → FormationRuntime 路由
   * （苏生受击激活 / 追猎仪式受击计数）。池复用重置清空。
   */
  onDamaged?: (target: Enemy) => void;
  // —— W-B 组黑板元数据（方阵成员/召唤物；普通敌 null/undefined）——
  /** 所属组 ID（spawnGroup 落地成员 / 组召唤实体） */
  groupId: string | null = null;
  /** 组角色槽（FormationRole；召唤物 = 'summon' 语义走 groupSlotIndex=-1） */
  groupRole: string | null = null;
  /** 组内槽位（-1 = 召唤物） */
  groupSlotIndex = -1;

  /** W-B：组元数据写入（spawnGroup 落地/召唤生成时调用；noXp 召唤侧同批置位） */
  setGroupMeta(groupId: string, role: string, slotIndex: number): void {
    this.groupId = groupId;
    this.groupRole = role;
    this.groupSlotIndex = slotIndex;
  }

  /**
   * 构造器：池契约 acquire(x,y,texture?,frame?) —— 由调用方显式传 'characters' + 帧名
   * （TASK-36：与 XpGem/Boss/Missile 对齐，杜绝 'enemy-zombie' 误入 texture 槽产生 __MISSING 警告；
   * 具体 kind 帧在 spawn() 内 setTexture 纠正，构造器帧仅占位）。
   */
  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'characters', frame ?? 'enemy-zombie');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  /** 从池取出：按面板重置字段并激活（ADR-001 组件式数据字段） */
  spawn(kind: EnemyKindId, x: number, y: number): void {
    const panel = enemyPanel(kind);
    this.kind = kind;
    this.enemyId = null;
    this.maxHp = panel.hp;
    this.hp = panel.hp;
    this.speed = panel.speed;
    this.damage = panel.damage;
    this.xp = panel.xp;
    this.attackInterval = panel.attackInterval;
    this.radius = panel.radius;
    this.noXp = false; // noXp 属内容配置/动态召唤语义，legacy 面板路径恒 false
    this.attackTimer = 0;
    this.orbitHitCooldownUntil = 0;
    this.graceUntil = 0; // 霸体由 Boss.beginGrace 显式设置；普通敌恒 0
    this.stunnedUntil = 0; // M1b 主动技：眩晕截止重置（重开/复用不残留）
    this.slowUntil = 0; // E4-S2 安魂曲：减速重置
    this.slowPct = 0;
    this.markUntil = 0; // E4-S2 血影突袭：标记重置
    this.markDamageMult = 1;
    clearStatuses(this.cc); // B2 状态层载荷重置（池复用不残留）
    this.onKilled = undefined;
    this.onDamaged = undefined;
    this.groupId = null;
    this.groupRole = null;
    this.groupSlotIndex = -1;
    this.ccProfile = undefined;
    this.visualFrame = `enemy-${kind}`;
    this.setTexture('characters', this.visualFrame);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.resetVisualState();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(panel.radius);
    body.reset(x, y);
  }

  /**
   * E3-S1 从池取出：按 EnemyConfig（15 敌）注册 —— 面板/移速/攻击间隔/碰撞半径/经验全走配置。
   * 帧名取 config.frame（如 enemy-hound/enemy-wraith），池分类由 runtimeKindForEnemyId 派生
   * （死亡溅射/剪影颜色等 4 类消费）。特殊行为运行时由 enemy-behaviors.ts 纯函数驱动。
   */
  spawnByConfig(
    cfg: EnemyConfig,
    x: number,
    y: number,
    opts?: { hpMult?: number },
  ): void {
    this.enemyId = cfg.id;
    this.kind = runtimeKindForEnemyId(cfg.id);
    // W-8 面板链：HP = 基础面板 × hpMult（scale(t)×c 案联动×宽容，由生成侧组装；
    // 仅 HP——伤害/移速/攻击间隔不缩放 MN-2）；缺省 1 = 无缩放（测试确定性路径）
    const hpMult = opts?.hpMult ?? 1;
    this.maxHp = Math.max(1, Math.round(cfg.hp * hpMult));
    this.hp = this.maxHp;
    this.baseAttackInterval = cfg.attackInterval; // W-1 光环攻速基准（每帧重算用）
    this.speed = cfg.speed;
    this.damage = cfg.damage;
    this.xp = cfg.xp;
    this.attackInterval = cfg.attackInterval;
    this.radius = cfg.radius;
    // W-12：静态 noXp 随配置（敌技能召唤整档标记）；动态召唤实体由生成侧覆写为 true
    this.noXp = cfg.noXp === true;
    this.attackTimer = 0;
    this.orbitHitCooldownUntil = 0;
    this.graceUntil = 0;
    this.stunnedUntil = 0;
    this.slowUntil = 0; // E4-S2 安魂曲：减速重置
    this.slowPct = 0;
    this.markUntil = 0; // E4-S2 血影突袭：标记重置
    this.markDamageMult = 1;
    clearStatuses(this.cc); // B2 状态层载荷重置
    this.onKilled = undefined;
    this.onDamaged = undefined;
    this.groupId = null;
    this.groupRole = null;
    this.groupSlotIndex = -1;
    // W-5/MN-9：逐敌覆写优先（石甲狼减速 ×0.5）；否则按 tier 派生（精英 ×0.5 / 普通全效）
    this.ccProfile = cfg.ccProfile ?? (cfg.tier === 'elite' ? { tier: 'elite' } : undefined);
    this.visualFrame = cfg.frame;
    this.setTexture('characters', cfg.frame);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.resetVisualState();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(cfg.radius);
    body.reset(x, y);
  }

  /**
   * W-3/W-8 收口：Boss 面板单源化（BOSSES 表；legacy spawn('boss')/ENEMIES.boss 退役）。
   * Boss 独立曲线：不吃 scale(t)/c 案联动（difficulty-v3 §5.1，MD-4 65~85s 反推锚）；
   * ccProfile = BossConfig.ccProfile ?? { tier:'boss' }（MN-9 覆写：芬里厄减速 ×0.5 / 化身易伤免疫）。
   */
  spawnByBossConfig(cfg: import('@/config/balance').BossConfig, x: number, y: number): void {
    this.enemyId = null;
    this.kind = 'boss';
    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    this.speed = cfg.speed;
    this.damage = cfg.damage;
    this.xp = cfg.xp;
    this.attackInterval = cfg.attackInterval;
    this.baseAttackInterval = cfg.attackInterval;
    this.radius = cfg.radius;
    this.noXp = false;
    this.attackTimer = 0;
    this.orbitHitCooldownUntil = 0;
    this.graceUntil = 0; // 出场霸体由 beginGrace 显式设置
    this.stunnedUntil = 0;
    this.slowUntil = 0;
    this.slowPct = 0;
    this.markUntil = 0;
    this.markDamageMult = 1;
    clearStatuses(this.cc);
    this.onKilled = undefined;
    this.onDamaged = undefined;
    this.groupId = null;
    this.groupRole = null;
    this.groupSlotIndex = -1;
    this.ccProfile = cfg.ccProfile ?? { tier: 'boss' };
    this.visualFrame = cfg.frame;
    this.setTexture('characters', cfg.frame);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.resetVisualState();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(cfg.radius);
    body.reset(x, y);
  }

  /** AI 移动：向玩家直线移动（各自移速，enemies §③ / E8-2）；帧率无关由 velocity 驱动。
   *  M1b 主动技：`now` 秒时间戳（scene.time.now/1000）；眩晕期内冻结（速度 0、攻击计时不递减，
   *  眩晕结束自然恢复移动与攻击节奏）。缺省 now=0 → 永不眩晕（兼容旧调用方）。 */
  updateMovement(dt: number, player: Player, now = 0): void {
    // B2 状态层并线：旧散落字段（stunnedUntil）与状态引擎（cc.stun）任一生效即冻结
    if (this.stunnedUntil > now || isStunned(this.cc, now)) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      return; // 眩晕：冻结移动与攻击计时（contact.ts 同步阻止接触伤害）
    }
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.0001) {
      body.setVelocity(0, 0);
      return;
    }
    // 减速并线：旧 slowUntil/slowPct 与状态引擎 cc.slow 取更慢者（任一生效即减速）
    const legacySlow = slowedSpeed(this.speed, this, now);
    const statusSlow = this.speed * slowMultiplier(this.cc, now);
    const currentSpeed = Math.min(legacySlow, statusSlow);
    body.setVelocity((dx / len) * currentSpeed, (dy / len) * currentSpeed);
  }

  /** 池复用时重置半透明 / 出场姿态，避免亡魂 α 或 Boss entrance 残留 */
  private resetVisualState(): void {
    this.spawnedAt = this.scene.time.now / 1000;
    this.entranceUntil = 0;
    this.setAlpha(this.enemyId === 'enemy_g1_4' ? SPECIAL_MARKERS.phase.bodyAlpha : 1);
  }

  /**
   * 死亡：回收回池 + 事件分发（E2-S6 / ARCH §3.4）。
   * payload { enemyType, xp, x, y } —— E3 经验宝石 / E4 击杀统计 / 吸血 消费。
   */
  kill(): void {
    if (!this.active) return;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
    GameEvents.emit(GameEvent.EnemyKilled, {
      enemyType: this.kind,
      // E4-S6 图鉴数据层：15 敌/Boss 内容 ID（旧 kind 三敌为 null，图鉴只记录内容 ID 击杀）
      enemyId: this.enemyId,
      xp: this.xp,
      // W-12：击杀反馈链挂点——PlayScene 宝石生成按 noXp 跳过（召唤物零宝石路径）
      noXp: this.noXp,
      // W-B/W-11：组黑板路由（成员击杀 → 成员槽置亡/召唤物计数释放）
      groupId: this.groupId,
      groupRole: this.groupRole,
      groupSlotIndex: this.groupSlotIndex,
      x: this.x,
      y: this.y,
    });
  }
}
