# 《血月守夜》主动技迷你验证报告（M1b 质量门）

> 版本：v1.0 · 日期：2026-08-21 · 作者：程基岩（工程主程）
> 上游：`plan-v1.md` §二（质量门要求）· `pillars-v1.md` §5/§6（主动技顶层规则与红线）· `content-design-outline.md` §2.2（守夜人·艾德蒙「提灯闪耀」）
> 范围：Demo（Phaser 3.90 + Vite + TS，347 测试全绿基线）上原型 **1 角色（守夜人）+ 1 主动技（提灯闪耀，DEFENSE）**
> 结论：**PASS（6/6 判据达标，含 2 项 CONCERNS 供 M2 决策）**

---

## 1. 原型范围

| 项 | 内容 |
|---|---|
| 角色 | 守夜人·艾德蒙（hero_edmund，Demo 唯一角色，无需新增） |
| 主动技 | **提灯闪耀**（DEFENSE）：周围 240px 敌人眩晕 2.5s + 自身无敌 1.5s；CD 20s |
| 输入 | 桌面 `Space`/`Shift`（JustDown 触发）；移动端右下角技能按钮（视觉 96×96 / 热区 96 ≥44；非 RUNNING 隐藏） |
| 红线对齐 | 不打断移动输入；LEVEL_UP/PAUSED/GAMEOVER 冻结；无资源条（统一 CD 制）；释放后 100ms 输入锁防抖 |
| 埋点 | `activeSkillCasts`（每局次数，进 RunResult/game:over）· `activeSkillDpsShare`（6 分钟模拟占比，测试断言） |
| 明确不做 | 主动技强化升级分支 / 充能制 / 其他角色技能 / 美术素材替换（M2 范围） |

## 2. 实现位置（最小集，未推倒重来）

**新增 `src/active-skill/`（对齐武器模块分层：纯函数 + 控制器 + 场景装配）**
- `active-skill-math.ts` —— 纯函数：`stunEnemiesInRadius` / `activeSkillDpsShare` / `maxCastsInWindow` / `castsAtInterval` / `simulateActiveSkillDpsShare` / `simulateDefenseSkillUsage`
- `active-skill.ts` —— `ActiveSkill` 控制器（CD 20s / 100ms 防抖 / casts 计数；纯逻辑类，不 import Phaser）

**改动既有文件（均最小侵入）**
| 文件 | 改动 |
|---|---|
| `config/balance.ts` | + `ACTIVE_SKILL`（ID/TYPE/CD/RADIUS/STUN/INVULN/INPUT_LOCK）、`ACTIVE_SKILL_RULES`（红线常量：占比 ≤0.15 / 次数 ≤18 / 中位 12 / 间隔 30s） |
| `input/input-source.ts` | 接口 + `onActiveSkill(cb)`（与 onPauseToggle 同构） |
| `input/keyboard-input.ts` | Space/Shift JustDown → `onActiveSkill` 回调 |
| `input/touch-input.ts` | + `onActiveSkill` 存储 + `notifyActiveSkill()`（HUD 按钮调用） |
| `enemies/enemy.ts` | + `stunnedUntil` 字段；`updateMovement(dt, player, now)` 眩晕期冻结（速度 0 + 攻击计时不递减） |
| `combat/contact.ts` | 眩晕期不造成接触伤害（`stunnedUntil > nowSeconds` 短路） |
| `combat/damage.ts` | + `extendInvulnerabilityUntil` 纯函数（无敌延长，取较晚者不缩短） |
| `player/player.ts` | + `grantInvulnerability(duration, now)`（复用既有 invulnerableUntil 字段） |
| `stats/run-stats.ts` | + `activeSkillCasts` 计数 → RunResult（埋点） |
| `ui/hud.ts` | 移动端技能按钮（右下 96×96、conic-gradient 冷却转圈、非 RUNNING 隐藏）+ `setSkillVisible` / `setSkillCooldown` |
| `fx/fx-spec.ts` | + `lanternFlash` / `lanternFlashCore` 配色（token 来源） |
| `fx/fx-manager.ts` | + `lanternFlash(x, y, radius)`（纯粒子环 + 核心闪，0 新增 draw call） |
| `scenes/PlayScene.ts` | 装配 ActiveSkill；`tryCastActiveSkill`（相位门禁 RUNNING）+ `applyLanternFlash`（眩晕结算 + 无敌）；HUD 冷却同步；埋点 |

