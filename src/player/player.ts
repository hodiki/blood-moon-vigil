/**
 * player/player.ts —— 玩家实体（ARCH §3.2 / E1-S6 / E2-S1/E2-S5 / S2 / E4-S1 角色差异化）
 *
 * E1 范围：移动（getMove × 移速 × clampDelta）、世界边界 clamp（按地图尺寸，E4-S9）、障碍 AABB。
 * E2 范围：受击（接触伤害 + 0.5s 无敌帧）、死亡分发（emit player:died）。
 * E4-S1 角色：构造器可注入 HeroConfig → PlayerStats 按角色初始化（初始 HP/移速/成长/专属被动）；
 *   移动使用 effectiveMoveSpeed（受击加速/狂化移速 buff）；受击触发血猎手「半裔之血」。
 * 伤害计算统一走 combat/damage.ts 纯函数（倍率/无敌帧判定），本类只做响应与副作用。
 * 视觉：程序生成贴图（art-bible §8 允许），月银白剪影 + 冷青描边。
 */

import Phaser from 'phaser';
import { PLAYER, DEATH_SHIELD, type HeroConfig, type MapId } from '@/config/balance';
import { MAP_CONFIGS } from '@/config/balance';
import { visualFrameForContent } from '@/config/frame-registry';
import { resolveCharacterFrame } from '@/fx/external-atlas';
import { PlayerStats } from '@/player/player-stats';
import { isInvulnerable, applyDamage, extendInvulnerabilityUntil } from '@/combat/damage';
import { GameEvents, GameEvent } from '@/core/events';
import { clampToWorld, type Vec2 } from '@/utils/math';
import { SkillPoseClock } from '@/fx/skill-pose';

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly stats: PlayerStats;
  /** 当前角色待机帧（M4：卡珊德拉等用 hero-*，缺图回退 player） */
  readonly visualFrame: string;
  /** 无敌帧截止（秒时间戳）：0.5s（enemies §⑥.3 / RV-C7） */
  private invulnerableUntil = 0;
  /** 当前世界尺寸（E4-S9：按 MAP_CONFIGS 尺寸联动；默认墓地 3000） */
  private worldW: number;
  private worldH: number;
  /** 主动技姿态计时（fx/skill-pose.ts 纯类；<0 = 未在播。伤害已瞬发，本字段只驱动 skill-a/b 帧） */
  private skillPose = new SkillPoseClock();

  constructor(scene: Phaser.Scene, x: number, y: number, hero?: HeroConfig, mapId: MapId = 'map_graveyard') {
    const visual = resolveCharacterFrame(scene, visualFrameForContent(hero?.id ?? 'hero_edmund'));
    super(scene, x, y, 'characters', visual);
    this.visualFrame = visual;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.stats = new PlayerStats(hero);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER.RADIUS);
    body.setAllowGravity(false);
    // 边界用 clampToWorld 手动钳制（精确 [0,W]²，S9 / E4-S9 地图尺寸联动），不依赖 Arcade worldBounds
    body.setCollideWorldBounds(false);
    this.setDepth(100);
    const map = MAP_CONFIGS[mapId];
    this.worldW = map.width;
    this.worldH = map.height;
  }

  /** E4-S9：按地图尺寸更新世界边界（PlayScene 开局调用；相机边界同步） */
  setWorldSize(worldW: number, worldH: number): void {
    this.worldW = worldW;
    this.worldH = worldH;
  }

  /**
   * 每帧移动：输入向量 × 当前生效移速（Arcade velocity，fixedStep 60Hz 与渲染帧率解耦；
   * 位移数值断言见 player-stats.moveDisplacement + clampDelta 单测）。
   * now 秒时间戳用于受击加速/狂化移速 buff 判定（E4-S1/S2）。
   */
  update(move: Vec2, now = 0): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(move.x * this.stats.effectiveMoveSpeed(now), move.y * this.stats.effectiveMoveSpeed(now));
    const clamped = clampToWorld({ x: this.x, y: this.y }, this.worldW, this.worldH);
    this.setPosition(clamped.x, clamped.y);
  }

  /**
   * 受击：无敌帧 0.5s 内免疫（多敌同帧接触只扣 1 次，E8 §⑥.3）；
   * 命中 → 扣血 + 血猎手受击加速（E4-S1 专属被动）+ emit player:hurt；HP≤0 → emit player:died（E2-S1 #4）。
   * 返回是否真正受到伤害。
   */
  hurt(amount: number, nowSeconds: number): boolean {
    if (isInvulnerable(nowSeconds, this.invulnerableUntil)) return false;
    // E4-S4 濒死护盾：HP<25% 且未使用 → 一次性 60 护盾（up_g_8）
    this.stats.maybeTriggerDeathShield(DEATH_SHIELD.HP_FRACTION_THRESHOLD, DEATH_SHIELD.SHIELD_AMOUNT);
    // E4-S4 承伤减免 + 护盾吸收后进入 HP（up_g_7 / up_g_8）
    const finalAmount = this.stats.absorbDamage(amount);
    applyDamage(this.stats, finalAmount);
    this.invulnerableUntil = nowSeconds + this.stats.invulnerableTime;
    // E4-S1 血猎手「半裔之血」：受击后 3s 移速 +10%（被动随角色，非血猎手为 0 时长无感）
    this.stats.triggerHitSpeedBoost(nowSeconds);
    // M3-DESIGN-1 up_g_3 鲜血契约：受击后 5s 回复 10 HP（12s CD；Player.hurt 消费，类比 DEATH_SHIELD）
    if (this.stats.maybeTriggerHitHeal(nowSeconds)) {
      this.stats.applyHitHeal();
    }
    GameEvents.emit(GameEvent.PlayerHurt, { hp: this.stats.hp, maxHp: this.stats.maxHp, shield: this.stats.shield });
    // E4-S1 HUD：HP 变化统一走 hp:changed（受击/升级回血/吸血/生命上限提升）
    GameEvents.emit(GameEvent.HpChanged, { hp: this.stats.hp, maxHp: this.stats.maxHp });
    if (this.stats.hp <= 0) {
      GameEvents.emit(GameEvent.PlayerDied);
    }
    return true;
  }

  /** 当前是否处于无敌帧（测试/表现层查询） */
  isInvulnerableNow(nowSeconds: number): boolean {
    return isInvulnerable(nowSeconds, this.invulnerableUntil);
  }

  /**
   * M1b 主动技「提灯闪耀」：额外给予无敌（取与既有无敌帧的较晚者，不缩短已有无敌）。
   * 与受击 0.5s 无敌共用 invulnerableUntil 字段 —— 主动技无敌期内 hurt() 天然免疫。
   */
  grantInvulnerability(durationSeconds: number, nowSeconds: number): void {
    this.invulnerableUntil = extendInvulnerabilityUntil(this.invulnerableUntil, nowSeconds, durationSeconds);
  }

  /** 开始姿态叠层（不冻结移动；缺帧时 tick 自动跳过） */
  beginSkillPose(): void {
    this.skillPose.start(this.scene.time.now);
  }

  /** 距姿态起点的毫秒；未开始为 -1 */
  skillPoseElapsedMs(): number {
    return this.skillPose.elapsedMs(this.scene.time.now);
  }
}
