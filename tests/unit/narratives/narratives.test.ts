import { describe, it, expect, vi } from 'vitest';
import { EventEmitter, GameEvent } from '@/core/events';
import type {
  NarrativeText,
  NarrativeForm,
  NarrativeTrigger,
} from '@/narratives/narratives';
import {
  NARRATIVES,
  HERO_ARCHIVES,
  BOSS_ARCHIVES,
  EVENT_ARCHIVES,
  NP,
  entryByKey,
  entryForTrigger,
  defaultNarrativeDurationMs,
  specDurationSec,
  mobileSingleLineFits,
  mobileOverlongEntries,
  isSingleLineForm,
  designFontSizeForPhysical,
  mobileFontSizeMeetsPhysical,
  dialogueLineCount,
  textEntryCount,
  archiveCount,
  dialogueMaxLength,
  weaponPowerTag,
  evolutionPowerTag,
  evolutionTriggerForPowerTag,
  bossEnterTriggerFor,
  newWeaponTriggerForPowerTag,
  SHOW_OPEN_BANNER,
  prologueScreensForMap,
  splitPrologueLines,
} from '@/narratives/narratives';
import {
  NarrativeDispatcher,
  ONCE_TRIGGERS,
  TRIGGER_SELECTORS,
} from '@/narratives/narrative-dispatcher';
import { DEFAULT_NARRATIVE_BINDINGS } from '@/narratives/narrative-bindings';
import { resultTitle } from '@/ui/results-overlay';
import { EVOLUTIONS, type EvoId, type WeaponId } from '@/config/balance';
import type { NarrativeComponent } from '@/narratives/narrative-overlays';

/** 测试用假组件（记录调用；不碰 DOM） */
function makeFakeComponent(form: NarrativeForm): NarrativeComponent & { calls: { text: string; durationMs: number }[] } {
  const calls: { text: string; durationMs: number }[] = [];
  return {
    form,
    calls,
    show: (text, durationMs) => calls.push({ text, durationMs }),
    hide: () => undefined,
  };
}

function makeAllComponents(): Record<NarrativeForm, NarrativeComponent & { calls: { text: string; durationMs: number }[] }> {
  return {
    'top-banner': makeFakeComponent('top-banner'),
    'bottom-banner': makeFakeComponent('bottom-banner'),
    'side-toast': makeFakeComponent('side-toast'),
    'center-gold': makeFakeComponent('center-gold'),
    'result-title': makeFakeComponent('result-title'),
  };
}

const VALID_FORMS: NarrativeForm[] = ['top-banner', 'bottom-banner', 'side-toast', 'center-gold', 'result-title'];