**新增测试**
- `tests/unit/active-skill/active-skill-math.test.ts`（9 用例）
- `tests/unit/active-skill/active-skill.test.ts`（8 用例）
- `tests/unit/active-skill/active-skill-sim.test.ts`（5 用例，6 分钟模拟 + 对照组）
- 既有测试扩展：`combat/contact.test.ts`（+2 眩晕用例）、`combat/damage.test.ts`（+1 无敌延长）、`stats/run-stats.test.ts`（+1 埋点）

## 3. 埋点数据（6 分钟模拟 + 单测断言）

| 埋点 | 值 | 判据 | 结果 |
|---|---|---|---|
| `activeSkillCasts`（理论最大，CD 20s × 360s） | **18** | ≤18 | ✅ PASS |
| `activeSkillCasts`（中位节奏，30s 一次） | **12** | 目标中位 ~12 | ✅ PASS |
| `activeSkillCasts`（就绪即放激进模拟，10Hz 尝试） | **18** | ≤18（CD 保证低频） | ✅ PASS |
| `activeSkillDpsShare`（防御型 0 伤害） | **0%** | ≤15% | ✅ PASS |
| `activeSkillDpsShare`（伤害型边界：12 次 × 150 伤 / 40 武器 DPS） | **11.1%** | ≤15%（M2 BURST 参考） | ✅ PASS（留余量 3.9pp） |

对照组（判据 2）DPS 模型（仅武器、无主动技）：Boss HP 4000；6 分钟成型 Lv~27 倍率 2.04：
- 三武器全开 33.5 × 2.04 ≈ 68 DPS → Boss 战 ≈ **58.6s**（落在 60~90s 判据窗口下界）
- 含 2 次伤害强化（+0.30）≈ 78 DPS → ≈ **51s**
- 兜底：仅初始飞弹 10 × 2.04 ≈ 20.4 DPS → ≈ 196s，Boss 出场后 360s 剩余窗口内必杀

> 口径说明：主动技为 DEFENSE 型、不参与任何输出 → **关闭主动技输入不改变上述击杀数学**，判据 2 由构造保证（对照组 = 既有已验证核心循环）。

## 4. 判据逐项核对（6 项验收）

| # | 判据 | 结果 | 说明 |
|---|---|---|---|
| 1 | 6 分钟模拟 DPS 占比 ≤15%；每局触发 ≤18（中位 ~12） | **PASS** | 防御型占比 0%；理论/激进/中位次数 18/18/12 全部达标（§3） |
| 2 | 对照组：关闭主动技输入仍可击杀 6:00 Boss | **PASS** | 主动技 0 伤害 → 关闭输入不改击杀数学；武器 DPS 模型验证 Boss 4000HP 可击杀（§3 对照组） |
| 3 | 释放不打断移动（位移类语义保留输入向量） | **PASS** | `tryCastActiveSkill` 只结算效果，移动向量仍由 `player.update(move)` 每帧消费；眩晕冻结的是**敌人**移动，玩家移动不受影响（判据 4 的验证见 code review + 冒烟；冲刺类技能的「结束后保留原向量」语义本原型为眩晕+无敌，无位移改动） |
| 4 | 双端输入可触发；非 RUNNING 不可触发 | **PASS** | 桌面 Space/Shift（KeyboardInput JustDown）+ 移动端按钮（HUD → `notifyActiveSkill`）汇入同一 `tryCastActiveSkill`；相位门禁 `state.get() !== RUNNING → return`（CM §5），按钮非 RUNNING 隐藏双保险；100ms 防抖由 ActiveSkill 内部拒绝连点 |
| 5 | 回归：既有 347 测试全绿 + `npm run build` exit 0 + bench 预算不回归 | **PASS** | 全量单测 **373/373 绿**（347 + 26 新增/扩展）；`npm run build`（tsc --noEmit + vite build）exit 0；特效仅粒子环（0 新增持久 draw call），bench 口径未触碰 |
| 6 | 交付验证报告 | **PASS** | 本文件 |

