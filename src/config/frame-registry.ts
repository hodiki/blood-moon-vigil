/**
 * config/frame-registry.ts —— 帧名注册表导出（E1-S7 / content-id-frame-map §8）
 *
 * 与 `design/official-v1/content-id-frame-map.md` 一一对照：全部内容 ID ↔ 帧名映射。
 * 用途：
 * - M4 资产集成：外部素材按注册表帧名替换，实体代码零改动（content-id-frame-map §7.4）。
 * - M2 各 Epic：实体/剪影代码只引用注册表帧名，禁止散落新帧名。
 * - 验收：`tests/unit/config/frame-registry.test.ts` 断言「注册表 ⊆ 交付集且无多余名；
 *   保留帧名未改名」（本表为唯一基准，测试内嵌 content-id-frame-map 交付集做 diff）。
 *
 * 保留帧名铁律（§7.3）：`player/player-v/missile/orb/shockwave/enemy-zombie/...`
 * 不可改名（Demo 既有帧），M4 只换图不换名。
 */

/** 帧名注册表：图集 key → 帧名列表（characters/effects/ui + ui-portraits + ui-slots） */
export interface AtlasFrameGroup {
  atlas: string;
  frames: readonly string[];
}

/**
 * 内容 ID ↔ 帧名全量映射（content-id-frame-map §1~6；M4 资产集成基准）。
 * 注：`heal`（M3 随修女落地，⏸ 预留）不入注册表；可选道具槽/特写帧
 * （boss-lantern-rusty / player-lantern-close）为打包素材，不入引擎引用表（§7.5）。
 */
