/**
 * ui/overlay-mutex.ts —— 进局/局内阻断弹窗互斥
 *
 * 同时只展示一层阻断弹窗：后打开的一层会先收起已注册的、层级不超过它的其他层。
 * 各 overlay 在构造时 register，show 时 claim，destroy 时注销。
 * hide 只收起 DOM，不触发完成回调（例如序章不会因此直接进入专武抉择）。
 */
export type OverlayMutexId =
  | 'narrative'
  | 'keybinds'
  | 'prologue'
  | 'exclusive'
  | 'pause'
  | 'levelup'
  | 'results';

const RANK: Record<OverlayMutexId, number> = {
  narrative: 10,
  keybinds: 20,
  prologue: 30,
  exclusive: 40,
  pause: 50,
  levelup: 60,
  results: 70,
};

type Slot = { hide: () => void };

const slots = new Map<OverlayMutexId, Slot>();

export function registerOverlayMutex(id: OverlayMutexId, hide: () => void): () => void {
  slots.set(id, { hide });
  return () => {
    const cur = slots.get(id);
    if (cur?.hide === hide) slots.delete(id);
  };
}

export function claimOverlay(id: OverlayMutexId): void {
  const rank = RANK[id];
  for (const [other, slot] of slots) {
    if (other === id) continue;
    if (RANK[other] <= rank) slot.hide();
  }
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.bmv-narrative').forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });
  }
}
