export function nearestDown(rgba, width, height, factor) {
  if (factor !== 4 && factor !== 8) throw new Error('factor');
  if (width % factor !== 0 || height % factor !== 0) throw new Error('size not divisible by ' + factor);
  for (let i = 3; i < rgba.length; i += 4) {
    const alpha = rgba[i];
    if (alpha !== 0 && alpha !== 255) throw new Error('partial alpha');
  }
  const dw = width / factor;
  const dh = height / factor;
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const si = ((y * factor) * width + (x * factor)) * 4;
      const di = (y * dw + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { rgba: out, width: dw, height: dh };
}

export function nearestDown4(rgba, width, height) {
  return nearestDown(rgba, width, height, 4);
}

export function nearestDown8(rgba, width, height) {
  return nearestDown(rgba, width, height, 8);
}
