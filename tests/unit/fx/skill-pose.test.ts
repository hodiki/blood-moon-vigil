import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FX } from '@/config/balance';
import { skillPoseFrameName, skillPosePhase, skillPoseTotalMs, bossEntranceFrameName, SkillPoseClock } from '@/fx/skill-pose';

describe('主动技姿态叠层（无蓄力资源；表现 300+150ms）', () => {
  it('常量：skill-a 300ms + skill-b 150ms = 0.45s', () => {
    expect(FX.SKILL_POSE_A_MS).toBe(300);
    expect(FX.SKILL_POSE_B_MS).toBe(150);
    expect(skillPoseTotalMs()).toBe(450);
  });

  it('相位：未开始 / a / b / 结束回 idle', () => {
    expect(skillPosePhase(-1)).toBeNull();
    expect(skillPosePhase(0)).toBe('a');
    expect(skillPosePhase(299)).toBe('a');
    expect(skillPosePhase(300)).toBe('b');
    expect(skillPosePhase(449)).toBe('b');
    expect(skillPosePhase(450)).toBeNull();
  });

  it('帧名：基帧 + -skill-a/b；Boss 出场 -entrance', () => {
    expect(skillPoseFrameName('player', 'a')).toBe('player-skill-a');
    expect(skillPoseFrameName('hero-cassandra', 'b')).toBe('hero-cassandra-skill-b');
    expect(bossEntranceFrameName('boss-cardinal')).toBe('boss-cardinal-entrance');
  });
});

// —— QA-FIX-3 修复 4：姿态计时与消费链路端到端（R3 T-F17「①无施法姿态」回归锚点） ——

describe('SkillPoseClock（Player 委托的姿态计时；释放瞬间 start，elapsed 驱动 a→b→idle）', () => {
  it('未开始：elapsedMs 为 -1（skillPosePhase 判 null → 回 idle）', () => {
    const clock = new SkillPoseClock();
    expect(clock.elapsedMs(12345)).toBe(-1);
  });

  it('释放后：elapsedMs ≥ 0 且随时间推进（施放瞬间 0，帧间递增）', () => {
    const clock = new SkillPoseClock();
    clock.start(1000);
    expect(clock.elapsedMs(1000)).toBe(0);
    expect(clock.elapsedMs(1000)).toBeGreaterThanOrEqual(0);
    expect(clock.elapsedMs(1050)).toBe(50);
    expect(clock.elapsedMs(1449)).toBe(449);
  });

  it('端到端时序：elapsed → skillPosePhase = a(300ms) → b(150ms) → null（回 idle）', () => {
    const clock = new SkillPoseClock();
    clock.start(0);
    expect(skillPosePhase(clock.elapsedMs(0))).toBe('a');
    expect(skillPosePhase(clock.elapsedMs(299))).toBe('a');
    expect(skillPosePhase(clock.elapsedMs(300))).toBe('b');
    expect(skillPosePhase(clock.elapsedMs(449))).toBe('b');
    expect(skillPosePhase(clock.elapsedMs(450))).toBeNull(); // 回 idle（anim.ts playVisual 接管）
  });

  it('anim.ts 姿态消费链路端到端：四角色姿态帧在 characters 图集中真实存在（holdFrame 不落空）', () => {
    const atlasPath = fileURLToPath(new URL('../../../assets/atlas/characters.json', import.meta.url));
    const atlas = JSON.parse(readFileSync(atlasPath, 'utf-8')) as { frames: Array<{ filename: string }> };
    const frames = new Set(atlas.frames.map((f) => f.filename));
    // 守夜人回退基帧 player + 三角色 hero-*（frame-registry / visual-frame 口径）
    for (const base of ['player', 'hero-cassandra', 'hero-violet', 'hero-galvan']) {
      expect(frames.has(skillPoseFrameName(base, 'a'))).toBe(true);
      expect(frames.has(skillPoseFrameName(base, 'b'))).toBe(true);
    }
  });
});
