/**
 * scenes/PlayScene.ts —— 唯一玩法场景（ADR-003：单场景 + 四态状态机）
 *
 * 职责（ARCH §3.1）：装配各系统（状态/输入/玩家/地图/敌人池/武器/生成器/相机/HUD/结算），
 * update 只做「按状态机转发」——非 RUNNING 第一行短路（ADR-003）。
 * 业务逻辑在各子模块；本场景只做装配、碰撞接线与事件订阅。
 *
 * E4 装配（收束与性能达标）：
 * - E4-S1 HUD：DOM 覆盖层（等级/经验/HP/武器槽/暂停键 + Boss 顶部血条），0 draw call
 * - E4-S2 Boss「血月尊者」：同池复用（weapons 自动可命中）、0.5s 霸体闪红、猩红金程序贴图
 * - E4-S3 20:00 收束：spawner.onBossTime → 清场 + Boss 出场；Boss 击杀→胜利终局、
 *   玩家死亡→失败终局（GAMEOVER 四态机）
 * - E4-S4 结算页：game:over { stats } → ResultsOverlay；再来一局/返回启动事件
 * - E4-S5 性能基准：`?bench=1` 60s 峰值压力（20× 时缩放 + 三武器全开 + 玩家免死），
 *   记录 avg/min fps、实体峰值、draw call 估算 → window.__BENCH_RESULT__
 */

import Phaser from 'phaser';
import { GameState, GamePhase } from '@/core/game-state';
import { resetGameEvents, GameEvents, GameEvent } from '@/core/events';
import { getRuntimeConfig, type RuntimeConfig } from '@/config/runtime-config';
import { WORLD, PLAYER, BOSS, type EnemyKindId } from '@/config/balance';
import { detectIsMobile } from '@/utils/device';
import { clampDelta } from '@/core/time';
import { collectSmokeResult, writeSmokeResult, SMOKE_FRAMES_COUNT } from '@/utils/smoke';
import { FpsMonitor, estimateDrawCalls, writeBenchResult } from '@/utils/perf';
import type { InputSource } from '@/input/input-source';
import { KeyboardInput } from '@/input/keyboard-input';
import { TouchInput } from '@/input/touch-input';
import { Player } from '@/player/player';
import { MapSystem, DECAL_COUNT_DESKTOP, DECAL_COUNT_MOBILE } from '@/map/map';
import { createArcadePool, type ArcadePoolLike } from '@/core/object-pools';
import { Enemy } from '@/enemies/enemy';
import { Boss } from '@/enemies/boss';
import { WeaponSystem } from '@/weapons/weapon-system';
import { EnemySpawner } from '@/spawner/enemy-spawner';
import { XpGem } from '@/xp/xp-gem';
import { XpManager } from '@/xp/xp-manager';
import { UpgradeState, rollThree, UPGRADE_BY_ID, type UpgradeOption } from '@/upgrade/upgrade-pool';
import { applyUpgrade, type UpgradeWriteTargets } from '@/upgrade/upgrade-apply';
import { LevelUpOverlay } from '@/ui/levelup-overlay';
import { Hud, createHud } from '@/ui/hud';
import { ResultsOverlay, createResultsOverlay } from '@/ui/results-overlay';
import { PauseOverlay, createPauseOverlay } from '@/ui/pause-overlay';
import { getOverlayHost } from '@/ui/overlay-host';
import { RunStats } from '@/stats/run-stats';
import { readRestartCount } from '@/stats/session-stats';
import { createProceduralTextures } from '@/fx/procedural-textures';
import { createCharacterAnims, tickPlayer as tickPlayerAnim, tickEnemy as tickEnemyAnim } from '@/fx/anim';
import { FxManager } from '@/fx/fx-manager';
import { AudioManager } from '@/audio/audio-manager';
import { bindAudioEvents } from '@/audio/audio-events';

/** E4-S5 基准：20× 时缩放 —— 60 真实秒 ≈ 1200 局时秒（20:00 收束覆盖） */
const BENCH_TIME_SCALE = 20;
const BENCH_DURATION_MS = 60_000;

interface EnemyKilledPayload {
  enemyType: string;
  xp: number;
  x: number;
  y: number;
}

