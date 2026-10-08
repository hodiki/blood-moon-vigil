# 角色目录骨架与迁移映射表（characters-migration-map）

> 版本：v1.3 · 日期：2026-09-13 · 起草：编码机助理 · 依据：主理人 2026-09-12「素材放得太散，应以角色为目录骨架」（②.1 确认）
> 状态：**Phase 0–3 已完成（2026-09-13）。本文是已完成地图，不是待办。** D 轨已收料：魔化 `lace-red-heels/` 8 张 · 卡珊德拉 `h23-coat/` 6 张；未训。尼龙设定表定性仍待勾。
> 一句话：新建 `characters/<id>/`，把每个角色的**源、锁、印戳、过关帧源、视频、LoRA 料、账本**收进同一棵树；引擎契约目录（`assets/frames` / `raw` / `atlas`）不动；历史时间戳落盘不搬；分两阶段，先复制后改引用，红线不断。

---

## 0. 原则

1. **契约不动。** `assets/frames/`、`assets/raw/`、`assets/atlas/`、`frame-registry.json`、`tools/asset-pipeline/frame-specs.mjs` 是引擎与 TA 读的扁平契约名，一律不搬、不改名。角色目录放的是源与证据，不是出货帧。
2. **两阶段。** Phase 1 只**复制**锁件并建 README（旧路径继续有效，`.cursor/rules` 与条文引用不断）；Phase 2 改引用 → 旧路径留 `00-已迁.md` 指针 → 删副本。Phase 2 须主理人单独点。
3. **一体两面 = 两目录**：`violet-oath` 与 `violet-fallen`。互不当参考。
4. **历史不搬。** `_park/comfy-lan/<ISO>/` 时间戳夹、`review-h23-wave*`（**永不删**）、`archive/process-v1-deprecated/`（初版方案，已弃用，**不删**）原地留档；只把**过关件**复制进角色目录并在文件旁写 `source.md`（原路径 + 日期 + 过关记录）。
5. **从今起新产出直接进 `characters/`。** `run-job` 加 `--char <id>` 把落盘写到 `characters/<id>/_park/<ISO>/`；过目夹改建在 `characters/<id>/review/<yyyymmdd-topic>/`。
6. **文档不搬。** `design/art-bible/` 的条文、成法、实验卡、账本留原地；角色 README 链接它们。`pipelines/` 不搬。

---

## 1. 骨架（定稿）

```
characters/
  README.md                       # 角色索引：id · 契约帧名 · 形象套状态 · 各层「过」清单
  _shared/                        # 跨角色锁件：排队剪影、色键 v2 全表、战斗圣经样张
    lineup/  color-keys/  combat-bible/
  <id>/                           # cassandra · edmund · violet-oath · violet-fallen · galvan · oathkeeper
    README.md                     # 身份卡：形象套三层状态、零件表摘要、已过清单、账本与实验卡链接
    identity/
      source/                     # 图1 / 图1′（唯一身份源）+ 减脏记录 + source.md
      parts.md                    # 零件表（过目指）
      face-gate/                  # 基准胸像 00-bust-ref / 00-full-ref + 各次同脸卡（见 face-gate-spec）
      card/  silhouette/  color-key/   # A 轨派生（卡裁 / 压黑 / 压块）
    portraits/                    # 已过立绘（风格帧、re-stage 通过件）；_park/ 放该线废稿
    stamps/                       # 已过印戳：idle / 技能姿（B、C 轨产物，绘画大图）
    combat/
      idle/  walk/  skill/        # 已过 128 / 192 源 PNG + 过目板 + 门禁 JSON（frames/ 仍是契约）
    video/                        # 驱动视频、Wan 段、挑帧记录、首帧
    lora/
      dataset/<outfit-set>/       # 只收过立绘级脸门的图 + captions.txt；一个衣套一个子目录
      runs/                       # 训练卡、日志、样图
      weights.md                  # 权重指针：GPU 机路径 + sha256 + 训练卡链接（权重不入库）
    review/<yyyymmdd-topic>/      # 迁移后的新过目夹
    _park/<ISO>/                  # 该角色新落盘（run-job --char）
    ledger.md                     # 过目账本（可先链接 art-bible 里的现有账本）
```

---

## 2. 角色 id · 契约名 · 现状

