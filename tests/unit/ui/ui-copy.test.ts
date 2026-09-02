import { describe, it, expect } from 'vitest';
import {
  POWER_TAG_COPY,
  SEAT_COPY,
  playerCopy,
  mapGuardianText,
  heroBranchTitle,
  sanitizeEffectText,
  nightClockText,
  deathCauseText,
  meritBalanceText,
  defeatClosureText,
  DEFEAT_CLOSURES,
  NIGHT_TOTAL_SECONDS,
  EXCLUSIVE_WEAPON_PROFILE,
  CODEX_RETIRED_NOTE,
} from '@/config/ui-copy';
import { BOSSES } from '@/config/balance';

describe('NV-PLAYER-UI W-B1 ui-copy 术语映射', () => {
  it('powerTag 五词根玩家语言（world-bible §7 对齐）', () => {
    expect(POWER_TAG_COPY.MOON).toBe('月相誓约');
    expect(POWER_TAG_COPY.BLOOD).toBe('血契');
    expect(POWER_TAG_COPY.HALLOWED).toBe('圣辉');
    expect(POWER_TAG_COPY.SILVER).toBe('银誓');
    expect(POWER_TAG_COPY.BEAST).toBe('兽魂');
  });

  it('保底席位：P1~P5 → 保底·Ⅰ~Ⅴ + 玩家副语（无 P 编号外泄）', () => {
    expect(SEAT_COPY.P1.label).toBe('保底·Ⅰ');
    expect(SEAT_COPY.P5.label).toBe('保底·Ⅴ');
    expect(SEAT_COPY.P1.hint).toBe('本轮必现的质变');
    for (const seat of Object.values(SEAT_COPY)) {
      expect(seat.label).not.toMatch(/P\d/);
      expect(seat.hint.length).toBeGreaterThan(0);
    }
  });

  it('地图镇守者行：取 MAP_CONFIGS.boss → BOSSES 真名（禁止编造）', () => {
    expect(mapGuardianText('map_graveyard')).toBe(`镇守者·${BOSSES.boss_1.name}`);
    expect(mapGuardianText('map_cathedral')).toBe(`镇守者·${BOSSES.boss_2.name}`);
    expect(mapGuardianText('map_den')).toBe(`镇守者·${BOSSES.boss_3.name}`);
  });

  it('支线标题：br_<hero> → HEROES 真名「·」后段 + 支线', () => {
    expect(heroBranchTitle('edmund')).toBe('艾德蒙支线');
    expect(heroBranchTitle('cassandra')).toBe('卡珊德拉支线');
    expect(heroBranchTitle('violet')).toBe('薇奥莱支线');
    expect(heroBranchTitle('galvan')).toBe('加尔文支线');
  });

  it('数值链/开发参数描述化：保留玩家友好数字，删除 px/锚', () => {
    expect(sanitizeEffectText('磁力半径 140→280→420px')).toBe('磁力半径 范围随强化层层扩展');
    expect(sanitizeEffectText('弹速 420px/s，DPS 锚 12~14')).toBe('弹速 每秒 420，');
    expect(sanitizeEffectText('直线银弹，10 伤/0.8s（峰值 DPS 锚 12~14 / 有效 9~12）'))
      .toBe('直线银弹，每 0.8 秒 10 伤');
    // 玩家友好值保留
    expect(sanitizeEffectText('生命上限 +15')).toContain('+15');
  });

  it('玩家三问：夜钟 360s → 00:00~06:00 / 死因兜底 / 余辉行', () => {
    expect(NIGHT_TOTAL_SECONDS).toBe(360);
    expect(nightClockText(0).clock).toBe('00:00');
    expect(nightClockText(180).clock).toBe('03:00');
    expect(nightClockText(360).clock).toBe('06:00');
    expect(nightClockText(180).dawn).toBe('距黎明还差 3 分 0 秒');
    expect(nightClockText(360).dawn).toBe('黎明已至');
    expect(deathCauseText('血月尊者', 239)).toBe('致命一击来自「血月尊者」');
    expect(deathCauseText(null, 239)).toBe('守夜失败于第 4 分钟');
    expect(meritBalanceText(14, 366)).toBe('本局余辉 +14（累计 366）');
  });

  it('失败收尾与遥测标题：叙事句、无内部代号', () => {
    expect(DEFEAT_CLOSURES).toContain('黎明之前，灯先灭了。');
    expect(defeatClosureText(10)).toBe(DEFEAT_CLOSURES[10 % DEFEAT_CLOSURES.length]);
    expect(playerCopy('results.telemetryTitle')).toBe('守夜日志（详细记录）');
    expect(playerCopy('results.telemetryTitle')).not.toMatch(/B6|EG-9|offer|DPS/i);
  });

  it('静态短语出口：playerCopy 覆盖关键键；8 专武画像齐备且无 DPS 锚', () => {
    expect(playerCopy('levelup.header')).toBe('今夜的馈赠');
    expect(playerCopy('exclusive.fallbackNote')).toContain('化作你的技能');
    expect(playerCopy('keyCard.hint')).toContain('另一盏灯的共鸣钥');
    expect(Object.keys(EXCLUSIVE_WEAPON_PROFILE).length).toBe(8);
    for (const p of Object.values(EXCLUSIVE_WEAPON_PROFILE)) expect(p).not.toMatch(/DPS|px|锚/);
    expect(CODEX_RETIRED_NOTE).not.toMatch(/EG-|GT-|offer/i);
  });
});
