# Scheme C Cassandra Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给卡珊德拉准备一套可退回的工作流 C 试点：同一具模型近邻出 64 和 128 两套同名帧。64 与现网印戳在同一像素格子上对照，128 用来看提高分辨率后多留下多少角色设计。两套都只在技术检查通过后短时换进游戏，测完还原。

**Architecture:** 新脚本放在 `tools/scheme-c/`，只做近邻缩小、脚底检查、并排板和按名单换图。不调用 `tools/asset-pipeline/process.mjs`。Blender 只负责建模型并烘 512 的硬透明 PNG，装在仓库外面。现网 `assets/frames/hero-cassandra*` 保持 64，直到对照任务明确备份后再覆盖，测完即还原。

**Tech Stack:** Node 现有运行时、`tools/asset-pipeline` 里已有的 `sharp`、Blender 5.2.2 LTS Workbench、Phaser 现有选人与 `flipX` 播放。

## Global Constraints

- 试点角色是卡珊德拉，不用加尔文。对照的是现网印戳 64 和工作流 C 体块。其他角色不动。
- 已过 64 全套仍是现网。本试点不重切、不加呼吸、不把试烘写成新的「过」。
- 只安装 Blender 5.2.2 LTS Windows x64 便携 zip：`https://download.blender.org/release/Blender5.2/blender-5.2.2-windows-x64.zip`。解压到仓库外。不装 Comfy、Qwen、Krea、H3、Wan、Spine、PixelLab，不把 Aseprite 当作者，不新装 Node。
- Blender：Workbench、Lighting Flat、Color Material、阴影腔体轮廓关、抗锯齿关、Film Transparent、View Transform Standard、Look None、Exposure 0、Gamma 1、PNG RGBA 8 bit、512×512、100%。
- 同一张 512 烘图近邻出两套。64：输出像素 `(x, y)` 复制源像素 `(x * 8, y * 8)`。128：输出像素 `(x, y)` 复制源像素 `(x * 4, y * 4)`。不用 Blender 缩放，不用 lanczos，不跑 `process.mjs`。64 用来和现网同一格子对照。128 用来看 64 丢掉的角色设计还剩多少。
- 相机听现网战斗帧：正交、四分之三朝右。不听加尔文「侧视转 20°」。
- 剪影 `characters/cassandra/identity/silhouette/lock-ce.png` 管马尾刃、收腰、三角下摆。立绘 `characters/cassandra/identity/source/h23.png` 只回答这块是什么，不贴到模型上。
- 块只有：银马尾楔形、高领、收腰、酒红大衣三角下摆、两条腿、靴。大衣不要做成身后破斗篷。头发不要做成缕。
- `-v` 与 idle 同一张，不另烘呼吸。走帧只有 `a, e, b, c, f, d`。技能无拖尾。
- 并排板九行：idle、六步、skill-a、skill-b。`-v` 不占一格。三列都放到 256：左列现网 64 近邻 ×4，中列体块 64 近邻 ×4，右列体块 128 近邻 ×2。
- `frame-specs.mjs` 里卡珊德拉保持 64。不把 `--check` 当试点结论。
- 十张帧必须一起换。换之前备份这十张和 `assets/atlas/characters.png`、`characters.json`。测完还原。不把体块留在 `assets/frames/` 过夜，除非主理人另写一句。
- 不把三维或 Spine 接进 Phaser。不对已过族跑 `process.mjs --all`。
- 在主仓库 `D:\code\vampire-survivors-like` 执行。不建 git worktree。不 `git init`。不 push。某步的 commit 仅当 `git rev-parse --is-inside-work-tree` 输出 `true` 时执行；否则跳过该 commit，继续下一步。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `tools/scheme-c/frame-set.mjs` | 十个帧名、九格板顺序、现网仍是 64 的断言用名单 |
| `tools/scheme-c/nearest-down.mjs` | 正好 4 倍收到 128、正好 8 倍收到 64，半透明即拒绝 |
| `tools/scheme-c/foot-line.mjs` | 脚底行、内容高度比、`-v` 与 idle 字节相同 |
| `tools/scheme-c/colors.mjs` | 内点主色排序；校验 `colors.json` 的三个 hex |
| `tools/scheme-c/board.mjs` | 九行三列并排板：现网 64、体块 64、体块 128 |
| `tools/scheme-c/swap-live.mjs` | 只按名单备份、覆盖、还原帧和图集 |
| `tools/scheme-c/box-renders.mjs` | 命令行：512 目录 → 过目夹里的 `x64/` 与 `x128/`，各自复制 `-v` |
| `tools/scheme-c/check-renders.mjs` | 命令行：尺寸、硬透明、脚底、高度比、`-v` |
| `tools/scheme-c/*.test.mjs` | 各模块的断言，不读现网大图，不写 `assets/frames/` |
| `characters/cassandra/combat/scheme-c/scene_template.py` | 把一个 Blender 场景设成上面的烘图参数 |
| `characters/cassandra/combat/scheme-c/verify-scene.py` | 后台跑 Blender 时检查这些参数 |
| `characters/cassandra/combat/scheme-c/colors.json` | 从现网 idle 取到的大衣、头发、金属三个 hex |
| `characters/cassandra/combat/scheme-c/cassandra-block.blend` | 体块母版。任务 9 才创建 |
| `characters/cassandra/review/20261019-scheme-c/x64/` | 体块 64，和现网对照 |
| `characters/cassandra/review/20261019-scheme-c/x128/` | 体块 128，看提高像素后留下的设计 |
| `characters/cassandra/review/20261019-scheme-c/` | 并排板、游戏对照前的 `backup-live/` |

模块之间的名字以 `frame-set.mjs` 的导出为准：`CASSANDRA_FRAMES`、`BOARD_FRAMES`。近邻函数名是 `nearestDown`、`nearestDown4`、`nearestDown8`。换图函数名是 `backupLive`、`applyReview`、`restoreLive`。`applyReview` 的 `size` 只能是 64 或 128。

---

### Task 1: Frame names and the live 64 contract

**Files:**
- Create: `tools/scheme-c/frame-set.mjs`
- Create: `tools/scheme-c/frame-set.test.mjs`
- Test: `tools/scheme-c/frame-set.test.mjs`

