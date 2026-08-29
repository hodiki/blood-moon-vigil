/**
 * config/balance/fx.ts —— 画面特效常量
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

/**
 * 画面特效（TASK-28 美术表现力专项升级 · Phase 6 穿插）。
 * 所有特效常量收敛于此（ARCH §2 唯一配置来源）；色值一律取 PALETTE/BOSS/GEM token（token 统一来源纪律）。
 * 粒子池上限由 runtime-config.maxParticles 驱动（桌面 200 / 移动 100）；拖尾类（fxTrails=false）移动端关闭后池负载大幅下降。
 * 纯时长/数量为视觉参数，不触碰任何 GDD 数值（GDD 数值表在 §敌面板/武器/生成器/升级池）。
 */
export const FX = {
  /** 粒子池双端预算硬上限（桌面 200 / 移动 100 由 runtime-config 覆盖；此为口径值，用于单测/审计断言） */
  PARTICLE_BUDGET: 200,
  /** 通用粒子寿命 s */
  PARTICLE_LIFE: 0.45,
  /** 飞弹拖尾（TASK-36：点→彗尾 p-streak）：发射间隔 ms / 粒子寿命 s / 每枚每拍粒子数 / 帧 */
  TRAIL_INTERVAL_MS: 70,
  TRAIL_LIFE: 0.32,
  TRAIL_COUNT_PER_MISSILE: 1,
  TRAIL_FRAME: 'p-streak',
  /** TASK-36 飞弹发射喷涌：喷点数（开火小 puff，呼应提灯冷青） */
  MISSILE_LAUNCH_PUFF_COUNT: 3,
  /** TASK-36 飞弹命中反馈：冷青冲击环（粒子数/半径）+ 火花（粒子数） */
  MISSILE_IMPACT_RING_COUNT: 6,
  MISSILE_IMPACT_RING_RADIUS: 12,
  MISSILE_IMPACT_SPARK_COUNT: 4,
  /** 环绕球轨道残影（环）：外环透明度 / 转速 deg/s；TASK-36 双层环（内环反向慢旋） */
  ORBIT_RING_ALPHA: 0.26,
  ORBIT_RING_SPIN_DEG: 24,
  ORBIT_RING_SECONDARY_ALPHA: 0.12,
  ORBIT_RING_SECONDARY_OFFSET: 12,
  ORBIT_RING_SECONDARY_SPIN_DEG: -12,
  /** TASK-36 环绕球尾迹：节流 ms / 寿命 s / 粒子尺寸（原地淡出渐隐光点） */
  ORBIT_TRAIL_INTERVAL_MS: 140,
  ORBIT_TRAIL_LIFE: 0.25,
  ORBIT_TRAIL_SIZE: 2.2,
  /** TASK-36 环绕球命中火花：粒子数 / 全局节流 ms（防高频刷屏） */
  ORBIT_HIT_SPARK_COUNT: 3,
  ORBIT_HIT_THROTTLE_MS: 200,
  /** 宝石磁吸拖尾：发射间隔 ms / 粒子寿命 s */
  GEM_TRAIL_INTERVAL_MS: 150,
  GEM_TRAIL_LIFE: 0.2,
  /** 冲击波涟漪（TASK-36 加密提速）：环上粒子数（桌面 36 / 移动 24 降档）/ 外扩速度 / 粒子尺寸 */
  RIPPLE_COUNT: 36,
  RIPPLE_COUNT_MOBILE: 24,
  RIPPLE_SPEED: 90,
  RIPPLE_SIZE: 4,
  /** TASK-36 冲击波最大半径白闪环：粒子数 / 寿命 s（月蚀亮边） */
  SHOCKWAVE_EDGE_FLASH_COUNT: 12,
  SHOCKWAVE_EDGE_FLASH_LIFE: 0.18,
  /** TASK-36 蓄力脉冲提示（随 fxTrails 开关）：alpha / 半径 px / 提前提示秒 */
  SHOCKWAVE_CHARGE_PULSE_ALPHA: 0.15,
  SHOCKWAVE_CHARGE_PULSE_RADIUS: 60,
  SHOCKWAVE_CHARGE_PULSE_LEAD_SECONDS: 2,
  /** Boss 出场：冲击环粒子数 / 半径 px */
  BOSS_RING_COUNT: 22,
  BOSS_RING_RADIUS: 90,
  /** 升级粒子：数量（金 + 冷青双色） */
  LEVELUP_COUNT: 16,
  /** 宝石拾取爆点：数量 */
  GEM_PICKUP_COUNT: 6,
  /**
   * 主动技姿态叠层（表现层，不挡移动、不延迟伤害；gdd-active-skill §3.1 无蓄力资源）。
   * skill-a 前摇帧 → skill-b 施放帧 → 回 idle。
   */
  SKILL_POSE_A_MS: 300,
  SKILL_POSE_B_MS: 150,
  /** 安魂曲双环间隔 ms（asset-spec §3.2） */
  SKILL_REQUIEM_RING_GAP_MS: 150,
  /** 血月狂化体型倍率（asset-spec §3.2；主体仍月银白，不靠 PNG 放大） */
  SKILL_RAGE_SCALE: 1.1,
  /** 血影突袭残影数（asset-spec §3.2 ghost ×3） */
  SKILL_DASH_GHOST_COUNT: 3,
  /** 血影突袭沿线银火粒数 */
  SKILL_DASH_SPARK_COUNT: 8,
  /** 血月狂化兽纹粒子数 */
  SKILL_RAGE_PARTICLE_COUNT: 10,
  /** 可选 skill-ring-* 扩散叠层寿命（秒）；缺帧则 no-op，粒子环仍在 */
  SKILL_RING_LIFE: 0.35,
  /** 血月狂化周身环半径（非清屏半径；asset-spec 兽影形态） */
  SKILL_RAGE_RING_RADIUS: 56,
  /** Boss 出场姿态时长 ms（有 `-entrance` 帧时切姿态；尊者无后缀仍闪红） */
  BOSS_ENTRANCE_MS: 500,
} as const;
