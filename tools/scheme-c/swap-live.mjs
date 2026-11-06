import fs from 'node:fs';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { readRgba } from './read-png.mjs';

function framePath(dir, name) {
  return path.join(dir, `${name}.png`);
}

export function backupLive({ framesDir, atlasPng, atlasJson, backupDir }) {
  fs.mkdirSync(backupDir, { recursive: true });
  for (const name of CASSANDRA_FRAMES) {
    fs.copyFileSync(framePath(framesDir, name), framePath(backupDir, name));
  }
  fs.copyFileSync(atlasPng, path.join(backupDir, 'characters.png'));
  fs.copyFileSync(atlasJson, path.join(backupDir, 'characters.json'));
}

export async function applyReview({ reviewDir, framesDir, size }) {
  if (size !== 64 && size !== 128) throw new Error('size');
  for (const name of CASSANDRA_FRAMES) {
    const file = framePath(reviewDir, name);
    if (!fs.existsSync(file)) throw new Error(`missing ${name}`);
    const image = await readRgba(file);
    if (image.width !== size || image.height !== size) throw new Error(`${name} is not ${size}`);
  }
  for (const name of CASSANDRA_FRAMES) {
    fs.copyFileSync(framePath(reviewDir, name), framePath(framesDir, name));
  }
}

export function restoreLive({ backupDir, framesDir, atlasPng, atlasJson }) {
  for (const name of CASSANDRA_FRAMES) {
    fs.copyFileSync(framePath(backupDir, name), framePath(framesDir, name));
  }
  fs.copyFileSync(path.join(backupDir, 'characters.png'), atlasPng);
  fs.copyFileSync(path.join(backupDir, 'characters.json'), atlasJson);
}
