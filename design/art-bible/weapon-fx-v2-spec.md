# 三武器特效优化方案（weapon-fx-v2-spec）

> 版本：v0.1 · TASK-35 · 作者：林绘澄（美术总监）
> 依据：weapons.md §③/§④、art-bible v0.3 §2/§7、balance.ts `FX` 常量块、fx-spec.ts `FX_COLORS`/`DEATH_BURST`、fx-manager.ts（粒子池/拖尾/涟漪/出场环）、review-task28 §6（微调菜单收敛位）
> 状态：**方案文档，供程基岩按此实现**；只读源码，未改任何代码。
> 基线声明：本方案基于 **TASK-34 修复后基线**（p-ring 轨道残影恢复完整环、飞弹箭头+尾焰渲染正常）。所有优化不依赖 TASK-34 的修复实现细节，仅假设「修复后帧/环形态正确可用」；若修复后形态有出入，先对齐帧形态再落本方案。

---

## 0. 结论速览（每武器一句话亮点）

| 武器 | 一句话升级亮点 |
|---|---|
| 血月猎手（飞弹） | 拖尾从「点」升级为「彗尾」（p-streak 沿速度方向）+ 命中冷青冲击环 + 发射喷涌，全部呼应玩家提灯的冷青 |
| 守夜之环（环绕球） | 每颗球体自留冷青尾迹 + 双层轨道环（外环 + 内环反向慢旋），护体"光之环"成型 |
| 月蚀脉冲（冲击波） | 涟漪加密提速 + 最大半径白闪环 + 蓄力脉冲提示 + 地面裂纹，8s 一次的大招"打满存在感" |

---

## 1. 通用原则（预算与纪律不变）

1. **性能预算不变**：draw call ≤8（现状 ≤5，本方案 **+0 新增贴图批次**）；粒子池 ≤200（桌面）/≤100（移动）软上限，超限 soft-cap 拒绝（沿用现机制，绝不破预算）。
2. **token 唯一来源**：所有新颜色取既有 `PALETTE/BOSS/GEM` token；fx-spec `FX_COLORS` 只允许**新增 token 别名**（如 `paper`），不引入新色相。
3. **收敛位纪律**：所有参数落 `balance.ts` `FX` 常量块（新增/微调），禁止散落魔法数；调用方只读常量。
4. **与角色剪影呼应**（本方案与 silhouette-v2-spec 一致）：
   - 飞弹 = 玩家冷青（提灯之光）→ 拖尾/命中/发射全冷青；
   - 环绕球 = 玩家冷青（护体之光）→ 球体尾迹/轨道环冷青；
   - 冲击波 = 血橙红（红=危险）+ 边缘白闪（月蚀亮边，呼应血月月盘 danger 环）；
   - Boss 特效维持猩红金（王冠+披风）。
5. **移动端降级路径**：fxTrails=false 已关拖尾/残影类；新增爆发类（命中/涟漪/白闪）随 fxBursts 保留，但**涟漪数量移动端降档**（§4.3 收敛位）；所有移动端差异收进 runtime-config / 等价开关，不散落 `isMobile`。

---

## 2. 血月猎手（自动飞弹）· 高频单体追踪

### 2.1 升级点

**A. 拖尾形态：点 → 彗尾（P0）**
- 现：`tickMissileTrails` 每 90ms 发 1 颗 `p-circle`（点状，寿命 0.3s）。
- 改：同一节流拍发 1 颗 `p-streak`（12×4 横条帧，`spawnParticle` 已按速度方向 `setAngle`）——沿飞行方向拉成彗尾；`TRAIL_LIFE` 0.3→0.32s、size 2.2→2.0（alpha 淡出本身已产生锥度）。
- 视觉：8 发齐射时是 8 条冷青彗尾而非 8 串点，弹道可读性大幅提升；与玩家提灯冷青同源。

**B. 命中反馈：冷青冲击环 + 火花（P0）**
- 现：命中仅敌人红闪 0.1s + 2px 抖动（enemies §④），武器侧无反馈。
- 改：命中点（`missile` 命中/消失处）触发：
  - 小冲击环：`emitRing('p-ring', x, y, [FX_COLORS.trail], 6, 12, 30, 2.5, 0.18)`（半径 12px 冷青环，短命高亮）
  - 火花：`emitBurst('p-circle', x, y, [FX_COLORS.trail], 4, 120, 2, 0.3)`
- 预算：命中即消失（不连续），8 发同帧命中最坏 10×8=80 粒——软上限兜底；实际受飞行寿命/冷却约束远低于此。

