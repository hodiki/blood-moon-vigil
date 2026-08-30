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
import { BOSS, BOSSES, ENEMY_CONFIGS, PALETTE, HEROES, MAP_CONFIGS, WEAPON_CONFIGS, FX, HERO_EXCLUSIVE_PAIRS, EXCLUSIVE_TO_DERIVATIVE, TALENT_S3_EMBER, DERIVATIVE_SKILLS, type EnemyKindId, type HeroId, type MapId, type WeaponId, type UpgradeId, type EnemyId, type BossId } from '@/config/balance';
import { getSelectedHero, getSelectedMap } from '@/config/session-selection';
import { detectIsMobile } from '@/utils/device';
import { clampDelta } from '@/core/time';
import { hexToRgbInt } from '@/utils/math';
import { collectSmokeResult, writeSmokeResult, SMOKE_FRAMES_COUNT } from '@/utils/smoke';
import { FpsMonitor, estimateDrawCalls, writeBenchResult } from '@/utils/perf';
import type { InputSource } from '@/input/input-source';
import { KeyboardInput } from '@/input/keyboard-input';
import { TouchInput } from '@/input/touch-input';
import { RageBuff } from '@/active-skill/active-skill-effects';
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
import { UpgradeState } from '@/upgrade/upgrade-pool';
import { rollThreeV3, poolItemByIdV3, type UpgradePoolV3Context } from '@/upgrade/upgrade-pool-v3';
import { DerivativeSkillController } from '@/active-skill/derivative/derivative-controller';
import { computeTreeApplication, ledgerFromSaveData, type TreeApplication } from '@/progression/tree-state';
import { judgeRevive, talentReviveHpPct, talentReviveInvulnSeconds, talentReviveKnockbackPx } from '@/progression/revive';
import { resonancePairByExclusive } from '@/config/balance';
import { applyUpgradeByIdV3, type UpgradeV3WriteTargets } from '@/upgrade/upgrade-apply-v3';
import { createMutationPipeline, defaultMutationChannels, takeCard1, takeCard2, onEliteKilled, onUpgradeChosenForPipeline, type MutationPipelineState, type MutationChannelConfig } from '@/upgrade/mutation-pipeline';
import { playerEnemyContact, type ContactEnemy } from '@/combat/contact';
import { LevelUpOverlay } from '@/ui/levelup-overlay';
import { Hud, createHud } from '@/ui/hud';
import { ResultsOverlay, createResultsOverlay } from '@/ui/results-overlay';
import { PauseOverlay, createPauseOverlay } from '@/ui/pause-overlay';
import { getOverlayHost } from '@/ui/overlay-host';
import { RunStats } from '@/stats/run-stats';
import { readRestartCount } from '@/stats/session-stats';
import { CodexTracker, MOON_AVATAR_ENTRY_ID, eventEntriesForMapCleared } from '@/codex/codex';
import { calculateMeritPoints } from '@/stats/merit';
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
  /** W-12 召唤物 noXp：true = 击杀反馈链跳过宝石生成（零 XP 路径，gdd-spawner-v2 §③-7） */
  noXp?: boolean;
  x: number;
  y: number;
}

