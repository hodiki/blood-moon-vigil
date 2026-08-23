/**
 * scripts/export-frame-registry.ts —— 导出 `frame-registry.json`（机器可读帧名注册表）
 *
 * 用法：`npm run frame-registry:export`
 * 输出：项目根 `frame-registry.json`（图集 key → 帧名列表 + 内容 ID ↔ 帧名映射 + 保留帧名）。
 * 用途：M4 资产集成 / CI diff（content-id-frame-map §8 验收 1「注册表 ⊆ 交付集且无多余名」）。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildFrameRegistryJson, serializeFrameRegistryJson } from './frame-registry-json';

const OUT_PATH = resolve(process.cwd(), 'frame-registry.json');

const data = buildFrameRegistryJson();
writeFileSync(OUT_PATH, serializeFrameRegistryJson(data), 'utf8');

// eslint-disable-next-line no-console
console.log(
  `[frame-registry] 已导出 ${OUT_PATH}（atlas ${data.atlasGroups.length} 组 / 帧名 ${data.allFrames.length} 个 / 保留帧名 ${data.reservedFrames.length} 个）`,
);