describe('narratives 文本表（narratives-spec v1.0 §2~§9）', () => {
  it('文本条目合计 42 = 台词 30 + 序章 4 + 结算 2 + 事件 6；档案对象 8 = 角色 4 + Boss 4', () => {
    expect(textEntryCount()).toBe(42);
    expect(dialogueLineCount()).toBe(30);
    expect(archiveCount()).toBe(8);
    expect(HERO_ARCHIVES).toHaveLength(4);
    expect(BOSS_ARCHIVES).toHaveLength(4);
    expect(EVENT_ARCHIVES).toHaveLength(6);
  });

  it('表内 20 条：key 唯一、form/context 属合法枚举、时长为 spec §1.2 计算值', () => {
    const keys = new Set<string>();
    for (const e of NARRATIVES) {
      expect(keys.has(e.key)).toBe(false); // key 唯一（数据驱动键）
      keys.add(e.key);
      expect(VALID_FORMS).toContain(e.form);
      expect(['prologue', 'hero', 'boss', 'toast', 'evolution', 'result', 'event']).toContain(e.context);
      expect(e.mobile.maxLineChars).toBe(14);
      expect(e.mobile.fontSize).toBeGreaterThanOrEqual(16); // 局内台词 ≥16px 物理
      expect(e.durationSec).toBeGreaterThanOrEqual(0);
    }
    // 台词/点缀/进化条目（context toast/boss/evolution）= 14 条
    const inTable = NARRATIVES.filter((e) => e.context === 'toast' || e.context === 'boss' || e.context === 'evolution');
    expect(inTable).toHaveLength(14); // 5 toast + 4 boss enter + 5 evolution
  });

  it('台词 ≤20 字红线（spec §11：最长 15 字卡珊德拉入场）', () => {
    expect(dialogueMaxLength()).toBeLessThanOrEqual(20);
  });

  it('时长口径（spec §1.2）：side-toast max(×0.25,1)/上限3、bottom-banner max(×0.25,3)、进化固定 2.5、序章固定 3、结算常驻 0', () => {
    const entry = (key: string): NarrativeText => entryByKey(NARRATIVES, key)!;
    // side-toast（表权威时长；spec §6）
    expect(entry('n_toast_first_levelup').durationSec).toBe(1.8); // 7 字 ×0.25=1.75 → 1.8
    expect(entry('n_toast_weapon_silver').durationSec).toBe(1.3); // 5 字 ×0.25=1.25 → 1.3
    // 注：n_toast_codex 表值为 2.3s（spec §6「9 字」口径，含句读计字）；文案 8 字 ×0.25=2.0，
    // 以设计表权威时长为准（spec §1.2「§5 表为权威时长」）。
    expect(entry('n_toast_codex').durationSec).toBe(2.3);
    // 公式一致性：首升/新武器/精英按 specDurationSec 复算
    expect(entry('n_toast_first_levelup').durationSec).toBe(specDurationSec('月光在回应你。', 1.0));
    expect(entry('n_toast_weapon_silver').durationSec).toBe(specDurationSec('银器出鞘。', 1.0));
    expect(entry('n_toast_elite').durationSec).toBe(specDurationSec('有大家伙来了。', 1.0));
    // bottom-banner（Boss 登场 floor 3.0）
    expect(entry('n_boss_1_enter').durationSec).toBe(specDurationSec('凡人，你守不住这夜。', 3.0)); // 3.0
    expect(entry('n_boss_2_enter').durationSec).toBe(specDurationSec('圣血已污，你的祷言没有回音。', 3.0)); // 3.5
    // 进化固定 2.5
    for (const e of NARRATIVES.filter((x) => x.context === 'evolution')) expect(e.durationSec).toBe(2.5);
    // 序章固定 3
    for (const e of NARRATIVES.filter((x) => x.context === 'prologue')) expect(e.durationSec).toBe(3.0);
    // 结算常驻 0
    expect(entry('n_result_victory').durationSec).toBe(0);
    expect(entry('n_result_defeat').durationSec).toBe(0);
  });

  it('defaultNarrativeDurationMs：字数 ×0.25s + 1s 下限（§1.2 兜底）', () => {
    expect(defaultNarrativeDurationMs('月光在回应你')).toBe(1500); // 6 字 ×250
    expect(defaultNarrativeDurationMs('夜。')).toBe(1000); // 2 字 → 500 < 1s 下限
    expect(defaultNarrativeDurationMs('')).toBe(1000); // 空 → 下限
  });

  it('移动单行 ≤14 字（spec §11）：单行形式台词全部 ≤14；序章多行横幅折行不告警', () => {
    expect(mobileSingleLineFits('月光在回应你。')).toBe(true);
    expect(mobileSingleLineFits('一二三四五六七八九十十一十二')).toBe(true); // 恰 14 字
    expect(mobileSingleLineFits('一二三四五六七八九十十一十二十三')).toBe(false); // 15 字
    // 单行形式（toast/boss/evolution）全部 ≤14 字
    const singleLine = NARRATIVES.filter((e) => isSingleLineForm(e.form));
    expect(mobileOverlongEntries(singleLine)).toHaveLength(0);
    // 序章（top-banner 多行）/结算（result-title 常驻）超 14 字属设计折行，不告警
    const multiLine = NARRATIVES.filter((e) => !isSingleLineForm(e.form));
    expect(multiLine.length).toBeGreaterThan(0);
  });

  it('移动字号 ≥16px 物理：设计字号 = 16/scale 向上取整（spec §1.3 overlay-scale 校验）', () => {
    expect(designFontSizeForPhysical(16, 0.5)).toBe(32); // scale 0.5 → 设计 32px → 物理 16px
    expect(designFontSizeForPhysical(16, 0.4)).toBe(40);
    expect(designFontSizeForPhysical(16, 1)).toBe(16); // 无缩放
    for (const e of NARRATIVES) expect(mobileFontSizeMeetsPhysical(e, 0.5)).toBe(true);
  });

  it('结算标题（spec §8.1 / C-5 必改）：胜利 = 封印稳固·守夜完成，失败 = 守夜失败。', () => {
    expect(entryByKey(NARRATIVES, 'n_result_victory')?.text).toBe('封印稳固·守夜完成');
    expect(entryByKey(NARRATIVES, 'n_result_defeat')?.text).toBe('守夜失败。');
    expect(resultTitle(true)).toBe('封印稳固·守夜完成');
    expect(resultTitle(false)).toBe('守夜失败。');
  });

  it('薇奥莱濒死台词唯一 exception（spec §4.3 religious-word-exception）；其余无宗教实指', () => {
    const violet = HERO_ARCHIVES.find((h) => h.key === 'hero_violet')!;
    expect(violet.lines.dying).toBe('主……不，月亮不会怜悯。');
    expect(violet.exception).toBe('religious-word-exception');
    // 其余档案对象无 exception
    for (const h of HERO_ARCHIVES) {
      if (h.key !== 'hero_violet') expect(h.exception).toBeUndefined();
    }
    // 台词文本不出现宗教实指（「主」仅薇奥莱濒死一句；「神」全表禁用）
    const allTexts: string[] = [];
    for (const e of NARRATIVES) allTexts.push(e.text);
    for (const h of HERO_ARCHIVES) allTexts.push(h.background, h.lines.enter, h.lines.dying, h.lines.death);
    for (const b of BOSS_ARCHIVES) allTexts.push(b.background, b.enterLine, b.defeatLine);
    for (const t of allTexts) {
      if (t.includes('神')) expect(t).toBe(violet.lines.dying); // 不含「神」
      if (t.includes('主') && t !== violet.lines.dying) {
        // 仅允许「主教/主理」等非宗教实指词；本表内「主」仅薇奥莱濒死
        expect(t).toBe(violet.lines.dying);
      }
    }
  });

  it('专有名词走 NP 常量（spec §10 / world-bible §7；consistency-anchors A4）', () => {
    // 角色/Boss/事件名均来自 NP 常量（抽检）
    expect(HERO_ARCHIVES[0]!.name).toBe(NP.HERO_EDMUND);
    expect(HERO_ARCHIVES[1]!.name).toBe(NP.HERO_CASSANDRA);
    expect(HERO_ARCHIVES[2]!.name).toBe(NP.HERO_VIOLET);
    expect(HERO_ARCHIVES[3]!.name).toBe(NP.HERO_GALVAN);
    expect(BOSS_ARCHIVES[0]!.name).toBe(NP.BOSS_1);
    expect(BOSS_ARCHIVES[1]!.name).toBe(NP.BOSS_2);
    expect(BOSS_ARCHIVES[2]!.name).toBe(NP.BOSS_3);
    expect(BOSS_ARCHIVES[3]!.name).toBe(NP.BOSS_4);
    expect(EVENT_ARCHIVES[2]!.name).toBe(NP.ALARIC); // 血王·阿拉里克
    expect(BOSS_ARCHIVES[0]!.map).toBe(NP.MAP_GRAVEYARD);
    expect(BOSS_ARCHIVES[1]!.map).toBe(NP.MAP_CATHEDRAL);
    expect(BOSS_ARCHIVES[2]!.map).toBe(NP.MAP_DEN);
    // 阵营常量引用（角色档案 faction）
    for (const h of HERO_ARCHIVES) expect(h.faction).toBe(NP.FACTION_VIGIL);
    expect(BOSS_ARCHIVES[1]!.faction).toBe(NP.FACTION_COURT);
    expect(BOSS_ARCHIVES[3]!.faction).toBe(NP.FACTION_BLOODMOON);
  });

  it('进化播报按 powerTag 映射：7 超武命中 5 句，BLOOD/MOON 各 2 把（spec §7）', () => {
    const counts: Record<string, number> = {};
    for (const evo of EVOLUTIONS) {
      const tag = evolutionPowerTag(evo.evoId as EvoId)!;
      const trigger = evolutionTriggerForPowerTag(tag);
      expect(trigger).not.toBeNull();
      expect(trigger!.startsWith('evolution:')).toBe(true);
      counts[tag] = (counts[tag] ?? 0) + 1;
      // 每条进化播报句存在且为 center-gold 2.5s
      const entry = entryForTrigger(NARRATIVES, trigger!);
      expect(entry).toBeTruthy();
      expect(entry!.form).toBe('center-gold');
      expect(entry!.durationSec).toBe(2.5);
    }
    expect(counts.MOON).toBe(2);
    expect(counts.BLOOD).toBe(2);
    expect(counts.SILVER).toBe(1);
    expect(counts.HALLOWED).toBe(1);
    expect(counts.BEAST).toBe(1);
  });

  it('新武器 toast 仅 SILVER/HALLOWED（spec §6 C-2；BLOOD/BEAST/MOON 不弹）', () => {
    expect(newWeaponTriggerForPowerTag('SILVER')).toBe('new-weapon:silver');
    expect(newWeaponTriggerForPowerTag('HALLOWED')).toBe('new-weapon:hallowed');
    expect(newWeaponTriggerForPowerTag('BLOOD')).toBeNull();
    expect(newWeaponTriggerForPowerTag('BEAST')).toBeNull();
    expect(newWeaponTriggerForPowerTag('MOON')).toBeNull();
  });

  it('Boss 登场按 bossId 路由（spec §5/§6）', () => {
    expect(bossEnterTriggerFor('boss_1')).toBe('boss:spawned(boss_1)');
    expect(bossEnterTriggerFor('boss_2')).toBe('boss:spawned(boss_2)');
    expect(bossEnterTriggerFor('boss_3')).toBe('boss:spawned(boss_3)');
    expect(bossEnterTriggerFor('boss_4')).toBe('boss:spawned(boss_4)');
    expect(bossEnterTriggerFor('boss_99')).toBeNull();
  });

  it('武器 powerTag 查询（供 new-weapon toast 路由）', () => {
    expect(weaponPowerTag('wpn_a_2' as WeaponId)).toBe('SILVER');
    expect(weaponPowerTag('wpn_b_1' as WeaponId)).toBe('HALLOWED');
    expect(weaponPowerTag('wpn_a_1' as WeaponId)).toBe('MOON');
  });
});

