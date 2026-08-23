/**
 * narratives/narratives.ts —— 轻叙事文本表数据层（narrative-framework v1.1 / narratives-spec v1.0 终稿）
 *
 * 设计源头：`design/official-v1/narratives-spec.md`（M3-DESIGN-2 文本表终稿）
 * - 42 条文本条目（台词 30 / 序章 4 / 结算标题 2 / 事件档案 6）+ 8 档案对象（角色 4 / Boss 4）。
 * - 数据驱动纪律：全部文案进本表（`NARRATIVES`）+ 档案常量（`HERO_ARCHIVES` / `BOSS_ARCHIVES` /
 *   `EVENT_ARCHIVES`），工程读取渲染，**禁止在组件/分发器内硬编码文案**（spec §1.1）。
 * - 专有名词拼写表（spec §10 / world-bible §7 对齐）导出 `NP` 常量，UI/图鉴/结算统一引用，
 *   禁止手写变体（consistency-anchors A4）。
 * - 时长口径（spec §1.2）：`max(字数×0.25, 下限)` 四舍五入至 0.1s；序章/开局固定 3s；
 *   Boss 登场 `max(×0.25, 3.0)s`；侧边浮字 `max(×0.25, 1.0)s` 上限 3s；进化播报固定 2.5s；
 *   结算标题常驻 0。
 * - 双端约束（spec §1.3/§11）：移动单行 ≤14 字（折行兜底）；移动字号 ≥16px 物理——
 *   设计字号 = `16/scale` 向上取整（`designFontSizeForPhysical`），overlay 经 overlay-scale 注入
 *   `--bmv-overlay-scale` 后在 CSS 侧保证（narrative-overlays.ts）。
 *
 * 本模块为纯数据层（无 DOM、无 Phaser），可脱离环境单测（test-framework §1.2）。
 */

import { EVOLUTIONS, WEAPON_CONFIGS, type EvoId, type WeaponId } from '@/config/balance';

export type PowerTag = 'HALLOWED' | 'SILVER' | 'BLOOD' | 'BEAST' | 'MOON';

/** 渲染形式（spec §1.4 五形态；横幅含 top/bottom 位置变体，不新增形式类） */
export type NarrativeForm = 'top-banner' | 'bottom-banner' | 'side-toast' | 'center-gold' | 'result-title';

/** 内容语境（spec §2 NarrativeContext） */
export type NarrativeContext = 'prologue' | 'hero' | 'boss' | 'toast' | 'evolution' | 'result' | 'event';

/**
 * 触发场景（spec §2 trigger 列；分发器按 trigger 路由事件）。
 * - 同 trigger 多条 = 随机取一（`map-open` 除外：按 payload.mapId 选择当前地图序章句）。
 * - `boss:spawned(boss_X)` / `evolution:<tag>` / `new-weapon:<tag>` 为携带细分条件的触发键。
 */
export type NarrativeTrigger =
  /** 开局横幅（地图序章句；spec §3 开局 5s） */
  | 'map-open'
  /** 首次升级完成（side-toast，每局 1 次） */
  | 'first-level-up'
  /** 新武器解锁 · SILVER 系（spec §6 C-2 仅 SILVER/HALLOWED 两句） */
  | 'new-weapon:silver'
  /** 新武器解锁 · HALLOWED 系 */
  | 'new-weapon:hallowed'
  /** 精英敌人生成进屏（side-toast） */
  | 'elite-spawn'
  /** Boss 登场（bottom-banner，按 Boss id 细分） */
  | 'boss:spawned(boss_1)'
  | 'boss:spawned(boss_2)'
  | 'boss:spawned(boss_3)'
  | 'boss:spawned(boss_4)'
  /** 图鉴新条目（side-toast；同帧合并 1 条） */
  | 'codex-updated'
  /** 进化播报（center-gold，按主武器 powerTag 分句） */
  | 'evolution:hallowed'
  | 'evolution:silver'
  | 'evolution:blood'
  | 'evolution:beast'
  | 'evolution:moon';

/** 移动端约束（spec §2 mobile：单行上限 / 物理字号目标 px） */
export interface NarrativeMobile {
  /** 移动单行上限（spec §11：≤14 字；超则折行） */
  maxLineChars: number;
  /** 物理字号目标 px（spec §1.3：局内 ≥16px 物理） */
  fontSize: number;
}

