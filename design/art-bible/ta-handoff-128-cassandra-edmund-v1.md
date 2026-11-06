# 交付单 · 128 角色帧（卡珊德拉技能 v2 + 艾德蒙整套）

> 2026-10-30 · 交 TA 换服
> 验收标准：**以游戏内最终效果为准**，不在静态放大图上一票否决。

---

## 0. 先看这条：艾德蒙的文件名对不上

引擎里艾德蒙的帧名基座是 **`player`**，不是 `hero-edmund`：

```ts
// src/config/frame-registry.ts:28
hero_edmund: ['player', 'player-v', 'player-skill-a', 'player-skill-b'],
```

而 `walkCycleFrames(base)` 找的是 `` `${base}-walk-a` `` —— 也就是 `player-walk-a`。

**所以 `hero-edmund*.png` 这 10 个文件直接丢进 `assets/frames/` 是找不到的。** 两条路：

| 方案 | 做法 | 评价 |
|---|---|---|
| **A（建议）** | 换服时**改名成 `player*`**（见 §4 对照表） | 零代码改动，风险最小 |
| B | 把注册表和 `visualFrameForContent` 都改成 `hero-edmund` | 动的是角色 id 主链路，收益只有命名好看 |

**卡珊德拉没这个问题**，她的基座就是 `hero-cassandra`，直接覆盖即可。

---

## 1. 交付内容

| 套 | 目录 | 张数 | 性质 |
|---|---|---|---|
| 卡珊德拉 v2 | `characters/cassandra/review/20261029-weapons/sets/cassandra-128-v2/` | 10 | **只换 2 张技能帧**，其余不动 |
| 艾德蒙 | `characters/edmund/review/20261026-edmund-128/sets/edmund-128/` | 10 | **整套新建**（现网还是 64 的 `player*`） |

---

## 2. 公共规格（20 张全部满足）

- 画布 **128×128**，硬透明（alpha 只有 0 / 255）
- **脚底 y=127**，内容高 108–112
- `-v` 与 idle **逐像素相同**（钉 idle，不是镜像）
- 朝右；朝左由引擎 `flipX` 处理

---

## 3. 卡珊德拉 v2（只换两张）

| 文件 | 宽 | 内容 |
|---|---|---|
| `hero-cassandra-skill-a.png` | 72 | **血影突袭**（双刃系）：低重心前冲、双持倒钩弯刀、刃面凹槽内一条红线 |
| `hero-cassandra-skill-b.png` | 52 | **月痕狙击**（长弓系）：侧身拉满反曲弓、弦贴颊、箭指右 |

其余 8 张（idle / `-v` / 走 6 帧）**沿用已实机验过的旧版，一个像素没动**。

依据：两个衍生技自带 `sourceExclusiveId`——血影突袭归 `xw_twinblades`、月痕狙击归 `xw_longbow`。按形态分槽，而不是按"前摇/施放"。

---

## 4. 艾德蒙（整套新建）

现网是 64 的 `player*`；这套是 128，全部重画。

| 交付文件名 | **换服时改成** | 宽 | 内容 |
|---|---|---|---|
| `hero-edmund.png` | `player.png` | 52 | 站姿，**提灯挂在腰带左钩**、两手空 |
| `hero-edmund-v.png` | `player-v.png` | 52 | 与上行同图 |
| `hero-edmund-walk-a.png` | `player-walk-a.png` | 57 | 走循环 |
| `-walk-b.png` | `player-walk-b.png` | 62 | |
| `-walk-c.png` | `player-walk-c.png` | 69 | |
| `-walk-d.png` | `player-walk-d.png` | 57 | |
| `-walk-e.png` | `player-walk-e.png` | 54 | |
| `-walk-f.png` | `player-walk-f.png` | 60 | |
| `hero-edmund-skill-a.png` | `player-skill-a.png` | 62 | **提灯闪耀**：举灯、火光大盛 |
| `hero-edmund-skill-b.png` | `player-skill-b.png` | 76 | **圣徒左轮**：手臂伸直开火、枪口焰、灯仍挂腰 |

> 旧的 `player-walk-6f.png` / `player-walk-s.png` 若引擎还在用，**不要删**——先确认没引用再清。

**提灯方案**：形锁写的是「髋侧外挂灯团」，所以走帧与站姿里灯**挂在腰带**、不随手臂摆动。技能时才到手上。这是 2026-10-26 定的方案 A。

---

## 5. TA 必须改的一行（两个角色都受益）

```ts
// src/fx/skill-pose.ts
export function skillPoseStanceForExclusive(visualFrame: string, exclusiveId: string | null) {
  if (visualFrame === 'player' && exclusiveId === 'xw_lantern') return 'b';   // ← 删掉
  return null;
}
```

这行是旧模型残留：那时 `-skill-b` 语义未定，被借去当"持提灯站姿"。现在 `-skill-b` 明确是**专武2 的技**，这行会让玩家**提着灯却摆出开枪姿势**。

站姿就是 idle，应返回 `null`。

---

## 6. 文档欠账（不影响运行，但要同步）

| 文件 | 现说法 | 应改为 |
|---|---|---|
| `asset-spec-v1.md` §165 | 「`-skill-a` 前摇 0.3s、`-skill-b` 施放 0.15s」 | 「`-skill-a` = 专武1 技；`-skill-b` = 专武2 技」 |
| `asset-spec-v1.md` §348 | 后缀列 `-skill-c`（收招） | 删掉，**从未实现**，`SkillPosePhase` 只有 `'a' \| 'b'` |

---

## 7. 已知局限

**卡珊德拉**

1. `-skill-b` 的白弦只有 1px，深底上属"隐约"级别——这是尺寸决定的。有过一版更亮的，但模型把弓身也加厚了，取了折中。
2. `-skill-a` 的红线在**刃面凹槽内**、不在刃口，试了 4 次才成。若实机看着像刃口有脏点，多半是缩小丢像素，**不要回退成刃口红**。
3. `-skill-a` 宽 72，是两套里最宽的一帧。若同屏显大，**缩刃不缩人**（人必须 112 高）。

**艾德蒙**

4. **走帧没有通过工具自检**。他的斗篷下摆及地、与靴子粘连，自动量测报 `feet merged with clothing`（7.7 团/帧），这 6 张是按工具给的接触点 + 后续槽位挑的、**靠目视确认**。实机若发现步态不对，先重挑帧，不要重出驱动。
5. 左轮开火帧的火焰只表达"正在开火"，6 连射的节奏感要靠特效层补。

---

## 8. 换服步骤

1. **备份**：现有 `assets/frames/` 里两个角色的帧 + `characters.png` 图集。
2. 覆盖：卡珊德拉 10 张原样；艾德蒙 10 张**改名为 `player*`** 后覆盖。
3. 重建图集（key 不变，只换图）。
4. 游戏里各试三个状态：**待机 → 走 → 放技能**。艾德蒙要把**两把专武各试一次**（提灯 / 左轮）。
5. 有问题记：时间点 + 当时拿着哪把专武 + 现象，回传，**不要当场改图**。

---

## 9. 判据

**以游戏内最终效果为准。** 只有三类算真问题，才回退：

- 比例明显不对（人比别人高/矮一截）
- 动作读不出来（看不出是突进还是射击）
- 和另一帧分不清（待机/技能/走路混淆）

回退：卡珊德拉换回 `characters/cassandra/review/20261021-scheme-a-128/sets/09-3quarter/`；艾德蒙换回原 64 的 `player*`（`backup-live/` 里有）。
