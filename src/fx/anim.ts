/**
 * fx/anim.ts —— 角色 2 帧循环（TASK-28 + M4 按实际帧名播）
 *
 * 原则：基准帧与变体帧（`*-v`）同处 'characters' 图集。
 * `-v` 可选：有则 idle 1.4fps yoyo；无则单帧钉住基帧。没有走帧时不要用 idle 变体当走路。
 * 走循环：a–f 齐则 6 帧（序 a,e,b,c,f,d，8fps）；a–d 则 4 帧 6fps；只有 a/b 则 2 帧 6fps。
 * 方向：asset-spec 只出一朝向，横移用 flipX（默认帧朝右，vx<0 镜像）。
 */

import Phaser from 'phaser';
import type { Player } from '@/player/player';
import type { Enemy } from '@/enemies/enemy';
import { applyCombatDisplayScale } from '@/fx/combat-display-scale';
import { bossEntranceFrameName, skillPoseFrameName, skillPosePhase } from '@/fx/skill-pose';

/** 小于此水平速度（px/s）保持上一朝向，避免原地抖动翻面 */
export const FACING_DEADZONE = 8;

export function idleAnimKey(frame: string): string {
  return `${frame}-idle`;
}

export function moveAnimKey(frame: string): string {
  return `${frame}-move`;
}

export function walkStartAnimKey(frame: string): string {
  return `${frame}-walk-start`;
}

/** 离站一帧：有 `walk-s` 时，从 idle 切到走循环前播一次。 */
export function walkStartFrame(base: string, hasFrame: (name: string) => boolean): string | null {
  const s = `${base}-walk-s`;
  return hasFrame(s) ? s : null;
}

/** 有正式步态帧才建 move。6 帧序：接触→落下→经过→对侧接触→落下→经过。 */
export function walkCycleFrames(base: string, hasFrame: (name: string) => boolean): string[] | null {
  const a = `${base}-walk-a`;
  const b = `${base}-walk-b`;
  const c = `${base}-walk-c`;
  const d = `${base}-walk-d`;
  const e = `${base}-walk-e`;
  const f = `${base}-walk-f`;
  if ([a, b, c, d, e, f].every(hasFrame)) return [a, e, b, c, f, d];
  if ([a, b, c, d].every(hasFrame)) return [a, b, c, d];
  if (hasFrame(a) && hasFrame(b)) return [a, b];
  return null;
}

export function walkFrameRate(frames: string[]): number {
  return frames.length >= 6 ? 8 : 6;
}

/** idle 循环：有 `-v` 才两帧呼吸；否则单帧（C 已锁不做 1–2px 呼吸）。 */
export function idleCycleFrames(base: string, hasFrame: (name: string) => boolean): string[] {
  const variant = `${base}-v`;
  if (hasFrame(variant)) return [base, variant];
  return [base];
}

/** 帧朝右：vx>deadzone → 不翻转；vx<-deadzone → 翻转。竖移保持 current。 */
export function facingFlipX(vx: number, current: boolean, deadzone = FACING_DEADZONE): boolean {
  if (vx > deadzone) return false;
  if (vx < -deadzone) return true;
  return current;
}

const VARIANT_SUFFIX_RE = /-(?:v|skill-a|skill-b|skill-c|entrance|walk-[a-fs]|broken|tombstone)$/;

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
  if (base === 'hero-edmund' || base === 'hero-cassandra' || base === 'hero-violet' || base === 'hero-violet-fallen' || base === 'hero-galvan') return true;
  return null;
}

function addIdleMovePair(scene: Phaser.Scene, key: string, hasFrame: (name: string) => boolean): void {
  const idle = idleAnimKey(key);
  const walk = walkCycleFrames(key, hasFrame);
  const idleFrames = idleCycleFrames(key, hasFrame);
  if (!hasFrame(key)) return;
  if (idleFrames.length < 2 && !walk) return;
  if (!scene.anims.exists(idle)) {
    scene.anims.create({
      key: idle,
      frames: idleFrames.map((frame) => ({ key: 'characters', frame })),
      frameRate: 1.4,
      yoyo: idleFrames.length > 1,
      repeat: -1,
    });
  }
  if (!walk || scene.anims.exists(moveAnimKey(key))) return;
  scene.anims.create({
    key: moveAnimKey(key),
    frames: walk.map((frame) => ({ key: 'characters', frame })),
    frameRate: walkFrameRate(walk),
    yoyo: false,
    repeat: -1,
  });
  const start = walkStartFrame(key, hasFrame);
  const startKey = walkStartAnimKey(key);
  if (start && !scene.anims.exists(startKey)) {
    scene.anims.create({
      key: startKey,
      frames: [{ key: 'characters', frame: start }],
      frameRate: 6,
      repeat: 0,
    });
  }
}

/** 为图集角色建 idle/move；`-v` 不是建 walk 的前提。幂等（scene.restart 兼容） */
export function createCharacterAnims(scene: Phaser.Scene): void {
  if (!scene.textures.exists('characters')) return;
  const tex = scene.textures.get('characters');
  const hasFrame = (name: string) => tex.has(name);
  for (const key of tex.getFrameNames()) {
    if (
      key.endsWith('-v') ||
      key.endsWith('-skill-a') ||
      key.endsWith('-skill-b') ||
      key.endsWith('-skill-c') ||
      key.endsWith('-entrance') ||
      key.endsWith('-walk-a') ||
      key.endsWith('-walk-b') ||
      key.endsWith('-walk-c') ||
      key.endsWith('-walk-d') ||
      key.endsWith('-walk-e') ||
      key.endsWith('-walk-f') ||
      key.endsWith('-walk-s') ||
      key.endsWith('-tombstone')
    ) {
      continue;
    }
    addIdleMovePair(scene, key, hasFrame);
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
    const start = walkStartAnimKey(base);
    const cur = sprite.anims.currentAnim?.key;
    if (moving) {
      if (scene.anims.exists(start) && (cur === idle || !sprite.anims.isPlaying)) {
        playEntity(sprite, start);
        return;
      }
      if (cur === start && sprite.anims.isPlaying) return;
      playEntity(sprite, move);
      return;
    }
    playEntity(sprite, idle);
    return;
  }
  if (scene.anims.exists(idle)) {
    playEntity(sprite, idle);
    return;
  }
  // 无 idle 动画（无 `-v` 且无 walk 的投射物等）→ 钉住基帧；完全缺帧 → no-op
  if (hasCharacterFrame(scene, base)) holdFrame(sprite, base);
}

/** 玩家：技能姿态叠层优先（不挡移动）；否则 idle（无 walk 帧时移动也播 idle）+ flipX */
export function tickPlayer(player: Player): void {
  applyFacing(player, player.visualFrame);
  const phase = skillPosePhase(player.skillPoseElapsedMs(), player.skillPosePlay());
  if (phase) {
    const frame = skillPoseFrameName(player.visualFrame, phase);
    if (hasCharacterFrame(player.scene, frame)) {
      holdFrame(player, frame);
      applyCombatDisplayScale(player, player.combatRageMult);
      return;
    }
  }
  const moving = isMoving(player);
  const stance = player.weaponStancePhase();
  if (stance && !moving) {
    const frame = skillPoseFrameName(player.visualFrame, stance);
    if (hasCharacterFrame(player.scene, frame)) {
      holdFrame(player, frame);
      applyCombatDisplayScale(player, player.combatRageMult);
      return;
    }
  }
  playVisual(player, player.visualFrame, moving);
  applyCombatDisplayScale(player, player.combatRageMult);
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
