/**
 * scripts/verify-frame-registry.ts —— CI 帧名注册表 diff（content-id-frame-map §8 验收 1）
 *
 * 用法：`npm run frame-registry:ci`
 * 检查：
 * 1. 注册表 ⊆ 交付集且无多余名（ALL_FRAMES 每个帧名都在 content-id-frame-map 交付集内）。
 * 2. 保留帧名未改名（RESERVED_FRAMES ⊆ 交付集）。
 * 3. 注册表去重 / 图集分区不重不漏（并集 = ALL_FRAMES）。
 * 4. 同步导出 `frame-registry.json`（与 export 脚本同源，确定性输出）。
 *
 * 任一检查失败 → 打印差异并 exit 1（CI 门禁；无多余名 / 无缺失）。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FRAME_REGISTRY,
  RESERVED_FRAMES,
  ALL_FRAMES,
} from '@/config/frame-registry';
import { FRAME_DELIVERY_SET } from './frame-delivery-set';
import { buildFrameRegistryJson, serializeFrameRegistryJson } from './frame-registry-json';

const OUT_PATH = resolve(process.cwd(), 'frame-registry.json');
const delivery = new Set<string>(FRAME_DELIVERY_SET);

const failures: string[] = [];

function fail(message: string): void {
  failures.push(message);
  // eslint-disable-next-line no-console
  console.error(`  ✗ ${message}`);
}

// ---- 检查 1：注册表 ⊆ 交付集且无多余名 ----
const extra = ALL_FRAMES.filter((f) => !delivery.has(f));
if (extra.length > 0) {
  fail(`注册表含交付集外多余帧名 ${extra.length} 个: ${extra.join(', ')}`);
}

// ---- 检查 2：保留帧名未改名（⊆ 交付集）----
const reservedMissing = RESERVED_FRAMES.filter((f) => !delivery.has(f));
if (reservedMissing.length > 0) {
  fail(`保留帧名不在交付集内 ${reservedMissing.length} 个: ${reservedMissing.join(', ')}`);
}

// ---- 检查 3：去重 + 三图集分区不重不漏 ----
const atlasNames = FRAME_REGISTRY.flatMap((g) => g.frames);
if (new Set(atlasNames).size !== ALL_FRAMES.length || atlasNames.length !== ALL_FRAMES.length) {
  fail('图集注册表分区存在重复/遗漏（并集 ≠ ALL_FRAMES）');
}
if (new Set(FRAME_REGISTRY.map((g) => g.atlas)).size !== FRAME_REGISTRY.length) {
  fail('图集 key 重复');
}

// ---- 同步导出 frame-registry.json（确定性）----
const json = buildFrameRegistryJson();
writeFileSync(OUT_PATH, serializeFrameRegistryJson(json), 'utf8');

if (failures.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`[frame-registry:ci] FAIL ${failures.length} 项（content-id-frame-map §8 验收 1）`);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(
  `[frame-registry:ci] PASS：注册表 ⊆ 交付集且无多余名（帧名 ${ALL_FRAMES.length} / 保留 ${RESERVED_FRAMES.length} / 交付集唯一 ${new Set(FRAME_DELIVERY_SET).size}）· 已导出 ${OUT_PATH}`,
);
