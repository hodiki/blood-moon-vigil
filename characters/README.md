# 角色目录（characters）

> 骨架：`design/art-bible/characters-migration-map-v1.md`（**已完成地图**）  
> 全仓入口：`docs/文档索引.md`（2026-09-17）  
> 本轮：**Phase 0–3 已落**（2026-09-13）。D 轨：魔化 `lace-red-heels/` **8 张**（E4 6 + E5 场景 2）· 卡珊德拉 `h23-coat/` **6 张**（E4）。未训。  
> 尼龙设定表定性仍待勾。

引擎契约不动：`assets/frames/` · `assets/raw/` · `assets/atlas/` · `frame-registry.json`。这里放的是源、锁、印戳、过关帧源与证据，不是出货帧。

一体两面 = 两个目录：`violet-oath` 与 `violet-fallen`。互不当参考。

## 索引

| id | 契约帧名 | 形象套 | 已过（战斗） | 身份卡 |
|---|---|---|---|---|
| `cassandra` | `hero-cassandra*` | 剪影 lock-ce 左 · 立绘 H23 · 战斗 64 全套 | idle / walk / skill **64 已过** | [cassandra/README.md](cassandra/README.md) |
| `edmund` | `player*` | 剪影 lock-ce 右 · 立绘 GPT · 战斗 64 全套 | idle v9 · walk V4 · skill v1 **已过** | [edmund/README.md](edmund/README.md) |
| `violet-oath` | `hero-violet*` | O-3 + D2 已过 | idle 128 from-a · walk 128 E2 S3c-b · **skill 128 A1/B2 已过** | [violet-oath/README.md](violet-oath/README.md) |
| `violet-fallen` | `hero-violet-fallen*` | F-3 + E1 已过 | idle **128 B-lo 已过**；**skill 待技能设计**；走未开 | [violet-fallen/README.md](violet-fallen/README.md) |
| `galvan` | `hero-galvan*` | G-披 + bulk-a 身份锁 | 旧帧 **未过**；idle 128 开工 | [galvan/README.md](galvan/README.md) |
| `oathkeeper` | `summon-oathkeeper*` | 双人成片骑士单裁 | 192 **未过**（甲件漂） | [oathkeeper/README.md](oathkeeper/README.md) |

跨角色锁件：[_shared/](_shared/README.md)（排队 v4、色键 v2、战斗圣经样张、C+E 整图）。

## 新产出落盘

- GPU：`run-job --char <id>` → `characters/<id>/_park/<ISO>/`（无旗标仍进历史 `_park/comfy-lan/`）
- 过目：`characters/<id>/review/<yyyymmdd-topic>/`
- 脸门卡：`characters/<id>/identity/face-gate/`（脚本 `tools/face-gate/make-card.mjs`）
- D 轨：`characters/<id>/lora/dataset/<衣套>/`（只收过立绘级脸门的图）

## 尼龙设定表（待定性）

`characters/violet-fallen/lora/dataset-candidates/nylon-black-heels/`

关键文件：`KREA2-Turbo-Vf1-设定表.json`。另有 `prompts.md` · `prompts-sheet-v1.md` · `vf1-krea2-20260911/`（S01–S14）。**不是** `lora/dataset/`。

## 历史夹（不删）

- `review-h23-wave*`：**永不删**
- `assets/ui-menu/preview/archive/process-v1-deprecated/`：初版方案（已弃用），不删。旧名 `archive/process/` 只留指针
- `_inspect` 脚本与历史 wave 计划卡：冻结不删；计划卡仍指向 wave 夹

旧锁路径只留 `00-已迁.md`。