**Interfaces:**
- Consumes: `resolveFrameSpec` from `tools/asset-pipeline/frame-specs.mjs`
- Produces: `CASSANDRA_FRAMES`（长度 10 的字符串数组）, `BOARD_FRAMES`（长度 9，不含 `hero-cassandra-v`）

- [ ] **Step 1: Write the failing test**

```javascript
import { resolveFrameSpec } from '../asset-pipeline/frame-specs.mjs';
import { BOARD_FRAMES, CASSANDRA_FRAMES } from './frame-set.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const expected = [
  'hero-cassandra',
  'hero-cassandra-v',
  'hero-cassandra-walk-a',
  'hero-cassandra-walk-e',
  'hero-cassandra-walk-b',
  'hero-cassandra-walk-c',
  'hero-cassandra-walk-f',
  'hero-cassandra-walk-d',
  'hero-cassandra-skill-a',
  'hero-cassandra-skill-b',
];

assert(CASSANDRA_FRAMES.join() === expected.join(), 'frame order');
assert(BOARD_FRAMES.join() === expected.filter((n) => n !== 'hero-cassandra-v').join(), 'board skips -v');
for (const name of CASSANDRA_FRAMES) {
  const spec = resolveFrameSpec(name);
  assert(spec.w === 64 && spec.h === 64 && spec.atlas === 'characters', `${name} stays 64`);
}
console.log('ok');
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `D:\code\vampire-survivors-like`:

```powershell
node tools/scheme-c/frame-set.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./frame-set.mjs`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
export const CASSANDRA_FRAMES = [
  'hero-cassandra',
  'hero-cassandra-v',
  'hero-cassandra-walk-a',
  'hero-cassandra-walk-e',
  'hero-cassandra-walk-b',
  'hero-cassandra-walk-c',
  'hero-cassandra-walk-f',
  'hero-cassandra-walk-d',
  'hero-cassandra-skill-a',
  'hero-cassandra-skill-b',
];

export const BOARD_FRAMES = CASSANDRA_FRAMES.filter((name) => name !== 'hero-cassandra-v');
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
node tools/scheme-c/frame-set.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

```powershell
git rev-parse --is-inside-work-tree
```

Expected if this workspace is not a git repo: a non-zero exit. Skip the commit. Do not `git init`. Do not push.

If the command prints `true`:

```powershell
git add tools/scheme-c/frame-set.mjs tools/scheme-c/frame-set.test.mjs
git commit -m "feat: lock cassandra scheme-c frame names"
```

Do not push.

---

### Task 2: Nearest downsample by exactly 4

**Files:**
- Create: `tools/scheme-c/nearest-down.mjs`
- Create: `tools/scheme-c/nearest-down.test.mjs`
- Test: `tools/scheme-c/nearest-down.test.mjs`

**Interfaces:**
- Consumes: none
- Produces: `nearestDown(rgba, width, height, factor)` → `{ rgba: Buffer, width: number, height: number }`。`factor` 只能是 4 或 8。源宽高必须是 factor 的倍数。任一像素 alpha 不是 0 或 255 时抛 `Error('partial alpha')`。`nearestDown4` 调用 factor 4，`nearestDown8` 调用 factor 8。输出像素 `(x, y)` 复制源像素 `(x * factor, y * factor)`。

- [ ] **Step 1: Write the failing test**

```javascript
import { nearestDown4, nearestDown8 } from './nearest-down.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const width = 8;
const height = 4;
const rgba = Buffer.alloc(width * height * 4);
function put(x, y, r, g, b, a = 255) {
  const i = (y * width + x) * 4;
  rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
}
put(0, 0, 10, 0, 0);
put(4, 0, 0, 20, 0);
rgba[(0 * width + 1) * 4 + 3] = 128;

let threw = false;
try { nearestDown4(rgba, width, height); } catch (e) { threw = e.message === 'partial alpha'; }
assert(threw, 'partial alpha');

rgba[(0 * width + 1) * 4 + 3] = 255;
const out = nearestDown4(rgba, width, height);
assert(out.width === 2 && out.height === 1, 'size');
assert(out.rgba[0] === 10 && out.rgba[4] === 0 && out.rgba[5] === 20, 'samples x*4');
const big = Buffer.alloc(16 * 8 * 4);
big[0] = 30; big[3] = 255;
big[(8) * 4] = 40; big[(8) * 4 + 3] = 255;
const out8 = nearestDown8(big, 16, 8);
assert(out8.width === 2 && out8.height === 1, '64 factor');
assert(out8.rgba[0] === 30 && out8.rgba[4] === 40, 'samples x*8');
console.log('ok');
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
node tools/scheme-c/nearest-down.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
node tools/scheme-c/nearest-down.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

If `git rev-parse --is-inside-work-tree` prints `true`:

```powershell
git add tools/scheme-c/nearest-down.mjs tools/scheme-c/nearest-down.test.mjs
git commit -m "feat: nearest-down scheme-c renders by four"
```

Do not push. If the rev-parse fails, skip the commit.

---

### Task 3: Foot line, body span, and the idle copy

**Files:**
- Create: `tools/scheme-c/foot-line.mjs`
- Create: `tools/scheme-c/foot-line.test.mjs`
- Test: `tools/scheme-c/foot-line.test.mjs`

**Interfaces:**
- Consumes: none
- Produces:
  - `contentSpan(rgba, width, height)` → `{ topY: number, footY: number, span: number }`
  - `spansMatch(liveSpan, liveCanvas, blockSpan, blockCanvas)` → boolean。允许的差是 block 画布上 1 像素：`Math.abs(blockSpan / blockCanvas - liveSpan / liveCanvas) <= 1 / blockCanvas`
  - `sameBuffer(a, b)` → boolean

- [ ] **Step 1: Write the failing test**

