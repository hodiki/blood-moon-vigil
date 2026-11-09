# `assets/raw/_retired/` —— 退役原图（不要放回上一级）

本目录存放**已退出管线**的 `assets/raw/*.png`。文件名保持原契约帧名（未加后缀），
因为 **`process.mjs` 只做 `fs.readdirSync(assets/raw)` 的扁平读取**，子目录不会被扫到
（`process.mjs:310-316 listRawFrames` / `:346 loadPrepared` 均为 `path.join(RAW_DIR, name + '.png')`，
无递归 glob）；也不必改名去骗过 `isKnownFrame`。

## 退役原因

**批次 B（2026-11-06 · 守誓者可视化补充 · NV-ENG-EXEC-21）**：

- 批次 A 已把 `tools/asset-pipeline/frame-specs.mjs` 中 `summon-oathkeeper` / `summon-oathkeeper-v`
  的契约由 `48×48` 升为 **`192×192`**（`kernel: 'nearest'`）。
- `assets/frames/summon-oathkeeper.png` / `-v.png` 已按 192 契约落盘（`characters/oathkeeper/review/20261104-oath/sets/`，
  已在 `tools/scheme-c/box-knight.mjs` 入过盒：192 画布 / 脚底 191 / 族共享 scale）。
- 若这两张旧 raw（1024×1024 底图，目标是 48 时代）继续留在 `assets/raw/`，任何人跑
  `process.mjs summon-oathkeeper`、`process.mjs summon-oathkeeper-walk-b`（`expandToFamilies` 会把同族 raw 一起拉进来）
  或 `process.mjs --all`，都会**用旧 48 素材放大重采样，覆盖掉新的 192 帧**，且 `validate()` 只查尺寸
  → 会判 **PASS**，无人能拦。
- 因此把这两张移出管线（`NO_RAW` 而不是"反向覆盖"），文件本身保留以便回溯。

## 未退役（有意保留）

| 文件 | 为什么还留在 `assets/raw/` |
|---|---|
| `assets/raw/summon-oathkeeper-tombstone.png` | 墓碑帧契约仍是 **48×48**（方案 §75 有意保留：192 墓碑图尚未产出）。保留 raw 以便将来产出 192 墓碑时仍可走 `process.mjs --solo summon-oathkeeper-tombstone`。 |

> ⚠ 注意：`process.mjs summon-oathkeeper` 现在会因为 `summon-oathkeeper` 本身 `NO_RAW` 而跳过它，
> 但 `expandToFamilies` 仍可能把 tombstone 纳入并重写 `assets/frames/summon-oathkeeper-tombstone.png`
> （48→48，同尺寸、视觉不变）。**192 的 7 张帧已无对应 raw，不会再被覆盖。**

## 恢复方法（仅当确实要重走管线时）

```bash
# 例：恢复 idle 旧 raw（会覆盖 192 帧！先确认这是你要的）
git mv assets/raw/_retired/summon-oathkeeper.png assets/raw/summon-oathkeeper.png
```

原 `.git` 历史里仍可追溯（`git log --diff-filter=D -- assets/raw/summon-oathkeeper-v.png`）。