interface UpgradeChosenPayload {
  optionId: number;
  index: number;
  dwellSeconds?: number;
}

export class PlayScene extends Phaser.Scene {
  private state!: GameState;
  private inputSource!: InputSource;
  private player!: Player;
  private mapSystem!: MapSystem;
  private cfg!: RuntimeConfig;
  private enemyPool!: ArcadePoolLike<Enemy>;
  private weaponSystem!: WeaponSystem;
  private spawner!: EnemySpawner;
  private gemPool!: ArcadePoolLike<XpGem>;
  private xp!: XpManager;
  private upgradeState!: UpgradeState;
  private upgradeTargets!: UpgradeWriteTargets;
  private overlay!: LevelUpOverlay;
  private hud!: Hud;
  private results!: ResultsOverlay;
  /** Phase 6 音频：暂停菜单（静音/减少闪烁/触觉共用入口，audio-bible §6） */
  private pauseOverlay!: PauseOverlay;
  /** Phase 6 音频：事件 → AudioManager 接线解绑（配合 resetGameEvents 纪律） */
  private unbindAudioEvents: (() => void) | null = null;
  private stats = new RunStats();
  /** 当前 Boss（20:00 出场；null = 未出场） */
  private boss: Boss | null = null;
  /** 最近一次三选一选项（纠结埋点判定用，E4-S1） */
  private lastOptions: UpgradeOption[] = [];
  /** TASK-28 特效管理器（粒子池 ≤ cfg.maxParticles + 血月/渐晕常驻） */
  private fx!: FxManager;
  /** TASK-28 冲击波涟漪上升沿检测（active 从 false→true 时触发一次涟漪） */
  private shockwaveWasActive = false;

  // 冒烟自检状态
  private smokeStartedAt = 0;
  private smokeFrames = 0;
  private smokeWritten = false;
  private readonly isSmoke: boolean;

  // E4-S5 性能基准状态
  private readonly isBench: boolean;
  private benchFps = new FpsMonitor();
  private benchStartedAt = 0;
  private benchDone = false;
  private benchPeakEnemies = 0;
  private benchPeakBullets = 0;

  constructor() {
    super('Play');
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    this.isSmoke = params.has('smoke');
    this.isBench = params.has('bench');
  }

