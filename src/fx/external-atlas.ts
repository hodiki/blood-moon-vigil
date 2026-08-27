/**
 * fx/external-atlas.ts —— 外部图集覆盖同名程序帧
 *
 * 程序剪影先建 `characters` / `effects` / `fx-ambient`。
 * Boot 预载 `characters-ext` / `effects-ext`，再按图集 JSON 覆盖或追加同名帧。
 * 图集 key / 帧名不变。未预载或缺图时整段 no-op。
 *
 * 批次 3：tile-* 打进 effects 后还要盖到独立 canvas（TileSprite 用纹理 key，不是图集帧）。
 */

import Phaser from 'phaser';
import { pickWeaponVisual } from '@/fx/fx-spec';
import { TILE } from '@/config/balance';

export const EXTERNAL_CHARACTERS_KEY = 'characters-ext';
export const EXTERNAL_EFFECTS_KEY = 'effects-ext';

const CHAR_MERGED_FLAG = 'ext-characters-merged';
const FX_MERGED_FLAG = 'ext-effects-merged';

const STANDALONE_TILES = [
  'tile-ground',
  'tile-grass',
  'tile-grave-soil',
  'tile-church-stone',
  'tile-church-carpet',
  'tile-den-earth',
  'tile-den-grass',
  'tile-obstacle',
  'tile-trap',
] as const;

export function sceneHasFrame(scene: Phaser.Scene, atlas: string, frame: string): boolean {
  return scene.textures.exists(atlas) && scene.textures.get(atlas).has(frame);
}

export function sceneWeaponVisual(
  scene: Phaser.Scene,
  preferred: string,
  fallback: string,
): { atlas: string; frame: string; dedicated: boolean } {
  return pickWeaponVisual((atlas, frame) => sceneHasFrame(scene, atlas, frame), preferred, fallback);
}

export function applyExternalCharacterFrames(scene: Phaser.Scene): void {
  if (scene.game.registry.get(CHAR_MERGED_FLAG)) return;
  const n = mergePackedFrames(scene, EXTERNAL_CHARACTERS_KEY, 'characters');
  scene.game.registry.set(CHAR_MERGED_FLAG, true);
  if (n > 0) {
    console.info(`[atlas] 外部 characters 覆盖 ${n} 帧（缺帧仍用程序剪影）`);
  }
}

export function applyExternalEffectsFrames(scene: Phaser.Scene): void {
  if (scene.game.registry.get(FX_MERGED_FLAG)) return;
  const nEffects = mergePackedFrames(scene, EXTERNAL_EFFECTS_KEY, 'effects');
  const nAmbient = mergePackedFrames(
    scene,
    EXTERNAL_EFFECTS_KEY,
    'fx-ambient',
    (name) => name.startsWith('marker-') || name.startsWith('skill-ring-'),
  );
  const copyToEffects = new Set([
    'shockwave',
    'ring-bloodpool',
    'ring-holyfire',
    'aura-barrier',
    'super-totaleclipse',
    'super-bloodsea',
  ]);
  const nCopy = mergePackedFrames(scene, EXTERNAL_CHARACTERS_KEY, 'effects', (name) => copyToEffects.has(name));
  const nTiles = stampExternalTiles(scene);
  scene.game.registry.set(FX_MERGED_FLAG, true);
  if (nEffects + nAmbient + nCopy + nTiles > 0) {
    const extra = nCopy > 0 ? `，${nCopy} 帧环/冲击波→effects` : '';
    const tiles = nTiles > 0 ? `，tile 画布 ${nTiles}` : '';
    console.info(`[atlas] 外部 effects 覆盖 ${nEffects} 帧，标记/技能环 ${nAmbient} 帧${extra}${tiles}`);
  }
}

/** 图集里有该帧就用，否则回退（外部图未载入时走程序剪影名） */
export function resolveCharacterFrame(scene: Phaser.Scene, name: string, fallback = 'player'): string {
  if (!scene.textures.exists('characters')) return fallback;
  return scene.textures.get('characters').has(name) ? name : fallback;
}

function mergePackedFrames(
  scene: Phaser.Scene,
  packedKey: string,
  destKey: string,
  filter?: (name: string) => boolean,
): number {
  if (!scene.textures.exists(packedKey) || !scene.textures.exists(destKey)) return 0;

  const packed = scene.textures.get(packedKey);
  const dest = scene.textures.get(destKey);
  const image = packed.source[0]?.image as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!image) return 0;

  const names = packed.getFrameNames().filter((name) => !filter || filter(name));
  if (names.length === 0) return 0;

  const TextureSource = (Phaser.Textures as unknown as {
    TextureSource: new (texture: Phaser.Textures.Texture, source: HTMLImageElement | HTMLCanvasElement) => unknown;
  }).TextureSource;
  dest.source.push(new TextureSource(dest, image) as (typeof dest.source)[number]);
  const sourceIndex = dest.source.length - 1;

  let replaced = 0;
  for (const name of names) {
    const src = packed.get(name);
    if (!src || src.cutWidth <= 0 || src.cutHeight <= 0) continue;
    if (dest.has(name)) dest.remove(name);
    dest.add(name, sourceIndex, src.cutX, src.cutY, src.cutWidth, src.cutHeight);
    replaced += 1;
  }
  return replaced;
}

function isCanvasTexture(tex: Phaser.Textures.Texture): tex is Phaser.Textures.CanvasTexture {
  const candidate = tex as Phaser.Textures.CanvasTexture;
  return typeof candidate.getContext === 'function' && typeof candidate.refresh === 'function';
}

/** TileSprite 读独立 canvas key；把 effects-ext 同名帧盖上去（缺帧 no-op） */
function stampPackedFrameOntoCanvas(
  scene: Phaser.Scene,
  packedKey: string,
  frameName: string,
  destKey: string,
): boolean {
  if (!scene.textures.exists(packedKey) || !scene.textures.exists(destKey)) return false;
  const packed = scene.textures.get(packedKey);
  if (!packed.has(frameName)) return false;
  const dest = scene.textures.get(destKey);
  if (!isCanvasTexture(dest)) return false;
  const image = packed.source[0]?.image as CanvasImageSource | undefined;
  if (!image) return false;
  const src = packed.get(frameName);
  if (!src || src.cutWidth <= 0 || src.cutHeight <= 0) return false;
  const ctx = dest.getContext();
  const w = dest.width || TILE.SIZE;
  const h = dest.height || TILE.SIZE;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, src.cutX, src.cutY, src.cutWidth, src.cutHeight, 0, 0, w, h);
  dest.refresh();
  return true;
}

function stampExternalTiles(scene: Phaser.Scene): number {
  let n = 0;
  for (const name of STANDALONE_TILES) {
    if (stampPackedFrameOntoCanvas(scene, EXTERNAL_EFFECTS_KEY, name, name)) n += 1;
  }
  if (stampPackedFrameOntoCanvas(scene, EXTERNAL_EFFECTS_KEY, 'tile-obstacle', 'blocker')) n += 1;
  return n;
}
