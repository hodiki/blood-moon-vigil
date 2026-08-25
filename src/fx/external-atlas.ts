/**
 * fx/external-atlas.ts —— M4：外部图集覆盖同名程序帧
 *
 * 程序剪影先建 `characters`（飞弹/环绕球等批次 2 未到的帧仍在）。
 * Boot 预载的 `characters-ext` 整张 PNG 挂成第二源，再按图集 JSON 覆盖同名帧。
 * 图集 key / 帧名不变，实体代码只认 `characters` + 帧名。
 * 未预载或缺图时整段 no-op，局内继续用程序剪影。
 */

import Phaser from 'phaser';

export const EXTERNAL_CHARACTERS_KEY = 'characters-ext';
const MERGED_FLAG = 'ext-characters-merged';

export function applyExternalCharacterFrames(scene: Phaser.Scene): void {
  if (scene.game.registry.get(MERGED_FLAG)) return;
  if (!scene.textures.exists(EXTERNAL_CHARACTERS_KEY)) return;
  if (!scene.textures.exists('characters')) return;

  const packed = scene.textures.get(EXTERNAL_CHARACTERS_KEY);
  const dest = scene.textures.get('characters');
  const image = packed.source[0]?.image as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!image) return;

  const TextureSource = (Phaser.Textures as unknown as {
    TextureSource: new (texture: Phaser.Textures.Texture, source: HTMLImageElement | HTMLCanvasElement) => unknown;
  }).TextureSource;
  dest.source.push(new TextureSource(dest, image) as (typeof dest.source)[number]);
  const sourceIndex = dest.source.length - 1;

  let replaced = 0;
  for (const name of packed.getFrameNames()) {
    const src = packed.get(name);
    if (!src || src.cutWidth <= 0 || src.cutHeight <= 0) continue;
    if (dest.has(name)) dest.remove(name);
    dest.add(name, sourceIndex, src.cutX, src.cutY, src.cutWidth, src.cutHeight);
    replaced += 1;
  }

  scene.game.registry.set(MERGED_FLAG, true);
  if (replaced > 0) {
    console.info(`[atlas] 外部 characters 覆盖 ${replaced} 帧（缺帧仍用程序剪影）`);
  }
}

/** 图集里有该帧就用，否则回退（外部图未载入时走程序剪影名） */
export function resolveCharacterFrame(scene: Phaser.Scene, name: string, fallback = 'player'): string {
  if (!scene.textures.exists('characters')) return fallback;
  return scene.textures.get('characters').has(name) ? name : fallback;
}
