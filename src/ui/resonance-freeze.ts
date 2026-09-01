/**
 * ui/resonance-freeze.ts —— 共鸣达成 0.8s 定格演出（NV-P2-ZERO P2-3 / B6 遗留，gdd-resonance §3/§⑧）
 *
 * 设计规格（gdd-resonance.md L196「共鸣切换 0.8s 定格演出（复用寻获模板）」）：
 * 全屏暗化 + 徽记居中（reso-achieved 帧，复用 hud.ts 四态视觉惯例）+「共鸣·<名>」命名 + 词根色底光。
 *
 * 实现取舍（程序化，注释留痕）：
 * - 选**纯视觉层**而非敌人降速 0.8s：共鸣达成发生在 LEVEL_UP 相位（选卡写回瞬间世界已冻结），
 *   降速无可感知窗口；且避免触碰相位机/时间缩放（twigans/sims 零耦合，不干扰 20× bench 连跑）。
 * - DOM 层走 ADR-004 惯例（CSS 动画不受 Phaser tweens.pauseAll() 影响；pointer-events:none
 *   不拦截任何输入，演出可与选卡确认/下一轮三选一并行，不产生阻塞死锁）。
 * - 0.8s 自动移除节点，无持久状态；幂等：连续触发各建各的实例，互不覆盖。
 */

import { preferFrameImg } from '@/ui/frame-img';

export const RESONANCE_FREEZE_MS = 800;

/** 徽记帧与文案映射（与 hud.setResonanceBadge achieved 态同源：reso-achieved 帧 +「共鸣」词） */
const BADGE_FRAME = 'reso-achieved';

/** 播放定格演出：向 host 追加全屏层，durationMs 后自动移除；返回根节点（测试断言用） */
export function showResonanceFreeze(host: HTMLElement, pairName: string, opts: { durationMs?: number } = {}): HTMLElement {
  const durationMs = opts.durationMs ?? RESONANCE_FREEZE_MS;
  ensureStyles(host);

  const root = document.createElement('div');
  root.className = 'bmv-reso-freeze';
  root.innerHTML = `
    <div class="bmv-reso-freeze-mask"></div>
    <div class="bmv-reso-freeze-card">
      <div class="bmv-reso-freeze-badge"><span class="bmv-reso-freeze-word">共鸣</span></div>
      <div class="bmv-reso-freeze-name">共鸣·${escapeHtml(pairName)}</div>
    </div>
  `;
  const badge = root.querySelector('.bmv-reso-freeze-badge') as HTMLElement;
  preferFrameImg(badge, BADGE_FRAME);
  host.appendChild(root);
  window.setTimeout(() => root.remove(), durationMs);
  return root;
}

/** CSS 注入一次（色板抄 art-bible：冷青描边 / 幽紫底光，gdd-resonance §3 词根色） */
function ensureStyles(host: HTMLElement): void {
  if (document.getElementById('bmv-reso-freeze-styles')) return;
  const style = document.createElement('style');
  style.id = 'bmv-reso-freeze-styles';
  style.textContent = `
    .bmv-reso-freeze {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none; /* 纯演出层：不拦截输入（避免与选卡确认并行时死锁） */
      z-index: 60;
      animation: bmv-reso-freeze-lifecycle ${RESONANCE_FREEZE_MS}ms ease-out forwards;
    }
    .bmv-reso-freeze-mask {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.72);
    }
    .bmv-reso-freeze-card {
      position: relative;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px;
      padding: 24px 40px;
      background: #241A33;
      border: 2px solid #54E6C9;
      border-radius: 12px;
      box-shadow: 0 0 24px rgba(176,106,240,0.55), 0 0 48px rgba(84,230,201,0.25);
      animation: bmv-reso-freeze-pop 0.18s ease-out;
    }
    .bmv-reso-freeze-badge {
      width: 96px; height: 96px;
      display: flex; align-items: center; justify-content: center;
      background: #0B0E14; border: 2px solid #B06AF0; border-radius: 10px;
      box-shadow: 0 0 12px rgba(176,106,240,0.8);
    }
    .bmv-reso-freeze-badge img.bmv-frame-img { width: 100%; height: 100%; image-rendering: pixelated; border-radius: 8px; }
    .bmv-reso-freeze-word {
      position: absolute; font-size: 15px; font-weight: 700; color: #54E6C9;
      text-shadow: 0 0 6px rgba(84,230,201,0.9); pointer-events: none;
    }
    .bmv-reso-freeze-name {
      font-size: 22px; font-weight: 700; color: #F2F5F9;
      text-shadow: 0 0 8px rgba(176,106,240,0.8);
    }
    /* 寻获模板复用：整体 0.8s 生命周期 = 0.12s 显形 → 保持 → 0.2s 隐去（定格感） */
    @keyframes bmv-reso-freeze-lifecycle {
      0% { opacity: 0; } 15% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; }
    }
    @keyframes bmv-reso-freeze-pop {
      from { transform: scale(0.92); } to { transform: scale(1); }
    }
  `;
  host.appendChild(style);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
