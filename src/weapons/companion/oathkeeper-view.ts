/**
 * weapons/companion/oathkeeper-view.ts —— 守誓者局内可视化「纯决策器」（批次 D）
 *
 * 输入状态 → 输出「该显示什么 / 播哪一态 / 是否翻转 / y 偏移多少」。
 * **零 Phaser 依赖、零副作用、无对象创建（out 可复用）**，因此可脱离引擎单测
 * （全仓 `grep -rln "from 'phaser'" tests/` 为空 → Phaser 壳无法单测，决策逻辑必须纯）。
 *
 * 关系（方案 §3.1 两文件分层）：
 * - 本文件 = 纯决策（批次 D，本批）；
 * - Phaser 壳（持有 Sprite / setTexture / setDepth）＝ 批次 E，**不在本文件**。
 *   建议 E 批把壳另起 `oathkeeper-view-sprite.ts`（或本文件追加 class），**不要**重命名本文件。
 *
 * 规格来源：
 * - `production/official-v1/守誓者局内可视化补充方案-2026-11-06.md` §3.2 / §3.4（工程方案）
 * - `design/art-bible/dev-handoff-oathkeeper-view-v1.md` §3.3 / §5（主程交付单）
 * - `design/art-bible/ta-handoff-192-oathkeeper-v1.md`（TA 交付单）
 *
 * ── 判定铁律（优先级自上而下，命中即返回） ──────────────────────────────
 * 1. `phase === 'gone'`                  → `hidden`（不可见）
 * 2. `phase === 'tombstone'`             → `tombstone`（**相位压过 attack/idle/move**）
 * 3. `sinceBiteMs < 150`                 → `attack`（**瞬时动作压过 idle/move**）
 * 4. `speed > 5`                         → `move`
 * 5. 其余                                 → `idle`
 *
 * ── 为什么撕咬信号用 sinceBiteMs 而不是事件总线 ────────────────────────
 * `tickBite()` 已返回 `dealt`、`OathkeeperRuntime.update()` **原样返回**，只是
 * `PlayScene.ts:1019` 把返回值丢掉了 → 上层接一个变量即可得到「距上次撕咬的毫秒数」。
 * 单消费者 + 相位是状态不是事件 → 事件总线在此是纯开销，还会引入 `scene.restart` 订阅泄漏。
 * **本函数不订阅任何东西、不改 PlayScene**（接线是批次 E 的事）。
 *
 * ── 严禁走 `playVisual` / `createCharacterAnims` ───────────────────────
 * `src/fx/anim.ts:139-163` 会为基帧**自动**建 6fps 的 `summon-oathkeeper-move`。
 * 壳若对它 `play()` 同名 key，6fps 的抽搐会压过本决策器算出的 330ms/帧步进。
 * 本批只输出「态」，帧名与步进累加器由批次 E 的壳手动 `setTexture` 步进。
 *
 * ── 本批不做（已知缺口，交接 E/后续批） ────────────────────────────────
 * - 帧名与 walk 步进累加器（input 契约无 `walkElapsedMs`，本批不引入）；
 * - 「瞬移护栏」（方案 §3.2 `hypot(dx,dy) > 400`）：本函数只收 `speed`，**护栏属于算 speed 的上层**
 *   （见下方 `speed` 的入参契约）。复活/重召唤那一帧上层应传 `speed = 0`，否则会抽 1 帧 move；
 * - `-v` 呼吸：实测 `-v` 与 idle **md5 相同**（逐像素零差异）→ 不做（方案 §4-R4）。
 */

import type { OathkeeperPhase } from '@/weapons/companion/oathkeeper';

/** 可视态（`tombstone` 为相位态，与 §3.1 的 `OathkeeperVisual` 对齐） */
export type OathkeeperViewState = 'idle' | 'move' | 'attack' | 'tombstone' | 'hidden';

/**
 * 移动阈值（px/s）：与 `src/fx/anim.ts:169` 的 `isMoving`（|vx|+|vy| > 5）同口径。
 * 低于此值视为静止，避免极小漂移导致 idle/move 抖动换帧。
 * **边界语义**：`speed === 5` → idle；`speed === 5.1` → move（严格大于才算移动）。
 */
