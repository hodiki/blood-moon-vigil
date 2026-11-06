> **本文件已被取代。** 交付给主程请看 `dev-handoff-oathkeeper-view-v1.md`，给 TA 请看 `ta-handoff-192-oathkeeper-v1.md`。以下保留为过程记录。

# 需求 / 缺陷说明 · 守誓者局内可视化缺失

> 2026-11-04 · 提给主程或 TA
> 美术素材已就绪（8 张 192×192），**但代码里没有任何地方绘制它**，因此当前游戏内看不到守誓者。

---

## 1. 缺陷：有数据，没画面

`OathkeeperRuntime` 已经完整：血量、位置（x/y）、阶段（`companion` / `tombstone` / `gone`）、承伤转移、撕咬、墓碑、复活。

但全仓检索后确认：**没有任何代码创建过守誓者的精灵**。`frame-registry.ts:60` 里挂着的 `summon-oathkeeper` / `-v` / `-tombstone` 三个键，**没有消费方**。

也就是玩家现在被一个看不见的东西挡 50% 伤害、被一个看不见的东西撕咬敌人。

---

## 2. 素材已就绪

`characters/oathkeeper/review/20261104-oath/x192/`

| 文件 | 用途 |
|---|---|
| `summon-oathkeeper-idle.png` | 立姿（主） |
| `summon-oathkeeper-v.png` | 立姿（与 idle 同图，预留呼吸槽） |
| `summon-oathkeeper-walk-a/b/c/d.png` | 移动 4 帧，循环序 **a→b→c→d** |
| `summon-oathkeeper-attack-a/b.png` | 攻击 **2 帧**（2026-11-05 改）：**斜劈中 + 拖影** → **收势 + 残留拖影** |

规格：**192×192**、硬透明、脚底 y=191、内容高 168（= 玩家 112 的 1.5×）、朝向**斜向右下约 30°**（不是侧身）。

> 192 是角色美术圣经锁定的画布（§308/§381：「必须比她高」）。世界内请**沿用玩家的 scale**，这样自然比她高 1.5 倍。

---

## 3. 需要做的（约 35 行）

### 3.1 创建精灵并跟随

在 `PlayScene` 里，`oathkeeper` 初始化之后（当前约 `:486`）：

- 用 `summon-oathkeeper-idle` 建一个 sprite
- 每帧把 sprite 的 `x/y` 同步到 `OathkeeperRuntime` 的 `state.x/y`
- **depth 排在玩家之下**（他是背景性护卫，不该压住她）

### 3.2 相位映射

| `state.phase` | 表现 |
|---|---|
| `companion` | 显示；静止播 idle，移动播 walk 循环 |
| `tombstone` | 显示墓碑帧（**当前缺素材**，先沿用旧 48px 那张或暂时隐藏） |
| `gone` | 隐藏 |

### 3.3 动画三态

| 状态 | 触发 | 播放 |
|---|---|---|
| idle | 速度 ≈ 0 | idle ↔ `-v` 交替（1px 呼吸） |
| move | 速度 > 阈值（建议同 `anim.ts` 的 5px/s） | `walk-a→b→c→d` 循环，**330ms/帧**（2026-11-06 实测修正：四帧只覆盖两步，必须比角色慢一倍以上；角色是 ~155ms/帧） |
| attack | 撕咬事件（`biteInterval` 1.0s） | `attack-a→b` 播一次（约 150ms/帧），回 idle |

> **行走是踏步不是跨步**：步幅只有半肩宽，靠「重心上下 4px + 摆肩 + 交替抬脚」读出来。播放慢了才像重甲。

### 3.4 注册表

`src/config/frame-registry.ts:60` 的 `xw_bell` 数组补上：

```
'summon-oathkeeper-walk-a', 'summon-oathkeeper-walk-b',
'summon-oathkeeper-walk-c', 'summon-oathkeeper-walk-d',
'summon-oathkeeper-attack-a', 'summon-oathkeeper-attack-b', 'summon-oathkeeper-attack-c',
```

### 3.5 朝向

美术是**斜向右下 30°**（脸与胸甲都偏右）。他左右跟随玩家时：

- 玩家在右侧 → 保持原图
- 玩家在左侧 → `setFlipX(true)`

**不要旋转**，斜向角度是画进帧里的。

---

## 4. 验收

1. 场内能看到一个**明显比薇奥莱高**的板甲骑士
2. 他移动时播 walk 循环，停下回 idle
3. 撕咬时播一次劈击
4. 他挡伤害/变墓碑时，画面状态跟着变（墓碑帧可暂缺）
5. 他**不遮挡玩家**（depth 更低）

---

## 5. 当前明确缺的素材（不在本次范围）

- **墓碑帧 192**：旧的是 48px 跪姿，重画待办
- 若实测认为移动 4 帧不够，可补到 6 帧（`walk-a..f`），引擎侧循环顺序需同步

---

## 6. 相关文件

| 文件 | 说明 |
|---|---|
| `src/weapons/companion/oathkeeper-runtime.ts` | 状态来源（x/y/phase） |
| `src/weapons/companion/oathkeeper.ts` | 状态机 |
| `src/scenes/PlayScene.ts` | 需要在这里建精灵（当前 `:486` 初始化 runtime） |
| `src/config/frame-registry.ts:60` | 需要补键 |
| `src/fx/anim.ts:150-165` | 现有 idle/move 配对逻辑**明确跳过 `-walk-*`**，召唤物不能靠它，需另写 |


---

## 7. 补充（2026-11-05）

### 7.1 规则措辞更正

原文「禁十字」不准确。**禁的是「类十字架」**（会被读成宗教符号的图形），
**不禁止结构性十字**——大剑护手（crossguard）就是一横，属于剑的结构，不是宗教符号。

### 7.2 素材位置以 v2 为准

`characters/oathkeeper/review/20261104-oath/x192v2/`（首版 `x192/` 作废，步幅过大、左右脚未交替）

### 7.3 入盒方式变了，比例必须一致

攻击帧带横扫的剑影，按"内容铺满高度"入盒会把身体压小。
改用 `tools/scheme-c/box-knight.mjs`：**统一比例（由 idle 定）+ 头部横向对齐 + 脚底 191**。
七帧现在都是**同一比例**，身体大小一致，只有剑影向外延伸。


---

## 8. 播放速度修正（2026-11-06）

**四帧 = 两个半步**（a 接触 → b 经过 → c 对侧接触 → d 经过），所以一轮走循环的时长是角色的两倍。
GIF 与引擎里都应该用 **330ms/帧**（角色是 ~155ms）。若按角色的速度播，会像在抽搐。

取帧相位也用实测定的：该驱动**一步约 20 帧**，四拍落在 **1 / 11 / 21 / 31**。
（第一版取 25 / 41 是错的——两帧都是"右脚在前"的同一个相位，所以看起来 wc 与 wd 重复。）