| id | 契约帧名 | 形象套 / 现网 | 现有账本 / 卡 |
|---|---|---|---|
| `cassandra` | `hero-cassandra*` | 64 全套已过；H23 风格帧（WAI）。图1′ = H23；**E4 不换** | `style-frame-h23-lessons-v1.md` · `exp-e4-*` |
| `edmund` | `player*` | 64 全套已过（idle v9 · walk V4 · skill v1）；立绘 `edmund-gpt` 身份锁 | `combat-64-workflow-v1.md` §11 |
| `violet-oath` | `hero-violet*` | idle 128 + walk 128 + skill 128 已过；O-3 / D2 已过 | `identity-validate-vo-walk-v1.md` · `exp-e2-*` |
| `violet-fallen` | `hero-violet-fallen*` | idle 128 B-lo 已过；**skill 待技能设计**；走未开 | `identity-validate-vf1-plan-v1.md` · `exp-e1-*` |
| `galvan` | `hero-galvan*` | 立绘 `bulk-a` 身份锁；G-披剪影；idle 128 开工；旧帧未过 | 圣经 §4.2 |
| `oathkeeper` | `summon-oathkeeper*` | 192 未过（甲件漂）；双人成片里的骑士 | wave15 / 16 notes |

---

## 3. 映射表（Phase 1 = 复制；「留」= 原地不动只链接）

路径前缀：`L = assets/ui-menu/preview/locked` · `P = L/combat-64/_park` · `A = assets/ui-menu/preview/archive/process-v1-deprecated` · `I = L/combat-64/_inspect` · `W = tools/comfy-lan/workflows`。

### 3.1 `_shared/`

| 现路径 | 新路径 | 动作 |
|---|---|---|
| `L/silhouettes/char-bible-party-lineup-v4.png`（现锁）· `v3` · `v2`（对照） | `characters/_shared/lineup/` | 复制 |
| `L/color-keys/char-bible-color-keys-v2.png`（C / E / G 行） | `characters/_shared/color-keys/` | 复制 |
| `L/combat-64/char-bible-combat-color-key-v2.png` · `idle-row1-v1/v2` · `idle-v6` | `characters/_shared/combat-bible/` | 复制 |

### 3.2 `cassandra/`

| 现路径 | 新路径 | 动作 |
|---|---|---|
| `L/portraits/char-bible-portrait-cassandra-h23.png` | `identity/source/h23.png`（图1′ = H23；**E4 主理人：不换**，Krea P1 过脸不当图1′） | 复制 |
| `L/portraits/ui-sel-portrait-cassandra-v2.png` | `portraits/_park/` | 复制 |
| `L/faces/face-cassandra.png` | `identity/card/`（旧裁，标「随成片重开」） | 复制 |
| `L/silhouettes/char-bible-edmund-lock-ce.png`（左侧 = 她） | `identity/silhouette/lock-ce.png`（与 edmund 各存一份） | 复制 |
| `L/combat-64/hero-cassandra-idle-cut-v1*` · `walk-a…f-v1*` · `skill-a/b-v1*` · `*-art-v1.png` · `walk-6-review/preview` · `skill-ab-preview` | `combat/idle` · `walk` · `skill`（按名分） | 复制 |
| `A/combat-64-parked-2026-09/cassandra-parked/` | `_park/legacy-2026-09/` | 留（链接） |
| `W/style-frame-m1-hose2*` · `style-frame-wai-cassandra*` | 留（已入 `pipelines/portrait-wai-h23-style-frame/`） | 留 |

### 3.3 `edmund/`

| 现路径 | 新路径 | 动作 |
|---|---|---|
| `L/portraits/char-bible-portrait-edmund-gpt.png`（锁）· `edmund-v1.png`（对照） | `identity/source/` · `portraits/_park/` | 复制 |
| `L/faces/face-edmund.png` | `identity/card/` | 复制 |
| `L/silhouettes/char-bible-edmund-lock-ce.png`（右侧 = 他） | `identity/silhouette/lock-ce.png` | 复制 |
| `L/combat-64/player-idle-64-v9*` · `player-idle-art-v5/v6` · `player-idle-cut-v5/v6*` · `player-walk-6-strip-v4-src` · `player-walk-*-64-v4*` · `player-walk-a-64-v2*` · `player-skill-*-64-v1*` · `player-skill-ab-*` | `combat/idle` · `walk` · `skill` | 复制 |
| `I/player-*.md`（job 卡 ×9）· `player-walk-6-strip-prompt-v1.md` · `player-skill-ab-strip-prompt-v1.md` | `combat/job-cards/` | 复制 |
| `A/combat-64-parked-2026-09/edmund-idle-parked` · `edmund-walk-parked` · `edmund-skill-parked` | `_park/legacy-2026-09/` | 留（链接） |