```javascript
import { contentSpan, sameBuffer, spansMatch } from './foot-line.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rgba = Buffer.alloc(4 * 6 * 4);
rgba[(2 * 4 + 1) * 4 + 3] = 255;
rgba[(5 * 4 + 2) * 4 + 3] = 255;
const span = contentSpan(rgba, 4, 6);
assert(span.topY === 2 && span.footY === 5 && span.span === 4, 'span');
assert(spansMatch(32, 64, 64, 128) === true, 'same ratio');
assert(spansMatch(32, 64, 66, 128) === false, 'two pixels off');
assert(sameBuffer(Buffer.from([1]), Buffer.from([1])) === true, 'same');
assert(sameBuffer(Buffer.from([1]), Buffer.from([2])) === false, 'different');
console.log('ok');
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
node tools/scheme-c/foot-line.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
export function contentSpan(rgba, width, height) {
  let topY = height;
  let footY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] !== 255) continue;
      if (y < topY) topY = y;
      if (y > footY) footY = y;
    }
  }
  if (footY < 0) throw new Error('empty frame');
  return { topY, footY, span: footY - topY + 1 };
}

export function spansMatch(liveSpan, liveCanvas, blockSpan, blockCanvas) {
  return Math.abs(blockSpan / blockCanvas - liveSpan / liveCanvas) <= 1 / blockCanvas;
}

export function sameBuffer(a, b) {
  return a.length === b.length && a.equals(b);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
node tools/scheme-c/foot-line.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

If `git rev-parse --is-inside-work-tree` prints `true`:

```powershell
git add tools/scheme-c/foot-line.mjs tools/scheme-c/foot-line.test.mjs
git commit -m "feat: check scheme-c foot line and body span"
```

Do not push. If the rev-parse fails, skip the commit.

---

### Task 4: Three colors from interior pixels

**Files:**
- Create: `tools/scheme-c/colors.mjs`
- Create: `tools/scheme-c/colors.test.mjs`
- Test: `tools/scheme-c/colors.test.mjs`

**Interfaces:**
- Consumes: none
- Produces:
  - `topInteriorColors(rgba, width, height, limit)` → `{ rgb: [number, number, number], count: number }[]`，按 count 从大到小，不含贴着透明像素的边
  - `parseColors(text)` → `{ coat: string, hair: string, metal: string }`，每个值必须匹配 `/^#[0-9A-Fa-f]{6}$/`

- [ ] **Step 1: Write the failing test**

```javascript
import { parseColors, topInteriorColors } from './colors.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const w = 6;
const h = 6;
const rgba = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 255;
  }
}
for (let y = 1; y <= 4; y++) {
  for (let x = 1; x <= 4; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = 120; rgba[i + 1] = 20; rgba[i + 2] = 30;
  }
}
rgba[(2 * w + 2) * 4] = 232;
rgba[(2 * w + 2) * 4 + 1] = 240;
rgba[(2 * w + 2) * 4 + 2] = 250;
rgba[(3 * w + 3) * 4] = 200;
rgba[(3 * w + 3) * 4 + 1] = 206;
rgba[(3 * w + 3) * 4 + 2] = 214;

const top = topInteriorColors(rgba, w, h, 3);
assert(top[0].rgb.join() === '120,20,30', 'coat is the interior mass');
assert(top[0].count === 14, '14 wine pixels');
const colors = parseColors('{"coat":"#78141E","hair":"#E8F0FA","metal":"#C8CED6"}');
assert(colors.coat === '#78141E', 'coat hex');
let bad = false;
try { parseColors('{"coat":"wine","hair":"#E8F0FA","metal":"#C8CED6"}'); } catch { bad = true; }
assert(bad, 'rejects a word');
let zero = false;
try { parseColors('{"coat":"#000000","hair":"#E8F0FA","metal":"#C8CED6"}'); } catch { zero = true; }
assert(zero, 'rejects unset black');
console.log('ok');
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
node tools/scheme-c/colors.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
node tools/scheme-c/colors.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

If `git rev-parse --is-inside-work-tree` prints `true`:

```powershell
git add tools/scheme-c/colors.mjs tools/scheme-c/colors.test.mjs
git commit -m "feat: read cassandra block colors from interior pixels"
```

Do not push. If the rev-parse fails, skip the commit.

---

### Task 5: Box the 512 renders and copy idle to -v

**Files:**
- Create: `tools/scheme-c/read-png.mjs`
- Create: `tools/scheme-c/box-renders.mjs`
- Create: `tools/scheme-c/box-renders.test.mjs`
- Test: `tools/scheme-c/box-renders.test.mjs`

**Interfaces:**
- Consumes: `BOARD_FRAMES` from `./frame-set.mjs`, `nearestDown4` 与 `nearestDown8` from `./nearest-down.mjs`, `sameBuffer` from `./foot-line.mjs`
- Produces:
  - `readRgba(pngPath)` → `{ rgba: Buffer, width: number, height: number }`
  - `writeRgba(pngPath, rgba, width, height)` → `Promise<void>`
  - `boxRenders(srcDir, reviewDir)` → `Promise<void>`。`srcDir` 里要有九个 `BOARD_FRAMES` 的 512 PNG。写出 `reviewDir/x64/` 与 `reviewDir/x128/` 各十张 PNG。两套里的 `hero-cassandra-v.png` 都与同套的 `hero-cassandra.png` 字节相同。

`read-png.mjs` 用这一段加载已安装的 sharp，不新装依赖：

```javascript
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../asset-pipeline/package.json', import.meta.url));
const sharp = require('sharp');

export async function readRgba(pngPath) {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, width: info.width, height: info.height };
}

