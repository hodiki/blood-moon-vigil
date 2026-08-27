/**
 * ui/hud.ts —— HUD DOM 覆盖层（ADR-004 / ARCH §4.4 / ux-spec §2 / art-bible §6 / E4-S1）
 *
 * 布局（ux-spec §2）：
 * - 桌面（默认）：LV 左上 (24,16) 20px；经验条 (24,48) 240×8 蓝 #4FC3F7/黑底 #000A；
 *   HP 数值 (24,1018) 20px + 血条 (24,1042) 240×14 红 #FF3B30/黑底；武器槽 3×48 右上
 *   (1736,24) 间距 8；暂停无可见按钮（Esc/P）；开局 0~5s 顶部中央「Esc 暂停」提示后淡出。
 * - 移动（max-width:900px 媒体查询）：上移让出拇指区 —— LV (24,24)、经验条 (24,56) 220×8、
 *   HP (24,80) 220×14 数值内嵌、暂停键右上 (652,24) 44×44、武器槽 3×44 (512,24)。
 * - Boss 顶部 UI 血条（art-bible §3：黑底 #000A + 红 #FF3B30 填充 + 1px 白边）：
 *   桌面屏宽 60% / 移动 50%（enemies §⑦），仅 Boss 战显示。
 *
 * 数据流（ARCH §2 / ADR-004 单向）：只订阅 GameEvents 事件流（xp:gem-collected / level:up /
 * hp:changed / weapon:unlocked / boss:spawned / boss:hp / boss:defeated / game:over），
 * 状态经 ui/hud-state.ts 纯归约器推导，本类只做 DOM 应用；不持有/修改游戏状态。
 * HUD 为 DOM → 0 WebGL draw call（RV §4.1 纪律 3）。
 */

import { GameEvents, GameEvent } from '@/core/events';
import { getOverlayHost } from '@/ui/overlay-host';
import type { RuntimeConfig } from '@/config/runtime-config';
import {
  createInitialHudState,
  reduceHudState,
  xpFillFraction,
  hpFillFraction,
  bossFillFraction,
  type HudState,
} from '@/ui/hud-state';
import { renderIconSvg, weaponIconKeyForId } from '@/ui/icons';
import { FRAME_IMG_BASE, preferFrameImg } from '@/ui/frame-img';

const ESC_HINT_SECONDS = 5;

const WSLOT_FRAMES: Record<'missile' | 'orbit' | 'shockwave', string> = {
  missile: 'wslot-missile',
  orbit: 'wslot-orb',
  shockwave: 'wslot-shockwave',
};

interface HudOptions {
  cfg: RuntimeConfig;
  onPauseToggle: () => void;
  /** M1b 主动技：移动端技能按钮点按回调（PlayScene 接线到 tryCastActiveSkill） */
  onActiveSkill?: () => void;
  /** E4-S2 主动技名（移动端技能按钮 aria-label；缺省提灯闪耀） */
  skillName?: string;
  /** 批次 3：主动技图标帧（skill-edmund 等）；缺省不换图 */
  skillIconFrame?: string;
}

export class Hud {
  private state: HudState = createInitialHudState();
  private readonly root: HTMLElement;
  private readonly lvEl: HTMLElement;
  private readonly xpFillEl: HTMLElement;
  private readonly hpNumEl: HTMLElement;
  private readonly hpFillEl: HTMLElement;
  private readonly weaponEls: Record<'missile' | 'orbit' | 'shockwave', HTMLElement>;
  private readonly bossFillEl: HTMLElement;
  private readonly bossBarEl: HTMLElement;
  private readonly pauseEl: HTMLElement | null;
  private readonly escHintEl: HTMLElement | null;
  private readonly pauseHandler: (() => void) | null;
  /** M1b 主动技：移动端技能按钮（96×96 视觉 / 热区 96 ≥44；右下角） */
  private readonly skillEl: HTMLElement | null;
  /** M1b 主动技：冷却转圈遮罩（conic-gradient 径向遮罩，pillars §6.3 HUD） */
  private readonly skillCdEl: HTMLElement | null;
  private readonly skillHandler: (() => void) | null;
  private lastSkillCdFrac = -1;
  private readonly offFns: Array<() => void> = [];
  private escHintTimer: number | null = null;