### 3.4 `violet-oath/`

| 现路径 | 新路径 | 动作 |
|---|---|---|
| `L/portraits/char-bible-portrait-violet-oath-gpt-ok.png`（双人锁） | `identity/source/oath-gpt-ok-duo.png` + 单裁 → `identity/source/oath-solo.png`（`I/crop-vo-oath-solo.mjs`） | 复制 + 生成 |
| `L/portraits/char-bible-portrait-violet-oath-O-flame.png` | `portraits/_park/` | 复制 |
| `L/silhouettes/char-bible-violet-oath-lock-o3.png`（锁）· `lock-o2` · `violet-explore-v1` · `violet-silhouette-v4`（对照） | `identity/silhouette/` | 复制 |
| `L/color-keys/char-bible-violet-oath-color-key-d2.png` | `identity/color-key/d2.png` | 复制 |
| `L/faces/face-violet-oath.png` | `identity/card/` | 复制 |
| `L/combat-64/hero-violet-idle-128-v1.png` · `-x4` · `-stamp` · `-board` | `combat/idle/` + 印戳同时到 `stamps/idle-from-a.png` | 复制 |
| `L/combat-64/hero-violet-walk-[a-f]-128-v1.png` | `combat/walk/` | 复制（v1.1 补：现网已过 walk 128 源，原表漏点名） |
| `L/combat-64/hero-violet-idle-64-v1*` · `hero-violet-walk-*-64-v1*` · `walk-6-strip-v1-src` · `skill-*-64-v1*` · `skill-ab-*`（旧修女） | `combat/_superseded-nun64/` | 复制 |
| `P/hero-violet-walk-nun64-superseded-2026-09-12/` | `combat/_superseded-nun64/` | 复制 |
| `L/review-exp-e2/16–25`（挑帧、六帧 128、GIF、门禁、总结）· `P/e2-s4-6pick-box/` | `combat/walk/` | 复制 |
| `L/review-exp-e2/drive/8c3b8794-*.mp4` · `01-e2-drive-contact-sheet.png` | `video/drive/` | 复制 |
| `L/review-exp-e2/00-e2-prep.md` · S0–S4 帧条 | `video/wan-animate2-2026-09-12/` | 复制 |
| `L/review-h23-wave13/` · `wave14/`（守誓 idle 过程）· `wave8/08-krea.png`（O-3 源）· `wave9/04-gi-d2.png`（D2 源） | 留（链接）；`11-from-a-stamp-and-128.png` 复制到 `combat/idle/` | 留 / 复制 |
| `P/vo-idle-o3d2/` | `_park/legacy-2026-09/` | 留 |
| `I/hero-violet-*.md` · `hero-violet-repackage-job.md` · `hero-violet-oath-prompts.md` | `combat/job-cards/` | 复制 |
| `identity-validate-vo-walk-v1.md` | `ledger.md` 链接 | 留 |

### 3.5 `violet-fallen/`

