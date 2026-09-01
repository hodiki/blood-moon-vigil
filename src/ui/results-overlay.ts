/**
 * ui/results-overlay.ts —— 结算页 DOM 覆盖层（ADR-004 / ux-spec §4 / CM §4 / E4-S4）
 *
 * 进入：GameState 转 GAMEOVER 后 PlayScene emit game:over { stats } → 本层订阅渲染。
 * 内容（ux-spec §4 / CM R3）：
 * - 标题「守夜失败」或「封印稳固·守夜完成」（narratives-spec §8.1，来源 narratives.ts）；统计行：存活时间 / 击杀数 / 等级
 * - Build 回顾：所选升级清单（RunResult.build，滚动区，超 12 项滚动）
 * - 「再来一局」→ emit game:restart（PlayScene → scene.restart()，CM R1/R2）
 *   「返回启动」→ emit game:to-menu（PlayScene → scene.start('Boot')）
 * - 数字滚动 0→目标 0.8s 缓出递增（ux-spec §6 微交互）
 * 单向数据流（ARCH §2 / ADR-004）：本层只读 stats、只发事件；遮罩拦截非面板区点击（CM R4）。
 */

import { GameEvents, GameEvent } from '@/core/events';
import { getOverlayHost } from '@/ui/overlay-host';
import { incrementRestartCount } from '@/stats/session-stats';
import type { RunResult } from '@/stats/run-stats';
import { NARRATIVES, entryByKey } from '@/narratives/narratives';
import { meritProgress } from '@/stats/merit';

const ROLL_DURATION_MS = 800;

/**
 * 结算标题（narratives-spec §8.1 / C-5 必改）：胜利 =「封印稳固·守夜完成」（封印语义 + 守夜完成，
 * 呼应 world-bible §2 封印渗血）；失败 =「守夜失败。」。文案只读 narratives.ts 表（按 key 引用，
 * spec §2 key 为工程引用键），不硬编码；表缺失时兜底 = 设计终稿文本（与表一致，防漂移）。
 */
export function resultTitle(victory: boolean): string {
  const entry = entryByKey(NARRATIVES, victory ? 'n_result_victory' : 'n_result_defeat');
  return entry?.text ?? (victory ? '封印稳固·守夜完成' : '守夜失败。');
}

// —— 结算奖励条纯函数（merit-ui-spec §7 / codex-ui-spec §6；可脱离 DOM 单测） ——

/** 功绩条数值：本局获得功绩点数（N = calculateMeritPoints；merit-ui-spec §7「守夜功绩 +N」） */
export function meritRewardText(earned: number): string {
  return `+${Math.max(0, Math.floor(earned))}`;
}

/** 日志条数值：图鉴新增条数（codex-ui-spec §6「日志 +N」）；无新增 →「守夜日志已更新」 */
export function codexLogRewardText(delta: number): string {
  return delta > 0 ? `+${Math.max(0, Math.floor(delta))}` : '守夜日志已更新';
}

/** 功绩条进度文案（merit-ui-spec §7：距下个加成解锁还需 X 点；全部解锁 → 全部加成已解锁） */
export function resultsMeritProgressText(points: number): string {
  const p = meritProgress(points);
  if (p.nextCost === null) return '全部加成已解锁';
  return `距「${p.nextName}」还差 ${p.remaining} 点`;
}

/** 功绩条进度填充比例（0..1；结算页进度条 width） */
export function resultsMeritProgressRatio(points: number): number {
  return meritProgress(points).fraction;
}

/** game:over 事件 payload（PlayScene.finishGame 构造；TASK-21 P1 增补 sessionRestartCount） */
export interface GameOverPayload {
  stats: RunResult;
  /** session 级累计「再来一局」次数（concept §9 重开率数据源） */
  sessionRestartCount?: number;
  /** M3 结算功绩条：本局获得功绩点数（merit-ui-spec §7；N = calculateMeritPoints） */
  meritEarned?: number;
  /** M3 结算功绩条：累计功绩点数（写回存档后；进度条距下个加成解锁） */
  meritTotal?: number;
  /** M3 结算日志条：本局新解锁图鉴条数（codex-ui-spec §6；delta>0 显示「日志 +N」） */
  codexUnlockedDelta?: number;
}

