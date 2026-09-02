/**
 * config/ui-copy.ts —— 玩家语言层文案映射（NV-PLAYER-UI W-B1；全 UI 单一来源）
 *
 * 背景（playtest 玩家评价 2026-09-02「灯下，新守夜人」）：「界面在跟策划说话，没有在跟我说话」。
 * 本表把内部术语（powerTag 代号 / 保底席位 P1~P5 / 数值链 px / 开发参数 / 内部代号 / 遥测名）
 * 统一翻译为玩家语言（血月哥特·守夜叙事），UI 各处只消费本表，禁止散落字面量。
 *
 * 命名以 design/official-v1/world-bible.md §7 词根为准：月=月光（月相誓约）、血=血术（血契）、
 * 圣=圣辉、银=银器（银誓）、兽=亡者/兽（兽魂）。敌种/领主名一律取 ENEMY_CONFIGS/BOSSES 真名，禁止编造。
 */

import { BOSSES, HEROES, MAP_CONFIGS, type ExclusiveWeaponId, type MapId, type PowerTag } from '@/config/balance';

// ============================================================================
// W-B1 · powerTag 术语映射（五词根；world-bible §7 对齐）
// ============================================================================

/** powerTag → 玩家语言（保底席位/专武卡/角色卡全 UI 消费） */
export const POWER_TAG_COPY: Record<PowerTag, string> = {
  MOON: '月相誓约',
  BLOOD: '血契',
  HALLOWED: '圣辉',
  SILVER: '银誓',
  BEAST: '兽魂',
};

// ============================================================================
// W-B1 · 保底席位（P1~P5 → 保底·Ⅰ~Ⅴ + 玩家副语；语义按 gdd-upgrade-pool-v3 §3.2 裁决序）
// ============================================================================

export type GuaranteeSeat = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

/** 席位 → 角标标签 + tooltip 副语（玩家语言，不出现 P 编号） */
export const SEAT_COPY: Record<GuaranteeSeat, { label: string; hint: string }> = {
  P1: { label: '保底·Ⅰ', hint: '本轮必现的质变' },
  P2: { label: '保底·Ⅱ', hint: '你等的那把钥匙，本轮必现' },
  P3: { label: '保底·Ⅲ', hint: '趁手的旧兵，再磨一磨' },
  P4: { label: '保底·Ⅳ', hint: '落选的武器，今夜回来助你' },
  P5: { label: '保底·Ⅴ', hint: '武库里还有旧兵待取' },
};

/** 强化编号（A1/A2/B1 等）处理规则：卡面只显名称与效果，编号不入卡面（消费者无需感知） */

// ============================================================================
// W-B2 · 地图卡（镇守者真名取 BOSSES + 氛围语自拟，对齐血月哥特）
// ============================================================================

/** 地图 → 氛围语（自拟；镇守者名 = MAP_CONFIGS.boss → BOSSES.name 真名，禁止编造） */
export const MAP_ATMOSPHERE: Record<MapId, string> = {
  map_graveyard: '碑影之间灯火最亮，亡者也最饿。',
  map_cathedral: '彩窗漏下红光，祷告声在血池里发胀。',
  map_den: '嚎声贴着地面走，连石头都竖起了耳朵。',
};

/** 地图卡守卫行：镇守者·〈领主名〉（真名来源 BOSSES；未知 id 回退空串） */
export function mapGuardianText(mapId: MapId): string {
  const boss = BOSSES[MAP_CONFIGS[mapId]?.boss];
  return boss ? `镇守者·${boss.name}` : '';
}

// ============================================================================
// W-B2 · 专武卡（玩法画像一句，对齐 8 专武定位自拟；删除 feel/DPS 锚行）
// ============================================================================

