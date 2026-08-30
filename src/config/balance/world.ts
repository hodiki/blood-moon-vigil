/**
 * config/balance/world.ts —— 世界/地图尺寸 + 全局色板（art-bible token 统一来源）
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

export const WORLD = {
  WIDTH: 3000,
  HEIGHT: 3000,
} as const;

export const TILE = {
  SIZE: 64,
} as const;

/** art-bible §2/§5 色板（工程侧 token 统一来源，禁止硬编码） */
export const PALETTE = {
  base: '#0B0E14', // 墨夜蓝黑：地图主背景
  baseLight: '#131722', // 暗紫灰：地面/石板材质
  // 地形双材质（art-bible §5：石板/草地，均低饱和暗色，明度 12–18%，不与角色抢眼）
  grassBase: '#18201C', // 草地基底（明度 ~13%）
  grassBlade: '#2A3B2E', // 草地草叶（低饱和暗绿——刻意压暗，避免与「绿=治疗」语义混淆）
  player: '#E8F0FA', // 月银白：玩家剪影
  playerAccent: '#54E6C9', // 冷青：玩家描边/选中态
  uiPaper: '#F2F5F9', // 纸白：UI 文字/图标主体（art-bible §2；TASK-33 矢量图标 token）
  blocker: '#2A3346', // 灰蓝：障碍/墙（art-bible §5）
  danger: '#FF3B30', // 血橙红：危险/边界
  // 敌人编码（art-bible §4：暗红剪影/幽紫/猩红金；普通敌纯剪影无描边 → RV-C1）
  enemyZombie: '#8C2F2F', // 僵尸：暗红剪影·尖牙
  enemyWolf: '#A03A3A', // 疾行者：暗红·更小更快
  enemyTank: '#5A3A8C', // 厚血怪：幽紫（双角由 E4 美术落实）
  enemyBoss: '#FF3B3B', // Boss：猩红金主色（art-bible §2 猩红金 #FF3B3B+#FFC93C；E4-S2 使用）
  // E4-S4 程序剪影兜底（asset-spec v1.1 §4.2）：15 敌按 tier/阵营取色——
  // BLOOD 亡者沿用暗红系；BEAST 兽群用灰棕系（区别于血廷暗红，M4 外部素材按帧名无痛替换）
  enemyWraith: '#8C5A8C', // 亡魂：幽紫残影（相位·半透明）
  enemyNecro: '#7A3A4A', // 尸巫：暗红褐（骷髅法杖）
  enemyGravekeeper: '#6E3A8C', // 守墓者：幽紫（R-C3-RULING 墓地精英 · 断碑残冠 1.5x）
  enemyDecayedknight: '#4E5E86', // 腐朽骑士：暗月蓝灰（gdd-enemies-v3 §③-2 MN-16 · MOON 反转体 · 千年前守夜甲胄）
  beastGrey: '#7A6A5A', // 灰狼：暗灰棕（竖耳）
  beastShadow: '#4A4256', // 暗影狼：暗蓝灰（流线）
  beastStone: '#5A5E6E', // 石甲狼：冷灰（石甲纹·精英幽紫调）
  beastHunter: '#6E4A3A', // 狼裔猎手：暗褐（人形狼首）
  missile: '#E8F0FA', // 飞弹：月银白短条
  orb: '#54E6C9', // 环绕球：冷青（描边烘焙进贴图，不用 FX.Outline）
  shockwave: '#FF3B30', // 冲击波：血橙红扩散环
  /** 治疗（art-bible §2.4 14 token 青绿 #43D17C：绿=安全/治疗语义；拾取发光/治疗粒子 token 来源） */
  heal: '#43D17C',
} as const;
