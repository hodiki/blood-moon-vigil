/**
 * stats/merit.ts —— 守夜功绩数据层（E4-S7，gdd-codex §3.4）
 *
 * 纯函数（可脱离 Phaser 单测）：功绩点数结算 + 4 加成配置 + 纯局内模式开关。
 * UI（主菜单「守夜功绩」页 4 卡选 2 / 结算页功绩条）= M3 范围；本模块只做数据层与
 * 生效状态记录（meritEquipped / pureInGame 开关写回 save.ts）。
 *
 * 功绩点数获取（每局结算，gdd-codex §3.4）：
 * 存活 +1/30s（满 6:00 +12）· 击杀 +1/50（典型 ~400 → +8）· 通关 +10 ·
 * 首杀 Boss/精英 +2/只 · 血月化身 +5（稀有）。
 * 单局典型 28~32 点；目标总成本 120 点 ≈ 4~5 局解锁全部 4 加成。
 *
 * 功绩加成（4 个，同时最多装 2 个；单加成对 6 分钟成型强度影响 ≤10% 红线口径，
 * gdd-codex §3.4 注；纯局内模式开关兜底）：
 * merit_hp 初始 +20 HP / merit_dmg 初始伤害 +5% / merit_magnet 初始磁力 +40px /
 * merit_speed 初始移速 +4%。
 */

import { PLAYER, GEM, type HeroConfig } from '@/config/balance';

export type MeritId = 'merit_hp' | 'merit_dmg' | 'merit_magnet' | 'merit_speed';

export interface MeritBonus {
  id: MeritId;
  name: string;
  desc: string;
  /** 数值（HP 绝对值 / 倍率百分比 / 磁力 px / 移速百分比） */
  value: number;
  /** 解锁成本（功绩点；merit-ui-spec §3 分项 20/30/40/30，合计 120） */
  cost: number;
}

export const MERIT_BONUSES: readonly MeritBonus[] = [
  { id: 'merit_hp', name: '初始 +20 HP', desc: '初始生命 100→120', value: 20, cost: 20 },
  { id: 'merit_dmg', name: '初始伤害 +5%', desc: '总倍率 1.0→1.05', value: 0.05, cost: 30 },
  { id: 'merit_magnet', name: '初始磁力 +40px', desc: '磁吸半径 140→180px', value: 40, cost: 40 },
  { id: 'merit_speed', name: '初始移速 +4%', desc: '移速 235→244.4 px/s（守夜人运行时）', value: 0.04, cost: 30 },
];

/** 同时最多装备加成数（gdd-codex §3.4：2 个） */
export const MERIT_MAX_EQUIPPED = 2;

/** 全部 4 加成解锁成本合计（merit-ui-spec §3：20+30+40+30 = 120 ≈ 4~5 局） */
export const MERIT_TOTAL_COST = 120;

/** 纯局内模式开关（gdd-codex §3.4：关闭全部功绩加成，纯净局/自证/平衡测试） */
export const PURE_IN_GAME_MODE_KEY = 'bmv.pureInGame';

/** 单加成解锁成本（未知 id 返回 0） */
export function meritUnlockCost(id: MeritId): number {
  return MERIT_BONUSES.find((b) => b.id === id)?.cost ?? 0;
}

/** 是否已解锁（功绩点 ≥ 成本；merit-ui-spec §4 未解锁灰显 + 成本提示） */
export function isMeritUnlocked(points: number, id: MeritId): boolean {
  return points >= meritUnlockCost(id);
}

export interface MeritPointsInput {
  /** 存活秒（满 6:00 = 360 → +12） */
  survivalSeconds: number;
  kills: number;
  victory: boolean;
  /** 首杀 Boss/精英数（+2/只） */
  firstBossKills: number;
  /** 血月化身击杀（+5，稀有） */
  avatarKills: number;
}

