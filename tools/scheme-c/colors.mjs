export function topInteriorColors(rgba, width, height, limit = 3) {
  const counts = new Map();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] !== 255) continue;
      const up = rgba[((y - 1) * width + x) * 4 + 3];
      const down = rgba[((y + 1) * width + x) * 4 + 3];
      const left = rgba[(y * width + (x - 1)) * 4 + 3];
      const right = rgba[(y * width + (x + 1)) * 4 + 3];
      if (up !== 255 || down !== 255 || left !== 255 || right !== 255) continue;
      const key = `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ rgb: key.split(',').map(Number), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function parseColors(text) {
  const data = JSON.parse(text);
  const out = {};
  for (const key of ['coat', 'hair', 'metal']) {
    if (typeof data[key] !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(data[key]) || data[key].toLowerCase() === '#000000') {
      throw new Error(key);
    }
    out[key] = data[key];
  }
  return out;
}