/** 文本表条目（spec §2 NarrativeText） */
export interface NarrativeText {
  /** 内容 ID（工程引用键；禁止以文案字符串作 key） */
  key: string;
  /** 内容语境 */
  context: NarrativeContext;
  /** 文案（集中此表，不硬编码） */
  text: string;
  /** 渲染形式 */
  form: NarrativeForm;
  /** 展示时长 s（spec §1.2 计算值；0 = 常驻随结算页） */
  durationSec: number;
  /** 触发条件（spec §2：事件名/条件表达式，供事件系统匹配） */
  trigger: string;
  /** 移动端约束 */
  mobile: NarrativeMobile;
  /** 例外标注（仅薇奥莱濒死台词 religious-word-exception） */
  exception?: string;
}

/** 角色档案（spec §2 HeroArchiveText / §4；供图鉴/选人界面） */
export interface HeroArchiveText {
  key: string; // hero_<id>
  name: string;
  enName: string;
  faction: string;
  powerTag: PowerTag;
  identity: string; // 一句话
  background: string; // ≤80 字（加尔文 85 见 spec §4.4 注，待批）
  activeSkill: { name: string; desc: string };
  initialWeapon: { name: string; desc: string };
  lines: { enter: string; dying: string; death: string }; // ≤20 字/条
  unlock: string;
  exception?: string; // 薇奥莱 dying 例外
}

/** Boss 档案（spec §2 BossArchiveText / §5） */
export interface BossArchiveText {
  key: string; // boss_<id>
  name: string;
  faction: string;
  powerTag: PowerTag;
  identity: string;
  background: string; // ≤100 字
  enterLine: string; // ≤20 字
  defeatLine: string; // ≤20 字
  map: string;
  drop: string;
  hidden?: boolean; // boss_4 血月化身
}

/** 事件档案（spec §2 EventArchiveText / §8.2；供图鉴事件页） */
export interface EventArchiveText {
  key: string;
  name: string;
  text: string; // ≤100 字
  unlock: string;
}

/**
 * 专有名词拼写表（spec §10 / world-bible §7 对齐）。
 * UI/图鉴/结算统一引用本常量，禁止手写变体（consistency-anchors A4）。
 */
export const NP = {
  // 力量（五标签）
  HALLOWED: '圣辉',
  SILVER: '银器',
  BEAST: '兽血',
  BLOOD: '血术',
  MOON: '月光',
  // 阵营
  FACTION_VIGIL: '守夜会',
  FACTION_COURT: '血族·血廷',
  FACTION_PACK: '兽群',
  FACTION_UNDEAD: '亡者',
  FACTION_BLOODMOON: '血月',
  // 地图
  MAP_GRAVEYARD: '月下墓地',
  MAP_CATHEDRAL: '血教堂',
  MAP_DEN: '狼穴',
  // 角色
  HERO_EDMUND: '守夜人·艾德蒙',
  HERO_CASSANDRA: '血猎手·卡珊德拉',
  HERO_VIOLET: '夜祷修女·薇奥莱',
  HERO_GALVAN: '狼裔·加尔文',
  // Boss
  BOSS_1: '血月尊者',
  BOSS_2: '血主教·尼禄',
  BOSS_3: '狼王·芬里厄',
  BOSS_4: '血月化身',
  // 反派
  ALARIC: '血王·阿拉里克',
} as const;

const MOBILE = { maxLineChars: 14, fontSize: 16 } as const;

/**
 * 开局横幅开关（narratives-spec §12 C-1 决策）：序章屏与开局横幅同文案（地图序章句展示 2 次）。
 * 两处保留，由本开关控制是否双弹；真机若感重复则置 false 关闭开局横幅（防叠字/认知过载）。
 * PlayScene 在序章完成后按本开关决定是否 `show('map-open')`（进入战斗 5s 内顶部渐隐）。
 */
export const SHOW_OPEN_BANNER = true;

