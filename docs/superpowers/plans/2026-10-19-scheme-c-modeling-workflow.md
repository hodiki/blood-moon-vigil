# Scheme C Modeling Workflow Correction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把卡珊德拉体块试点从「方块脚本凑检查」改成「零件对着现网 64 长，并在目标像素上直接验收」。

**Architecture:** 现有 Workbench 平涂、正交、无抗锯齿、Standard 色彩是对的，不改这组渲染参数。错的是两处：模型没有按剪影的大块来建，512 图再用每 8 个像素取 1 个点缩到 64，边上一格就会翻掉。下一轮先把缩小改成 8×8 覆盖率，并让 Blender 直接烘 64 和 128；模型按零件重搭，idle 的 64 图不过目就不烘九张。

**Tech Stack:** 已安装的 Blender 5.2.2（`D:\tools\blender-5.2.2-windows-x64\blender.exe`）、Node `C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`、现有 `tools/scheme-c/`。

## Global Constraints

- 不装视口 MCP。现有后台烘图加像素测量够做校正。
- 不改 `assets/frames/`，不跑 `tools/asset-pipeline/process.mjs`，不把试烘写成已过。
- 不建 git worktree，不 `git init`，不 push。`git` 不在 PATH 上时跳过 commit。
- 渲染参数保持 `characters/cassandra/combat/scheme-c/scene_template.py`：Workbench、Flat、Material、无阴影、无抗锯齿、Film Transparent、View Transform Standard、PNG RGBA 8 bit。
- 颜色仍是 `characters/cassandra/combat/scheme-c/colors.json` 的三块：大衣 `#3A1F24`、头发 `#C4B8A8`、金属 `#8A8074`。
- 禁止用布尔开槽去满足「这一行有空像素」。空档必须是零件之间的缝，例如开口、两腿、马尾和头的交界。

## 调研结论

2026-10-19 第二轮 idle，三张图对齐脚底后对照现网 `assets/frames/hero-cassandra.png`：

| 图 | 实际是什么 |
|---|---|
| `review/20261019-scheme-c/src/hero-cassandra.png` | 512 原图。马尾是飘在头上的楔形，腰是大衣上挖出的矩形孔，下摆是一块多边形，靴在裙摆下面分开 |
| `review/20261019-scheme-c/x64/hero-cassandra.png` | 从 512 每 8 像素取 1 个点。同一轮廓，边被抽掉 |
| 现网 64 | 马尾从头顶向后、收腰、尖下摆、靴跟、枪，内部还有头发和衣褶 |

把现网和体块 64 按脚底对齐（体块比现网低 1 像素）：重叠 332 像素，只有现网有的 246，只有体块有的 236。并集 814，重叠率 332/814 = 0.41。差距在轮廓，不是在 128 不够大。

512 缩到 64 时，4096 个 8×8 格里有 227 格是半实半空。点取样和「过半才算实心」有 95 格结论相反。点取样不透明像素 568，过半取样 557。所以渲染分辨率这条路会改边，但改不出现网那 246 个像素。那些像素在 512 原图里就不存在。

三问的答案：

1. **渲染参数没有做错。** 平涂、正交、无抗锯齿、无影子，符合体块。做错的是分辨率路径：先烘 512，再 `nearestDown8` 只取 `(x * 8, y * 8)` 那一个点。细缝如果没压在取样点上，64 上就消失。上一轮把腰上的孔加宽，就是为了躲开这个取样。
2. **模型做得不对，这是大头。** 不是面数少。方块可以，但方块的外形要是马尾、高领、收腰、两侧不对称的下摆、开口外的靴和跟。现在的网格是楔形条、带矩形孔的棱柱、分开的靴。
3. **工作流从一开始就没有按建模来排。** `build_cassandra.py` 先摆方块，检查不过就改数字或挖孔，直到脚本打印 pass。没有把现网 64 垫进相机，也没有一块零件一块零件看 64 图。检查能让直筒失败，也能让一个矩形孔通过。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `tools/scheme-c/coverage-down.mjs` | 8×8 或 4×4 里过半不透明才保留该像素，颜色取格内最多的不透明色 |
| `tools/scheme-c/box-renders.mjs` | 512 入盒改走覆盖率，不再走点取样 |
| `tools/scheme-c/outline-overlap.mjs` | 脚底对齐后数现网与体块的重叠、只在现网、只在体块 |
| `characters/cassandra/combat/scheme-c/build_cassandra.py` | 去掉 `punch`。先只烘 idle 的 64，看图再改零件 |
| `characters/cassandra/combat/scheme-c/scene_template.py` | 增加按 64 或 128 直接烘的分辨率，不改其它渲染参数 |

`nearestDown4` / `nearestDown8` 留着，给旧测试。新的入盒只用 `coverageDown`。

---

### Task 1: Coverage downsample