/** 专武 → 一句玩法画像（玩家语言；替代 powerTag·feel 技术行） */
export const EXCLUSIVE_WEAPON_PROFILE: Record<ExclusiveWeaponId, string> = {
  xw_lantern: '以灯火灼烧成群亡者，守护与清杂的主宰',
  xw_revolver: '拉开距离，六响银弹逐个点名——精准克制的猎手',
  xw_twinblades: '贴身缠斗的双刃，越砍越回血——以血换血的近身篇章',
  xw_longbow: '一箭贯三敌的重狙击，慢，但每一发都值得等',
  xw_bell: '铃音领域随你同行，守誓者代你受难——安魂者的守护',
  xw_cross: '旋转的圣辉十字飞向敌群炸开——定点爆发的祈祷',
  xw_axe: '重斩扫过弧内一切，以自身之血为薪——孤注一掷的葬仪',
  xw_horn: '号角唤来狼群并肩撕咬——与兽同行的召唤者',
};

/** 专武卡副题：落选转化说明（玩家语言） */
export const EXCLUSIVE_FALLBACK_NOTE = '未选之夜，它化作你的技能——本局不可反悔';

// ============================================================================
// W-B2 · 升级卡（分类标签玩家化 + 数值链描述化 + 共鸣钥提示）
// ============================================================================

/** 效果分类标签 → 玩家语言（升级卡 effect 行） */
export const EFFECT_LABEL_COPY: Record<string, string> = {
  机制改变: '改变规则',
  数值提升: '更强一点',
  '进化（不可逆）': '超凡蜕变',
};

/** 共鸣达成后其余钥卡提示（玩家语言） */
export const KEY_CARD_HINT = '另一盏灯的共鸣钥——带走它，或许能点亮别样的共鸣';

/** 升级卡面板统一语义标题（对「奖励还是调试信息」困惑的正面回答） */
export const LEVELUP_HEADER = '今夜的馈赠';

/**
 * 数值链/开发参数 → 描述化（纯函数，levelup/results 渲染前过滤）：
 * - `140→280→420px` 型数值链 → 「范围随强化层层扩展」
 * - `DPS 锚 12~14` / `（峰值 DPS 锚 …）` 等开发参数 → 整段删除
 * - `N px` → 保留数字去掉 px；`N/s` → 「每秒 N」
 * 保留玩家友好关键数字（+15 HP 这类）。
 */
export function sanitizeEffectText(text: string): string {
  let out = text;
  // 数值链（含 px 单位）：a→b→c px / a→b px
  out = out.replace(/\d+(?:\.\d+)?(?:→\d+(?:\.\d+)?)+\s*px/g, '范围随强化层层扩展');
  // 开发参数整段删除：DPS 锚 …（含括号包裹与「峰值」前缀）
  out = out.replace(/（?(?:峰值\s*)?DPS\s*锚[^，。；）)]*）?/g, '');
  // px 单位剥离（保留数字）
  out = out.replace(/(\d+(?:\.\d+)?)\s*px/g, '$1');
  // 攻击节奏：N 伤/Ms → 「每 M 秒 N 伤」（先于每秒规则，避免误吞）
  out = out.replace(/(\d+(?:\.\d+)?)\s*伤\/(\d+(?:\.\d+)?)s/g, '每 $2 秒 $1 伤');
  // 每秒口径：N/s → 每秒 N
  out = out.replace(/(\d+(?:\.\d+)?)\/s/g, '每秒 $1');
  // 清理残留的空括号与多余分隔
  out = out.replace(/（\s*）/g, '').replace(/\s{2,}/g, ' ').trim();
  return out;
}

// ============================================================================
// W-B3 · 结算页玩家三问（夜钟 / 死因 / 余辉）
// ============================================================================

/** 一夜总时长（黎明 = Boss 时点；游戏内 00:00 → 06:00） */
export const NIGHT_TOTAL_SECONDS = 360;

/** 夜进度 → 游戏内时刻 + 距黎明（纯函数；total 缺省 360s） */
export function nightClockText(elapsedSeconds: number, totalSeconds = NIGHT_TOTAL_SECONDS): { clock: string; dawn: string } {
  const total = totalSeconds > 0 ? totalSeconds : NIGHT_TOTAL_SECONDS;
  const clamped = Math.max(0, Math.min(total, elapsedSeconds));
  // 00:00 → 06:00 线性映射
  const gameSeconds = Math.round((clamped / total) * 6 * 3600);
  const h = Math.floor(gameSeconds / 3600);
  const m = Math.floor((gameSeconds % 3600) / 60);
  const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const remainSec = Math.max(0, Math.round(total - clamped));
  const dawn = remainSec <= 0
    ? '黎明已至'
    : `距黎明还差 ${Math.floor(remainSec / 60)} 分 ${remainSec % 60} 秒`;
  return { clock, dawn };
}

