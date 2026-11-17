/**
 * weapons/companion/oathkeeper-view-sprite.ts —— 守誓者局内可视化「Phaser 壳」（批次 E）
 *
 * 与 `oathkeeper-view.ts`（批次 D 纯决策器）的分层：
 * - 决策器：输入快照 → 输出「该显示什么 / 哪一态 / 翻转 / y 偏移 / depth」。零 Phaser、零副作用、可单测。
 * - 本文件：**只做"把决策结果落到 Phaser 对象"**——持有 `Sprite`、算 `speed` / `sinceBiteMs`、
 *   维护 walk 步进累加器、按态选帧名、每次换帧后重算显示缩放。**不重新判定任何态**。
 *
 * 数据流（每帧一次，纯轮询、无事件总线）：
 * ```
 *   rt.state (phase/x/y, 只读)  ─┐
 *   player.x                    ─┤
 *   prevX/prevY 差分 → speed    ─┼→ resolveOathkeeperView(...) → out{state,visible,flipX,yOffset,depth}
 *   sinceBiteMs（notifyBite 供）─┘                                  │
 *                                            frameFor(out.state) ───┤
 *                                                                   ↓
 *                        sprite.setVisible/setTexture/setFlipX/setPosition/setDepth
 *                        ＋ 换帧后 applyCombatDisplayScale
 * ```
 *
 * ── 三条硬性接线纪律（批 D 报告 §7 / 方案 §3.2） ────────────────────────────
 * 1. **瞬移护栏放在"算 speed"处**（`measureSpeed`）：单帧位移 > `TELEPORT_GUARD_PX`(400) 判为瞬移 →
 *    本帧 `speed = 0`（决策器拿到 0 → idle，不会抽 1 帧 move 抖动）。阈值理由见该常量注释。
 * 2. **每次换帧后必调 `applyCombatDisplayScale`**：192 躯干帧 scale=1、48 墓碑帧 scale=128/48=2.667；
 *    漏调则墓碑按 1:1 渲染成 48px（玩家 128 有缩放，他必须同口径）。**不在换帧路径外调**（省 setScale）。
 * 3. **`prevFlipX` 跨帧回传** `sprite.flipX`：决策器的 8px 死区只在提供 `prevFlipX` 时生效
 *    （不提供 = 死区 0 = 玩家站正上方时逐帧翻面抖动）。
 *
 * ── 帧序与时长（裁定值，改一处要连报告一起改） ────────────────────────────
 * | state     | 帧                                             | 时长 |
 * |-----------|------------------------------------------------|------|
 * | idle      | `summon-oathkeeper`（**不切 `-v`**，裁决①）      | —    |
 * | move      | `-walk-a → b → c → d`（循环，回到 a）           | 180ms/帧（A/B 后定值）|
 * | attack    | `-attack-a`(起手) → `-attack-b`(收势)           | 75ms/帧（合计 150ms） |
 * | tombstone | `-tombstone`（旧 48 图，yOffset = +37/6）        | —    |
 * | hidden    | 不渲染（`visible=false`）                       | —    |
 *
 * **180ms 依据**（NV-ENG-EXEC-27 A/B；取代交付单 §3.3 的 330）：
 * 330ms × 4 = 1320ms/圈虽符合"板甲重甲缓慢踏步"的节奏，但每姿势地面滑过 39.6px（美术每帧只有 12.44px）
 * → 滑步比 3.18（FAIL）；180ms 把每姿势滑步压到 21.6px（1.74，CONCERNS 内），
 * 同时 5.56 姿势/秒仍低于"像抽搐"的 155ms（6.45 姿势/秒）。两侧代价见该常量的注释与 A/B 报告。
 *
 * **attack 双帧 75/75 依据**：决策器的 `ATTACK_HOLD_MS = 150` 是**已定稿**的窗口（批次 D 64 例覆盖）。
 * 两帧均分 150ms → 收势帧恰好在窗口最后一帧被看到，既不越界（>150 会被决策器截断成 idle/walk，
 * 出现"砍到一半突然站直"）也不冗余。方案 §3.2 建议的 100+100=200ms 会**超出**该窗口 33%，
 * 故不采用；单帧 150ms 只"闪一下"，读不出"抬手→落下"，故也不采用。
 *
 * ── 闸门：`enabled` 在壳里，不在决策器里 ─────────────────────────────────
 * 决策器契约**有意不含 `enabled`**（批次 D 接口 5 字段定稿）。而 `createOathkeeperState` 默认
 * `phase='companion'` → 未启用（非薇奥莱 / 未选圣铃）时若直接渲染，会给**所有角色**画一个骑士。
 * 因此本壳在调用决策器**之前**短路 `!rt.isEnabled` → `setVisible(false)`（见 `update`）。
 *
 * ── 严禁走 `playVisual` / `createCharacterAnims` ───────────────────────────
 * `fx/anim.ts:139-163` 会为基帧自动建 **6fps** 的 `summon-oathkeeper-move` 动画与 `-idle`。
 * 壳若 `play()` 同名 key，6fps 抽搐会压过本壳的 180ms/帧步进 → 本壳只手动 `setTexture`，**不起 anim**。
 */

