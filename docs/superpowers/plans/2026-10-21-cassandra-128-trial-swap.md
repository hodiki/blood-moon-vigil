# Cassandra 128 Trial Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把卡珊德拉过目套 09（四分之三）和 10（侧面）整套换进现网，在游戏里对照走循环和技能姿态，测完还原已过 64。

**Architecture:** 不改播放代码。`src/fx/anim.ts` 已在六张 walk 都在时按 `a,e,b,c,f,d`、8fps 播走；`src/fx/skill-pose.ts` 已对卡珊德拉按 combo 播 `skill-a` 300ms 再 `skill-b` 150ms。`combatDisplayScale(128)` 返回 1，和守誓 / 加尔文的 128 世界边一致。本计划只加一个脚底门禁和一个换图命令：换之前把现网十帧和 `characters.png` / `characters.json` 备份走，门禁通过后复制整套十帧并重打 `characters` 图集。09 与 10 不能同时出现在图集里，用同一份备份来回切。

**Tech Stack:** Node `C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`（v22.22.2）、`tools/asset-pipeline` 里已有的 `sharp`、现成 `tools/scheme-c/swap-live.mjs` 与 `tools/asset-pipeline/pack.mjs`、Vite 把 `assets/atlas` 挂到 `/atlas`。

## Global Constraints

- 换图源只能是 `characters/cassandra/review/20261021-scheme-a-128/sets/09-3quarter` 与 `sets/10-profile`。同夹根上的 `x128/` 不能换：`hero-cassandra-walk-f` 脚底是 121，`hero-cassandra-walk-d` 脚底是 124。
- 十帧都必须是 128×128，不透明像素的最低行必须是 y=127，alpha 只能是 0 或 255。`hero-cassandra-v.png` 必须与 `hero-cassandra.png` 字节相同，不能是镜像。
- 一次换整套十帧（idle、`-v`、walk-a/e/b/c/f/d、skill-a、skill-b）。只换走帧和技能、把 idle 留在 64，会在同一条动画里混用 scale 2 和 scale 1。
- 覆盖 `assets/frames/` 之前，备份这十张，以及 `assets/atlas/characters.png` 和 `assets/atlas/characters.json`。备份目录已存在时拒绝再备份，避免把 128 试帧写成「原现网」。
- 不跑 `tools/asset-pipeline/process.mjs`，不跑 `--all`，不跑 `--check`。`frame-specs.mjs` 里卡珊德拉保持 64。这次不写成新的「过」。
- 不改 `src/`。不改其他角色的帧。不改 `pivots.json` 的读取方式（游戏不读它）。
- 图集由 `node pack.mjs characters` 重打。Vite 直接读 `assets/atlas`，浏览器要硬刷新。
- 试看结束必须 `restore`，除非主理人另写一句留在游戏里。
- `git` 不在 PATH 上。某步的 commit 仅当 `git rev-parse --is-inside-work-tree` 输出 `true` 时执行；否则跳过该 commit，继续下一步。不 `git init`，不 push。
- 下面每条命令里的 `node` 都先执行：`$env:PATH = "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6;" + $env:PATH`。工作目录是 `D:\code\vampire-survivors-like`。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `tools/scheme-c/trial-set.mjs` | 门禁 `assertTrialSet`；套名 `trialSetDir` 只认 `09` / `10` |
| `tools/scheme-c/trial-set.test.mjs` | 用临时 128 图断言脚底、`-v`、半透明、套名 |
| `tools/scheme-c/swap-cassandra-trial.mjs` | 命令 `check` / `backup` / `apply` / `restore`；`apply` 先门禁再复制再打包 |
| `tools/scheme-c/swap-cassandra-trial.test.mjs` | 临时目录里测备份拒绝、无备份拒绝 apply、restore 回到原字节 |
| `characters/cassandra/review/20261021-scheme-a-128/backup-live/` | 执行换图时才创建。十帧 + `characters.png` + `characters.json` |

`swap-live.mjs` 已有 `backupLive`、`applyReview`、`restoreLive`，本计划不改它们。`applyReview` 在任一帧尺寸不对时整批不写。

---

### Task 1: Trial set gate

**Files:**
- Create: `tools/scheme-c/trial-set.mjs`
- Create: `tools/scheme-c/trial-set.test.mjs`
- Test: `tools/scheme-c/trial-set.test.mjs`

