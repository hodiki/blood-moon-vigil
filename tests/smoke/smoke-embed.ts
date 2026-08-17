/**
 * tests/smoke/smoke-embed.ts —— L2 内嵌自检断言清单（test-framework §2/§3.2）
 *
 * 本文件只声明判定规则，供测试与人工对照；实际采集逻辑在 src/utils/smoke.ts
 * （由 src/scenes/PlayScene.ts 在 `?smoke=1` 时执行）。
 * 判定规则：framesAdvanced === true && sceneReady === true && consoleErrors.length === 0
 */

import type { SmokeResult } from '@/utils/smoke';

export interface SmokeAssertion {
  id: string;
  description: string;
  pass: (r: SmokeResult) => boolean;
}

export const SMOKE_ASSERTIONS: SmokeAssertion[] = [
  {
    id: 'S1-frames',
    description: '连续 60 帧 rAF 帧号递增（引擎主循环在跑，E1-S1 验收 #3）',
    pass: (r) => r.framesAdvanced && r.frame >= 60,
  },
  {
    id: 'S2-scene',
    description: 'PlayScene 装配完成：GameState=RUNNING 且 Player active（E1-S1 验收 #3）',
    pass: (r) => r.sceneReady,
  },
  {
    id: 'S3-no-console-error',
    description: '控制台无 console.error / 未捕获异常（E1-S1 验收 #4）',
    pass: (r) => r.consoleErrors.length === 0,
  },
];

export function isSmokePass(result: SmokeResult): boolean {
  return SMOKE_ASSERTIONS.every((a) => a.pass(result));
}