describe('序章屏（narratives-spec §3：每屏 ≤3 句 / 通用 + 地图序章 / C-1 开关）', () => {
  it('show_open_banner 开关存在且默认开启（spec §12 C-1：两处保留按开关控制是否双弹）', () => {
    expect(SHOW_OPEN_BANNER).toBe(true);
  });

  it('序章屏序列 = 通用 1 屏 + 地图序章（按 mapId 选句 n_prologue_<mapId>）；每屏 ≤3 句', () => {
    // 通用序章 1 屏 + 地图序章（graveyard/cathedral/den 各 1 屏）
    expect(prologueScreensForMap('map_graveyard').map((e) => e.key)).toEqual([
      'n_prologue_common',
      'n_prologue_map_graveyard',
    ]);
    expect(prologueScreensForMap('map_cathedral').map((e) => e.key)).toEqual([
      'n_prologue_common',
      'n_prologue_map_cathedral',
    ]);
    expect(prologueScreensForMap('map_den').map((e) => e.key)).toEqual([
      'n_prologue_common',
      'n_prologue_map_den',
    ]);
    // 未知 mapId → 仅通用序章（表驱动静默跳过）
    expect(prologueScreensForMap('map_unknown').map((e) => e.key)).toEqual(['n_prologue_common']);
    // 每屏 ≤3 句（spec §3 P1-5 红线）
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den']) {
      for (const e of prologueScreensForMap(mapId)) {
        expect(splitPrologueLines(e.text).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('序章句按行拆分（spec §3 移动单行描述口径）：通用 3 行 ≤13 字 / 地图 2 行 ≤14 字', () => {
    // 通用序章：3 句 → 3 行（血月升起，/ 死者自墓中爬出。/ 今夜，守夜人独守月光。）
    expect(splitPrologueLines('血月升起，死者自墓中爬出。今夜，守夜人独守月光。')).toEqual([
      '血月升起，',
      '死者自墓中爬出。',
      '今夜，守夜人独守月光。',
    ]);
    // 月下墓地：2 句无逗号 → 2 行
    expect(splitPrologueLines('封印的石冢在月光下渗血。亡者认得这条路——它们要回家。')).toEqual([
      '封印的石冢在月光下渗血。',
      '亡者认得这条路——它们要回家。',
    ]);
    // 血教堂：第二句 18 字含逗号 → 折 2 行（与「第二句 18 字折行」一致）
    expect(splitPrologueLines('钟声早已停了。彩窗映着血月，圣坛上淌着不是圣水的东西。')).toEqual([
      '钟声早已停了。',
      '彩窗映着血月，',
      '圣坛上淌着不是圣水的东西。',
    ]);
    // 每行 ≤14 字（移动单行上限；狼穴各 ≤11）
    for (const line of splitPrologueLines('山脊上的狼嚎越过血月。它们嗅到了血的气味。')) {
      expect(line.length).toBeLessThanOrEqual(14);
    }
  });
});

describe('NarrativeDispatcher 触发分发器（spec §6/§7）', () => {
  it('map-open 按 payload.mapId 选当前地图序章句（TRIGGER_SELECTORS）', () => {
    expect(TRIGGER_SELECTORS['map-open']).toBeDefined();
    const comps = makeAllComponents();
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps });
    expect(d.show('map-open', { mapId: 'map_graveyard' })).toBe(true);
    expect(comps['top-banner'].calls).toEqual([{ text: '封印的石冢在月光下渗血。亡者认得这条路——它们要回家。', durationMs: 3000 }]);
    // 不同地图（once 语义下先 resetRunState 模拟新一局；选择器按 mapId 命中）
    d.resetRunState();
    expect(d.show('map-open', { mapId: 'map_den' })).toBe(true);
    expect(comps['top-banner'].calls[1]!.text).toBe('山脊上的狼嚎越过血月。它们嗅到了血的气味。');
  });

  it('once trigger 每局仅展示一次（map-open/first-level-up；resetRunState 恢复）', () => {
    expect(ONCE_TRIGGERS.has('map-open')).toBe(true);
    expect(ONCE_TRIGGERS.has('first-level-up')).toBe(true);
    const comps = makeAllComponents();
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps });
    expect(d.show('map-open', { mapId: 'map_graveyard' })).toBe(true);
    expect(d.show('map-open', { mapId: 'map_graveyard' })).toBe(false); // 本局第二次被抑制
    expect(comps['top-banner'].calls).toHaveLength(1);
    d.resetRunState(); // 新一局
    expect(d.show('map-open', { mapId: 'map_graveyard' })).toBe(true);
    expect(comps['top-banner'].calls).toHaveLength(2);
  });

  it('Boss 登场按 payload.bossId 路由到对应 bottom-banner 句', () => {
    const comps = makeAllComponents();
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps });
    expect(d.show('boss:spawned(boss_2)')).toBe(true);
    expect(comps['bottom-banner'].calls).toEqual([{ text: '圣血已污，你的祷言没有回音。', durationMs: 3500 }]);
  });

  it('进化播报按 trigger 路由 center-gold（2.5s）', () => {
    const comps = makeAllComponents();
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps });
    expect(d.show('evolution:moon')).toBe(true);
    expect(comps['center-gold'].calls).toEqual([{ text: '月光凝成猎手之形。', durationMs: 2500 }]);
  });

  it('无条目 trigger → no-op（返回 false，不抛错）', () => {
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: makeAllComponents() });
    expect(d.show('new-weapon:blood' as NarrativeTrigger)).toBe(false);
  });

  it('bind() 默认绑定按负载解析：new-weapon tag / evolution tag / bossId / 图鉴', () => {
    const comps = makeAllComponents();
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps });
    const emitter = new EventEmitter();
    const unbind = d.bind(emitter, DEFAULT_NARRATIVE_BINDINGS);
    // 新武器：SILVER → side-toast；超武 → evolution（null 防双发）
    emitter.emit(GameEvent.WeaponUnlocked, { weaponId: 'wpn_a_2' });
    expect(comps['side-toast'].calls).toEqual([{ text: '银器出鞘。', durationMs: 1300 }]);
    emitter.emit(GameEvent.WeaponUnlocked, { weaponId: 'wpn_a_5' }); // BLOOD → 不弹
    expect(comps['side-toast'].calls).toHaveLength(1);
    emitter.emit(GameEvent.WeaponUnlocked, { weaponId: 'evo_moonwrath' }); // 超武 → null
    expect(comps['side-toast'].calls).toHaveLength(1);
    // 进化：UpgradeChosen evo_moonwrath（MOON）→ center-gold
    emitter.emit(GameEvent.UpgradeChosen, { optionId: 'evo_moonwrath' });
    expect(comps['center-gold'].calls).toEqual([{ text: '月光凝成猎手之形。', durationMs: 2500 }]);
    // Boss 登场：boss_3 → bottom-banner
    emitter.emit(GameEvent.BossSpawned, { bossHp: 4200, bossId: 'boss_3' });
    expect(comps['bottom-banner'].calls).toEqual([{ text: '月光属于狼群。', durationMs: 3000 }]);
    // 精英 / 图鉴
    emitter.emit(GameEvent.TankSpawned, {});
    emitter.emit(GameEvent.CodexUpdated, {});
    expect(comps['side-toast'].calls.map((c) => c.text)).toEqual(['银器出鞘。', '有大家伙来了。', '守夜日志已更新。']);
    // 解绑后不再响应
    unbind();
    emitter.emit(GameEvent.LevelUp, { level: 2, xpNeeded: 100 });
    expect(comps['side-toast'].calls).toHaveLength(3);
  });

  it('移动端超长条目渲染前告警但不拦截（spec §1.3 兜底）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const comps = makeAllComponents();
    const overlong: NarrativeText = {
      key: 't_long',
      context: 'toast',
      text: '这一句超过十四个字会破坏移动端单行排版。',
      form: 'side-toast',
      durationSec: 2.0,
      trigger: 'first-level-up',
      mobile: { maxLineChars: 14, fontSize: 16 },
    };
    const d = new NarrativeDispatcher({ entries: [overlong], components: comps, isMobile: () => true });
    expect(d.show('first-level-up')).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(comps['side-toast'].calls).toHaveLength(1); // 仍渲染（CSS ellipsis 兜底）
    warn.mockRestore();
  });
});