export async function writeRgba(pngPath, rgba, width, height) {
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(pngPath);
}
```

- [ ] **Step 1: Write the failing test**

```javascript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BOARD_FRAMES } from './frame-set.mjs';
import { boxRenders } from './box-renders.mjs';
import { sameBuffer } from './foot-line.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-c-box-'));
const src = path.join(root, 'src');
const out = path.join(root, 'out');
fs.mkdirSync(src);
const pix = Buffer.alloc(512 * 512 * 4, 0);
pix[3] = 255;
for (const name of BOARD_FRAMES) {
  await writeRgba(path.join(src, `${name}.png`), pix, 512, 512);
}
await boxRenders(src, out);
const idle64 = fs.readFileSync(path.join(out, 'x64', 'hero-cassandra.png'));
const variant64 = fs.readFileSync(path.join(out, 'x64', 'hero-cassandra-v.png'));
assert(sameBuffer(idle64, variant64), '-v copies idle at 64');
const idle128 = fs.readFileSync(path.join(out, 'x128', 'hero-cassandra.png'));
const variant128 = fs.readFileSync(path.join(out, 'x128', 'hero-cassandra-v.png'));
assert(sameBuffer(idle128, variant128), '-v copies idle at 128');
const boxed64 = await readRgba(path.join(out, 'x64', 'hero-cassandra-walk-a.png'));
const boxed128 = await readRgba(path.join(out, 'x128', 'hero-cassandra-walk-a.png'));
assert(boxed64.width === 64 && boxed64.height === 64, '64');
assert(boxed128.width === 128 && boxed128.height === 128, '128');
console.log('ok');
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
node tools/scheme-c/box-renders.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./box-renders.mjs` or `./read-png.mjs`.

- [ ] **Step 3: Write `read-png.mjs` exactly as the snippet in Interfaces, then write `box-renders.mjs` as this whole file**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BOARD_FRAMES } from './frame-set.mjs';
import { nearestDown4, nearestDown8 } from './nearest-down.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

async function writeSet(srcDir, reviewDir, boxer) {
  fs.mkdirSync(reviewDir, { recursive: true });
  for (const name of BOARD_FRAMES) {
    const source = await readRgba(path.join(srcDir, `${name}.png`));
    if (source.width !== 512 || source.height !== 512) throw new Error(`${name} is not 512`);
    const boxed = boxer(source.rgba, source.width, source.height);
    await writeRgba(path.join(reviewDir, `${name}.png`), boxed.rgba, boxed.width, boxed.height);
  }
  fs.copyFileSync(
    path.join(reviewDir, 'hero-cassandra.png'),
    path.join(reviewDir, 'hero-cassandra-v.png'),
  );
}

export async function boxRenders(srcDir, reviewDir) {
  await writeSet(srcDir, path.join(reviewDir, 'x64'), nearestDown8);
  await writeSet(srcDir, path.join(reviewDir, 'x128'), nearestDown4);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [srcDir, reviewDir] = process.argv.slice(2);
  if (!srcDir || !reviewDir) {
    console.error('usage: node tools/scheme-c/box-renders.mjs <srcDir512> <reviewDir>');
    process.exit(1);
  }
  await boxRenders(srcDir, reviewDir);
}
```

不要调用 `process.mjs`。

- [ ] **Step 4: Run the test to verify it passes**

```powershell
node tools/scheme-c/box-renders.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

If `git rev-parse --is-inside-work-tree` prints `true`:

```powershell
git add tools/scheme-c/read-png.mjs tools/scheme-c/box-renders.mjs tools/scheme-c/box-renders.test.mjs
git commit -m "feat: box cassandra scheme-c renders to 64 and 128"
```

Do not push. If the rev-parse fails, skip the commit.

---

### Task 6: Comparison board

**Files:**
- Create: `tools/scheme-c/board.mjs`
- Create: `tools/scheme-c/board.test.mjs`
- Test: `tools/scheme-c/board.test.mjs`

**Interfaces:**
- Consumes: `BOARD_FRAMES` from `./frame-set.mjs`，`readRgba` / `writeRgba` from `./read-png.mjs`
- Produces:
  - `boardSize(pairCount, cell = 256, gap = 8)` → `{ width, height, cell, gap }`。三列，宽是 `gap + (cell + gap) * 3`。九行时宽 800、高 2384。
  - `buildBoard(liveDir, block64Dir, block128Dir, outFile)` → `Promise<{ width: number, height: number }>`
  - 左列现网 64 每个像素画成 4×4。中列体块 64 同样 ×4。右列体块 128 每个像素画成 2×2。九行顺序等于 `BOARD_FRAMES`。

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
node tools/scheme-c/board.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
import path from 'node:path';
import { BOARD_FRAMES } from './frame-set.mjs';
import { readRgba, writeRgba } from './read-png.mjs';

export function boardSize(pairCount, cell = 256, gap = 8) {
  return {
    width: gap + (cell + gap) * 3,
    height: gap + pairCount * (cell + gap),
    cell,
    gap,
  };
}

function blitNearest(dst, dstW, src, srcW, srcH, scale, originX, originY) {
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const si = (y * srcW + x) * 4;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const di = ((originY + y * scale + dy) * dstW + (originX + x * scale + dx)) * 4;
          dst[di] = src[si];
          dst[di + 1] = src[si + 1];
          dst[di + 2] = src[si + 2];
          dst[di + 3] = src[si + 3];
        }
      }
    }
  }
}

export async function buildBoard(liveDir, block64Dir, block128Dir, outFile) {
  const { width, height, cell, gap } = boardSize(BOARD_FRAMES.length);
  const dst = Buffer.alloc(width * height * 4, 0);
  for (let row = 0; row < BOARD_FRAMES.length; row++) {
    const name = BOARD_FRAMES[row];
    const live = await readRgba(path.join(liveDir, `${name}.png`));
    const block64 = await readRgba(path.join(block64Dir, `${name}.png`));
    const block128 = await readRgba(path.join(block128Dir, `${name}.png`));
    if (live.width !== 64 || live.height !== 64) throw new Error(`${name} live is not 64`);
    if (block64.width !== 64 || block64.height !== 64) throw new Error(`${name} block 64 is not 64`);
    if (block128.width !== 128 || block128.height !== 128) throw new Error(`${name} block 128 is not 128`);
    const top = gap + row * (cell + gap);
    blitNearest(dst, width, live.rgba, 64, 64, 4, gap, top);
    blitNearest(dst, width, block64.rgba, 64, 64, 4, gap + cell + gap, top);
    blitNearest(dst, width, block128.rgba, 128, 128, 2, gap + (cell + gap) * 2, top);
  }
  await writeRgba(outFile, dst, width, height);
  return { width, height };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
node tools/scheme-c/board.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

If `git rev-parse --is-inside-work-tree` prints `true`:

```powershell
git add tools/scheme-c/board.mjs tools/scheme-c/board.test.mjs
git commit -m "feat: build cassandra scheme-c comparison board"
```

Do not push. If the rev-parse fails, skip the commit.

---

### Task 7: Backup, apply, and restore only Cassandra

**Files:**
- Create: `tools/scheme-c/swap-live.mjs`
- Create: `tools/scheme-c/swap-live.test.mjs`
- Test: `tools/scheme-c/swap-live.test.mjs`

**Interfaces:**
- Consumes: `CASSANDRA_FRAMES` from `./frame-set.mjs`，`readRgba` from `./read-png.mjs`
- Produces:
  - `backupLive({ framesDir, atlasPng, atlasJson, backupDir })`
  - `applyReview({ reviewDir, framesDir, size })`。`size` 是 64 或 128。先确认十张都是这个边长且文件齐全，再复制。任一不对则一张都不写。64 与 128 各换一次，不能混在同一次里。
  - `restoreLive({ backupDir, framesDir, atlasPng, atlasJson })`
- 本文件的源码不得包含字符串 `process.mjs` 或 `quantizePixels`。

- [ ] **Step 1: Write the failing test**

```javascript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { writeRgba } from './read-png.mjs';
import { applyReview, backupLive, restoreLive } from './swap-live.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-c-swap-'));
const frames = path.join(root, 'frames');
const review = path.join(root, 'review');
const backup = path.join(root, 'backup-live');
fs.mkdirSync(frames);
fs.mkdirSync(review);
const live = Buffer.alloc(64 * 64 * 4, 1);
const scheme64 = Buffer.alloc(64 * 64 * 4, 3);
const block = Buffer.alloc(128 * 128 * 4, 2);
const dir64 = path.join(root, 'x64');
fs.mkdirSync(dir64);
for (const name of CASSANDRA_FRAMES) {
  await writeRgba(path.join(frames, `${name}.png`), live, 64, 64);
  await writeRgba(path.join(dir64, `${name}.png`), scheme64, 64, 64);
  await writeRgba(path.join(review, `${name}.png`), block, 128, 128);
}
await writeRgba(path.join(frames, 'hero-violet.png'), live, 64, 64);
fs.writeFileSync(path.join(root, 'characters.png'), 'atlas');
fs.writeFileSync(path.join(root, 'characters.json'), 'json');
const violetBefore = fs.readFileSync(path.join(frames, 'hero-violet.png'));

