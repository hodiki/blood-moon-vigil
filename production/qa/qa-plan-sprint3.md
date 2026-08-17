# 《血月守夜》Sprint 3（E3）QA 计划

> 版本 v0.1 · 作者：严守真（质量保障与测试）· Sprint 3 · 与 E3 工程实现并行
> 上游依据：`production/qa/qa-plan-sprint2.md`（格式/分级/出口标准沿用）、`tests/test-framework.md` §4、`production/epics/epics.md` §3（E3 五 Story）、`design/gdd/upgrade-pool.md`（v0.2）、`design/ux/ux-spec.md` §3、`design/gdd/design-review-e2.md`（C3/C4/need 不动）、`design/gdd/consistency-review.md`（C1/C5）、`design/concepts/concept.md` §9
> 性质：QA 计划先行、执行随工程完成；质量门为建议性（advisory），最终放行由主理人拍板。

## 1. 测试范围与目标

范围：Epic E3「成长闭环」5 Story（E3-S1 经验宝石 → E3-S2 角色成长 → E3-S3 升级池 → E3-S4 三选一 DOM → E3-S5 升级写回），对应系统 S6/S7。目标：将 E3 DoD 四条拆为机械判定用例，数值断言全落 L1 Vitest；交互正确性下沉纯逻辑（抽取/写回），手动用例只验 DOM 交互与防误触。

| Story | 单测（Vitest） | 冒烟 | 手动功能 | 双端矩阵 |
|---|---|---|---|---|
| E3-S1 经验宝石 | ✅ xp-curve/xp-manager（need 序列/20min 曲线/磁吸） | ✅ 掉落/拾取 | ✅ 磁吸 80px | —（池 300/200） |
| E3-S2 角色成长 | ✅ player-stats（+8HP/+4%/每5级+4px/s/总倍率） | — | — | —（纯逻辑） |
| E3-S3 升级池 | ✅ upgrade-pool（12 项/75%/权重/剔除/回退） | — | — | —（纯逻辑） |
| E3-S4 三选一 DOM | ✅ game-state（LEVEL_UP 冻结） | ✅ 弹窗/恢复 | ✅ FUNC-E3-01~04 | ✅ 重点 |
| E3-S5 升级写回 | ✅ upgrade-apply（12 项逐一） | ✅ 选卡生效 | ✅ FUNC-E3-05 | —（逻辑共用） |

统计：单测 5 文件约 42 断言（§2）；冒烟 4 用例（SMK-E3）；功能手动 7 用例（FUNC-E3）；双端矩阵增量 5 场景。

## 2. 数值断言清单（自动化 · Vitest）

**经验与升级曲线**（`tests/unit/xp/xp-curve.test.ts` / `xp-manager.test.ts`，U8-§③）：

| 断言 | 期望值 |
|---|---|
| need(n) 序列 | need(1)=5、need(2)=8、need(3)=11、need(4)=14（5+3(n−1)） |
| Lv30 达级累计 | Σneed(1..29)=1363；含第 30 级需求 1455 |
| 20min 原始经验（efficiency=1） | ≥3000 点 |
| 20min 有效经验（efficiency=0.45） | ≥3000 点（对齐 design-review 3000–3500） |
| 可达等级 | ≥30（U8-5）；同种子可复现（RV-C5） |

**升级池 12 项**（`tests/unit/upgrade/upgrade-pool.test.ts`，U8-1/4）：

