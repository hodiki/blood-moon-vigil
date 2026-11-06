/**
 * 守誓者专用入盒：192 画布、统一比例、以头部（上 20% 内容）横向对齐。
 * 用法：box-knight <ref.png> <out.png> ...  自动用第一张定比例
 */
import { readRgba, writeRgba } from "./read-png.mjs";

const BOX = 192;
const FOOT = 191;
const CONTENT_H = 168;

function bbox(rgba, W, H, alphaMin = 8) {
  let top = H, bot = -1, mn = W, mx = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (rgba[(y * W + x) * 4 + 3] < alphaMin) continue;
    if (y < top) top = y;
    if (y > bot) bot = y;
    if (x < mn) mn = x;
    if (x > mx) mx = x;
  }
  return { top, bot, mn, mx, h: bot - top + 1, w: mx - mn + 1 };
}

/** 头部（内容上 20%）的横向质心，用来对齐身体，避免被剑影拉偏 */
function headCenterX(rgba, W, box) {
  const y1 = box.top + Math.max(1, Math.round(box.h * 0.2));
  let sum = 0, n = 0;
  for (let y = box.top; y < y1; y++) for (let x = 0; x < W; x++) {
    if (rgba[(y * W + x) * 4 + 3] < 8) continue;
    sum += x; n++;
  }
  return n ? sum / n : (box.mn + box.mx) / 2;
}

/** 原图是不透明的近黑底：从四边泛洪抠掉背景，返回带 alpha 的副本 */
function keyOut(rgba, W, H) {
  const near = (i) => rgba[i] < 26 && rgba[i + 1] < 26 && rgba[i + 2] < 32;
  const seen = new Uint8Array(W * H);
  const q = [];
  for (let x = 0; x < W; x++) { q.push(x, H - 1); q.push(x, 0); }
  for (let y = 0; y < H; y++) { q.push(0, y); q.push(W - 1, y); }
  while (q.length) {
    const y = q.pop(), x = q.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const k = y * W + x;
    if (seen[k]) continue;
    if (!near(k * 4)) continue;
    seen[k] = 1;
    q.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  const out = Buffer.from(rgba);
  for (let k = 0; k < W * H; k++) if (seen[k]) out[k * 4 + 3] = 0;
  return out;
}

export async function loadFrame(path) {
  const raw = await readRgba(path);
  const W = raw.width, H = raw.height;
  const rgba = keyOut(raw.rgba, W, H);
  const box = bbox(rgba, W, H);
  return { rgba, W, H, box, headX: headCenterX(rgba, W, box) };
}

/** 按给定比例把一张帧放到 192 画布：头部质心 x=96，最低行 y=191 */
export async function placeFrame(path, outPath, scale) {
  const f = await loadFrame(path);
  const dw = Math.max(1, Math.round(f.W * scale));
  const dh = Math.max(1, Math.round(f.H * scale));
  const out = new Uint8Array(BOX * BOX * 4);
  const shiftX = Math.round(96 - f.headX * scale);
  const shiftY = FOOT - f.box.bot * scale;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sy = Math.floor(y / scale), sx = Math.floor(x / scale);
      if (sy >= f.H || sx >= f.W) continue;
      const si = (sy * f.W + sx) * 4;
      if (f.rgba[si + 3] < 8) continue;
      const dx = Math.round(x + shiftX), dy = Math.round(y + shiftY);
      if (dx < 0 || dy < 0 || dx >= BOX || dy >= BOX) continue;
      const di = (dy * BOX + dx) * 4;
      out[di] = f.rgba[si];
      out[di + 1] = f.rgba[si + 1];
      out[di + 2] = f.rgba[si + 2];
      out[di + 3] = 255;
    }
  }
  // 落盒后按四舍五入再校一次脚底，保证 foot 严格等于 FOOT
  const b0 = bbox(out, BOX, BOX);
  const dy = FOOT - b0.bot;
  if (dy !== 0) {
    const shifted = new Uint8Array(BOX * BOX * 4);
    for (let y = 0; y < BOX; y++) {
      const ny = y + dy;
      if (ny < 0 || ny >= BOX) continue;
      for (let x = 0; x < BOX; x++) {
        const si = (y * BOX + x) * 4, di = (ny * BOX + x) * 4;
        shifted[di] = out[si]; shifted[di + 1] = out[si + 1];
        shifted[di + 2] = out[si + 2]; shifted[di + 3] = out[si + 3];
      }
    }
    out.set(shifted);
  }
  await writeRgba(outPath, Buffer.from(out), BOX, BOX);
  const b = bbox(out, BOX, BOX);
  return { w: b.w, h: b.h, top: b.top, foot: b.bot };
}