backupLive({
  framesDir: frames,
  atlasPng: path.join(root, 'characters.png'),
  atlasJson: path.join(root, 'characters.json'),
  backupDir: backup,
});
await applyReview({ reviewDir: review, framesDir: frames, size: 128 });
assert(fs.readFileSync(path.join(frames, 'hero-violet.png')).equals(violetBefore), 'other hero untouched');
const applied = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra.png'));
assert(applied.width === 128, 'applied 128');

let refused = false;
try { await applyReview({ reviewDir: review, framesDir: frames, size: 64 }); } catch { refused = true; }
assert(refused, 'refuses 128 files when size is 64');
const still = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra-walk-a.png'));
assert(still.width === 128, 'failed apply writes nothing');

restoreLive({
  backupDir: backup,
  framesDir: frames,
  atlasPng: path.join(root, 'characters.png'),
  atlasJson: path.join(root, 'characters.json'),
});
await applyReview({ reviewDir: dir64, framesDir: frames, size: 64 });
const applied64 = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra.png'));
assert(applied64.width === 64 && applied64.rgba[0] === 3, 'applied 64');

restoreLive({
  backupDir: backup,
  framesDir: frames,
  atlasPng: path.join(root, 'characters.png'),
  atlasJson: path.join(root, 'characters.json'),
});
const restored = await (await import('./read-png.mjs')).readRgba(path.join(frames, 'hero-cassandra.png'));
assert(restored.width === 64 && restored.rgba[0] === 1, 'restored live');
const src = fs.readFileSync(new URL('./swap-live.mjs', import.meta.url), 'utf8');
assert(!src.includes('process.mjs') && !src.includes('quantizePixels'), 'no quantize path');
console.log('ok');
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
node tools/scheme-c/swap-live.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
node tools/scheme-c/swap-live.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

If `git rev-parse --is-inside-work-tree` prints `true`:

```powershell
git add tools/scheme-c/swap-live.mjs tools/scheme-c/swap-live.test.mjs
git commit -m "feat: swap cassandra scheme-c frames with a backup"
```

Do not push. If the rev-parse fails, skip the commit.

---

### Task 8: Install Blender outside the repo

**Files:**
- Create: `D:\tools\blender-5.2.2-windows-x64\blender.exe`（仓库外，不提交）
- Modify: none inside the repo

**Interfaces:**
- Consumes: 官方 zip
- Produces: 可执行文件。后续任务用 `$env:BLENDER = 'D:\tools\blender-5.2.2-windows-x64\blender.exe'`。若解压目录名不同，把 `BLENDER` 指到实际含 `blender.exe` 的目录，不要把目录搬进仓库。

- [ ] **Step 1: Download and extract**

```powershell
New-Item -ItemType Directory -Force -Path D:\tools | Out-Null
Invoke-WebRequest -Uri "https://download.blender.org/release/Blender5.2/blender-5.2.2-windows-x64.zip" -OutFile "$env:TEMP\blender-5.2.2-windows-x64.zip"
Expand-Archive -Path "$env:TEMP\blender-5.2.2-windows-x64.zip" -DestinationPath D:\tools -Force
Get-ChildItem -Path D:\tools -Recurse -Filter blender.exe | Select-Object -ExpandProperty FullName
```

Expected: 一行路径，以 `blender.exe` 结尾。

- [ ] **Step 2: Verify the version**

把上一步打印的路径赋给 `$env:BLENDER`，然后：

```powershell
& $env:BLENDER --version
```

Expected: 输出含 `Blender 5.2.2`。

- [ ] **Step 3: Do not commit**

Blender 在仓库外。没有仓库文件要提交。不 push。

---

### Task 9: Blender scene settings

**Files:**
- Create: `characters/cassandra/combat/scheme-c/scene_template.py`
- Create: `characters/cassandra/combat/scheme-c/verify-scene.py`
- Test: `verify-scene.py` via Blender

**Interfaces:**
- Consumes: Blender 5.2.2
- Produces: `apply_scheme_c_settings(scene)`。调用后场景满足 Global Constraints 里的烘图参数，并有一台名为 `SchemeCCamera` 的正交相机，设为 `scene.camera`。

- [ ] **Step 1: Write `scene_template.py`**