export class ResultsOverlay {
  private readonly root: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly killsEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly buildEl: HTMLElement;
  private readonly telEls: Record<'offers' | 'xp' | 'evolution' | 'related' | 'boss' | 'deriv' | 'mutbeat' | 'reson' | 'revive' | 'elite' | 'tree', HTMLElement>;
  /** M3 结算奖励条：守夜功绩 +N / 日志 +N / 功绩进度（merit-ui-spec §7 / codex-ui-spec §6） */
  private readonly rewardMeritEl: HTMLElement;
  private readonly rewardCodexEl: HTMLElement;
  private readonly rewardProgressFill: HTMLElement;
  private readonly rewardProgressTextEl: HTMLElement;
  private readonly handlers: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];
  private rollRaf = 0;

  constructor(host: HTMLElement) {
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-results';
    this.root.innerHTML = `
      <div class="bmv-results-mask"></div>
      <div class="bmv-results-panel">
        <div class="bmv-results-title">守夜失败</div>
        <div class="bmv-results-stats">
          <div class="bmv-results-row"><span class="bmv-results-label">存活时间</span><span class="bmv-results-value" data-roll="time">0:00</span></div>
          <div class="bmv-results-row"><span class="bmv-results-label">击杀数</span><span class="bmv-results-value" data-roll="kills">0</span></div>
          <div class="bmv-results-row"><span class="bmv-results-label">等级</span><span class="bmv-results-value" data-roll="level">1</span></div>
        </div>
        <div class="bmv-results-rewards">
          <div class="bmv-results-rewards-title">本局收获</div>
          <div class="bmv-results-row"><span class="bmv-results-label">余辉</span><span class="bmv-results-value" data-reward="merit">+0</span></div>
          <div class="bmv-results-progress">
            <div class="bmv-results-progress-track"><div class="bmv-results-progress-fill"></div></div>
            <div class="bmv-results-progress-text"></div>
          </div>
          <div class="bmv-results-row"><span class="bmv-results-label">守夜日志</span><span class="bmv-results-value" data-reward="codex">守夜日志已更新</span></div>
        </div>
        <div class="bmv-results-telemetry">
          <div class="bmv-results-telemetry-title">真机遥测（M3）</div>
          <div class="bmv-results-trow"><span class="bmv-results-label">升级 offer</span><span class="bmv-results-value" data-tel="offers">0</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">本局经验</span><span class="bmv-results-value" data-tel="xp">0</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">进化完成</span><span class="bmv-results-value" data-tel="evolution">0</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">build 相关卡占比</span><span class="bmv-results-value" data-tel="related">–</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">Boss 战时长</span><span class="bmv-results-value" data-tel="boss">–</span></div>
          <div class="bmv-results-telemetry-title">B6 遥测（EG-9 口径）</div>
          <div class="bmv-results-trow"><span class="bmv-results-label">衍生技 DPS 占比</span><span class="bmv-results-value" data-tel="deriv">–</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">质变卡时点</span><span class="bmv-results-value" data-tel="mutbeat">–</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">共鸣达成</span><span class="bmv-results-value" data-tel="reson">–</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">复活触发</span><span class="bmv-results-value" data-tel="revive">0</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">精英抽卡</span><span class="bmv-results-value" data-tel="elite">0</span></div>
          <div class="bmv-results-trow"><span class="bmv-results-label">树质变节点</span><span class="bmv-results-value" data-tel="tree">0</span></div>
        </div>
        <div class="bmv-results-build">
          <div class="bmv-results-build-title">Build 回顾</div>
          <div class="bmv-results-build-list"></div>
        </div>
        <div class="bmv-results-actions">
          <button class="bmv-results-restart" type="button">再来一局</button>
          <button class="bmv-results-menu" type="button">返回启动</button>
        </div>
      </div>
    `;
    host.appendChild(this.root);

    this.titleEl = this.root.querySelector('.bmv-results-title') as HTMLElement;
    this.timeEl = this.root.querySelector('[data-roll="time"]') as HTMLElement;
    this.killsEl = this.root.querySelector('[data-roll="kills"]') as HTMLElement;
    this.levelEl = this.root.querySelector('[data-roll="level"]') as HTMLElement;
    this.buildEl = this.root.querySelector('.bmv-results-build-list') as HTMLElement;
    this.telEls = {
      deriv: this.root.querySelector('[data-tel="deriv"]') as HTMLElement,
      mutbeat: this.root.querySelector('[data-tel="mutbeat"]') as HTMLElement,
      reson: this.root.querySelector('[data-tel="reson"]') as HTMLElement,
      revive: this.root.querySelector('[data-tel="revive"]') as HTMLElement,
      elite: this.root.querySelector('[data-tel="elite"]') as HTMLElement,
      tree: this.root.querySelector('[data-tel="tree"]') as HTMLElement,
      offers: this.root.querySelector('[data-tel="offers"]') as HTMLElement,
      xp: this.root.querySelector('[data-tel="xp"]') as HTMLElement,
      evolution: this.root.querySelector('[data-tel="evolution"]') as HTMLElement,
      related: this.root.querySelector('[data-tel="related"]') as HTMLElement,
      boss: this.root.querySelector('[data-tel="boss"]') as HTMLElement,
    };
    this.rewardMeritEl = this.root.querySelector('[data-reward="merit"]') as HTMLElement;
    this.rewardCodexEl = this.root.querySelector('[data-reward="codex"]') as HTMLElement;
    this.rewardProgressFill = this.root.querySelector('.bmv-results-progress-fill') as HTMLElement;
    this.rewardProgressTextEl = this.root.querySelector('.bmv-results-progress-text') as HTMLElement;

    const restartBtn = this.root.querySelector('.bmv-results-restart') as HTMLElement;
    const menuBtn = this.root.querySelector('.bmv-results-menu') as HTMLElement;
    restartBtn.addEventListener('click', () => {
      // TASK-21 P1：重开率埋点 —— session 级「再来一局」点击累计（LocalStorage）
      incrementRestartCount(window.localStorage);
      GameEvents.emit(GameEvent.RestartRequested);
    });
    menuBtn.addEventListener('click', () => GameEvents.emit(GameEvent.ToMenuRequested));

    const onGameOver = (payload: unknown): void => {
      // 修正（E4-S4 遗留）：payload 实为 { stats, sessionRestartCount, meritEarned, meritTotal, codexUnlockedDelta }，
      // 解构 stats 再渲染；奖励条数据随 payload 传入（缺省 = 0/未更新，兼容旧调用方）
      const p = payload as GameOverPayload;
      this.show(p.stats, p);
    };
    GameEvents.on(GameEvent.GameOver, onGameOver);
    this.handlers.push({ event: GameEvent.GameOver, fn: onGameOver });
  }

  /** 展示结算（game:over 自动触发；也可由 PlayScene 直接调用；extras 供 M3 奖励条） */
  show(stats: RunResult, extras?: GameOverPayload): void {
    this.root.style.display = 'flex';
    // C-5：标题文案来源 narratives.ts（封印稳固·守夜完成 / 守夜失败。）
    this.titleEl.textContent = resultTitle(stats.victory);
    this.renderBuild(stats.build);
    this.renderTelemetry(stats);
    this.renderRewards(extras);
    this.rollNumbers(stats);
  }

  /** M3 结算奖励条：守夜功绩 +N（本局）+ 进度（累计）/ 守夜日志 +N（本局新解锁） */
  private renderRewards(extras?: GameOverPayload): void {
    const meritEarned = extras?.meritEarned ?? 0;
    const meritTotal = extras?.meritTotal ?? 0;
    const codexDelta = extras?.codexUnlockedDelta ?? 0;
    this.rewardMeritEl.textContent = meritRewardText(meritEarned);
    this.rewardCodexEl.textContent = codexLogRewardText(codexDelta);
    this.rewardProgressFill.style.width = `${Math.round(resultsMeritProgressRatio(meritTotal) * 100)}%`;
    this.rewardProgressTextEl.textContent = resultsMeritProgressText(meritTotal);
  }

  /** M3 真机埋点：结算页静态展示 5 项遥测（upgrade-experience-v2 §4.4；真机验证直接读结算页） */
  private renderTelemetry(stats: RunResult): void {
    this.telEls.offers.textContent = String(stats.offersPerRun);
    this.telEls.xp.textContent = String(stats.xpGainedPerRun);
    this.telEls.evolution.textContent = stats.evolutionComplete
      ? `${stats.evolutionCompleteCount} 次（达成）`
      : String(stats.evolutionCompleteCount);
    this.telEls.related.textContent = stats.relatedCardShare === null
      ? '–'
      : `${Math.round(stats.relatedCardShare * 100)}%`;
    // B6-W5 遥测块渲染（EG-9 口径；null → '–'）
    this.telEls.deriv.textContent = stats.derivativeDpsShare === null
      ? '–'
      : `${Math.round(stats.derivativeDpsShare * 100)}%`;
    this.telEls.mutbeat.textContent =
      stats.mutationCard1AtSeconds === null && stats.mutationCard2AtSeconds === null
        ? '–'
        : `卡1 ${stats.mutationCard1AtSeconds ?? '–'}s / 卡2 ${stats.mutationCard2AtSeconds ?? '–'}s`;
    this.telEls.reson.textContent = stats.resonanceAtSeconds === null
      ? '–'
      : `${stats.resonancePairId} @ ${stats.resonanceAtSeconds}s`;
    this.telEls.revive.textContent = String(stats.talentReviveCount);
    this.telEls.elite.textContent = String(stats.eliteOfferCount);
    this.telEls.tree.textContent = String(stats.treeMutationCount);
    this.telEls.boss.textContent = stats.bossFightSeconds === null
      ? '–'
      : `${Math.round(stats.bossFightSeconds * 10) / 10}s`;
  }

  destroy(): void {
    cancelAnimationFrame(this.rollRaf);
    for (const h of this.handlers) GameEvents.off(h.event, h.fn);
    this.root.remove();
  }

  private renderBuild(build: string[]): void {
    this.buildEl.innerHTML = '';
    if (build.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bmv-results-build-item empty';
      empty.textContent = '（未选择升级）';
      this.buildEl.appendChild(empty);
      return;
    }
    for (const name of build) {
      const item = document.createElement('div');
      item.className = 'bmv-results-build-item';
      item.textContent = name;
      this.buildEl.appendChild(item);
    }
  }

  /** 数字滚动 0→目标 0.8s 缓出递增（ux-spec §6；rAF 不受 Phaser tween 暂停影响，ADR-004） */
  private rollNumbers(stats: RunResult): void {
    cancelAnimationFrame(this.rollRaf);
    const targets = {
      time: stats.survivalSeconds,
      kills: stats.kills,
      level: stats.level,
    };
    const start = performance.now();
    const tick = (): void => {
      const p = Math.min(1, (performance.now() - start) / ROLL_DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3); // cubic ease-out
      this.timeEl.textContent = formatSeconds(targets.time * eased);
      this.killsEl.textContent = String(Math.round(targets.kills * eased));
      this.levelEl.textContent = String(Math.round(targets.level * eased));
      if (p < 1) this.rollRaf = requestAnimationFrame(tick);
    };
    this.rollRaf = requestAnimationFrame(tick);
  }

  /** CSS 注入一次（ADR-004；色板抄 art-bible / ux-spec §4） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-results-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-results-styles';
    style.textContent = `
      .bmv-results {
        position: absolute; inset: 0;
        display: none;
        align-items: center; justify-content: center;
        pointer-events: auto;
        z-index: 60;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        /* TASK-21 Bug2：刘海屏安全区（横屏凹口） */
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-results-mask {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.8);
      }
      .bmv-results-panel {
        position: relative;
        width: 640px;
        max-width: calc(100vw - 32px);
        max-width: calc((100dvw - 32px) / var(--bmv-overlay-scale, 1));
        max-height: 760px;
        /* BUG-3（NV-REVIEW-FIX-F）：本层处于 transform:scale 的设计空间容器（overlay-scale
           #ui-overlay 1920×1080 设计坐标）内，dvh/dvw 视口单位会被整体 scale 再乘——
           矮视口（1280×656，scale≈0.607）下面板被压到 ~38% 可用高度。物理上限需 ÷
           --bmv-overlay-scale 折回设计空间，使渲染后视觉高度 = 100dvh − 32px。 */
        max-height: calc((100dvh - 32px) / var(--bmv-overlay-scale, 1));
        overflow-y: auto; /* TASK-21 Bug2：横屏矮视口内容可滚动不裁剪 */
        box-sizing: border-box;
        padding: 32px;
        background: #131722;
        border: 2px solid #2A3346;
        border-radius: 12px;
        display: flex; flex-direction: column;
        align-items: center;
        animation: bmv-results-rise 0.25s ease-out;
      }
      .bmv-results-title {
        font-size: 32px; font-weight: 700;
        color: #F2F5F9; margin-bottom: 20px;
      }
      .bmv-results-stats {
        width: 100%;
        margin-bottom: 20px;
      }
      .bmv-results-row {
        display: flex; justify-content: space-between;
        font-size: 28px; color: #F2F5F9;
        padding: 6px 0;
      }
      /* M3 结算奖励条（merit-ui-spec §7 / codex-ui-spec §6）：与统计行同布局，独立小节 */
      .bmv-results-rewards {
        width: 100%;
        margin-bottom: 20px;
      }
      .bmv-results-rewards-title {
        font-size: 14px; font-weight: 700;
        color: #54E6C9; margin-bottom: 4px;
        letter-spacing: 1px;
      }
      .bmv-results-rewards .bmv-results-row { font-size: 22px; padding: 4px 0; }
      .bmv-results-progress { margin: 2px 0 8px; }
      .bmv-results-progress-track {
        height: 8px; border-radius: 999px;
        background: #0B0E14; border: 1px solid #2A3346;
        overflow: hidden;
      }
      .bmv-results-progress-fill {
        height: 100%; border-radius: 999px;
        background: #54E6C9;
        transition: width 0.3s ease-out;
      }
      .bmv-results-progress-text { margin-top: 3px; font-size: 13px; color: #A9B4C4; }
      .bmv-results-telemetry {
        width: 100%;
        margin-bottom: 16px;
        background: #0B0E14; border-radius: 8px;
        padding: 8px 12px;
        box-sizing: border-box;
        border: 1px solid #2A3346;
      }
      .bmv-results-telemetry-title {
        font-size: 14px; font-weight: 700;
        color: #54E6C9; margin-bottom: 4px;
        letter-spacing: 1px;
      }
      .bmv-results-trow {
        display: flex; justify-content: space-between;
        font-size: 15px; color: #F2F5F9;
        padding: 2px 0;
        font-variant-numeric: tabular-nums;
      }
      .bmv-results-label { color: #A9B4C4; }
      .bmv-results-value { font-weight: 700; font-variant-numeric: tabular-nums; }
      .bmv-results-build {
        width: 100%; flex: 1; min-height: 0;
        margin-bottom: 20px;
      }
      .bmv-results-build-title {
        font-size: 20px; font-weight: 700;
        color: #54E6C9; margin-bottom: 8px;
      }
      .bmv-results-build-list {
        /* BUG-3 修复：固定高 240 在矮视口（656 横屏）撑破面板 → 弹性收缩 + 下限保底 */
        flex: 1 1 auto; min-height: 96px; max-height: 240px; overflow-y: auto;
        background: #0B0E14; border-radius: 8px;
        padding: 8px;
        box-sizing: border-box;
      }
      .bmv-results-build-item {
        font-size: 16px; color: #F2F5F9;
        padding: 3px 4px;
      }
      .bmv-results-build-item.empty { color: #6A7280; }
      .bmv-results-actions {
        display: flex; flex-direction: column; gap: 12px;
        align-items: center;
        width: 100%;
      }
      .bmv-results-restart {
        width: 320px; height: 56px;
        font-size: 22px; font-weight: 700;
        color: #F2F5F9;
        background: #131722;
        border: 2px solid #54E6C9; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-results-restart:hover { transform: scale(1.03); }
      .bmv-results-menu {
        width: 160px; height: 44px;
        font-size: 16px;
        color: #A9B4C4;
        background: transparent;
        border: 1px solid #2A3346; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-results-menu:hover { color: #F2F5F9; }
      @keyframes bmv-results-rise { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      /* 移动端（ux-spec §4：面板 92vw、统计竖排、Build max-height 220、按钮全宽竖排） */
      @media (max-width: 900px) {
        .bmv-results-panel { width: 92vw; max-width: 100%; max-height: 88vh; max-height: calc(88dvh / var(--bmv-overlay-scale, 1)); padding: 20px; }
        .bmv-results-title { font-size: 26px; }
        .bmv-results-row { font-size: 22px; }
        .bmv-results-rewards .bmv-results-row { font-size: 18px; }
        .bmv-results-progress-text { font-size: 14px; }
        .bmv-results-build-list { max-height: 220px; height: auto; }
        .bmv-results-restart { width: 100%; height: 64px; }
        .bmv-results-menu { width: 100%; height: 48px; }
      }
    `;
    host.appendChild(style);
  }
}

/** 秒 → "M:SS"（如 6:00）；含小数时四舍五入到秒 */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 便捷工厂：挂到默认 #ui-overlay（PlayScene 使用） */
export function createResultsOverlay(): ResultsOverlay {
  return new ResultsOverlay(getOverlayHost());
}
