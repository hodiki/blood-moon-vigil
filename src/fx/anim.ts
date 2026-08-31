/**
 * fx/anim.ts —— 角色 2 帧循环（TASK-28 + M4 按实际帧名播）
 *
 * 原则：基准帧与变体帧（`*-v`）同处 'characters' 图集。
 * `-v` 只承担 idle 呼吸（1.4fps yoyo）。没有 `-walk-a/b` 时不要用 idle 变体当 9fps 走路。
 * 方向：asset-spec 只出一朝向，横移用 flipX（默认帧朝右，vx<0 镜像）。
 */

import Phaser from 'phaser';
import type { Player } from '@/player/player';
import type { Enemy } from '@/enemies/enemy';
import { bossEntranceFrameName, skillPoseFrameName, skillPosePhase } from '@/fx/skill-pose';

/** 小于此水平速度（px/s）保持上一朝向，避免原地抖动翻面 */
export const FACING_DEADZONE = 8;

export function idleAnimKey(frame: string): string {
  return `${frame}-idle`;
}

export function moveAnimKey(frame: string): string {
  return `${frame}-move`;
}

/** 有正式步态帧才建 move；否则 tick 回落到 idle。 */
export function walkCycleFrames(base: string, hasFrame: (name: string) => boolean): string[] | null {
  const a = `${base}-walk-a`;
  const b = `${base}-walk-b`;
  if (hasFrame(a) && hasFrame(b)) return [a, b];
  return null;
}

/** 帧朝右：vx>deadzone → 不翻转；vx<-deadzone → 翻转。竖移保持 current。 */
export function facingFlipX(vx: number, current: boolean, deadzone = FACING_DEADZONE): boolean {
  if (vx > deadzone) return false;
  if (vx < -deadzone) return true;
  return current;
}

const VARIANT_SUFFIX_RE = /-(?:v|skill-a|skill-b|skill-c|entrance|walk-a|walk-b|broken|tombstone)$/;

function stripVariantSuffixes(visualFrame: string): string {
  let s = visualFrame;
  let prev: string;
  do {
    prev = s;
    s = s.replace(VARIANT_SUFFIX_RE, '');
  } while (s !== prev);
  return s;
}

/**
 * 原图默认是否朝右。批次 1 朝向不统一（犬/尸多朝左，守夜人偏右），
 * 未登记的实体不翻转，避免月步。美术统一朝右后把表扩全。
 */
export function defaultFacesRight(visualFrame: string): boolean | null {
  const base = stripVariantSuffixes(visualFrame);
  if (base === 'player') return true;
  // NV-INTEG-FIX P1：四角色帧表补齐（原仅守夜人 player → 其余三角色不翻转、朝向错位；变体后缀剥离后统一登记）
  if (base === 'hero-edmund' || base === 'hero-cassandra' || base === 'hero-violet' || base === 'hero-galvan') return true;
  return null;
}

function addIdleMovePair(scene: Phaser.Scene, key: string, variant: string, hasFrame: (name: string) => boolean): void {
  const idle = idleAnimKey(key);
  if (scene.anims.exists(idle)) return;
  scene.anims.create({
    key: idle,
    frames: [
      { key: 'characters', frame: key },
      { key: 'characters', frame: variant },
    ],
    frameRate: 1.4,
    yoyo: true,
    repeat: -1,
  });
  const walk = walkCycleFrames(key, hasFrame);
  if (!walk) return;
  scene.anims.create({
    key: moveAnimKey(key),
    frames: walk.map((frame) => ({ key: 'characters', frame })),
    frameRate: 6,
    yoyo: false,
    repeat: -1,
  });
}

/** 为图集里所有「基帧 + -v」建 idle/move；幂等（scene.restart 兼容） */
export function createCharacterAnims(scene: Phaser.Scene): void {
  if (!scene.textures.exists('characters')) return;
  const tex = scene.textures.get('characters');
  for (const key of tex.getFrameNames()) {
    if (
      key.endsWith('-v') ||
      key.endsWith('-skill-a') ||
      key.endsWith('-skill-b') ||
      key.endsWith('-skill-c') ||
      key.endsWith('-entrance') ||
      key.endsWith('-walk-a') ||
      key.endsWith('-walk-b') ||
      key.endsWith('-tombstone')
    ) {
      continue;
    }
    const variant = `${key}-v`;
    if (!tex.has(variant)) continue;
    addIdleMovePair(scene, key, variant, (name) => tex.has(name));
  }
}

/** 移动态判定：Arcade body 速度合量 > 5px/s 视为移动（避免静止/极小漂移抖动换帧） */
function isMoving(sprite: Phaser.Physics.Arcade.Sprite): boolean {
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return false;
  return Math.abs(body.velocity.x) + Math.abs(body.velocity.y) > 5;
}

/** 仅在动画 key 变化时 play（避免每帧重复 play 的开销） */
function playEntity(sprite: Phaser.GameObjects.Sprite, key: string): void {
  const cur = sprite.anims.currentAnim?.key;
  if (!sprite.anims.isPlaying || cur !== key) sprite.play(key, true);
}

export function hasCharacterFrame(scene: Phaser.Scene, name: string): boolean {
  return scene.textures.exists('characters') && scene.textures.get('characters').has(name);
}

function applyFacing(sprite: Phaser.Physics.Arcade.Sprite, visualFrame: string): void {
  if (defaultFacesRight(visualFrame) !== true) return;
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return;
  sprite.setFlipX(facingFlipX(body.velocity.x, sprite.flipX));
}

function holdFrame(sprite: Phaser.GameObjects.Sprite, frame: string): void {
  if (sprite.anims.isPlaying) sprite.anims.stop();
  if (sprite.frame?.name !== frame) sprite.setTexture('characters', frame);
}

function playVisual(sprite: Phaser.GameObjects.Sprite, base: string, moving: boolean, boss = false): void {
  const idle = idleAnimKey(base);
  const move = moveAnimKey(base);
  const scene = sprite.scene;
  if (!boss && scene.anims.exists(move)) {
    playEntity(sprite, moving ? move : idle);
    return;
  }
  if (scene.anims.exists(idle)) {
    playEntity(sprite, idle);
    return;
  }
  // 有静帧无 idle 对（缺 `-v`）→ 钉住该帧；完全缺帧 → no-op，保留上一动画（石甲狼破甲未进仓时不闪 __MISSING）
  if (hasCharacterFrame(scene, base)) holdFrame(sprite, base);
}

/** 玩家：技能姿态叠层优先（不挡移动）；否则 idle（无 walk 帧时移动也播 idle）+ flipX */
export function tickPlayer(player: Player): void {
  applyFacing(player, player.visualFrame);
  const phase = skillPosePhase(player.skillPoseElapsedMs());
  if (phase) {
    const frame = skillPoseFrameName(player.visualFrame, phase);
    if (hasCharacterFrame(player.scene, frame)) {
      holdFrame(player, frame);
      return;
    }
  }
  playVisual(player, player.visualFrame, isMoving(player));
}

/** 敌人：Boss 出场切 `-entrance` 再回 idle；朝向未统一前不翻转。 */
export function tickEnemy(enemy: Enemy): void {
  applyFacing(enemy, enemy.visualFrame);
  const now = enemy.scene.time.now / 1000;
  if (enemy.kind === 'boss' && now < enemy.entranceUntil) {
    const frame = bossEntranceFrameName(enemy.visualFrame);
    if (hasCharacterFrame(enemy.scene, frame)) {
      holdFrame(enemy, frame);
      return;
    }
  }
  playVisual(enemy, enemy.visualFrame, isMoving(enemy), enemy.kind === 'boss');
}
