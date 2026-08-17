import { describe, it, expect } from 'vitest';
import { SFX_PALETTE, KILL_VARIANTS, type SfxPart } from '@/audio/sfx-palette';

/** 首版必落 5 项事件 SFX（audio-bible §7 红线；击杀 4 变体另计 = 6 项最低集合） */
const REQUIRED_SFX = ['weapon', 'gem', 'hurt', 'confirm', 'boss'] as const;

describe('SFX 程序合成规格（audio-bible §2 / §7：首版最低集合，全部零文件）', () => {
  it('必备事件 SFX 齐全', () => {
    for (const id of REQUIRED_SFX) {
      expect(SFX_PALETTE[id], `SFX ${id} 缺失`).toBeDefined();
    }
  });

  it('击杀闷响 4 变体齐全（行尸/血犬/屠夫/Boss 递重）', () => {
    expect(Object.keys(KILL_VARIANTS)).toHaveLength(4);
    expect(KILL_VARIANTS.zombie).toBeDefined();
    expect(KILL_VARIANTS.wolf).toBeDefined();
    expect(KILL_VARIANTS.tank).toBeDefined();
    expect(KILL_VARIANTS.boss).toBeDefined();
  });

  it('合成参数合法：dB≤0、minGap≥0、parts 非空、dur>0、gain∈(0,1]', () => {
    const specs = [...Object.values(SFX_PALETTE), ...Object.values(KILL_VARIANTS)];
    for (const spec of specs) {
      expect(spec.gainDb, spec.id).toBeLessThanOrEqual(0);
      expect(spec.minGapMs, spec.id).toBeGreaterThanOrEqual(0);
      expect(spec.parts.length, spec.id).toBeGreaterThan(0);
      for (const part of spec.parts as SfxPart[]) {
        expect(part.dur, spec.id).toBeGreaterThan(0);
        expect(part.gain, spec.id).toBeGreaterThan(0);
        expect(part.gain, spec.id).toBeLessThanOrEqual(1);
        if (part.kind === 'tone') {
          expect(part.freq, spec.id).toBeGreaterThan(0);
        } else {
          expect(part.filterFreq, spec.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it('同事件 min-gap 限流窗口已配置（宝石密集 80ms 限流，bible §3）', () => {
    expect(SFX_PALETTE.gem.minGapMs).toBeGreaterThanOrEqual(80);
    expect(SFX_PALETTE.weapon.minGapMs).toBeGreaterThanOrEqual(50);
  });

  it('胜利/失败 sting 已随结算页落地（bible §7 建议项）', () => {
    expect(SFX_PALETTE.victory).toBeDefined();
    expect(SFX_PALETTE.defeat).toBeDefined();
  });
});