  create(): void {
    this.cfg = getRuntimeConfig(detectIsMobile());
    createProceduralTextures(this, this.cfg);
    // TASK-28：角色 2 帧循环动画 + 特效管理器（粒子池/血月/渐晕），纹理就绪后装配
    createCharacterAnims(this);
    this.fx = new FxManager(this, this.cfg);

    this.state = new GameState();
    // 副作用唯一入口（ADR-003）：物理/Tween/输入冻结集中在 applyPhase
    this.state.onChange((phase) => this.applyPhase(phase));

    this.mapSystem = new MapSystem(
      this,
      undefined,
      this.cfg.isMobile ? DECAL_COUNT_MOBILE : DECAL_COUNT_DESKTOP,
    );
    this.player = new Player(this, PLAYER.SPAWN_X, PLAYER.SPAWN_Y);

    // 对象池：maxSize 读 RuntimeConfig（ARCH §3.3 / 性能预算 #1）；classType=Boss（含普通敌）
    this.enemyPool = createArcadePool(this, this.cfg, 'enemies', Boss);
    this.gemPool = createArcadePool(this, this.cfg, 'gems', XpGem);
    this.weaponSystem = new WeaponSystem(this, this.cfg, this.player, this.enemyPool, this.fx);
    this.spawner = new EnemySpawner(this.cfg, this.enemyPool, this.player);
    // E4-S3 收束：20:00 清场 + Boss 出场（预算恒 0 由 spawner 停止保证，S8 §⑥.3）
    this.spawner.onBossTime = () => {
      this.spawner.clearAll();
      this.spawnBoss();
    };

    // E3 成长闭环：经验 / 升级池 / 覆盖层
    this.xp = new XpManager(this.gemPool, this.player);
    this.upgradeState = new UpgradeState();
    this.upgradeTargets = {
      stats: this.player.stats,
      orbit: {
        unlock: () => this.weaponSystem.orbit.unlock(),
        addOrb: () => this.weaponSystem.orbit.addOrb(),
      },
      shockwave: {
        unlock: () => this.weaponSystem.shockwave.unlock(),
        setRadiusMultiplier: (m) => this.weaponSystem.shockwave.setRadiusMultiplier(m),
        setKnockback: (b) => this.weaponSystem.shockwave.setKnockback(b),
      },
      weapons: {
        setMissileSplit: (n) => this.weaponSystem.setMissileSplit(n),
        setMissilePierce: (n) => this.weaponSystem.setMissilePierce(n),
        setCooldownMultiplier: (m) => this.weaponSystem.setCooldownMultiplier(m),
      },
      xp: {
        setMagnetMultiplier: (m) => this.xp.setMagnetMultiplier(m),
      },
    };
    this.overlay = new LevelUpOverlay(getOverlayHost(), {});
    this.hud = createHud({ cfg: this.cfg, onPauseToggle: () => this.togglePause() });
    this.results = createResultsOverlay();

    // Phase 6 音频：新一局 BGM 心跳重置回 60 + 事件接线（audio-bible §4）
    const audio = AudioManager.getInstance();
    audio.startGameplay();
    this.pauseOverlay = createPauseOverlay({
      onResume: () => this.state.set(GamePhase.RUNNING),
      onMuteToggle: (next) => {
        audio.setMuted(next);
        this.refreshPauseOverlay();
      },
      onReduceFlashToggle: (next) => {
        audio.setReduceFlash(next);
        this.refreshPauseOverlay();
      },
      onHapticsToggle: (next) => {
        audio.setHaptics(next);
        this.refreshPauseOverlay();
      },
    });
    // 暂停菜单随状态机显示/隐藏（PAUSED 展示；其余隐藏）
    this.state.onChange((phase) => {
      if (phase === GamePhase.PAUSED) this.refreshPauseOverlay();
      else this.pauseOverlay.hide();
    });
    this.unbindAudioEvents = bindAudioEvents();

    // 碰撞接线
    // 1) 玩家-障碍 AABB（E1，S9）
    this.physics.add.collider(this.player, this.mapSystem.blockers);
    // 2) 敌人-障碍 AABB（复用 E1 障碍碰撞体系，E2-S5）
    this.physics.add.collider(this.enemyPool.group, this.mapSystem.blockers);
    // 3) 玩家-敌人接触伤害（overlap + attackTimer 间隔 + 玩家 0.5s 无敌帧，E8 §⑥.3；
    //    Boss 同池 → 自动纳入本 overlap，接触伤害 30 / 间隔 2.0s 生效）
    this.physics.add.overlap(this.player, this.enemyPool.group, this.onPlayerEnemyOverlap);

    // 事件订阅（ARCH §3.4：统一在 create 注册，shutdown 清空）
    GameEvents.on(GameEvent.PlayerDied, this.onPlayerDied, this);
    GameEvents.on(GameEvent.EnemyKilled, this.onEnemyKilled, this);
    GameEvents.on(GameEvent.LevelUp, this.onLevelUp, this);
    GameEvents.on(GameEvent.UpgradeChosen, this.onUpgradeChosen, this);
    GameEvents.on(GameEvent.BossDefeated, this.onBossDefeated, this);
    GameEvents.on(GameEvent.RestartRequested, this.onRestartRequested, this);
    GameEvents.on(GameEvent.ToMenuRequested, this.onToMenuRequested, this);
    // TASK-28：宝石拾取爆点（负载含 x/y，TASK-28 增补）
    GameEvents.on(GameEvent.GemCollected, this.onGemCollected, this);

    // 相机跟随 + 世界边界（S9）
    this.cameras.main.setBounds(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);

    // 输入：双端共用逻辑，仅适配器不同（ADR-002）
    this.inputSource = this.cfg.isMobile
      ? new TouchInput(this, this.cfg)
      : new KeyboardInput(this);
    this.inputSource.onPauseToggle(() => this.togglePause());

    // 防泄漏：场景关闭时清事件总线 + 输入
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    // E4-S5 基准模式：三武器全开 + 玩家免死 + 60s 峰值压力（生成器 20× 加速到 20:00 收束）
    if (this.isBench) {
      this.weaponSystem.orbit.unlock();
      this.weaponSystem.shockwave.unlock();
      this.player.stats.maxHp = Number.MAX_SAFE_INTEGER;
      this.player.stats.hp = Number.MAX_SAFE_INTEGER;
      this.benchStartedAt = performance.now();
      this.benchFps.reset();
    }

    if (this.isSmoke) {
      this.smokeStartedAt = performance.now();
    }
  }

