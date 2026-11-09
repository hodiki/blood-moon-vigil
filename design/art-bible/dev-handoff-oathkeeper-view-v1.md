# 主程交付单 · 守誓者局内可视化

> 2026-11-06 · 交主程
> **现状：游戏里根本看不见守誓者。** 美术已就绪，缺的是"把他画出来"这一段代码。
> 美术侧另见 `ta-handoff-192-oathkeeper-v1.md`（那份只管图）

---

## 1. 缺陷：有数据，没画面

`OathkeeperRuntime` 已经完整：

- 血量 `hp` / `maxHp`
- 位置 `state.x` / `state.y`（会跟随玩家）
- 阶段 `phase`：`companion` / `tombstone` / `gone`
- 承伤转移、撕咬、墓碑、复活全部有实现

但**全仓没有任何代码创建过他的精灵**。`frame-registry.ts:60` 里挂着的三个键没有消费方：

```ts
xw_bell: ['summon-oathkeeper', 'summon-oathkeeper-v', 'summon-oathkeeper-tombstone'],
```

也就是：玩家正被一个**看不见**的东西挡 50% 伤害、被**看不见**的东西撕咬。

---

## 2. 美术已就绪

`characters/oathkeeper/review/20261104-oath/sets/`（7 张，192×192，脚底 y=191）

| 键 | 用途 |
|---|---|
| `summon-oathkeeper` / `-v` | 立姿（`-v` 与主帧同图，预留呼吸槽） |
| `summon-oathkeeper-walk-a..d` | 移动 4 帧，循环序 **a→b→c→d** |
| `summon-oathkeeper-attack-a` | 攻击**单帧**（含拖影） |

> 192 是美术圣经锁定的画布（「必须比她高」，她 128）。**世界内沿用玩家的 scale**，自然就是她的 1.5 倍，不要另调。

---

## 3. 要做的四件事（约 35 行）

### 3.1 建精灵并跟随

`src/scenes/PlayScene.ts` 里，`this.oathkeeper = new OathkeeperRuntime(...)` 之后（当前约 `:486`）：

- 用 `summon-oathkeeper` 建 sprite
- 每帧把 `x` / `y` 同步到 `oathkeeper` 的 `state.x` / `state.y`
- **depth 排在玩家之下**（他是背景性护卫，不该压住她）

### 3.2 相位映射

| `phase` | 表现 |
|---|---|
| `companion` | 显示；静止播 idle，移动播 walk |
| `tombstone` | 显示墓碑帧（**本批未提供 192 墓碑图**，可先沿用旧图或暂时隐藏） |
| `gone` | 隐藏 |

### 3.3 三态动画

| 状态 | 触发 | 播放 |
|---|---|---|
| idle | 速度 ≈ 0 | `idle` ↔ `-v`（1px 呼吸） |
| move | 速度 > 阈值（同 `anim.ts` 的 5px/s） | `walk-a→b→c→d`，**330ms/帧** |
| attack | 撕咬命中（`biteInterval` 1.0s） | `attack-a` 显示 ~150ms 后回 idle |

> **330ms 是必须的**：四帧只覆盖两个半步，用角色的 ~155ms 播会像抽搐（实测）。

> ⚠ **2026-11-09 实测（主理人裁决①，连线批 E）**：`summon-oathkeeper.png` 与 `summon-oathkeeper-v`
> **像素完全相同**（`md5` 一致，逐像素零差异），1px 呼吸位移在 192 画布上 ≈ 体高 0.6%，**物理上不可见**
> → **本版不做呼吸，`idle` 只用基帧**（上表 idle 行的 `↔ -v` 暂不启用）。待美术补**真** `-v` 帧后再启用。

### 3.4 注册表补键

`src/config/frame-registry.ts:60` 的 `xw_bell` 数组追加：

```
'summon-oathkeeper-walk-a', 'summon-oathkeeper-walk-b',
'summon-oathkeeper-walk-c', 'summon-oathkeeper-walk-d',
'summon-oathkeeper-attack-a',
```

---

## 4. 一个坑：不要复用 `anim.ts`

`src/fx/anim.ts:150-165` 在批量建 idle/move 配对时**明确 `continue` 跳过 `-walk-*`**。那套逻辑是给"角色六帧走循环"用的，召唤物走不进去。

**建议**：另起一个 `src/weapons/companion/oathkeeper-view.ts`，别改 `anim.ts`，避免影响已过的角色帧。

---

## 5. 朝向

美术是**斜向右下 30°**（脸与胸甲都偏右）。

- 玩家在右 → 原图
- 玩家在左 → `setFlipX(true)`
- **不要旋转**，斜向角度已经画进帧里

---

## 6. 验收

1. 场内能看到一个**明显比薇奥莱高**的板甲骑士
2. 他移动时播踏步循环，停下回 idle，**左右脚看得出交替**
3. 撕咬时闪一次劈砍帧
4. 挡伤害 / 变墓碑时画面状态跟着变（墓碑图可暂缺）
5. **他不遮挡玩家**（depth 更低）

---

## 7. 相关文件

| 文件 | 说明 |
|---|---|
| `src/weapons/companion/oathkeeper-runtime.ts` | 状态来源（x / y / phase） |
| `src/weapons/companion/oathkeeper.ts` | 状态机 |
| `src/scenes/PlayScene.ts:486` | 需要在这里建精灵 |
| `src/config/frame-registry.ts:60` | 需要补 5 个键 |
| `src/fx/anim.ts:150-165` | **跳过 `-walk-*`，不能复用** |

---

## 8. 明确还缺的（不在本次范围）

- **192 墓碑帧**：旧的是 48px 跪姿，未重画
- 若实测认为 4 帧踏步不够，可补到 6 帧，届时循环顺序与帧时长要一起改
