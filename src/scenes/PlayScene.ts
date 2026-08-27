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
 * - E4-S3 6:00 收束：spawner.onBossTime → 清场 + Boss 出场；Boss 击杀→胜利终局、
 *   玩家死亡→失败终局（GAMEOVER 四态机）
 * - E4-S4 结算页：game:over { stats } → ResultsOverlay；再来一局/返回启动事件
 * - E4-S5 性能基准：`?bench=1` 36s 峰值压力（20× 时缩放 + 三武器全开 + 玩家免死），
 *   记录 avg/min fps、实体峰值、draw call 估算 → window.__BENCH_RESULT__
 */

import Phaser from 'phaser';
import { GameState, GamePhase } from '@/core/game-state';
import { resetGameEvents, GameEvents, GameEvent } from '@/core/events';
import { getRuntimeConfig, type RuntimeConfig } from '@/config/runtime-config';
import { PLAYER, BOSS, BOSSES, PALETTE, ACTIVE_SKILL, ACTIVE_SKILL_RULES, HEROES, ACTIVE_SKILLS, MAP_CONFIGS, EVOLUTIONS, WEAPON_CONFIGS, FX, type EnemyKindId, type HeroId, type MapId, type WeaponId, type UpgradeId, type EnemyId, type BossId } from '@/config/balance';
import { getSelectedHero, getSelectedMap } from '@/config/session-selection';
import { detectIsMobile } from '@/utils/device';
import { clampDelta } from '@/core/time';
import { clampToWorld, hexToRgbInt, type Vec2 } from '@/utils/math';
import { collectSmokeResult, writeSmokeResult, SMOKE_FRAMES_COUNT } from '@/utils/smoke';
import { FpsMonitor, estimateDrawCalls, writeBenchResult } from '@/utils/perf';
import type { InputSource } from '@/input/input-source';
import { KeyboardInput } from '@/input/keyboard-input';
import { TouchInput } from '@/input/touch-input';
import { ActiveSkill } from '@/active-skill/active-skill';
import { stunEnemiesInRadius } from '@/active-skill/active-skill-math';
import {
  applySlowInRadius,
  contactAuraTick,
  dashDirection,
  dashStep,
  damageAndMarkDash,
  healFractionOfMax,
  rageMultiplierAdd,
  rageMoveSpeedPct,
  RageBuff,
  type DashEnemyLike,
} from '@/active-skill/active-skill-effects';
import { createActiveSkillRuntime, ActiveSkillRuntimeConfig } from '@/active-skill/active-skill-runtime';
import { Player } from '@/player/player';
import { MapSystem, DECAL_COUNT_DESKTOP, DECAL_COUNT_MOBILE } from '@/map/map';
import { createArcadePool, type ArcadePoolLike } from '@/core/object-pools';
import { Enemy } from '@/enemies/enemy';
import { Boss } from '@/enemies/boss';
import { WeaponSystem } from '@/weapons/weapon-system';
import { EnemySpawner } from '@/spawner/enemy-spawner';
import { XpGem } from '@/xp/xp-gem';
import { XpManager } from '@/xp/xp-manager';
import { HealPickup } from '@/xp/heal-pickup';
import { HealManager, shouldDropHeal } from '@/xp/heal-manager';
import { UpgradeState, UPGRADE_BY_ID, type UpgradeOption } from '@/upgrade/upgrade-pool';
import { applyUpgrade, type UpgradeWriteTargets } from '@/upgrade/upgrade-apply';
import { rollThreeV2, poolItemById, type UpgradeV2Option, type UpgradePoolV2Context } from '@/upgrade/upgrade-pool-v2';
import { applyUpgradeByIdV2, type UpgradeV2WriteTargets } from '@/upgrade/upgrade-apply-v2';
import { playerEnemyContact, type ContactEnemy } from '@/combat/contact';
import { LevelUpOverlay } from '@/ui/levelup-overlay';
import { Hud, createHud } from '@/ui/hud';
import { ResultsOverlay, createResultsOverlay } from '@/ui/results-overlay';
import { PauseOverlay, createPauseOverlay } from '@/ui/pause-overlay';
import { getOverlayHost } from '@/ui/overlay-host';
import { RunStats } from '@/stats/run-stats';
import { readRestartCount } from '@/stats/session-stats';
import { CodexTracker, MOON_AVATAR_ENTRY_ID, eventEntriesForMapCleared } from '@/codex/codex';
import { computeMeritApplication, calculateMeritPoints, type MeritAppliedResult } from '@/stats/merit';
import { loadSave, writeSave, recordMapCleared, type SaveData } from '@/stats/save';
import { createProceduralTextures } from '@/fx/procedural-textures';
import { sceneHasFrame } from '@/fx/external-atlas';
import { createCharacterAnims, tickPlayer as tickPlayerAnim, tickEnemy as tickEnemyAnim, hasCharacterFrame } from '@/fx/anim';
import { FxManager } from '@/fx/fx-manager';
import { StatusMarkerLayer } from '@/fx/status-markers';
import { SKILL_RING_FRAMES } from '@/fx/fx-spec';
import { bossEntranceFrameName } from '@/fx/skill-pose';
import { AudioManager } from '@/audio/audio-manager';
import { bindAudioEvents } from '@/audio/audio-events';
import { NarrativeDispatcher } from '@/narratives/narrative-dispatcher';
import { DEFAULT_NARRATIVE_BINDINGS } from '@/narratives/narrative-bindings';
import { SHOW_OPEN_BANNER, prologueScreensForMap } from '@/narratives/narratives';
import { PrologueOverlay, createPrologueOverlay } from '@/ui/prologue-overlay';

/**
 * E4-S5 基准：20× 时缩放 —— 36 真实秒 ≈ 720 局时秒（2 局；6:00 Boss 收束覆盖）。
 * TASK-31 收尾（rhythm-pace-adj §6）：BENCH_DURATION_MS 60_000→36_000，
 * 36s = 完整 1 局 + Boss 战全程 + 第 2 局爬升，峰值段（300–360 局时 = 15–18 真实秒）有 18s 持续采样。
 */
const BENCH_TIME_SCALE = 20;
const BENCH_DURATION_MS = 36_000;

interface EnemyKilledPayload {
  enemyType: string;
  /** E4-S6 图鉴：内容 ID（15 敌/Boss；旧 kind 三敌 null） */
  enemyId?: EnemyId | BossId | null;
  xp: number;
  x: number;
  y: number;
}