**C. 发射表现：发射喷涌（P0）**
- 发射瞬间玩家位置：`emitBurst('p-circle', player.x, player.y, [FX_COLORS.trail], 3, 40, 1.8, 0.25)`——一声闷响的"开火小 puff"，高频武器有发射存在感。
- 收敛：`FX.MISSILE_LAUNCH_PUFF_COUNT=3`。

**D. 弹体自身：小幅摆动 + 头部光晕（P1/P2）**
- P1 摆动：`missile.ts` 视觉 setAngle 在速度角基础上叠加 `sin(t×20)×FX.MISSILE_WOBBLE_DEG`（±4°），纯视觉，不碰碰撞/寻的。
- P2 头部光晕：节流每 120ms 在弹头处发 1 颗 `p-circle` size 2 alpha 0.5（`FX.MISSILE_HEAD_GLOW_INTERVAL_MS=120`）；或直接烘焙进弹体帧（会动 16×12 帧尺寸，风险高，**不建议**，优先粒子 overlay）。

### 2.2 参数收敛表（balance.ts `FX`）

| 常量 | 现值 | 推荐区间 | 落地 |
|---|---|---|---|
| `TRAIL_INTERVAL_MS` | 90 | 70（60–80） | 彗尾更密；80 为降载档 |
| `TRAIL_LIFE` | 0.3 | 0.32（0.3–0.35） | 尾迹加长 |
| `TRAIL_COUNT_PER_MISSILE` | 1 | 1（维持） | 1 颗 streak 即可 |
| `TRAIL_FRAME`（新） | — | `'p-streak'` | 拖尾帧点→条（fx-manager 一行改） |
| `MISSILE_LAUNCH_PUFF_COUNT`（新） | — | 3 | 发射喷涌 |
| `MISSILE_IMPACT_RING_COUNT`（新） | — | 6 | 命中环粒子数 |
| `MISSILE_IMPACT_RING_RADIUS`（新） | — | 12 | 命中环半径 |
| `MISSILE_IMPACT_SPARK_COUNT`（新） | — | 4 | 命中火花 |
| `MISSILE_WOBBLE_DEG`（新） | — | 4（0–6） | 摆动幅度，0=关 |
| `MISSILE_HEAD_GLOW_INTERVAL_MS`（新，P2） | — | 120 | 头部光晕节流 |

### 2.3 实现位置
- `fx-manager.ts`：`tickMissileTrails` 帧改 `p-streak`；新增 `missileLaunch(x,y)` / `missileImpact(x,y)` 方法。
- `missile.ts` / `PlayScene.ts`：发射事件与命中事件处调用（挂钩点由程基岩确认，本方案不指定具体文件内部）。

---

## 3. 守夜之环（护体环绕球）· 近身持续范围

### 3.1 升级点

**A. 球体自留尾迹（P0）**
- 现：球体本身无尾迹，仅轨道残影环（p-ring 已由 TASK-34 修复为完整环）。
- 改：新增 `tickOrbitTrails(pool, dt)`——每 `ORBIT_TRAIL_INTERVAL_MS` 对每个活跃环绕球各发 1 颗冷青 `p-circle`（size 2.2、寿命 0.25s、速度 0 即原地淡出）——球体绕行时在轨道上留下一圈渐隐光点，护体"光之环"成型。
- 预算：6 颗 ×（0.25/0.14）≈ 11 粒峰值，极低。

**B. 双层轨道环（P1）**
- 现：单层 p-ring（160px，alpha 0.22，20°/s）。
- 改：新增第二内环 Image：半径 `RADIUS - 12 = 68px`、alpha 0.12、反向慢旋 `-12°/s`（同 `fx-ambient` 图集 → 同批次，**+0 draw call**）。
- 视觉：外环粗亮 + 内环细暗反向旋转 → 轨道"双层能量环"。

**C. 命中反馈：节流火花（P1）**
- 现：命中仅敌人红闪（同目标 0.4s 内置冷却）。
- 改：`orbitHit(x,y)`——全局节流 `ORBIT_HIT_THROTTLE_MS=200` 内最多发一次 `emitBurst('p-circle', x, y, [FX_COLORS.trail], 3, 90, 1.8, 0.28)`（3 颗冷青火花）；节流防高频刷屏（球体 6 颗持续命中会变噪声，节流是必要的）。
- 预算：每 200ms ≤3 粒 ≈ 15 粒/s 峰值，可忽略。

**D. 球体自身：烘焙辉光（P1）**
- `orb` 帧 20×20 内加 2 层冷青径向光晕（r9–14 alpha 0.10–0.15）——0 额外 draw call，帧尺寸不变（20×20 帧半宽 10，光晕 r≤10 内，不超界）。
- 视觉：球体从"实心圆"变"发光核"。

