import { describe, it, expect } from 'vitest';
import {
  KEYBIND_ROWS,
  KEYBINDS_TITLE,
  KEYBINDS_SEEN_STORAGE_KEY,
  loadKeybindsShown,
  markKeybindsShown,
} from '@/ui/keybinds-overlay';

/** 内存 Storage（node 环境无 DOM；只实现 getItem/setItem 接口面） */
function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

describe('NV-PLAYER-UI W-B4 键位卡（守夜人的第一课）', () => {
  it('键位卡内容：四行覆盖 WASD/空格/Q/Esc（玩家反馈「键位要自己猜」）', () => {
    expect(KEYBINDS_TITLE).toBe('守夜人的第一课');
    expect(KEYBIND_ROWS.map((r) => r.keys)).toEqual(['W A S D', '空格', 'Q', 'Esc']);
    expect(KEYBIND_ROWS.map((r) => r.label)).toEqual(['移动', '专属技能', '圣物', '暂停']);
  });

  it('首次标记：缺 key = 未展示过（应弹卡）；markKeybindsShown 写入后不再弹', () => {
    const storage = fakeStorage();
    expect(loadKeybindsShown(storage)).toBe(false);
    markKeybindsShown(storage);
    expect(loadKeybindsShown(storage)).toBe(true);
    expect(storage.map.get(KEYBINDS_SEEN_STORAGE_KEY)).toBe('1');
  });

  it('首次标记：重看（幂等写）不改变读取结果；不可用存储静默不抛错', () => {
    const storage = fakeStorage();
    markKeybindsShown(storage);
    markKeybindsShown(storage); // 教程重看路径（markSeen:false 时不写；写了也幂等）
    expect(loadKeybindsShown(storage)).toBe(true);
    // localStorage 不可用（隐私模式）：读 = 未展示、写不抛错
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Pick<Storage, 'getItem' | 'setItem'>;
    expect(loadKeybindsShown(broken)).toBe(false);
    expect(() => markKeybindsShown(broken)).not.toThrow();
  });
});