**Files:**
- Create: `tools/scheme-c/coverage-down.mjs`
- Create: `tools/scheme-c/coverage-down.test.mjs`
- Test: `tools/scheme-c/coverage-down.test.mjs`

**Interfaces:**
- Consumes: none
- Produces: `coverageDown(rgba, width, height, factor)` → `{ rgba: Buffer, width: number, height: number }`。`factor` 只能是 4 或 8。一个输出像素对应的 `factor × factor` 格里，不透明像素不少于一半才写上；颜色是这些不透明像素里出现最多的 RGB。少于一半则 alpha 为 0。

- [ ] **Step 1: Write the failing test**

```javascript
import { coverageDown } from './coverage-down.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rgba = Buffer.alloc(8 * 8 * 4, 0);
for (let i = 0; i < 8; i++) {
  const p = i * 4;
  rgba[p] = 10;
  rgba[p + 3] = 255;
}
const missed = coverageDown(rgba, 8, 8, 8);
assert(missed.rgba[3] === 0, 'one corner pixel is not coverage');

for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 4; x++) {
    const p = (y * 8 + x) * 4;
    rgba[p] = 20;
    rgba[p + 1] = 0;
    rgba[p + 2] = 0;
    rgba[p + 3] = 255;
  }
}
const kept = coverageDown(rgba, 8, 8, 8);
assert(kept.width === 1 && kept.height === 1, 'one cell');
assert(kept.rgba[0] === 20 && kept.rgba[3] === 255, 'majority color');
console.log('ok');
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `D:\code\vampire-survivors-like`:

```powershell
& "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" tools/scheme-c/coverage-down.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./coverage-down.mjs`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
export function coverageDown(rgba, width, height, factor) {
  if (factor !== 4 && factor !== 8) throw new Error('factor');
  if (width % factor !== 0 || height % factor !== 0) throw new Error('size');
  const dw = width / factor;
  const dh = height / factor;
  const out = Buffer.alloc(dw * dh * 4, 0);
  const need = Math.ceil((factor * factor) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const colors = new Map();
      let opaque = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const si = ((y * factor + dy) * width + (x * factor + dx)) * 4;
          if (rgba[si + 3] !== 255) continue;
          opaque += 1;
          const key = `${rgba[si]},${rgba[si + 1]},${rgba[si + 2]}`;
          colors.set(key, (colors.get(key) || 0) + 1);
        }
      }
      if (opaque < need) continue;
      let best = null;
      let count = 0;
      for (const [key, n] of colors) {
        if (n > count) {
          best = key;
          count = n;
        }
      }
      const [r, g, b] = best.split(',').map(Number);
      const di = (y * dw + x) * 4;
      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
      out[di + 3] = 255;
    }
  }
  return { rgba: out, width: dw, height: dh };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
& "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" tools/scheme-c/coverage-down.test.mjs
```

Expected: `ok`

- [ ] **Step 5: Commit**

If `git` 不存在，跳过。不 push。

```powershell
git add tools/scheme-c/coverage-down.mjs tools/scheme-c/coverage-down.test.mjs
git commit -m "feat: downsample scheme-c renders by cell coverage"
```

---

### Task 2: Box with coverage, and report the silhouette gap

**Files:**
- Modify: `tools/scheme-c/box-renders.mjs`
- Create: `tools/scheme-c/outline-overlap.mjs`
- Create: `tools/scheme-c/outline-overlap.test.mjs`
- Test: `tools/scheme-c/box-renders.test.mjs`
- Test: `tools/scheme-c/outline-overlap.test.mjs`

**Interfaces:**
- Consumes: `coverageDown` from `./coverage-down.mjs`，`contentSpan` from `./foot-line.mjs`，`readRgba` from `./read-png.mjs`
- Produces:
  - `boxRenders` 写 `x64/` 时用 `coverageDown(..., 8)`，写 `x128/` 时用 `coverageDown(..., 4)`
  - `outlineOverlap(live, block)` → `{ onlyLive: number, onlyBlock: number, both: number, dy: number }`。`dy` 是把 block 的脚底移到 live 脚底要加的行数。只统计移动后仍落在 64×64 里的像素。

- [ ] **Step 1: Write the failing overlap test**

```javascript
import { outlineOverlap } from './outline-overlap.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function solid(y, x0, x1) {
  const rgba = Buffer.alloc(64 * 64 * 4, 0);
  for (let x = x0; x <= x1; x++) rgba[(y * 64 + x) * 4 + 3] = 255;
  return { rgba, width: 64, height: 64 };
}

const live = solid(40, 10, 12);
const block = solid(41, 10, 14);
const gap = outlineOverlap(live, block);
assert(gap.dy === -1, 'shift block up onto the live foot');
assert(gap.both === 3, 'three shared pixels');
assert(gap.onlyBlock === 2, 'two extra block pixels');
assert(gap.onlyLive === 0, 'live is covered');
console.log('ok');
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
& "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" tools/scheme-c/outline-overlap.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for `./outline-overlap.mjs`.

- [ ] **Step 3: Write `outline-overlap.mjs`**

```javascript
import { contentSpan } from './foot-line.mjs';

