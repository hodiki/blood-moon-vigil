import { describe, it, expect } from 'vitest';
import { facingFlipX, walkCycleFrames, FACING_DEADZONE, defaultFacesRight } from '@/fx/anim';

describe('anim 朝向与步态策略（TA：idle 变体不当 9fps 走路）', () => {
  it('facingFlipX：朝右为正、朝左镜像、竖移保持', () => {
    expect(facingFlipX(40, true)).toBe(false);
    expect(facingFlipX(-40, false)).toBe(true);
    expect(facingFlipX(0, true)).toBe(true);
    expect(facingFlipX(FACING_DEADZONE, true)).toBe(true);
    expect(facingFlipX(-(FACING_DEADZONE + 1), false)).toBe(true);
  });

  it('defaultFacesRight：仅守夜人启用，避免朝左原图月步', () => {
    expect(defaultFacesRight('player')).toBe(true);
    expect(defaultFacesRight('player-v')).toBe(true);
    expect(defaultFacesRight('hero-cassandra')).toBeNull();
    expect(defaultFacesRight('enemy-zombie')).toBeNull();
  });

  it('walkCycleFrames：无 -walk-a/b 则不建 move（回落 idle）', () => {
    expect(walkCycleFrames('player', () => false)).toBeNull();
    expect(walkCycleFrames('player', (n) => n === 'player-walk-a')).toBeNull();
    expect(walkCycleFrames('enemy-hound', (n) => n === 'enemy-hound-walk-a' || n === 'enemy-hound-walk-b')).toEqual([
      'enemy-hound-walk-a',
      'enemy-hound-walk-b',
    ]);
  });
});