export const FRAME_BY_CONTENT_ID: Readonly<Record<string, readonly string[]>> = {
  // ---- §1 角色（4）----
  hero_edmund: ['player', 'player-v', 'player-skill-a', 'player-skill-b'],
  hero_cassandra: ['hero-cassandra', 'hero-cassandra-v', 'hero-cassandra-skill-a', 'hero-cassandra-skill-b'],
  hero_violet: ['hero-violet', 'hero-violet-v', 'hero-violet-skill-a', 'hero-violet-skill-b'],
  hero_galvan: ['hero-galvan', 'hero-galvan-v', 'hero-galvan-skill-a', 'hero-galvan-skill-b'],
  // ---- §2 武器（14）+ 超武（7）----
  wpn_a_1: ['missile'],
  wpn_a_2: ['proj-crossbow'],
  wpn_a_3: ['proj-blunderbuss'],
  wpn_a_4: ['proj-boomerang'],
  wpn_a_5: ['proj-javelin'],
  wpn_b_1: ['orb'],
  wpn_b_2: ['orb-thorn'],
  wpn_b_3: ['aura-barrier'],
  wpn_c_1: ['shockwave'],
  wpn_c_2: ['ring-bloodpool', 'decal-bloodpool'],
  wpn_c_3: ['ring-holyfire'],
  wpn_d_1: ['summon-bat'],
  wpn_d_2: ['summon-hound'],
  wpn_d_3: ['beam-chain'],
  evo_moonwrath: ['super-moonwrath'],
  evo_silverblast: ['super-silverblast'],
  evo_seraphring: ['super-seraphring'],
  evo_totaleclipse: ['super-totaleclipse'],
  evo_bloodsea: ['super-bloodsea'],
  evo_batstorm: ['super-batstorm'],
  evo_packleader: ['super-packleader'],
  xw_revolver: ['proj-revolver'],
  xw_longbow: ['proj-longbow'],
  xw_twinblades: ['proj-twinblade'],
  xw_bell: ['summon-oathkeeper', 'summon-oathkeeper-v', 'summon-oathkeeper-tombstone'],
  xw_horn: ['summon-moonwolf', 'summon-moonwolf-v'],
  // ---- §3 敌人（17）+ Boss（4）----
  enemy_g1_1: ['enemy-zombie', 'enemy-zombie-v'],
  enemy_g1_2: ['enemy-hound', 'enemy-hound-v'],
  enemy_g1_3: ['enemy-beetle', 'enemy-beetle-v'],
  enemy_g1_4: ['enemy-wraith', 'enemy-wraith-v'],
  enemy_g1_5: ['enemy-necro', 'enemy-necro-v'],
  enemy_g1_6: ['enemy-gravekeeper', 'enemy-gravekeeper-v'],
  enemy_g1_7: ['enemy-decayedknight', 'enemy-decayedknight-v'],
  enemy_g1_8: ['enemy-bonethrower', 'enemy-bonethrower-v'],
  enemy_g2_1: ['enemy-acolyte', 'enemy-acolyte-v'],
  enemy_g2_2: ['enemy-bat', 'enemy-bat-v'],
  enemy_g2_3: ['enemy-cupbearer', 'enemy-cupbearer-v'],
  enemy_g2_4: ['enemy-fleshmass', 'enemy-fleshmass-v'],
  enemy_g2_5: ['enemy-penitent', 'enemy-penitent-v'],
  enemy_g3_1: ['enemy-greywolf', 'enemy-greywolf-v'],
  enemy_g3_2: ['enemy-shadowwolf', 'enemy-shadowwolf-v'],
  enemy_g3_3: ['enemy-stonewolf', 'enemy-stonewolf-v', 'enemy-stonewolf-broken', 'enemy-stonewolf-broken-v'],
  enemy_g3_4: ['enemy-wolfhunter', 'enemy-wolfhunter-v'],
  boss_1: ['enemy-boss', 'enemy-boss-v'],
  boss_2: ['boss-cardinal', 'boss-cardinal-v', 'boss-cardinal-entrance'],
  boss_3: ['boss-fenrir', 'boss-fenrir-v', 'boss-fenrir-entrance'],
  boss_4: ['boss-moonavatar', 'boss-moonavatar-v', 'boss-moonavatar-entrance'],
  // ---- §4 地图（3）+ 共享 ----
  map_graveyard: ['tile-ground', 'tile-grass', 'tile-grave-soil', 'obst-grave-tomb', 'obst-grave-fence', 'decor-grave-tree', 'decor-grave-candle', 'decor-grave-bone'],
  map_cathedral: ['tile-church-stone', 'tile-church-carpet', 'obst-church-pillar', 'obst-church-bench', 'obst-church-altar', 'decor-church-glasslight', 'decal-bloodpool'],
  map_den: ['tile-den-earth', 'tile-den-grass', 'obst-den-rock', 'obst-den-log', 'decor-den-bone', 'decor-den-fire', 'decor-den-spike'],
  shared_map: ['tile-obstacle', 'tile-trap', 'moon', 'vignette', 'decal-rock', 'decal-grass', 'decal-blood'],
  // ---- §5 升级池图标 ×40（key = 内容 ID 后缀）----
  upg_icons: [
    // 全局 9
    'upg-g-1', 'upg-g-2', 'upg-g-3', 'upg-g-4', 'upg-g-5', 'upg-g-6', 'upg-g-7', 'upg-g-8', 'upg-g-9',
    // 武器类 12
    'upg-w-a1', 'upg-w-a2', 'upg-w-a3', 'upg-w-b1', 'upg-w-b2', 'upg-w-b3', 'upg-w-c1', 'upg-w-c2', 'upg-w-c3', 'upg-w-d1', 'upg-w-d2', 'upg-w-d3',
    // 钥 7
    'upg-key-scope', 'upg-key-holy', 'upg-key-tome', 'upg-key-silver', 'upg-key-pact', 'upg-key-bone', 'upg-key-grail',
    // 主动技强化 12（按角色展开，up_a_<分支>_<hero> → upg-a-<分支>-<hero>）
    'upg-a-cd-edmund', 'upg-a-charge-edmund', 'upg-a-effect-edmund',
    'upg-a-cd-cassandra', 'upg-a-charge-cassandra', 'upg-a-effect-cassandra',
    'upg-a-cd-violet', 'upg-a-charge-violet', 'upg-a-effect-violet',
    'upg-a-cd-galvan', 'upg-a-charge-galvan', 'upg-a-effect-galvan',
  ],
  // ---- §5 武器槽图标 ×21（slug = 武器/超武帧名去前缀）----
  wslot_icons: [
    'wslot-missile', 'wslot-proj-crossbow', 'wslot-proj-blunderbuss', 'wslot-proj-boomerang', 'wslot-proj-javelin',
    'wslot-orb', 'wslot-orb-thorn', 'wslot-aura-barrier', 'wslot-shockwave', 'wslot-ring-bloodpool', 'wslot-ring-holyfire',
    'wslot-summon-bat', 'wslot-summon-hound', 'wslot-beam-chain',
    'wslot-super-moonwrath', 'wslot-super-silverblast', 'wslot-super-seraphring', 'wslot-super-totaleclipse', 'wslot-super-bloodsea', 'wslot-super-batstorm', 'wslot-super-packleader',
  ],
  // ---- §5 主动技图标 ×4 / 按钮 / 图鉴 / 宝箱 ----
  skill_icons: ['skill-edmund', 'skill-cassandra', 'skill-violet', 'skill-galvan'],
  hud_skillbtn: ['hud-skillbtn'],
  codex_events: ['codex-event-1', 'codex-event-2', 'codex-event-3', 'codex-event-4', 'codex-event-5', 'codex-event-6'],
  chest: ['chest'],
  xw_cards: [
    'exw-card-lantern', 'exw-card-revolver', 'exw-card-twinblade', 'exw-card-longbow',
    'exw-card-bell', 'exw-card-cross', 'exw-card-axe', 'exw-card-horn',
  ],
  hud_extra: ['hud-revive', 'hud-merit-glow'],
  sticons: ['sticon-hard', 'sticon-soft', 'sticon-vuln'],
  seats: ['seat-p1', 'seat-p2', 'seat-p3', 'seat-p4', 'seat-p5'],
  badges: ['badge-mech', 'badge-num', 'badge-evo'],
  reso_badges: ['reso-ready', 'reso-awaiting', 'reso-achieved'],
  // ---- §5A C-1 天赋树节点（22 唯一帧；双点位/四顶点共用）----
  q_a: ['tree-q-a'],
  q_b: ['tree-q-b'],
  q_c: ['tree-q-c'],
  q_d: ['tree-q-d'],
  q_e: ['tree-q-e'],
  q_f1: ['tree-q-f1'],
  q_f2: ['tree-q-f2'],
  q_f3: ['tree-q-f3'],
  q_s1: ['tree-q-s1'],
  q_s3: ['tree-q-s3'],
  q_s4: ['tree-q-s4'],
  a_attack: ['tree-a-atk'],
  a_attack_2: ['tree-a-atk'],
  a_damage: ['tree-a-dmg'],
  a_damage_2: ['tree-a-dmg'],
  a_attack_speed: ['tree-a-aspd'],
  a_cooldown: ['tree-a-cdr'],
  a_xp_gain: ['tree-a-exp'],
  a_xp_gain_2: ['tree-a-exp'],
  a_magnet: ['tree-a-magnet'],
  a_magnet_2: ['tree-a-magnet'],
  a_life: ['tree-a-hp'],
  a_life_2: ['tree-a-hp'],
  a_move_speed: ['tree-a-spd'],
  a_heal_efficiency: ['tree-a-heal'],
  a_pickup_radius: ['tree-a-pickup'],
  br_edmund_top: ['tree-peak'],
  br_cassandra_top: ['tree-peak'],
  br_violet_top: ['tree-peak'],
  br_galvan_top: ['tree-peak'],
  relic_icons: [
    'relic-icon-mooneclipse', 'relic-icon-bloodtide', 'relic-icon-twelvelamps',
    'relic-icon-silvertide', 'relic-icon-wolfspirit',
  ],
  xw_emblems: [
    'exw-emblem-lantern', 'exw-emblem-revolver', 'exw-emblem-twinblade', 'exw-emblem-longbow',
    'exw-emblem-bell', 'exw-emblem-cross', 'exw-emblem-axe', 'exw-emblem-horn',
  ],
  relic_reliquary: ['relic-reliquary'],
  relic_moonfall: ['relic-mooneclipse'],
  relic_bloodtide: ['relic-bloodtide'],
  relic_twelve_lamps: ['relic-twelvelamps'],
  relic_silver_tide: ['relic-silvertide'],
  relic_wolf_spirit: ['relic-wolfspirit'],
  // ---- §6 特效 / 行为标记 / 拾取（共享帧）----
  fx_shared: ['p-circle', 'p-ring', 'p-streak', 'gem'],
  skill_rings: ['skill-ring-edmund', 'skill-ring-cassandra', 'skill-ring-violet', 'skill-ring-galvan'],
  markers: ['marker-aura', 'marker-rune', 'marker-warningline', 'marker-stun', 'marker-slow', 'marker-mark'],
};