export const MOVE_SPEED_THRESHOLD = 5;

/**
 * 撕咬姿态保持时长（ms）：交付单 §3.3「~150ms 后回 idle」。
 * **边界语义**：`sinceBiteMs === 149` → attack；`sinceBiteMs === 150` → 回落（严格小于）。
 */
export const ATTACK_HOLD_MS = 150;

/**
 * 深色排序（主理人裁决 ②：30）。
 *
 * 全仓 depth 实测：地图 -100…-90 / 敌人 **0**（`src/enemies/` 零 `setDepth` = Phaser 默认 0）/ marker 20 /
 * chest 25 / aura 40 / bounds 50 / shockwave 85 / orbit 90 / **玩家 100**（`src/player/player.ts:52`）。
 * 取 30 的理由：高于敌人(0) → 不被敌群淹没（**这正是本任务要修的问题：他必须始终看得见**）；
 * 低于 aura(40)/orbit(90)/player(100) → 状态图标与玩家永不被压。
 * 代价：会盖住 marker(20) 与宝箱(25) —— 可接受（他常规距玩家 60px，宝箱瞬拾）。
 * 备选 `-1`（严格背景层）改这一个常量即可实机对比。
 */
export const OATHKEEPER_DEPTH = 30;

/**
 * 朝向死区（px）：复用 `src/fx/anim.ts:17` 的 `FACING_DEADZONE` 口径。
 * ⚠ 这里**有意重复定义**而不 `import`：`anim.ts` 顶部 `import Phaser`，一旦引入就会把 Phaser
 * 拖进本模块，本模块立刻不可单测（违反批次 D 的全部意义）。改 anim 的值时请同步此处。
 */
export const FACING_DEADZONE = 8;

/* ────────────────────────── 脚底线（§3.4 复算） ──────────────────────────
 *
 * 目标：**脚底对齐 `state.y`**，即守誓者的脚与玩家踩在同一条地面线上。
 * 玩家在世界内是 `hero-*`（128 画布，`visualFrameForContent` 恒取 `hero-*`），
 * `state.y` 跟随 `player.y`（`FOLLOW_DISTANCE = 60` 内即等同）。
 *
 * 0.5 的口径：地面线取「最低不透明像素行的中心」= footY + 0.5（与方案 §3.4 一致）。
 * 锚点：默认 `origin 0.5` → 锚点 y = canvasH / 2。显示缩放 = `combatDisplayScale(frameW)`
 * （`src/fx/combat-display-scale.ts:8`：`frameW >= 128` → 1，否则 `128 / frameW`）。
 *
 * 实测（2026-11-06，`tools/scheme-c/read-png.mjs` 逐个解码取最低不透明行 alpha > 0）：
 *   frame                                    canvas   最低行   anchor   脚在锚点下 × scale
 *   assets/frames/hero-violet.png            128×128   127     64      127.5 − 64         = 63.5   （scale 1）
 *   …/20261104-oath/sets/summon-oathkeeper-idle.png  192×192  191   96   191.5 − 96      = 95.5   （scale 1）
 *   assets/frames/summon-oathkeeper-tombstone.png    48×48    45    24   (45.5 − 24)×8/3 = 57.3333（scale 2.667）
 *
 * ⇒ 192 躯干：yOffset = 63.5 − 95.5 = **−32**
 *    （正文算式同方案 §3.4：96 − 191.5 + 127.5 = 32 → `sprite.y = state.y − 32`；
 *     照字面写 `sprite.y = state.y` 会让脚**沉到地面下 32px** = 他体高 167 的 19%，肉眼立刻看出"站在坑里"）
 * ⇒ 旧 48 墓碑：yOffset = 63.5 − 57.3333 = **+37/6 ≈ +6.1667**
 *    （48 图按 128 世界边放大 2.667× 后，脚只落在锚点下 57.33；不补偿就会**浮起** 6.17px）
 * ⇒ 未来 192 墓碑（同基准入盒、脚底 191）：与躯干同为 **−32**。
 *
 * 为什么不用 `setOrigin(0.5, 0.9974)`：全仓角色/敌人一律默认 origin（`player.ts` 也是），
 * 集中在一处用常量偏移，比"给一个精灵改 origin"更不容易被后人误读成特例。
 */
