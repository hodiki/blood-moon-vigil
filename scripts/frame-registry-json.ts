/**
 * scripts/frame-registry-json.ts —— frame-registry.json 序列化构建（export / verify 共用）
 *
 * 输出为**确定性 JSON**（无时间戳）：同一份注册表源码 → 同一字节输出，
 * 可被 CI 直接 diff 提交版本与重新生成版本（content-id-frame-map §8 验收 1）。
 */
import {
  FRAME_BY_CONTENT_ID,
  FRAME_REGISTRY,
  RESERVED_FRAMES,
  ALL_FRAMES,
} from '@/config/frame-registry';

export interface FrameRegistryJson {
  version: number;
  generatedFrom: string;
  atlasGroups: ReadonlyArray<{ atlas: string; frames: readonly string[] }>;
  frameByContentId: Readonly<Record<string, readonly string[]>>;
  reservedFrames: readonly string[];
  allFrames: readonly string[];
}

/** 构建机器可读帧名注册表 JSON（注册表 = content-id-frame-map 交付集子集，由 verify 断言） */
export function buildFrameRegistryJson(): FrameRegistryJson {
  return {
    version: 1,
    generatedFrom: 'src/config/frame-registry.ts',
    atlasGroups: FRAME_REGISTRY.map((g) => ({ atlas: g.atlas, frames: g.frames })),
    frameByContentId: FRAME_BY_CONTENT_ID,
    reservedFrames: RESERVED_FRAMES,
    allFrames: ALL_FRAMES,
  };
}

/** 序列化为 2 空格缩进 JSON 文本 */
export function serializeFrameRegistryJson(data: FrameRegistryJson): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