/**
 * 文本表 20 条（spec §9：台词 14 条表内 + 序章 4 + 结算 2；档案台词 16 条另计，
 * 文本条目合计 = 表内 20 + 角色台词 12 + Boss 击败 4 + 事件 6 = 42）。
 * durationSec 为 spec §1.2 权威值（与 spec 表逐条对齐）。
 */
export const NARRATIVES: readonly NarrativeText[] = [
  // —— 序章 4（spec §3；top-banner 固定 3s；可点击跳过）——
  {
    key: 'n_prologue_common',
    context: 'prologue',
    text: '血月升起，死者自墓中爬出。今夜，守夜人独守月光。',
    form: 'top-banner',
    durationSec: 3.0,
    trigger: 'menu:start', // 点击「开始」后进入战斗前（序章屏；本批不渲染，数据完整）
    mobile: MOBILE,
  },
  {
    key: 'n_prologue_map_graveyard',
    context: 'prologue',
    text: '封印的石冢在月光下渗血。亡者认得这条路——它们要回家。',
    form: 'top-banner',
    durationSec: 3.0,
    trigger: 'map-open', // 开局横幅：进入战斗后 5s 内顶部渐隐（与序章屏同文案）
    mobile: MOBILE,
  },
  {
    key: 'n_prologue_map_cathedral',
    context: 'prologue',
    text: '钟声早已停了。彩窗映着血月，圣坛上淌着不是圣水的东西。',
    form: 'top-banner',
    durationSec: 3.0,
    trigger: 'map-open',
    mobile: MOBILE,
  },
  {
    key: 'n_prologue_map_den',
    context: 'prologue',
    text: '山脊上的狼嚎越过血月。它们嗅到了血的气味。',
    form: 'top-banner',
    durationSec: 3.0,
    trigger: 'map-open',
    mobile: MOBILE,
  },

  // —— 局内点缀 5（spec §6；side-toast `max(×0.25, 1.0)s` 上限 3s）——
  {
    key: 'n_toast_first_levelup',
    context: 'toast',
    text: '月光在回应你。',
    form: 'side-toast',
    durationSec: 1.8,
    trigger: 'first-level-up',
    mobile: MOBILE,
  },
  {
    key: 'n_toast_weapon_silver',
    context: 'toast',
    text: '银器出鞘。',
    form: 'side-toast',
    durationSec: 1.3,
    trigger: 'new-weapon:silver',
    mobile: MOBILE,
  },
  {
    key: 'n_toast_weapon_hallowed',
    context: 'toast',
    text: '圣辉凝聚。',
    form: 'side-toast',
    durationSec: 1.3,
    trigger: 'new-weapon:hallowed',
    mobile: MOBILE,
  },
  {
    key: 'n_toast_elite',
    context: 'toast',
    text: '有大家伙来了。',
    form: 'side-toast',
    durationSec: 1.8,
    trigger: 'elite-spawn',
    mobile: MOBILE,
  },
  {
    key: 'n_toast_codex',
    context: 'toast',
    text: '守夜日志已更新。',
    form: 'side-toast',
    durationSec: 2.3,
    trigger: 'codex-updated',
    mobile: MOBILE,
  },

  // —— Boss 登场 4（spec §5/§6；bottom-banner `max(×0.25, 3.0)s`）——
  {
    key: 'n_boss_1_enter',
    context: 'boss',
    text: '凡人，你守不住这夜。',
    form: 'bottom-banner',
    durationSec: 3.0, // max(10×0.25, 3)
    trigger: 'boss:spawned(boss_1)',
    mobile: MOBILE,
  },
  {
    key: 'n_boss_2_enter',
    context: 'boss',
    text: '圣血已污，你的祷言没有回音。',
    form: 'bottom-banner',
    durationSec: 3.5, // max(14×0.25, 3)
    trigger: 'boss:spawned(boss_2)',
    mobile: MOBILE,
  },
  {
    key: 'n_boss_3_enter',
    context: 'boss',
    text: '月光属于狼群。',
    form: 'bottom-banner',
    durationSec: 3.0, // max(7×0.25, 3)
    trigger: 'boss:spawned(boss_3)',
    mobile: MOBILE,
  },
  {
    key: 'n_boss_4_enter',
    context: 'boss',
    text: '我就是那轮月亮。',
    form: 'bottom-banner',
    durationSec: 3.0, // max(8×0.25, 3)
    trigger: 'boss:spawned(boss_4)',
    mobile: MOBILE,
  },

  // —— 进化播报 5（spec §7；center-gold 固定 2.5s；按 powerTag 分句）——
  {
    key: 'n_evo_hallowed',
    context: 'evolution',
    text: '圣辉燃尽暗影。',
    form: 'center-gold',
    durationSec: 2.5,
    trigger: 'evolution:hallowed',
    mobile: MOBILE,
  },
  {
    key: 'n_evo_silver',
    context: 'evolution',
    text: '银器淬火。',
    form: 'center-gold',
    durationSec: 2.5,
    trigger: 'evolution:silver',
    mobile: MOBILE,
  },
  {
    key: 'n_evo_blood',
    context: 'evolution',
    text: '血池为你沸腾。',
    form: 'center-gold',
    durationSec: 2.5,
    trigger: 'evolution:blood',
    mobile: MOBILE,
  },
  {
    key: 'n_evo_beast',
    context: 'evolution',
    text: '兽血在骨中低吼。',
    form: 'center-gold',
    durationSec: 2.5,
    trigger: 'evolution:beast',
    mobile: MOBILE,
  },
  {
    key: 'n_evo_moon',
    context: 'evolution',
    text: '月光凝成猎手之形。',
    form: 'center-gold',
    durationSec: 2.5,
    trigger: 'evolution:moon',
    mobile: MOBILE,
  },

  // —— 结算标题 2（spec §8.1；result-title 常驻 0；results-overlay 按 key 读取）——
  {
    key: 'n_result_victory',
    context: 'result',
    text: '封印稳固·守夜完成',
    form: 'result-title',
    durationSec: 0, // 常驻（随结算页，直到玩家操作）
    trigger: 'game:over victory=true',
    mobile: MOBILE,
  },
  {
    key: 'n_result_defeat',
    context: 'result',
    text: '守夜失败。',
    form: 'result-title',
    durationSec: 0,
    trigger: 'game:over victory=false',
    mobile: MOBILE,
  },
] as const;