import type Phaser from 'phaser';
import { applyCombatDisplayScale } from '@/fx/combat-display-scale';
import {
  ATTACK_HOLD_MS,
  OATHKEEPER_DEPTH,
  Y_OFFSET_BODY_192,
  createOathkeeperViewOutput,
  resolveOathkeeperView,
  type OathkeeperViewOutput,
  type OathkeeperViewState,
} from '@/weapons/companion/oathkeeper-view';
import type { OathkeeperRuntime } from '@/weapons/companion/oathkeeper-runtime';

/** 纹理 key（帧名全在 `characters` 图集；M4 只换图不换名） */
export const OATHKEEPER_TEXTURE_KEY = 'characters';

/** idle 基帧（裁决①：`-v` 与基帧逐像素相同 → 本版不做呼吸） */
export const OATHKEEPER_FRAME_IDLE = 'summon-oathkeeper';
/** 旧 48 墓碑帧（192 墓碑图未产出；`legacy48` 策略，放大 2.667× 使用） */
export const OATHKEEPER_FRAME_TOMBSTONE = 'summon-oathkeeper-tombstone';
/** 咬合起手帧 */
export const OATHKEEPER_FRAME_ATTACK_A = 'summon-oathkeeper-attack-a';
/** 咬合收势帧 */
export const OATHKEEPER_FRAME_ATTACK_B = 'summon-oathkeeper-attack-b';

/**
 * move 循环帧序 **a→b→c→d**（交付单 §3.3 锁定；与 `anim.ts` 的六帧序 `a,e,b,c,f,d` 无关——
 * 本角色只有 4 帧，且 `.a-e-b-c-f-d` 是"接触→落下→经过"的六帧语义，硬套到 4 帧会变成倒退走）。
 */
export const OATHKEEPER_WALK_FRAMES = [
  'summon-oathkeeper-walk-a',
  'summon-oathkeeper-walk-b',
  'summon-oathkeeper-walk-c',
  'summon-oathkeeper-walk-d',
] as const;