**E. 升级表现：+1 球/提速的可见反馈（P2）**
- 升级 #4（+1 球）与转速 +40% 时，绕玩家发一圈小号冷青环（`emitRing('p-ring', player.x, player.y, [trail], 10, 80, 60, 2, 0.4)`）——"build 形态可视化"（weapons §②）的兑现。

### 3.2 参数收敛表（balance.ts `FX`）

| 常量 | 现值 | 推荐区间 | 落地 |
|---|---|---|---|
| `ORBIT_RING_ALPHA` | 0.22 | 0.26（0.22–0.30） | 外环稍提 |
| `ORBIT_RING_SPIN_DEG` | 20 | 24（20–30） | 外环转速微升 |
| `ORBIT_TRAIL_INTERVAL_MS`（新） | — | 140（120–160） | 球体尾迹节流 |
| `ORBIT_TRAIL_LIFE`（新） | — | 0.25 | 尾迹寿命 |
| `ORBIT_TRAIL_SIZE`（新） | — | 2.2 | 尾迹粒子尺寸 |
| `ORBIT_HIT_SPARK_COUNT`（新） | — | 3 | 命中火花数 |
| `ORBIT_HIT_THROTTLE_MS`（新） | — | 200 | 命中火花全局节流 |
| `ORBIT_RING_SECONDARY_ALPHA`（新，P1） | — | 0.12 | 内环透明度 |
| `ORBIT_RING_SECONDARY_OFFSET`（新，P1） | — | 12 | 内环半径 = RADIUS-12 |
| `ORBIT_RING_SECONDARY_SPIN_DEG`（新，P1） | — | -12 | 内环反向转速 |

### 3.3 实现位置
- `fx-manager.ts`：新增 `tickOrbitTrails`、`orbitHit`；构造器加内环 Image（同 p-ring 帧、不同 displaySize/alpha/spin）。
- `orbit-orb.ts`：命中事件调用 `fx.orbitHit`（节流在 fx-manager 内）。
- `procedural-textures.ts`：orb 帧加烘焙辉光（帧内）。

---

## 4. 月蚀脉冲（定时冲击波）· 低频大范围清屏

### 4.1 升级点

**A. 涟漪加密提速（P0，承接 review-task28 §6）**
- 现：`RIPPLE_COUNT=18`、speed 60、size 3——评审已标"一圈稀疏散点，涟漪感弱"。
- 改：`RIPPLE_COUNT=36`、`RIPPLE_SPEED=90`（新常量，当前 60 为字面量散落）、`RIPPLE_SIZE=4`（新常量）。8s 冷却 × 36 粒 = 稀有触发，预算宽裕。
- 视觉：扩散波前从"稀疏点"变"密集波纹环"。

**B. 最大半径白闪环（P0）**
- 扩散至最大半径瞬间（`shockwave.ts` 上升沿/扩散结束点）：`emitRing('p-circle', x, y, [FX_COLORS.paper], 12, radius, 20, 3, 0.18)`——一圈薄白闪（月蚀亮边），0.18s 短命，制造"波到位"的 punch。
- 收敛：`FX.SHOCKWAVE_EDGE_FLASH_COUNT=12`、`FX.SHOCKWAVE_EDGE_FLASH_LIFE=0.18`。
- fx-spec：`FX_COLORS` 新增 `paper: PALETTE.uiPaper`（token 别名，无新色相）。

**C. 蓄力提示脉冲（P1/P2）**
- 8s 冷却"等大招"期：最后 2s（`FX.SHOCKWAVE_CHARGE_PULSE_LEAD_SECONDS=2`）在玩家周围显示 60px 半径的脉冲环（`p-ring` alpha 0.10–0.18 正弦呼吸，`FX.SHOCKWAVE_CHARGE_PULSE_ALPHA=0.15`）——"快好了"的可读信号，玩家可主动走位调整释放时机。
- 视觉纪律：低透明、非持续闪烁源（2s 内呼吸，不与"减少闪烁"开关冲突——建议随 fxTrails 或新增 fxCharge 开关，P2 可砍）。
- 实现：fx-manager 新增 `tickShockwaveCharge(player, secondsUntilReady, dt)`；PlayScene 传入冷却剩余。

**D. 地面裂纹尘屑（P1）**
- 释放瞬间沿波前散 6 颗暗色尘屑（`PALETTE.baseLight` 灰，size 2、寿命 0.4s、speed 30）——"地面被撕裂"的质感；配合冲击波击退升级（80px）时在敌人位置发 2–3 颗同向尘屑。
- 收敛：`FX.SHOCKWAVE_GROUND_CRACK_COUNT=6`。