/** 保留帧名（content-id-frame-map §7.3：不可改名，M4 无痛替换基准） */
export const RESERVED_FRAMES: readonly string[] = [
  'player', 'player-v',
  'missile', 'orb', 'shockwave',
  'enemy-zombie', 'enemy-zombie-v', 'enemy-hound', 'enemy-hound-v', 'enemy-boss', 'enemy-boss-v',
  'gem', 'tile-ground', 'tile-grass', 'tile-obstacle',
  'p-circle', 'p-ring', 'p-streak',
  'moon', 'vignette', 'decal-rock', 'decal-grass', 'decal-blood',
] as const;

/** 全量帧名（去重；注册表 = content-id-frame-map 交付集子集，无多余名） */
export const ALL_FRAMES: readonly string[] = [...new Set(Object.values(FRAME_BY_CONTENT_ID).flat())];

/** 角色/实体帧（characters 图集） */
const CHARACTERS_CONTENT_IDS: readonly string[] = [
  'hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan',
  'wpn_a_1', 'wpn_a_2', 'wpn_a_3', 'wpn_a_4', 'wpn_a_5',
  'wpn_b_1', 'wpn_b_2', 'wpn_b_3', 'wpn_c_1', 'wpn_c_2', 'wpn_c_3', 'wpn_d_1', 'wpn_d_2', 'wpn_d_3',
  'evo_moonwrath', 'evo_silverblast', 'evo_seraphring', 'evo_totaleclipse', 'evo_bloodsea', 'evo_batstorm', 'evo_packleader',
  'xw_revolver', 'xw_longbow', 'xw_twinblades', 'xw_bell', 'xw_horn',
  'enemy_g1_1', 'enemy_g1_2', 'enemy_g1_3', 'enemy_g1_4', 'enemy_g1_5', 'enemy_g1_6', 'enemy_g1_7', 'enemy_g1_8',
  'enemy_g2_1', 'enemy_g2_2', 'enemy_g2_3', 'enemy_g2_4', 'enemy_g2_5',
  'enemy_g3_1', 'enemy_g3_2', 'enemy_g3_3', 'enemy_g3_4',
  'boss_1', 'boss_2', 'boss_3', 'boss_4',
] as const;