  constructor(host: HTMLElement, opts: HudOptions) {
    this.ensureStyles(host);
    this.pauseHandler = opts.onPauseToggle;
    this.pauseEl = null;
    this.escHintEl = null;
    this.skillHandler = opts.onActiveSkill ?? null;
    this.skillEl = null;
    this.skillCdEl = null;

    this.root = document.createElement('div');
    this.root.className = 'bmv-hud';
    this.root.innerHTML = `
      <div class="bmv-hud-lv">LV 1</div>
      <div class="bmv-hud-xp"><div class="bmv-hud-xp-fill"></div></div>
      <div class="bmv-hud-hp-num">100/100</div>
      <div class="bmv-hud-hp"><div class="bmv-hud-hp-fill"></div></div>
      <div class="bmv-hud-weapons">
        <div class="bmv-hud-weapon active" data-weapon="missile">${renderIconSvg(weaponIconKeyForId('missile'))}</div>
        <div class="bmv-hud-weapon" data-weapon="orbit">${renderIconSvg(weaponIconKeyForId('orbit'))}</div>
        <div class="bmv-hud-weapon" data-weapon="shockwave">${renderIconSvg(weaponIconKeyForId('shockwave'))}</div>
      </div>
      <div class="bmv-hud-boss"><div class="bmv-hud-boss-fill"></div></div>
    `;
    host.appendChild(this.root);

    this.lvEl = this.root.querySelector('.bmv-hud-lv') as HTMLElement;
    this.xpFillEl = this.root.querySelector('.bmv-hud-xp-fill') as HTMLElement;
    this.hpNumEl = this.root.querySelector('.bmv-hud-hp-num') as HTMLElement;
    this.hpFillEl = this.root.querySelector('.bmv-hud-hp-fill') as HTMLElement;
    this.bossBarEl = this.root.querySelector('.bmv-hud-boss') as HTMLElement;
    this.bossFillEl = this.root.querySelector('.bmv-hud-boss-fill') as HTMLElement;
    const weaponsRow = this.root.querySelector('.bmv-hud-weapons') as HTMLElement;
    this.weaponEls = {
      missile: weaponsRow.querySelector('[data-weapon="missile"]') as HTMLElement,
      orbit: weaponsRow.querySelector('[data-weapon="orbit"]') as HTMLElement,
      shockwave: weaponsRow.querySelector('[data-weapon="shockwave"]') as HTMLElement,
    };
    preferFrameImg(this.weaponEls.missile, WSLOT_FRAMES.missile);
    preferFrameImg(this.weaponEls.orbit, WSLOT_FRAMES.orbit);
    preferFrameImg(this.weaponEls.shockwave, WSLOT_FRAMES.shockwave);

    // 暂停键（仅移动端，ux-spec §2：右上 44×44，热区=视觉）
    if (opts.cfg.isMobile) {
      this.pauseEl = document.createElement('div');
      this.pauseEl.className = 'bmv-hud-pause';
      this.pauseEl.textContent = '❚❚';
      this.pauseEl.setAttribute('aria-label', '暂停');
      this.pauseEl.addEventListener('click', this.pauseHandler);
      this.root.appendChild(this.pauseEl);
      // M1b 主动技：技能按钮（pillars §6.3：右下角、视觉 96×96、热区 ≥44、非 RUNNING 隐藏）
      this.skillEl = document.createElement('div');
      this.skillEl.className = 'bmv-hud-skill';
      this.skillEl.setAttribute('aria-label', opts.skillName ?? '提灯闪耀');
      this.skillEl.innerHTML = `
        <div class="bmv-hud-skill-cd"></div>
        <div class="bmv-hud-skill-icon">✦</div>
        <div class="bmv-hud-skill-charges" hidden>1</div>
      `;
      this.skillEl.style.backgroundImage = `url(${FRAME_IMG_BASE}/hud-skillbtn.png)`;
      this.skillEl.style.backgroundSize = 'cover';
      this.skillEl.style.backgroundPosition = 'center';
      const skillIconHost = this.skillEl.querySelector('.bmv-hud-skill-icon') as HTMLElement | null;
      if (skillIconHost && opts.skillIconFrame) preferFrameImg(skillIconHost, opts.skillIconFrame);
      if (this.skillHandler) this.skillEl.addEventListener('click', this.skillHandler);
      this.root.appendChild(this.skillEl);
      this.skillCdEl = this.skillEl.querySelector('.bmv-hud-skill-cd') as HTMLElement | null;
    } else {
      this.pauseEl = null;
      this.skillEl = null;
      this.skillCdEl = null;
      // 桌面：开局 0~5s 顶部中央「Esc 暂停」提示后淡出（ux-spec §2）
      this.escHintEl = document.createElement('div');
      this.escHintEl.className = 'bmv-hud-esc-hint';
      this.escHintEl.textContent = 'Esc 暂停';
      this.root.appendChild(this.escHintEl);
      this.escHintTimer = window.setTimeout(() => {
        this.escHintEl?.classList.add('fade-out');
      }, ESC_HINT_SECONDS * 1000);
    }

    // 事件订阅（ARCH §3.4 统一注册；destroy 统一 off）
    const subscribe = (event: string): void => {
      const fn = (payload: unknown): void => {
        this.state = reduceHudState(this.state, event, payload);
        this.apply();
      };
      GameEvents.on(event, fn);
      this.offFns.push(() => GameEvents.off(event, fn));
    };
    subscribe(GameEvent.GemCollected);
    subscribe(GameEvent.LevelUp);
    subscribe(GameEvent.HpChanged);
    subscribe(GameEvent.WeaponUnlocked);
    subscribe(GameEvent.BossSpawned);
    subscribe(GameEvent.BossHpChanged);
    subscribe(GameEvent.BossDefeated);
    subscribe(GameEvent.GameOver);

    this.apply();
  }

