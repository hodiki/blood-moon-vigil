# 整局模拟沙盘（tools/sim）· B1 骨架

无头整局模拟 harness：复用 `src/` 真实模块（生成器预算曲线 / 15 敌配置 / XP 曲线 / 平衡表），
种子化跑 N 局并输出结构化指标。对应 `eng-impact-assessment.md` §4.3 的 5000-run 沙盘接入点
（本批只搭骨架 + 冒烟 N=10；指标校准与大批量留后续批次）。

## 运行

```bash
# 冒烟（默认 10 局，3 图轮转，种子基线 20260829）
npx vite-node tools/sim/run-sim.ts

# 指定局数 / 种子
npx vite-node tools/sim/run-sim.ts --runs 50
npx vite-node tools/sim/run-sim.ts --runs 30 --seed 42
```

输出：逐局进度行 + 末尾结构化 JSON（`SimSummary`）到 stdout。

## 文件

| 文件 | 说明 |
|---|---|
| `sim-run.ts` | 单局引擎 `simulateRun` + N 局聚合 `summarizeRuns`（可被 vitest 引用做指标断言） |
| `run-sim.ts` | CLI 入口（参数解析 + 逐局日志 + JSON 输出） |

## 指标集（占位）

- `deathTimeSeconds`：死亡时点（s；存活通局 = null）
- `bossKilled`：Boss 是否被击杀
- `levelReached` / `kills`
- `dpsCurve`：每 30s 窗口 DPS 采样（开局 DPS 平台带的雏形）
- `levelUpOffers`：升级 offer 序列（**占位**：三选一均 `up_g_1`）
- `damageTakenBuckets`：每 30s 受击分桶

## 骨架边界（后续批次扩展点）

1. **武器模型**：初始飞弹简化命中模型（单目标 + 命中率），非真实弹道/多武器——
   B2 专武批换 `WeaponBehavior` 驱动，接入弹药/CC 状态层。
2. **升级 offer**：占位序列，不消费 `UPGRADE_POOL` 加权抽取/保底席位——B3 池批接入
   `upgrade-pool-v3` 抽取引擎后替换。
3. **Boss**：只走 `BOSSES` 面板，不模拟阶段机制/召唤/血池。
4. **矩阵**：目前 3 图轮转；后续批次扩 角色 × 地图 × loadout 矩阵与 5000-run 种子矩阵
   （20 种子 × 4 角色 × 3 图，对照评估报告 §4.3 的 59 项数值锚点逐项映射输出指标）。
5. **确定性**：mulberry32 种子化，同 seed 复跑结果一致（批量回归/A-B 对照的基础）。