**Interfaces:**
- Consumes: `CASSANDRA_FRAMES` from `tools/scheme-c/frame-set.mjs`；`contentSpan`、`sameBuffer` from `tools/scheme-c/foot-line.mjs`；`readRgba`、`writeRgba` from `tools/scheme-c/read-png.mjs`
- Produces: `TRIAL_SIZE`（128）、`TRIAL_FOOT_Y`（127）、`async function assertTrialSet(dir)` 成功时返回 `{ size: 128, footY: 127, frames: 10 }`、`function trialSetDir(reviewRoot, name)` 对 `'09'` / `'10'` 返回子目录，其它名字抛 `set must be 09 or 10`

- [ ] **Step 1: Write the failing test**

把下面全文写入 `tools/scheme-c/trial-set.test.mjs`：

```javascript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { writeRgba } from './read-png.mjs';
import { assertTrialSet, trialSetDir } from './trial-set.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function paint(y, rgb = [10, 20, 30], alpha = 255) {
  const rgba = Buffer.alloc(128 * 128 * 4, 0);
  const i = (y * 128) * 4;
  rgba[i] = rgb[0];
  rgba[i + 1] = rgb[1];
  rgba[i + 2] = rgb[2];
  rgba[i + 3] = alpha;
  return rgba;
}

async function writeSet(dir, mutate) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of CASSANDRA_FRAMES) {
    let rgba = paint(127);
    if (mutate) rgba = mutate(name, rgba);
    await writeRgba(path.join(dir, `${name}.png`), rgba, 128, 128);
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-set-'));
const okDir = path.join(root, 'ok');
await writeSet(okDir);
const pass = await assertTrialSet(okDir);
assert(pass.size === 128 && pass.footY === 127 && pass.frames === 10, 'pass summary');

const highFoot = path.join(root, 'high');
await writeSet(highFoot, (name, rgba) => (name === 'hero-cassandra-walk-f' ? paint(121) : rgba));
let footMsg = '';
try { await assertTrialSet(highFoot); } catch (err) { footMsg = err.message; }
assert(footMsg === 'hero-cassandra-walk-f foot 121', footMsg);

const mirrored = path.join(root, 'mirror');
await writeSet(mirrored, (name, rgba) => (name === 'hero-cassandra-v' ? paint(127, [1, 2, 3]) : rgba));
let variantMsg = '';
try { await assertTrialSet(mirrored); } catch (err) { variantMsg = err.message; }
assert(variantMsg === '-v is not idle', variantMsg);

const soft = path.join(root, 'soft');
await writeSet(soft, (name, rgba) => (name === 'hero-cassandra-skill-a' ? paint(127, [10, 20, 30], 128) : rgba));
let alphaMsg = '';
try { await assertTrialSet(soft); } catch (err) { alphaMsg = err.message; }
assert(alphaMsg === 'hero-cassandra-skill-a partial alpha', alphaMsg);

const reviewRoot = path.join(root, 'review');
assert(trialSetDir(reviewRoot, '09').endsWith(`${path.sep}sets${path.sep}09-3quarter`), '09 dir');
assert(trialSetDir(reviewRoot, '10').endsWith(`${path.sep}sets${path.sep}10-profile`), '10 dir');
let nameMsg = '';
try { trialSetDir(reviewRoot, 'x128'); } catch (err) { nameMsg = err.message; }
assert(nameMsg === 'set must be 09 or 10', nameMsg);
console.log('ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/scheme-c/trial-set.test.mjs`

Expected: FAIL，`Cannot find module` 指向 `./trial-set.mjs`。

- [ ] **Step 3: Write minimal implementation**

把下面全文写入 `tools/scheme-c/trial-set.mjs`：

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { contentSpan, sameBuffer } from './foot-line.mjs';
import { readRgba } from './read-png.mjs';

export const TRIAL_SIZE = 128;
export const TRIAL_FOOT_Y = 127;

export function trialSetDir(reviewRoot, name) {
  if (name === '09') return path.join(reviewRoot, 'sets', '09-3quarter');
  if (name === '10') return path.join(reviewRoot, 'sets', '10-profile');
  throw new Error('set must be 09 or 10');
}

