import { describe, it, expect } from 'vitest';
import {
  UPGRADE_POOL,
  UPGRADE_POOL_RULES,
  UPGRADES,
  type UpgradeId,
  type UpgradePoolItem,
  type WeaponClass,
  type HeroId,
} from '@/config/balance';

/**
 * E1-S4 升级池 40 项口径落地（gdd-upgrade-pool-v2 v1.1 / 裁定 R-M1b-RULING-1）。
 * 断言目标：
 * 1. 机制型 34/40 = 85% ≥ 50%（支柱 2）——全局 5/9、武器 12/12、钥 5/7、主动技 12/12；
 * 2. up_g_7 减伤 / up_g_9 拾取范围 / key_scope 鹰眼镜片 / key_holy 圣辉坠饰 4 项
 *    「数值」→「机制」口径 + 蓝紫卡面（§3.2/§3.4，行为影响归机制）；
 * 3. 抽取规则标签过滤语义（§3.6.1：全局+钥→所有人、武器类→仅持该类、主动技→仅当前角色）
 *    与规则参数（§3.6.2~3.6.5：×2/×1、进化 ×3、防重复 ×0.5、超时 30s 自动第 1 张、满级剔除）；
 * 4. 兼容性：4 项为 v2 池专属（UPGRADES 12 项数字 id 无映射），既有 9/12=75% 基线不回归。
 */

const byId = (id: UpgradeId): UpgradePoolItem => {
  const item = UPGRADE_POOL.find((u) => u.id === id);
  expect(item).toBeDefined();
  return item!;
};

/** 标签过滤语义纯函数（§3.6.1）：给定当前角色 + 已拥有武器类，返回可选池 */
function eligiblePool(heroId: HeroId, ownedClasses: ReadonlySet<WeaponClass>): UpgradePoolItem[] {
  return UPGRADE_POOL.filter((u) =>
    u.tags.some((t) =>
      t === 'global' ||
      t === 'key' ||
      (t.startsWith('weapon_class_') && ownedClasses.has(t.slice('weapon_class_'.length).toUpperCase() as WeaponClass)) ||
      t === heroId,
    ),
  );
}

/** 武器类大写（balance.ts WeaponClass 枚举 A/B/C/D；升级标签为小写 weapon_class_<类>） */
const WEAPON_CLASSES: readonly WeaponClass[] = ['A', 'B', 'C', 'D'];
const HERO_IDS: readonly HeroId[] = ['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan'];

