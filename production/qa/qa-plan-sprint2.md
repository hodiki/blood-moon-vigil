# 《血月守夜》Sprint 2（E2）QA 计划

> 版本 v0.2 · 作者：严守真（质量保障与测试）· Sprint 2 · 与 E2 工程实现并行
> 上游依据：`production/qa/qa-plan-sprint1.md`（格式/分级/出口标准沿用）、`tests/test-framework.md` §4、`production/epics/epics.md` §2（E2 六 Story）、`design/gdd/weapons.md` §③、`design/gdd/enemies.md` §③、`design/gdd/spawner.md` §③、`design/gdd/consistency-review.md` §3（C3/C7/C4）、`design/concepts/concept.md` §9
> 性质：QA 计划先行、执行随工程完成；质量门为建议性（advisory），最终放行由主理人拍板。

## 1. 测试范围与目标

范围：Epic E2「战斗闭环」6 Story（E2-S1 伤害结算 → E2-S2 敌人 → E2-S3 飞弹 → E2-S4 生成器 → E2-S5 环绕球 → E2-S6 冲击波），对应系统 S8/S4/S3/S5。目标：将 E2 DoD 四条拆为可机械判定用例，数值断言全部落到 L1 Vitest 纯函数层；玩法正确性下沉纯逻辑，冒烟只验"战斗系统活着"。

| Story | 单测（Vitest） | 冒烟 | 手动功能 | 双端矩阵 |
|---|---|---|---|---|
| E2-S1 伤害结算 | ✅ damage（倍率/无敌帧/死亡分发） | — | ✅ 碰撞无敌帧 | —（纯逻辑） |
| E2-S2 敌人面板 | ✅ enemy-panel（3 面板快照） | ✅ 生成 | ✅ 追击/厚血耗时 | ✅ 250 上限 |
| E2-S3 飞弹 | ✅ homing-missile（冷却/追踪/上限） | ✅ 发射/命中 | ✅ 自动触发 | —（逻辑共用） |
| E2-S4 生成器 | ✅ spawner（budget/权重/上限节流） | ✅ 20min 推进 | ✅ Boss 出场/同屏上限 | ✅ 重点 |
| E2-S5 环绕球 | ✅ orbit-orb（3 颗/转速/0.4s 冷却） | ✅ 三武器计数 | ✅ 保护范围 | — |
| E2-S6 冲击波 | ✅ shockwave（8s/半径/穿透） | ✅ 三武器计数 | ✅ 8s 节奏 | — |

统计：单测 5 文件约 45 断言（§2 数值断言清单）；冒烟 4 用例（SMK-E2）；功能手动 12 用例（FUNC-E2）；双端矩阵增量 8 场景。

## 2. 数值断言清单（自动化 · Vitest）

每条均为可机械判定断言；以 weapons/enemies/spawner GDD §③ 表为唯一数值源。

**三武器面板**（W8-2，`tests/unit/weapons/`）：

| 参数 | 飞弹 | 环绕球 | 冲击波 |
|---|---|---|---|
| 伤害 | `expect(W.missile.damage).toBe(12)` | `expect(W.orb.damage).toBe(8)` | `expect(W.wave.damage).toBe(60)` |
| 冷却 | `expect(W.missile.cooldown).toBe(1.2)` | 持续（无冷却） | `expect(W.wave.cooldown).toBe(8.0)` |
| 追踪/转速 | `expect(W.missile.speed).toBe(400)` | `expect(W.orb.angularSpeed).toBe(240)` | — |
| 范围 | `expect(400*3).toBe(1200)`（>环带 900 可达） | `expect(W.orb.radius).toBe(80)` | `expect(W.wave.radius).toBe(280); expect(W.wave.expandTime).toBe(0.4)` |
| 数量/上限 | `expect(W.missile.maxActive).toBe(8)` | `expect(W.orb.count).toBe(3)` | 单次 1 |
| 内置冷却 | 目标死亡重寻 | `expect(W.orb.targetCooldown).toBe(0.4)` | 全穿透 |

**敌人面板**（E8-1，`tests/unit/enemies/enemy-panel.test.ts`）：
`expect(E.zombie).toEqual({hp:12, speed:55, dmg:10, interval:1.0, radius:14, xp:1})`
`expect(E.runner).toEqual({hp:10, speed:150, dmg:8, interval:0.8, radius:12, xp:2})`
`expect(E.brute).toEqual({hp:600, speed:35, dmg:20, interval:1.5, radius:22, xp:15})`

**budget(t) 期望值**（S8-1；t 均在正弦整数周期 sin=0，与 spawner §③ 平均表一致）：

