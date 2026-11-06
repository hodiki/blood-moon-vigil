# 薇奥莱 128 v1 换服方案

> 2026-11-04 · **已换上，待主理人实测。** 交接单「不用改代码」作废。`skill-a` / `skill-b` 是两把专武的技，各钉一帧。  
> 来源：`ta-handoff-128-violet-v1.md`  
> 目录：`characters/violet/review/20261103-s1/sets/violet-128-v1/`

## 文件

11 张都在。实测：128×128、脚底 y=127、内容高 112、顶 16、硬透明。`-v` 与 idle 逐字节相同。宽与交接单一致（idle 41、离站 25、走 42/50/49/37/27/26、技能 68/55）。交接单表里有几张 top 不是 16，文件本身全是 top 16。

现网已有 10 张 128（没有 `hero-violet-walk-s`）。离站是新槽。

## 播放

走六帧和离站不用新播放表。`walk-s` 已在变体后缀里，图集认 `hero-violet` 的 128。有这张就会在从待机切入走路时播一帧（6fps，约 1/6 秒），然后进入 `a → e → b → c → f → d`。六帧走循环已经是 6.5fps。

技能必须改一行，否则和交接单「不用改代码」相反，实机会看错：

现在薇奥莱仍走 combo：一次释放先播 `skill-a` 再播 `skill-b`。新画里这两张是两把专武的技，不是同一次的前摇和施放。按卡珊德拉同一接法，各钉一帧：

| 手里的专武 | 空格实际放的技 | 姿势 |
|---|---|---|
| 圣辉轮刃 | 誓约回响 | `skill-a` 光球、铃音环 |
| 誓约圣铃 | 圣辉审判 | `skill-b` 抬手掷刃环 |

站姿保持 idle，不改。

誓约回响结算时还会在脚下撒治疗绿点（`requiemHeal`）。首轮先留着。若和帧里的铃音环抢，再关这一处，不改画。

## 换服（确认后才做）

1. 备份现网 10 张 `assets/frames/hero-violet*.png`，以及 `assets/atlas/characters.png` 和 `characters.json`，放到 `characters/violet/review/20261103-s1/backup-before-v1/`。
2. 用交付目录 11 张覆盖。`walk-s` 是新增。
3. `node tools/asset-pipeline/pack.mjs characters`。不跑 `process.mjs`。
4. 改 `skillPosePlayForCast`：`dv_requiem` → hold `a`，`dv_holy_judgment` → hold `b`。补上对应测试。
5. 硬刷新后看：待机、起步、走、两把专武各放一次。

回退：用备份目录盖回，再打包。不要改回 `20261021` 的卡珊德拉目录。

## 先不要当成失败的

- 白弦、光球、刃环在 128 上很细。
- 白袜是这套里最亮的。
- 走循环首尾若跳，换 `walk/raw3/` 里的源帧，不重跑生成。
