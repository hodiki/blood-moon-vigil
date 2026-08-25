import { describe, it, expect } from 'vitest';
import { FX } from '@/config/balance';
import { skillPoseFrameName, skillPosePhase, skillPoseTotalMs, bossEntranceFrameName } from '@/fx/skill-pose';

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