/** 角色档案 4（spec §4；文本与 spec 表逐字对齐；专有名词引用 NP 常量） */
export const HERO_ARCHIVES: readonly HeroArchiveText[] = [
  {
    key: 'hero_edmund',
    name: NP.HERO_EDMUND,
    enName: 'Edmund the Vigilant',
    faction: NP.FACTION_VIGIL,
    powerTag: 'HALLOWED',
    identity: '守夜会末代提灯人',
    background: '初代守夜人的血脉传到今日只剩他一人——提灯认血，只有他能重新点亮祖传之灯。他提着它走回千年封印之地，灯里是初代守夜人留下的最后一点圣辉。',
    activeSkill: { name: '提灯闪耀', desc: '爆发圣光，眩晕周围亡者片刻，给自己一瞬喘息。' },
    initialWeapon: { name: '血月猎手', desc: '银制月光箭。' },
    lines: { enter: '灯还亮着，夜就还没输。', dying: '灯芯……快尽了。', death: '替我……守到天亮。' },
    unlock: '默认',
  },
  {
    key: 'hero_cassandra',
    name: NP.HERO_CASSANDRA,
    enName: 'Cassandra',
    faction: NP.FACTION_VIGIL,
    powerTag: 'SILVER',
    identity: '猎杀血族的银器赏金猎人，半血裔',
    background: '她以自愿饮下的血族之血完成自我改造，换取不被血月支配的体质——代价是永远介于人与猎物之间。半血裔对银器灼烧免疫，银弩是她对血廷的投名状，银是她的驯服之刃。',
    activeSkill: { name: '血影突袭', desc: '向移动方向冲刺，路径上敌人被银刃割伤并标记，标记目标受武器伤害额外加成。' },
    initialWeapon: { name: '银针连弩', desc: '快速穿透银矢。' },
    lines: { enter: '猎物和猎人，今夜只有一个能走。', dying: '我的血……也在沸腾。', death: '血债……清了。' },
    unlock: '通关地图 1（月下墓地）',
  },
  {
    key: 'hero_violet',
    name: NP.HERO_VIOLET,
    enName: 'Violet',
    faction: NP.FACTION_VIGIL,
    powerTag: 'HALLOWED',
    identity: '血教堂幸存的执烛修女，以圣诗驱魔的夜祷者',
    background: '教堂沦陷那夜，她唱完了最后一首安魂曲，从血井边爬出来。从此她不再为死者安魂——她为亡者送行。',
    activeSkill: { name: '安魂曲', desc: '圣诗震荡周围空间，亡者行动迟缓，她自身的伤缓缓愈合。' },
    initialWeapon: { name: '圣银火铳', desc: '近距圣银散射。' },
    lines: { enter: '尘归尘，血归血。', dying: '主……不，月亮不会怜悯。', death: '让安魂曲……替我唱完。' },
    unlock: '通关地图 2（血教堂）',
    exception: 'religious-word-exception', // spec §4.3：全游戏唯一宗教实指例外（刻意改口修辞）
  },
  {
    key: 'hero_galvan',
    name: NP.HERO_GALVAN,
    enName: 'Galvan',
    faction: NP.FACTION_VIGIL,
    powerTag: 'BEAST',
    identity: '狼群中的异类，兽血诅咒的持有者',
    background: '血月之夜他出生在狼穴，被狼群养大，曾是狼王麾下的前锋。盈满之夜，狼王要踏平北境——他选择了背叛。他能在人形与狂化间切换：狼群视他为叛徒，人类视他为怪物，他只为黎明而战。',
    activeSkill: { name: '血月狂化', desc: '短暂进入狂化：移速与伤害飙升，爪牙撕咬接触的敌人并汲取生命。' },
    initialWeapon: { name: '狼影猎犬', desc: '召唤兽影猎犬自动索敌。' },
    lines: { enter: '月光是我的血，也是我的枷锁。', dying: '狼群……咬得更紧些。', death: '我终究……不是人。' },
    unlock: '通关地图 3（狼穴）',
  },
];

