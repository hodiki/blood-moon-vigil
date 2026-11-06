// Keep an interior from a rendered/detailed frame but force the silhouette to
// come from a block frame. This is the anti-drift step in the "C shapes it, A
// paints it" workflow: whatever the paint pass does to the outline, height and
// foot line are decided by the block and cannot move.
//
//   node tools/scheme-c/silhouette-lock.mjs <interior.png> <mask.png> <out.png>
//
// Pixels inside the mask keep the interior colour. Pixels the mask has but the
// interior does not are filled with their nearest interior colour, so the lock
// never punches holes.
import { readRgba, writeRgba } from './read-png.mjs';

export function silhouetteLock(interior, mask, fill = [58, 31, 36]) {
  if (interior.width !== mask.width || interior.height !== mask.height) throw new Error('size mismatch');
  const W = interior.width;
  const out = Buffer.alloc(interior.rgba.length, 0);
  let kept = 0, filled = 0, dropped = 0;
  for (let i = 0; i < interior.rgba.length; i += 4) {
    const inside = mask.rgba[i + 3] === 255;
    const hasPaint = interior.rgba[i + 3] === 255;
    if (!inside) { if (hasPaint) dropped++; continue; }
    if (hasPaint) {
      out[i] = interior.rgba[i];
      out[i + 1] = interior.rgba[i + 1];
      out[i + 2] = interior.rgba[i + 2];
      kept++;
    } else {
      out[i] = fill[0];
      out[i + 1] = fill[1];
      out[i + 2] = fill[2];
      filled++;
    }
    out[i + 3] = 255;
  }
  return { rgba: out, width: W, height: interior.height, kept, filled, dropped };
}

if (process.argv[1]?.endsWith('silhouette-lock.mjs')) {
  const [interiorPath, maskPath, outPath] = process.argv.slice(2);
  if (!interiorPath || !maskPath || !outPath) {
    console.error('usage: node tools/scheme-c/silhouette-lock.mjs <interior.png> <mask.png> <out.png>');
    process.exit(1);
  }
  const interior = await readRgba(interiorPath);
  const mask = await readRgba(maskPath);
  const locked = silhouetteLock(interior, mask);
  await writeRgba(outPath, locked.rgba, locked.width, locked.height);
  console.log(JSON.stringify({ kept: locked.kept, filled: locked.filled, dropped: locked.dropped }));
}