| 断言 | 期望值 |
|---|---|
| 池数量 | UPGRADES.length = 12 |
| 机制型占比 | mechanicRatio() = 0.75 ≥ 0.5 |
| 叠加上限 | #3×2 / #4×3（≤6 颗）/ #5×2 / #9×2 / #10∞ / #11×3 / #12×5 |
| 未解锁权重 ×2 | pickWeight(#3, 0 次)=2；≥1 次=1 |
| 上次选过 ×0.5 | 未解锁×选过=1；已解锁×选过=0.5 |
| 抽取 | 三选一不重复；满级剔除；全满级回退 #10 |

**写回断言**（`tests/unit/upgrade/upgrade-apply.test.ts`，E3-S5 / W8-3 / U8-§③）：

| 选项 | 断言 |
|---|---|
| #3 分裂 | 次级弹伤害 ×0.6（12→7.2）；可 2 次 |
| #4 护体球+1 | addOrb 转发；上限 6 颗（基础 3+3） |
| #5 范围+50% | 半径倍率 1.5→2.0（280→420→560px） |
| #6 穿透 | pierce=1 |
| #7 击退 | knockback=true（80px） |
| #8 吸血 | 1HP/击杀（hp 50→51） |
| #9 磁力+100% | 倍率 ×2→×3（80→160→240px） |
| #10 伤害+15% | 加法：×2=1.3（非 1.3225） |
| #11 冷却-8% | ×3 后 0.778688（飞弹 1.2→1.104→1.016→0.934s） |
| #12 HP+20 | ×5 → maxHp 200（含等量回血） |
| 倍率聚合 | Lv30 等级部分 2.16；+2 强化=2.46（加法防指数膨胀） |

## 3. C3 厚血堆积专项（FUNC-E2-07 ≤2 判据）

L1 自动化模拟（`tests/unit/spawner/c3-tank-simulation.test.ts`，TASK-15 已落地）：
① 基线（保底 20s）5min 节点场上厚血 **>2 只**（触发调参）；② 调整（保底 40s，同种子）场上厚血**下降**（杠杆有效）；③ balance 已落地 `TANK_GUARANTEE_EVERY_SECONDS = 40`。
**真机校准项（标注）**：模拟模型未计入走位/武器分摊/同屏上限，会压低实际堆积；最终 ≤2 判据由 FUNC-E3-07 真机 Playtest 校准（design-review C3「须实测校准模型」）。超限预案：保底顶替随机 / 权重 3%→1%（文策渊，主理人拍板）。

## 4. 烟雾测试（E3 · ?smoke=1 扩展）

判定规则：SMK-E3 全 PASS 才进功能测试；任一 FAIL 即"未达 QA"。通用前置：SMK-E2 全绿。

| 编号 | 用例 | 步骤 | 预期结果（机械判定） |
|---|---|---|---|
| SMK-E3-01 | 击杀掉落宝石 | `?smoke=1`，t≥15s 读 gem:spawned | 掉落计数>0（僵尸 1/疾行 2/厚血 15） |
| SMK-E3-02 | 拾取经验增长 | 读 xp 累计 | 拾取后 xp 计数增长>0；磁吸默认 80px 内可拾 |
| SMK-E3-03 | 升级弹窗出现 | 累计达 need(1)=5 | GameState=LEVEL_UP；DOM 卡片渲染 3 张 |
| SMK-E3-04 | 选卡恢复 RUNNING | 触发选择后读状态 | 状态=RUNNING；移动向量归零、无瞬移；console.error 为空 |

## 5. 功能测试用例表（FUNC-E3-01~07）

通用前置：SMK 全 PASS；桌面 Chrome 1920×1080 / 移动 DevTools 390×844。预期均为具体值。

| 编号 | Story | 前置 | 步骤 | 预期结果 | 优先级 |
|---|---|---|---|---|---|
| FUNC-E3-01 | E3-S4 | LEVEL_UP、3 卡渲染 | 分别按数字键 1/2/3（可构造多次升级） | 按 1 选第 1 张、2 第 2 张、3 第 3 张；选中态冷青 2px+缩放 1.03；立即回 RUNNING | P0 |
| FUNC-E3-02 | E3-S4 | 同上 | 鼠标依次点三张卡 | 点哪张选哪张；非卡片区点击无响应；热区 ≥32×32 | P0 |
| FUNC-E3-03 | E3-S4 | 移动 UA、LEVEL_UP | 点按卡片（200×112） | 点按即选（热区远大于 44px）；摇杆选卡期隐藏；恢复后需重新按下激活 | P0 |
| FUNC-E3-04 | E3-S4 | 选卡前按住方向键/摇杆 | ①选卡期读移动向量 ②选卡后立即读 ③点非卡区 ④30s 不选 | ①冻结恒 0 ②恢复归零无瞬移 ③非卡区无响应 ④30s±0.5s 自动选第 1 张 | P0 |
| FUNC-E3-05 | E3-S5 | 已解锁飞弹（冷却 1.2s） | 选「飞弹分裂」后观察一次冷却发射 | 单冷却发 2 枚（主弹+次级弹）；次级弹命中 7.2 伤（12×0.6） | P0 |
| FUNC-E3-06 | E3-S1/4 | 完整一局 20min | 读埋点计数 | 纠结时刻（停留>3s 或强度接近）≥3 次/局；首次升级 ≤30s（5 点） | P1 |
| FUNC-E3-07 | E2-S2 | t=300s | 真机观测厚血场上数 | 5min 节点厚血 ≤2 只（C3 真机校准项） | P1 |

## 6. 双端矩阵增量（E3）

| 场景 | 桌面 1920×1080 | 移动 720×1280 |
|---|---|---|
| 升级卡 | 320×180、间距 24px、整行起点 (456,520) | 200×112、间距 16px、整行宽 632 居中、图标 72×72 |
| 触控热区 | 鼠标 ≥32×32；数字键 1/2/3 | 整卡 200×112（≥44px 达标）、点按即选、无 hover |
| 字号（物理 px） | 标题 22、正文 16 | 标题 ≥22、正文 ≥14（不锁画布缩放） |
| 摇杆 | 无 | 选卡期隐藏；恢复后重新按下激活（防旧向量） |
| 遮罩/误触 | 80% 黑遮罩、非卡区无响应 | 同左；拖拽/长按不响应 |

## 7. 出口标准（E3 DoD + concept §9）

全部满足才进入 E4（主理人最终放行）：
1. 完整闭环成立（DoD-1）：移动→击杀→宝石→升级→三选一→变强→更敢深入——SMK-E3 全 PASS + FUNC-E3-01~05。
2. 20min 模拟累计经验 ≥3000、可达 Lv30+（DoD-2 / U8-5 / RV-C5）——§2 xp 断言。
3. 升级池 12 项、机制型 75%、抽取规则正确（DoD-3 / U8-1/4）——§2 upgrade-pool 断言。
4. 首级升级 30s 内达成（5 点，concept §9 收紧 60s→30s）、纠结时刻 ≥3/局（U8-3 / C9-决策质量）——FUNC-E3-06。
5. 写回 12 项逐一正确、即时生效（DoD-4 / W8-3）——§2 upgrade-apply 断言 + FUNC-E3-05。
6. 本计划 §2~§6 全绿：无未关闭 P0/P1 Bug；C3 真机校准项执行（FUNC-E3-07）。

**设计评审项（文策渊，实现后按实测评审）**：

| 编号 | 评审项 | 判据（本计划实测点） | 超阈值调参预案 |
|---|---|---|---|
| C3 | 厚血 5min 前堆积（已预授权 40s 保底） | FUNC-E3-07 真机 ≤2 只 | 保底顶替随机 / 权重 3%→1% |
| 频率 | 升级频率 / Lv45+ 预警（design-review-e2 #4） | 20min 实测等级；Lv45+ 说明经验偏多 | need 斜率上浮 / 厚血 15 经验下调（择一） |
| C1 | 飞弹分裂卡面文案 | 卡面明确"弹数+1，伤害 60%" | 补"次级弹随机目标"凸显清场 |
| C5 | 伤害强化卡面文案 | 卡面补"对精英与 Boss 效果显著" | 副文案避免"对僵尸无用"误读 |
| 空放 | 冲击波空放（design-review-e2 #1） | E3-S1 掉落接入后空放率埋点 | 有目标才放 vs 接受空放（建议前者保清屏） |
| C4 | Boss 战 60–90s 兜底（E4 前观察，不预调） | 非最优 build DPS<100 | 降 Boss HP 6000→5000 或保底武器 |

## 附 A. 测试代码骨架（示意，非实现）

```ts
// tests/unit/xp/xp-manager.test.ts
it.each([[1,5],[2,8],[3,11],[4,14]] as const)('need(%d)=%d（5+3(n−1)）', (n, exp) => {
  expect(needXp(n)).toBe(exp);
});
it('Lv30 达级累计 1363 点', () => {
  let sum = 0; for (let n = 1; n < 30; n += 1) sum += needXp(n);
  expect(sum).toBe(1363);
});
```

```ts
// tests/smoke/smoke.e2e.spec.ts（?smoke=1 扩展，SMK-E3-01~04）
const res = await page.evaluate(() => (window as any).__SMOKE_RESULT_E3__);
expect(res.gemSpawned).toBeGreaterThan(0);      // 击杀掉落宝石
expect(res.xpGained).toBeGreaterThan(0);        // 拾取经验增长
expect(res.levelUpCards).toHaveLength(3);       // 升级弹窗 3 卡
expect(res.stateAfterPick).toBe('RUNNING');     // 选卡恢复 RUNNING
```
