import sharp from 'sharp';
import { quantizePixels } from './tokens.mjs';

const src = process.argv[2];
const dst = process.argv[3];
if (!src || !dst) {
  console.error('usage: node quantize-png.mjs <in.png> <out.png>');
  process.exit(1);
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = new Uint8Array(data);
quantizePixels(rgba, { allowGrass: false });
await sharp(Buffer.from(rgba), {
  raw: { width: info.width, height: info.height, channels: 4 },
}).png().toFile(dst);