interface UpgradeChosenPayload {
  /** E4-S4 起为内容 ID 字符串；B3-W4 legacy 数字 id 分支已退役（v1 引擎归档） */
  optionId: string;
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
  /** TASK-28 特效管理器（粒子池 ≤ cfg.maxParticles + 血月/渐晕常驻） */
  private fx!: FxManager;
  /** 特殊行为标记（尸巫光环 / 猎手警告线 / 侍僧符文 / 状态小点） */
  private markers!: StatusMarkerLayer;
  /** TASK-28 冲击波涟漪上升沿检测（active 从 false→true 时触发一次涟漪） */
  private shockwaveWasActive = false;
  /** TASK-39 E2 屠夫预警：血月印记精灵（保底厚血预约出生时显示，落地时销毁；null = 无） */
  private tankMark: Phaser.GameObjects.Image | null = null;
  /** B5-W4 衍生技控制器（替代旧 4 技 ActiveSkill 运行时；EG-2 归档） */
  private derivativeController!: DerivativeSkillController;
  /** E4-S1 当前角色（开局从 session-selection 读取） */
  private heroId: HeroId = 'hero_edmund';
  /** E4-S1 当前地图（开局从 session-selection 读取；相机/玩家 clamp 按 MAP_CONFIGS 尺寸） */
  private mapId: MapId = 'map_graveyard';
  // B5-W3 树质变节点运行时状态
  /** Q-c/Q-e：天赋复活剩余次数 */
  private treeReviveRemaining = 0;
  private treeRevivesUsed = 0;
  /** Q-f1/f2/f3：首精英额外 offer 次数与消费标记 */
  private treeEliteOffers = 0;
  private treeEliteOfferConsumed = false;
  private eliteOfferQueue = 0;
  /** Q-s1：开局窗口截止局时 s（-1 = 未点亮） */
  private treeS1UntilElapsed = -1;
  /** B6-W4 up_d_rage 失控边缘：累计延长 s（上限 3） */
  private rageExtraSeconds = 0;
  /** Q-s3：遗言余烬（首次 HP 归零事件 + 终局折算） */
  private treeS3Active = false;
  private treeS3EmberUsed = false;
  private treeS3MeritBonus = 0;
  /** 当前树应用快照（HUD/结算数据接口） */
  private treeApp: TreeApplication | null = null;
  /** 安魂曲第二环 delayedCall（场景销毁时移除） */
  private requiemRingTimer: Phaser.Time.TimerEvent | null = null;
  /** E4-S2 血月狂化 buff（8s 窗口；玩家死亡/重开清空） */
  private rage = new RageBuff();
  /** E4-S3 主动技运行时配置（升级分支改写；效果结算统一读本类） */
  /** B3-W4 v3 升级池写回目标（PlayScene 装配；v2 语义复用 + 质变卡/衍生技/通用强化扩展） */
  private upgradeV3Targets!: UpgradeV3WriteTargets;
  /** B3-W1 当前专武（2 选 1 选择演出 B5/B6 接入前，默认角色对第一把；applyLoadout 同步点） */
  private currentExclusiveId: import('@/config/balance').ExclusiveWeaponId = 'xw_lantern';
  /** B3-W3 质变卡双节拍管线（卡 1 P1 席位 / 卡 2 三渠道 + 待发队列） */
  private mutationPipeline: MutationPipelineState = createMutationPipeline();
  private mutationChannels: MutationChannelConfig = defaultMutationChannels();
  /** B3-W2 P4 窗口判定：本局升级次数（含本次） */
  private upgradeChoiceCount = 0;
  /** E4-S5 已拥有武器 id（初始武器 + 解锁；v2 抽取上下文） */
  private ownedWeaponIds: WeaponId[] = [];
  /** E4-S4 最近一次 v2 三选一选项（纠结埋点） */
  private lastOptionsV2: import('@/upgrade/upgrade-pool-v2').UpgradeV2Option[] = [];
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

    // QA-FIX-3 修复 2（R3 §6「再来一局」__BMV_LAST_RUN 串号）：scene.restart 复用同一场景实例，
    // RunStats 类字段累积数组（build/upgradeTimestamps）与累计埋点（offersPerRun/xpGained/...）
    // 跨局存活 → 每局开始（create 即唯一入口，含 restart 路径）重置全部 per-run 字段。
    this.stats.reset();
    // 同族 per-run 计数：功绩首杀/化身击杀、图鉴 toast 挂起（同样跨局存活，一并归零）
    this.firstBossKillsThisRun = 0;
    this.avatarKillsThisRun = 0;
    this.codexToastPending = false;

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
    // B5-W2/W4 树驱动开局（computeTreeApplication 替代 merit 加成，A-2；GT-11 纯局内属性段空、质变全开）
    const treeLedger = ledgerFromSaveData(this.saveData);
    const treeApp = computeTreeApplication(treeLedger, this.pureInGame);
    this.treeApp = treeApp;
    this.applyTreeToStats(treeApp);
    this.treeReviveRemaining = treeApp.mutations.reviveCharges;
    this.treeEliteOffers = treeApp.mutations.eliteOffers;
    this.treeS3Active = treeApp.mutations.emberOnDeath;
    this.treeS1UntilElapsed = treeApp.mutations.openingWindow ? 30 : -1;
    // B6-W5 树节奏遥测：质变节点点亮数（mutation flags 真值计数）
    this.stats.setTreeMutationCount(Object.values(treeApp.mutations).filter(Boolean).length);
    // B5-W3 复活判定序挂钩（gdd-talent-tree §⑥-3；Q-c/Q-e 判定序最低优先级）
    this.player.reviveHandler = (now) => this.judgePlayerRevive(now);
    // M2 收口：生成器按当前地图装配（槽位池/权重覆盖/移速加权，E3-S7）
    this.spawner = new EnemySpawner(this.cfg, this.enemyPool, this.player, this.mapId, true);
    // E4-S3 收束：6:00 清场 + Boss 出场（预算恒 0 由 spawner 停止保证，S8 §⑥.3）
    this.spawner.onBossTime = () => {
      this.spawner.clearAll();
      this.spawnBoss();
    };

