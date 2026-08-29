/**
 * config/balance/heroes.ts —— 角色表 4
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

import type { PowerTag, HeroId, WeaponId } from './ids';

/** 角色配置（content-design-outline §2.6 成长曲线草图；初始武器见 §2.2~2.5） */
export interface HeroConfig {
  id: HeroId;
  name: string;
  powerTag: PowerTag;
  initialHp: number;
  hpPerLevel: number;
  initialSpeed: number;
  speedEveryNLevels: number;
  speedPerStep: number;
  damagePctPerLevel: number;
  initialWeapon: WeaponId;
  passive: string;
  activeSkillName: string;
}

/**
 * 角色表 4（content-design-outline §2.2~2.6）。
 * 注：§2.6 为草图值（守夜人 220 未吸收 TASK-39 R1 波次2 的 220→235 用户批准调整），
 * E4-S1 角色选择落地时以运行时 PLAYER.MOVE_SPEED 与评审裁决为准，本表保持设计稿口径。
 */
export const HEROES: Record<HeroId, HeroConfig> = {
  hero_edmund: { id: 'hero_edmund', name: '守夜人·艾德蒙', powerTag: 'HALLOWED', initialHp: 100, hpPerLevel: 8, initialSpeed: 220, speedEveryNLevels: 5, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_1', passive: '提灯圣辉：经验磁力 +20px', activeSkillName: '提灯闪耀' },
  hero_cassandra: { id: 'hero_cassandra', name: '血猎手·卡珊德拉', powerTag: 'SILVER', initialHp: 85, hpPerLevel: 6, initialSpeed: 245, speedEveryNLevels: 4, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_2', passive: '半裔之血：受击后 3s 内移速 +10%', activeSkillName: '血影突袭' },
  hero_violet: { id: 'hero_violet', name: '夜祷修女·薇奥莱', powerTag: 'HALLOWED', initialHp: 115, hpPerLevel: 10, initialSpeed: 205, speedEveryNLevels: 6, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_3', passive: '执烛之心：拾取治疗道具效果 +50%', activeSkillName: '安魂曲' },
  hero_galvan: { id: 'hero_galvan', name: '狼裔·加尔文', powerTag: 'BEAST', initialHp: 125, hpPerLevel: 12, initialSpeed: 215, speedEveryNLevels: 5, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_d_2', passive: '兽血愈合：击杀回复 0.5 HP（与吸血升级叠加）', activeSkillName: '血月狂化' },
};