/** Boss 档案 4（spec §5；boss_4 血月化身 = 隐藏条目 hidden） */
export const BOSS_ARCHIVES: readonly BossArchiveText[] = [
  {
    key: 'boss_1',
    name: NP.BOSS_1,
    faction: NP.FACTION_UNDEAD,
    powerTag: 'MOON',
    identity: '守夜会初代成员的尸骸，被血月复活，守着封印石冢',
    background: '千年前封印血王的十二人之一，战死后葬在石冢旁。血月把他从土里拉起，扭曲了他的守护本能：他守着石冢，不准任何人靠近封印——包括来加固封印的守夜人。他忘了自己守护过什么，只记得"守住这里"。',
    enterLine: '凡人，你守不住这夜。',
    defeatLine: '……灯，交给你了。',
    map: NP.MAP_GRAVEYARD,
    drop: 'XP 100',
  },
  {
    key: 'boss_2',
    name: NP.BOSS_2,
    faction: NP.FACTION_COURT,
    powerTag: 'BLOOD',
    identity: '叛变的教堂主教，血廷在人间的代行者',
    background: '为求永生，尼禄打开地下血井，以整座教堂的信众献祭。如今他站在井口，等着把最后一位闯入者也献进井里。',
    enterLine: '圣血已污，你的祷言没有回音。',
    defeatLine: '井……会记得每一个名字。',
    map: NP.MAP_CATHEDRAL,
    drop: 'XP 120',
  },
  {
    key: 'boss_3',
    name: NP.BOSS_3,
    faction: NP.FACTION_PACK,
    powerTag: 'BEAST',
    identity: '兽群之王，血月兽血之力的顶点（「化身」一词专留给血月化身）',
    background: '他统一狼穴诸部，只等血月盈满之夜踏平北境。狼穴祭坛上的爪痕，是他与血月的契约。',
    enterLine: '月光属于狼群。',
    defeatLine: '黎明……不属于兽。',
    map: NP.MAP_DEN,
    drop: 'XP 120',
  },
  {
    key: 'boss_4',
    name: NP.BOSS_4,
    faction: NP.FACTION_BLOODMOON,
    powerTag: 'MOON',
    identity: '血月意志降临的实体——月光凝成的人形',
    background: '血月盈满至极时，月光会"落下来"行走片刻。它不守护任何封印，只是来看一眼"这个还在挣扎的世界"。',
    enterLine: '我就是那轮月亮。',
    defeatLine: '……下一个满月，再见。',
    map: '任意',
    drop: '不掉通关进度；图鉴隐藏条目 + 稀有宝箱（chest）',
    hidden: true,
  },
];