**E. 扩散环帧升级（P1，帧内）**
- `procedural-textures.ts` `shockwave` 帧 32×32 **尺寸不可变**（`shockwave.ts` 读帧宽作 baseSize）——只在帧内改画：
  - 外环（r14, 3px）改为**断续碎裂环**（沿圆周 8 段弧，段间 2px 缺口）——扩散波前"能量碎裂"；
  - 内环（r10, 2px）保持实心（波后稳定）；
  - 中心微亮（r3）保持。
- 视觉：外裂内实，与"月蚀脉冲"（月蚀=残缺）语义呼应。

**F. 二次内爆环（P2）**
- 扩散结束后 0.15s 内，`shockwave.ts` 加一次快速回缩淡出（scale 回 0.85 + alpha→0）——"脉冲收尾"，工程侧 tween，可选。

### 4.2 参数收敛表（balance.ts `FX`）

| 常量 | 现值 | 推荐区间 | 落地 |
|---|---|---|---|
| `RIPPLE_COUNT` | 18 | 36（32–40） | 涟漪加密（review-task28 §6 建议 36） |
| `RIPPLE_SPEED`（新） | 60（字面量） | 90（80–100） | 涟漪外扩提速，收敛魔法数 |
| `RIPPLE_SIZE`（新） | 3（字面量） | 4 | 涟漪粒子加大 |
| `RIPPLE_COUNT_MOBILE`（新） | — | 24 | 移动端涟漪降档（≤100 池余量） |
| `SHOCKWAVE_EDGE_FLASH_COUNT`（新） | — | 12 | 白闪环粒子数 |
| `SHOCKWAVE_EDGE_FLASH_LIFE`（新） | — | 0.18 | 白闪短命 |
| `SHOCKWAVE_GROUND_CRACK_COUNT`（新） | — | 6 | 地面裂纹尘屑 |
| `SHOCKWAVE_CHARGE_PULSE_ALPHA`（新，P1/P2） | — | 0.15（0.10–0.18） | 蓄力脉冲透明度 |
| `SHOCKWAVE_CHARGE_PULSE_RADIUS`（新，P1/P2） | — | 60 | 蓄力脉冲半径 |
| `SHOCKWAVE_CHARGE_PULSE_LEAD_SECONDS`（新，P1/P2） | — | 2 | 提前提示时长 |

### 4.3 移动端降级
- 移动端 fxTrails=false：蓄力脉冲/地面尘屑若随 fxTrails 开关则关闭；涟漪/白闪随 fxBursts 保留，但涟漪用 `RIPPLE_COUNT_MOBILE=24`（爆发 24+12=36 ≤ 池 100，安全）。
- 二次内爆环（P2）移动端不做（少一条 tween）。

### 4.4 实现位置
- `fx-manager.ts`：新增 `shockwaveEdgeFlash(x,y,radius)`、`shockwaveGroundCrack(x,y,radius)`、`tickShockwaveCharge(...)`；`shockwaveRipple` 读新常量（speed/size）。
- `shockwave.ts`：白闪触发点（扩散结束）、蓄力剩余传入。
- `procedural-textures.ts`：shockwave 帧外环改断续（帧内 32×32）。
- `PlayScene.ts`：shockwave 释放处调用 groundCrack / edgeFlash（若与涟漪同点触发，可在同一上升沿统一调）。

---

## 5. 性能预算汇总（预算不变）

| 项 | draw call | 粒子增量 | 说明 |
|---|---|---|---|
| 现有基线 | ≤5 | — | review-task28 §5.4 口径 |
| 飞弹彗尾（streak） | 0 | ~34（8×(0.32/0.07)） | 从 26 升，可接受 |
| 飞弹发射/命中 | 0 | 每事件 ≤10 | 事件驱动，软上限兜底 |
| 环绕球尾迹 | 0 | ~11（6×(0.25/0.14)） | 低 |
| 双层轨道环 | +0（同批次） | 0 | 内环 Image 同 fx-ambient |
| 冲击波涟漪+白闪+裂纹 | 0 | 36+12+6=54/8s | 稀有触发 |
| 蓄力脉冲（P1/P2） | +0（同批次） | 0 | 1 张 p-ring Image 或复用 |
| **合计** | **≤5 ≤8 ✔** | 峰值 ~180 内（超限 soft-cap 拒绝） | 移动端 fxTrails=false + RIPPLE_COUNT_MOBILE 后显著更低 |

> 软上限纪律（沿用）：池满 reject（`spawnParticle` 返回 false），绝不超预算；典型峰值远低于 200。

---