| t | 期望值 | 断言 |
|---|---|---|
| 0 | 1.2 | `expect(budget(0)).toBeCloseTo(1.2, 6)` |
| 300 | 1.95 | `expect(budget(300)).toBeCloseTo(1.95, 6)` |
| 600 | 2.7 | `expect(budget(600)).toBeCloseTo(2.7, 6)` |
| 1200 | 4.2 | `expect(budget(1200)).toBeCloseTo(4.2, 6)` |
| 波动 | 波峰/波谷差 ≥40% | `expect((peak-trough)/trough).toBeGreaterThanOrEqual(0.4)` |

**阶段构成权重**（S8-1）：`expect(weights(phaseOf(120))).toEqual([0.95,0.05,0])`；3–8min `[0.80,0.17,0.03]` 且每 20s 保底 1 厚血；8–15min `[0.65,0.28,0.07]`；15–20min `[0.50,0.35,0.15]`。

**初始 DPS ≈33.5**（weapons §③）：`expect(missileDps()).toBeCloseTo(10,6)`（12/1.2）；`expect(orbDps()).toBeCloseTo(16,0)`（60% 命中）；`expect(waveDps()).toBeCloseTo(7.5,6)`（60/8）；`expect(totalInitialDps()).toBeCloseTo(33.5,1)`。

## 3. 烟雾测试（E2 · ?smoke=1 扩展）

判定规则：SMK-E2 全 PASS 才进入功能测试；任一 FAIL 即"未达 QA"。通用前置：Sprint 1 SMK-01~06 全绿。

| 编号 | 用例 | 步骤 | 预期结果（机械判定） |
|---|---|---|---|
| SMK-E2-01 | 敌人生成 | `?smoke=1` 启动，t≥5s 读 active 计数 | active>0；出生点距玩家 ∈[600,900]（桌面） |
| SMK-E2-02 | 武器发射 | t≥10s 读三武器触发计数 | 飞弹发射数>0、环绕球命中计数>0、冲击波释放计数>0（全自动，零输入） |
| SMK-E2-03 | 子弹命中 | t≥15s 读 `enemy:killed` 计数 | 击杀计数>0；console.error 数组为空 |
| SMK-E2-04 | 20min 曲线推进 | 秒制累加器快进 t=0→1200 步进 75s | 每步帧号递增、无未捕获异常、active 峰值 ≤400/250、池不溢出 |

## 4. 功能测试用例表（FUNC-E2-01~12）

通用前置：SMK 全 PASS；环境 = Chrome 1920×1080（桌面）或 DevTools 390×844（移动）。预期均为具体值。

| 编号 | Story | 前置 | 步骤 | 预期结果 | 优先级 |
|---|---|---|---|---|---|
| FUNC-E2-01 | E2-S3 | RUNNING、零输入 | 静止观察 5s | 飞弹自动发射，间隔 1.2s±0.05s，5s 内 ≥3 发；无任何手动瞄准 | P0 |
| FUNC-E2-02 | E2-S3 | 场上 1 僵尸（12HP） | 单发命中 | 僵尸死亡，伤害=12×1.0=12 | P0 |
| FUNC-E2-03 | E2-S5 | 玩家静止、敌 1 只靠近 | 记录进入半径后受击 | 环绕球 3 颗/半径 80px/转速 240°/s；敌进入即受 8 伤/次，同目标 0.4s 内置冷却 | P1 |
| FUNC-E2-04 | E2-S6 | RUNNING | 记录两次释放间隔 | 冷却 8.0s±0.1s；半径 280px、扩散 0.4s、伤害 60/次全穿透；无目标也释放 | P1 |
| FUNC-E2-05 | E2-S2 | 1 僵尸生成 | 玩家直线移动 2s | 僵尸直线追击 55px/s，位移 ≈110px；敌人互不碰撞（允许重叠） | P1 |
| FUNC-E2-06 | E2-S1/2 | 3 敌同时接触玩家 | 记录单帧伤害 | 只扣 1 次 10 伤（0.5s 无敌帧合并），HP 不瞬降；死亡帧即移出碰撞列表 | P0 |
| FUNC-E2-07 | E2-S2 | t=300s、1 厚血怪 | 集火计时 | 击杀耗时 ≈23s（600÷DPS26，±3s）；5min 节点场上厚血 ≤2 只（C3） | P1 |
| FUNC-E2-08 | E2-S4 | 局时推进至 20:00 | 观测 | 20:00±0.1s 停止生成（预算恒 0）、场上普通敌清空、Boss 登场 | P0 |
| FUNC-E2-09 | E2-S4 | 桌面、生成器拉满 | 持续读 active 计数 | 峰值 ≤400；达上限暂停 2s 后重试、不丢预算、无溢出报错 | P0 |
| FUNC-E2-10 | E2-S4 | 移动 UA、生成器拉满 | 同上 | 峰值 ≤250；暂停频率高于桌面（降级生效）、移动端 30fps+ | P0 |
| FUNC-E2-11 | E2-S3 | 空场 | 观测 3s | 飞弹发射数为 0、无报错；冲击波照常释放 | P2 |
| FUNC-E2-12 | E2-S1 | 玩家 HP≤0 | 触发死亡 | 子弹/环绕球清空、生成器停止（为 E4 结算预验证） | P2 |

