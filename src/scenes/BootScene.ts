/**
 * scenes/BootScene.ts —— 预加载最小资源 → 启动 PlayScene（ARCH §2 / §5）
 *
 * E1 无外部图集（全部程序生成贴图），preload 为空；资源策略见 ARCH §5
 * （characters/effects/ui 三图集在 E2+ 加入时在此预载）。
 *
 * Phase 6 音频接入（audio-bible §4 / ux-spec §1）：
 * - create 时用 Phaser WebAudio 后端初始化 AudioManager（压缩器总线/心跳/SFX 合成）
 * - 启动页「点击开始」= 唯一音频解锁点：回调内 unlock() 后再进 PlayScene
 * - `?smoke=1` 内嵌自检：跳过启动页直接进 Play（L2 冒烟无手势，audio 未解锁即静默 no-op）
 */

import Phaser from 'phaser';
import { AudioManager } from '@/audio/audio-manager';
import { createStartOverlay, type StartOverlay } from '@/ui/start-overlay';
import { detectIsMobile } from '@/utils/device';

export class BootScene extends Phaser.Scene {
  private startOverlay: StartOverlay | null = null;

  constructor() {
    super('Boot');
  }

  preload(): void {
    // E1：无外部资产（ARCH §5 图集在 E2+ 接入）
  }

  create(): void {
    // Phase 6 音频：程序合成引擎（WebAudio 后端，压缩器总线；HTML5Audio 兜底静默降级）
    AudioManager.getInstance().init(this.sound, { isMobile: detectIsMobile() });

    // ?smoke=1 冒烟：跳过手势解锁直接进 Play（PlayScene 内 audio 未解锁 → 全部 no-op 不报错）
    const isSmoke =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('smoke');
    if (isSmoke) {
      this.scene.start('Play');
      return;
    }

    // ux-spec §1：启动页「点击开始」= 唯一音频解锁点（audio-bible §4 硬前提）
    this.startOverlay = createStartOverlay(() => {
      AudioManager.getInstance().unlock();
      this.startOverlay?.destroy();
      this.startOverlay = null;
      this.scene.start('Play');
    });
  }
}