```python
import bpy
import math

def apply_scheme_c_settings(scene):
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "FLAT"
    shading.color_type = "MATERIAL"
    shading.show_shadows = False
    shading.show_cavity = False
    shading.show_object_outline = False
    scene.display.render_aa = "OFF"
    scene.render.film_transparent = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    cam_data = bpy.data.cameras.new("SchemeCCamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.0
    cam = bpy.data.objects.new("SchemeCCamera", cam_data)
    scene.collection.objects.link(cam)
    cam.rotation_euler = (math.radians(75), 0.0, math.radians(20))
    scene.camera = cam
    return cam
```

`75°` 与 `20°` 只是起步的四分之三，任务 10 还要用现网 idle 对上后再锁。

- [ ] **Step 2: Write `verify-scene.py`**

```python
import bpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from scene_template import apply_scheme_c_settings

scene = bpy.data.scenes[0]
apply_scheme_c_settings(scene)
shading = scene.display.shading
checks = [
    scene.render.engine == "BLENDER_WORKBENCH",
    shading.light == "FLAT",
    shading.color_type == "MATERIAL",
    shading.show_shadows is False,
    shading.show_cavity is False,
    shading.show_object_outline is False,
    scene.display.render_aa == "OFF",
    scene.render.film_transparent is True,
    scene.render.resolution_x == 512,
    scene.render.resolution_y == 512,
    scene.render.resolution_percentage == 100,
    scene.render.image_settings.file_format == "PNG",
    scene.render.image_settings.color_mode == "RGBA",
    scene.render.image_settings.color_depth == "8",
    scene.view_settings.view_transform == "Standard",
    scene.view_settings.exposure == 0.0,
    scene.view_settings.gamma == 1.0,
    scene.camera is not None,
    scene.camera.data.type == "ORTHO",
    scene.camera.name == "SchemeCCamera",
]
if not all(checks):
    sys.exit(1)
print("ok")
```

- [ ] **Step 3: Run it**

```powershell
& $env:BLENDER --background --python characters/cassandra/combat/scheme-c/verify-scene.py
```

Expected: 输出含 `ok`，进程退出码 0。

- [ ] **Step 4: Commit**

If `git rev-parse --is-inside-work-tree` prints `true`:

```powershell
git add characters/cassandra/combat/scheme-c/scene_template.py characters/cassandra/combat/scheme-c/verify-scene.py
git commit -m "feat: lock blender settings for the cassandra scheme-c bake"
```

Do not push. If the rev-parse fails, skip the commit.

---

### Task 10: Build one mesh and render nine poses

**Files:**
- Create: `characters/cassandra/combat/scheme-c/colors.json`
- Create: `characters/cassandra/combat/scheme-c/cassandra-block.blend`
- Create: `characters/cassandra/review/20261019-scheme-c/src/*.png`（九张 512）
- Create: `tools/scheme-c/check-renders.mjs`
- Test: `node tools/scheme-c/check-renders.mjs`

**Interfaces:**
- Consumes: `contentSpan`、`spansMatch`、`sameBuffer`、`readRgba`、`CASSANDRA_FRAMES`、`BOARD_FRAMES`、`boxRenders`
- Produces: 过目夹里的 `x64/` 与 `x128/` 各十张 PNG。`checkRenders(dir64, dir128, liveIdlePath)` 在两套的尺寸、硬透明、各自脚底相同、高度比、`-v` 字节相同都成立，且 `Math.abs(footY128 - footY64 * 2) <= 1` 时返回 `{ footY64, footY128 }`，否则抛错。

- [ ] **Step 1: Write `check-renders.mjs` and its failing test first**

Create `tools/scheme-c/check-renders.test.mjs`:

```javascript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASSANDRA_FRAMES } from './frame-set.mjs';
import { checkRenders } from './check-renders.mjs';
import { writeRgba } from './read-png.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function solid(w, h, top, foot) {
  const rgba = Buffer.alloc(w * h * 4, 0);
  for (let y = top; y <= foot; y++) rgba[(y * w + 4) * 4 + 3] = 255;
  return rgba;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-c-check-'));
const dir64 = path.join(root, 'x64');
const dir128 = path.join(root, 'x128');
fs.mkdirSync(dir64);
fs.mkdirSync(dir128);
const live = path.join(root, 'live.png');
await writeRgba(live, solid(64, 64, 16, 47), 64, 64);
const pix64 = solid(64, 64, 16, 47);
const pix128 = solid(128, 128, 32, 95);
for (const name of CASSANDRA_FRAMES) {
  await writeRgba(path.join(dir64, `${name}.png`), pix64, 64, 64);
  await writeRgba(path.join(dir128, `${name}.png`), pix128, 128, 128);
}
const result = await checkRenders(dir64, dir128, live);
assert(result.footY64 === 47 && result.footY128 === 95, 'shared feet');
console.log('ok');
```

Run:

```powershell
node tools/scheme-c/check-renders.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

Then write `tools/scheme-c/check-renders.mjs`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { BOARD_FRAMES, CASSANDRA_FRAMES } from './frame-set.mjs';
import { contentSpan, sameBuffer, spansMatch } from './foot-line.mjs';
import { readRgba } from './read-png.mjs';

export async function checkRenders(dir64, dir128, liveIdlePath) {
  const live = await readRgba(liveIdlePath);
  if (live.width !== 64 || live.height !== 64) throw new Error('live idle is not 64');
  const liveSpan = contentSpan(live.rgba, live.width, live.height);
  const footY64 = await checkSet(dir64, 64, liveSpan);
  const footY128 = await checkSet(dir128, 128, liveSpan);
  if (Math.abs(footY128 - footY64 * 2) > 1) throw new Error('64 and 128 feet diverge');
  if (BOARD_FRAMES.length !== 9) throw new Error('board');
  return { footY64, footY128 };
}

async function checkSet(dir, size, liveSpan) {
  const idle = fs.readFileSync(path.join(dir, 'hero-cassandra.png'));
  const variant = fs.readFileSync(path.join(dir, 'hero-cassandra-v.png'));
  if (!sameBuffer(idle, variant)) throw new Error(`${size} -v is not idle`);
  let footY = null;
  for (const name of CASSANDRA_FRAMES) {
    const image = await readRgba(path.join(dir, `${name}.png`));
    if (image.width !== size || image.height !== size) throw new Error(`${name} is not ${size}`);
    for (let i = 3; i < image.rgba.length; i += 4) {
      const alpha = image.rgba[i];
      if (alpha !== 0 && alpha !== 255) throw new Error(`${name} partial alpha`);
    }
    const span = contentSpan(image.rgba, size, size);
    if (!spansMatch(liveSpan.span, 64, span.span, size)) throw new Error(`${name} span`);
    if (footY === null) footY = span.footY;
    if (span.footY !== footY) throw new Error(`${name} foot ${span.footY} != ${footY}`);
  }
  return footY;
}
```