/** 玩家（128 画布英雄）脚底在锚点下方的世界 px */
export const PLAYER_FOOT_OFFSET = 63.5;
/** 192 画布守誓者脚底在锚点下方的世界 px（scale 1） */
export const BODY_192_FOOT_OFFSET = 95.5;
/** 旧 48 墓碑帧脚底在锚点下方的世界 px（scale 128/48 = 8/3） */
export const TOMBSTONE_48_FOOT_OFFSET = 57 + 1 / 3;

/** 192 躯干（idle/move/attack）yOffset：63.5 − 95.5 = **−32**（脚底对齐 state.y） */
export const Y_OFFSET_BODY_192 = PLAYER_FOOT_OFFSET - BODY_192_FOOT_OFFSET;
/** 旧 48 墓碑 yOffset：63.5 − 57.3333 = **37/6 ≈ +6.1667**（放大后脚偏浅，需下移补偿） */
export const Y_OFFSET_TOMBSTONE_48 = PLAYER_FOOT_OFFSET - TOMBSTONE_48_FOOT_OFFSET;
/** 未来 192 墓碑 yOffset（同基准入盒、脚底 191）→ 与躯干一致 = −32 */
export const Y_OFFSET_TOMBSTONE_192 = PLAYER_FOOT_OFFSET - BODY_192_FOOT_OFFSET;

/** 墓碑精灵策略 */
export type OathkeeperTombstonePolicy =
  /** 方案 §3.5 A 案（默认）：用旧 48 图 + `applyCombatDisplayScale` → 128 世界 px 的跪姿剪影 */
  | 'legacy48'
  /** 直接隐藏（任务书 ② 的建议分支）：`state` 仍报 `tombstone`，仅 `visible=false` */
  | 'hidden';

export interface OathkeeperViewInput {
  /** 相位（`rt.state.phase`，只读轮询；`OathkeeperState.phase`） */
  phase: OathkeeperPhase;
  /**
   * 当前速度 px/s（来自 `state` 位移差：`hypot(dx,dy)/dt`）。
   * **入参契约**：非有限值（NaN / ±Infinity）按「不移动」处理（防 NaN 漏进状态判定）。
   * 瞬移护栏（方案 §3.2 `hypot(dx,dy) > 400`）由**算 speed 的上层**负责：判为瞬移时传 `0`
   * （复活/重召唤/首次入场那一帧，否则会抽 1 帧 move）。
   */
  speed: number;
  /**
   * 距上次撕咬的毫秒数。`Infinity` = 从未撕咬。
   * 来源：`OathkeeperRuntime.update()` 的返回值 `dealt > 0` 的那一帧记 `0`，此后累加 dt。
   */
  sinceBiteMs: number;
  /** 玩家 x */
  playerX: number;
  /** 守誓者 x（`rt.state.x`） */
  selfX: number;
  /** 是否有 192 墓碑帧可用。本批 false（192 墓碑图未产出 → 走 `legacy48` 分支的 yOffset） */
  hasTombstoneFrame192?: boolean;
  /**
   * 上一帧的 `flipX`。**提供时**启用 8px 死区（方案 §3.2：死区内保持上一帧朝向，
   * 防玩家位于正上/正下方时逐帧翻面抖动）；**不提供时**严格按 `selfX` vs `playerX` 比较（死区 0）。
   * 批次 E 接线应每帧回传，才能拿到死区保护。
   */
  prevFlipX?: boolean;
  /** 墓碑精灵策略，默认 `legacy48`（方案 §3.5 A 案）。见 `OathkeeperTombstonePolicy` */
  tombstonePolicy?: OathkeeperTombstonePolicy;
}

