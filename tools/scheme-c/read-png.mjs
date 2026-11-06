import { createRequire } from 'node:module';

const require = createRequire(new URL('../asset-pipeline/package.json', import.meta.url));
const sharp = require('sharp');

export async function readRgba(pngPath) {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, width: info.width, height: info.height };
}

export async function writeRgba(pngPath, rgba, width, height) {
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(pngPath);
}