/** 世界渲染/特效帧（effects 图集） */
const EFFECTS_CONTENT_IDS: readonly string[] = [
  'shared_map', 'map_graveyard', 'map_cathedral', 'map_den', 'fx_shared', 'skill_rings', 'markers',
  'relic_reliquary', 'relic_moonfall', 'relic_bloodtide', 'relic_twelve_lamps', 'relic_silver_tide', 'relic_wolf_spirit',
] as const;

/** HUD / 升级卡等（ui 图集；不含 512 立绘、不含 C-1～C-3） */
const UI_CONTENT_IDS: readonly string[] = [
  'upg_icons', 'wslot_icons', 'skill_icons', 'hud_skillbtn', 'codex_events', 'chest',
  'hud_extra', 'sticons', 'seats', 'badges', 'reso_badges',
] as const;

/** 专武选择卡 512 立绘（ui-portraits；从 ui 拆出以免 2048² 撑满） */
const UI_PORTRAITS_CONTENT_IDS: readonly string[] = [
  'xw_cards',
] as const;

/** C-1～C-3 槽位图标（ui-slots · 桌面 64 / 移动运行时缩到 48） */
const UI_SLOTS_CONTENT_IDS: readonly string[] = [
  'q_a', 'q_b', 'q_c', 'q_d', 'q_e', 'q_f1', 'q_f2', 'q_f3', 'q_s1', 'q_s3', 'q_s4',
  'a_attack', 'a_attack_2', 'a_damage', 'a_damage_2', 'a_attack_speed', 'a_cooldown',
  'a_xp_gain', 'a_xp_gain_2', 'a_magnet', 'a_magnet_2', 'a_life', 'a_life_2',
  'a_move_speed', 'a_heal_efficiency', 'a_pickup_radius',
  'br_edmund_top', 'br_cassandra_top', 'br_violet_top', 'br_galvan_top',
  'relic_icons', 'xw_emblems',
] as const;

function collectFrames(contentIds: readonly string[], claimed: Set<string>): readonly string[] {
  const out: string[] = [];
  for (const id of contentIds) {
    const frames = FRAME_BY_CONTENT_ID[id];
    if (!frames) continue;
    for (const f of frames) {
      if (claimed.has(f)) continue; // 共享帧归属首个需要的图集（分区不重不漏）
      claimed.add(f);
      out.push(f);
    }
  }
  return out;
}

/**
 * 图集 key → 帧名列表。分区不重不漏：共享帧归属首个需要的图集。
 * 战斗：effects → characters。UI：hud `ui` / 立绘 `ui-portraits` / C-1～C-3 `ui-slots`。
 */
export const FRAME_REGISTRY: readonly AtlasFrameGroup[] = (() => {
  const claimed = new Set<string>();
  return [
    { atlas: 'effects', frames: collectFrames(EFFECTS_CONTENT_IDS, claimed) },
    { atlas: 'characters', frames: collectFrames(CHARACTERS_CONTENT_IDS, claimed) },
    { atlas: 'ui', frames: collectFrames(UI_CONTENT_IDS, claimed) },
    { atlas: 'ui-portraits', frames: collectFrames(UI_PORTRAITS_CONTENT_IDS, claimed) },
    { atlas: 'ui-slots', frames: collectFrames(UI_SLOTS_CONTENT_IDS, claimed) },
  ];
})();

/** 内容 ID 的待机帧（注册表第一帧）。M4：角色/Boss 换外观只换这一个名字。 */
export function visualFrameForContent(contentId: string, fallback = 'player'): string {
  return FRAME_BY_CONTENT_ID[contentId]?.[0] ?? fallback;
}