describe('E1-S4 机制型计数 36/40 = 90%（gdd-upgrade-pool-v2 §3.1 裁定 R-M1b-RULING-1 + M3-DESIGN-1 数值方向化）', () => {
  it('恰好 40 项，机制型 36 / 数值型 4，占比 90% ≥ 50%', () => {
    expect(UPGRADE_POOL).toHaveLength(40);
    const mechanics = UPGRADE_POOL.filter((u) => u.type === 'mechanic');
    const numerics = UPGRADE_POOL.filter((u) => u.type === 'numeric');
    expect(mechanics).toHaveLength(36);
    expect(numerics).toHaveLength(4);
    expect(mechanics.length / UPGRADE_POOL.length).toBeCloseTo(0.9, 6);
    expect(mechanics.length / UPGRADE_POOL.length).toBeGreaterThanOrEqual(0.5);
  });

  it('分区计数与 §3.1 总览一致：全局 7/9、武器 12/12、钥 5/7、主动技 12/12（up_g_3/up_g_4 转机制型）', () => {
    const globalItems = UPGRADE_POOL.filter((u) => u.tags.includes('global'));
    const keyItems = UPGRADE_POOL.filter((u) => u.tags.includes('key'));
    const weaponItems = UPGRADE_POOL.filter((u) => u.tags.some((t) => t.startsWith('weapon_class_')));
    const activeItems = UPGRADE_POOL.filter((u) => u.tags.some((t) => t.startsWith('hero_')));
    expect(globalItems).toHaveLength(9);
    expect(keyItems).toHaveLength(7);
    expect(weaponItems).toHaveLength(12);
    expect(activeItems).toHaveLength(12);
    expect(globalItems.filter((u) => u.type === 'mechanic')).toHaveLength(7); // 原 5/9 + up_g_3/up_g_4
    expect(keyItems.filter((u) => u.type === 'mechanic')).toHaveLength(5);
    expect(weaponItems.every((u) => u.type === 'mechanic')).toBe(true);
    expect(activeItems.every((u) => u.type === 'mechanic')).toBe(true);
    // 分区机制型合计 = 7 + 12 + 5 + 12 = 36
    const sum = 7 + 12 + 5 + 12;
    expect(sum).toBe(36);
  });

  it('M3-DESIGN-1 数值方向化：up_g_3 鲜血契约 / up_g_4 踏月而行转机制型（原 5/9 → 7/9）', () => {
    expect(byId('up_g_3')).toMatchObject({ name: '鲜血契约', type: 'mechanic', cardKind: 'blue-purple', maxStack: 3 });
    expect(byId('up_g_4')).toMatchObject({ name: '踏月而行', type: 'mechanic', cardKind: 'blue-purple', maxStack: 3 });
    // 纯数值项收敛为 4：up_g_1 / up_g_2 / key_tome / key_silver
    const numerics = UPGRADE_POOL.filter((u) => u.type === 'numeric');
    expect(numerics.map((u) => u.id).sort()).toEqual(['key_silver', 'key_tome', 'up_g_1', 'up_g_2']);
  });

  it('4 项口径修正：up_g_7 减伤 / up_g_9 拾取范围 / key_scope 鹰眼镜片 / key_holy 圣辉坠饰 = 机制 + 蓝紫卡面（v1.1）', () => {
    expect(byId('up_g_7')).toMatchObject({ name: '减伤 +10%', type: 'mechanic', cardKind: 'blue-purple', maxStack: 3 });
    expect(byId('up_g_9')).toMatchObject({ name: '拾取范围 +40px', type: 'mechanic', cardKind: 'blue-purple', maxStack: 2 });
    expect(byId('key_scope')).toMatchObject({ name: '鹰眼镜片', type: 'mechanic', cardKind: 'blue-purple', maxStack: 1 });
    expect(byId('key_holy')).toMatchObject({ name: '圣辉坠饰', type: 'mechanic', cardKind: 'blue-purple', maxStack: 1 });
  });

  it('卡面与类型强一致（asset-spec §1.6）：机制=蓝紫底 / 数值=琥珀金底，40 项无例外', () => {
    for (const u of UPGRADE_POOL) {
      if (u.type === 'mechanic') expect(u.cardKind).toBe('blue-purple');
      else expect(u.cardKind).toBe('amber-gold');
    }
  });
});

describe('E1-S4 抽取规则标签过滤语义（§3.6.1）', () => {
  it('全局 9 + 被动钥 7 → 所有人常驻（无拥有条件）', () => {
    expect(UPGRADE_POOL.filter((u) => u.tags.includes('global'))).toHaveLength(9);
    expect(UPGRADE_POOL.filter((u) => u.tags.includes('key'))).toHaveLength(7);
  });

  it('武器类强化 12 = 4 类 ×3 → 仅「已拥有该类武器」可见', () => {
    const classTags = ['weapon_class_a', 'weapon_class_b', 'weapon_class_c', 'weapon_class_d'] as const;
    for (const tag of classTags) {
      expect(UPGRADE_POOL.filter((u) => u.tags.includes(tag))).toHaveLength(3);
    }
  });

  it('主动技强化 12 = 4 角色 ×3 → 仅当前角色可见', () => {
    for (const hero of HERO_IDS) {
      expect(UPGRADE_POOL.filter((u) => u.tags.includes(hero))).toHaveLength(3);
    }
  });

  it('单局可选池约 20~28（§3.6.1）：守夜人持 A 类 = 22；持 2/3 类 = 25/28；4 类全持 = 31（全武器边缘）', () => {
    const allClasses = new Set<WeaponClass>(WEAPON_CLASSES);
    expect(eligiblePool('hero_edmund', new Set<WeaponClass>(['A']))).toHaveLength(22);
    expect(eligiblePool('hero_edmund', new Set<WeaponClass>(['A', 'B']))).toHaveLength(25);
    expect(eligiblePool('hero_edmund', new Set<WeaponClass>(['A', 'B', 'C']))).toHaveLength(28);
    expect(eligiblePool('hero_edmund', allClasses)).toHaveLength(31);
    // 1~3 类均落在 GDD「约 20~28」区间
    for (const n of [1, 2, 3] as const) {
      const owned = WEAPON_CLASSES.slice(0, n);
      const size = eligiblePool('hero_edmund', new Set<WeaponClass>(owned)).length;
      expect(size).toBeGreaterThanOrEqual(20);
      expect(size).toBeLessThanOrEqual(28);
    }
  });

  it('标签过滤不含越权项：任意单角色可选池不混入他角色主动技强化（§⑥.7）', () => {
    for (const hero of HERO_IDS) {
      const pool = eligiblePool(hero, new Set<WeaponClass>(['A']));
      for (const u of pool) {
        const heroTags = u.tags.filter((t) => t.startsWith('hero_'));
        for (const t of heroTags) expect(t).toBe(hero);
      }
    }
  });
});

