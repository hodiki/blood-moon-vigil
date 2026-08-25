// frame-specs.mjs — 帧名 → 尺寸/图集 映射表（管线基准）
// 来源：asset-spec-v1.md §1.1~§1.6 + §2.2 尺寸表；图集归属按工程注册表（frame-registry.json）口径：
//   characters（角色/敌人/Boss/武器/超武）、effects（tiles+fx-ambient 并入）、ui
// 用途：process.mjs 校验输出尺寸；pack.mjs 分组打包。

// 图集 key（工程 3 图集口径）
export const ATLAS_KEYS = ['characters', 'effects', 'ui'];

// 帧名 → { w, h, atlas }
// 显式列出全部契约帧；未列出的帧按默认规则（见 resolveFrameSpec）
const EXPLICIT = {
  // ---- characters（2026-08-23：角色/敌/Boss 契约 ×2；碰撞脱钩；武器/FX 不动）----
  'player': { w: 64, h: 64, atlas: 'characters' },
  'player-v': { w: 64, h: 64, atlas: 'characters' },
  'player-skill-a': { w: 64, h: 64, atlas: 'characters' },
  'player-skill-b': { w: 64, h: 64, atlas: 'characters' },
  'hero-cassandra': { w: 64, h: 64, atlas: 'characters' },
  'hero-cassandra-v': { w: 64, h: 64, atlas: 'characters' },
  'hero-cassandra-skill-a': { w: 64, h: 64, atlas: 'characters' },
  'hero-cassandra-skill-b': { w: 64, h: 64, atlas: 'characters' },
  'hero-violet': { w: 64, h: 64, atlas: 'characters' },
  'hero-violet-v': { w: 64, h: 64, atlas: 'characters' },
  'hero-violet-skill-a': { w: 64, h: 64, atlas: 'characters' },
  'hero-violet-skill-b': { w: 64, h: 64, atlas: 'characters' },
  'hero-galvan': { w: 64, h: 64, atlas: 'characters' },
  'hero-galvan-v': { w: 64, h: 64, atlas: 'characters' },
  'hero-galvan-skill-a': { w: 64, h: 64, atlas: 'characters' },
  'hero-galvan-skill-b': { w: 64, h: 64, atlas: 'characters' },

  // 敌人（g1 墓地）
  'enemy-zombie': { w: 56, h: 56, atlas: 'characters' },
  'enemy-zombie-v': { w: 56, h: 56, atlas: 'characters' },
  'enemy-hound': { w: 48, h: 48, atlas: 'characters' },
  'enemy-hound-v': { w: 48, h: 48, atlas: 'characters' },
  'enemy-beetle': { w: 40, h: 40, atlas: 'characters' },
  'enemy-beetle-v': { w: 40, h: 40, atlas: 'characters' },
  'enemy-wraith': { w: 56, h: 56, atlas: 'characters' },
  'enemy-wraith-v': { w: 56, h: 56, atlas: 'characters' },
  'enemy-necro': { w: 68, h: 68, atlas: 'characters' },
  'enemy-necro-v': { w: 68, h: 68, atlas: 'characters' },
  'enemy-gravekeeper': { w: 96, h: 96, atlas: 'characters' },
  'enemy-gravekeeper-v': { w: 96, h: 96, atlas: 'characters' },
  // 敌人（g2 教堂）
  'enemy-acolyte': { w: 56, h: 56, atlas: 'characters' },
  'enemy-acolyte-v': { w: 56, h: 56, atlas: 'characters' },
  'enemy-bat': { w: 40, h: 40, atlas: 'characters' },
  'enemy-bat-v': { w: 40, h: 40, atlas: 'characters' },
  'enemy-cupbearer': { w: 64, h: 64, atlas: 'characters' },
  'enemy-cupbearer-v': { w: 64, h: 64, atlas: 'characters' },
  'enemy-fleshmass': { w: 96, h: 96, atlas: 'characters' },
  'enemy-fleshmass-v': { w: 96, h: 96, atlas: 'characters' },
  'enemy-penitent': { w: 56, h: 56, atlas: 'characters' },
  'enemy-penitent-v': { w: 56, h: 56, atlas: 'characters' },
  // 敌人（g3 狼穴）
  'enemy-greywolf': { w: 56, h: 56, atlas: 'characters' },
  'enemy-greywolf-v': { w: 56, h: 56, atlas: 'characters' },
  'enemy-shadowwolf': { w: 48, h: 48, atlas: 'characters' },
  'enemy-shadowwolf-v': { w: 48, h: 48, atlas: 'characters' },
  'enemy-stonewolf': { w: 96, h: 96, atlas: 'characters' },
  'enemy-stonewolf-v': { w: 96, h: 96, atlas: 'characters' },
  'enemy-wolfhunter': { w: 64, h: 64, atlas: 'characters' },
  'enemy-wolfhunter-v': { w: 64, h: 64, atlas: 'characters' },
  // Boss
  'enemy-boss': { w: 240, h: 240, atlas: 'characters' },
  'enemy-boss-v': { w: 240, h: 240, atlas: 'characters' },
  'boss-cardinal': { w: 256, h: 256, atlas: 'characters' },
  'boss-cardinal-v': { w: 256, h: 256, atlas: 'characters' },
  'boss-cardinal-entrance': { w: 256, h: 256, atlas: 'characters' },
  'boss-fenrir': { w: 256, h: 256, atlas: 'characters' },
  'boss-fenrir-v': { w: 256, h: 256, atlas: 'characters' },
  'boss-fenrir-entrance': { w: 256, h: 256, atlas: 'characters' },
  'boss-moonavatar': { w: 256, h: 256, atlas: 'characters' },
  'boss-moonavatar-v': { w: 256, h: 256, atlas: 'characters' },
  'boss-moonavatar-entrance': { w: 256, h: 256, atlas: 'characters' },

  // ---- effects（武器/超武/特效/标记/tiles 并入）----
  'missile': { w: 16, h: 12, atlas: 'characters' }, // 实作 16×12 不可变
  'proj-crossbow': { w: 16, h: 16, atlas: 'characters' },
  'proj-blunderbuss': { w: 16, h: 16, atlas: 'characters' },
  'proj-boomerang': { w: 16, h: 16, atlas: 'characters' },
  'proj-javelin': { w: 16, h: 16, atlas: 'characters' },
  'orb': { w: 20, h: 20, atlas: 'characters' },
  'orb-thorn': { w: 20, h: 20, atlas: 'characters' },
  'aura-barrier': { w: 64, h: 64, atlas: 'characters' },
  'shockwave': { w: 32, h: 32, atlas: 'characters' }, // 帧宽=baseSize 不可变
  'ring-bloodpool': { w: 64, h: 64, atlas: 'characters' },
  'ring-holyfire': { w: 64, h: 64, atlas: 'characters' },
  'summon-bat': { w: 16, h: 16, atlas: 'characters' },
  'summon-hound': { w: 32, h: 32, atlas: 'characters' },
  'beam-chain': { w: 32, h: 64, atlas: 'characters' },
  'super-moonwrath': { w: 16, h: 16, atlas: 'characters' },
  'super-silverblast': { w: 16, h: 16, atlas: 'characters' },
  'super-seraphring': { w: 20, h: 20, atlas: 'characters' },
  'super-totaleclipse': { w: 32, h: 32, atlas: 'characters' },
  'super-bloodsea': { w: 64, h: 64, atlas: 'characters' },
  'super-batstorm': { w: 16, h: 16, atlas: 'characters' },
  'super-packleader': { w: 32, h: 32, atlas: 'characters' },

  // 特效/拾取/标记（工程 effects 图集）
  'gem': { w: 16, h: 16, atlas: 'effects' },
  'heal': { w: 16, h: 16, atlas: 'effects' },
  'skill-ring-edmund': { w: 64, h: 64, atlas: 'effects' },
  'skill-ring-cassandra': { w: 64, h: 64, atlas: 'effects' },
  'skill-ring-violet': { w: 64, h: 64, atlas: 'effects' },
  'skill-ring-galvan': { w: 64, h: 64, atlas: 'effects' },
  'marker-aura': { w: 32, h: 32, atlas: 'effects' },
  'marker-rune': { w: 16, h: 16, atlas: 'effects' },
  'marker-warningline': { w: 32, h: 8, atlas: 'effects' },
  'marker-stun': { w: 8, h: 8, atlas: 'effects' },
  'marker-slow': { w: 8, h: 8, atlas: 'effects' },
  'marker-mark': { w: 8, h: 8, atlas: 'effects' },
  'p-circle': { w: 8, h: 8, atlas: 'effects' },
  'p-ring': { w: 32, h: 32, atlas: 'effects' },
  'p-streak': { w: 16, h: 8, atlas: 'effects' },
  'decal-bloodpool': { w: 64, h: 64, atlas: 'effects' },

  // tiles + fx-ambient（工程并入 effects）
  'tile-ground': { w: 64, h: 64, atlas: 'effects' },
  'tile-grass': { w: 64, h: 64, atlas: 'effects' },
  'tile-obstacle': { w: 64, h: 64, atlas: 'effects' },
  'tile-trap': { w: 64, h: 64, atlas: 'effects' },
  'tile-grave-soil': { w: 64, h: 64, atlas: 'effects' },
  'obst-grave-tomb': { w: 64, h: 64, atlas: 'effects' },
  'obst-grave-fence': { w: 64, h: 64, atlas: 'effects' },
  'decor-grave-tree': { w: 64, h: 64, atlas: 'effects' },
  'decor-grave-candle': { w: 64, h: 64, atlas: 'effects' },
  'decor-grave-bone': { w: 64, h: 64, atlas: 'effects' },
  'tile-church-stone': { w: 64, h: 64, atlas: 'effects' },
  'tile-church-carpet': { w: 64, h: 64, atlas: 'effects' },
  'obst-church-pillar': { w: 64, h: 64, atlas: 'effects' },
  'obst-church-bench': { w: 64, h: 64, atlas: 'effects' },
  'obst-church-altar': { w: 64, h: 64, atlas: 'effects' },
  'decor-church-glasslight': { w: 64, h: 64, atlas: 'effects' },
  'tile-den-earth': { w: 64, h: 64, atlas: 'effects' },
  'tile-den-grass': { w: 64, h: 64, atlas: 'effects' },
  'obst-den-rock': { w: 64, h: 64, atlas: 'effects' },
  'obst-den-log': { w: 64, h: 64, atlas: 'effects' },
  'decor-den-bone': { w: 64, h: 64, atlas: 'effects' },
  'decor-den-fire': { w: 64, h: 64, atlas: 'effects' },
  'decor-den-spike': { w: 64, h: 64, atlas: 'effects' },
  'moon': { w: 128, h: 128, atlas: 'effects' },
  'vignette': { w: 512, h: 512, atlas: 'effects' },
  'decal-rock': { w: 64, h: 64, atlas: 'effects' },
  'decal-grass': { w: 64, h: 64, atlas: 'effects' },
  'decal-blood': { w: 64, h: 64, atlas: 'effects' },

  // ---- ui ----
  'hud-skillbtn': { w: 96, h: 96, atlas: 'ui' }
};

// UI 图标默认（桌面 2x 出档）
const UI_DEFAULT = { w: 128, h: 128, atlas: 'ui' }; // upg-*
const SLOT_DEFAULT = { w: 64, h: 64, atlas: 'ui' }; // wslot-*/skill-*/codex-*
const CHEST_SPEC = { w: 24, h: 24, atlas: 'ui' };   // chest（注册表归 ui）

// 动态解析：未显式列出的帧按前缀规则
export function resolveFrameSpec(frameName) {
  if (EXPLICIT[frameName]) return EXPLICIT[frameName];
  if (frameName.startsWith('upg-')) return UI_DEFAULT;
  if (frameName.startsWith('wslot-') || frameName.startsWith('skill-') || frameName.startsWith('codex-')) return SLOT_DEFAULT;
  if (frameName === 'chest') return CHEST_SPEC;
  return null; // 未识别
}

export function isKnownFrame(frameName) {
  return resolveFrameSpec(frameName) !== null;
}

// 便捷：帧名清单（供 process --list）
export function allFrameNames() {
  return Object.keys(EXPLICIT);
}
