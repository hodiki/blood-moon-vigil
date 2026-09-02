import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nightProgressFraction } from '@/ui/hud-state';
import { nightClockText } from '@/config/ui-copy';

const srcOf = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../src/${rel}`, import.meta.url)), 'utf-8');

describe('NV-PLAYER-UI W-B6 夜间时钟渲染端 + 血月辨识占位', () => {
  it('nightProgressFraction：elapsed/total，越界钳制，非法 total 兜底 0', () => {
    expect(nightProgressFraction(0, 360)).toBe(0);
    expect(nightProgressFraction(180, 360)).toBe(0.5);
    expect(nightProgressFraction(90, 360)).toBeCloseTo(0.25, 10);
    expect(nightProgressFraction(400, 360)).toBe(1); // 超出钳制
    expect(nightProgressFraction(-5, 360)).toBe(0); // 负值钳制
    expect(nightProgressFraction(10, 0)).toBe(0); // 非法 total
  });

  it('setNightClock 数据口：00:00→06:00 时刻 + 黎明提示（ui-copy 单一来源）', () => {
    expect(nightClockText(0, 360).clock).toBe('00:00');
    expect(nightClockText(180, 360).clock).toBe('03:00');
    expect(nightClockText(360, 360).clock).toBe('06:00');
    expect(nightClockText(360, 360).dawn).toBe('黎明已至');
    expect(nightClockText(60, 360).dawn).toBe('距黎明还差 5 分 0 秒');
  });

  it('hud 源码守卫：夜间时钟元素 + setNightClock 方法 + 纯函数接线齐全', () => {
    const s = srcOf('ui/hud.ts');
    expect(s).toContain('setNightClock(elapsedSeconds: number, totalSeconds: number)');
    expect(s).toContain('bmv-hud-nightclock');
    expect(s).toContain('nightClockText(elapsedSeconds, totalSeconds)');
    expect(s).toContain('nightProgressFraction(elapsedSeconds, totalSeconds)');
    // 防每帧抖动：进度 <0.5% 跳过（与技能 CD 同口径）
    expect(s).toContain('Math.abs(frac - this.lastNightFrac) < 0.005');
  });

  it('hud-state 导出夜间进度纯函数（渲染端先行，游戏侧 setNightClock 数据口对齐）', () => {
    const s = srcOf('ui/hud-state.ts');
    expect(s).toContain('export function nightProgressFraction');
  });

  it('血月辨识占位：fx-manager 上浮放大 + procedural-textures 纹理化占位标注', () => {
    const fx = srcOf('fx/fx-manager.ts');
    expect(fx).toContain('cfg.designHeight * 0.12'); // 0.16 → 0.12 上浮
    expect(fx).toContain('cfg.isMobile ? 150 : 230'); // 120/190 → 150/230
    const tex = srcOf('fx/procedural-textures.ts');
    // 降饱和（高光 0.75 → 0.5）+ 柔光晕 + 月相阴影，全部标注 W-B6 占位
    expect(tex).toContain('W-B6 占位');
    expect(tex).toContain('月相阴影');
    expect(tex).toContain('PALETTE.danger, 0.5)');
  });
});