export function outlineOverlap(live, block) {
  const liveFoot = contentSpan(live.rgba, live.width, live.height).footY;
  const blockFoot = contentSpan(block.rgba, block.width, block.height).footY;
  const dy = liveFoot - blockFoot;
  let onlyLive = 0;
  let onlyBlock = 0;
  let both = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const ly = y + dy;
      const liveOn = ly >= 0 && ly < 64 && live.rgba[(ly * 64 + x) * 4 + 3] === 255;
      const blockOn = block.rgba[(y * 64 + x) * 4 + 3] === 255;
      if (liveOn && blockOn) both += 1;
      else if (liveOn) onlyLive += 1;
      else if (blockOn) onlyBlock += 1;
    }
  }
  return { onlyLive, onlyBlock, both, dy };
}
```

- [ ] **Step 4: Switch `box-renders.mjs` off point sampling**

把 `nearestDown4` / `nearestDown8` 的 import 换成：

```javascript
import { coverageDown } from './coverage-down.mjs';
```

`writeSet` 的调用改成：

```javascript
export async function boxRenders(srcDir, reviewDir) {
  await writeSet(srcDir, path.join(reviewDir, 'x64'), (rgba, width, height) => coverageDown(rgba, width, height, 8));
  await writeSet(srcDir, path.join(reviewDir, 'x128'), (rgba, width, height) => coverageDown(rgba, width, height, 4));
}
```

- [ ] **Step 5: Run both tests**

```powershell
& "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" tools/scheme-c/outline-overlap.test.mjs
& "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" tools/scheme-c/box-renders.test.mjs
```

Expected: 两行都是 `ok`。`box-renders.test.mjs` 里那张 512 只有一个角点不透明，覆盖率入盒后 64 和 128 都会变成全透明。若测试还在断言能读到那个角点，把断言改成 alpha 为 0，因为一个点不够半格。

- [ ] **Step 6: Commit**

`git` 不在 PATH 就跳过。不 push。

```powershell
git add tools/scheme-c/outline-overlap.mjs tools/scheme-c/outline-overlap.test.mjs tools/scheme-c/box-renders.mjs tools/scheme-c/box-renders.test.mjs
git commit -m "feat: score scheme-c silhouettes and keep cell coverage"
```

---

### Task 3: Render the review frames at 64 and 128

**Files:**
- Modify: `characters/cassandra/combat/scheme-c/scene_template.py`
- Modify: `characters/cassandra/combat/scheme-c/build_cassandra.py`
- Test: Blender `--background` 烘一张 64 idle

**Interfaces:**
- Consumes: `apply_scheme_c_settings(scene)`
- Produces: `apply_scheme_c_settings(scene, resolution)`。`resolution` 缺省 512；传入 64 或 128 时只改 `resolution_x`、`resolution_y`。其它渲染参数不变。

- [ ] **Step 1: Add the resolution argument**

`scene_template.py` 的函数签名改为：

```python
def apply_scheme_c_settings(scene, resolution=512):
    if resolution not in (64, 128, 512):
        raise ValueError(resolution)
