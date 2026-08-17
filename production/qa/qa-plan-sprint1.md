# 《血月守夜》Sprint 1（E1）QA 计划

> 版本 v0.1 · 作者：严守真（质量保障与测试）· Sprint 1 · 与 E1 工程实现并行
> 上游依据：`tests/test-framework.md`（三层测试与 E1 清单）、`production/epics/epics.md`（E1 六 Story 验收/DoD）、`docs/architecture/control-manifest.md` §8、`design/ux/ux-spec.md`、`design/concepts/concept.md` §9
> 性质：QA 计划先行、执行随工程完成；质量门为建议性（advisory），最终放行由主理人拍板。

## 1. 测试范围与目标

范围：Epic E1「工程地基与移动」6 Story（E1-S1 脚手架冒烟 → E1-S6 玩家移动+地图），对应 S1/S2/S9 与 core 基建。目标：将 E1 DoD 四条验收拆为可机械判定的用例——L1 纯逻辑（Vitest）断言数值，L2 冒烟断言"引擎活着"，浏览器手动 + 双端矩阵覆盖手感/渲染/UA 差异等 L1/L2 盲区。用例编号前缀：SMK（冒烟）/ FUNC（功能）/ 矩阵（MTX）。

| Story | 单测（Vitest） | 冒烟 | 浏览器手动 | 双端矩阵 |
|---|---|---|---|---|
| E1-S1 脚手架 | — | ✅ typecheck/build/帧推进 | ✅ canvas 目检 | ✅ 双端 UA 首帧 |
| E1-S2 core | ✅ 4 文件（state/time/pools/events） | — | ✅ 暂停冻结 | —（纯逻辑） |
| E1-S3 RuntimeConfig | ✅ config 快照×2 | — | ✅ UA 切分辨率 | ✅ 重点 |
| E1-S4 键盘 | ✅ move-vector | — | ✅ WASD/方向键/斜向 | ✅ 桌面 |
| E1-S5 摇杆 | ✅ joystick-math | — | ✅ 死区/手感 | ✅ 移动 |
| E1-S6 移动+地图 | ✅ player-stats | — | ✅ 边界/障碍/暂停 | ✅ 双端 |

统计：单测 7 文件（约 30 断言，以 test-framework §4 为准）；冒烟 6 用例；功能手动 17 用例；双端矩阵 10 场景 × 3 视图。

## 2. 烟雾测试用例（E1-S1）

判定规则：SMK 全 PASS 才进入功能测试；任一 FAIL 即"未达 QA"。

| 编号 | 用例 | 步骤 | 预期结果（机械判定） | 归属 |
|---|---|---|---|---|
| SMK-01 | typecheck 退出码 | `npm run typecheck` | 退出码 0 | CI / pre-commit |
| SMK-02 | build 成功 | `npm run build` | 退出码 0，dist 产出（base:'./' 生效） | CI |
| SMK-03 | canvas 渲染 | 启动 dev，查询 canvas | canvas 存在且 WebGL 上下文成功 | Playwright |
| SMK-04 | 帧推进 | rAF 采样 | 30 帧内帧号递增 ≥30 帧 | Playwright / 内嵌 ?smoke=1 |
| SMK-05 | 无 console error | 收集 console.error/pageerror | 错误数组为空 | Playwright |
| SMK-06 | 双端 UA 首帧 | Chrome + iPhone UA 各加载 | 均出首帧、无未捕获异常 | 浏览器手动 |

补充（P2，非门控）：`package-lock.json` 已提交、Phaser 版本 ≥3.60（E1-S1 验收 5）。

## 3. 功能测试用例（E1-S2~S6）

通用前置：SMK 全 PASS；环境 = Chrome 1920×1080（桌面）或 DevTools iPhone 390×844（移动）。预期结果均为具体值，可机械判定。