interface UpgradeChosenPayload {
  /** E4-S4：v2 池为内容 ID 字符串（up_/key_/evo_）；legacy 为数字 id */
  optionId: number | string;
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
  /** M3 治疗道具：池 + 掉落/拾取管理器（content-design-outline §7；随修女被动落地） */
  private healPool!: ArcadePoolLike<HealPickup>;
  private healManager!: HealManager;
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
  /** 当前 Boss（6:00 出场；null = 未出场） */
  private boss: Boss | null = null;
  /** 最近一次三选一选项（纠结埋点判定用，E4-S1） */
  private lastOptions: UpgradeOption[] = [];
  /** TASK-28 特效管理器（粒子池 ≤ cfg.maxParticles + 血月/渐晕常驻） */
  private fx!: FxManager;
  /** 特殊行为标记（尸巫光环 / 猎手警告线 / 侍僧符文 / 状态小点） */
  private markers!: StatusMarkerLayer;
  /** TASK-28 冲击波涟漪上升沿检测（active 从 false→true 时触发一次涟漪） */
  private shockwaveWasActive = false;
  /** TASK-39 E2 屠夫预警：血月印记精灵（保底厚血预约出生时显示，落地时销毁；null = 无） */
  private tankMark: Phaser.GameObjects.Image | null = null;
  /** M1b 主动技「提灯闪耀」：CD/防抖/计数（效果结算在 tryCastActiveSkill） */
  private activeSkill!: ActiveSkill;
  /** E4-S1 当前角色（开局从 session-selection 读取） */
  private heroId: HeroId = 'hero_edmund';
  /** E4-S1 当前地图（开局从 session-selection 读取；相机/玩家 clamp 按 MAP_CONFIGS 尺寸） */
  private mapId: MapId = 'map_graveyard';
  /** E4-S2 血影突袭冲刺状态（null = 非冲刺；dir=冲刺方向、remaining=剩余距离） */
  private dash: { dir: Vec2; remaining: number } | null = null;
  /** 冲刺轨迹节流累计 s */
  private dashTrailAccum = 0;
  /** 安魂曲第二环 delayedCall（场景销毁时移除） */
  private requiemRingTimer: Phaser.Time.TimerEvent | null = null;
  /** E4-S2 血月狂化 buff（8s 窗口；玩家死亡/重开清空） */
  private rage = new RageBuff();
  /** E4-S3 主动技运行时配置（升级分支改写；效果结算统一读本类） */
  private skillRuntime!: ActiveSkillRuntimeConfig;
  /** E4-S4 v2 升级池写回目标（PlayScene 装配） */
  private upgradeV2Targets!: UpgradeV2WriteTargets;
  /** E4-S5 已拥有武器 id（初始武器 + 解锁；v2 抽取上下文） */
  private ownedWeaponIds: WeaponId[] = [];
  /** E4-S4 最近一次 v2 三选一选项（纠结埋点） */
  private lastOptionsV2: UpgradeV2Option[] = [];
  /** E4-S6 图鉴追踪器（单会话内存态；持久化走 save） */
  private codex = new CodexTracker();
  /** E4-S7/S8 局外存档（读入 create；局终写回） */
  private saveData: SaveData | null = null;
  /** E4-S7 纯局内模式（关闭全部功绩加成） */
  private pureInGame = false;
  /** E4-S7 本局首杀 Boss/精英数（功绩 +2/只） */
  private firstBossKillsThisRun = 0;
  /** E4-S7 本局血月化身击杀（功绩 +5） */
  private avatarKillsThisRun = 0;
  /** 批次 4：血月化身稀有宝箱（本局最多 1） */
  private rareChest: Phaser.Physics.Arcade.Image | null = null;
  /** M3 轻叙事：局内事件 → 文本表 → DOM 覆盖层（narrative-framework §5/§7；宿主 #ui-overlay） */
  private narratives!: NarrativeDispatcher;
  private unbindNarratives: (() => void) | null = null;
  /** M3 图鉴 toast：局内首次解锁任一条目 → 同帧合并 emit 1 条（narratives-spec §6 n_toast_codex） */
  private codexToastPending = false;
  /** M3 序章屏（narratives-spec §3）：点击开始后进入战斗前展示（PROLOGUE 态；通用 + 地图序章） */
  private prologue!: PrologueOverlay;
  /** M3 结算日志条：本局开局图鉴已解锁数（结算 delta = 局终 snapshot − 开局数，codex-ui-spec §6） */
  private codexUnlockedAtStart = 0;

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
    this.markers = new StatusMarkerLayer(this, this.cfg);

    // E4-S1/S9：开局角色 + 地图从 session-selection 读取（解锁门禁由保存数据层校验，
    // PlayScene 兜底非法选择回退默认，见 session-selection.selectHeroSafely/selectMapSafely）
    this.heroId = getSelectedHero();
    this.mapId = getSelectedMap();
    // E4-S6/S7/S8：加载局外存档（图鉴/功绩/通关；多端独立）+ 装配图鉴追踪器 + 纯局内模式
    this.saveData = loadSave(window.localStorage, this.cfg.isMobile ? 'mobile' : 'desktop');
    this.codex = new CodexTracker(this.saveData.codexUnlocked);
    this.pureInGame = this.saveData.pureInGame;
    // M3 结算日志条：记录开局已解锁数（局终 delta = snapshot − 开局数，codex-ui-spec §6）
    this.codexUnlockedAtStart = this.saveData.codexUnlocked.length;

    // M3 序章屏：初始相位 PROLOGUE（世界冻结、不开始计时/生成器；update() RUNNING 短路保证）
    this.state = new GameState(GamePhase.PROLOGUE);
    // 副作用唯一入口（ADR-003）：物理/Tween/输入冻结集中在 applyPhase
    this.state.onChange((phase) => this.applyPhase(phase));
    // 初始相位副作用立即生效（PROLOGUE 冻结世界：物理/Tween/动画/输入；
    // create 内 inputSource 尚未装配，applyPhase 内对未初始化依赖做守卫）
    this.applyPhase(this.state.get());

    const mapCfg = MAP_CONFIGS[this.mapId];
    this.mapSystem = new MapSystem(
      this,
      undefined,
      this.cfg.isMobile ? DECAL_COUNT_MOBILE : DECAL_COUNT_DESKTOP,
      this.mapId,
    );
    this.player = new Player(this, mapCfg.width / 2, mapCfg.height / 2, HEROES[this.heroId], this.mapId);

    // 对象池：maxSize 读 RuntimeConfig（ARCH §3.3 / 性能预算 #1）；classType=Boss（含普通敌）
    this.enemyPool = createArcadePool(this, this.cfg, 'enemies', Boss);
    this.gemPool = createArcadePool(this, this.cfg, 'gems', XpGem);
    // M3 治疗道具池（merit-ui-spec §11：精英/Boss 保底掉落；数值改 balance.HEAL 常量，管线零改动）
    this.healPool = createArcadePool(this, this.cfg, 'heals', HealPickup);
    this.healManager = new HealManager(this.healPool, this.player, this.player.stats);
    this.weaponSystem = new WeaponSystem(this, this.cfg, this.player, this.enemyPool, this.fx);
    // E4-S1 角色初始武器门控：仅角色初始武器启用（守夜人=飞弹 / 血猎手=银针 / 修女=火铳 / 狼裔=猎犬）
    this.weaponSystem.applyInitialWeapon(HEROES[this.heroId].initialWeapon);
    // E4-S5 已拥有武器集（初始武器 + 后续解锁；v2 抽取上下文 / 新武器解锁变体）
    this.ownedWeaponIds = [HEROES[this.heroId].initialWeapon];
    // E4-S6 初始武器 → 图鉴 obtain 记录（首获幂等）
    this.codex.recordObtain(HEROES[this.heroId].initialWeapon);
    // E4-S7 功绩加成开局生效（纯局内模式关闭全部；数据层记录 applied 状态）
    const merit = computeMeritApplication(this.saveData.meritEquipped, this.pureInGame, HEROES[this.heroId]);
    this.applyMeritToStats(merit);
    // M2 收口：生成器按当前地图装配（槽位池/权重覆盖/移速加权，E3-S7）
    this.spawner = new EnemySpawner(this.cfg, this.enemyPool, this.player, this.mapId);
    // E4-S3 收束：6:00 清场 + Boss 出场（预算恒 0 由 spawner 停止保证，S8 §⑥.3）
    this.spawner.onBossTime = () => {
      this.spawner.clearAll();
      this.spawnBoss();
    };