| 现路径 | 新路径 | 动作 |
|---|---|---|
| `L/review-identity-vf1/00-vf1-raw.png` · `01-vf1-clean.png` | `identity/source/vf1-raw.png` · `vf1-clean.png`（图1 / 图1′） | 复制 |
| `L/review-identity-vf1/02-card-bust` · `03-silhouette-from-clean` · `04-color-key-from-clean` | `identity/card/` · `silhouette/` · `color-key/` | 复制 |
| `L/portraits/char-bible-portrait-violet-fallen-gpt-e.png`（优雅锁）· `armor3-a`（备用）· `armor-c` · `F-allure`（对照） | `portraits/`（gpt-e）· `portraits/_park/`（其余） | 复制 |
| `L/silhouettes/char-bible-violet-fallen-lock-f3.png` · `L/color-keys/…fallen-color-key-e1.png` · `L/faces/face-violet-fallen.png` | `identity/silhouette/f3.png` · `color-key/e1.png` · `card/` | 复制 |
| `L/review-identity-vf1/05-ref-void` · `06-raw-blo` · `12-idle-blo-passed-stamp` · `12-idle-blo-passed-128` · `07/08` | `stamps/idle-blo.png` · `combat/idle/` | 复制 |
| `L/review-identity-vf1/13–46`（C 试：提示词 i2i、Ostris、SVD、Wan 1.3B / 14B） | `_park/legacy-c-trials/` | 留（链接） |
| `L/review-exp-e1/`（C1 / C3 过、C2 反例、六格扫描、摘要） | `stamps/poses/`（C1 A/B、C3 A 印戳 + 128 + 卡）· 其余留 | 复制 / 留 |
| `P/identity-vf1/` · `P/identity-e1/` | `_park/legacy-2026-09/` | 留 |
| `W/vf1-krea-lora/vf1-clean.png` · `vf1-idle-stamp.png` | 已有副本，指向 `identity/source/` 与 `stamps/` | 删副本（Phase 2） |
| `W/vf1-krea-lora/vf1-krea2-20260911/S01–S14*.png` · `prompts.md` · `prompts-sheet-v1.md` · `prompts-ref-i2i-v0.md` · `KREA2-Turbo-Vf1-*.json` | `lora/dataset-candidates/nylon-black-heels/`（**另一衣套**，与 B-lo 蕾丝红鞋分开；未过脸门前只算候选） | 复制 |
| `identity-validate-vf1-plan-v1.md` · `exp-e1-*` | `ledger.md` 链接 | 留 |

### 3.6 `galvan/`

| 现路径 | 新路径 | 动作 |
|---|---|---|
| `L/portraits/char-bible-portrait-galvan-bulk-a.png`（锁）· `vigil-b` · `v2`（对照） | `identity/source/` · `portraits/_park/` | 复制 |
| `L/silhouettes/char-bible-galvan-lock-v2.png` · `L/faces/face-galvan.png` | `identity/silhouette/` · `card/` | 复制 |
| `assets/raw/hero-galvan*`（旧帧源，未过） | 留（契约） | 留 |
| `W/style-follow-h23-galvan-*` | 留 | 留 |

### 3.7 `oathkeeper/`

| 现路径 | 新路径 | 动作 |
|---|---|---|
| 双人成片里的骑士（`I/crop-ok-knight-solo.mjs` 产物） | `identity/source/ok-solo.png` | 生成 + 复制 |
| `L/review-h23-wave15/` · `wave16/`（印戳、96 / 192 入盒、对照） | `stamps/_unpassed/` + `combat/idle/_unpassed/` | 复制（标未过） |
| `P/ok-idle-96/` · `P/ok-idle-192/` | `_park/legacy-2026-09/` | 留 |
| `I/ok-*.mjs` · `ok-idle-96-job.md` · `gpt-ok-palette.json` | `combat/job-cards/` | 复制 |
| `W/krea2-ok-stamp-w15/16*` | 留 | 留 |

### 3.8 不搬（明确）

| 项 | 处置 |
|---|---|
| `assets/frames` · `raw` · `atlas` · `frame-registry.json` | 引擎契约，永不搬 |
| `tools/**` · `pipelines/**` · `design/art-bible/**` | 文档与工具留原地 |
| `P/comfy-lan/<ISO>/` | 历史落盘，不搬 |
| `L/review-h23-wave*` | **永不删**。历史过目夹，只链接。wave 计划卡路径仍指向这些夹，不改 |
| `I/*.mjs` 与历史 job 卡 | **冻结不删**。输入路径已改到 `characters/` 的可当对照；其余不要当产线重跑 |
| `A/`（原 `archive/process/`） | **不删**。2026-09-13 改名为 `archive/process-v1-deprecated/`，记为**初版方案（已弃用）**。旧名留 `archive/process/00-已迁.md` 指针 |

---

## 4. 共享件的处理

`lock-ce.png`（艾德蒙 + 卡珊德拉同图）、`party-lineup-v4`、`color-keys-v2` 这类多人一图：放 `_shared/`，各角色目录里只放**裁出自己的那半**（脚本裁，写 `source.md`），不各存整图。

---

## 5. 脚本与工具改动（Phase 1 末、Phase 2 前）