  update(_time: number, delta: number): void {
    // E4-S5 基准：持续记录帧率（不受状态机短路影响），60s 后写结果一次
    if (this.isBench) {
      this.benchFps.record(delta);
      this.trackBenchPeaks();
      if (!this.benchDone && performance.now() - this.benchStartedAt >= BENCH_DURATION_MS) {
        this.benchDone = true;
        this.finishBench();
      }
    }

    // Phase 6 音频：心跳 BPM 消费 spawner.elapsedSeconds（bible §1/§3：暂停/选卡降 4dB、GAMEOVER 静默）
    // 放在 RUNNING 短路之前 —— 暂停/选卡期心跳以冻结 BPM 继续低音量，保持氛围
    AudioManager.getInstance().update(
      this.spawner.elapsedSeconds,
      this.playerHpFraction(),
      this.state.get(),
      delta / 1000,
    );

    if (this.state.get() !== GamePhase.RUNNING) return; // ADR-003 短路：非 RUNNING 不做战斗逻辑

    let dt = clampDelta(delta); // 秒制、防跳怪（ARCH §3.5 / 预算表 #10）
    if (this.isBench) dt *= BENCH_TIME_SCALE; // 基准：20× 时缩放模拟 20 分钟峰值
    const realDt = clampDelta(delta); // TASK-28：特效寿命用真实 dt（基准 20× 不加速视觉节奏）
    const now = this.time.now / 1000; // 秒时间戳（无敌帧/环绕球 CD/Boss 霸体）

    // 1) 玩家移动（velocity 驱动，fixedStep 60Hz）+ TASK-28 idle/移动动画
    const move = this.inputSource.getMove();
    this.player.update(move);
    tickPlayerAnim(this.player);
    // 2) 敌潮生成（budget(t) 秒制累加；20:00 自动触发 onBossTime）
    this.spawner.update(dt);
    // 3) 敌人 AI（朝玩家移动 + 攻击计时）+ TASK-28 敌型动画（普通 3 敌 idle/move，Boss 恒 idle）
    this.enemyPool.eachActive((e) => {
      e.updateMovement(dt, this.player);
      tickEnemyAnim(e);
    });
    // 4) 武器（飞弹/环绕球/冲击波全自动；Boss 霸体期内被 refreshEnemies 过滤）
    this.weaponSystem.update(dt, now);
    // 5) 经验宝石磁吸/拾取（E3-S1）
    this.xp.update(dt);
    // 6) 升级挂起消费：跨阈值 → emit level:up → onLevelUp（LEVEL_UP 流程）
    this.xp.consumePendingLevelUp();

    // —— TASK-28 特效层（全部带降级开关；粒子/拖尾均真实 dt）——
    this.fx.update(realDt);
    this.fx.tickMissileTrails(this.weaponSystem.missilePool, realDt);
    this.fx.tickOrbitRing(this.player, this.weaponSystem.orbit.unlocked, realDt);
    this.fx.tickOrbitTrails(this.weaponSystem.orbit, realDt); // TASK-36 环绕球尾迹
    this.fx.tickGemTrails(this.gemPool, this.player, this.xp.magnetRadius, realDt);
    // TASK-36 冲击波蓄力脉冲提示（最后 2s 呼吸）
    this.fx.tickShockwaveCharge(this.player, this.weaponSystem.shockwave.cooldownRemaining, realDt);
    const shockwaveActive = this.weaponSystem.shockwave.active;
    if (shockwaveActive && !this.shockwaveWasActive) {
      // 冲击波涟漪：释放瞬间沿当前半径（含升级 +50%）扩散一圈粒子
      this.fx.shockwaveRipple(this.player.x, this.player.y, this.weaponSystem.shockwave.radiusPx);
    }
    this.shockwaveWasActive = shockwaveActive;

    // E4-S2：Boss 顶部 UI 血条（每帧刷新；DOM HUD 只读事件流）
    if (this.boss?.active) {
      GameEvents.emit(GameEvent.BossHpChanged, { hp: this.boss.hp, maxHp: this.boss.maxHp });
    }

    if (this.isSmoke) this.tickSmoke();
  }