/**
 * walk 每帧毫秒。**330 → 180**（NV-ENG-EXEC-27 A/B 复核后的取值；330 为批 E/批次 E 定稿值）。
 *
 * 裁定依据（数字与证据见 `production/official-v1/守誓者批F-AB对比报告-2026-11-09.md`）：
 * - 滑步比 = `FOLLOW_SPEED × WALK_FRAME_MS ÷ 美术每帧位移 12.44px`
 *   → **330ms = 3.18（>1.8 FAIL）／180ms = 1.74（CONCERNS 上界内，留 6% 余量）**；
 * - 每姿势位移（= 地面从他脚下滑过的量）**40.0px → 21.9px**（÷ 内容宽 78px：0.51 → 0.28）；
 * - 节奏：一圈 **1320ms → 720ms**，对成人完整步行循环 0.8~1.0s 从"偏慢 32%~65%"变为"偏快 10%~28%"；
 * - 姿势停留率 3.03 → 5.56 次/秒，仍低于当年被否的 155ms（6.45 次/秒）；60fps 下每姿势仍停 ~11 帧。
 *
 * ⚠ **本值不解决"跺步感"**：走帧 a≈c、b≈d（同一只脚两次在前，批 F 实测），眼睛只看到 2 个真姿势在开合。
 * 该缺陷只能靠美术补交替步帧（M-2）解决；本常量只负责把"滑"压到阈值以内。
 *
 * 4 帧覆盖 2 个半步：用角色动画的 ~155ms/帧 播会像抽搐（交付单实测结论）。
 */
export const WALK_FRAME_MS = 180;

/**
 * attack 起手帧时长 = `ATTACK_HOLD_MS / 2` = **75ms**（两帧均分决策器的 150ms 保持窗口）。
 * 不写字面量 75 而写除法：窗口一旦调整，两帧自动跟随，不会出现"帧比窗口长"的截断。
 */
export const ATTACK_FRAME_A_MS = ATTACK_HOLD_MS / 2;

/**
 * 瞬移护栏阈值（px / 单帧）——方案 §3.2 原值 400。
 *
 * 为什么 400 合理（而不是"随便一个大数"）：
 * - 常规帧：`clampDelta` 上限 50ms（`core/time.ts`），`FOLLOW_SPEED` 120px/s → 合法单帧位移 **≤ 6px**；
 * - 极端掉帧：`clampDelta` 硬上限 250ms → 合法单帧位移 **≤ 30px**；
 * - 400px ≈ 极端合法位移的 **13 倍**、常规的 **66 倍** → 正常跟随**永不误判**，
 *   而复活/重召唤/首帧错位这类真瞬移（≥ 数百 px）一定会被抓到。
 *
 * 误判后果不对称：误判为瞬移 → 只丢 1 帧 move（退化成 idle，肉眼不可见）；
 * 漏判 → speed 被算成数千 px/s（本身无害，因为决策器只做 `speed > 5` 分档），
 * 真正要防的是"重生在远端那一帧被算成 move 并让 walk 累加器从 c 帧起步"——护栏已一并归零累加器。
 */
export const TELEPORT_GUARD_PX = 400;

/** 壳的依赖（结构最小化：`player` 只要 x/y，便于单测传纯对象） */
export interface OathkeeperViewSpriteScene
  extends Pick<Phaser.Scene, 'add' | 'textures'> {}

/**
 * 守誓者可视化壳：唯一持有 `Sprite` 的地方。
 *
 * 生命周期：`create()` 里 new 一次（`scene.restart` 由 create 重建），`onShutdown` 里 `destroy()`。
 * 公开面只有 `update` / `notifyBite` / `destroy`（相位是只读事实，**不提供 setPhase**）。
 */
export class OathkeeperViewSprite {
  /** 精灵（纹理/帧缺失时为 null —— 缺资产不崩、整段静默降级） */
  readonly sprite: Phaser.GameObjects.Sprite | null;
  private readonly runtime: OathkeeperRuntime;
  private readonly player: { x: number; y: number };
  private readonly textureKey: string;
  /** 复用输出对象（热路径零分配） */
  private readonly out: OathkeeperViewOutput = createOathkeeperViewOutput();
  /** 上一帧位置（算 speed 的差分基准） */
  private prevX: number;
  private prevY: number;
  /** walk 步进累加器（ms）：只在 move 态累加，离开 move 一律归零 → 起步从 a 帧起 */
  private walkElapsedMs = 0;
  /** 距上次撕咬毫秒数（`Infinity` = 从未撕咬） */
  private sinceBiteMs = Number.POSITIVE_INFINITY;
  /** 已落地的帧名（避免每帧 `setTexture` + 重算缩放） */
  private lastFrame: string | null = null;
  /** 上一帧的可视态（用于"是否刚进入 move"的边沿判定） */
  private lastState: OathkeeperViewState = 'hidden';
  private destroyed = false;

