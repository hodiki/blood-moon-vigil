/**
 * main.ts —— 入口（ARCH §1.1 / §4.2 / §4.3）
 *
 * 顺序：平台检测（最先）→ RuntimeConfig 初始化（全局唯一、只读）→ 创建 Phaser.Game。
 * ?smoke=1 时安装 console.error 捕获（L2 内嵌自检，test-framework §2）。
 */

import Phaser from 'phaser';
import { detectIsMobile } from '@/utils/device';
import { getRuntimeConfig } from '@/config/runtime-config';
import { createGameConfig } from '@/config/game-config';
import { installConsoleErrorCapture } from '@/utils/smoke';

const isSmoke =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('smoke');
if (isSmoke) installConsoleErrorCapture();

const cfg = getRuntimeConfig(detectIsMobile());

/** 调试/冒烟用：当前生效 RuntimeConfig（只读） */
export const runtimeConfig = cfg;

// eslint-disable-next-line no-new
new Phaser.Game(createGameConfig(cfg));
