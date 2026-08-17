import { describe, it, expect } from 'vitest';
import { hexToRgba } from '@/utils/math';

describe('utils/math hexToRgba（TASK-32 P1-2 token 纪律）', () => {
  it("'#RRGGBB' + alpha → rgba(r,g,b,a) 字符串，与 token 色值一致", () => {
    // PALETTE.token 派生：值不变、纯重构（review-task28 §5.4 S-1 / code-review-task28 P1-2）
    expect(hexToRgba('#8C2F2F', 0.5)).toBe('rgba(140,47,47,0.5)'); // decal-blood = PALETTE.enemyZombie
    expect(hexToRgba('#54E6C9', 0.1)).toBe('rgba(84,230,201,0.1)'); // 血月光晕 = PALETTE.playerAccent
    expect(hexToRgba('#FF3B30', 0.75)).toBe('rgba(255,59,48,0.75)'); // 月面高光 = PALETTE.danger
    expect(hexToRgba('#0B0E14', 0.55)).toBe('rgba(11,14,20,0.55)'); // 渐晕 = PALETTE.base
    expect(hexToRgba('#2A3346', 0.85)).toBe('rgba(42,51,70,0.85)'); // decal-rock = PALETTE.blocker
    expect(hexToRgba('#FFFFFF', 0.18)).toBe('rgba(255,255,255,0.18)'); // 高光 = WHITE
  });

  it('alpha=0 / 带 # 前缀 / 小写十六进制均正确解析', () => {
    expect(hexToRgba('#0B0E14', 0)).toBe('rgba(11,14,20,0)');
    expect(hexToRgba('8c2f2f', 0.5)).toBe('rgba(140,47,47,0.5)');
    expect(hexToRgba('54e6c9', 0)).toBe('rgba(84,230,201,0)');
  });
});
