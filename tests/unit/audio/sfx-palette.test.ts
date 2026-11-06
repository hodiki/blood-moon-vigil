import { describe, it, expect } from 'vitest';
import {
  SFX_PALETTE,
  KILL_VARIANTS,
  SFX_PRIORITY,
  type SfxPart,
  type NoisePart,
} from '@/audio/sfx-palette';

/** 首版必落 5 项事件 SFX（audio-bible §7 红线；击杀 4 变体另计 = 6 项最低集合） */
const REQUIRED_SFX = ['weapon', 'gem', 'hurt', 'confirm', 'boss'] as const;

/** 批 A-3 补齐的 bible §2 待补 3 项（主理人裁决 Q3=a） */
const BATCH_A3_SFX = ['rare', 'cardSlide', 'tick'] as const;

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
      expect(spec.priority, spec.id).toBeGreaterThanOrEqual(0);
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

  it('批 A-3 三项补齐（#4 稀有金铃 / #7 卡滑入 / #10 结算 tick）', () => {
    for (const id of BATCH_A3_SFX) {
      expect(SFX_PALETTE[id], `SFX ${id} 缺失`).toBeDefined();
    }
  });

  it('#4/#7/#10 音量基线对齐 bible §2（-6 / -20 / -18 dB）', () => {
    expect(SFX_PALETTE.rare.gainDb).toBe(-6);
    expect(SFX_PALETTE.cardSlide.gainDb).toBe(-20);
    expect(SFX_PALETTE.tick.gainDb).toBe(-18);
  });

  it('#10 tick 极短 0.02s（bible §2「极轻 tick」，不得拖尾）', () => {
    for (const part of SFX_PALETTE.tick.parts) {
      expect(part.dur).toBeLessThanOrEqual(0.02);
    }
  });

  it('#4 与 #3 明显可区分：轮廓反转（#3 上行 / #4 下行）+ 节奏拉开（#4 延留 ≥0.15s）', () => {
    const gemTones = SFX_PALETTE.gem.parts.filter((p) => p.kind === 'tone');
    const rareTones = SFX_PALETTE.rare.parts.filter((p) => p.kind === 'tone');
    // #3：末音高于首音（上行）
    const gemFirst = gemTones[0] as { freq: number };
    const gemLast = gemTones[gemTones.length - 1] as { freq: number };
    expect(gemLast.freq).toBeGreaterThan(gemFirst.freq);
    // #4：「咚」在「叮」之后且更低（下行「叮——咚」）
    const ding = rareTones[0] as { freq: number; type: string };
    const dong = rareTones.find((p) => (p as { delay?: number }).delay !== undefined) as {
      freq: number;
      delay: number;
    };
    expect(dong).toBeDefined();
    expect(dong.freq).toBeLessThan(ding.freq);
    expect(dong.delay).toBeGreaterThanOrEqual(0.15);
    // #4 用 triangle 铃体音色（#3 为纯 sine）——音色型区分
    expect(ding.type).toBe('triangle');
  });

  it('#7 气声走高通/带通噪声（「嘶」的空气感，非低频闷轰）', () => {
    const noise = SFX_PALETTE.cardSlide.parts.find((p) => p.kind === 'noise') as NoisePart | undefined;
    expect(noise).toBeDefined();
    expect(noise!.filterType === 'highpass' || noise!.filterType === 'bandpass').toBe(true);
    expect(noise!.filterFreq).toBeGreaterThanOrEqual(1000);
  });

  it('同发让位优先级对齐 bible §3：受击/确认/Boss > 击杀 > 拾取 > 武器 > 装饰', () => {
    const s = SFX_PALETTE;
    expect(s.hurt.priority).toBe(SFX_PRIORITY.CRITICAL);
    expect(s.confirm.priority).toBe(SFX_PRIORITY.CRITICAL);
    expect(s.boss.priority).toBe(SFX_PRIORITY.CRITICAL);
    expect(KILL_VARIANTS.zombie.priority).toBe(SFX_PRIORITY.KILL);
    expect(s.gem.priority).toBe(SFX_PRIORITY.PICKUP);
    expect(s.rare.priority).toBe(SFX_PRIORITY.PICKUP);
    expect(s.weapon.priority).toBe(SFX_PRIORITY.WEAPON);
    expect(s.cardSlide.priority).toBe(SFX_PRIORITY.DECORATION);
    expect(s.tick.priority).toBe(SFX_PRIORITY.DECORATION);
    // 严格序：CRITICAL > KILL > PICKUP > WEAPON > DECORATION
    expect(SFX_PRIORITY.CRITICAL).toBeGreaterThan(SFX_PRIORITY.KILL);
    expect(SFX_PRIORITY.KILL).toBeGreaterThan(SFX_PRIORITY.PICKUP);
    expect(SFX_PRIORITY.PICKUP).toBeGreaterThan(SFX_PRIORITY.WEAPON);
    expect(SFX_PRIORITY.WEAPON).toBeGreaterThan(SFX_PRIORITY.DECORATION);
  });
});
