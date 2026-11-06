# 走帧相位标准 v1

> 2026-10-22 · 审核用，不是出货素材  
> 读者：主理人、美术代理  
> 用途：看一张走循环是否「两步都在」，兼容 2 / 4 / 6 / 8 帧。  
> 不比较移速和步长。像素小人很难和世界速度对齐，本标准不把滑步当否决项。

命名来自 Richard Williams《The Animator's Survival Kit》的走循环四拍：接触、落下、经过、高点。书里的图有版权，不复制进仓库。像素示例只链到外面，不把图放进 `assets/`。

六拍示意图：`walk-cycle-standard-v1.png`（源文件 `walk-cycle-standard-v1.svg`）。浅色腿和蓝色腿各走一步。朝右时前脚都在画面右侧；第四张必须换成蓝色腿在前。这是尺子，不是卡珊德拉的成图。

---

## 1. 四拍

一个完整循环是**左右各走一步**。只画了同一步的两个瞬间，循环会在那一步上停住。

| 拍 | 脚 | 身体 |
|---|---|---|
| 接触 | 两只脚都着地，前后分开；这一步的前脚脚跟着地 | 步幅最大的一拍 |
| 落下 | 体重落到前脚，步幅比接触小 | 身体略低或前脚踏实，不是接触的复制 |
| 经过 | 两腿收到身下，摆动腿从支撑腿旁边通过 | 脚距最小；可以并成一团 |
| 高点 | 摆动腿抬到最高、还没落地 | 8 帧才单列。6 帧及以下不要求 |

对侧的接触必须换前脚。两张接触的前脚如果在同一侧，这套就不合格。

---

## 2. 帧数怎么落到这四拍

引擎现在的播法在 `src/fx/anim.ts`：六帧按 `a, e, b, c, f, d`、8fps；只有 a–d 时按 `a, b, c, d`、6fps；只有 a/b 时两帧、6fps。朝左是整帧 `flipX`，不是另一套朝左的步。

| 张数 | 播放顺序 | 每张必须是 |
|---|---|---|
| 8 | 1→8 | 接触、落下、经过、高点、对侧接触、落下、经过、高点 |
| 6 | a, e, b, c, f, d | 接触、落下、经过、对侧接触、落下、经过。省掉两个高点 |
| 4 | a, b, c, d | 接触、经过、对侧接触、经过。没有落下 |
| 2 | a, b | 接触、经过。对侧那一步不会出现，只能当「有步」，不能当完整循环 |

6 帧是本项目角色的默认完整循环，和 `design/art-bible/combat-scheme-c-pilot-cassandra-v1.md` 的读法一致。

相邻两张不能是同一拍。判定用脚底 10% 高度里的脚距（两团脚之间的空隙 ÷ 身高）：

| 拍 | 通过 |
|---|---|
| 接触 | 两团脚，脚距 ≥ 0.10，且 a 与 c 的前脚左右相反 |
| 落下 | 脚距比它前面的那张接触至少小 0.03，并且不是另一张接触 |
| 经过 | 脚并成一团，或脚距 < 0.04 |
| 高点 | 摆动腿离地，支撑脚单独着地 |

卡珊德拉 09（2026-10-22 实测）对这张表是失败的：e 和 b 脚距都是 0.165，连着两张大步；c、f、d 都是并脚。对侧接触没有出现。

---

## 3. 外面的示例（只审核，不入库）

这些图的画风不是本项目的角色。用它们对拍，不用它们的衣服和比例。

| 帧数 | 哪里 | 怎么播 | 许可 |
|---|---|---|---|
| 8 + 1 张站立 | [LPC 基础角色](https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles)，walkcycle 表。每方向 9 格：第 1 格站立，第 2–9 格按从左到右走完一个来回 | 第 2–9 格循环。作者说明见 [Johannes Sjölund 的角色包](https://lpc.opengameart.org/content/character-animations-clothes-armor-weapons-skeleton-enemy-combat-dummy)：「1 Stand/idle，2–9 Walkcycle」 | CC-BY-SA 3.0 与 GPL 3.0。部分作者另有 OGA-BY 3.0 |
| 4，来回播 | [Walk Animation Template](https://lpc.opengameart.org/content/walk-animation-template)（hansolo） | 作者写的顺序是 1, 2, 3, 4, 3, 2。这是**同一步来回**，不是左右两步 | 用之前在该页核对许可。未核对前不下载 |
| 生成器里的现行表 | [Universal LPC Spritesheet Character Generator](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator) | 仓库 README 指向各动画旁边的 frame cycle。许可混有 CC0、CC-BY、CC-BY-SA、OGA-BY、GPL | 同上，只在网页里看 |

CC-BY-SA 的图一旦改绘制进游戏，衍生图也要同许可公开。所以这些表留在网页上当尺子，不复制进 `assets/` 或 `characters/`。

没有一份官方引擎文档规定「幸存者类必须几帧」。本项目的槽位以 `anim.ts` 和上表为准。