    // E3 成长闭环：经验 / 升级池 / 覆盖层
    this.xp = new XpManager(this.gemPool, this.player);
    // E4-S1 守夜人「提灯圣辉」：经验磁力 +20px（专属被动；非守夜人为 0）
    this.xp.setMagnetRadiusBonus(this.player.stats.magnetRadiusBonus);
    this.xp.addPickupRadiusBonus(this.player.stats.pickupRadiusBonus); // B5 属性 A-10 拾取半径
    this.upgradeState = new UpgradeState();
    // B3-W1：当前专武默认角色对第一把（正式 2 选 1 选择演出 = B6 接入点；树根 Q-a 宿主语义）
    this.currentExclusiveId = HERO_EXCLUSIVE_PAIRS[this.heroId][0];
    // B5-W4 Q-b 伴灯：开局自带配对共鸣通武（GT-7 全额；未配对普通形态入场，P2 取钥后升格共鸣）
    const treePair = resonancePairByExclusive(this.currentExclusiveId);
    if (treeApp.mutations.companionWeapon && treePair && !this.ownedWeaponIds.includes(treePair.commonWeaponId)) {
      this.ownedWeaponIds.push(treePair.commonWeaponId);
      this.weaponSystem.unlockWeapon(treePair.commonWeaponId);
    }
    // B5-W4 Q-d 携行旧兵：预选已解锁通武进局即得（GT-8 共存；同名不重复发放——与 Q-b 同名去重）
    const preselected = (this.saveData.preselectedWeapon ?? null) as WeaponId | null;
    if (treeApp.mutations.preselectedWeapon && preselected && WEAPON_CONFIGS[preselected] && !this.ownedWeaponIds.includes(preselected)) {
      this.ownedWeaponIds.push(preselected);
      this.weaponSystem.unlockWeapon(preselected);
    }
    // B3-W4：v3 升级池写回目标（37 项定义；v2 语义复用 + 质变卡/衍生技/通用强化扩展）
    this.upgradeV3Targets = {
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
        applyActiveSkillUpgrade: (upId) => this.derivativeController.applyDerivativeUpgrade(upId),
      },
      // B3 v3 扩展：质变卡 → 行为 machine 写回（B2 预留接口）
      exclusive: {
        applyMutationCard: (machine) => {
          const behavior = this.weaponSystem.exclusiveBehaviors[this.currentExclusiveId] as
            import('@/weapons/exclusive/exclusive-behaviors').ExclusiveWeaponBehavior<unknown>;
          behavior.applyMutationCard(machine);
        },
      },
      // B3 v3 扩展：衍生技强化（up_d_* 质变级效果；运行时形态消费随 B5 衍生技装配收拢）
      derivative: {
        applyDerivativeUpgrade: (upId) => this.derivativeController.applyDerivativeUpgrade(upId),
      },
      // B3 v3 扩展：通用通武强化独立乘区（与钥被动相乘写回）
      weapons_extra: {
        setCommonEnhancement: (e) => {
          const keys = this.weaponSystem.keyPassiveState;
          this.weaponSystem.setKeyPassives({
            ...keys,
            rangeMult: keys.rangeMult * e.rangeMult,
            areaRadiusMult: keys.areaRadiusMult * e.areaMult,
          });
        },
      },
    };
    this.overlay = new LevelUpOverlay(getOverlayHost(), {});
    // B5-W4 衍生技装配（落选专武转化技；旧 4 技运行时退出——EG-2 归档）
    this.derivativeController = new DerivativeSkillController(EXCLUSIVE_TO_DERIVATIVE[this.currentExclusiveId]);
    this.hud = createHud({
      cfg: this.cfg,
      skillName: DERIVATIVE_SKILLS[EXCLUSIVE_TO_DERIVATIVE[this.currentExclusiveId]].name,
      skillIconFrame: `skill-${this.heroId.replace('hero_', '')}`,
      onPauseToggle: () => this.togglePause(),
      onActiveSkill: () => this.tryCastActiveSkill(), // 移动端技能按钮 → 同一释放入口
    });
    if (this.cfg.isMobile) this.hud.setSkillCharges(this.derivativeController.chargeCount);
    // QA-FIX-3 修复 3（R3 T-F40「装备 +20 HP 开局仍显示 100」）：HUD 只消费 hp:changed 事件、
    // 初始态硬编码 100/100，而功绩加成在 HUD 装配前已写入 PlayerStats —— 装配后立即同步一次
    // 实际数值（装备 merit_hp 时 120/120 起步可见；无功绩时为幂等 100/100）。
    GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
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
    GameEvents.on(GameEvent.PlayerRevived, this.onPlayerRevived, this);
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
    this.player.update(move, now);
    tickPlayerAnim(this.player);
    // E4-S2 血月狂化：buff 生效/失效同步（B5-W4 起 = 血月狂化衍生技增益；接触光环随旧技退役移除）
    this.updateRage(dt, now);
    // B5-W4 衍生技：CD 递减 + 移动端按钮冷却转圈（HUD 只读展示）
    this.derivativeController.update(dt);
    if (this.cfg.isMobile) {
      this.hud.setSkillCooldown(this.derivativeController.cooldown, this.derivativeController.cdSeconds);
      this.hud.setSkillCharges(this.derivativeController.chargeCount);
    }
    // B6-W2 HUD 补全：左轮弹巢点阵（usesAmmo 仅左轮）+ 复活次数指示（Q-c/Q-e）
    if (this.ownedWeaponIds.includes('xw_revolver' as unknown as WeaponId)) {
      const revolver = this.weaponSystem.exclusiveBehaviors.xw_revolver as unknown as { getState(): { ammo: import('@/weapons/ammo').AmmoState } };
      const ammo = revolver.getState().ammo;
      this.hud.setAmmoDots(ammo.reloading ? 0 : ammo.current);
    } else {
      this.hud.setAmmoDots(null);
    }
    this.hud.setReviveCharges(this.treeReviveRemaining > 0 ? this.treeReviveRemaining : null);
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
    this.weaponSystem.update(dt, now, this.s1WindowDamageMult());
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
    // B6-W5 占比分母近似：击杀敌面板 HP 计入总伤害（1D/沙盘校准口径；精确伤害流留遥测批次）
    const cfg = payload.enemyId ? (ENEMY_CONFIGS as Record<string, { hp?: number }>)[payload.enemyId] ?? (BOSSES as Record<string, { hp?: number }>)[payload.enemyId] : undefined;
    if (cfg?.hp) this.stats.recordTotalDamage(cfg.hp);
    // E4-S6 图鉴：首杀记录（15 敌/Boss；内容 ID 幂等；旧 kind 三敌 enemyId 为 null 跳过）
    if (payload.enemyId) {
      if (this.codex.recordKill(payload.enemyId)) {
        this.codexToastPending = true; // 图鉴 toast（同帧合并，update 末尾 emit）
        // 首杀 Boss/精英 → 功绩 +2/只（E4-S7；精英 = tank 运行时类，Boss = boss 类）
        const kind = payload.enemyType as EnemyKindId;
        if (kind === 'boss' || kind === 'tank') this.firstBossKillsThisRun += 1;
        // B3-W3 渠道 1（默认开）：首精英击杀必掉卡 2（待发队列防卡死 §6.1-4）
        if (kind === 'tank') {
          const r = onEliteKilled(this.mutationPipeline, this.mutationChannels, this.spawner.elapsedSeconds, true);
          if (r.granted) this.applyMutationCard2();
          // B5-W3 Q-f1/f2/f3 首猎之赏：每局首个精英击杀 → 连得 N 次额外 offer（GT-10 串联）
          if (this.treeEliteOffers > 0 && !this.treeEliteOfferConsumed) {
            this.treeEliteOfferConsumed = true;
            this.eliteOfferQueue = this.treeEliteOffers;
            this.eliteOfferQueue -= 1;
            this.triggerExtraOffer();
          }
        }
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
      // W-12 召唤物 noXp 全量（MN-23）：技能召唤实体零宝石路径（无宝石生成 = 天然区分）
      if (!payload.noXp) {
        this.xp.dropGem(payload.xp, payload.x, payload.y);
      }
    }
    // M3 治疗道具（merit-ui-spec §11 + 平衡模拟调整）：精英（tank 槽）掉率 50% / Boss 保底；
    // 普通怪不掉（防掉落稀释）；Boss 保底 100%（shouldDropHeal 内按 HEAL.ELITE_DROP_CHANCE 判定）
    if (shouldDropHeal(payload.enemyType)) {
      this.healManager.dropHeal(payload.x, payload.y);
    }
    if (this.player.stats.applyLifesteal()) {
      GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
    }
    // B6-W4 up_d_rage 失控边缘：狂化期击杀延长 0.5s（上限 +3s）
    if (this.rage.active(this.time.now / 1000) && this.upgradeState.stackOf('up_d_rage') >= 1) {
      this.rageExtraSeconds = Math.min(3, this.rageExtraSeconds + 0.5);
      this.rage.apply(this.time.now / 1000, 6 + this.rageExtraSeconds);
    }
    // 血月狂化衍生技：狂化中击杀回 1 HP（dv_blood_rage 口径沿旧值；与吸血升级/兽血愈合叠加）
    if (this.rage.active(this.time.now / 1000)) {
      const before = this.player.stats.hp;
      this.player.stats.hp = Math.min(
        this.player.stats.maxHp,
        this.player.stats.hp + 1, // dv_blood_rage 口径沿旧值（lifestealOnKill=1）
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

  /** B5-W3 复活瞬间周身击退 100px（§④-1 Q-c：防「复活即死」循环） */
  private onPlayerRevived(args: unknown): void {
    const p = args as { x: number; y: number; knockback: number };
    const kb = p.knockback ?? 0;
    if (kb <= 0) return;
    this.enemyPool.eachActive((e) => {
      if (!e.active) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      if (len > kb + e.radius) return;
      e.setPosition(e.x + (dx / len) * kb, e.y + (dy / len) * kb);
    });
    this.fx.levelUpBurst(p.x, p.y); // 复活演出占位（B6 专有演出）
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
   * B5-W4 衍生技施放入口（桌面 Space/Shift + 移动端技能按钮共用；旧 4 技运行时退役 EG-2）。
   * 门禁沿旧惯例：仅 RUNNING 可释放；CD / 100ms 防抖由 DerivativeSkillController 门控。
   * 效果结算 = castDerivative（CC 走状态层）；施放不打断移动输入。
   */
  private tryCastActiveSkill(): void {
    if (this.state.get() !== GamePhase.RUNNING) return;
    const now = this.time.now / 1000;
    const enemies: Enemy[] = [];
    this.enemyPool.eachActive((e) => enemies.push(e));
    // Q-b/Q-d 场景下左轮可能已在手（弹巢引用给破旧提灯技补满+无限弹）
    let ammo: import('@/weapons/ammo').AmmoState | undefined;
    if (this.ownedWeaponIds.includes('xw_revolver' as unknown as WeaponId)) {
      const revolver = this.weaponSystem.exclusiveBehaviors.xw_revolver as unknown as { getState(): { ammo: import('@/weapons/ammo').AmmoState } };
      ammo = revolver.getState().ammo;
    }
    const result = this.derivativeController.tryCast(now, {
      player: { x: this.player.x, y: this.player.y, hp: this.player.stats.hp, maxHp: this.player.stats.maxHp },
      enemies: enemies as unknown as import('@/weapons/exclusive/exclusive-math').ExclusiveTarget[],
      healSink: (h) => {
        const applied = this.player.stats.heal(h);
        if (applied > 0) GameEvents.emit(GameEvent.HpChanged, { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp });
      },
      ammo,
      // B6-W4 P4 形态挂点：贯月审判图腾 / 终审庭余焰 → R-4/R-6 持续段（WeaponSystem 桥接）
      totemSink: (x, y) => this.weaponSystem.placeResonanceTotemAt(x, y),
      residueSink: (x, y) => this.weaponSystem.placeResonanceResidueAt(x, y),
    });
    if (!result) return;
    this.stats.recordActiveSkillCast();
    // B6-W5 遥测：衍生技伤害累计 + 占比分母
    this.stats.recordDerivativeDamage(result.damageDealt);
    this.stats.recordTotalDamage(result.damageDealt);
    this.player.beginSkillPose();
    // 血月狂化衍生技：RageBuff 增益（伤害 +40% / 移速 +15%，GDD §4.6；旧接触光环随旧技退役）
    if (result.events.includes('rage')) {
      this.rage.apply(now, 6);
      this.player.stats.setRageBonus(0.4);
      this.player.stats.rageSpeedPct = 0.15;
      this.fx.rageBurst(this.player.x, this.player.y);
      this.player.setScale(FX.SKILL_RAGE_SCALE);
    }
    // 通用施法表现：技能环（B6 逐技演出细化）
    const frames = SKILL_RING_FRAMES[this.heroId as keyof typeof SKILL_RING_FRAMES];
    if (frames) this.fx.playSkillRing(this.player.x, this.player.y, 200, frames);
    if (result.events.includes('heal')) {
      this.fx.requiemHeal(this.player.x, this.player.y);
    }
  }

  /** 血月狂化衍生技：buff 生效/失效同步（伤害 +40% / 移速 +15%；旧接触光环随旧技退役移除） */
  private updateRage(dt: number, now: number): void {
    void dt;
    const active = this.rage.active(now);
    const stats = this.player.stats;
    if (active && stats.rageBonusMultiplier === 0) {
      stats.setRageBonus(0.4);
      stats.rageSpeedPct = 0.15;
      this.player.setScale(FX.SKILL_RAGE_SCALE);
    } else if (!active && stats.rageBonusMultiplier !== 0) {
      stats.setRageBonus(0);
      stats.rageSpeedPct = 0;
      this.player.setScale(1);
    }
  }

  /** B5-W3 Q-s1 银炉预热：开局 30s 窗口伤害 ×1.2（攻速 +20% 经全局冷却乘区登记，模拟批次校准） */
  private s1WindowDamageMult(): number {
    if (this.treeS1UntilElapsed < 0) return 1;
    return this.spawner.elapsedSeconds <= this.treeS1UntilElapsed ? 1.2 : 1;
  }

  /** B5-W2 结算页「余辉行」数据接口（B6 渲染）：s3 终局折算 +2 余辉 */
  getTreeMeritBonus(): number {
    return this.treeS3MeritBonus;
  }

  /** B5-W2 树应用快照（B6 HUD 复活次数指示 / 开局阵容来源徽记消费） */
  getTreeApplication(): TreeApplication | null {
    return this.treeApp;
  }

  /** B5-W3 复活判定序挂钩（护盾→圣物预留→天赋复活→死亡；s3 遗言余烬随死亡事件结算） */
  private judgePlayerRevive(_now: number): { revived: boolean; hpPct: number; invulnSeconds: number; knockback: number } | null {
    const verdict = judgeRevive({
      shieldAvailable: false, // up_g_8 护盾在 absorbDamage 上游消费（未死路径），此处为死局判定
      relicFreeDeathAvailable: false, // 圣物级免死接口预留（当前圣物池无）
      talentChargesRemaining: this.treeReviveRemaining,
      talentRevivesUsed: this.treeRevivesUsed,
    });
    if (verdict === 'talent') {
      const hpPct = talentReviveHpPct(this.treeRevivesUsed);
      this.treeRevivesUsed += 1;
      this.treeReviveRemaining -= 1;
      this.stats.recordTalentRevive(); // B6-W5 复活触发遥测（HUD 复活次数同源）
      // Q-s3：被复活来源救回 → 原地掉落余烬宝石（首次 HP 归零事件）
      if (this.treeS3Active && !this.treeS3EmberUsed) {
        this.treeS3EmberUsed = true;
        this.xp.dropGem(TALENT_S3_EMBER.XP, this.player.x, this.player.y);
      }
      return { revived: true, hpPct, invulnSeconds: talentReviveInvulnSeconds(), knockback: talentReviveKnockbackPx() };
    }
    if (verdict === 'death' && this.treeS3Active && !this.treeS3EmberUsed) {
      // Q-s3：无复活来源终局 → 宝石折算 +2 余辉（遗言化作传承；结算页数据接口）
      this.treeS3EmberUsed = true;
      this.treeS3MeritBonus = TALENT_S3_EMBER.MERIT_NO_REVIVE;
    }
    return null;
  }

  /** B5-W4 v3 抽取上下文装配（onLevelUp / 精英 offer 共用；Q-s4 前置经 takenMutation/derivative 标记） */
  private buildUpgradeContext(): UpgradePoolV3Context {
    return {
      heroId: this.heroId,
      ownedWeaponIds: [...this.ownedWeaponIds],
      runTimeSeconds: this.spawner.elapsedSeconds,
      exclusiveId: this.currentExclusiveId,
      derivativeId: EXCLUSIVE_TO_DERIVATIVE[this.currentExclusiveId],
      takenMutationOrders: this.takenMutationOrders(),
      upgradeCount: this.upgradeChoiceCount,
      derivativeUpgradeTaken: this.upgradeState.stackOf(EXCLUSIVE_TO_DERIVATIVE[this.currentExclusiveId]) >= 1,
    };
  }

  /** B5-W3 Q-f1/f2/f3：首精英击杀额外 offer（不消耗 XP；立即结算非暂存，GT-10 串联） */
  private triggerExtraOffer(): void {
    const v3Ctx = this.buildUpgradeContext();
    const options = rollThreeV3(this.upgradeState, v3Ctx);
    if (options.length === 0) return;
    this.lastOptionsV2 = options;
    this.stats.recordUpgradeOffered(options);
    this.stats.recordEliteOffer(); // B6-W5 精英抽卡遥测（Q-f 串联每次）
    GameEvents.emit(GameEvent.UpgradeOffered, { options });
    this.fx.levelUpBurst(this.player.x, this.player.y);
    if (this.isBench) {
      const first = options[0];
      this.onUpgradeChosen({ optionId: first?.upgradeId ?? first?.evoId ?? 'up_g_1', index: 0, dwellSeconds: 0 });
      return;
    }
    this.overlay.showV2(options);
    this.state.set(GamePhase.LEVEL_UP);
  }

  /** B5-W4 树应用写回（A-2：属性段进 PlayerStats；调用时序 = XpManager 装配前，QA-FIX-3 纪律沿袭） */
  private applyTreeToStats(app: TreeApplication): void {
    const a = app.attributes;
    const stats = this.player.stats;
    if (a.maxHp > 0) {
      stats.maxHp += a.maxHp;
      stats.hp += a.maxHp;
    }
    // 伤害桶：伤害 % + 攻击 flat 折算（+2 基础伤 ≈ +2% 等效锚；逐武器斜率差异待模拟 GDD §4.2 A-1）
    const damagePct = a.damagePct + a.attackFlat * 0.01;
    if (damagePct > 0) stats.addDamageBonus(damagePct);
    if (a.moveSpeedPct > 0) stats.addMoveSpeedPctBonus(a.moveSpeedPct);
    if (a.magnetRadius > 0) stats.magnetRadiusBonus += a.magnetRadius;
    if (a.pickupRadius > 0) stats.pickupRadiusBonus += a.pickupRadius;
    if (a.healEfficiencyPct > 0) stats.healBoostMultiplier += a.healEfficiencyPct;
    // 属性攻速/冷却机制实装登记：折算已计入三桶断言（模拟批次校准）；B6 全局乘区接线
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
    // B3-W2：v3 池抽取（37 定义 / 单局 ≤30 + P1~P5 保底 + 席位冲突裁决 + 阶段权重修订）
    this.upgradeChoiceCount += 1;
    const options = rollThreeV3(this.upgradeState, this.buildUpgradeContext());
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
      // B5-W3 Q-f 串联：elite offer 队列未清空 → 下一发（同帧连发语义经链式结算）
      if (this.eliteOfferQueue > 0) {
        this.eliteOfferQueue -= 1;
        this.triggerExtraOffer();
      }
    }
  }

  /** QA-BUG-1 拆分：选卡消费主体（异常由 onUpgradeChosen 捕获保活）。
   *  B3-W4 legacy 双池清偿：evo_ 进化分支随超武退役（R2-3）移除；legacy 数字 id 分支退役（v1 引擎归档 EG-2）。 */
  private consumeUpgradeChoice(payload: UpgradeChosenPayload): void {
    const upId = payload.optionId as UpgradeId;
    const result = applyUpgradeByIdV3(this.upgradeState, this.upgradeV3Targets, upId, {
      ownedWeaponIds: [...this.ownedWeaponIds],
      random: Math.random,
    });
    this.upgradeState.lastPickId = upId; // 防重复 ×0.5（沿袭）
    // B4-W1 共鸣达成检查：取钥后双条件判定（持配对专武 ∧ 持钥）→ 原子形态切换
    if (upId.startsWith('key_')) {
      const pair = this.weaponSystem.tryResonance(this.currentExclusiveId, (k) => this.upgradeState.hasKey(k));
      if (pair) {
        // 共鸣达成遥测（达成率/各对选取分布，GDD §⑧-6）
        this.stats.recordResonance(pair.id, this.spawner.elapsedSeconds);
        GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: pair.commonWeaponId, name: `共鸣·${pair.name}` });
        // B5-W4 R-5 圣域壁垒收拢：壁垒承伤减免 −10% → −18%（+8pp 叠加进 PlayerStats 减伤池）
        if (pair.id === 'R5') this.player.stats.addDamageReduction(0.08);
      }
    }
    // B3-W3 质变卡管线回调：卡 1 = P1 席位承载（含待发队列立即补发）；其余升级计入兜底 N
    if (upId === `mc_${this.currentExclusiveId.slice(3)}_1`) {
      const { card2Granted } = takeCard1(this.mutationPipeline, this.spawner.elapsedSeconds);
      if (card2Granted) this.applyMutationCard2();
      this.stats.recordMutationTaken(1, this.spawner.elapsedSeconds); // B6-W5 双节拍遥测
    } else if (upId === `mc_${this.currentExclusiveId.slice(3)}_2`) {
      takeCard2(this.mutationPipeline, this.spawner.elapsedSeconds);
      this.stats.recordMutationTaken(2, this.spawner.elapsedSeconds);
    } else {
      onUpgradeChosenForPipeline(this.mutationPipeline, this.mutationChannels, this.spawner.elapsedSeconds);
    }
    const item = poolItemByIdV3(upId);
    if (item) this.stats.recordUpgradeChosen(0, item.name, this.spawner.elapsedSeconds);
    this.stats.recordHesitationV2(payload.dwellSeconds ?? 0, this.lastOptionsV2);
    // E4-S5 解锁变体：onWeaponUnlocked 已由 unlockWeapon 目标处理（unlockVariant 仅返回）
    void result;
  }

  /** B3-W3：卡 2 写回（管线 granted 后调用；顺序解锁已由管线保证） */
  private applyMutationCard2(): void {
    const card2Id = `mc_${this.currentExclusiveId.slice(3)}_2` as UpgradeId;
    applyUpgradeByIdV3(this.upgradeState, this.upgradeV3Targets, card2Id, {
      ownedWeaponIds: [...this.ownedWeaponIds],
      random: Math.random,
    });
  }

  /** B3 v3：当前已取质变卡 order 列表（P1 全局限 1 / 满层剔除上下文） */
  private takenMutationOrders(): (1 | 2)[] {
    const orders: (1 | 2)[] = [];
    if (this.upgradeState.stackOf(`mc_${this.currentExclusiveId.slice(3)}_1`) >= 1) orders.push(1);
    if (this.upgradeState.stackOf(`mc_${this.currentExclusiveId.slice(3)}_2`) >= 1) orders.push(2);
    return orders;
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
