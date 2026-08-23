import { describe, it, expect } from 'vitest';
import {
  resultTitle,
  meritRewardText,
  codexLogRewardText,
  resultsMeritProgressText,
  resultsMeritProgressRatio,
  type GameOverPayload,
} from '@/ui/results-overlay';

describe('结算页奖励条（merit-ui-spec §7 / codex-ui-spec §6）', () => {
  it('守夜功绩条：本局获得点数 N（显示 +N；0 也显示 +0）', () => {
    expect(meritRewardText(32)).toBe('+32');
    expect(meritRewardText(0)).toBe('+0');
    expect(meritRewardText(28)).toBe('+28');
    // 负值/小数防御
    expect(meritRewardText(-5)).toBe('+0');
    expect(meritRewardText(12.9)).toBe('+12');
  });

  it('守夜日志条：本局新解锁条数 delta>0 → +N；无新增 →「守夜日志已更新」', () => {
    expect(codexLogRewardText(3)).toBe('+3');
    expect(codexLogRewardText(1)).toBe('+1');
    expect(codexLogRewardText(0)).toBe('守夜日志已更新');
    expect(codexLogRewardText(-1)).toBe('守夜日志已更新');
  });

  it('功绩条进度文案：距下个加成解锁还需 X 点；全部解锁 → 全部加成已解锁', () => {
    // 0 点：距「初始 +20 HP」还差 20
    expect(resultsMeritProgressText(0)).toBe('距「初始 +20 HP」还差 20 点');
    // 15 点：还差 5
    expect(resultsMeritProgressText(15)).toBe('距「初始 +20 HP」还差 5 点');
    // 20 点：距「初始伤害 +5%」还差 10
    expect(resultsMeritProgressText(20)).toBe('距「初始伤害 +5%」还差 10 点');
    // 30 点：两个 30 成本已解锁，距「初始磁力 +40px」还差 10
    expect(resultsMeritProgressText(30)).toBe('距「初始磁力 +40px」还差 10 点');
    // 120 点：全部解锁
    expect(resultsMeritProgressText(120)).toBe('全部加成已解锁');
  });

  it('功绩条进度填充比例：0..1（进度条 width 数据源）', () => {
    expect(resultsMeritProgressRatio(0)).toBe(0);
    expect(resultsMeritProgressRatio(10)).toBeCloseTo(0.5, 6);
    expect(resultsMeritProgressRatio(20)).toBe(0);
    expect(resultsMeritProgressRatio(35)).toBeCloseTo(0.5, 6);
    expect(resultsMeritProgressRatio(120)).toBe(1);
  });

  it('game:over payload 增补字段（结算奖励条数据源；缺省兼容旧调用方）', () => {
    const p: GameOverPayload = {
      stats: undefined as never, // 仅验字段面（运行期由 PlayScene 填充）
      sessionRestartCount: 2,
      meritEarned: 32,
      meritTotal: 152,
      codexUnlockedDelta: 4,
    };
    expect(p.meritEarned).toBe(32);
    expect(p.meritTotal).toBe(152);
    expect(p.codexUnlockedDelta).toBe(4);
    // 全缺省可选（旧调用方不传不崩）
    const legacy: GameOverPayload = { stats: undefined as never };
    expect(legacy.meritEarned).toBeUndefined();
  });

  it('结算标题（narratives-spec §8.1 / C-5）：胜利 = 封印稳固·守夜完成，失败 = 守夜失败。', () => {
    expect(resultTitle(true)).toBe('封印稳固·守夜完成');
    expect(resultTitle(false)).toBe('守夜失败。');
  });
});
