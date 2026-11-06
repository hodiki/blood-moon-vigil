import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BOARD_FRAMES } from './frame-set.mjs';
import { boardSize, buildBoard } from './board.mjs';
import { writeRgba, readRgba } from './read-png.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const size = boardSize(BOARD_FRAMES.length);
assert(size.width === 800 && size.height === 2384, 'three columns at 256');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-c-board-'));
const live = path.join(root, 'live');
const block64 = path.join(root, 'x64');
const block128 = path.join(root, 'x128');
fs.mkdirSync(live);
fs.mkdirSync(block64);
fs.mkdirSync(block128);
const livePix = Buffer.alloc(64 * 64 * 4, 0);
livePix[0] = 10; livePix[3] = 255;
const pix64 = Buffer.alloc(64 * 64 * 4, 0);
pix64[2] = 30; pix64[3] = 255;
const pix128 = Buffer.alloc(128 * 128 * 4, 0);
pix128[1] = 20; pix128[3] = 255;
for (const name of BOARD_FRAMES) {
  await writeRgba(path.join(live, `${name}.png`), livePix, 64, 64);
  await writeRgba(path.join(block64, `${name}.png`), pix64, 64, 64);
  await writeRgba(path.join(block128, `${name}.png`), pix128, 128, 128);
}
const out = path.join(root, '00-board.png');
await buildBoard(live, block64, block128, out);
const board = await readRgba(out);
assert(board.width === 800 && board.height === 2384, 'png size');
assert(board.rgba[0] === 0, 'gap is empty');
const left = ((8 * 800) + 8) * 4;
assert(board.rgba[left] === 10 && board.rgba[left + 3] === 255, 'live pixel');
const mid = ((8 * 800) + 8 + 256 + 8) * 4;
assert(board.rgba[mid + 2] === 30 && board.rgba[mid + 3] === 255, 'block 64 pixel');
const right = ((8 * 800) + 8 + (256 + 8) * 2) * 4;
assert(board.rgba[right + 1] === 20 && board.rgba[right + 3] === 255, 'block 128 pixel');
console.log('ok');