    // E3 成长闭环：经验 / 升级池 / 覆盖层
    this.xp = new XpManager(this.gemPool, this.player);
    // E4-S1 守夜人「提灯圣辉」：经验磁力 +20px（专属被动；非守夜人为 0）
    this.xp.setMagnetRadiusBonus(this.player.stats.magnetRadiusBonus);
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
        // E2-S8：武器类强化写回（12 分支派生重算，WeaponSystem 广播到注册表）
        setClassUpgrade: (stacks) => this.weaponSystem.applyClassUpgrade(stacks),
      },
      xp: {
        setMagnetMultiplier: (m) => this.xp.setMagnetMultiplier(m),
      },
    };
    // E4-S4：v2 升级池写回目标（40 项内容 ID 全量；E4-S5 解锁 / E4-S3 主动技强化 / E4-S6 图鉴挂钩）
    this.upgradeV2Targets = {
      stats: this.player.stats,
      weapons: {
        setMissileSplit: (n) => this.weaponSystem.setMissileSplit(n),
        setMissilePierce: (n) => this.weaponSystem.setMissilePierce(n),
        setCooldownMultiplier: (m) => this.weaponSystem.setCooldownMultiplier(m),
        setClassUpgrade: (s) => this.weaponSystem.applyClassUpgrade(s),
        setKeyPassives: (k) => this.weaponSystem.setKeyPassives(k),
        unlockWeapon: (w) => this.onWeaponUnlocked(w),
        // M3-DESIGN-1 up_g_2 专精疾射：目标武器独立冷却乘区广播
        setFocusedCooldown: (weaponIds, mult) => this.weaponSystem.setFocusedCooldown(weaponIds, mult),
      },
      xp: {
        setMagnetMultiplier: (m) => this.xp.setMagnetMultiplier(m),
        setMagnetRadiusBonus: (b) => this.xp.setMagnetRadiusBonus(b),
        addPickupRadiusBonus: (b) => this.xp.addPickupRadiusBonus(b),
      },
      activeSkill: {
        applyActiveSkillUpgrade: (upId) => this.onActiveSkillUpgrade(upId),
      },
    };
    this.overlay = new LevelUpOverlay(getOverlayHost(), {});
    // E4-S2 主动技：按角色装配（CD/充能段数/充能间隔；效果结算见 tryCastActiveSkill）
    this.skillRuntime = createActiveSkillRuntime(this.heroId);
    this.activeSkill = new ActiveSkill(
      this.skillRuntime.cd,
      ACTIVE_SKILL.INPUT_LOCK_SECONDS, // 释放后 100ms 输入锁定防抖（pillars §6.7-3，全角色统一）
      this.skillRuntime.charges ?? 1,
      this.skillRuntime.chargeInterval ?? 0,
    );
    this.hud = createHud({
      cfg: this.cfg,
      skillName: this.skillRuntime.name ?? ACTIVE_SKILLS[this.heroId].name,
      skillIconFrame: `skill-${this.heroId.replace('hero_', '')}`,
      onPauseToggle: () => this.togglePause(),
      onActiveSkill: () => this.tryCastActiveSkill(), // 移动端技能按钮 → 同一释放入口
    });
    // E4-S2 充能制：技能按钮初始充能数角标（血猎手 2 段；其余隐藏）
    if (this.cfg.isMobile) this.hud.setSkillCharges(this.activeSkill.chargeCount);
    // M1b 主动技：非 RUNNING 态技能按钮隐藏（CM §5 状态联动；桌面无按钮 no-op）
    this.state.onChange((phase) => this.hud.setSkillVisible(phase === GamePhase.RUNNING));
    this.results = createResultsOverlay();

    // M3 轻叙事：装配分发器 + 默认事件绑定（spec §6/§7 局内触发）
    this.narratives = new NarrativeDispatcher({
      host: getOverlayHost(),
      isMobile: () => this.cfg.isMobile,
    });
    this.narratives.resetRunState();
    this.unbindNarratives = this.narratives.bind(GameEvents, DEFAULT_NARRATIVE_BINDINGS);
    // M3 序章屏（spec §3）：通用序章（n_prologue_common）+ 地图序章（按 mapId 选句），
    // 每屏 ≤3 句、固定 3s 自动进入、可点击跳过；初始 PROLOGUE 态 → 序章期间不开始计时/生成器
    // （update() RUNNING 短路保证 elapsedSeconds 恒 0）。完成后 → RUNNING + 开局横幅（C-1 开关）。
    this.prologue = createPrologueOverlay({ isMobile: () => this.cfg.isMobile });
    const prologueScreens = prologueScreensForMap(this.mapId);
    if (this.isSmoke || this.isBench || prologueScreens.length === 0) {
      // 冒烟（?smoke=1：60 帧内须 RUNNING 判据）/ 基准（?bench=1：36s 连续 20× 采样）/ 无序章句：
      // 跳过序章直接进战斗（与既有开局横幅行为一致）
      this.state.set(GamePhase.RUNNING);
      if (SHOW_OPEN_BANNER) this.narratives.show('map-open', { mapId: this.mapId });
    } else {
      this.prologue.show(prologueScreens, () => {
        this.state.set(GamePhase.RUNNING); // 序章完成 → 世界恢复（applyPhase RUNNING）
        // 开局横幅（spec §3 开局 5s；C-1 show_open_banner 开关：与序章屏同文案时按开关控制是否双弹）
        if (SHOW_OPEN_BANNER) this.narratives.show('map-open', { mapId: this.mapId });
      });
    }

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
    //    Boss 同池 → 自动纳入本 overlap，接触伤害 30 / 间隔 2.0s 生效）。
    //    TASK-37 B1：箭头函数闭包绑 `this`（方法引用 `this.onPlayerEnemyOverlap` 直接传入
    //    `add.overlap` 会丢失 `this` 绑定，物理 step 内 `this.player` 为 undefined → 首次接触
    //    抛 `Cannot read properties of undefined (reading 'hurt')` → Phaser 主循环崩溃 → 画面卡死）。
    this.physics.add.overlap(
      this.player,
      this.enemyPool.group,
      (_o1, o2) =>
        playerEnemyContact(
          o2 as unknown as ContactEnemy,
          this.time.now / 1000,
          this.player,
        ),
    );

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
    // TASK-39 E2：屠夫预警（血月印记出现/落地）
    GameEvents.on(GameEvent.TankWarning, this.onTankWarning, this);
    GameEvents.on(GameEvent.TankSpawned, this.onTankSpawned, this);
    // M3 治疗道具：拾取完成 → 治疗绿发光 + HpChanged（治疗量已由 HealManager 应用）
    GameEvents.on(GameEvent.HealCollected, this.onHealCollected, this);

    // 相机跟随 + 世界边界（S9 / E4-S9：按 MAP_CONFIGS 尺寸联动，替换 WORLD 3000 硬编码）
    this.cameras.main.setBounds(0, 0, mapCfg.width, mapCfg.height);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);

    // 输入：双端共用逻辑，仅适配器不同（ADR-002）
    this.inputSource = this.cfg.isMobile
      ? new TouchInput(this, this.cfg)
      : new KeyboardInput(this);
    this.inputSource.onPauseToggle(() => this.togglePause());
    // M1b 主动技：桌面 Space/Shift + 移动端按钮统一走 tryCastActiveSkill（相位门禁在场景层）
    this.inputSource.onActiveSkill(() => this.tryCastActiveSkill());

    // 防泄漏：场景关闭时清事件总线 + 输入
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    // E4-S5 基准模式：三武器全开 + 玩家免死 + 36s 峰值压力（生成器 20× 加速到 6:00 收束）
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
    // E4-S5 基准：持续记录帧率（不受状态机短路影响），36s 后写结果一次
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
    if (this.isBench) dt *= BENCH_TIME_SCALE; // 基准：20× 时缩放模拟 6 分钟收束
    const realDt = clampDelta(delta); // TASK-28：特效寿命用真实 dt（基准 20× 不加速视觉节奏）
    const now = this.time.now / 1000; // 秒时间戳（无敌帧/环绕球 CD/Boss 霸体）

    // 1) 玩家移动（velocity 驱动，fixedStep 60Hz）+ TASK-28 idle/移动动画
    const move = this.inputSource.getMove();
    // E4-S2 血影突袭：冲刺期间由冲刺推进接管位移（结束后输入向量天然保留，gdd §⑥.2）
    if (this.dash) {
      this.updateDash(dt, now);
    } else {
      this.player.update(move, now);
    }
    tickPlayerAnim(this.player);
    // E4-S2 血月狂化：buff 生效/失效同步 + 接触光环 tick（gdd §3.2 口径 3 平摊）
    this.updateRage(dt, now);
    // M1b 主动技：冷却递减（秒制，帧率无关）+ 移动端按钮冷却转圈（HUD 只读展示；不打断移动输入）
    this.activeSkill.update(dt);
    if (this.cfg.isMobile) {
      const skillCfg = ACTIVE_SKILLS[this.heroId];
      const cdTotal = skillCfg.charges ? skillCfg.chargeInterval ?? skillCfg.cd : skillCfg.cd;
      this.hud.setSkillCooldown(this.activeSkill.cooldown, cdTotal);
      this.hud.setSkillCharges(this.activeSkill.chargeCount);
    }
    // 2) 敌潮生成（budget(t) 秒制累加；6:00 自动触发 onBossTime）
    this.spawner.update(dt);
    // 3) 敌人 AI（朝玩家移动 + 攻击计时）+ TASK-28 敌型动画（普通 3 敌 idle/move，Boss 恒 idle）
    //    M1b：now 秒时间戳供眩晕判定（updateMovement 内冻结移动）
    this.enemyPool.eachActive((e) => {
      e.updateMovement(dt, this.player, now);
      tickEnemyAnim(e);
    });
    this.markers.sync(this.enemyPool, this.player, now);
    // 4) 武器（飞弹/环绕球/冲击波全自动；Boss 霸体期内被 refreshEnemies 过滤）
    this.weaponSystem.update(dt, now);
    // 5) 经验宝石磁吸/拾取（E3-S1）
    this.xp.update(dt);
    // 5b) M3 治疗道具拾取（精英/Boss 保底；拾取即治疗 + emit）
    this.healManager.update(dt);
    this.updateRareChestPickup();
    // 5c) M3 图鉴 toast：局内首次解锁任一条目 → 同帧合并 emit 1 条（spec §6 n_toast_codex「多条目同帧合并 1 条」）
    if (this.codexToastPending) {
      this.codexToastPending = false;
      GameEvents.emit(GameEvent.CodexUpdated);
    }
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

  /**
   * E4-S3 失败终局（玩家死亡）
   * 由 core/events 订阅（PlayerDied），碰撞伤害在 src/combat/contact.playerEnemyContact 派发。
   */
  private onPlayerDied(): void {
    this.finishGame(false);
  }

  /** E4-S3 胜利终局（Boss 击杀） */
  private onBossDefeated(): void {
    this.stats.recordBossDefeated(this.spawner.elapsedSeconds);
    // E4-S6 图鉴 progress：首通地图 → 事件条目（墓地→起源/守夜会；教堂→血廷；狼穴→兽群）
    if (this.saveData) {
      const isNewClear = recordMapCleared(this.saveData, this.mapId);
      for (const entryId of eventEntriesForMapCleared(this.mapId)) {
        if (this.codex.recordProgress(entryId)) this.codexToastPending = true;
      }
      if (isNewClear) writeSave(window.localStorage, this.saveData, this.cfg.isMobile ? 'mobile' : 'desktop');
    }
    this.finishGame(true);
  }

  /** 统一终局：停止生成/清武器/隐藏选卡 → 聚合统计 → GAMEOVER → 结算页（CM R5 / E4-S4） */
  private finishGame(victory: boolean): void {
    this.spawner.stop(); // S8 §⑥.2：立即停止生成
    this.weaponSystem.clearAll(); // W8 §⑥.5：清空子弹/环绕球 + 冲击波冷却重置
    this.fx.clearAll(); // TASK-28：清空粒子（结算页背景干净）
    this.markers.hideAll();
    this.overlay.hide(); // 防止结算时残留选卡覆盖层
    // E4-S2 玩家死亡/终局：狂化 buff 立即清除（gdd §⑥.8）、冲刺中断、倍率/移速加成归零
    this.rage.clear();
    this.dash = null;
    this.requiemRingTimer?.remove(false);
    this.requiemRingTimer = null;
    this.player.stats.setRageBonus(0);
    this.player.stats.rageSpeedPct = 0;
    this.player.setScale(1);
    // M3 真机埋点：局终汇入经验拾取总量（xpGainedPerRun；XpManager 为唯一经验入口，须在 finish 快照前）
    this.stats.recordXpGained(this.xp.xpGained);
    const result = this.stats.finish(victory, this.spawner.elapsedSeconds);
    // TASK-26 P0：本局 RunResult 挂全局，供导出脚本自动捕获（production/playtests/export-script.js）
    (globalThis as any).__BMV_LAST_RUN = result;
    // E4-S7 功绩结算：存活/击杀/通关/首杀/化身 → 累计到局外存档（纯局内模式仍结算点数，
    // 但加成不生效；gdd-codex §3.4 数据层记录）
    let earned = 0;
    if (this.saveData) {
      earned = calculateMeritPoints({
        survivalSeconds: result.survivalSeconds,
        kills: result.kills,
        victory: result.victory,
        firstBossKills: this.firstBossKillsThisRun,
        avatarKills: this.avatarKillsThisRun,
      });
      this.saveData.meritPoints += earned;
      // 图鉴解锁快照 + 功绩点数 + 装备 + 通关 + 纯局内模式 一并持久化
      this.saveData.codexUnlocked = this.codex.snapshot();
      writeSave(window.localStorage, this.saveData, this.cfg.isMobile ? 'mobile' : 'desktop');
    }
    // M3 结算日志条：本局新解锁图鉴条数（codex-ui-spec §6「日志 +N」；snapshot − 开局数）
    const codexUnlockedDelta = Math.max(0, this.codex.snapshot().length - this.codexUnlockedAtStart);
    this.state.set(GamePhase.GAMEOVER); // CM §5 联动
    // TASK-21 P1：game:over payload 增补 session 级累计重开次数（concept §9 重开率数据源）
    // M3：增补功绩条/日志条数据（merit-ui-spec §7 / codex-ui-spec §6）
    GameEvents.emit(GameEvent.GameOver, {
      stats: result,
      sessionRestartCount: readRestartCount(window.localStorage),
      meritEarned: earned,
      meritTotal: this.saveData?.meritPoints ?? 0,
      codexUnlockedDelta,
    });
  }

  /** E4-S3 6:00 Boss 出场：清场已完成，在玩家前方一段距离登场 + 0.5s 霸体闪红 */
  private spawnBoss(): void {
    const now = this.time.now / 1000;
    const boss = this.enemyPool.acquire(this.player.x, this.player.y, 'characters', 'enemy-boss') as Boss | null;
    if (!boss) return; // 池满兜底（清场后正常不会）
    const angle = Math.random() * Math.PI * 2;
    const bx = this.player.x + Math.cos(angle) * BOSS.SPAWN_DISTANCE;
    const by = this.player.y + Math.sin(angle) * BOSS.SPAWN_DISTANCE;
    boss.spawn('boss', bx, by);
    const bossFrame = BOSSES[MAP_CONFIGS[this.mapId].boss].frame;
    if (this.textures.get('characters').has(bossFrame)) {
      boss.visualFrame = bossFrame;
      boss.setTexture('characters', bossFrame);
    }
    boss.beginGrace(now);
    this.boss = boss;
    const entranceFrame = bossEntranceFrameName(bossFrame);
    if (hasCharacterFrame(this, entranceFrame)) {
      boss.entranceUntil = now + FX.BOSS_ENTRANCE_MS / 1000;
      boss.setTexture('characters', entranceFrame);
    } else {
      // 尊者无 -entrance：出场 0.5s 霸体闪红（art-bible §4 / enemies §⑥.5）
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
    }
    // TASK-28：Boss 出场特效 —— 猩红金冲击环 + 金点爆发 + 屏幕震动（移动端震动关闭）
    this.fx.bossEntrance(bx, by);
    if (this.cfg.screenShake) this.cameras.main.shake(150, 0.004);
    // M3 叙事：Boss 登场按 bossId 分句（spec §5/§6 bottom-banner；narrative-bindings 路由）
    GameEvents.emit(GameEvent.BossSpawned, { bossHp: boss.hp, bossId: MAP_CONFIGS[this.mapId].boss });
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
    // E4-S6 图鉴：首杀记录（15 敌/Boss；内容 ID 幂等；旧 kind 三敌 enemyId 为 null 跳过）
    if (payload.enemyId) {
      if (this.codex.recordKill(payload.enemyId)) {
        this.codexToastPending = true; // 图鉴 toast（同帧合并，update 末尾 emit）
        // 首杀 Boss/精英 → 功绩 +2/只（E4-S7；精英 = tank 运行时类，Boss = boss 类）
        const kind = payload.enemyType as EnemyKindId;
        if (kind === 'boss' || kind === 'tank') this.firstBossKillsThisRun += 1;
        // 血月化身（boss_4）：任意图稀有月坠 → 图鉴隐藏条目 + 功绩 +5（gdd-codex §3.2/§3.4）
        if (payload.enemyId === 'boss_4') {
          this.codex.recordTrigger(MOON_AVATAR_ENTRY_ID);
          if (this.codex.recordProgress('codex_event_6')) this.codexToastPending = true;
          this.avatarKillsThisRun += 1;
          this.dropRareChest(payload.x, payload.y);
        }
      }
    }
    // TASK-28：击杀溅射（颜色/形状按敌人类型分化）
    this.fx.deathBurst(payload.x, payload.y, payload.enemyType as EnemyKindId);
    if (payload.enemyType !== 'boss') {
      this.xp.dropGem(payload.xp, payload.x, payload.y);
    }
    // M3 治疗道具（merit-ui-spec §11 + 平衡模拟调整）：精英（tank 槽）掉率 50% / Boss 保底；
    // 普通怪不掉（防掉落稀释）；Boss 保底 100%（shouldDropHeal 内按 HEAL.ELITE_DROP_CHANCE 判定）
    if (shouldDropHeal(payload.enemyType)) {
      this.healManager.dropHeal(payload.x, payload.y);
    }
    if (this.player.stats.applyLifesteal()) {
      GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
    }
    // E4-S2 血月狂化：狂化中击杀回 1 HP（gdd §3.2 / ACTIVE_SKILLS.hero_galvan.lifestealOnKill；
    // 仅狼裔狂化窗口内生效，与吸血升级/兽血愈合被动加法叠加）
    if (this.rage.active(this.time.now / 1000) && ACTIVE_SKILLS.hero_galvan.lifestealOnKill) {
      const before = this.player.stats.hp;
      this.player.stats.hp = Math.min(
        this.player.stats.maxHp,
        this.player.stats.hp + ACTIVE_SKILLS.hero_galvan.lifestealOnKill,
      );
      if (this.player.stats.hp > before) {
        GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
      }
    }
    // M3-DESIGN-1 up_g_4 踏月而行：击杀后 2s 移速 +15%（PlayerStats 时间窗，无 HP 变化）
    this.player.stats.triggerKillSpeedBuff(this.time.now / 1000);
  }

  /** TASK-28：宝石拾取爆点（payload 由 xp-manager 补 x/y） */
  private onGemCollected(args: unknown): void {
    const p = args as { x?: number; y?: number };
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      this.fx.gemPickup(p.x, p.y);
    }
  }

  /** M3 治疗道具拾取：治疗绿发光 + HpChanged（治疗量已由 HealManager 写入 stats） */
  private onHealCollected(args: unknown): void {
    const p = args as { amount: number; x?: number; y?: number };
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      this.fx.healPickup(p.x, p.y);
    }
    GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
  }

  /**
   * M1b 主动技释放入口（桌面 Space/Shift + 移动端技能按钮共用；E4-S2 按角色分发）。
   * 门禁（pillars §6.6 / CM §5）：仅 RUNNING 可释放 —— LEVEL_UP/PAUSED/GAMEOVER 冻结；
   * CD 未就绪 / 释放后 100ms 防抖由 ActiveSkill.tryCast 拒绝。
   * 释放不打断移动输入（移动向量仍由 player.update 每帧消费，本方法只结算效果）。
   */
  private tryCastActiveSkill(): void {
    if (this.state.get() !== GamePhase.RUNNING) return; // 非 RUNNING 冻结（含释放瞬间切 LEVEL_UP 的按下即结算：已生效则冻结后不追加）
    const now = this.time.now / 1000;
    if (!this.activeSkill.tryCast(now)) return; // CD / 充能 / 100ms 防抖
    switch (this.heroId) {
      case 'hero_edmund':
        this.applyLanternFlash(now);
        break;
      case 'hero_cassandra':
        this.startDash(now);
        break;
      case 'hero_violet':
        this.applyRequiem(now);
        break;
      case 'hero_galvan':
        this.applyRage(now);
        break;
    }
    this.stats.recordActiveSkillCast(); // 埋点 activeSkillCasts（每局次数）
    this.player.beginSkillPose(); // 表现叠层：skill-a 300ms → skill-b 150ms；不挡移动
    this.playActiveSkillFx();
  }

  /** 四主动技分模板 VFX（asset-spec §3.2；不再共用 lanternFlash） */
  private playActiveSkillFx(): void {
    const cfg = ACTIVE_SKILLS[this.heroId];
    const x = this.player.x;
    const y = this.player.y;
    switch (this.heroId) {
      case 'hero_edmund': {
        const radius = cfg.radius ?? ACTIVE_SKILL.RADIUS;
        this.fx.lanternFlash(x, y, radius);
        this.fx.lanternEdgeFlash(x, y, radius);
        this.fx.playSkillRing(x, y, radius, SKILL_RING_FRAMES.hero_edmund);
        if (this.cfg.screenShake) this.cameras.main.shake(120, 0.003);
        break;
      }
      case 'hero_cassandra':
        // 轨迹在 startDash 里发（需要冲刺方向）；skill-ring PNG 入库但不叠冲刺
        break;
      case 'hero_violet': {
        const radius = cfg.radius ?? 300;
        this.fx.requiemWave(x, y, radius);
        this.fx.playSkillRing(x, y, radius, SKILL_RING_FRAMES.hero_violet);
        this.fx.requiemHeal(x, y);
        this.requiemRingTimer?.remove(false);
        this.requiemRingTimer = this.time.delayedCall(FX.SKILL_REQUIEM_RING_GAP_MS, () => {
          this.requiemRingTimer = null;
          if (this.state.get() !== GamePhase.RUNNING) return;
          this.fx.requiemWave(x, y, radius);
          this.fx.playSkillRing(x, y, radius, SKILL_RING_FRAMES.hero_violet);
        });
        break;
      }
      case 'hero_galvan':
        this.fx.rageBurst(x, y);
        this.fx.playSkillRing(x, y, FX.SKILL_RAGE_RING_RADIUS, SKILL_RING_FRAMES.hero_galvan);
        this.player.setScale(FX.SKILL_RAGE_SCALE);
        if (this.cfg.screenShake) this.cameras.main.shake(120, 0.003);
        break;
    }
  }

  /** E4-S2 血影突袭：开始冲刺（方向 = 当前输入方向；无输入默认右向） */
  private startDash(_now: number): void {
    const cfg = ACTIVE_SKILLS.hero_cassandra;
    const move = this.inputSource.getMove();
    this.dash = { dir: dashDirection(move), remaining: cfg.dashDistance ?? 0 };
    this.dashTrailAccum = 0;
    this.fx.bloodDash(this.player.x, this.player.y, this.dash.dir.x, this.dash.dir.y, cfg.dashDistance ?? 0);
  }

  /** E4-S2 血影突袭：冲刺推进（每帧位移 + 路径伤害 + 标记；gdd §3.2 / §⑥.7） */
  private updateDash(dt: number, now: number): void {
    if (!this.dash) return;
    const cfg = ACTIVE_SKILLS.hero_cassandra;
    const from = { x: this.player.x, y: this.player.y };
    const { remaining, step } = dashStep(
      this.dash.remaining,
      dt,
      cfg.dashDistance ?? 0,
      cfg.dashDuration ?? ACTIVE_SKILL_RULES.DASH_DURATION_SECONDS,
    );
    this.dash.remaining = remaining;
    const to = {
      x: this.player.x + this.dash.dir.x * step,
      y: this.player.y + this.dash.dir.y * step,
    };
    // clamp 到地图边界（E4-S9 尺寸联动；障碍碰撞由 physics collider 处理，gdd §⑥.7 障碍前停止）
    const clamped = clampToWorld(to, MAP_CONFIGS[this.mapId].width, MAP_CONFIGS[this.mapId].height);
    this.player.setPosition(clamped.x, clamped.y);
    this.dashTrailAccum += dt;
    if (this.dashTrailAccum >= 0.04) {
      this.dashTrailAccum = 0;
      this.fx.bloodDashTrail(this.player.x, this.player.y, this.dash.dir.x, this.dash.dir.y);
    }
    // 路径伤害 + 标记：damage = 40 × 0.5 × 总倍率（伤害型主动技只吃 0.5× 总倍率，gdd §3.1）
    const damage =
      (cfg.dashDamage ?? 0) * (cfg.damageMultFactor ?? 0.5) * this.player.stats.totalDamageMultiplier;
    const enemies: Enemy[] = [];
    this.enemyPool.eachActive((e) => enemies.push(e));
    damageAndMarkDash(
      enemies as unknown as DashEnemyLike[],
      from,
      { x: this.player.x, y: this.player.y },
      PLAYER.RADIUS,
      damage,
      cfg.markDuration ?? 0,
      cfg.markDamageMult ?? 1,
      now,
    );
    if (this.dash.remaining <= 0) this.dash = null; // 冲刺结束；输入向量由 player.update 每帧读 inputSource 天然保留
  }

  /** E4-S2 安魂曲：300px 内减速 40%（4s）+ 回复 20% 最大生命（gdd §3.2） */
  private applyRequiem(now: number): void {
    const cfg = ACTIVE_SKILLS.hero_violet;
    const enemies: Enemy[] = [];
    this.enemyPool.eachActive((e) => enemies.push(e));
    applySlowInRadius(
      enemies,
      { x: this.player.x, y: this.player.y },
      cfg.radius ?? 300,
      cfg.slowDuration ?? 0,
      cfg.slowPct ?? 0,
      now,
    );
    healFractionOfMax(this.player.stats, cfg.healPct ?? 0);
    GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
  }

  /** E4-S2 血月狂化：8s 移速 +30% / 倍率 +0.40 / 接触光环 / 击杀回 1 HP（gdd §3.2） */
  private applyRage(now: number): void {
    const cfg = ACTIVE_SKILLS.hero_galvan;
    this.rage.apply(now, cfg.duration ?? 8);
    this.player.stats.setRageBonus(rageMultiplierAdd()); // 加法叠加 +0.40（口径 1）
    this.player.stats.rageSpeedPct = rageMoveSpeedPct(); // 移速 +30%
  }

  /** E4-S2 血月狂化：buff 生效/失效同步 + 接触光环 tick（不打断移动；死亡清除见 finishGame） */
  private updateRage(dt: number, now: number): void {
    const active = this.rage.active(now);
    const stats = this.player.stats;
    if (active && stats.rageBonusMultiplier === 0) {
      stats.setRageBonus(rageMultiplierAdd());
      stats.rageSpeedPct = rageMoveSpeedPct();
      this.player.setScale(FX.SKILL_RAGE_SCALE);
    } else if (!active && stats.rageBonusMultiplier !== 0) {
      stats.setRageBonus(0);
      stats.rageSpeedPct = 0;
      this.player.setScale(1);
    }
    if (!active) return;
    // 接触光环：接触半径内任一敌人在场即全额 tick，不按敌数叠加（25 伤/s × 0.5× 总倍率，口径 3）
    const enemies: Enemy[] = [];
    this.enemyPool.eachActive((e) => enemies.push(e));
    contactAuraTick(
      enemies,
      { x: this.player.x, y: this.player.y },
      ACTIVE_SKILL_RULES.CONTACT_AURA_RADIUS,
      dt,
      ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS,
      0.5 * stats.totalDamageMultiplier,
    );
  }

  /** 提灯闪耀效果结算：240px 内敌人眩晕 2.5s + 自身无敌 1.5s（content §2.2）；返回被眩晕数 */
  private applyLanternFlash(now: number): number {
    const enemies: Enemy[] = [];
    this.enemyPool.eachActive((e) => enemies.push(e));
    const stunned = stunEnemiesInRadius(
      enemies,
      { x: this.player.x, y: this.player.y },
      ACTIVE_SKILL.RADIUS,
      ACTIVE_SKILL.STUN_DURATION,
      now,
    );
    this.player.grantInvulnerability(ACTIVE_SKILL.INVULN_DURATION, now);
    return stunned;
  }

  /**
   * TASK-39 E2 屠夫预警：保底厚血预约出生 → 出生点生成血月印记（复用 fx-ambient p-ring 红圈，
   * 桌面 edgeWarning 叠加边缘红光脉动由既有机制承担；移动端无全屏红晕，本地印记为主预兆）。
   * 印记脉冲 0.35s×yoyo×3 ≈ 2.5s；落地时（tank:spawned）销毁。
   */
  private onTankWarning(args: unknown): void {
    const p = args as { x: number; y: number };
    this.destroyTankMark();
    const mark = this.add
      .image(p.x, p.y, 'fx-ambient', 'p-ring')
      .setDepth(60)
      .setDisplaySize(72, 72)
      .setTint(hexToRgbInt(PALETTE.danger))
      .setAlpha(0.9);
    this.tweens.add({
      targets: mark,
      alpha: 0.35,
      scale: 0.92,
      duration: 350,
      yoyo: true,
      repeat: 3,
    });
    this.tankMark = mark;
  }

  /** TASK-39 E2 屠夫预警：预约厚血落地 → 销毁印记 */
  private onTankSpawned(): void {
    this.destroyTankMark();
  }

  private destroyTankMark(): void {
    if (this.tankMark) {
      this.tankMark.destroy();
      this.tankMark = null;
    }
  }

  /** 经验达标 → 升级：属性成长 + 抽三选一 + LEVEL_UP 状态（CM §3.3） */
  private onLevelUp(args: unknown): void {
    const payload = args as { level: number; xpNeeded: number };
    this.player.stats.levelUp(); // E3-S2 自动成长（+8HP/+4%/每5级+4px/s）
    // E4-S1 HUD：升级回血（+8）后 HP 变化
    GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
    // E4-S4：v2 池抽取（标签过滤 + 抽取规则 5 条 + 回退；M3-DESIGN-1 阶段权重 + 保底席位）
    const v2Ctx: UpgradePoolV2Context = {
      heroId: this.heroId,
      ownedWeaponIds: [...this.ownedWeaponIds],
      isEvolved: (w) => this.weaponSystem.evolution.isEvolved(w),
      // M3-DESIGN-1 节奏：由局时秒驱动 STAGE_WEIGHT_MULT（upgrade-experience-v2 §2.2 / §4.2）
      runTimeSeconds: this.spawner.elapsedSeconds,
    };
    const options = rollThreeV2(this.upgradeState, v2Ctx);
    this.lastOptionsV2 = options;
    // QA-BUG-1 兜底：无可选选项不进入 LEVEL_UP（rollThreeV2 回退机制下理论不可达，
    // 防御「暂停无 UI」死锁）——照常 RUNNING（升级回血 HpChanged 已在上方 emit）
    if (options.length === 0) {
      console.warn('[upgrade] 三选一为空：跳过 LEVEL_UP（保持 RUNNING，不死锁）');
      return;
    }
    // M3 真机埋点：一次三选一出现（offersPerRun + related 卡统计，upgrade-experience-v2 §4.4）
    this.stats.recordUpgradeOffered(options);
    // E4-S1 升级时间戳埋点（后期升级间隔 / Lv47 预警数据源，供文策渊评审）
    this.stats.recordLevelUp(payload.level, this.spawner.elapsedSeconds);
    GameEvents.emit(GameEvent.UpgradeOffered, { options });
    // TASK-28：升级三选一出现 —— 玩家位置金+冷青爆发（进入 LEVEL_UP 前）
    this.fx.levelUpBurst(this.player.x, this.player.y);
    if (this.isBench) {
      // 基准模式：自动选第 1 张，跳过 LEVEL_UP 暂停（保持 20× 时缩放连续）
      const first = options[0];
      this.onUpgradeChosen({ optionId: first?.upgradeId ?? first?.evoId ?? 'up_g_1', index: 0, dwellSeconds: 0 });
      return;
    }
    this.overlay.showV2(options);
    this.state.set(GamePhase.LEVEL_UP); // 世界冻结（applyPhase）
  }

  /** 三选一完成 → 写回 → 回 RUNNING（CM §3.3）；有挂起升级则链式再升。
   *  QA-BUG-1 兜底：写回阶段任何异常都必须回 RUNNING——选卡层在 emit 前已隐藏，
   *  若此处中断，世界将永久停在 LEVEL_UP（玩家视角整局隐形卡死、进度丢失）。 */
  private onUpgradeChosen(args: unknown): void {
    const payload = args as UpgradeChosenPayload;
    try {
      this.consumeUpgradeChoice(payload);
    } catch (err) {
      console.error('[upgrade] 选卡写回异常（已强制回 RUNNING 保活）', err);
    } finally {
      // E4-S1 HUD：升级写回后 HP 变化（如 maxHp+20 同时回 20）
      GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
      this.state.set(GamePhase.RUNNING); // 恢复世界（applyPhase + 输入向量归零）
    }
  }

  /** QA-BUG-1 拆分：选卡消费主体（异常由 onUpgradeChosen 捕获保活） */
  private consumeUpgradeChoice(payload: UpgradeChosenPayload): void {
    if (typeof payload.optionId === 'string') {
      // E4-S4：v2 池（内容 ID 字符串）
      const optionId = payload.optionId;
      if (optionId.startsWith('evo_')) {
        // 超武进化卡：消费 WeaponSystem.evolve（不可逆；E2-S6 引擎已就绪）
        const evo = EVOLUTIONS.find((e) => e.evoId === optionId);
        if (evo && this.weaponSystem.evolve(evo.wpnId, this, this.cfg)) {
          if (this.codex.recordEvolve(evo.evoId)) this.codexToastPending = true; // E4-S6 图鉴：首进化幂等
          GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: evo.evoId, name: evo.name });
          // M3 真机埋点：一次进化完成（evolutionComplete 数据源，upgrade-experience-v2 §4.4）
          this.stats.recordEvolutionComplete();
        }
        this.upgradeState.lastPickId = optionId;
        this.stats.recordHesitationV2(payload.dwellSeconds ?? 0, this.lastOptionsV2);
      } else {
        const upId = optionId as UpgradeId;
        const result = applyUpgradeByIdV2(this.upgradeState, this.upgradeV2Targets, upId, {
          ownedWeaponIds: [...this.ownedWeaponIds],
          random: Math.random,
        });
        this.upgradeState.lastPickId = upId; // 抽取权重 ×0.5（gdd §3.6.4）
        const item = poolItemById(upId);
        if (item) this.stats.recordUpgradeChosen(0, item.name, this.spawner.elapsedSeconds);
        this.stats.recordHesitationV2(payload.dwellSeconds ?? 0, this.lastOptionsV2);
        // E4-S5 解锁变体：onWeaponUnlocked 已由 unlockWeapon 目标处理（unlockVariant 仅返回）
        void result;
        // E4-S1 HUD：武器解锁（全局 1/2 号兼容 + 解锁变体已由 onWeaponUnlocked emit）
        if (item?.id === 'up_g_1') {
          GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: 0, name: item.name });
        }
      }
    } else {
      // legacy 数字 id（兼容/基准回退；v2 流程不产生）
      const item = UPGRADE_BY_ID[payload.optionId];
      applyUpgrade(this.upgradeState, this.upgradeTargets, payload.optionId);
      this.upgradeState.lastPickId = payload.optionId;
      if (item) this.stats.recordUpgradeChosen(payload.optionId, item.name, this.spawner.elapsedSeconds);
      this.stats.recordHesitation(payload.dwellSeconds ?? 0, this.lastOptions);
      if (payload.optionId === 1 || payload.optionId === 2) {
        GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: payload.optionId, name: item?.name ?? '' });
      }
    }
  }

  /** E4-S5/E4-S6：武器解锁（v2 目标 unlockWeapon / 初始武器 / 进化超武） */
  private onWeaponUnlocked(weaponId: string): void {
    const wid = weaponId as WeaponId;
    if (WEAPON_CONFIGS[wid]) {
      this.weaponSystem.unlockWeapon(wid);
      if (!this.ownedWeaponIds.includes(wid)) this.ownedWeaponIds.push(wid);
      if (this.codex.recordObtain(wid)) this.codexToastPending = true; // E4-S6 图鉴：首获幂等
      GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: wid, name: WEAPON_CONFIGS[wid].name });
    } else {
      // 超武（evo_*）：仅登记 owned（无行为注册表项；行为由 evolve 切换）
      this.weaponSystem.unlockWeapon(wid as Parameters<WeaponSystem['unlockWeapon']>[0]);
      GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: wid, name: wid });
    }
  }

  /** E4-S3：主动技强化分支（up_a_* 12 项）—— 改写运行时配置 + 同步控制器 */
  private onActiveSkillUpgrade(upgradeId: UpgradeId): void {
    this.skillRuntime.applyUpgrade(upgradeId);
    this.activeSkill.setCooldown(this.skillRuntime.cd);
    this.activeSkill.setChargeInterval(this.skillRuntime.chargeInterval ?? 0);
    if (this.cfg.isMobile) {
      const cdTotal = this.skillRuntime.charges
        ? (this.skillRuntime.chargeInterval ?? this.skillRuntime.cd)
        : this.skillRuntime.cd;
      this.hud.setSkillCooldown(this.activeSkill.cooldown, cdTotal);
      this.hud.setSkillCharges(this.activeSkill.chargeCount);
    }
  }

  /** E4-S7：功绩加成开局生效（纯局内模式关闭全部；数据层记录 applied 状态） */
  private applyMeritToStats(merit: MeritAppliedResult): void {
    if (merit.pureInGame || merit.applied.length === 0) return;
    const stats = this.player.stats;
    if (merit.maxHpDelta > 0) {
      stats.maxHp += merit.maxHpDelta;
      stats.hp += merit.maxHpDelta;
    }
    if (merit.damageMultDelta > 0) stats.addDamageBonus(merit.damageMultDelta); // 初始伤害 +5%
    if (merit.moveSpeedDelta > 0) stats.moveSpeed += merit.moveSpeedDelta; // 初始移速 +4%
    if (merit.magnetRadiusDelta > 0) {
      stats.magnetRadiusBonus += merit.magnetRadiusDelta; // 初始磁力 +40px
      this.xp.setMagnetRadiusBonus(stats.magnetRadiusBonus);
    }
    GameEvents.emit(GameEvent.HpChanged, { hp: stats.hp, maxHp: stats.maxHp });
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

  /** 状态副作用集中处理（ADR-003 / CM §5）；TASK-28：LEVEL_UP/PAUSED 同时暂停角色动画；M3 序章 PROLOGUE 同冻结 */
  private applyPhase(phase: GamePhase): void {
    switch (phase) {
      case GamePhase.PROLOGUE:
      case GamePhase.LEVEL_UP:
      case GamePhase.PAUSED:
        this.physics.pause();
        this.tweens.pauseAll();
        this.anims.pauseAll(); // TASK-28：动画随世界冻结
        if (this.inputSource) this.inputSource.setEnabled(false); // 冻结移动输入 + 摇杆隐藏（create 早期未装配时守卫）
        break;
      case GamePhase.RUNNING:
        this.physics.resume();
        this.tweens.resumeAll();
        this.anims.resumeAll(); // TASK-28：恢复动画
        // 输入源默认 enabled=true；守卫防 create 早期同步转 RUNNING（smoke/bench 直接进战斗）时未装配
        if (this.inputSource) this.inputSource.setEnabled(true); // 恢复；移动向量归零由适配器处理（ux-spec §3 ②④）
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

  private dropRareChest(x: number, y: number): void {
    if (this.rareChest) return;
    if (!sceneHasFrame(this, 'effects', 'chest')) return;
    const img = this.physics.add.image(x, y, 'effects', 'chest');
    img.setDepth(25);
    this.rareChest = img;
  }

  private updateRareChestPickup(): void {
    const chest = this.rareChest;
    if (!chest?.active) return;
    const r = 28;
    const dx = chest.x - this.player.x;
    const dy = chest.y - this.player.y;
    if (dx * dx + dy * dy > r * r) return;
    chest.destroy();
    this.rareChest = null;
    this.codexToastPending = true;
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
    // M3 轻叙事：解绑事件订阅 + 销毁 DOM 覆盖层（配合 resetGameEvents 防泄漏）
    this.unbindNarratives?.();
    this.unbindNarratives = null;
    this.narratives?.destroy();
    this.prologue?.destroy();
    this.rareChest?.destroy();
    this.rareChest = null;
    this.requiemRingTimer?.remove(false);
    this.requiemRingTimer = null;
    this.markers?.destroy();
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

  /** 36s 峰值压力结束：聚合断言数据 → window.__BENCH_RESULT__（TASK-28：draw call 模型含 ambient/粒子组） */
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
      // TASK-31 收尾：36 真实秒 × 20× 时缩放 = 720 局时秒（2 局；6:00 Boss 收束覆盖）
      simulatedGameSeconds: 720,
    });
  }
}