| 编号 | Story | 前置 | 步骤 | 预期结果 | 优先级 |
|---|---|---|---|---|---|
| FUNC-01 | E1-S2 | RUNNING | 按 Esc | phase=PAUSED，物理/Tween/输入全冻结 | P0 |
| FUNC-02 | E1-S2 | PAUSED | 再按 Esc | 回 RUNNING，世界恢复 | P1 |
| FUNC-03 | E1-S3 | 桌面 UA | 加载，读 RuntimeConfig | design 1920×1080、maxEnemies=400、outlineEnabled=true | P0 |
| FUNC-04 | E1-S3 | 移动 UA | 加载，读 RuntimeConfig | design 720×1280、maxEnemies=250、outlineEnabled=false、spawnRing=[500,800] | P0 |
| FUNC-05 | E1-S4 | 桌面 | 按 W/S/A/D 各 2s | 角色上/下/左/右移动，四向速度一致 | P0 |
| FUNC-06 | E1-S4 | 桌面 | 按 ↑/↓/←/→ | 同 FUNC-05（方向键等价） | P1 |
| FUNC-07 | E1-S4 | 桌面 | 按 W+D 斜向，计时测位移 | 位移向量长 ≤1，斜向速度 = 单方向（不超速） | P1 |
| FUNC-08 | E1-S4 | 桌面 | 松开全部按键 | getMove=(0,0)，角色静止 | P2 |
| FUNC-09 | E1-S5 | 移动 | 左半屏 pointerdown | 按下点生成摇杆底座（视觉 96px/半径 48px） | P0 |
| FUNC-10 | E1-S5 | 移动 | 右半屏 pointerdown | 无摇杆、无移动响应 | P1 |
| FUNC-11 | E1-S5 | 移动 | 中心 10% 内拖动（<4.8px） | 输出 (0,0)，角色不动（防误触） | P1 |
| FUNC-12 | E1-S5 | 移动 | 拖至半径外 | 向量 clamp ≤1，幅度 = 速度百分比（ADR-002） | P1 |
| FUNC-13 | E1-S5 | 移动 | pointerup / pointercancel | 向量归零、摇杆淡出隐藏 | P1 |
| FUNC-14 | E1-S5 | 移动 | 进入 PAUSED（暂停键或 Esc 代理） | 摇杆隐藏、移动输入冻结（CM M10）；恢复需重新按下激活 | P0 |
| FUNC-15 | E1-S6 | 双端 | 直线移动计时 3s | 位移 ≈ 660px（220px/s×3s，±5%） | P0 |
| FUNC-16 | E1-S6 | 双端 | 冲向地图角落持续移动 | 坐标恒在 [0,3000]×[0,3000]，角色不出图 | P0 |
| FUNC-17 | E1-S6 | 双端 | 撞障碍物 | 被 AABB 阻挡，不可穿墙/穿障碍 | P1 |
| FUNC-18 | E1-S6 | 双端 | 人为限帧 30fps 移动 | 位移不跳变（clampDelta 生效） | P2 |

## 4. 双端测试矩阵

说明：移动设计分辨率 720×1280（竖屏）；DevTools 390×844 为等比缩放 CSS 视口，验证分辨率等比与热区物理尺寸。热区/字号标准以 control-manifest §6、ux-spec §6 为准（即 art-bible §3 尺寸规范与 accessibility Basic #3/#4 的落地转写；`art-bible.md`/`accessibility-tiers.md` 未入库，需直接对照请设计侧补交）。

| 场景 | 桌面 Chrome 1920×1080（横） | 移动 390×844（竖） | 移动横屏 844×390 |
|---|---|---|---|
| 首帧渲染 | canvas 出现、无 console error | 同左 | 同左 |
| 分辨率生效 | design 1920×1080 | design 720×1280 等比缩放 | 等比缩放、不裁切 |
| 移动输入 | WASD/方向键 8 向 | 左半屏摇杆（死区 10%） | 摇杆可用 |
| 斜向归一化 | 向量长 ≤1 | 幅度=速度%、clamp ≤1 | 同竖屏 |
| 边界 clamp | 坐标 [0,3000]² | 同左 | 同左 |
| 暂停/恢复 | Esc / P | 暂停键 ≥44×44px | 同竖屏 |
| 触控热区 | 升级卡/再来一局 ≥32×32px | 暂停键/卡片/再来一局 ≥44×44px（Basic #3） | 同竖屏 |
| 最小实体 | 无硬性下限（桌面 1920 基准） | 实体视觉 ≥16px 物理（RV-C2） | 同竖屏 |
| 字号下限 | 物理 px 即可 | HUD 数值 20 / 标题 22 / 正文 ≥14px 物理（Basic #4） | 同竖屏 |
| 移动端削减 | outlineEnabled=true、screenShake=true | outline=false、screenShake=false | 同竖屏 |