  /** 玩家-敌人接触：按敌人攻击间隔造成伤害，玩家 0.5s 无敌帧合并同帧多敌（E8 §⑥.3） */
  private onPlayerEnemyOverlap(
    _obj1:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
    obj2:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): void {
    const enemy = obj2 as Enemy;
    if (!enemy.active || enemy.attackTimer > 0) return;
    enemy.attackTimer = enemy.attackInterval;
    this.player.hurt(enemy.damage, this.time.now / 1000);
  }

  /** E4-S3 失败终局（玩家死亡） */
  private onPlayerDied(): void {
    this.finishGame(false);
  }

  /** E4-S3 胜利终局（Boss 击杀） */
  private onBossDefeated(): void {
    this.stats.recordBossDefeated(this.spawner.elapsedSeconds);
    this.finishGame(true);
  }

  /** 统一终局：停止生成/清武器/隐藏选卡 → 聚合统计 → GAMEOVER → 结算页（CM R5 / E4-S4） */
  private finishGame(victory: boolean): void {
    this.spawner.stop(); // S8 §⑥.2：立即停止生成
    this.weaponSystem.clearAll(); // W8 §⑥.5：清空子弹/环绕球 + 冲击波冷却重置
    this.fx.clearAll(); // TASK-28：清空粒子（结算页背景干净）
    this.overlay.hide(); // 防止结算时残留选卡覆盖层
    const result = this.stats.finish(victory, this.spawner.elapsedSeconds);
    // TASK-26 P0：本局 RunResult 挂全局，供导出脚本自动捕获（production/playtests/export-script.js）
    (globalThis as any).__BMV_LAST_RUN = result;
    this.state.set(GamePhase.GAMEOVER); // CM §5 联动
    // TASK-21 P1：game:over payload 增补 session 级累计重开次数（concept §9 重开率数据源）
    GameEvents.emit(GameEvent.GameOver, {
      stats: result,
      sessionRestartCount: readRestartCount(window.localStorage),
    });
  }

