/**
 * config/balance/ids.ts —— 内容 ID 联合类型 + 跨域类型原语
 *
 * balance.ts 域拆分（EG-1，CR 技术债 T2）的公共类型层：各域文件（weapons/enemies/
 * upgrade/heroes/maps…）共用 ID 联合类型集中于此，防域间循环依赖。
 * 纯类型文件，无运行时导出。
 *
 * 来源：content-design-outline §1.3 / content-id-frame-map §1~6 /
 *       gdd-upgrade-pool-v2 §3.2~3.5 / gdd-weapons-v2 §3.2~3.5。
 */

/** powerTag 五 tag（content-design-outline §1.3 / world-bible §4） */
export type PowerTag = 'SILVER' | 'HALLOWED' | 'BEAST' | 'BLOOD' | 'MOON';

/** 武器类：A 弹幕 / B 环绕 / C 范围 / D 召唤（content-design-outline §3.1） */
export type WeaponClass = 'A' | 'B' | 'C' | 'D';

/** 内容 ID 联合类型（content-design-outline §1.3 / content-id-frame-map §1~6） */
export type WeaponId =
  | 'wpn_a_1' | 'wpn_a_2' | 'wpn_a_3' | 'wpn_a_4' | 'wpn_a_5'
  | 'wpn_b_1' | 'wpn_b_2' | 'wpn_b_3'
  | 'wpn_c_1' | 'wpn_c_2' | 'wpn_c_3'
  | 'wpn_d_1' | 'wpn_d_2' | 'wpn_d_3';

export type EvoId =
  | 'evo_moonwrath' | 'evo_silverblast' | 'evo_seraphring' | 'evo_totaleclipse'
  | 'evo_bloodsea' | 'evo_batstorm' | 'evo_packleader';

export type EnemyId =
  | 'enemy_g1_1' | 'enemy_g1_2' | 'enemy_g1_3' | 'enemy_g1_4' | 'enemy_g1_5' | 'enemy_g1_6' | 'enemy_g1_7' | 'enemy_g1_8'
  | 'enemy_g2_1' | 'enemy_g2_2' | 'enemy_g2_3' | 'enemy_g2_4' | 'enemy_g2_5'
  | 'enemy_g3_1' | 'enemy_g3_2' | 'enemy_g3_3' | 'enemy_g3_4';

export type BossId = 'boss_1' | 'boss_2' | 'boss_3' | 'boss_4';

export type HeroId = 'hero_edmund' | 'hero_cassandra' | 'hero_violet' | 'hero_galvan';

export type MapId = 'map_graveyard' | 'map_cathedral' | 'map_den';

/** 升级项类型：mechanic=机制改变型 / numeric=纯数值型（upgrade-pool §③） */
export type UpgradeType = 'mechanic' | 'numeric';

/**
 * 升级项内容 ID（gdd-upgrade-pool-v2 §3.2~3.5）。
 * 主动技强化按角色展开为 12 项（content-design-outline §6.5「4 角色 ×3 分支」），
 * GDD §3.5 以 3 分支紧凑表呈现；此处以 `up_a_<分支>_<hero>` 唯一化，保证池恰好 40 项。
 */
export type UpgradeId =
  | 'up_g_1' | 'up_g_2' | 'up_g_3' | 'up_g_4' | 'up_g_5' | 'up_g_6' | 'up_g_7' | 'up_g_8' | 'up_g_9'
  | 'up_w_a1' | 'up_w_a2' | 'up_w_a3'
  | 'up_w_b1' | 'up_w_b2' | 'up_w_b3'
  | 'up_w_c1' | 'up_w_c2' | 'up_w_c3'
  | 'up_w_d1' | 'up_w_d2' | 'up_w_d3'
  | 'up_w_g1' | 'up_w_g2'
  | 'key_scope' | 'key_holy' | 'key_tome' | 'key_silver' | 'key_pact' | 'key_bone' | 'key_grail' | 'key_nail'
  | 'up_a_cd_edmund' | 'up_a_charge_edmund' | 'up_a_effect_edmund'
  | 'up_a_cd_cassandra' | 'up_a_charge_cassandra' | 'up_a_effect_cassandra'
  | 'up_a_cd_violet' | 'up_a_charge_violet' | 'up_a_effect_violet'
  | 'up_a_cd_galvan' | 'up_a_charge_galvan' | 'up_a_effect_galvan'
  | 'up_d_revolver' | 'up_d_lantern' | 'up_d_dash' | 'up_d_snipe' | 'up_d_requiem' | 'up_d_judgment' | 'up_d_rage' | 'up_d_charge'
  /** B3 质变卡池项（mc_<专武>_<order>；数据源 MUTATION_CARDS 封闭表） */
  | `mc_${string}`;

/** 升级项抽取标签（gdd-upgrade-pool-v2 §3.1/§3.6：global / weapon_class_* / key / hero_<id>） */
export type UpgradeTag = 'global' | 'weapon_class_a' | 'weapon_class_b' | 'weapon_class_c' | 'weapon_class_d' | 'key' | HeroId;