## 5. CONCERNS（不阻塞 M2，供决策）

| # | 项 | 说明 | 建议 |
|---|---|---|---|
| C1 | 桌面无冷却 HUD 指示 | 原型桌面仅键盘触发 + 释放特效反馈，无按钮/冷却转圈（移动端按钮有 conic-gradient 转圈） | M2 加桌面技能槽冷却指示（对齐武器槽风格，art-bible §6） |
| C2 | 伤害型主动技边界敏感 | 若 M2 新增 BURST 型：**满 18 次 × 150 伤 × 低 DPS 33.5** 时占比 ≈15.8% 越线（红线 15%）；中位 12 次 × 150 伤 × 40 DPS = 11.1% 安全 | BURST 型技能 CD 上调 ≥18s 或单次价值 ≤120；或复用 `simulateActiveSkillDpsShare` 在 M2 数值校验中强制断言 |
| C3 | 眩晕视觉反馈最小化 | 原型无逐敌眩晕指示（仅释放瞬间冷青环 + 核心闪 + 敌人静止），手感靠「敌人突然不动」传达 | M2 补逐敌眩晕小图标/变色（不增 draw call 的 tint/角标方案） |
| C4 | 待真机验证 | 移动端按钮 96×96 按设计空间（720×1280）布局，热区由 overlay-scale 缩放到真机 | 进 M2 前真机 Playtest 复测热区/误触（control-manifest §9 C-1 同款流程） |
| C5 | 冒烟未覆盖主动技输入 | 既有 L2 冒烟只验场景装配；主动技触发/相位门禁由纯逻辑单测覆盖，未走浏览器冒烟 | M2 冒烟扩展点按技能按钮 + 断言 casts |

## 6. 回调预案（本次未触发）

判据 1（占比/次数）若 FAIL 的回调顺序（pillars §7 残留风险缓解）：
1. **CD 上调 ≥18s**（首选，pillars §7「回调 CD 至 ≥18s」）：`ACTIVE_SKILL.CD` 20→22/25，理论次数 18→16/14，进一步拉开占比余量；
2. **占比下调**：对伤害型技能削单次价值（≤120）或限定吃 50% 总倍率（pillars §6.5）；
3. 极端情况降为**纯被动**（放弃主动技原型）。

本次原型为 DEFENSE 型（0 伤害），判据 1 天然达标，无需回调。

## 7. 测试证据路径

- 新增：`tests/unit/active-skill/active-skill-math.test.ts` / `active-skill.test.ts` / `active-skill-sim.test.ts`
- 扩展：`tests/unit/combat/contact.test.ts`（眩晕不接触伤害）、`tests/unit/combat/damage.test.ts`（无敌延长）、`tests/unit/stats/run-stats.test.ts`（activeSkillCasts）
- 回归命令：`npm run test`（373 绿）→ `npm run typecheck`（0 error）→ `npm run build`（exit 0）
- 已确认不触碰：`tests/bench/*`（bench 口径未动）、`?smoke=1` 内嵌自检、Playwright 冒烟

## 8. 与设计文档一致性

- 未改动任何设计文档（`design/`、`production/official-v1/plan-v1.md` 保持原样）
- 数值全部落 `config/balance.ts`（唯一配置来源），与 content-design-outline §2.2 / pillars §6 逐项一致（`balance.test.ts` 埋点断言同步）
- 本原型不提交 git（硬约束遵守）