/** 死因行：致命一击来自〈来源〉；字段未到时兜底「守夜失败于第 N 分钟」（来源由游戏侧 deathCause 提供） */
export function deathCauseText(deathCause: string | null | undefined, survivalSeconds: number): string {
  if (deathCause && deathCause.trim().length > 0) return `致命一击来自「${deathCause.trim()}」`;
  return `守夜失败于第 ${Math.min(6, Math.floor(survivalSeconds / 60) + 1)} 分钟`;
}

/** 余辉行：本局余辉 +N（累计 N）（meritBalance 接口由游戏侧提供） */
export function meritBalanceText(runEarned: number, total: number): string {
  return `本局余辉 +${Math.max(0, Math.floor(runEarned))}（累计 ${Math.max(0, Math.floor(total))}）`;
}

/** 失败叙事收尾（自拟；按存活秒确定性取一句，避免每局重复同一句的机械感） */
export const DEFEAT_CLOSURES: readonly string[] = [
  '黎明之前，灯先灭了。',
  '血月未落，守夜未竟——火塘还替你留着一席。',
  '这一夜你撑过了大半，输给了最浓的那一刹。',
];

export function defeatClosureText(survivalSeconds: number): string {
  const idx = Math.floor(Math.max(0, survivalSeconds)) % DEFEAT_CLOSURES.length;
  return DEFEAT_CLOSURES[idx] ?? DEFEAT_CLOSURES[0]!;
}

/** 结算遥测折叠区标题（B6/EG-9/offer 等内部代号收纳于此，默认收起） */
export const TELEMETRY_TITLE = '守夜日志（详细记录）';

// ============================================================================
// W-B5 · 树界面 / 图鉴杂项（开发措辞玩家化）
// ============================================================================

/** 支线分组标题：br_<hero> key → 「艾德蒙支线」等（真名取 HEROES.name「·」后段，禁止编造） */
export function heroBranchTitle(heroKey: string): string {
  const heroId = `hero_${heroKey}` as keyof typeof HEROES;
  const cfg = HEROES[heroId];
  if (!cfg) return `${heroKey}支线`;
  const tail = cfg.name.split('·').pop() ?? cfg.name;
  return `${tail}支线`;
}

/** 树界面分组标题玩家化 */
export const TREE_GROUP_COPY = {
  mutation: '质变铭刻 · 改变这一夜怎么开始',
  attribute: '属性浸染 · 小幅而踏实的磨砺',
  pureInGame: '自由试炼模式：属性加成不入局，质变铭刻全部生效',
} as const;

/** 图鉴退役武器说明（原 EG-2 开发措辞玩家化） */
export const CODEX_RETIRED_NOTE = '退役的旧兵——它的进化之路已并入共鸣与质变之夜';

// ============================================================================
// playerCopy 纯函数（静态短语统一出口；复杂映射走上方常量/函数）
// ============================================================================

export type PlayerCopyKey =
  | 'levelup.header'
  | 'exclusive.title'
  | 'exclusive.fallbackNote'
  | 'keyCard.hint'
  | 'results.telemetryTitle'
  | 'tree.pureInGame';

/** 静态短语表（playerCopy 唯一数据源） */
export const PLAYER_COPY: Record<PlayerCopyKey, string> = {
  'levelup.header': LEVELUP_HEADER,
  'exclusive.title': '血月前的抉择 · 二选一',
  'exclusive.fallbackNote': EXCLUSIVE_FALLBACK_NOTE,
  'keyCard.hint': KEY_CARD_HINT,
  'results.telemetryTitle': TELEMETRY_TITLE,
  'tree.pureInGame': TREE_GROUP_COPY.pureInGame,
};

/** 玩家文案统一出口（纯函数；未知 key 返回空串，调用方自行兜底） */
export function playerCopy(key: PlayerCopyKey): string {
  return PLAYER_COPY[key] ?? '';
}