```

把原来的 `scene.render.resolution_x = 512` 和 `resolution_y = 512` 改成：

```python
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
```

- [ ] **Step 2: Verify 64 still has the flat render settings**

```powershell
& "D:\tools\blender-5.2.2-windows-x64\blender.exe" --background --python "characters/cassandra/combat/scheme-c/verify-scene.py"
```

Expected: 输出含 `ok`。`verify-scene.py` 不传分辨率，仍检查 512。

- [ ] **Step 3: Remove the boolean slit**

在 `build_cassandra.py` 删除 `punch` 函数，以及 `build()` 里的 `punch(coat, ...)` 调用。腰上的空档只能来自大衣开口或手臂和身体之间的缝，不能再挖矩形孔。

- [ ] **Step 4: Commit**

`git` 不在 PATH 就跳过。不 push。

```powershell
git add characters/cassandra/combat/scheme-c/scene_template.py characters/cassandra/combat/scheme-c/build_cassandra.py
git commit -m "feat: render scheme-c reviews at the pixel size"
```

---

### Task 4: Rebuild the idle mesh against the live 64

**Files:**
- Modify: `characters/cassandra/combat/scheme-c/build_cassandra.py`
- Create: `characters/cassandra/review/20261019-scheme-c/idle-64.png`
- Test: `outlineOverlap` 对这张 64 idle，以及目视四块外形

**Interfaces:**
- Consumes: `apply_scheme_c_settings(scene, 64)`，`outlineOverlap`
- Produces: 一张 64 idle。不过目就不烘走路。

零件必须都能在 64 上指到，坐标在这一步里改，不沿用现在的 `COAT` / `TAIL`：

| 零件 | 64 上要看见的 |
|---|---|
| 马尾 | 从头顶向后的一条，比头长，和头连着 |
| 头 | 在马尾前面，一小块银 |
| 高领 | 比颈宽，在头下面 |
| 大衣 | 腰比胸窄进轮廓，下摆两侧一长一短，有尖 |
| 开口 | 腿在开口外面，中间是空的，不是酒红方块，也不是矩形孔 |
| 靴和跟 | 跟在靴下面，脚底不是一根实心横条 |
| 枪 | 金属块伸出大衣外，至少 3 像素 |

相机用四分之三，能同时看见脑后马尾和大衣侧面。`scene_template.py` 里那个 75°/20° 只是占位，以这一步对上现网 idle 的角度为准，对上之后写死。

- [ ] **Step 1: Render only the idle at 64**

```powershell
$env:SCHEME_C_ONLY = "hero-cassandra"
$env:SCHEME_C_RESOLUTION = "64"
& "D:\tools\blender-5.2.2-windows-x64\blender.exe" --background --python "characters/cassandra/combat/scheme-c/build_cassandra.py"
```

`build_cassandra.py` 读取 `SCHEME_C_RESOLUTION`，把它传给 `apply_scheme_c_settings`。输出写到 `characters/cassandra/review/20261019-scheme-c/idle-64.png`。

- [ ] **Step 2: Measure, then look**

```powershell
& "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" --input-type=module -e "import { readRgba } from './tools/scheme-c/read-png.mjs'; import { outlineOverlap } from './tools/scheme-c/outline-overlap.mjs'; const live = await readRgba('assets/frames/hero-cassandra.png'); const block = await readRgba('characters/cassandra/review/20261019-scheme-c/idle-64.png'); console.log(JSON.stringify(outlineOverlap(live, block)));"
```

打开 `idle-64.png`，和 `assets/frames/hero-cassandra.png` 并排。数字只说明还差多少。过不过看这四样能不能指到：马尾、腰的收口、两个下摆尖、分开的跟。指不到就改 `build_cassandra.py` 里对应的那一个零件，回到 Step 1。不要加布尔孔。同一零件连续三轮还指不到，停下来把这三张 64 图留给主理人，不要烘九张。

- [ ] **Step 3: Stop for the idle picture**

四样都能指到之后，把 `outlineOverlap` 的四个数字写进 `characters/cassandra/review/20261019-scheme-c/idle-notes.md`。没有这四样，任务 5 不开始。

---

### Task 5: Bake the nine poses only after the idle is recognizable

**Files:**
- Modify: `characters/cassandra/combat/scheme-c/build_cassandra.py` 的 `POSES`
- Create: `characters/cassandra/review/20261019-scheme-c/00-board.png`
- Test: 接触步的脚和 idle 不是同一处；十张脚底同一行

**Interfaces:**
- Consumes: 任务 4 锁死的相机、大衣、马尾、靴
- Produces: 九张 64、九张 128，以及三列并排板。现网仍在左列。

姿势只动靴、跟和枪。大衣和马尾不动。接触步的前靴要明显离开 idle 的靴位，另一只靴离地。裙摆把腿全挡住，就按剪影把开口那一侧裁短，然后回到任务 4 重看 idle。

- [ ] **Step 1: Render 64 and 128 for all nine names**

```powershell
Remove-Item Env:SCHEME_C_ONLY -ErrorAction SilentlyContinue
$env:SCHEME_C_RESOLUTION = "64"
& "D:\tools\blender-5.2.2-windows-x64\blender.exe" --background --python "characters/cassandra/combat/scheme-c/build_cassandra.py"
$env:SCHEME_C_RESOLUTION = "128"
& "D:\tools\blender-5.2.2-windows-x64\blender.exe" --background --python "characters/cassandra/combat/scheme-c/build_cassandra.py"
```

64 的文件进 `x64/`，128 的文件进 `x128/`。`-v` 仍是 idle 的同一张拷贝。不要再用 512 点取样生成这两套。

- [ ] **Step 2: Rebuild the board from those files**

```powershell
& "C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" --input-type=module -e "import { buildBoard } from './tools/scheme-c/board.mjs'; await buildBoard('assets/frames', 'characters/cassandra/review/20261019-scheme-c/x64', 'characters/cassandra/review/20261019-scheme-c/x128', 'characters/cassandra/review/20261019-scheme-c/00-board.png'); console.log('ok');"
```

Expected: `ok`。不换 `assets/frames/`。主理人看板之前，流程停在这里。
