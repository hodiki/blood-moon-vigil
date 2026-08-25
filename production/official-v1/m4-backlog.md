# 《血月守夜》M4 美术素材集成 · 待办清单（backlog）

> 版本：v0.1（TA 批次 1 入局审查后建立）· 日期：2026-08-25 · 记录：工程主程 程基岩
> 定位：M4（外部素材替换程序剪影 + 战斗特效升级，plan-v1 §五）启动前必须处理的接入项。
> 上游：`design/art-bible/ta-review-handoff.md`、`design/art-bible/asset-spec-v1.md` §2.7、`content-id-frame-map.md` §7.4。

---

## 1. P0 · 必做（M4 开工第一件事）

### 1.1 接入脚底 pivot（body offset + setOrigin）——本批判定：**暂缓，M4 一并接**

- **判定依据**：引擎当前**不消费** `assets/atlas/pivots.json` / 图集 `meta.framePivots`。
  - Phaser 3.90 `JSONArray/JSONHash` 解析器只读**每帧** `frames[].pivot`（`src.pivot` → `frame.customPivot` + `pivotX/pivotY`）；
  - 批次 1 图集 `assets/atlas/characters.json` 每帧 `pivot` 字段 **0 处**（`meta.framePivots` 是 TexturePacker 特性字段，Phaser 忽略）；
  - `src/fx/external-atlas.ts` 只按 `cutX/cutY/cutWidth/cutHeight` 复制帧矩形，不读 pivot。
  - 即：精灵 origin 仍为 0.5（= 碰撞圆心），与「不要写 frames[].pivot」铁律一致，无「站到圈上面」问题。
- **接入点（M4 帧名契约替换时一并做）**：
  1. `src/fx/external-atlas.ts` 或新 `src/fx/pivot.ts`：预载/解析 `atlas/pivots.json`，按**同族 base 帧**（如 `player` 取 `player` 而非 `player-skill-a`）查脚底 pivot `(px, py)`。
  2. 精灵接入顺序（ta-review §1.6 铁律）：**先算 body offset，再 `setOrigin`**：
     - `bodyOffsetY = (py - 0.5) * frameHeight`（脚底在下的正数）；
     - 精灵 `setOrigin(px, py)`；
     - 物理 body 以 `setCircle(radius, offsetX, offsetY)` 下移补偿，使碰撞圆心仍落在脚底投影点（约 `y + bodyOffsetY`），**先做 body offset 再改 origin**，顺序反了会整体飘起。
  3. 断言：接入后随机抽样实体，`精灵脚底 − body 圆心` 距离 ≈ 0（±1px）；加单测读 `pivots.json` 断言同族 base 与 variant/skill 帧 pivot 一致（管线已保证）。
- **本批为何不做**：批次 1 是 57 帧契约帧全量替换前的过渡——程序剪影仍按 32 档绘制、与 64 档外部帧并存（`resolveCharacterFrame` 回退）；此时接 pivot 会与「程序剪影 origin 0.5」双轨不一致，收益低、回归风险高。M4 全量替换外部帧后一次接入（帧名契约不变，实体代码零改动）。
- **参考**：`assets/atlas/pivots.json`（脚底归一化原点）、`design/art-bible/ta-review-handoff.md` §1.6 / §5。

### 1.2 朝向统一后全量 flipX

- 美术完成「默认朝右」重绘（批次 1 犬/尸偏左 → 重绘队列见 ta-review §2）后：
  - `src/fx/anim.ts` `defaultFacesRight` 从仅 `player` 扩到 `hero-*` 与 `enemy-*`（或改查表）。
  - 保留死区 `FACING_DEADZONE=8`；竖移保持上一朝向（已实现）。
- 阻塞项：美术 P0~P2 重绘 + 提示词 `default facing right` 契约落地。

---

## 2. P1 · 依赖美术/策划交付（M4 中段）

| 项 | 依赖 | 说明 |
|---|---|---|
| `-walk-a/b` 步态帧接入 | 美术按 §2.7 出 6fps 正向循环 | 引擎已识别后缀并自动建 6fps move（`walkCycleFrames`）；未到货回落 idle |
| 行为标记 6 帧替换程序帧 | 批次 2 标记帧 | `status-markers.ts` 已用 `marker-*` 帧名，到货自动换 |
| 技能环 4 帧（`skill-ring-*`） | 批次 2 | `fx-manager.ts` 已按模板接；可用 `p-ring` 过渡 |
| 三把 Demo 武器精修帧 | 批次 2 | `missile` / `orb` / `shockwave` 保留帧名，只换图 |

---

## 3. P2 · 可选项

- 英雄/精英 `-walk-a/b`（仍 flipX，6fps 正向循环；非缺口）。
- 升级池图标 / UI 帧（批次 3+，不入本批）。

---

## 4. 本批明确「不做」（防回归）

- ❌ 不出四向 × 8 帧走循环（轴心不锁一样抽；规格已定 flipX）。
- ❌ 不改 `PLAYER.RADIUS`（已与 64 档脱钩，`balance.ts` PLAYER.RADIUS=14 不变）。
- ❌ 不写 `frames[].pivot` 进 TexturePacker JSON（Phaser 会自动 setOrigin，打乱碰撞圆心）。
- ❌ 不再把 idle `-v` 接到 9fps move（`anim.ts` 已拆；idle 1.4fps yoyo）。