```powershell
node tools/scheme-c/check-renders.test.mjs
```

Expected: `ok`

- [ ] **Step 2: Record the three colors**

```powershell
node --input-type=module -e "import { readRgba } from './tools/scheme-c/read-png.mjs'; import { topInteriorColors } from './tools/scheme-c/colors.mjs'; const img = await readRgba('assets/frames/hero-cassandra.png'); console.log(topInteriorColors(img.rgba, img.width, img.height, 5));"
```

Expected: 五行以内的 `{ rgb, count }`。打开 `assets/frames/hero-cassandra.png` 放大到 400%。大衣取躯干上最大的一块酒红，头发取马尾上的银，金属取最小的那块银。三个值都写成 `#RRGGBB`。若取到的大衣不在这五行里，停下来重取，不要新发明一个酒红。

把结果写成 `characters/cassandra/combat/scheme-c/colors.json`：

```json
{"coat":"#000000","hair":"#000000","metal":"#000000"}
```

三个 `#000000` 换成实际取到的 hex。然后：

```powershell
node --input-type=module -e "import fs from 'node:fs'; import { parseColors } from './tools/scheme-c/colors.mjs'; parseColors(fs.readFileSync('characters/cassandra/combat/scheme-c/colors.json','utf8')); console.log('ok');"
```

Expected: `ok`

- [ ] **Step 3: Model one mesh**

在 Blender 里执行 `apply_scheme_c_settings`，另存为 `characters/cassandra/combat/scheme-c/cassandra-block.blend`。

把 `assets/frames/hero-cassandra.png` 设成 `SchemeCCamera` 的背景图，只用于对位。建这些独立色块，每块一个材质，颜色用 `colors.json`：马尾一块楔形、高领、收腰躯干、三角下摆大衣、两条腿、两只靴。不要毛发缕，不要披风帆，不要把 `h23.png` 当贴图。外形与 `characters/cassandra/identity/silhouette/lock-ce.png` 不一致时改模型，不改剪影。

调 `ortho_scale` 和模型位置，直到人物的头到脚占 512 画面的比例，与现网 idle 占 64 画面的比例一致，脚落在十张都将共用的那一行。对上之后把背景图从相机上移除。记下此时的相机位置、旋转和 `ortho_scale`，后面九张不许改。

- [ ] **Step 4: Render nine 512 PNG files**

输出目录 `characters/cassandra/review/20261019-scheme-c/src/`。每张渲染前只改骨骼姿势，不改块的尺寸、颜色和相机。

| 文件 | 姿势 |
|---|---|
| `hero-cassandra.png` | 四分之三站立 |
| `hero-cassandra-walk-a.png` | 朝右的脚跟着地 |
| `hero-cassandra-walk-e.png` | 从 a 收到身下 |
| `hero-cassandra-walk-b.png` | 两腿在身下并拢 |
| `hero-cassandra-walk-c.png` | 另一只脚跟着地 |
| `hero-cassandra-walk-f.png` | 从 c 收到身下 |
| `hero-cassandra-walk-d.png` | 第二次并拢 |
| `hero-cassandra-skill-a.png` | 与站立一眼能分开，无拖尾 |
| `hero-cassandra-skill-b.png` | 与站立和 skill-a 都能分开，无拖尾 |

不渲染 `-v`。

- [ ] **Step 5: Box and check**

```powershell
node tools/scheme-c/box-renders.mjs characters/cassandra/review/20261019-scheme-c/src characters/cassandra/review/20261019-scheme-c
node --input-type=module -e "import { checkRenders } from './tools/scheme-c/check-renders.mjs'; const r = await checkRenders('characters/cassandra/review/20261019-scheme-c/x64', 'characters/cassandra/review/20261019-scheme-c/x128', 'assets/frames/hero-cassandra.png'); console.log(r.footY64 + ' ' + r.footY128);"
```

Expected: 第二行是两个整数，64 的脚底在 0 到 63，128 的脚底在 0 到 127，且两者大约是两倍。进程退出码 0。失败就改模型或相机后再烘，不要改检查脚本来放行，也不要跑 `process.mjs`。

- [ ] **Step 6: Build the board**

```powershell
node --input-type=module -e "import { buildBoard } from './tools/scheme-c/board.mjs'; await buildBoard('assets/frames', 'characters/cassandra/review/20261019-scheme-c/x64', 'characters/cassandra/review/20261019-scheme-c/x128', 'characters/cassandra/review/20261019-scheme-c/00-board.png'); console.log('ok');"
```

Expected: `ok`，并生成 `characters/cassandra/review/20261019-scheme-c/00-board.png`。

- [ ] **Step 7: Commit the code and the color file, not the blend renders, only if git is present**

`.blend` 与烘出的 PNG 留在角色目录。若 `git rev-parse --is-inside-work-tree` 打印 `true`，只提交检查脚本：

```powershell
git add tools/scheme-c/check-renders.mjs tools/scheme-c/check-renders.test.mjs characters/cassandra/combat/scheme-c/colors.json
git commit -m "feat: check cassandra scheme-c renders before anyone sees them"
```

Do not push. 不要把 `assets/frames/` 加进这次提交。

---

### Task 11: Principal looks at the board

**Files:**
- Create: `characters/cassandra/review/20261019-scheme-c/review-notes.md`
- Modify: none

**Interfaces:**
- Consumes: `00-board.png`
- Produces: 四句都写明是或否。有任一否，任务 12 不执行。

- [ ] **Step 1: Read the board at the pixels it contains**

打开 `characters/cassandra/review/20261019-scheme-c/00-board.png`。左列是现网 64，中列是体块 64，右列是体块 128。三列都已放到同样的 256。不在 Blender 视口里下结论。中列和左列比的是同一像素格子里的画法。右列看的是提高分辨率后，64 丢掉的马尾、收腰和下摆还剩多少。

- [ ] **Step 2: Write the four answers**

`review-notes.md` 使用这四行，把括号里的字换成「是」或「否」：

