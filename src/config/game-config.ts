/**
 * config/game-config.ts —— Phaser.Game 配置（ARCH §4.3 / art-bible §8）
 *
 * - 双设计分辨率：桌面 1920×1080 / 移动 720×1280，Scale.FIT + CENTER_BOTH
 * - WebGL 优先、Canvas 兜底（type: AUTO）
 * - Arcade 物理 fixedStep 60Hz（ARCH §3.5）
 * - render: antialias:false + pixelArt:true（2D 剪影风格关抗锯齿更锐利）
 * - backgroundColor #0B0E14（墨夜蓝黑，禁纯黑）
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import { PALETTE } from '@/config/balance';
import { BootScene } from '@/scenes/BootScene';
import { PlayScene } from '@/scenes/PlayScene';

export function createGameConfig(cfg: RuntimeConfig): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    width: cfg.designWidth,
    height: cfg.designHeight,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: PALETTE.base,
    physics: {
      default: 'arcade',
      arcade: {
        fixedStep: true,
        debug: false,
      },
    },
    render: {
      antialias: false,
      pixelArt: true,
    },
    scene: [BootScene, PlayScene],
  };
}