| 项 | 改什么 |
|---|---|
| `tools/comfy-lan/run-job.mjs` | 加 `--char <id>`：有则落 `characters/<id>/_park/<ISO>/`，无则维持 `_park/comfy-lan/`。`assertNotFrames` 不变 |
| `I/*.mjs`（硬编码绝对路径） | Phase 1 不改（旧路径仍在）；Phase 2 逐个改到新路径或退休 |
| `pipelines/*/README.md` | 证据链接在 Phase 2 改到新路径 |
| `.cursor/rules/combat-64-workflow.mdc` · `combat-64-workflow-v1.md` · `combat-64-pixel-workflow-v1.md` · `combat-identity-*.md` · `ta-combat-128-handoff-v1.md` | Phase 2 改路径引用；改前列引用清单交主理人 |
| `characters/README.md` | Phase 1 建，作总索引 |

---

## 6. 顺序与风险

| 阶段 | 做什么 | 风险 | 回退 |
|---|---|---|---|
| **0 骨架** | 建 `characters/` 树 + 七份 README 空卡（`_shared` + 六角色） | 无 | 删目录 |
| **1 复制**（守誓先 → 魔化 → 卡珊德拉 → 艾德蒙 → 加尔文 → 守誓者 → 共享） | 按 §3 复制锁件与过关件，每件旁 `source.md` | 体积暂增约 100–150MB；无引用断裂 | 删副本 |
| **1.5 改道** | `run-job --char`；新过目夹进 `characters/<id>/review/` | 助理习惯改；脚本一处 | 去掉旗标 |
| **2 改引用**（主理人单独点） | 条文 / 红线 / pipelines 链接 → 旧路径留 `00-已迁.md` → 删旧副本 | 漏改则红线指向空路径 | 指针文件兜底 |
| **3 D 轨落位** | 发脸门基准胸像；建 `lora/dataset/<衣套>/`（空）+ `weights.md` 衣套行；`make-card.mjs` 入库。图1′ 不进 dataset。尼龙仍候选 | 无 | — |

Windows junction 可以让旧路径零副本继续有效，但本仓库是 git 仓，junction 会被当目录重复收录，**不用**。

---

## 7. 主理人勾选

- [x] 骨架 §1 认可（含 `_shared/`、两个薇奥莱目录、`lora/` 三层）
- [x] 角色 id 六个认可（`cassandra` · `edmund` · `violet-oath` · `violet-fallen` · `galvan` · `oathkeeper`）
- [x] Phase 0 开
- [x] Phase 1 开（顺序：守誓 → 魔化 → 卡珊德拉 → 艾德蒙 → 加尔文 → 守誓者 → 共享）
- [x] Phase 1.5 开（`run-job --char`；新过目夹改道）
- [x] Phase 2 开（改引用；先交引用清单）
- [x] Phase 3 开（脸门基准 + dataset 空夹 + `make-card.mjs`；收料等 E4）。**E4 收料已落：魔化 / 卡珊德拉各 6 张（2026-09-15）**
- [ ] `W/vf1-krea-lora/` 尼龙设定表定性：另一衣套候选 / 弃用（Phase 1 已按「候选」复制进 `characters/violet-fallen/lora/dataset-candidates/nylon-black-heels/`，未进 `dataset/`）
- [x] `archive/process/` 不删，改名 `process-v1-deprecated/`，记初版方案（已弃用）
- [x] `review-h23-wave*` **永不删**
- [x] `_inspect` 脚本与历史 wave 计划卡冻结不删（计划卡仍指向 wave 夹）

---

## 8. 变更记录

| 日 | 变了什么 |
|---|---|
| 2026-09-13 | 起草 v1：骨架、六角色映射、两阶段、脚本改动、勾选 |
| 2026-09-13 | v1.1 Phase 0+1 落地：`characters/` 树 + 复制锁件。脚本：`tools/characters-migrate-phase1.mjs`。 |
| 2026-09-13 | v1.2 Phase 1.5+2：`run-job --char`；条文/红线/pipelines 改指 `characters/`；旧锁路径留 `00-已迁.md` 后删 273 件副本。`review-h23-wave*`、`archive/process`、`_park/comfy-lan`、`_inspect` 脚本不删。 |
| 2026-09-13 | v1.3 主理人定：`review-h23-wave*` 永不删；`archive/process` 改名 `process-v1-deprecated/`（初版方案已弃用）不删；Phase 3：六角色脸门 `00-bust-ref` / `00-full-ref`、`tools/face-gate/make-card.mjs`、`lora/dataset/<衣套>/` 空夹。 |