/** 事件档案 6（spec §8.2；world-bible 精简版，供图鉴事件页） */
export const EVENT_ARCHIVES: readonly EventArchiveText[] = [
  {
    key: 'n_event_bloodmoon_origin',
    name: '血月起源',
    text: '千年前，血族之王阿拉里克屠尽北境三城，以万千亡魂的血浇灌永夜。十二位守夜人以十二盏圣辉提灯为锁，将他封入地脉之下。血王临死前诅咒月面——月光从此成为诅咒的通道。',
    unlock: '首通地图 1',
  },
  {
    key: 'n_event_vigil',
    name: '守夜会',
    text: '人类守卫者：提灯守夜人、银器猎手、夜祷修女，以圣辉与银器对抗亡潮。圣辉是有限资源——每次守夜都在消耗封印的余力，这是封印渗血、守夜会衰微的根因。',
    unlock: '首通地图 1',
  },
  {
    key: 'n_event_alaric',
    name: NP.ALARIC,
    text: '血族之王，被十二守夜人封印千年的存在。他的诅咒常驻月面，随月相起伏——唯有血月盈满之夜，封印最弱、亡潮最盛。',
    unlock: '首通地图 2',
  },
  {
    key: 'n_event_bloodcourt',
    name: '血廷',
    text: '有组织的血族黑暗势力：血族贵族、血主教、圣杯侍僧、血信徒，以血术操纵亡者与人类。血教堂地下血井是血术的源头。',
    unlock: '首通地图 2',
  },
  {
    key: 'n_event_pack',
    name: '兽群',
    text: '被血月兽血之力支配的狼群诸部，由狼王芬里厄统御。兽群袭击一切活物，只等血月盈满之夜踏平北境。',
    unlock: '首通地图 3',
  },
  {
    key: 'n_event_moonavatar',
    name: '血月化身',
    text: '血月意志降临的实体——月光凝成的人形。它不守护任何封印，只是来看一眼"这个还在挣扎的世界"。',
    unlock: '任意地图击杀血月化身',
  },
];

// —— 查询助手 ——

/** 按 key 查文本条目（缺省 null；结算/图鉴等按 key 引用，不依赖 trigger） */
export function entryByKey(entries: readonly NarrativeText[], key: string): NarrativeText | null {
  return entries.find((e) => e.key === key) ?? null;
}

/** 按 trigger 查文本条目（同 trigger 多条取第一条；无匹配 → null） */
export function entryForTrigger(entries: readonly NarrativeText[], trigger: string): NarrativeText | null {
  const found = entries.filter((e) => e.trigger === trigger);
  return found.length > 0 ? found[0]! : null;
}

/** 同 trigger 多条时随机取一（随机源注入可测；无匹配 → null） */
export function randomEntryForTrigger(
  entries: readonly NarrativeText[],
  trigger: string,
  random: () => number = Math.random,
): NarrativeText | null {
  const found = entries.filter((e) => e.trigger === trigger);
  if (found.length === 0) return null;
  return found[Math.min(found.length - 1, Math.floor(random() * found.length))]!;
}

// —— 序章屏（spec §3：每屏 ≤3 句；点击开始后进入战斗前展示）——

/**
 * 序章句按行拆分（spec §3 移动单行描述口径）。
 * 规则：先按 。分句（保留句号）；句内按 ，再拆 —— 前置分句（逗号前内容）≥3 字时独立成行，
 * 短时间状语（如「今夜，」2 字）保留与后句同行。复现 spec §3 逐条标注：
 * - 通用序章 → 3 行（血月升起，/ 死者自墓中爬出。/ 今夜，守夜人独守月光。，每行 ≤13 ✔）
 * - 月下墓地 → 2 行（无逗号）；狼穴 → 2 行（各 ≤11 ✔）
 * - 血教堂 → 3 行（「第二句 18 字折行」= 彩窗映着血月，/ 圣坛上淌着不是圣水的东西。）
 */
