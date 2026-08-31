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

  it('defaultFacesRight：四角色启用（NV-INTEG-FIX P1 扩表），敌人不翻转避免月步', () => {
    expect(defaultFacesRight('player')).toBe(true);
    expect(defaultFacesRight('player-v')).toBe(true);
    expect(defaultFacesRight('player-skill-a')).toBe(true);
    // NV-INTEG-FIX P1：四角色帧表补齐（含变体后缀剥离）
    expect(defaultFacesRight('hero-edmund')).toBe(true);
    expect(defaultFacesRight('hero-cassandra')).toBe(true);
    expect(defaultFacesRight('hero-cassandra-v')).toBe(true);
    expect(defaultFacesRight('hero-violet-skill-a')).toBe(true);
    expect(defaultFacesRight('hero-galvan')).toBe(true);
    expect(defaultFacesRight('enemy-zombie')).toBeNull();
    expect(defaultFacesRight('enemy-stonewolf-broken-v')).toBeNull();
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