  /** M1b 主动技：技能按钮可见性（非 RUNNING 态隐藏，CM §5 状态联动；桌面无按钮为 no-op） */
  setSkillVisible(visible: boolean): void {
    if (this.skillEl) this.skillEl.hidden = !visible;
  }

  /** M1b 主动技：冷却转圈（剩余/总 CD → conic-gradient 径向遮罩；就绪=0 全透明） */
  setSkillCooldown(remainingSeconds: number, totalSeconds: number): void {
    if (!this.skillCdEl) return;
    const frac = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
    // 防每帧 style 抖动：变化 <0.5% 跳过（DOM 单元素，仍只读展示，不改游戏状态）
    if (Math.abs(frac - this.lastSkillCdFrac) < 0.005) return;
    this.lastSkillCdFrac = frac;
    this.skillCdEl.style.background = `conic-gradient(rgba(11,14,20,0.72) ${frac * 360}deg, transparent ${frac * 360}deg)`;
  }

  /** E4-S2 充能制：技能按钮充能数角标（血猎手 2 段；单充能隐藏） */
  setSkillCharges(count: number): void {
    if (!this.skillEl) return;
    const el = this.skillEl.querySelector('.bmv-hud-skill-charges') as HTMLElement | null;
    if (!el) return;
    el.textContent = String(count);
    el.hidden = count <= 1;
  }

