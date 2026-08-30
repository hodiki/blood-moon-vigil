/**
 * scripts/frame-delivery-set.ts —— content-id-frame-map 交付集（CI diff 契约 / 单测共用）
 *
 * 从 `design/official-v1/content-id-frame-map.md` §1~6 逐帧转写的全量帧名交付集。
 * 供：
 * - `scripts/verify-frame-registry.ts`（CI diff：注册表 ⊆ 交付集且无多余名）
 * - `tests/unit/config/frame-registry.test.ts`（单测 diff 断言）
 *
 * 单一数据源：若 content-id-frame-map 更新，仅需同步本模块，CI 脚本与单测自动对齐。
 * 注：`heal`（M3 预留 ⏸）不在交付集，属有意排除（doc §5 标注预留）；
 * 可选道具槽/特写帧（boss-lantern-rusty / player-lantern-close）为打包素材，不入引擎引用表（§7.5）。
 */
export const FRAME_DELIVERY_SET: readonly string[] = [
  // §1 角色（4）
  'player', 'player-v', 'player-skill-a', 'player-skill-b',
  'hero-cassandra', 'hero-cassandra-v', 'hero-cassandra-skill-a', 'hero-cassandra-skill-b',
  'hero-violet', 'hero-violet-v', 'hero-violet-skill-a', 'hero-violet-skill-b',
  'hero-galvan', 'hero-galvan-v', 'hero-galvan-skill-a', 'hero-galvan-skill-b',
  // §2 武器（14）
  'missile', 'proj-crossbow', 'proj-blunderbuss', 'proj-boomerang', 'proj-javelin',
  'orb', 'orb-thorn', 'aura-barrier',
  'shockwave', 'ring-bloodpool', 'decal-bloodpool', 'ring-holyfire',
  'summon-bat', 'summon-hound', 'beam-chain',
  // §2 超武（7）
  'super-moonwrath', 'super-silverblast', 'super-seraphring', 'super-totaleclipse',
  'super-bloodsea', 'super-batstorm', 'super-packleader',
  // §3 敌人（17 ×2 帧；gdd-enemies-v3 §③-2 增补腐朽骑士/掷骨者）
  'enemy-zombie', 'enemy-zombie-v', 'enemy-hound', 'enemy-hound-v',
  'enemy-beetle', 'enemy-beetle-v', 'enemy-wraith', 'enemy-wraith-v',
  'enemy-necro', 'enemy-necro-v', 'enemy-gravekeeper', 'enemy-gravekeeper-v',
  'enemy-decayedknight', 'enemy-decayedknight-v', 'enemy-bonethrower', 'enemy-bonethrower-v',
  'enemy-acolyte', 'enemy-acolyte-v',
  'enemy-bat', 'enemy-bat-v', 'enemy-cupbearer', 'enemy-cupbearer-v',
  'enemy-fleshmass', 'enemy-fleshmass-v', 'enemy-penitent', 'enemy-penitent-v',
  'enemy-greywolf', 'enemy-greywolf-v', 'enemy-shadowwolf', 'enemy-shadowwolf-v',
  'enemy-stonewolf', 'enemy-stonewolf-v', 'enemy-wolfhunter', 'enemy-wolfhunter-v',
  // §3 Boss（4）
  'enemy-boss', 'enemy-boss-v',
  'boss-cardinal', 'boss-cardinal-v', 'boss-cardinal-entrance',
  'boss-fenrir', 'boss-fenrir-v', 'boss-fenrir-entrance',
  'boss-moonavatar', 'boss-moonavatar-v', 'boss-moonavatar-entrance',
  // §4 地图（3）+ 共享
  'tile-ground', 'tile-grass', 'tile-grave-soil', 'obst-grave-tomb', 'obst-grave-fence',
  'decor-grave-tree', 'decor-grave-candle', 'decor-grave-bone',
  'tile-church-stone', 'tile-church-carpet', 'obst-church-pillar', 'obst-church-bench', 'obst-church-altar',
  'decor-church-glasslight', 'decal-bloodpool',
  'tile-den-earth', 'tile-den-grass', 'obst-den-rock', 'obst-den-log',
  'decor-den-bone', 'decor-den-fire', 'decor-den-spike',
  'tile-obstacle', 'tile-trap', 'moon', 'vignette', 'decal-rock', 'decal-grass', 'decal-blood',
  // §5 升级池图标 ×40（key = 内容 ID 后缀）
  'upg-g-1', 'upg-g-2', 'upg-g-3', 'upg-g-4', 'upg-g-5', 'upg-g-6', 'upg-g-7', 'upg-g-8', 'upg-g-9',
  'upg-w-a1', 'upg-w-a2', 'upg-w-a3', 'upg-w-b1', 'upg-w-b2', 'upg-w-b3',
  'upg-w-c1', 'upg-w-c2', 'upg-w-c3', 'upg-w-d1', 'upg-w-d2', 'upg-w-d3',
  'upg-key-scope', 'upg-key-holy', 'upg-key-tome', 'upg-key-silver', 'upg-key-pact', 'upg-key-bone', 'upg-key-grail',
  'upg-a-cd-edmund', 'upg-a-charge-edmund', 'upg-a-effect-edmund',
  'upg-a-cd-cassandra', 'upg-a-charge-cassandra', 'upg-a-effect-cassandra',
  'upg-a-cd-violet', 'upg-a-charge-violet', 'upg-a-effect-violet',
  'upg-a-cd-galvan', 'upg-a-charge-galvan', 'upg-a-effect-galvan',
  // §5 武器槽图标 ×21（slug = 帧名去前缀）
  'wslot-missile', 'wslot-proj-crossbow', 'wslot-proj-blunderbuss', 'wslot-proj-boomerang', 'wslot-proj-javelin',
  'wslot-orb', 'wslot-orb-thorn', 'wslot-aura-barrier', 'wslot-shockwave', 'wslot-ring-bloodpool', 'wslot-ring-holyfire',
  'wslot-summon-bat', 'wslot-summon-hound', 'wslot-beam-chain',
  'wslot-super-moonwrath', 'wslot-super-silverblast', 'wslot-super-seraphring', 'wslot-super-totaleclipse',
  'wslot-super-bloodsea', 'wslot-super-batstorm', 'wslot-super-packleader',
  // §5 主动技图标 ×4 / 按钮 / 图鉴 / 宝箱
  'skill-edmund', 'skill-cassandra', 'skill-violet', 'skill-galvan',
  'hud-skillbtn',
  'codex-event-1', 'codex-event-2', 'codex-event-3', 'codex-event-4', 'codex-event-5', 'codex-event-6',
  'chest',
  // §6 特效 / 行为标记 / 拾取（共享帧）
  'p-circle', 'p-ring', 'p-streak', 'gem',
  'skill-ring-edmund', 'skill-ring-cassandra', 'skill-ring-violet', 'skill-ring-galvan',
  'marker-aura', 'marker-rune', 'marker-warningline', 'marker-stun', 'marker-slow', 'marker-mark',
] as const;