export async function assertTrialSet(dir) {
  const idle = fs.readFileSync(path.join(dir, 'hero-cassandra.png'));
  const variant = fs.readFileSync(path.join(dir, 'hero-cassandra-v.png'));
  if (!sameBuffer(idle, variant)) throw new Error('-v is not idle');
  for (const name of CASSANDRA_FRAMES) {
    const image = await readRgba(path.join(dir, `${name}.png`));
    if (image.width !== TRIAL_SIZE || image.height !== TRIAL_SIZE) {
      throw new Error(`${name} is not ${TRIAL_SIZE}`);
    }
    for (let i = 3; i < image.rgba.length; i += 4) {
      const alpha = image.rgba[i];
      if (alpha !== 0 && alpha !== 255) throw new Error(`${name} partial alpha`);
    }
    const span = contentSpan(image.rgba, image.width, image.height);
    if (span.footY !== TRIAL_FOOT_Y) throw new Error(`${name} foot ${span.footY}`);
  }
  return { size: TRIAL_SIZE, footY: TRIAL_FOOT_Y, frames: CASSANDRA_FRAMES.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/scheme-c/trial-set.test.mjs`

Expected: 只打印 `ok`，退出码 0。

- [ ] **Step 5: Commit**

若 `git rev-parse --is-inside-work-tree` 不是 `true`，跳过。

```bash
git add tools/scheme-c/trial-set.mjs tools/scheme-c/trial-set.test.mjs
git commit -m "test: gate cassandra trial sets on foot 127"
```

---

### Task 2: Swap command

**Files:**
- Create: `tools/scheme-c/swap-cassandra-trial.mjs`
- Create: `tools/scheme-c/swap-cassandra-trial.test.mjs`
- Test: `tools/scheme-c/swap-cassandra-trial.test.mjs`

**Interfaces:**
- Consumes: `assertTrialSet`、`trialSetDir` from Task 1；`backupLive`、`applyReview`、`restoreLive` from `tools/scheme-c/swap-live.mjs`；`CASSANDRA_FRAMES` from `tools/scheme-c/frame-set.mjs`
- Produces: `async function runTrial(argv, io)`。`argv[0]` 是 `check` | `backup` | `apply` | `restore`。`check` 和 `apply` 还要 `argv[1]` 为 `09` 或 `10`。`io` 形状：

```javascript
{
  paths: { framesDir, atlasPng, atlasJson, reviewRoot, backupDir },
  assertTrialSet,   // (dir) => Promise<{ size, footY, frames }>
  trialSetDir,      // (reviewRoot, name) => string
  backupLive,       // swap-live 的同名函数
  applyReview,      // ({ reviewDir, framesDir, size }) => Promise<void>
  restoreLive,      // swap-live 的同名函数
  pack,             // () => void，失败抛 Error('pack failed')
}
```

直接运行该文件时，`io.pack` 用 `spawnSync(process.execPath, [pack.mjs, 'characters'], { cwd: 仓库根, stdio: 'inherit' })`，`status !== 0` 时抛 `pack failed`。

- [ ] **Step 1: Write the failing test**

把下面全文写入 `tools/scheme-c/swap-cassandra-trial.test.mjs`：

```javascript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { writeRgba } from './read-png.mjs';
import { applyReview, backupLive, restoreLive } from './swap-live.mjs';
import { assertTrialSet, trialSetDir } from './trial-set.mjs';
import { runTrial } from './swap-cassandra-trial.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function paint() {
  const rgba = Buffer.alloc(128 * 128 * 4, 0);
  const i = (127 * 128) * 4;
  rgba[i + 3] = 255;
  return rgba;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-swap-'));
const framesDir = path.join(root, 'frames');
const reviewRoot = path.join(root, 'review');
const backupDir = path.join(reviewRoot, 'backup-live');
fs.mkdirSync(framesDir);
const live = Buffer.alloc(64 * 64 * 4, 7);
for (const name of CASSANDRA_FRAMES) {
  await writeRgba(path.join(framesDir, `${name}.png`), live, 64, 64);
}
await writeRgba(path.join(framesDir, 'hero-violet.png'), live, 64, 64);
fs.writeFileSync(path.join(root, 'characters.png'), 'atlas-64');
fs.writeFileSync(path.join(root, 'characters.json'), 'json-64');
for (const setName of ['09-3quarter', '10-profile']) {
  const dir = path.join(reviewRoot, 'sets', setName);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of CASSANDRA_FRAMES) {
    await writeRgba(path.join(dir, `${name}.png`), paint(), 128, 128);
  }
}
const violetBefore = fs.readFileSync(path.join(framesDir, 'hero-violet.png'));
const io = {
  paths: {
    framesDir,
    atlasPng: path.join(root, 'characters.png'),
    atlasJson: path.join(root, 'characters.json'),
    reviewRoot,
    backupDir,
  },
  assertTrialSet,
  trialSetDir,
  backupLive,
  applyReview,
  restoreLive,
  pack() { fs.writeFileSync(path.join(root, 'packed'), 'yes'); },
};

await runTrial(['backup'], io);
assert(fs.readFileSync(path.join(backupDir, 'characters.png')).toString() === 'atlas-64', 'atlas backed up');
assert(fs.existsSync(path.join(backupDir, 'hero-cassandra.png')), 'frame backed up');
let second = '';
try { await runTrial(['backup'], io); } catch (err) { second = err.message; }
assert(second === 'backup-live already exists', second);

let noBackup = '';
const bare = { ...io, paths: { ...io.paths, backupDir: path.join(root, 'missing-backup') } };
try { await runTrial(['apply', '09'], bare); } catch (err) { noBackup = err.message; }
assert(noBackup === 'backup missing', noBackup);

await runTrial(['apply', '09'], io);
const applied = await (await import('./read-png.mjs')).readRgba(path.join(framesDir, 'hero-cassandra-walk-a.png'));
assert(applied.width === 128, 'walk is 128');
assert(fs.readFileSync(path.join(framesDir, 'hero-violet.png')).equals(violetBefore), 'other hero untouched');
assert(fs.readFileSync(path.join(root, 'packed')).toString() === 'yes', 'packed');

await runTrial(['restore'], io);
const restored = await (await import('./read-png.mjs')).readRgba(path.join(framesDir, 'hero-cassandra.png'));
assert(restored.width === 64 && restored.rgba[0] === 7, 'restored 64');
assert(fs.readFileSync(path.join(root, 'characters.png')).toString() === 'atlas-64', 'atlas restored');
console.log('ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/scheme-c/swap-cassandra-trial.test.mjs`

Expected: FAIL，`Cannot find module` 指向 `./swap-cassandra-trial.mjs`。

- [ ] **Step 3: Write minimal implementation**

把下面全文写入 `tools/scheme-c/swap-cassandra-trial.mjs`：

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/scheme-c/swap-cassandra-trial.test.mjs`

Expected: 只打印 `ok`，退出码 0。这个测试不读 `assets/frames`，不调用 `pack.mjs`。

- [ ] **Step 5: Commit**

若 `git rev-parse --is-inside-work-tree` 不是 `true`，跳过。

```bash
git add tools/scheme-c/swap-cassandra-trial.mjs tools/scheme-c/swap-cassandra-trial.test.mjs
git commit -m "feat: switch cassandra trial sets with a live backup"
```

---

### Task 3: Check the real 09 and 10 folders

**Files:**
- Modify: none
- Test: 真实过目目录，只读

**Interfaces:**
- Consumes: `assertTrialSet`、`trialSetDir` from Task 1。命令文件来自 Task 2。

- [ ] **Step 1: Check both swappable sets**

Run:

```powershell
node tools/scheme-c/swap-cassandra-trial.mjs check 09
node tools/scheme-c/swap-cassandra-trial.mjs check 10
```

Expected:

```text
check 09 PASS foot 127 frames 10
check 10 PASS foot 127 frames 10
```

走帧的内容顶会高于 idle（09 顶在 17–20，10 顶在 19–22）。门禁不看顶，只看脚底 127。这是抬脚，不是没对齐。

- [ ] **Step 2: Prove the loose x128 folder is rejected**

Run:

```powershell
node --input-type=module -e "import { assertTrialSet } from './tools/scheme-c/trial-set.mjs'; await assertTrialSet('characters/cassandra/review/20261021-scheme-a-128/x128');"
```

Expected: 退出码 1，消息是 `hero-cassandra-walk-f foot 121`。不要把这个目录接进 `apply`。

- [ ] **Step 3: Commit**

这一步没有新文件。不提交。

---

### Task 4: Put set 09 in the game

**Files:**
- Create: `characters/cassandra/review/20261021-scheme-a-128/backup-live/`（十张 png + `characters.png` + `characters.json`）
- Modify: `assets/frames/hero-cassandra.png` 及同名的 `-v`、`walk-a`、`walk-e`、`walk-b`、`walk-c`、`walk-f`、`walk-d`、`skill-a`、`skill-b`
- Modify: `assets/atlas/characters.png`、`assets/atlas/characters.json`（由 `pack.mjs characters` 重写）

**Interfaces:**
- Consumes: Task 2 的 `backup` 与 `apply 09`

- [ ] **Step 1: Backup the passed 64 set**

Run: `node tools/scheme-c/swap-cassandra-trial.mjs backup`

Expected: 打印 `backup ...\backup-live`，退出码 0。目录里有十张帧、`characters.png`、`characters.json`。再跑一次同一命令必须退出码 1，消息 `backup-live already exists`。

- [ ] **Step 2: Apply 09 and repack**

Run: `node tools/scheme-c/swap-cassandra-trial.mjs apply 09`

Expected: 日志含 `applied 09`，以及 pack 的一行 `[pack] characters:` 且含 `≤2048 ✔`。退出码 0。`assets/frames/hero-cassandra-walk-a.png` 与 `hero-cassandra-skill-a.png` 都是 128×128。`assets/frames/hero-violet.png` 的字节与 apply 之前相同。

- [ ] **Step 3: Look in the game, then stop**

若 `npm run dev` 还没开，在仓库根启动它。浏览器打开 Vite 打印的本地地址，硬刷新。启动页选「血猎手·卡珊德拉」。

对照这三件事：

| 看什么 | 怎么触发 | 通过时看见 |
|---|---|---|
| 走 | 按住移动 | 六帧循环，顺序接触→落下→经过→对侧接触→落下→经过，脚不漂出地面。朝左是游戏 `flipX`，不是素材本身被镜像 |
| 技能 | 放「血影突袭」 | 先 `skill-a` 300ms，再 `skill-b` 150ms，然后回 idle。人仍是这一套四分之三 |
| 呼吸 | 站着不动 | idle 与 `-v` 看不出换图 |

128 在世界里是 1 倍，和薇奥莱、加尔文同高。旧 64 是 2 倍放大到同一世界边；脚相对碰撞圆心会比旧帧低大约 9 像素。这是原点仍在画布中心，不是这次又缩放过。

本任务到这里停下，把上述三行观察写给主理人。不要立刻 `restore`，也不要在这一步改 `apply 10`。

---

### Task 5: Switch to set 10

**Files:**
- Modify: 与 Task 4 相同的十张 `assets/frames/hero-cassandra*`，以及 `assets/atlas/characters.png`、`characters.json`
- 不修改 `backup-live/`

**Interfaces:**
- Consumes: Task 4 已经留下的备份。`apply 10` 再次覆盖帧并打包，不重新备份。

- [ ] **Step 1: Apply 10 only after 09 has been looked at**

Run: `node tools/scheme-c/swap-cassandra-trial.mjs apply 10`

Expected: `applied 10`，pack 仍 `≤2048 ✔`。`backup-live/hero-cassandra.png` 仍是 64×64。

- [ ] **Step 2: Refresh and compare with 09**

硬刷新。同一角色再走一段、再放一次「血影突袭」。10 是朝右的侧面套；朝左走仍由 `flipX` 镜像。技能仍是 300ms + 150ms。

把和 09 的差别只记三句：侧面剪影还认不认得出、抬脚有没有离地、技能姿态和 idle 能不能一眼分开。不要在这一步改像素。

---

### Task 6: Restore the passed 64 set

**Files:**
- Modify: Task 4 动过的十张帧和图集，改回 `backup-live/` 里的字节

**Interfaces:**
- Consumes: `restoreLive` via `node tools/scheme-c/swap-cassandra-trial.mjs restore`

- [ ] **Step 1: Restore**

主理人看完两套之后再跑。若主理人写明先留着，跳过这一步并在回复里说明现网仍是试帧。

Run: `node tools/scheme-c/swap-cassandra-trial.mjs restore`

Expected: 打印 `restored live 64`。`assets/frames/hero-cassandra.png` 为 64×64。`assets/atlas/characters.png` 与 `backup-live/characters.png` 字节相同。

- [ ] **Step 2: Do not repack after restore**

`restore` 直接抄回备份图集。再跑 `pack.mjs` 会按当前 `report.json` 重排格子，不再是备份的那一张。不要补跑 pack。

硬刷新后，卡珊德拉应回到换图前的 64 全套。
