# NV-REVIEW-FIX 批次 F 收官报告（v0.8 审查修复·批次 F）

- 日期：2026-09-01
- 执行：engineering-lead（程基岩）
- 基线：`1fb90ed`（批次 A~E 收官，1291 用例全绿）
- 收官：`9861da4`（HEAD，**1316 用例全绿** / typecheck 0 / build 通过）
- 审查输入：`production/official-v1/项目审查结论-v0.8-2026-09-01.md`

---

## 1. W-F1 PlayScene 结构拆分（P1-7）—— 完成

**行数对比：2015 → 1200 行**（拆分期间任何一步均保持 1291 用例全绿；W-F3/W-F4 接线新增后收敛回 1200 门内，commit `9861da4`）。

按「机械搬移 + 端口注入（ports + `attach()`，箭头闭包调用期才解引用）」拆出 8 个协作模块（`src/scenes/run/*`，ADR-003 单场景原则不变）：

| 模块 | 文件 | 行数 | 职责 | commit |
|---|---|---|---|---|
| BenchSmokeRunner | run/bench-smoke-runner.ts | 149 | smoke/bench/qa 运行模式（36s 基准） | `35f9cbe` |
| BossSkillConsumer | run/boss-skill-consumer.ts | 159 | Boss 五槽运行时消费（召唤/幻象/领域/慢区） | `2e03598` |
| ExclusiveRunAssembler | run/exclusive-run-assembler.ts | 132 | 专武选择页装配（Q-b/Q-d 装配链/HUD 槽扩列） | `6806d48` |
| RelicFieldRunner | run/relic-field-runner.ts | 186 | 圣物/祭坛/银雨/十二灯减伤窗口 | `69c8b6d` |
| UpgradeFlowController | run/upgrade-flow-controller.ts | 323 | v3 三选一 + 质变卡双节拍管线 | `b1bf7cd` |
| DerivativeCastBridge | run/derivative-cast-bridge.ts | 245 | 衍生技施放/结算/狂化/审判光环 | `07fd78c` |
| KillLootConsumer | run/kill-loot-consumer.ts | 273 | 击杀消费/掉落/图鉴/功绩/预警/稀有宝箱 | `14b66e1` |
| TreeApplier | run/tree-applier.ts | 154 | 天赋树写回（A-2）+ 复活判定 + 遗言余烬 | `f7fb1b4` |

模块图与沿用约定已写入 `docs/architecture/architecture.md` §3.1.1；`tests/unit/review-fix-f.test.ts` 含八模块实例化/attach 接线守卫（防回填）。

## 2. W-F2 双轨隔离收口（EG-2，归档不删）—— 完成（`23aa065`）

- `WeaponSystem.evolve`：函数体改 `[EG-2]` throw 守卫；原实现归档于 `evolveArchived`（不删）；`EVOLUTIONS` / `SUPER_WEAPON_EVOLUTION` 资产保留并在测试中断言在位。
- `ACTIVE_SKILLS`（`config/balance/active-skill.ts`）：`@deprecated`（旧轨，衍生技运行时替代）；确认 PlayScene 无 import（源码断言固化）。
- `merit-overlay`：运行时入口隐藏——src 无任何 MeritOverlay import，start-overlay 功绩按钮走 `openTree`（树替代）；存档迁移（meritPoints/meritEquipped/pureInGame 折算）在 stats/save 保留，不受影响。
- 不可达断言 7 例（`tests/unit/review-fix-f.test.ts`）。

## 3. W-F3 BUG 修复 —— 完成（`5f0c131`）

