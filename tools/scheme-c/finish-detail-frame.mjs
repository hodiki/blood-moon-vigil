// Lock a detail pass to the blockout's silhouette, then box it down to 64/128.
//
//   node tools/scheme-c/finish-detail-frame.mjs <raw.png> <blockout512.png> <outDir> <frame>
//
// The detail pass may round off corners and shrink the figure; this step does
// not care. Silhouette, height and foot line come from the blockout, so ten
// frames of a set stay on the same row whatever the painter did.
import fs from 'node:fs';
import path from 'node:path';
import { coverageDown } from './coverage-down.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

const [rawPath, blockPath, outDir, frame] = process.argv.slice(2);
if (!rawPath || !blockPath || !outDir || !frame) {
  console.error('usage: node tools/scheme-c/finish-detail-frame.mjs <raw.png> <blockout512.png> <outDir> <frame>');
  process.exit(1);
}

const raw = await readRgba(rawPath);
const block = await readRgba(blockPath);
if (raw.width !== block.width || raw.height !== block.height) throw new Error('size mismatch');

const locked = Buffer.alloc(block.rgba.length, 0);
let kept = 0, filled = 0, dropped = 0;
for (let i = 0; i < block.rgba.length; i += 4) {
  const inside = block.rgba[i + 3] === 255;
  const painted = raw.rgba[i + 3] >= 128;
  if (!inside) {
    if (painted) dropped++;
    continue;
  }
  if (painted) {
    locked[i] = raw.rgba[i];
    locked[i + 1] = raw.rgba[i + 1];
    locked[i + 2] = raw.rgba[i + 2];
    kept++;
  } else {
    // The painter left this pixel empty; fall back to the blockout colour so the
    // lock never punches a hole in the silhouette.
    locked[i] = block.rgba[i];
    locked[i + 1] = block.rgba[i + 1];
    locked[i + 2] = block.rgba[i + 2];
    filled++;
  }
  locked[i + 3] = 255;
}

const box128 = raw.width / 128;
const box64 = raw.width / 64;
for (const [sub, factor] of [['src-locked', 1], ['x128', box128], ['x64', box64]]) {
  const dir = path.join(outDir, sub);
  fs.mkdirSync(dir, { recursive: true });
  if (factor === 1) {
    await writeRgba(path.join(dir, `${frame}.png`), locked, raw.width, raw.height);
  } else {
    const boxed = coverageDown(locked, raw.width, raw.height, factor);
    await writeRgba(path.join(dir, `${frame}.png`), boxed.rgba, boxed.width, boxed.height);
  }
}
console.log(JSON.stringify({ frame, kept, filled, dropped, ratioKept: +(kept / (kept + filled)).toFixed(3) }));
