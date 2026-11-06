# 走循环六帧 · 实机已过的取帧流程

> 2026-10-22 · 主理人实机确认  
> 角色：卡珊德拉。六张在 `characters/cassandra/review/20261021-scheme-a-128/walk/x128-auto/`，已换进 `assets/frames/hero-cassandra-walk-*` 并打进 `characters` 图集。  
> 下一角色按同一条做。八拍方案（`cassandra-walk-gait-workflow-v1.md`）未开工，不要按那份出图。

## 流程

1. **出段。** 已过的 idle 印戳当参考，驱动视频喂 Wan Animate 2，得到约 49 张全身帧。身份跟印戳，姿势跟驱动。条见 `pipelines/c-walk-wan-animate2/`。
2. **取六张。** 跑 `tools/scheme-c/extract-walk.py`。它按步频格子找两次接触，再在两次接触之间取落下和经过，写成 `walk-a / e / b / c / f / d`。脚本若失败（接触点少于 3，或两半步的峰值差过大），**改为主理人从这 49 张里人工挑六张**。不要退回「只看脚距高峰」的挑法。
3. **入盒。** 六张都是 128×128，脚底在 y=127，alpha 只有 0 或 255。这次过目的成品就是 `x128-auto/` 里那六张。
4. **目测。** 主理人看这六张的左右脚是不是交替。过了才交给 TA。
5. **进游戏。** TA 先备份现网那六张走帧，再覆盖 `assets/frames/` 里同名的六张，然后 `node tools/asset-pipeline/pack.mjs characters`。不跑 `process.mjs`，不动 idle、`-v`、技能。主理人硬刷新后走一段。

播放顺序固定是 `a → e → b → c → f → d`。槽名不要改。

## 步频

过目 GIF 可以很快，那不是游戏里的速度。游戏里六帧走循环是 **6.5fps**：六张约 **0.92 秒**一轮，左右各一步，大约 **130 步/分钟**。写在 `src/fx/anim.ts` 的 `walkFrameRate`。四帧及以下仍是 6fps。

不要为了让 GIF 和游戏一样快去改画。下一角色不用再改这个数。

## 换角色时只改这些

| 项 | 换成 |
|---|---|
| 参考印戳 | 该角色已过的 idle |
| 原始帧目录 | 该角色这次 Wan 的 49 张 |
| 文件名前缀 | 该角色的帧名，如 `hero-galvan`、`player` |
| 落盘 | `characters/<id>/review/<日期>-walk/x128-auto/` |

六张文件名必须是 `<前缀>-walk-a.png`、`-walk-e.png`、`-walk-b.png`、`-walk-c.png`、`-walk-f.png`、`-walk-d.png`。

## 不要做

- 不要用脚距高峰当唯一标准。衣摆会挡住后摆的脚，高峰也会把同一步取两次。
- 脚本失败时不要自动换一套索引再跑，交给主理人挑。
- 不要把过目 GIF 的帧率写进游戏。
- 主理人说进游戏之前，不要写 `assets/frames/`。