| BUG | 根因 | 修复 | 用例 |
|---|---|---|---|
| BUG-3 结算页矮视口（P1-15） | `max-height: calc(100dvh - 32px)` 落在 `transform:scale` 设计空间容器内，dvh 被 scale 再乘（1280×656 下面板只渲染 ~38% 可用高度） | dvh/dvw 上限 ÷ `var(--bmv-overlay-scale, 1)` 折回设计空间（桌面 + 移动媒体查询） | 1280×656 断言：scale≈0.607，修复后视觉高度 = 视口 − 32px；源码守卫禁旧写法残留 |
| BUG-4 序章 Esc（P1-16） | `window.setTimeout` 脱离相位系统（场景重启后仍触发）；`checkPause` 相位无关，PROLOGUE 内 Esc 被吞无反馈 | 序章自动推进改 Phaser Scene clock（`PrologueClock` 端口，随相位冻结/场景销毁）；PROLOGUE 相位内 Esc 由序章消费（推进/跳过，与点击同语义） | 时钟接线源码断言 + indexForAdvance 语义回归 |
| BUG-6 音频手势 resume（P1-17） | `unlock` 失败（自动播放策略）后无手势重试 → 移动端整局静音 | `pointerdown`/`keydown` 常驻 passive 监听，800ms 节流 `ctx.resume()`；destroy 拆装 | 接线 + 节流 + 拆装源码断言 |

## 4. W-F4 收尾小项 + 测试补强 —— 完成（`d3dd1da` / `48c4480`）

- **P2-6**：`FORMATION_RULES.RUNS_PER_GAME_ANCHOR [4,7] → [3,4]`（对齐 GDD v1.1）+ 断言。
- **P2-2**：`matchGuaranteeSeatV3` 席位号（P1~P5）透传至 `UpgradeV2Option.seat` → 升级卡角标按「P1 保底」…「P5 保底」明示（levelup-overlay）；P1 命中/空池回退均有用例。
- **EXCLUSIVE_SELECT 相位矩阵**：新增 `tests/unit/core/phase-exclusive-select.test.ts`（6 例：插页合法转换/非法全矩阵/单局一次/完整开局长链/smoke 直通分支）。
- **模块协作测**：PlayScene × 8 模块实例化 + attach + enemy:killed 闭包转发 + 搬移方法零残留守卫。
- **文档**：`docs/architecture/architecture.md` §3.1.1 模块图；`CHANGELOG.md` 增 [Unreleased] 批次 F 条目。

## 5. 提交清单（1fb90ed → 9861da4，13 commits）

```
35f9cbe W-F1 BenchSmokeRunner      2e03598 W-F1 BossSkillConsumer
6806d48 W-F1 ExclusiveRunAssembler 69c8b6d W-F1 RelicFieldRunner
b1bf7cd W-F1 UpgradeFlowController 07fd78c W-F1 DerivativeCastBridge
14b66e1 W-F1 KillLootConsumer      f7fb1b4 W-F1 TreeApplier
23aa065 W-F2 双轨隔离收口          5f0c131 W-F3 BUG-3/4/6
d3dd1da W-F4 P2-6/P2-2/矩阵/协作   48c4480 docs 架构图+CHANGELOG
9861da4 行数收敛回 1200 门内（HEAD）
```

## 6. 质量门

- `npm run typecheck`：0 错误
- `npm test`：**106 文件 / 1316 用例全绿**（基线 1291 + 批次 F 新增 25：W-F2 7 + W-F3 6 + W-F4 12）
- `npm run build`：通过（仅既有 chunk 体积提示）
- 红线遵守：未改 XP 曲线与 budget；未放宽任何 GDD 断言；未 push。

## 7. 残留与风险

1. **P4 窗口权重 `applyP4WindowWeight` 与 P3 权重对齐口径**沿 v3 现状未动（批次 G 候选）。
2. `WeaponSystem.isEvolutionEligible` / `evolution-engine` 纯引擎与 `upgrade-pool-v2` 旧轨仍归档在库（EG-2 不删；无运行时调用点，源码断言守卫）。
3. `merit-overlay` 模块与其单测保留（仅缺运行时入口）；后续彻底退役可随存档折算批次一并处理。
4. PlayScene 1200 行贴近门限，新增玩法请直接落 `src/scenes/run/*` 模块（约定见 architecture.md §3.1.1）。
5. W-F3 的 BUG-3/4/6 用例以纯函数 + 源码守卫为主（node 测试环境无 DOM/Phaser window）；真机回归建议补 1280×656 视口与移动端音频各 1 次手测。
