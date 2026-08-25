// 把 silhouette-v35 守夜人几何画成参考图，供 img2img 锁身份（无描边，描边归管线）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', '..', 'assets', 'raw', '_ref-player-v35.png');

const SILVER = [232, 240, 250];
const INK = [11, 14, 20];
const CYAN = [84, 230, 201];
const PAPER = [242, 245, 249];

function make32(pose = 0) {
  const W = 32, H = 32;
  const data = Buffer.alloc(W * H * 4);
  const set = (x, y, rgb) => {
    const px = Math.round(x + 16);
    const py = Math.round(y + 16);
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const i = (py * W + px) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  };
  const fillRect = (x, y, w, h, rgb) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) set(xx, yy, rgb);
    }
  };
  const inPoly = (x, y, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      const hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  };
  const fillPoly = (pts, rgb) => {
    for (let y = -16; y < 16; y++) {
      for (let x = -16; x < 16; x++) {
        if (inPoly(x + 0.5, y + 0.5, pts)) set(x, y, rgb);
      }
    }
  };
  const fillCircle = (cx, cy, r, rgb) => {
    const rr = r * r;
    for (let y = -16; y < 16; y++) {
      for (let x = -16; x < 16; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= rr) set(x, y, rgb);
      }
    }
  };

  fillPoly([[-8, -6], [-6, -12.5], [0, -14], [6, -12.5], [8, -6]], SILVER);
  fillRect(-13, -8, 26, 3, SILVER);
  fillRect(-10, -5, 20, 1, CYAN);
  if (pose === 1) {
    fillPoly([[-9, -6], [9, -6], [14, 14], [-14, 14]], SILVER);
    fillRect(-8.5, 4, 2, 10, INK);
    fillRect(-1, 4, 2, 10, INK);
    fillRect(6.5, 4, 2, 10, INK);
  } else {
    fillPoly([[-9, -5], [9, -5], [13.5, 13], [-13.5, 13]], SILVER);
    fillRect(-8.5, 4, 2, 9, INK);
    fillRect(-1, 4, 2, 9, INK);
    fillRect(6.5, 4, 2, 9, INK);
  }
  fillRect(7, -6, 1.5, 5, PAPER);
  fillRect(8.5, -2, 4, 5, CYAN);
  fillCircle(10.5, 0.5, 2.2, CYAN);
  return data;
}

const small = make32(0);
const png = await sharp(small, { raw: { width: 32, height: 32, channels: 4 } })
  .resize(512, 512, { kernel: 'nearest' })
  .png()
  .toBuffer();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log('wrote', OUT);