## 5. 双端矩阵增量（E2）

| 场景 | 桌面 1920×1080 | 移动 720×1280 |
|---|---|---|
| 同屏上限 | 400（E2-S4） | 250（E2-S4） |
| 生成器降级 | 达 400 暂停 2s 重试 | 达 250 暂停、频率更高；确认 30fps+（S8-§⑥.4） |
| 出生环带 | 600–900px | 500–800px |
| 环绕球描边 | outlineEnabled=true（冷青） | 关闭（outline=false） |
| 死亡粒子 | 8–16 粒 | 8 粒 |
| 屏幕震动 | 开启 | 关闭 |
| fps 目标 | 60 不掉帧 | 30+（目标 60） |

## 6. 出口标准（E2 DoD + concept §9 战斗相关）

全部满足才进入 E3（主理人最终放行）：
1. 三武器全自动触发，无任何手动瞄准/攻击（E2 DoD-1 / W8-1 / C9 支柱 1）——FUNC-E2-01 为判据。
2. 三敌人面板与 enemies §③ 完全一致；接触伤害 + 0.5s 无敌帧正确（DoD-2 / E8-1/2）——数值断言 + FUNC-E2-06。
3. 生成器按 budget(t) 运行 20 分钟压力曲线，同屏 400/250 无溢出（DoD-3 / S8-1/5 / E8-5）——budget 断言 + FUNC-E2-09/10。
4. 三武器数值与升级成长接口就绪，E3 可直接写回（DoD-4 / W8-3）。
5. 战斗相关 concept §9：中位存活 ≥10 分钟、重开率 ≥50%（留存，E4 结算埋点最终确认；Sprint 内以 SMK-E2-04 20min 推进不崩 + FUNC-E2-06 无瞬死为前置信号）；上手 30s 内"只用移动"（以 FUNC-E2-01 零输入自动战斗为信号）。
6. 本计划 §2~§5 全绿：数值断言全过、SMK-E2 全 PASS、FUNC-E2 P0/P1 全关闭、双端矩阵无 FAIL；无未关闭 P0/P1 Bug。

**设计评审项（文策渊，实现后按实测评审是否调参）**：

| 编号 | 评审项 | 判据（本计划实测点） | 超阈值调参建议 |
|---|---|---|---|
| C3 | 厚血怪 5 分钟前堆积 | FUNC-E2-07：5min 节点 ≤2 只 | 3–8min 厚血权重 3%→1% 或延长保底周期 |
| C7 | 15–20min 厚血堆积 | 实测同屏厚血峰值 ≤6 只 | >6 只 → 权重 15%→10% |
| C4 | Boss 战时长 60–90s | 成型 DPS 124→≈50s；需跑一局"非最优 build" | DPS<100 超 90s → 降 Boss HP 或保底武器 |
| C2 | 冲击波 8s 前期体感 | FUNC-E2-04 节奏 + 首 3min 爽感 | 可单点降至 7s |
| C8 | 移动 250 割草密度 | SMK-E2-04 移动档对比桌面 | 接受或移动端冲击波视觉半径补偿 |

## 附 A. 测试代码骨架（示意，非实现）

```ts
// tests/unit/spawner/spawner.test.ts（Vitest）
it.each([[0,1.2],[300,1.95],[600,2.7],[1200,4.2]] as const)(
  'budget(%d) = %d（正弦整数周期点）', (t, exp) => {
    expect(budget(t)).toBeCloseTo(exp, 6);
  });

it('初始 DPS ≈33.5', () => {
  expect(missileDps()).toBeCloseTo(10, 6);   // 12 / 1.2
  expect(orbDps()).toBeCloseTo(16, 0);       // 60% 命中
  expect(waveDps()).toBeCloseTo(7.5, 6);     // 60 / 8
  expect(totalInitialDps()).toBeCloseTo(33.5, 1);
});
```

```ts
// tests/unit/combat/damage.test.ts
it('同帧多敌接触只扣 1 次（0.5s 无敌帧）', () => {
  const dmg = resolveContact([10, 10, 10], { iFrames: 0.5, lastHitAt: t });
  expect(dmg).toBe(10); // 合并为单次
});
```

```ts
// tests/smoke/smoke.e2e.spec.ts（SMK-E2-01~04 落地，?smoke=1）
test('t≥5s 敌人生成、t≥15s 击杀>0、20min 快进无异常', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?smoke=1');
  const r = await page.waitForFunction(() => (window as any).__SMOKE_RESULT__, { timeout: 30_000 });
  const res = await r.jsonValue();
  expect(res.enemyCount).toBeGreaterThan(0);
  expect(res.killCount).toBeGreaterThan(0);
  expect(res.framesAdvanced).toBe(true);
  expect(errors).toEqual([]);
});
```