  constructor(
    scene: OathkeeperViewSpriteScene,
    runtime: OathkeeperRuntime,
    player: { x: number; y: number },
    textureKey: string = OATHKEEPER_TEXTURE_KEY,
  ) {
    this.runtime = runtime;
    this.player = player;
    this.textureKey = textureKey;
    const st = runtime.state;
    this.prevX = st.x;
    this.prevY = st.y;

    // 缺纹理/缺帧 → 不建精灵（静默降级；`scene.add.sprite` 传不存在的帧会走 __MISSING 巨图）
    const ready =
      scene.textures.exists(textureKey) && scene.textures.get(textureKey).has(OATHKEEPER_FRAME_IDLE);
    if (!ready) {
      this.sprite = null;
      return;
    }

    const sprite = scene.add.sprite(
      st.x,
      st.y + Y_OFFSET_BODY_192,
      textureKey,
      OATHKEEPER_FRAME_IDLE,
    );
    // 斜向右下 30° 已画进帧里，永不旋转（只在此设一次，避免后人加"抖动/俯冲"时忘了复位）
    sprite.setRotation(0);
    // 首帧 update 之前不闪：先隐藏，等决策器给出第一帧结论再显示
    sprite.setVisible(false);
    sprite.setDepth(OATHKEEPER_DEPTH);
    applyCombatDisplayScale(sprite); // 192 躯干 → 1
    this.lastFrame = OATHKEEPER_FRAME_IDLE;
    this.sprite = sprite;
  }

  /** 当前可视态（调试/单测用；`hidden` = 未启用或被相位隐藏） */
  get viewState(): OathkeeperViewState {
    return this.lastState;
  }

  /**
   * 撕咬信号入口（**唯一**的事件性输入）。
   *
   * 接线：`PlayScene.stepCompanion` 接住 `oathkeeper.update()` 的返回值（= `tickBite` 的 `dealt`），
   * `dealt > 0` 时调本方法。**不引入事件总线**（单消费者 + 相位是状态不是事件，方案 §3.3）。
   *
   * 时序：同帧内先 `notifyBite()` 后 `update(dt)` → `sinceBiteMs = 0 + dt*1000`，
   * 之后每帧累加 dt。`ATTACK_HOLD_MS/60fps ≈ 9 帧` 后自然回落，无需额外"攻击结束"信号。
   */
  notifyBite(): void {
    if (this.destroyed) return;
    this.sinceBiteMs = 0;
  }

  /**
   * 每帧步进：算 speed（含瞬移护栏）→ 决策 → 应用。
   * `dtSeconds` 非有限或 ≤0 时按 0 处理（不推进累加器、不产生 NaN/Infinity）。
   */
  update(dtSeconds: number): void {
    const sprite = this.sprite;
    if (this.destroyed || !sprite) return;
    const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
    const st = this.runtime.state;

    // ① 算 speed（**瞬移护栏在这里**，决策器只做 `speed > 5` 分档）
    const speed = this.measureSpeed(st, dt);
    // ② 撕咬计时累加（`Infinity` 保持"从未撕咬"，不给它加 dt 变成有限大数）
    if (Number.isFinite(this.sinceBiteMs)) this.sinceBiteMs += dt * 1000;

    if (this.runtime.isEnabled) {
      const out = resolveOathkeeperView(
        {
          phase: st.phase,
          speed,
          sinceBiteMs: this.sinceBiteMs,
          playerX: this.player.x,
          selfX: st.x,
          // ③ 跨帧回传朝向 → 决策器启用 8px 死区（防玩家在正上/正下方时逐帧翻面）
          prevFlipX: sprite.flipX,
          // tombstonePolicy 默认 'legacy48'；hasTombstoneFrame192 缺省 = false（192 墓碑图未产出）
        },
        this.out,
      );
      this.apply(sprite, out, st, dt);
    } else {
      this.hide(sprite);
    }

    // 差分基准始终推进（含未启用/瞬移帧）→ 启用瞬间不会拿陈旧坐标算出一个巨大 speed
    this.prevX = st.x;
    this.prevY = st.y;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.sprite?.destroy();
  }

