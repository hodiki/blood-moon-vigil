// Precision report for a 64px scheme-c frame against the live frame it replaces.
// Answers "how much detail did the block lose" with numbers instead of taste.
//
//   node tools/scheme-c/precision-report.mjs [livePng] [blockPng]
//
// Metrics:
//   mean |dL|          average luminance step between 4-neighbours. The single
//                      best proxy for "this reads as detailed" at 64 px.
//   colours in 3x3     average distinct colours in a 3x3 window.
//   edge%              share of opaque pixels that touch a different colour.
//   islands            connected same-colour patches (dithering counts).
//   palette            distinct RGB values.
import { readRgba } from './read-png.mjs';

const lumOf = (rgba, i) => 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];

export function frameStats(img) {
  const { rgba, width: W, height: H } = img;
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && rgba[(y * W + x) * 4 + 3] === 255;
  const key = (x, y) => {
    const i = (y * W + x) * 4;
    return `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`;
  };
  const palette = new Set();
  let opaque = 0, edges = 0, dL = 0, dLn = 0, colors3 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      opaque++;
      palette.add(key(x, y));
      let diff = 0;
      const win = new Set();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (on(x + dx, y + dy)) win.add(key(x + dx, y + dy));
      }
      colors3 += win.size;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (!on(x + dx, y + dy)) continue;
        if (key(x + dx, y + dy) !== key(x, y)) diff++;
        if (dx + dy === 1) {
          dL += Math.abs(lumOf(rgba, (y * W + x) * 4) - lumOf(rgba, ((y + dy) * W + x + dx) * 4));
          dLn++;
        }
      }
      if (diff) edges++;
    }
  }
  const seen = new Uint8Array(W * H);
  let islands = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y) || seen[y * W + x]) continue;
      const k = key(x, y);
      islands++;
      const stack = [[x, y]];
      seen[y * W + x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (!on(nx, ny) || seen[ny * W + nx] || key(nx, ny) !== k) continue;
          seen[ny * W + nx] = 1;
          stack.push([nx, ny]);
        }
      }
    }
  }
  return {
    opaque,
    palette: palette.size,
    dL: +(dL / Math.max(1, dLn)).toFixed(2),
    colors3: +(colors3 / Math.max(1, opaque)).toFixed(2),
    edgePct: +((edges / Math.max(1, opaque)) * 100).toFixed(1),
    islands,
  };
}

// Region means are what tell you which part of the body lost the detail.
export function regionContrast(img, box) {
  const { rgba, width: W } = img;
  const [x0, x1, y0, y1] = box;
  const on = (x, y) => rgba[(y * W + x) * 4 + 3] === 255;
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!on(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (!on(x + dx, y + dy)) continue;
        sum += Math.abs(lumOf(rgba, (y * W + x) * 4) - lumOf(rgba, ((y + dy) * W + x + dx) * 4));
        n++;
      }
    }
  }
  return +(sum / Math.max(1, n)).toFixed(1);
}

// Regions are authored in 64-space and scaled to whatever frame size is given,
// so the same report works for 64, 128 and 192.
export const REGIONS = {
  head: [22, 38, 4, 17],
  torso: [22, 38, 17, 34],
  skirt: [21, 32, 34, 50],
  right: [35, 42, 24, 48],
};

export function scaleRegions(size) {
  const k = size / 64;
  const out = {};
  for (const [name, [x0, x1, y0, y1]] of Object.entries(REGIONS)) {
    out[name] = [Math.round(x0 * k), Math.round(x1 * k), Math.round(y0 * k), Math.round(y1 * k)];
  }
  return out;
}

if (process.argv[1]?.endsWith('precision-report.mjs')) {
  const [livePath, blockPath] = process.argv.slice(2);
  if (!livePath || !blockPath) {
    console.error('usage: node tools/scheme-c/precision-report.mjs <livePng> <blockPng>');
    process.exit(1);
  }
  const live = await readRgba(livePath);
  const block = await readRgba(blockPath);
  const a = frameStats(live);
  const b = frameStats(block);
  console.log(`sizes: live ${live.width}x${live.height}  block ${block.width}x${block.height}`);
  const row = (k, x, y, ratio) => console.log(k.padEnd(14), String(x).padStart(7), String(y).padStart(7), String(ratio).padStart(6));
  console.log('metric'.padEnd(14), '   live', '  block', '  C/A');
  row('opaque px', a.opaque, b.opaque, '');
  row('palette', a.palette, b.palette, '');
  row('mean |dL|', a.dL, b.dL, (b.dL / a.dL).toFixed(2));
  row('colours 3x3', a.colors3, b.colors3, (b.colors3 / a.colors3).toFixed(2));
  row('edge %', a.edgePct, b.edgePct, (b.edgePct / a.edgePct).toFixed(2));
  row('islands', a.islands, b.islands, (b.islands / a.islands).toFixed(2));
  console.log('\nregion |dL|'.padEnd(14), '   live', '  block', '  C/A');
  for (const [name, box] of Object.entries(scaleRegions(live.width))) {
    const x = regionContrast(live, box);
    const y = regionContrast(block, box);
    row(name, x, y, (y / x).toFixed(2));
  }
}
