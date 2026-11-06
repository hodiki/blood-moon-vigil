import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BOARD_FRAMES } from './frame-set.mjs';
import { coverageDown } from './coverage-down.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

async function writeSet(srcDir, reviewDir, factor) {
  fs.mkdirSync(reviewDir, { recursive: true });
  for (const name of BOARD_FRAMES) {
    const source = await readRgba(path.join(srcDir, `${name}.png`));
    if (source.width !== 512 || source.height !== 512) throw new Error(`${name} is not 512`);
    const boxed = coverageDown(source.rgba, source.width, source.height, factor);
    await writeRgba(path.join(reviewDir, `${name}.png`), boxed.rgba, boxed.width, boxed.height);
  }
  fs.copyFileSync(
    path.join(reviewDir, 'hero-cassandra.png'),
    path.join(reviewDir, 'hero-cassandra-v.png'),
  );
}

export async function boxRenders(srcDir, reviewDir) {
  await writeSet(srcDir, path.join(reviewDir, 'x64'), 8);
  await writeSet(srcDir, path.join(reviewDir, 'x128'), 4);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [srcDir, reviewDir] = process.argv.slice(2);
  if (!srcDir || !reviewDir) {
    console.error('usage: node tools/scheme-c/box-renders.mjs <srcDir512> <reviewDir>');
    process.exit(1);
  }
  await boxRenders(srcDir, reviewDir);
}