  /** 场景关闭：解除订阅 + 移除 DOM + 清提示定时器 */
  destroy(): void {
    for (const off of this.offFns) off();
    if (this.escHintTimer !== null) window.clearTimeout(this.escHintTimer);
    if (this.pauseEl && this.pauseHandler) this.pauseEl.removeEventListener('click', this.pauseHandler);
    if (this.skillEl && this.skillHandler) this.skillEl.removeEventListener('click', this.skillHandler);
    this.root.remove();
  }

  private apply(): void {
    const s = this.state;
    this.lvEl.textContent = `LV ${s.level}`;
    this.xpFillEl.style.width = `${xpFillFraction(s) * 100}%`;
    this.hpNumEl.textContent = `${Math.ceil(s.hp)}/${s.maxHp}`;
    this.hpFillEl.style.width = `${hpFillFraction(s) * 100}%`;
    this.weaponEls.missile.classList.toggle('active', s.weapons.missile);
    this.weaponEls.orbit.classList.toggle('active', s.weapons.orbit);
    this.weaponEls.shockwave.classList.toggle('active', s.weapons.shockwave);

    // Boss 顶部血条（art-bible §3：黑底/红填充/1px 白边；E8 §⑦ 桌面 60% / 移动 50%）
    const bossVisible = s.bossHp !== null && s.bossMaxHp !== null;
    this.bossBarEl.classList.toggle('visible', bossVisible);
    if (bossVisible) {
      this.bossFillEl.style.width = `${bossFillFraction(s) * 100}%`;
    }
  }