```markdown
# 工作流 C 试点过目

## 体块 64（中列，对左列现网）

1. 还是她：马尾刃、收腰、三角下摆还在。（是/否）
2. 三块色还在：酒红大衣、银发、一小块银金属。（是/否）
3. 六步有离地和重心移动；两个技能和 idle 一眼能分开。（是/否）
4. 没有外描边、空心、脏边、碎点。十张脚在同一行，`-v` 是 idle 的同一张。（是/否）

## 体块 128（右列）

1. 还是她：马尾刃、收腰、三角下摆还在。（是/否）
2. 三块色还在：酒红大衣、银发、一小块银金属。（是/否）
3. 六步有离地和重心移动；两个技能和 idle 一眼能分开。（是/否）
4. 没有外描边、空心、脏边、碎点。十张脚在同一行，`-v` 是 idle 的同一张。（是/否）

128 比 64 多留下的设计：
```

下摆和现网差几个像素不作为否。旁边将来仍是旧画法的角色，不在这四句里判死。

- [ ] **Step 3: Stop or continue**

两套的第 4 句都必须是「是」，才做任务 12。第 1–3 句在 64 上为「否」，记成 64 丢掉的设计，不单独阻止进游戏。128 上的「否」同样写明，任务 12 仍把两套都换上去看，除非第 4 句为否。

这一步不提交，除非四句已经写好且 `git rev-parse --is-inside-work-tree` 为 `true`。即使提交，也不 push。

---

### Task 12: Short in-game comparison, then restore

**Files:**
- Modify: `assets/frames/hero-cassandra.png`
- Modify: `assets/frames/hero-cassandra-v.png`
- Modify: `assets/frames/hero-cassandra-walk-a.png`
- Modify: `assets/frames/hero-cassandra-walk-e.png`
- Modify: `assets/frames/hero-cassandra-walk-b.png`
- Modify: `assets/frames/hero-cassandra-walk-c.png`
- Modify: `assets/frames/hero-cassandra-walk-f.png`
- Modify: `assets/frames/hero-cassandra-walk-d.png`
- Modify: `assets/frames/hero-cassandra-skill-a.png`
- Modify: `assets/frames/hero-cassandra-skill-b.png`
- Modify: `assets/atlas/characters.png`
- Modify: `assets/atlas/characters.json`
- Create: `characters/cassandra/review/20261019-scheme-c/backup-live/`

这些修改在本任务最后一步全部还原。

**Interfaces:**
- Consumes: `backupLive`、`applyReview`、`restoreLive`
- Produces: 还原后的现网十张帧与 characters 图集，字节与 `backup-live/` 里的副本一致

- [ ] **Step 1: Confirm both columns passed the technical line**

读 `review-notes.md`。任一套的第 4 句是「否」就停。不要为了进游戏改 `frame-specs.mjs`。

- [ ] **Step 2: Backup once, then play the 64 set**

```powershell
node --input-type=module -e "import { backupLive, applyReview } from './tools/scheme-c/swap-live.mjs'; backupLive({ framesDir: 'assets/frames', atlasPng: 'assets/atlas/characters.png', atlasJson: 'assets/atlas/characters.json', backupDir: 'characters/cassandra/review/20261019-scheme-c/backup-live' }); await applyReview({ reviewDir: 'characters/cassandra/review/20261019-scheme-c/x64', framesDir: 'assets/frames', size: 64 }); console.log('ok');"
node tools/asset-pipeline/pack.mjs characters
npm run dev
```

Expected: 第一行 `ok`。打包退出码 0。浏览器打开 Vite 地址，点「血猎手·卡珊德拉」，WASD 走一段，Space 或 Shift 放一次「血影突袭」。这一遍的世界缩放仍是 2，和现网同一格子。看完在 `review-notes.md` 写一行「游戏 64：」。

- [ ] **Step 3: Restore, then play the 128 set**

```powershell
node --input-type=module -e "import { restoreLive, applyReview } from './tools/scheme-c/swap-live.mjs'; restoreLive({ backupDir: 'characters/cassandra/review/20261019-scheme-c/backup-live', framesDir: 'assets/frames', atlasPng: 'assets/atlas/characters.png', atlasJson: 'assets/atlas/characters.json' }); await applyReview({ reviewDir: 'characters/cassandra/review/20261019-scheme-c/x128', framesDir: 'assets/frames', size: 128 }); console.log('ok');"
node tools/asset-pipeline/pack.mjs characters
```

停掉上一次的 `npm run dev`，再执行一次 `npm run dev`。同样选卡珊德拉，走一段，放一次技能。这一遍帧宽 128，世界缩放是 1，人的世界边仍是 128，像素更密。看 64 那遍丢掉的马尾、收腰、下摆是否还在。在 `review-notes.md` 写一行「游戏 128：」。不要运行 `node tools/asset-pipeline/process.mjs`。

- [ ] **Step 4: Restore the same day**

```powershell
node --input-type=module -e "import { restoreLive } from './tools/scheme-c/swap-live.mjs'; restoreLive({ backupDir: 'characters/cassandra/review/20261019-scheme-c/backup-live', framesDir: 'assets/frames', atlasPng: 'assets/atlas/characters.png', atlasJson: 'assets/atlas/characters.json' }); console.log('ok');"
node --input-type=module -e "import fs from 'node:fs'; import { CASSANDRA_FRAMES } from './tools/scheme-c/frame-set.mjs'; import { sameBuffer } from './tools/scheme-c/foot-line.mjs'; const dir = 'characters/cassandra/review/20261019-scheme-c/backup-live'; for (const name of CASSANDRA_FRAMES) { const a = fs.readFileSync('assets/frames/' + name + '.png'); const b = fs.readFileSync(dir + '/' + name + '.png'); if (!sameBuffer(a, b)) throw new Error(name); } if (!sameBuffer(fs.readFileSync('assets/atlas/characters.png'), fs.readFileSync(dir + '/characters.png'))) throw new Error('atlas'); console.log('ok');"
```

Expected: 两行都是 `ok`。现网十张帧和图集与备份字节相同。

不要把这次短暂覆盖提交进 git。不 push。主理人没有另写「留下」之前，到此结束。64 和 128 两套试烘都留在过目夹，不留在 `assets/frames/`。