## 5. Bug 分级标准与提交流程

| 级别 | 定义 | 示例 | 处理时限 |
|---|---|---|---|
| P0 阻塞/崩溃 | 白屏/崩溃/核心输入失效/门控命令失败 | canvas 不渲染、build 失败、WASD 全失效、穿墙越界 | 立即修复，阻塞合入与进入 E2 |
| P1 主要功能失效 | 单端/单项验收不通过 | 摇杆不响应、斜向超速、分辨率错误、暂停无法恢复 | 当日修复，Sprint 内必须关闭 |
| P2 次要 | 功能可用但偏离规格 | 死区手感偏硬、热区差 2px、边界留 1px 缝隙 | 排期修复，不阻塞合入 |
| P3 打磨 | 观感/细节 | 摇杆淡出无动画、HUD 像素级偏移 | 积压 backlog，里程碑前批量处理 |

提交流程（Sprint 内每日 triage 建议）：
1. **提交**：Bug 报告含 环境 / 前置 / 复现步骤 / 预期 / 实际 / 严重度 / 截图或录屏；无完整复现步骤不予处理。
2. **每日 triage**（15min，主理人 + 程基岩 + 严守真）：按严重度排序；P0/P1 当日分配当日关闭；P2 排 Sprint 内；P3 进 backlog。
3. **回归**：每修复一个 Bug 补/跑对应用例（test-framework §4 清单为回归基线），验证通过后关闭并留回归标记。
4. **flaky 隔离**：用例不稳定即 skip + 标记，不得污染门控信号。

## 6. 出口标准（E1 DoD + concept §9 相关部分）

全部满足才进入 E2（主理人最终放行）：
1. 四命令全绿：`dev` 启动无 console error、`build`、`typecheck`、`test` 退出码均 0（DoD-1 / ARCH-§1.4）。
2. 双端可移动：桌面 WASD/方向键、移动左半屏摇杆，在 3000×3000 地图自由移动、不越界、不穿障碍（DoD-2）。
3. core 单测全绿：game-state / time / object-pools / events（DoD-3）。
4. 双设计分辨率生效：桌面 1920×1080、移动 720×1280（DoD-4 / RV-C2）；移动端最小实体 ≥16px、热区 ≥44×44px（对齐 control-manifest §6 / ux-spec §6）。
5. C9-上手（移动/输入部分）：无经验测试者 30s 内说出"只用移动"（Playtest 质量门前置；Sprint 内以 FUNC-05~14 移动可用性冒烟为前置信号）。
6. 本计划 §2~§4：SMK 全 PASS、FUNC P0/P1 全关闭、双端矩阵无 FAIL。
7. 无未关闭 P0/P1 Bug；任一不满足 → 不进入 E2。

## 附 A. 测试代码骨架（示意，非实现）

```ts
// tests/unit/input/move-vector.test.ts（Vitest）
it('W+D 斜向归一化后长度 ≤1，不超单方向速度', () => {
  const v = getMove({ W: true, D: true }); // 纯函数：键组合→向量
  expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1);
  expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6); // 归一化后长度 = 1
});
```

```ts
// tests/smoke/smoke.e2e.spec.ts（Playwright，SMK-03~05 落地）
test('canvas 可见、30 帧推进、无 console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
  const frames = await page.evaluate(() => new Promise<number>((r) => {
    let n = 0; const t = () => (++n >= 30 ? r(n) : requestAnimationFrame(t));
    requestAnimationFrame(t);
  }));
  expect(frames).toBeGreaterThanOrEqual(30);
  expect(errors).toEqual([]);
});
```
