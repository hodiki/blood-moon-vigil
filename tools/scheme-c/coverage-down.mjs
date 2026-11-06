// Downsample a hard-alpha RGBA buffer by cell coverage.
// A cell is kept only when at least half of its factor x factor samples are
// opaque; the kept color is the most frequent opaque color inside the cell.
// Point sampling (nearest-down.mjs) throws away any sliver that does not sit
// under the chosen sample, which is what made scheme-c lose 1px-wide parts.
export function coverageDown(rgba, width, height, factor) {
  if (![4, 8, 16].includes(factor)) throw new Error('factor must be 4, 8 or 16');
  if (width % factor !== 0 || height % factor !== 0) throw new Error('size not divisible by factor');
  const dw = width / factor;
  const dh = height / factor;
  const out = Buffer.alloc(dw * dh * 4, 0);
  const need = Math.ceil((factor * factor) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const colors = new Map();
      let opaque = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const si = ((y * factor + dy) * width + (x * factor + dx)) * 4;
          if (rgba[si + 3] < 128) continue;
          opaque += 1;
          const key = `${rgba[si]},${rgba[si + 1]},${rgba[si + 2]}`;
          colors.set(key, (colors.get(key) || 0) + 1);
        }
      }
      if (opaque < need) continue;
      let best = null;
      let count = 0;
      for (const [key, n] of colors) {
        if (n > count) {
          best = key;
          count = n;
        }
      }
      const [r, g, b] = best.split(',').map(Number);
      const di = (y * dw + x) * 4;
      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
      out[di + 3] = 255;
    }
  }
  return { rgba: out, width: dw, height: dh };
}
