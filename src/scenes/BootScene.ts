/**
 * scenes/BootScene.ts —— 预加载最小资源 → 启动 PlayScene（ARCH §2 / §5）
 *
 * M4：预载外部 `characters` / `effects` 图集。Play 里程序剪影先建同名图集，
 * 再覆盖已到货的实体/特效帧；未到货帧仍走程序剪影。
 *
 * Phase 6 音频接入（audio-bible §4 / ux-spec §1）：
 * - create 时用 Phaser WebAudio 后端初始化 AudioManager（压缩器总线/心跳/SFX 合成）
 * - 启动页「点击开始」= 唯一音频解锁点：回调内 unlock() 后再进 PlayScene
 * - `?smoke=1` 内嵌自检：跳过启动页直接进 Play（L2 冒烟无手势，audio 未解锁即静默 no-op）
 */

import Phaser from 'phaser';
import { AudioManager } from '@/audio/audio-manager';
import { createStartOverlay, unlockFromSave, type StartOverlay } from '@/ui/start-overlay';
import { loadSave } from '@/stats/save';
import { detectIsMobile } from '@/utils/device';
import { EXTERNAL_CHARACTERS_KEY, EXTERNAL_EFFECTS_KEY } from '@/fx/external-atlas';

export class BootScene extends Phaser.Scene {
  private startOverlay: StartOverlay | null = null;

  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.atlas(EXTERNAL_CHARACTERS_KEY, 'atlas/characters.png', 'atlas/characters.json');
    this.load.atlas(EXTERNAL_EFFECTS_KEY, 'atlas/effects.png', 'atlas/effects.json');
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
    // E4-S9：地图选择最小 UI（读局外存档解锁状态；图鉴/功绩 UI 归 M3，start-overlay 功能行消费 save）
    const saveData = loadSave(window.localStorage, detectIsMobile() ? 'mobile' : 'desktop');
    this.startOverlay = createStartOverlay(
      () => {
        AudioManager.getInstance().unlock();
        this.startOverlay?.destroy();
        this.startOverlay = null;
        this.scene.start('Play');
      },
      { unlock: unlockFromSave(saveData), save: saveData },
    );
  }
}