  /** E4-S3 20:00 Boss 出场：清场已完成，在玩家前方一段距离登场 + 0.5s 霸体闪红 */
  private spawnBoss(): void {
    const now = this.time.now / 1000;
    const boss = this.enemyPool.acquire(this.player.x, this.player.y, 'characters', 'enemy-boss') as Boss | null;
    if (!boss) return; // 池满兜底（清场后正常不会）
    const angle = Math.random() * Math.PI * 2;
    const bx = this.player.x + Math.cos(angle) * BOSS.SPAWN_DISTANCE;
    const by = this.player.y + Math.sin(angle) * BOSS.SPAWN_DISTANCE;
    boss.spawn('boss', bx, by);
    boss.beginGrace(now);
    this.boss = boss;
    // 出场 0.5s 霸体闪红（art-bible §4 / enemies §⑥.5）：0.12s×3 次闪烁后恢复
    this.tweens.add({
      targets: boss,
      alpha: 0.35,
      duration: 120,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (boss.active) boss.setAlpha(1);
      },
    });
    // TASK-28：Boss 出场特效 —— 猩红金冲击环 + 金点爆发 + 屏幕震动（移动端震动关闭）
    this.fx.bossEntrance(bx, by);
    if (this.cfg.screenShake) this.cameras.main.shake(150, 0.004);
    GameEvents.emit(GameEvent.BossSpawned, { bossHp: boss.hp });
    this.stats.recordBossSpawn(this.spawner.elapsedSeconds, boss.hp);
  }

  /**
   * enemy:killed 消费端（E3-S1 / E4 统计）：
   * - 击杀统计（E4 结算）
   * - 掉落经验宝石（僵尸 1 / 疾行 2 / 厚血 15 / Boss 100；Boss 不落地——终局流程接管）
   * - 吸血回血（upgrade-pool 第 8 项）
   */
  private onEnemyKilled(args: unknown): void {
    const payload = args as EnemyKilledPayload;
    this.stats.recordKill();
    // TASK-28：击杀溅射（颜色/形状按敌人类型分化）
    this.fx.deathBurst(payload.x, payload.y, payload.enemyType as EnemyKindId);
    if (payload.enemyType !== 'boss') {
      this.xp.dropGem(payload.xp, payload.x, payload.y);
    }
    if (this.player.stats.applyLifesteal()) {
      GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
    }
  }

  /** TASK-28：宝石拾取爆点（payload 由 xp-manager 补 x/y） */
  private onGemCollected(args: unknown): void {
    const p = args as { x?: number; y?: number };
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      this.fx.gemPickup(p.x, p.y);
    }
  }

  /** 经验达标 → 升级：属性成长 + 抽三选一 + LEVEL_UP 状态（CM §3.3） */
  private onLevelUp(args: unknown): void {
    const payload = args as { level: number; xpNeeded: number };
    this.player.stats.levelUp(); // E3-S2 自动成长（+8HP/+4%/每5级+4px/s）
    // E4-S1 HUD：升级回血（+8）后 HP 变化
    GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
    const options = rollThree(this.upgradeState);
    this.lastOptions = options;
    // E4-S1 升级时间戳埋点（后期升级间隔 / Lv47 预警数据源，供文策渊评审）
    this.stats.recordLevelUp(payload.level, this.spawner.elapsedSeconds);
    GameEvents.emit(GameEvent.UpgradeOffered, { options });
    // TASK-28：升级三选一出现 —— 玩家位置金+冷青爆发（进入 LEVEL_UP 前）
    this.fx.levelUpBurst(this.player.x, this.player.y);
    if (this.isBench) {
      // 基准模式：自动选第 1 张，跳过 LEVEL_UP 暂停（保持 20× 时缩放连续）
      this.onUpgradeChosen({ optionId: options[0]?.id ?? 10, index: 0, dwellSeconds: 0 });
      return;
    }
    this.overlay.show(options);
    this.state.set(GamePhase.LEVEL_UP); // 世界冻结（applyPhase）
  }

  /** 三选一完成 → 写回 → 回 RUNNING（CM §3.3）；有挂起升级则链式再升 */
  private onUpgradeChosen(args: unknown): void {
    const payload = args as UpgradeChosenPayload;
    const item = UPGRADE_BY_ID[payload.optionId];
    applyUpgrade(this.upgradeState, this.upgradeTargets, payload.optionId);
    this.upgradeState.lastPickId = payload.optionId; // 抽取权重 ×0.5（upgrade-pool §③）
    // E4-S1 埋点：Build 记录 + 纠结时刻（停留>3s 或选项强度接近）
    if (item) this.stats.recordUpgradeChosen(payload.optionId, item.name, this.spawner.elapsedSeconds);
    this.stats.recordHesitation(payload.dwellSeconds ?? 0, this.lastOptions);
    // E4-S1 HUD：武器解锁（1=守夜之环 / 2=月蚀脉冲）
    if (payload.optionId === 1 || payload.optionId === 2) {
      GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: payload.optionId, name: item?.name ?? '' });
    }
    // E4-S1 HUD：升级写回后 HP 变化（如 maxHp+20 同时回 20）
    GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
    this.state.set(GamePhase.RUNNING); // 恢复世界（applyPhase + 输入向量归零）
  }

  /** 暂停切换（Esc/P/移动暂停键；LEVEL_UP 期不响应，CM §5） */
  private togglePause(): void {
    if (this.isBench) return; // 基准模式不暂停
    const cur = this.state.get();
    if (cur === GamePhase.RUNNING) this.state.set(GamePhase.PAUSED);
    else if (cur === GamePhase.PAUSED) this.state.set(GamePhase.RUNNING);
  }

  private onRestartRequested(): void {
    this.scene.restart(); // CM R1/R2：重置本局回 RUNNING
  }

  private onToMenuRequested(): void {
    this.scene.start('Boot'); // ux-spec §1：返回启动（重载 BootScene → Play）
  }

  /** 状态副作用集中处理（ADR-003 / CM §5）；TASK-28：LEVEL_UP/PAUSED 同时暂停角色动画 */
  private applyPhase(phase: GamePhase): void {
    switch (phase) {
      case GamePhase.LEVEL_UP:
      case GamePhase.PAUSED:
        this.physics.pause();
        this.tweens.pauseAll();
        this.anims.pauseAll(); // TASK-28：动画随世界冻结
        this.inputSource.setEnabled(false); // 冻结移动输入 + 摇杆隐藏（CM M10）
        break;
      case GamePhase.RUNNING:
        this.physics.resume();
        this.tweens.resumeAll();
        this.anims.resumeAll(); // TASK-28：恢复动画
        this.inputSource.setEnabled(true); // 恢复；移动向量归零由适配器处理（ux-spec §3 ②④）
        break;
      case GamePhase.GAMEOVER:
        // 结算页由 ResultsOverlay 接管（E4-S4）；此处先冻结输入（ADR-003 / CM §5）
        this.inputSource.setEnabled(false);
        break;
    }
  }

  /** 暂停菜单刷新（PAUSED 进入/开关切换后同步 UI 状态） */
  private refreshPauseOverlay(): void {
    const audio = AudioManager.getInstance();
    this.pauseOverlay.show({
      muted: audio.isMuted(),
      reduceFlash: audio.isReduceFlash(),
      haptics: audio.isHaptics(),
    });
  }

  /** 玩家 HP 比例（0..1；基准模式免死 maxHp 极大 → 视为满血，避免濒死音频误触发） */
  private playerHpFraction(): number {
    const maxHp = this.player.stats.maxHp;
    if (!Number.isFinite(maxHp) || maxHp <= 0 || maxHp >= 1e9) return 1;
    return this.player.stats.hp / maxHp;
  }

  private onShutdown(): void {
    // Phase 6 音频：解绑事件 → 停音乐层（重开 scene.restart 由 startGameplay 恢复）
    this.unbindAudioEvents?.();
    this.unbindAudioEvents = null;
    AudioManager.getInstance().stopGameplay();
    this.pauseOverlay.destroy();
    resetGameEvents(); // 防泄漏（ARCH §3.4 约定）
    this.inputSource.destroy();
    this.overlay.destroy();
    this.hud.destroy();
    this.results.destroy();
  }

  /** 内嵌自检：跑 N 帧后写入结果一次（tests/smoke/smoke-embed.ts 判定规则） */
  private tickSmoke(): void {
    if (this.smokeWritten) return;
    this.smokeFrames += 1;
    if (this.smokeFrames >= SMOKE_FRAMES_COUNT) {
      this.smokeWritten = true;
      const result = collectSmokeResult(
        {
          sceneReady: this.state.get() === GamePhase.RUNNING && this.player.active,
          frame: this.smokeFrames,
        },
        this.smokeStartedAt,
      );
      writeSmokeResult(result);
    }
  }

  // —— E4-S5 性能基准 ——

  private trackBenchPeaks(): void {
    const enemies = this.enemyPool.activeCount;
    const bullets = this.weaponSystem.missilePool.activeCount;
    if (enemies > this.benchPeakEnemies) this.benchPeakEnemies = enemies;
    if (bullets > this.benchPeakBullets) this.benchPeakBullets = bullets;
  }

  /** 60s 峰值压力结束：聚合断言数据 → window.__BENCH_RESULT__（TASK-28：draw call 模型含 ambient/粒子组） */
  private finishBench(): void {
    const charactersActive =
      this.benchPeakEnemies +
      this.benchPeakBullets +
      (this.player.active ? 1 : 0) +
      this.weaponSystem.orbit.orbCount;
    const effectsActive = this.weaponSystem.shockwave.active ? 1 : 0;
    // TASK-28：ambient 组（血月/渐晕/贴花）常驻 1；粒子发射器计 extra pass（活跃时 1）
    const ambientActive = 1;
    const particlePasses = this.fx.activeCount > 0 ? 1 : 0;
    const drawCallEstimate = estimateDrawCalls(
      { characters: charactersActive, effects: effectsActive, ambient: ambientActive },
      particlePasses,
    );
    writeBenchResult({
      platform: this.cfg.isMobile ? 'mobile' : 'desktop',
      avgFps: this.benchFps.avgFps,
      minFps: this.benchFps.minFps,
      frames: this.benchFps.sampleCount,
      peakActiveEnemies: this.benchPeakEnemies,
      peakActiveBullets: this.benchPeakBullets,
      drawCallEstimate,
      simulatedGameSeconds: 1200,
    });
  }
}