export interface OathkeeperViewOutput {
  /** 可视态（决策结果） */
  state: OathkeeperViewState;
  /** 是否绘制精灵。`state==='tombstone'` 且 `tombstonePolicy==='hidden'` 时唯一出现 `visible=false` 的墓碑 */
  visible: boolean;
  /** 是否水平翻转（原图朝右；`true` = 朝左） */
  flipX: boolean;
  /** 相对 `state.y` 的 y 偏移（脚底线补偿；见本文件顶部脚底推导） */
  yOffset: number;
  /** depth 建议值（常量 30；见 `OATHKEEPER_DEPTH`） */
  depth: number;
}

/** 新建输出对象（壳在构造时建一次并复用传入 `resolveOathkeeperView(i, out)` → 热路径零分配） */
export function createOathkeeperViewOutput(): OathkeeperViewOutput {
  return { state: 'hidden', visible: false, flipX: false, yOffset: 0, depth: OATHKEEPER_DEPTH };
}

/**
 * 朝向：原图朝右（美术斜向右下 30°，**不旋转**，斜角已画进帧里）。
 * - 玩家在右（`dx > deadzone`）→ `false`（不翻转）
 * - 玩家在左（`dx < -deadzone`）→ `true`
 * - 死区内 → 保持 `current`；**坐标相等 / 死区为 0 时相等 → `false`（原图朝向）**
 */
function facingFlipX(dx: number, current: boolean, deadzone: number): boolean {
  if (dx > deadzone) return false;
  if (dx < -deadzone) return true;
  return current;
}

/**
 * 纯决策：输入状态 → 输出「显示什么、播哪一态、是否翻转、y 偏移、depth」。
 *
 * @param input 输入快照（不修改）
 * @param out   可选复用输出对象（**热路径必须传**，避免每帧分配）
 * @returns 同一 `out`（或新建对象）
 */
export function resolveOathkeeperView(
  input: OathkeeperViewInput,
  out: OathkeeperViewOutput = createOathkeeperViewOutput(),
): OathkeeperViewOutput {
  // ── 朝向先算（各态共用；与相位/速度无关） ──
  const dx = input.playerX - input.selfX;
  const deadzone = input.prevFlipX === undefined ? 0 : FACING_DEADZONE;
  const flipX = facingFlipX(dx, input.prevFlipX ?? false, deadzone);

  out.flipX = flipX;
  out.depth = OATHKEEPER_DEPTH;

  // ── 规则 1：gone → hidden（不可见；重召唤计时期无实体） ──
  if (input.phase === 'gone') {
    out.state = 'hidden';
    out.visible = false;
    out.yOffset = 0;
    return out;
  }

  // ── 规则 2：tombstone（**相位优先级最高**，压过 attack；见方案 §3.2 铁律） ──
  if (input.phase === 'tombstone') {
    out.state = 'tombstone';
    // 192 墓碑图本批未产出：legacy48 用旧 48 图（方案 §3.5 A 案，可读性 > 精致度）；
    // 'hidden' 分支仍报 state='tombstone'（上层据此知道"该显示墓碑"），只是不绘制。
    out.visible = (input.tombstonePolicy ?? 'legacy48') !== 'hidden';
    out.yOffset =
      input.hasTombstoneFrame192 === true ? Y_OFFSET_TOMBSTONE_192 : Y_OFFSET_TOMBSTONE_48;
    return out;
  }

  // ── 以下均为 phase === 'companion'（visible 恒 true） ──
  out.visible = true;
  out.yOffset = Y_OFFSET_BODY_192;

  // ── 规则 3（语义第 5 条）：撕咬保持窗口内 → attack（**压过 idle/move**） ──
  // sinceBiteMs = Infinity（从未撕咬）/ NaN 时 `sinceBiteMs < ATTACK_HOLD_MS` 为 false → 自然回落。
  if (input.sinceBiteMs < ATTACK_HOLD_MS) {
    out.state = 'attack';
    return out;
  }

  // ── 规则 4/5：速度分档（复用 anim.ts 的 5px/s 同口径） ──
  // 非有限值（NaN/Infinity）按不移动处理：否则 `NaN > 5` 与 `NaN <= 5` 同为 false → 漏进 move。
  const moving = Number.isFinite(input.speed) && input.speed > MOVE_SPEED_THRESHOLD;
  out.state = moving ? 'move' : 'idle';
  return out;
}