describe('E1-S4 抽取规则参数（§3.6.2~3.6.5；v2 引擎 E2/E3 落地，先固化配置）', () => {
  it('超时 30s 自动取第 1 张（§3.6.5 / §⑥.1）', () => {
    expect(UPGRADE_POOL_RULES.TIMEOUT_SECONDS).toBe(30);
    expect(UPGRADE_POOL_RULES.AUTO_PICK_INDEX).toBe(0);
  });

  it('未解锁武器类引导：已拥有该类 ×2 / 未拥有 ×1（§3.6.2，与 Demo「未解锁 ×2」差异已裁定）', () => {
    expect(UPGRADE_POOL_RULES.WEIGHT_OWNED_CLASS).toBe(2);
    expect(UPGRADE_POOL_RULES.WEIGHT_UNOWNED_CLASS).toBe(1);
    // 规则对象保证已拥有权重 > 未拥有（引导成型、不强行冷门）
    expect(UPGRADE_POOL_RULES.WEIGHT_OWNED_CLASS).toBeGreaterThan(UPGRADE_POOL_RULES.WEIGHT_UNOWNED_CLASS);
  });

  it('进化卡 ×5 + 防重复 ×0.5（§3.6.3/§3.6.4；M3-DESIGN-1 ×3→×5）', () => {
    expect(UPGRADE_POOL_RULES.WEIGHT_EVOLUTION).toBe(5);
    expect(UPGRADE_POOL_RULES.WEIGHT_LAST_PICK).toBe(0.5);
  });

  it('满级剔除支撑：每项 maxStack > 0；回退项 up_g_1 存在且可重复（Infinity，§3.6.4/§⑥.3）', () => {
    for (const u of UPGRADE_POOL) expect(u.maxStack).toBeGreaterThan(0);
    const fallback = byId(UPGRADE_POOL_RULES.FALLBACK_ID);
    expect(UPGRADE_POOL_RULES.FALLBACK_ID).toBe('up_g_1');
    expect(fallback.name).toBe('武器共鸣'); // M3-DESIGN-1 数值方向化（原「伤害强化 +15%」）
    expect(fallback.maxStack).toBe(Number.POSITIVE_INFINITY);
    expect(fallback.tags).toContain('global');
  });

  it('数据完整性：40 项内容 ID 唯一、均带描述与标签（供抽取/渲染，禁止空壳卡）', () => {
    const ids = new Set(UPGRADE_POOL.map((u) => u.id));
    expect(ids.size).toBe(40);
    for (const u of UPGRADE_POOL) {
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.desc.length).toBeGreaterThan(0);
      expect(u.tags.length).toBeGreaterThan(0);
    }
  });
});

describe('E1-S4 兼容性（既有 12 项 UPGRADES 基线不回归）', () => {
  it('4 项为 v2 池专属：UPGRADES 12 项均为数字 id，无字符串 id 映射冲突', () => {
    for (const u of UPGRADES) expect(typeof u.id).toBe('number');
    // v2 新增 id（up_g_7/up_g_9/key_scope/key_holy）不在旧池
    const oldIds = new Set(UPGRADES.map((u) => u.id));
    expect(oldIds.has('up_g_7' as unknown as number)).toBe(false);
    expect(oldIds.has('key_scope' as unknown as number)).toBe(false);
  });

  it('旧池 12 项保持 9/12 = 75%（机制 9 / 数值 3，E3-S3 基线不回归）', () => {
    expect(UPGRADES).toHaveLength(12);
    expect(UPGRADES.filter((u) => u.type === 'mechanic')).toHaveLength(9);
    expect(UPGRADES.filter((u) => u.type === 'numeric')).toHaveLength(3);
  });

  it('新旧池项数总和不变：UPGRADES 12 + UPGRADE_POOL 40，均独立完整', () => {
    expect(UPGRADES.length).toBe(12);
    expect(UPGRADE_POOL.length).toBe(40);
  });
});
