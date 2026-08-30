/**
 * config/balance.ts —— 数值常量表（兼容出口）
 *
 * ⚠ EG-1 域拆分（B1 批次，CR 技术债 T2 清偿第一步）：
 * 本文件原为 1092 行单文件混 8+ 域（玩家/世界/敌人/武器/生成器/升级池/主动技/特效/经验）。
 * 现已按域拆分至 `src/config/balance/` 目录（ids/world/player/weapons/enemies/spawner/
 * fx/ui/active-skill/xp/upgrade/heroes/maps），本文件退化为**纯 re-export 兼容层**：
 * - 全部调用方 `@/config/balance` 导入路径零改动；
 * - **纯搬移，不改任何数值与行为**（873 测试全绿为门禁，balance-split.test 做 re-export 等价守卫）；
 * - 后续新配置表（专武/共鸣/圣物/树/CC 表）直接落对应域文件，不再回本文件。
 */

export * from './balance/ids';
export * from './balance/world';
export * from './balance/player';
export * from './balance/weapons';
export * from './balance/enemies';
export * from './balance/spawner';
export * from './balance/fx';
export * from './balance/ui';
export * from './balance/active-skill';
export * from './balance/xp';
export * from './balance/upgrade';
export * from './balance/heroes';
export * from './balance/maps';
export * from './balance/exclusive';
export * from './balance/upgrade-v3';
export * from './balance/resonance';
export * from './balance/talent-tree';
export * from './balance/formations';
export * from './balance/boss-skills';
