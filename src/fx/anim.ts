/**
 * fx/anim.ts —— 角色程序动画（TASK-28 美术表现力专项 · 2 帧循环）
 *
 * 原则：不加资源、不加贴图批次 —— 基准帧与变体帧（`*-v`）同处 'characters' 图集，
 * 用 Phaser anims 在「基准 ↔ 变体」间切换，仅节奏不同：
 * - idle：慢速（1.4fps yoyo）＝ 呼吸/披风微动
 * - move：快速（9fps yoyo）＝ 移动摆动/脚步节奏
 * 同一变体帧复用于 idle 与 move，帧数省半（5 变体帧覆盖 5 实体）。
 * 纪律：普通敌移动用 move、Boss 恒用 idle（慢速巨体不做快速 bob）；
 * 实体零逻辑改动 —— PlayScene 在 update 转发时调用 tick，只读 body.velocity 判断移动态。
 */

import Phaser from 'phaser';
import type { Player } from '@/player/player';
import type { Enemy } from '@/enemies/enemy';

const ENTITY_KINDS = ['player', 'zombie', 'wolf', 'tank', 'boss'] as const;

/** 创建 5 实体 × 2 动画（idle/move）；幂等（scene.restart 兼容） */
export function createCharacterAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists('player-idle')) return;
  for (const kind of ENTITY_KINDS) {
    const key = kind === 'player' ? 'player' : `enemy-${kind}`;
    const variant = `${key}-v`;
    scene.anims.create({
      key: `${key}-idle`,
      frames: [
        { key: 'characters', frame: key },
        { key: 'characters', frame: variant },
      ],
      frameRate: 1.4,
      yoyo: true,
      repeat: -1,
    });
    scene.anims.create({
      key: `${key}-move`,
      frames: [
        { key: 'characters', frame: key },
        { key: 'characters', frame: variant },
      ],
      frameRate: 9,
      yoyo: true,
      repeat: -1,
    });
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

/** 玩家：移动态 → player-move，否则 player-idle */
export function tickPlayer(player: Player): void {
  playEntity(player, isMoving(player) ? 'player-move' : 'player-idle');
}

/** 敌人：普通 3 敌按移动态切换；Boss 恒 idle（慢速披风摆动） */
export function tickEnemy(enemy: Enemy): void {
  if (enemy.kind === 'boss') {
    playEntity(enemy, 'enemy-boss-idle');
    return;
  }
  playEntity(enemy, isMoving(enemy) ? `enemy-${enemy.kind}-move` : `enemy-${enemy.kind}-idle`);
}