export function splitPrologueLines(text: string): string[] {
  const lines: string[] = [];
  const sentences = text
    .split(/(?<=。)/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const sentence of sentences) {
    const clauses = sentence
      .split(/(?<=，)/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (clauses.length <= 1) {
      lines.push(sentence);
      continue;
    }
    const firstContent = clauses[0]!.replace(/[，。]/g, '');
    if (firstContent.length >= 3) {
      lines.push(...clauses);
    } else {
      // 短前置状语（如「今夜，」）与后句合并为一行（语义单元）
      lines.push(clauses.join(''));
    }
  }
  return lines;
}

/**
 * 序章屏序列（spec §3）：通用序章 1 屏 + 地图序章（按 mapId 选句）。
 * mapId 映射 key `n_prologue_<mapId>`（与 TRIGGER_SELECTORS map-open 同 key 规则）。
 * 缺条目时静默跳过（表驱动；返回空数组 = 调用方直接进入战斗）。
 */
export function prologueScreensForMap(mapId: string): NarrativeText[] {
  const screens: NarrativeText[] = [];
  const common = entryByKey(NARRATIVES, 'n_prologue_common');
  if (common) screens.push(common);
  const mapEntry = entryByKey(NARRATIVES, `n_prologue_${mapId}`);
  if (mapEntry) screens.push(mapEntry);
  return screens;
}

// —— 时长口径（spec §1.2）——

/**
 * 台词时长公式：`max(字数 × 0.25, 下限)` 四舍五入至 0.1s。
 * floorSec：侧边浮字/一般台词 1.0s；Boss 登场 3.0s；进化播报/序章/结算走固定值（不套本公式）。
 */
export function specDurationSec(text: string, floorSec = 1.0): number {
  const raw = Math.max(text.length * 0.25, floorSec);
  return Math.round(raw * 10) / 10;
}

/** 台词默认时长 ms（§1.2 兜底；§3~§8 表内条目以 durationSec 为权威） */
export function defaultNarrativeDurationMs(text: string): number {
  return Math.round(specDurationSec(text, 1.0) * 1000);
}

// —— 移动端适配（spec §1.3/§11）——

/** 移动单行适配检查（单行 ≤ maxLineChars；超则折行） */
export function mobileSingleLineFits(text: string, maxLineChars = 14): boolean {
  return text.length <= maxLineChars;
}

/**
 * 单行渲染形式（移动端强制单行 ≤14 字）：side-toast / bottom-banner / center-gold。
 * top-banner（序章/开局）为多行横幅（spec §3 每屏 ≤3 句、逐行 ≤14 折行）、
 * result-title（结算）常驻大字——两者超长折行属设计行为，不做单行告警。
 */
export function isSingleLineForm(form: NarrativeForm): boolean {
  return form === 'side-toast' || form === 'bottom-banner' || form === 'center-gold';
}

/** 开发期校验：返回违反移动单行上限的条目（长度 > maxLineChars）——供 dev 告警，不做运行时拦截 */
export function mobileOverlongEntries(entries: readonly NarrativeText[]): NarrativeText[] {
  return entries.filter((e) => !mobileSingleLineFits(e.text, e.mobile.maxLineChars));
}

/**
 * 设计字号 = 物理目标字号 / scale（spec §1.3：设计字号 × scale ≥ 16，scale < 1 时 16/scale 向上取整）。
 * overlay 经 overlay-scale 注入 `--bmv-overlay-scale` 后由 CSS 侧消费（narrative-overlays.ts）。
 */
export function designFontSizeForPhysical(physicalPx: number, scale: number): number {
  if (scale <= 0 || scale >= 1) return physicalPx;
  return Math.ceil(physicalPx / scale);
}

/** 校验：给定 scale 下设计字号是否满足物理字号红线（设计字号 × scale ≥ physicalPx） */
export function mobileFontSizeMeetsPhysical(entry: NarrativeText, scale: number): boolean {
  const designPx = designFontSizeForPhysical(entry.mobile.fontSize, scale);
  return designPx * scale >= entry.mobile.fontSize;
}

// —— 触发映射（spec §6/§7）——

/** 武器 powerTag（供 new-weapon:silver/hallowed 触发路由） */
export function weaponPowerTag(wid: WeaponId): PowerTag | null {
  return WEAPON_CONFIGS[wid]?.powerTag ?? null;
}

/** 超武 → 主武器 powerTag（spec §7：powerTag 取主武器，content-design-outline §3.4 合成表） */
export function evolutionPowerTag(evoId: EvoId): PowerTag | null {
  const evo = EVOLUTIONS.find((e) => e.evoId === evoId);
  if (!evo) return null;
  return WEAPON_CONFIGS[evo.wpnId]?.powerTag ?? null;
}

/** powerTag → 进化播报触发键（spec §7 5 句；BLOOD/MOON 各命中 2 把超武） */
export function evolutionTriggerForPowerTag(tag: PowerTag | null): NarrativeTrigger | null {
  switch (tag) {
    case 'HALLOWED':
      return 'evolution:hallowed';
    case 'SILVER':
      return 'evolution:silver';
    case 'BLOOD':
      return 'evolution:blood';
    case 'BEAST':
      return 'evolution:beast';
    case 'MOON':
      return 'evolution:moon';
    default:
      return null;
  }
}

/** Boss id → 登场触发键（spec §5/§6） */
export function bossEnterTriggerFor(bossId: string): NarrativeTrigger | null {
  switch (bossId) {
    case 'boss_1':
      return 'boss:spawned(boss_1)';
    case 'boss_2':
      return 'boss:spawned(boss_2)';
    case 'boss_3':
      return 'boss:spawned(boss_3)';
    case 'boss_4':
      return 'boss:spawned(boss_4)';
    default:
      return null;
  }
}

/** 新武器 toast：仅 SILVER/HALLOWED 两句（spec §6 C-2：BLOOD/BEAST/MOON 系默认不弹） */
export function newWeaponTriggerForPowerTag(tag: PowerTag | null): NarrativeTrigger | null {
  switch (tag) {
    case 'SILVER':
      return 'new-weapon:silver';
    case 'HALLOWED':
      return 'new-weapon:hallowed';
    default:
      return null; // 台词红线已满 30 条（spec §9），其余系新武器不弹
  }
}

// —— 红线统计（spec §9）——

/** 台词组（spec §9：角色 12 + Boss 登场 4 + Boss 击败 4 + 局内点缀 5 + 进化 5 = 30） */
export function dialogueLineCount(): number {
  // 表内台词：toast 5 + boss 登场 4 + evolution 5 = 14
  const inTable = NARRATIVES.filter((e) => e.context === 'toast' || e.context === 'boss' || e.context === 'evolution').length;
  // 档案台词：角色 4×3 + Boss 击败 4
  const heroLines = HERO_ARCHIVES.length * 3;
  const bossDefeat = BOSS_ARCHIVES.length;
  return inTable + heroLines + bossDefeat;
}

/**
 * 文本条目合计（spec §9：台词 30 + 序章 4 + 结算 2 + 事件 6 = 42）。
 * 口径 = 表内 20 条 + 角色档案台词 12 + Boss 击败台词 4 + 事件档案 6。
 */
export function textEntryCount(): number {
  const heroLines = HERO_ARCHIVES.length * 3;
  const bossDefeat = BOSS_ARCHIVES.length;
  return NARRATIVES.length + heroLines + bossDefeat + EVENT_ARCHIVES.length;
}

/** 角色档案对象数（4）+ Boss 档案对象数（4）= 8 */
export function archiveCount(): number {
  return HERO_ARCHIVES.length + BOSS_ARCHIVES.length;
}

/** 台词 ≤20 字红线校验（spec §11：全部台词条目 ≤20 字；最长 15 字卡珊德拉入场） */
export function dialogueMaxLength(): number {
  const candidates: string[] = [];
  for (const e of NARRATIVES) {
    if (e.context === 'toast' || e.context === 'boss' || e.context === 'evolution') candidates.push(e.text);
  }
  for (const h of HERO_ARCHIVES) candidates.push(h.lines.enter, h.lines.dying, h.lines.death);
  for (const b of BOSS_ARCHIVES) candidates.push(b.enterLine, b.defeatLine);
  return Math.max(...candidates.map((s) => s.length));
}
