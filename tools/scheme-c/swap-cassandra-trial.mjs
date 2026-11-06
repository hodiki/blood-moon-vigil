import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyReview, backupLive, restoreLive } from './swap-live.mjs';
import { assertTrialSet, trialSetDir } from './trial-set.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

export function livePaths(root = repoRoot) {
  const reviewRoot = path.join(root, 'characters', 'cassandra', 'review', '20261021-scheme-a-128');
  return {
    framesDir: path.join(root, 'assets', 'frames'),
    atlasPng: path.join(root, 'assets', 'atlas', 'characters.png'),
    atlasJson: path.join(root, 'assets', 'atlas', 'characters.json'),
    reviewRoot,
    backupDir: path.join(reviewRoot, 'backup-live'),
  };
}

function packCharacters(root) {
  const pack = path.join(root, 'tools', 'asset-pipeline', 'pack.mjs');
  const result = spawnSync(process.execPath, [pack, 'characters'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('pack failed');
}

export async function runTrial(argv, io) {
  const command = argv[0];
  const setName = argv[1];
  const { paths } = io;
  const backupMarker = path.join(paths.backupDir, 'characters.png');
  if (command === 'check') {
    const summary = await io.assertTrialSet(io.trialSetDir(paths.reviewRoot, setName));
    console.log(`check ${setName} PASS foot ${summary.footY} frames ${summary.frames}`);
    return;
  }
  if (command === 'backup') {
    if (fs.existsSync(path.join(paths.backupDir, 'hero-cassandra.png'))) {
      throw new Error('backup-live already exists');
    }
    io.backupLive(paths);
    console.log(`backup ${paths.backupDir}`);
    return;
  }
  if (command === 'apply') {
    if (!fs.existsSync(backupMarker)) throw new Error('backup missing');
    const reviewDir = io.trialSetDir(paths.reviewRoot, setName);
    await io.assertTrialSet(reviewDir);
    await io.applyReview({ reviewDir, framesDir: paths.framesDir, size: 128 });
    io.pack();
    console.log(`applied ${setName}`);
    return;
  }
  if (command === 'restore') {
    if (!fs.existsSync(backupMarker)) throw new Error('backup missing');
    io.restoreLive(paths);
    console.log('restored live 64');
    return;
  }
  throw new Error('command must be check, backup, apply, or restore');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const paths = livePaths();
  runTrial(process.argv.slice(2), {
    paths,
    assertTrialSet,
    trialSetDir,
    backupLive,
    applyReview,
    restoreLive,
    pack() { packCharacters(repoRoot); },
  }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
