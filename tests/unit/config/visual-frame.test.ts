import { describe, expect, it } from 'vitest';
import { visualFrameForContent } from '@/config/frame-registry';
import { idleAnimKey, moveAnimKey } from '@/fx/anim';

describe('visualFrameForContent', () => {
  it('角色待机帧取注册表第一帧', () => {
    expect(visualFrameForContent('hero_edmund')).toBe('player');
    expect(visualFrameForContent('hero_cassandra')).toBe('hero-cassandra');
    expect(visualFrameForContent('hero_violet')).toBe('hero-violet');
    expect(visualFrameForContent('hero_galvan')).toBe('hero-galvan');
  });

  it('Boss 待机帧取注册表第一帧', () => {
    expect(visualFrameForContent('boss_1', 'enemy-boss')).toBe('enemy-boss');
    expect(visualFrameForContent('boss_2', 'enemy-boss')).toBe('boss-cardinal');
  });

  it('未知内容回退', () => {
    expect(visualFrameForContent('not_a_hero')).toBe('player');
  });
});

describe('anim keys', () => {
  it('idle/move 跟帧名走，避免 15 敌共用 wolf 剪影', () => {
    expect(idleAnimKey('enemy-hound')).toBe('enemy-hound-idle');
    expect(moveAnimKey('enemy-hound')).toBe('enemy-hound-move');
    expect(idleAnimKey('hero-cassandra')).toBe('hero-cassandra-idle');
  });
});