  /**
   * 单帧速度（px/s）= 位移 / dt，含瞬移护栏。
   * `dt <= 0`（暂停帧 / 极端 delta=0）→ 0（否则除零得 Infinity）。
   */
  private measureSpeed(st: { x: number; y: number }, dt: number): number {
    if (dt <= 0) return 0;
    const dist = Math.hypot(st.x - this.prevX, st.y - this.prevY);
    if (!Number.isFinite(dist)) return 0;
    if (dist > TELEPORT_GUARD_PX) return 0; // 瞬移：本帧不作 move 判定（并顺带归零 walk 累加器）
    return dist / dt;
  }

  /** 未启用：整体隐藏 + 累加器归零（启用后从 idle/a 帧干净起步） */
  private hide(sprite: Phaser.GameObjects.Sprite): void {
    if (sprite.visible) sprite.setVisible(false);
    this.walkElapsedMs = 0;
    this.lastState = 'hidden';
  }

  /** 把决策结果落到精灵上（唯一写精灵的方法） */
  private apply(
    sprite: Phaser.GameObjects.Sprite,
    out: OathkeeperViewOutput,
    st: { x: number; y: number },
    dt: number,
  ): void {
    const frame = this.frameFor(out.state, dt);
    this.lastState = out.state;

    if (!out.visible) {
      // 仅为 `tombstone` + `hidden` 策略预留（本批 policy=legacy48，恒为 true）
      sprite.setVisible(false);
      return;
    }
    sprite.setVisible(true);

    if (this.lastFrame !== frame) {
      sprite.setTexture(this.textureKey, frame);
      this.lastFrame = frame;
      // 纪律 2：换帧后**必须**重算显示缩放（48 墓碑 → 2.667；回躯干 → 1）
      applyCombatDisplayScale(sprite);
    }

    sprite.setFlipX(out.flipX);
    // 脚底对齐：yOffset 由决策器给出（躯干 −32 / 旧 48 墓碑 +37/6），此处**不硬编码**
    sprite.setPosition(st.x, st.y + out.yOffset);
    sprite.setDepth(out.depth);
  }

  /**
   * 态 → 帧名。副作用：维护 walk 累加器（这是本壳唯一"有状态"的地方）。
   *
   * walk 累加器的边沿语义：**只在连续 move 帧累加**；离开 move 一律归零 →
   * 下次起步必从 `-walk-a` 开始（否则从 c 帧起步看起来像崴脚，方案 §3.2）。
   */
  private frameFor(state: OathkeeperViewState, dt: number): string {
    if (state === 'move') {
      if (this.lastState === 'move') this.walkElapsedMs += dt * 1000;
      else this.walkElapsedMs = 0;
      const i = Math.floor(this.walkElapsedMs / WALK_FRAME_MS) % OATHKEEPER_WALK_FRAMES.length;
      return OATHKEEPER_WALK_FRAMES[i] ?? OATHKEEPER_WALK_FRAMES[0];
    }

    this.walkElapsedMs = 0;

    if (state === 'attack') {
      // a→b 双帧：用 `sinceBiteMs` 而非独立累加器 —— 与决策器的保持窗口天然同步，
      // 少一个可能漂移的时钟。
      return this.sinceBiteMs < ATTACK_FRAME_A_MS
        ? OATHKEEPER_FRAME_ATTACK_A
        : OATHKEEPER_FRAME_ATTACK_B;
    }
    if (state === 'tombstone') return OATHKEEPER_FRAME_TOMBSTONE;
    return OATHKEEPER_FRAME_IDLE; // idle（裁决①：不从 `-v` 切帧）
  }
}
