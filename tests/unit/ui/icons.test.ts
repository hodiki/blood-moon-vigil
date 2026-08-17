import { describe, it, expect } from 'vitest';
import {
  ICONS,
  ICON_COLORS,
  UPGRADE_ICON_KEYS,
  WEAPON_ICON_KEYS,
  renderIconSvg,
  iconKeyForUpgradeId,
  weaponIconKeyForId,
  type IconKey,
} from '@/ui/icons';
import { PALETTE, BOSS, GEM, UPGRADES } from '@/config/balance';

const ALL_KEYS: readonly IconKey[] = [...UPGRADE_ICON_KEYS, ...WEAPON_ICON_KEYS];

describe('icons 矢量图标数据完整性（TASK-33 / asset-spec §3 / art-bible §6）', () => {
  it('覆盖 15 项：升级卡 12 + 武器槽 3，key 无遗漏', () => {
    expect(UPGRADE_ICON_KEYS).toHaveLength(12);
    expect(WEAPON_ICON_KEYS).toHaveLength(3);
    expect(ALL_KEYS).toHaveLength(15);
    for (const key of ALL_KEYS) {
      const spec = ICONS[key]!;
      expect(spec.template.length).toBeGreaterThan(0);
    }
  });

  it('类型分型正确：升级 1-9 机制 / 10-12 数值；武器槽 3 项 weapon（asset-spec §3 表）', () => {
    for (let id = 1; id <= 9; id += 1) {
      expect(ICONS[iconKeyForUpgradeId(id)]!.kind).toBe('mechanic');
    }
    for (let id = 10; id <= 12; id += 1) {
      expect(ICONS[iconKeyForUpgradeId(id)]!.kind).toBe('numeric');
    }
    for (const key of WEAPON_ICON_KEYS) {
      expect(ICONS[key]!.kind).toBe('weapon');
    }
  });

  it('与 upgrade-pool/balance 一致：升级项 type 与图标 kind 一一对应', () => {
    for (const item of UPGRADES) {
      const kind = ICONS[iconKeyForUpgradeId(item.id)]!.kind;
      expect(kind).toBe(item.type === 'mechanic' ? 'mechanic' : 'numeric');
    }
  });

  it('key 映射：upgrade id 1-12 → upg-01..12；武器 id → weapon-01..03；越界抛错', () => {
    for (let id = 1; id <= 12; id += 1) {
      expect(iconKeyForUpgradeId(id)).toBe(`upg-${String(id).padStart(2, '0')}`);
    }
    expect(weaponIconKeyForId('missile')).toBe('weapon-01');
    expect(weaponIconKeyForId('orbit')).toBe('weapon-02');
    expect(weaponIconKeyForId('shockwave')).toBe('weapon-03');
    expect(() => iconKeyForUpgradeId(0)).toThrow();
    expect(() => iconKeyForUpgradeId(13)).toThrow();
  });

  it('SVG 模板合法：<svg 开头 / </svg> 结尾 / 含底色 rect 与 clipPath / 带 viewBox', () => {
    for (const key of ALL_KEYS) {
      const t = ICONS[key]!.template;
      expect(t.startsWith('<svg')).toBe(true);
      expect(t.endsWith('</svg>')).toBe(true);
      expect(t).toContain('<rect');
      expect(t).toContain('clipPath');
      expect(t).toMatch(/viewBox="0 0 \d+ \d+"/);
    }
  });

  it('token 统一来源纪律：模板零 #rrggbb 字面量，{{token}} 全部可解析、渲染无残留', () => {
    const tokenNames = new Set(Object.keys(ICON_COLORS));
    for (const key of ALL_KEYS) {
      const t = ICONS[key]!.template;
      // 禁止散落颜色字面量
      expect(t).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      // 每个占位符都是已知 token
      for (const m of t.matchAll(/\{\{(\w+)\}\}/g)) {
        expect(tokenNames.has(m[1]!)).toBe(true);
      }
      // 渲染结果无残留占位符 / 无坏值
      const rendered = renderIconSvg(key);
      expect(rendered).not.toContain('{{');
      expect(rendered).not.toContain('undefined');
      expect(rendered).not.toContain('NaN');
    }
  });

  it('ICON_COLORS 全量派生自 balance token（PALETTE / BOSS / GEM）', () => {
    expect(ICON_COLORS.base).toBe(PALETTE.base);
    expect(ICON_COLORS.baseLight).toBe(PALETTE.baseLight);
    expect(ICON_COLORS.accent).toBe(PALETTE.playerAccent);
    expect(ICON_COLORS.info).toBe(GEM.COLOR);
    expect(ICON_COLORS.gold).toBe(BOSS.COLOR_GOLD);
    expect(ICON_COLORS.paper).toBe(PALETTE.uiPaper);
    expect(ICON_COLORS.danger).toBe(PALETTE.danger);
    expect(ICON_COLORS.bloodMain).toBe(PALETTE.enemyBoss);
    expect(ICON_COLORS.bloodEnemy).toBe(PALETTE.enemyZombie);
  });

  it('clipPath id 按 key 唯一化：同页多图标共存不串扰', () => {
    const a = renderIconSvg('upg-01');
    const b = renderIconSvg('upg-02');
    expect(a).toContain('id="upg-01-clip_0"');
    expect(a).toContain('url(#upg-01-clip_0)');
    expect(b).toContain('id="upg-02-clip_0"');
    expect(b).toContain('url(#upg-02-clip_0)');
    expect(a).not.toContain('id="clip_0"');
    expect(b).not.toContain('url(#clip_0)');
  });

  it('底色分型：机制型/武器槽首色 rect = baseLight；数值型 = gold（asset-spec §3 一眼分型）', () => {
    expect(ICONS['upg-03']!.template).toContain('<rect fill="{{baseLight}}"');
    expect(ICONS['upg-10']!.template).toContain('<rect fill="{{gold}}"');
    expect(ICONS['weapon-01']!.template).toContain('<rect fill="{{baseLight}}"');
  });
});
