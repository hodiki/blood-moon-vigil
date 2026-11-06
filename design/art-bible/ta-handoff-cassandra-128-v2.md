# 交付单 · 卡珊德拉 128 v2（技能帧重做）

> 2026-10-29 · 交 TA 换服
> 验收标准：**以游戏内最终效果为准**，不在静态图上一票否决。
> 上一版（20261021 scheme-a-128 / 09-3quarter）保留不动，可随时回退。

---

## 1. 这次改了什么

只换 **两张技能帧**。idle、`-v`、走 6 帧沿用已过审、已实机验过的那套，一个像素没动。

| 槽 | 旧 | 新 |
|---|---|---|
| `-skill-a` | 冲刺起手（空手） | **血影突袭**：低重心前冲、**双持倒钩弯刀**、刃面凹槽内一条红线 |
| `-skill-b` | 冲刺穿身（与长弓无关） | **月痕狙击**：侧身拉满反曲长弓、弦贴颊、箭指右 |

依据：`exclusive.ts` 里两个衍生技自带 `sourceExclusiveId`——血影突袭归 `xw_twinblades`，月痕狙击归 `xw_longbow`。所以按形态分槽：`-skill-a` = 双刃，`-skill-b` = 长弓。

---

## 2. 文件清单

目录：`characters/cassandra/review/20261029-weapons/sets/cassandra-128-v2/`

| 文件 | 尺寸 | top | foot | 高 | 宽 |
|---|---|---|---|---|---|
| `hero-cassandra.png` | 128×128 | 16 | 127 | 112 | 36 |
| `hero-cassandra-v.png` | 128×128 | 16 | 127 | 112 | 36 |
| `hero-cassandra-walk-a.png` | 128×128 | 18 | 127 | 110 | 44 |
| `hero-cassandra-walk-b.png` | 128×128 | 19 | 127 | 109 | 54 |
| `hero-cassandra-walk-c.png` | 128×128 | 17 | 127 | 111 | 45 |
| `hero-cassandra-walk-d.png` | 128×128 | 20 | 127 | 108 | 43 |
| `hero-cassandra-walk-e.png` | 128×128 | 19 | 127 | 109 | 56 |
| `hero-cassandra-walk-f.png` | 128×128 | 18 | 127 | 110 | 51 |
| **`hero-cassandra-skill-a.png`** | 128×128 | 17 | 127 | 111 | 72 |
| **`hero-cassandra-skill-b.png`** | 128×128 | 17 | 127 | 111 | 52 |

**统一规格**：画布 128×128、硬透明（alpha 只有 0 和 255）、脚底 y=127、`-v` 与 idle 逐像素相同（不是镜像）。

---

## 3. TA 侧要改的代码（一条，但必须改）

```ts
// src/fx/skill-pose.ts
export function skillPoseStanceForExclusive(visualFrame: string, exclusiveId: string | null) {
  if (visualFrame === 'player' && exclusiveId === 'xw_lantern') return 'b';   // ← 删掉
  return null;
}
```

**为什么必须改**：这行原本的意思是「持破旧提灯时，站姿播 `-skill-b`」。那是旧模型——那时 `-skill-b` 没有确定语义，被借去当站姿。

现在 `-skill-b` 明确定义为**专武2 的技（月痕狙击 / 圣徒左轮）**，这行会让玩家**提着提灯却摆出开枪拉弓的姿势**。

站姿就是 idle，这条应返回 `null`。

---

## 4. 文档欠账（不改代码，但要改文档）

| 文件 | 现在的说法 | 应改为 |
|---|---|---|
| `asset-spec-v1.md` §165 | 「`-skill-a` 前摇 0.3s、`-skill-b` 施放 0.15s；收招复用 pose0」 | 「`-skill-a` = 专武1 的衍生技；`-skill-b` = 专武2 的衍生技」 |
| `asset-spec-v1.md` §348 | 后缀含 `-skill-c`（收招） | 删掉。`-skill-c` **从未实现**，`SkillPosePhase` 只有 `'a' | 'b'` |
| `character-animation-contract-v2.md` | 已按 4 槽写清（站姿=idle / 走 / skill-a / skill-b） | 以该文为准 |

---

## 5. 已知局限（先说，免得实机时当成 bug）

1. **`-skill-b` 的白弦是"隐约"级别**。做了一版明确的白弦，模型把弓身也一起加厚了；最终取的是弓形正常、弦略亮的那版。128 下弦只有 1px，**在深底上不会很抢眼**，这是尺寸决定的，不是画错。
2. **`-skill-a` 的红线在刃面凹槽内**，不在刃口。这是设计图的要求（`exw-card-twinblade`），试了 4 次才成——生成式会顺手改刃型，程序重画会断线。若实机看着像"刃口有脏点"，优先怀疑缩小丢像素，不要回退成刃口红。
3. **双刃在 128 上宽 72**，是这一套里最宽的一帧。若与其它角色同屏显得过大，优先缩刃而不是缩人（人必须保持 112 高）。
4. **走帧没重做**。上一版走循环已在实机验过，这次不动。

---

## 6. 换服步骤（建议）

1. 备份现有 `assets/frames/hero-cassandra*.png`（10 张）与 `characters.png` 图集。
2. 用本目录 10 张覆盖。
3. 重建图集（`frame-registry` 的 key 不变，只换图）。
4. 进游戏看三件事：**待机 → 走 → 放技能**（专武各一把都要试）。
5. 有问题的记时间点 + 当时拿着哪把专武，回传给我，不要当场改图。

---

## 7. 判据

**以游戏内最终效果为准。**

- 静态放大图上的红弦、红线位置，都是像素级取舍，不构成否决理由；
- 只有在游戏里出现「比例明显不对」「动作读不出来」「和另一帧分不清」这三类问题时才回退。

回退方式：整个目录换回 `characters/cassandra/review/20261021-scheme-a-128/sets/09-3quarter/`。