  /** CSS 注入一次（ADR-004：布局/动画走 CSS；色板抄 art-bible，不自动同步） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-hud-styles';
    style.textContent = `
      .bmv-hud {
        position: absolute; inset: 0;
        pointer-events: none;
        z-index: 40;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      .bmv-hud-lv {
        position: absolute; left: 24px; top: 16px;
        font-size: 20px; font-weight: 700; color: #F2F5F9;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .bmv-hud-xp {
        position: absolute; left: 24px; top: 48px;
        width: 240px; height: 8px;
        background: #000A; border-radius: 2px;
      }
      .bmv-hud-xp-fill {
        height: 100%; width: 0%;
        background: #4FC3F7;
        transition: width 0.15s ease-out;
        border-radius: 2px;
      }
      .bmv-hud-hp-num {
        position: absolute; left: 24px; top: 1018px;
        font-size: 20px; font-weight: 700; color: #F2F5F9;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .bmv-hud-hp {
        position: absolute; left: 24px; top: 1042px;
        width: 240px; height: 14px;
        background: #000A; border-radius: 2px;
      }
      .bmv-hud-hp-fill {
        height: 100%; width: 100%;
        background: #FF3B30;
        transition: width 0.1s ease-out;
        border-radius: 2px;
      }
      .bmv-hud-weapons {
        position: absolute; right: 24px; top: 24px;
        display: flex; gap: 8px;
      }
      .bmv-hud-weapon {
        width: 48px; height: 48px;
        box-sizing: border-box;
        display: flex; align-items: center; justify-content: center;
      }
      /* TASK-33：内联矢量武器图标（icons.ts），SVG 自带蓝紫底+冷青描边；未解锁降饱和变暗 */
      .bmv-hud-weapon svg {
        display: block;
        width: 100%; height: 100%;
      }
      .bmv-hud-weapon:not(.active) svg {
        opacity: 0.45;
        filter: saturate(0.35) brightness(0.75);
      }
      .bmv-hud-weapon img.bmv-frame-img {
        display: block;
        width: 100%; height: 100%;
        image-rendering: pixelated;
      }
      .bmv-hud-weapon:not(.active) img.bmv-frame-img {
        opacity: 0.45;
        filter: saturate(0.35) brightness(0.75);
      }
      .bmv-hud-weapon.active img.bmv-frame-img {
        filter: none;
      }
      .bmv-hud-pause {
        position: absolute; right: 24px; top: 24px;
        width: 44px; height: 44px;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: #F2F5F9;
        background: #131722; border: 2px solid #2A3346; border-radius: 8px;
        pointer-events: auto; cursor: pointer;
        user-select: none; -webkit-user-select: none;
      }
      /* M1b 主动技：技能按钮（pillars §6.3：右下角、视觉 96×96、热区=视觉 ≥44；与右上暂停对角对称） */
      .bmv-hud-skill {
        position: absolute; right: 24px; bottom: 24px;
        width: 96px; height: 96px;
        box-sizing: border-box;
        display: flex; align-items: center; justify-content: center;
        background: #131722; border: 2px solid #54E6C9; border-radius: 12px;
        pointer-events: auto; cursor: pointer;
        user-select: none; -webkit-user-select: none;
        touch-action: none;
      }
      .bmv-hud-skill[hidden] { display: none; }
      .bmv-hud-skill-icon {
        font-size: 36px; color: #E8F0FA;
        text-shadow: 0 0 8px rgba(84, 230, 201, 0.6);
        pointer-events: none;
      }
      .bmv-hud-skill-icon img.bmv-frame-img {
        display: block;
        width: 56px; height: 56px;
        image-rendering: pixelated;
      }
      .bmv-hud-skill-cd {
        position: absolute; inset: 0; border-radius: 10px;
        background: conic-gradient(rgba(11,14,20,0.72) 0deg, transparent 0deg);
        pointer-events: none;
      }
      .bmv-hud-skill-charges {
        position: absolute; top: -6px; right: -6px;
        min-width: 22px; height: 22px; box-sizing: border-box;
        display: flex; align-items: center; justify-content: center;
        padding: 0 4px;
        font-size: 13px; font-weight: 700; color: #F2F5F9;
        background: #2A3346; border: 2px solid #54E6C9; border-radius: 999px;
        pointer-events: none;
      }
      .bmv-hud-skill-charges[hidden] { display: none; }
      .bmv-hud-esc-hint {
        position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
        font-size: 16px; color: #A9B4C4;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        opacity: 1; transition: opacity 0.6s ease-out;
      }
      .bmv-hud-esc-hint.fade-out { opacity: 0; }
      .bmv-hud-boss {
        position: absolute; top: 24px; left: 20%;
        width: 60%; height: 14px;
        background: #000A;
        border: 1px solid #F2F5F9; border-radius: 2px;
        display: none;
      }
      .bmv-hud-boss.visible { display: block; }
      .bmv-hud-boss-fill {
        height: 100%; width: 0%;
        background: #FF3B30;
        transition: width 0.1s ease-out;
      }
      /* 移动端（ux-spec §2：HUD 上移让出拇指区；字号物理 ≥14px；TASK-21 Bug2 安全区） */
      @media (max-width: 900px) {
        .bmv-hud-lv { left: 24px; top: 24px; }
        .bmv-hud-xp { left: 24px; top: 56px; width: 220px; height: 8px; }
        .bmv-hud-hp-num { left: 28px; top: 94px; font-size: 20px; }
        .bmv-hud-hp { left: 24px; top: 80px; width: 220px; height: 14px; }
        .bmv-hud-weapons {
          right: calc(60px + env(safe-area-inset-right, 0px));
          top: calc(24px + env(safe-area-inset-top, 0px));
          gap: 8px;
        }
        .bmv-hud-weapon { width: 44px; height: 44px; }
        .bmv-hud-pause {
          right: calc(24px + env(safe-area-inset-right, 0px));
          top: calc(24px + env(safe-area-inset-top, 0px));
        }
        .bmv-hud-boss { left: 25%; width: 50%; top: 12px; }
        .bmv-hud-skill {
          right: calc(24px + env(safe-area-inset-right, 0px));
          bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        }
      }
    `;
    host.appendChild(style);
  }
}

/** 便捷工厂：挂到默认 #ui-overlay（PlayScene 使用） */
export function createHud(opts: HudOptions): Hud {
  return new Hud(getOverlayHost(), opts);
}