## 6. 常量收敛总表（一次性给程基岩）

全部位于 `src/config/balance.ts` `FX` 块（新增用 ✚，微调用 ↺）：

| 常量 | 动作 | 现值→推荐 |
|---|---|---|
| `TRAIL_INTERVAL_MS` | ↺ | 90→70 |
| `TRAIL_LIFE` | ↺ | 0.3→0.32 |
| `TRAIL_FRAME` | ✚ | `'p-streak'` |
| `MISSILE_LAUNCH_PUFF_COUNT` | ✚ | 3 |
| `MISSILE_IMPACT_RING_COUNT` | ✚ | 6 |
| `MISSILE_IMPACT_RING_RADIUS` | ✚ | 12 |
| `MISSILE_IMPACT_SPARK_COUNT` | ✚ | 4 |
| `MISSILE_WOBBLE_DEG` | ✚ | 4 |
| `MISSILE_HEAD_GLOW_INTERVAL_MS` | ✚（P2） | 120 |
| `ORBIT_RING_ALPHA` | ↺ | 0.22→0.26 |
| `ORBIT_RING_SPIN_DEG` | ↺ | 20→24 |
| `ORBIT_TRAIL_INTERVAL_MS` | ✚ | 140 |
| `ORBIT_TRAIL_LIFE` | ✚ | 0.25 |
| `ORBIT_TRAIL_SIZE` | ✚ | 2.2 |
| `ORBIT_HIT_SPARK_COUNT` | ✚ | 3 |
| `ORBIT_HIT_THROTTLE_MS` | ✚ | 200 |
| `ORBIT_RING_SECONDARY_ALPHA` | ✚（P1） | 0.12 |
| `ORBIT_RING_SECONDARY_OFFSET` | ✚（P1） | 12 |
| `ORBIT_RING_SECONDARY_SPIN_DEG` | ✚（P1） | -12 |
| `RIPPLE_COUNT` | ↺ | 18→36 |
| `RIPPLE_SPEED` | ✚ | 90 |
| `RIPPLE_SIZE` | ✚ | 4 |
| `RIPPLE_COUNT_MOBILE` | ✚ | 24 |
| `SHOCKWAVE_EDGE_FLASH_COUNT` | ✚ | 12 |
| `SHOCKWAVE_EDGE_FLASH_LIFE` | ✚ | 0.18 |
| `SHOCKWAVE_GROUND_CRACK_COUNT` | ✚ | 6 |
| `SHOCKWAVE_CHARGE_PULSE_ALPHA` | ✚（P1/P2） | 0.15 |
| `SHOCKWAVE_CHARGE_PULSE_RADIUS` | ✚（P1/P2） | 60 |
| `SHOCKWAVE_CHARGE_PULSE_LEAD_SECONDS` | ✚（P1/P2） | 2 |

fx-spec.ts：`FX_COLORS` 新增 `paper: PALETTE.uiPaper`（白闪用，token 别名）。

---

## 7. 测试与验收建议

1. **单测（fx-spec.test 风格）**：断言新常量存在且 ≤ 预算软上限（如 `MISSILE_IMPACT_RING_COUNT + SPARK_COUNT ≤ 10`、`RIPPLE_COUNT ≤ 40`）；`FX_COLORS.paper === PALETTE.uiPaper`（token 来源纪律）。
2. **快照项（人工/真机）**：彗尾密度、双层环观感、涟漪 36 密度、白闪强度、蓄力脉冲是否与"减少闪烁"开关冲突——全部收敛位可调。
3. **预算断言**：基准 draw call 维持 ≤5；粒子峰值典型场景（8 飞弹 + 6 球 + 磁吸 + 涟漪）< 200。
4. **移动端**：`RIPPLE_COUNT_MOBILE` 生效、fxTrails=false 下无拖尾/尾迹/蓄力脉冲残留。

---

## 8. 交接与排期

| 优先级 | 内容 | 批次建议 |
|---|---|---|
| P0 | 飞弹彗尾+发射+命中环；环绕球尾迹；涟漪 36+白闪环 | 与 TASK-34 修复合并后的下一批（新方法为纯增量，无冲突面） |
| P1 | 球体烘焙辉光+双层环+命中火花；冲击波地面裂纹+帧内裂环 | 下一批 |
| P2 | 飞弹摆动+头部光晕；蓄力脉冲；二次内爆环 | 快照后按真机反馈定 |

> 与 TASK-34 并行说明：本方案为「修复后基线」之上的增量；实现时若 TASK-34 改动了 `fx-manager.ts`（如 p-ring/飞弹相关），请先合入再按本方案新增方法，避免覆盖修复。