/** 功绩点数结算（gdd-codex §3.4 表；存活 +1/30s、击杀 +1/50、通关 +10、首杀 +2、化身 +5） */
export function calculateMeritPoints(input: MeritPointsInput): number {
  const survival = Math.floor(input.survivalSeconds / 30);
  const kills = Math.floor(input.kills / 50);
  const victory = input.victory ? 10 : 0;
  const firstBoss = input.firstBossKills * 2;
  const avatar = input.avatarKills * 5;
  return survival + kills + victory + firstBoss + avatar;
}

/** 加成对基础值比例（gdd-codex §3.4 红线口径注：以「对 6 分钟成型强度影响 ≤10%」为准） */
export function meritImpactPct(merit: MeritBonus): number {
  switch (merit.id) {
    case 'merit_hp':
      return 20 / 308; // +20 HP ≈ 2.5 级 HP 成长，约占 Lv27 HP(308) 的 6.5%
    case 'merit_dmg':
      return 0.05; // 倍率 +5%
    case 'merit_magnet':
      // 磁力 +40px 只影响节奏不影响强度（gdd-codex §3.4 注：使前期拾取效率 +20%，但不计入强度红线）
      return 0;
    case 'merit_speed':
      return 0.04;
    default:
      return 0;
  }
}

/** 全部 4 加成对成型强度影响 ≤10% 红线断言（sim-verify §8 / gdd-codex §3.4 口径） */
export function allMeritBonusesWithinRedline(): boolean {
  return MERIT_BONUSES.every((m) => meritImpactPct(m) <= 0.1);
}

/** 装备校验：最多 2 个（gdd-codex §3.4） */
export function canEquipMerit(equipped: readonly MeritId[], id: MeritId): boolean {
  if (equipped.includes(id)) return true; // 重复装备 = 移除切换
  return equipped.length < MERIT_MAX_EQUIPPED;
}

/** 装备后列表（加/移除切换；超过 2 个拒绝） */
export function toggleMeritEquipped(equipped: readonly MeritId[], id: MeritId): MeritId[] {
  if (equipped.includes(id)) return equipped.filter((e) => e !== id);
  if (equipped.length >= MERIT_MAX_EQUIPPED) return [...equipped]; // 已达上限拒绝（M3 UI 做替换确认）
  return [...equipped, id];
}

/** 功绩加成生效结果（PlayScene 开局消费；数据层记录生效状态） */
export interface MeritAppliedResult {
  applied: MeritId[];
  /** 纯局内模式：true 时全部加成不生效（gdd-codex §3.4 兜底） */
  pureInGame: boolean;
  maxHpDelta: number;
  damageMultDelta: number;
  magnetRadiusDelta: number;
  moveSpeedDelta: number;
}

/**
 * 计算开局生效的功绩加成（纯局内模式关闭全部）。
 * 不修改 PlayerStats —— 返回 delta 由 PlayScene 写回（数据层与装配分离，可单测）。
 */
export function computeMeritApplication(
  equipped: readonly MeritId[],
  pureInGame: boolean,
  hero?: HeroConfig,
): MeritAppliedResult {
  const applied: MeritId[] = pureInGame ? [] : [...equipped];
  const result: MeritAppliedResult = {
    applied,
    pureInGame,
    maxHpDelta: 0,
    damageMultDelta: 0,
    magnetRadiusDelta: 0,
    moveSpeedDelta: 0,
  };
  for (const id of applied) {
    const bonus = MERIT_BONUSES.find((b) => b.id === id);
    if (!bonus) continue;
    switch (id) {
      case 'merit_hp':
        result.maxHpDelta += bonus.value;
        break;
      case 'merit_dmg':
        result.damageMultDelta += bonus.value;
        break;
      case 'merit_magnet':
        result.magnetRadiusDelta += bonus.value;
        break;
      case 'merit_speed': {
        // 移速 4%：守夜人运行时 235 基线，其余角色按配置
        const base = hero?.id === 'hero_edmund' ? PLAYER.MOVE_SPEED : (hero?.initialSpeed ?? PLAYER.MOVE_SPEED);
        result.moveSpeedDelta += base * bonus.value;
        break;
      }
    }
  }
  return result;
}

/** 磁力加成参考基线（gdd-codex §3.4：140px） */
export function meritMagnetBase(): number {
  return GEM.MAGNET_RADIUS;
}
