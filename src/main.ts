/**
 * main.ts —— 入口（ARCH §1.1 / §4.2 / §4.3）
 *
 * 顺序：平台检测（最先）→ RuntimeConfig 初始化（全局唯一、只读）→ 创建 Phaser.Game。
 * ?smoke=1 时安装 console.error 捕获（L2 内嵌自检，test-framework §2）。
 * ?qa=1 时安装 window.__BMV_QA 控制台测试辅助（unlockAll/setHero/setMap/status，
 * 见 utils/qa-helper.ts；不带参数零暴露，生产玩家不可见作弊入口）。
 */

import Phaser from 'phaser';
import { detectIsMobile } from '@/utils/device';
import { getRuntimeConfig } from '@/config/runtime-config';
import { createGameConfig } from '@/config/game-config';
import { installConsoleErrorCapture } from '@/utils/smoke';
import { installQaHelper, type QaHelper } from '@/utils/qa-helper';
import { syncOverlayToCanvas } from '@/ui/overlay-scale';

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
if (params.has('smoke')) installConsoleErrorCapture();

const cfg = getRuntimeConfig(detectIsMobile());

/** 调试/冒烟用：当前生效 RuntimeConfig（只读） */
export const runtimeConfig = cfg;

// eslint-disable-next-line no-new
const game = new Phaser.Game(createGameConfig(cfg));
if (import.meta.env.DEV) {
  (window as unknown as { __BMV_GAME__?: Phaser.Game }).__BMV_GAME__ = game;
}

// QA-FIX-2 B：仅 `?qa=1` 时暴露控制台测试辅助（unlockAll/setHero/setMap/status）
if (params.has('qa')) {
  (window as unknown as { __BMV_QA__?: QaHelper }).__BMV_QA__ = installQaHelper(
    window.localStorage,
    detectIsMobile() ? 'mobile' : 'desktop',
  );
}

// TASK-43 P0：DOM 覆盖层（HUD/升级卡/结算页）与 Scale.FIT 画布对齐 —— 底部 HUD（HP 条）
// 在视口高度 < 设计高（1080）时不再落到可视区外；首次 + 画布/窗口尺寸变化时同步。
syncOverlayToCanvas(game);
game.scale.on(Phaser.Scale.Events.RESIZE, () => syncOverlayToCanvas(game));
window.addEventListener('resize', () => syncOverlayToCanvas(game));
