# 《血月守夜》M2 玩法核心扩展 · Epic/Story 拆分与冲刺计划

> 版本：v1.0（M2 规划）· 日期：2026-08-22 · 作者：程基岩（工程主程）
> 上游：`plan-v1.md`（M2 里程碑定义与质量门）· `pillars-v1.md`（支柱修订 + 主动技红线 §6）· 6 份 GDD（active-skill / weapons-v2 / enemies-v2 / upgrade-pool-v2 / maps / codex）· `sim-verify-v1.md`（数值断言基线）· `consistency-review-v1.md`（6 CONCERNS）· `content-id-frame-map.md`（帧名注册表）· `active-skill-mini-verification.md`（迷你验证 CONCERNS C1~C5）
> 工程基线：`docs/architecture/architecture.md` + `adr-001~004` + `control-manifest.md`；`src/config/balance.ts`（数据驱动入口）；既有测试 **373/373 全绿**（347 + 迷你验证新增 26）
> 交付物：本文件 = **Epic/Story 拆分 + 冲刺划分 + 风险表 + 验收总门**；**不含实现代码、不改 src/、不新建 GDD**（GDD 已齐）
> 待办：主理人汇编后交用户确认，确认后才开始实施

---

## 0. 执行摘要（30 秒版）

M2 把 M1 已定稿的内容规格（4 角色 / 14 武器 + 7 超武 / 14 敌人 + 4 Boss / 3 地图 / 40 升级池 / 主动技扩展至 4 角色 / 图鉴·功绩数据层）落成**可玩闭环**。工程策略 = **数据驱动内容管线先行（Epic A）→ 武器与超武（Epic B）→ 敌人与地图（Epic C）→ 角色/主动技/升级池/图鉴数据层 + 集成收口（Epic D）**，拆 4 个冲刺。每一冲刺硬门：**既有 373 测试全绿无回归** + 该冲刺新增断言全绿 + `typecheck 0 error` + `build exit 0`。主动技迷你验证 5 项 CONCERNS 作为 M2 首批/专项 Story 一并关闭。

| 冲刺 | 主题 | 范围（Story） | 预计工作量 |
|---|---|---|---|
| M2-S1 | 数据基座 + 主动技补全 | Epic A（E1-S1~S9）+ AC-C1/C2/C3/C5 | 5~6 天 |
| M2-S2 | 武器系统扩展 + 超武合成 | Epic B（E2-S1~S10） | 6~7 天 |
| M2-S3 | 敌人 + 地图 + 生成器覆盖 | Epic C（E3-S1~S10） | 6~7 天 |
| M2-S4 | 角色差异化 + 主动技扩展 + 升级池生效 + 图鉴数据层 + 收口 | Epic D（E4-S1~S10）+ AC-C4 | 7~8 天 |

---

## 1. M2 范围与依赖总览（DAG）

```
Epic A 数据基座（E1）
   ├──▶ Epic B 武器系统 + 超武（E2）        [依赖 E1 数据表]
   ├──▶ Epic C 敌人 + 地图（E3）            [依赖 E1 数据表]
   └──▶ Epic D 角色/主动技/升级池/图鉴（E4） [依赖 E1 + E2（武器类强化/超武钥/进化卡）+ E3（Boss 击杀记录/地图解锁流）]
```

关键依赖顺序（plan-v1 §八 风险缓解 + 主理人提示）：
1. **先武器系统再角色差异化**：角色初始武器 / 亲和 kit（sim-verify §4）依赖武器表；武器类强化（up_w_*）是 40 升级池的机制型主体；超武合成引擎是 E4 升级池进化卡入池的前置。→ E2 在 Sprint 2，E4 在 Sprint 4。
2. **先敌人再地图生成器覆盖**：教堂快速怪权重、狼穴移速加权是对**既有敌人 kind** 的权重/数值覆盖，敌人行为（E3-S2~S5）必须先于生成器覆盖（E3-S7）落地。→ 同 Epic C 内部顺序。
3. **图鉴数据层依赖击杀/进化事件**：codex_unlock 的 kill/evolve 记录挂在 `enemy:killed`、超武进化事件上 → E4-S6 依赖 E2（进化）、E3（Boss 击杀）。
4. **迷你验证基座是 M2 起点**：`src/active-skill/`（控制器 + 数学纯函数 + 16 处扩展）**未提交 git**，M2-S1 首个动作 = 用户审批提交基线（见 §6.7）。

---

## 2. Epic/Story 拆分

> Story 命名 `E<n>-S<m>`；每条含：GDD 需求引用（可追溯）、验收标准、测试证据路径。粒度 = 半天~1 天可消化。
> 新增内容一律遵守：**先写测试（验证驱动）→ 实现 → 对照验收逐条确认 → 留测试证据路径**（test-framework §1.2 纯函数抽离纪律）。

### Epic A · 数据驱动内容基座（E1）—— 纯数据层，无行为变更

> 目标：把 M1b 全部 GDD 数值落成 `balance.ts` 类表驱动 + 帧名注册表 + 埋点断言。**本 Epic 不动任何实体行为**，是低风险基座，也是 Sprint 1 主体。

| Story | 内容 | GDD 引用 | 验收标准 | 测试证据路径 |
|---|---|---|---|---|
| E1-S1 | 内容 ID 类型系统与表骨架：`WeaponId`/`EnemyId`/`HeroId`/`MapId`/`UpgradeId` 联合类型 + `WEAPONS: Record<WeaponId, WeaponConfig>` / `EVOLUTIONS` / `ENEMIES`（扩展）/`BOSSES` / `HEROES` / `MAP_CONFIGS` / `UPGRADES`（扩展）/`ACTIVE_SKILLS` 分表骨架 | consistency §1.3 / content-id-frame-map §7 | typecheck PASS；既有 373 测试无感通过；无魔法数字 | `typecheck` + `tests/unit/config/balance.test.ts`（扩展骨架断言） |
| E1-S2 | 武器表 14 + 超武表 7 逐项落表（伤害/冷却/弹速/寿命/上限/半径/环绕数/转速/召唤参数） | gdd-weapons-v2 §3.2~3.5 / §5.2 | 与 GDD 表逐项一致；powerTag 全覆盖（wpn_a_5 归 BLOOD，consistency C1 标注）；超武 7 条含合成映射 `weapon_evolution { wpnId, keyId, evoId }` | 新建 `tests/unit/config/weapon-config.test.ts`（14+7 面板断言） |
| E1-S3 | 敌人表 14 + Boss 表 4 逐项落表（HP/移速/伤/间隔/半径/XP/特殊行为/反制/视觉编码） | gdd-enemies-v2 §3.1~3.4 | 与 GDD 表逐项一致；特殊行为敌人每地图 ≤2 种断言；Boss 4 阶段机制字段（boss_2 召唤/boss_3 冲锋/boss_4 月坠） | 扩展 `tests/unit/enemies/enemy-panel.test.ts`（18 面板断言） |
| E1-S4 | 升级池 40 项表 + 标签模型（`tags: ['global'\|'weapon_class_a'...\|'key'\|'hero_<id>']`）；机制型 34/40 = 85% 断言 | gdd-upgrade-pool-v2 §3.1~3.5 / §3.6 | 恰好 40 项；机制型 85% ≥ 50%；每项带内容 ID + 卡面底色分型（asset-spec §1.6）；抽取标签语义完整 | 扩展 `tests/unit/upgrade/upgrade-pool.test.ts`（40 项 + 标签断言） |
| E1-S5 | 角色与主动技配置表：`HEROES`（4 角色初始 HP/移速/成长/初始武器/powerTag）+ `ACTIVE_SKILLS`（4 技 type/cd/charges/数值）；红线条目常量先行：`rageMultiplierAdd=+0.40`（加法叠加）、`contactAuraFlat=25 伤/s 平摊` | gdd-active-skill §3.2 / sim-verify §10 | 4 角色 4 主动技类型标签/CD/充能与 GDD 一致；狂化加法 +0.40、接触光环平摊常量断言 | 扩展 `tests/unit/config/balance.test.ts` + `tests/unit/active-skill/active-skill-sim.test.ts`（常量断言） |
| E1-S6 | 地图配置表 `map-config.ts`：3 图尺寸/tile/障碍密度/Boss/生成器参数覆盖总表 | gdd-maps §3.4 | 与 GDD 表逐项一致；教堂/狼穴 wolf 权重覆盖后权重和 = 1.00（断言）；狼穴全敌移速 ×1.08 常量 | 新建 `tests/unit/config/map-config.test.ts` |
| E1-S7 | 帧名注册表导出：`frame-registry.json`（图集 key → 帧名列表）+ diff 脚本 | content-id-frame-map §8 / asset-spec §5.2 | 注册表 ⊆ content-id-frame-map 交付集且无多余名；保留帧名未改名 | `frame-registry diff` 脚本断言（测试或 CI 步骤） |
| E1-S8 | sim-verify 数值断言落地：6 分钟模拟（DPS 差异 ≤±15% / 主动技占比 ≤15%·强化后 ≤20% / Boss 60~90s / 无超武 ≤20% / 功绩 ≤10%） | sim-verify §10 | 全部断言 PASS；`activeSkillDpsShare`/`bossFightSeconds`/`rageMultiplierAdd`/`contactAuraFlat` 埋点口径与 §10 表一致 | 扩展 `tests/unit/active-skill/active-skill-sim.test.ts` + 新建 `tests/unit/config/sim-verify.test.ts` |
| E1-S9 | 图鉴/功绩数据表：codex 35 条目结构 + `codex_unlock` 五类（kill/obtain/evolve/progress/trigger）+ 功绩 4 加成 + 纯局内模式开关常量 | gdd-codex §3.1/§3.2/§3.4 | 35 条目（4+14+4+14+7+6）；功绩 4 加成对成型强度影响 ≤10%（口径注）；纯局内模式开关常量 | 新建 `tests/unit/config/codex-data.test.ts` |

### Epic B · 武器系统扩展与超武合成（E2）

> 目标：14 武器四类手感行为 + 7 超武质变 + 合成规则引擎 + 类强化写回。程序剪影随行为模块落地（M2 用程序剪影兜底，M4 无痛替换）。

| Story | 内容 | GDD 引用 | 验收标准 | 测试证据路径 |
|---|---|---|---|---|
| E2-S1 | 武器系统重构为注册表驱动：`WeaponSystem` 由 3 硬编码 → `WeaponId → WeaponBehavior` 实例注册表；统一接口 `WeaponBehavior { update(dt, now, ctx) }`；既有血月猎手/守夜之环/月蚀脉冲迁移无行为回归 | architecture §2 / weapons-v2 §3.0 | 既有 3 武器行为等价迁移（DPS/冷却/上限断言不变）；typecheck/build PASS | 既有 `tests/unit/weapons/*` 全绿（回归） |
| E2-S2 | A 类弹幕 5 把：血月猎手（继承）+ 银针连弩（穿透 1）+ 圣银火铳（5 发扇形 45°）+ 幽灵飞刃（去回双段）+ 骨钉标枪（贯穿 3 + 扫掠碰撞）；弹体程序剪影 `proj-*` | gdd-weapons-v2 §3.2 / §6.9 | 5 把面板与行为断言；弹道上限达标；骨钉标枪 700px/s 扫掠不漏判 | 新建 `tests/unit/weapons/projectile-weapons.test.ts` |
| E2-S3 | B 类环绕 3 把：守夜之环（继承）+ 荆棘圣环（减速 30% 1s）+ 圣光壁垒（光环 6/s + 承伤 -10%）；`orb-thorn`/`aura-barrier` 剪影 | gdd-weapons-v2 §3.3 | 环绕数/转速/半径/同目标 0.4s 内置 CD 断言；壁垒承伤 -10% 与减伤升级加法叠加上限 -30% | 扩展 `tests/unit/weapons/orbit-orb.test.ts` |
| E2-S4 | C 类范围 3 把：月蚀脉冲（继承）+ 血池喷涌（池 180px 3s 减速 20%）+ 审判圣火（火 200px 2.5s）；`ring-bloodpool`/`ring-holyfire` 贴花 | gdd-weapons-v2 §3.4 | 冷却/范围/持续/池内多敌独立 tick 断言；同目标同一武器只计最高伤害源一次 | 扩展 `tests/unit/weapons/shockwave.test.ts` |
| E2-S5 | D 类召唤 3 把：血蝠群（2 只/0.5s/12s/重召 5s）+ 狼影猎犬（1 只/1.0s/15s/4s）+ 断罪锁链（直线 200px 25 伤 + 击退 100px）；`summon-*` 玩家侧色系（R-D 裁定） | gdd-weapons-v2 §3.5 | 召唤数/攻击间隔/存在/重召唤间隔断言；召唤物死亡即移除碰撞；玩家侧月银白+冷青描边与同名敌区分 | 新建 `tests/unit/weapons/summon-weapons.test.ts` |
| E2-S6 | 超武合成规则引擎：类强化累计 ≥3 次 + 持钥 → 进化卡入三选一（权重 ×3，视觉 R-B 裁定）；不可逆；进化瞬间清旧弹体（原子切换） | gdd-weapons-v2 §5.1 | 合成条件正确（不满足不出现/满足必入池 权重×3）；进化原子性断言；超武不再吃类强化 | 新建 `tests/unit/weapons/evolution-engine.test.ts` |
| E2-S7 | 超武 7 行为质变逐把落地（血月天罚/血银霰弹/炽天使之环/月全食/血海/血蝠风暴/狼群领袖） | gdd-weapons-v2 §5.2 | 每把等效 DPS 与 §5.2 一致；质变特效 ≤60 粒子/次（asset-spec §3.7 预算） | 扩展 `tests/unit/weapons/weapon-dps.test.ts`（进化后 DPS 断言） |
| E2-S8 | `UpgradeState` 泛化（命名域 → `stacks: Record<number, number>`）+ 武器类强化 12 分支写回（up_w_a1~d3：分裂/穿透/弹速/数量/转速/半径/范围/伤害/持续/召唤数/索敌/存在） | gdd-upgrade-pool-v2 §3.3 | 12 分支每层效果正确、单分支叠加上限 2 次；类满级判定（累计 ≥3 次）供 E2-S6 | 扩展 `tests/unit/upgrade/upgrade-apply.test.ts` |
| E2-S9 | 弹体上限/无目标跳过/同目标内置 CD/扫掠碰撞/进化清弹体 全量容错断言 | gdd-weapons-v2 §6 | 达上限跳过不报错；无目标 A 类不发射、C 类照常；高速弹扫掠命中；玩家死亡清弹体 | 扩展 `tests/unit/weapons/weapon-system-errors.test.ts` |
| E2-S10 | 武器数值校验：基础 DPS 表（§3.6）+ 无超武满强化 vs 超武差距 ≤20%（§5.3） | sim-verify §2/§6 | 14 武器基础 DPS 与 GDD 表一致；无超武差距 6.3~16.3% ≤20%（壁垒/锁链定位补偿注） | 扩展 `tests/unit/weapons/weapon-dps.test.ts` |

### Epic C · 敌人与地图扩展（E3）

> 目标：14 敌人 + 4 Boss + 3 地图 + 3 套生成器参数覆盖。敌人面板恒定不随局时成长；特殊行为每地图 ≤2 种且有明确反制。

| Story | 内容 | GDD 引用 | 验收标准 | 测试证据路径 |
|---|---|---|---|---|
| E3-S1 | 敌人行为基座扩展：特殊行为接口（相位/光环/召唤/远程/冲锋）+ 标记数据字段；敌人程序剪影形状库扩展（甲虫圆壳/亡魂半透明/尸巫法杖/翼形蝠/圣杯符文/多臂畸体/狼形竖耳/流线狼/石甲纹/人形狼首） | gdd-enemies-v2 §3.0 / asset-spec §4.2 | 行为接口可注入；普通敌共用一池；描边纪律（普通敌禁 FX.Outline）保持 | 既有 `tests/unit/enemies/*` 全绿（回归）+ 新增行为纯函数测试 |
| E3-S2 | 墓地敌人 5 种：行尸/血犬/墓穴甲虫/亡魂（相位）/尸巫（光环 120px 攻速 +20% ×3） | gdd-enemies-v2 §3.1 | 面板断言；相位穿障碍（忽略障碍层）；光环对半径内亡者攻速加成可断言；反制标记 | 扩展 `tests/unit/enemies/enemy-panel.test.ts` + 新建 `tests/unit/enemies/special-behaviors.test.ts` |
| E3-S3 | 教堂敌人 5 种：血信徒/血蝠（空中=相位）/圣杯侍僧（召唤 ≤3）/血肉畸体（精英 500HP）/忏悔者（远程烛火弹 180px/s） | gdd-enemies-v2 §3.2 | 召唤上限 ≤3 达上限暂停；远程弹慢速可躲；精英血条常显；多敌同帧接触只扣 1 次 | 同上（special-behaviors 扩展） |
| E3-S4 | 狼穴敌人 4 种：灰狼/暗影狼/石甲狼（精英 400HP）/狼裔猎手（冲锋：0.5s 蓄力 → 警告线 0.15s → 冲刺 500px/s） | gdd-enemies-v2 §3.3 | 冲锋时序可断言（蓄力/警告/冲刺三态）；横向走位反制成立 | 同上 |
| E3-S5 | Boss 4：血月尊者（继承）+ 血主教·尼禄（阶段2：召唤 2 圣杯侍僧 + 周期血池）+ 狼王·芬里厄（阶段2：蓄力扑击 + 召唤 2 灰狼）+ 血月化身（4:30 后 5% 月坠稀有，非进度门） | gdd-enemies-v2 §3.4 / §6 | 出场 0.5s 霸体；阶段切换 1s 霸体防卡秒；Boss 战 60~90s（收束 Boss）断言；化身不阻塞通关、掉稀有图鉴 | 扩展 `tests/unit/enemies/boss.test.ts` + `boss-math.test.ts` |
| E3-S6 | 地图系统数据驱动：`MapConfig` 驱动 3 图 tile/障碍/装饰/危险区渲染（墓地石板土/教堂石砖+地毯+血池/狼穴岩地+暗绿草） | gdd-maps §3.1~3.3 / asset-spec §1.4 | 3 图地面/障碍/装饰帧名正确；教堂血池危险编码（红斜纹+闪烁+白描边）与地毯区分；障碍禁贴出生点/最小通道 | 扩展 `tests/unit/map/map.test.ts`（3 图布局断言） |
| E3-S7 | 生成器参数覆盖：`map-config` → spawner 覆盖（教堂快速怪权重、狼穴移速加权 ×1.08 + 野兽构成 ↑）；出生环带双端参数化 | gdd-maps §3.4 | 教堂 S2/S3 wolf +0.05、狼穴 S1~S3 wolf +0.05~0.09 且权重和 = 1.00（断言）；狼穴全敌移速 ×1.08 | 扩展 `tests/unit/spawner/spawner.test.ts` |
| E3-S8 | 障碍与血池生成器：种子散布/禁重叠（相邻 ≥64px）/禁贴出生点（≥200px）/最小过道 ≥64px；血池 8~10 处 r120~180（优先于障碍） | gdd-maps §3.0/§6 | 同种子同布局（可复现）；无贴出生点/重叠/卡死通道；血池上不生成敌人出生点 | 扩展 `tests/unit/map/map.test.ts`（生成器断言） |
| E3-S9 | 特殊行为标记 5 类视觉落地：`marker-aura`（幽紫光环）/相位 ghost/`marker-warningline`（蓄力红警告线）/`marker-rune`（头顶符文）/投射红色预警；程序绘制 + 预算 1 Image/怪 | gdd-enemies-v2 §4.2 / asset-spec §2.6 | 5 类标记颜色/形状正确；移动端全保留（反制依赖）警告线加粗 2px；「减少闪烁」关闭呼吸 | 视觉快照 + `tests/unit/fx/fx-spec.test.ts`（标记规格断言） |
| E3-S10 | 敌人/地图数值校验：击杀时间对表 + 承伤曲线 + 同屏上限 + Boss 战时长 | gdd-enemies-v2 §5 / sim-verify §7 | 击杀时间对表断言（§5.1）；0.5s 无敌帧限流；桌面 400/移动 250 无溢出；Boss 60~90s | 扩展 `tests/unit/spawner/c3-tank-simulation.test.ts` + `enemy-panel.test.ts` |

### Epic D · 角色差异化、主动技扩展、升级池生效与图鉴数据层（E4）

> 目标：4 角色可选各带主动技、40 升级池生效、超武可合成全链路、图鉴/功绩**数据层**落地、M2 集成收口。图鉴 UI / 叙事文本表 / 功绩装备页 = M3 范围（本 Epic 只做数据层与事件挂钩）。

| Story | 内容 | GDD 引用 | 验收标准 | 测试证据路径 |
|---|---|---|---|---|
| E4-S1 | 角色选择与开局配置：主菜单 4 卡（守夜人默认 + 解锁流门禁）；角色初始武器（A1/A2/A3/D2）/成长曲线（HP/移速/倍率）差异化；角色程序剪影 `hero-cassandra/violet/galvan` | gdd-codex §3.5 / sim-verify §3 / asset-spec §1.1 | 4 角色选择后开局属性与 sim-verify §3 表一致；锁卡显示解锁条件；玩家侧冷青 2px 描边常亮（R-A） | 扩展 `tests/unit/player/player-stats.test.ts`（4 角色成长断言） |
| E4-S2 | 主动技扩展至 4 角色：`ActiveSkill` 控制器支持充能制（血猎手 2 段 8s/段）；技能效果注册表（heroId → 效果结算）：提灯闪耀（眩晕+无敌）/血影突袭（冲刺+40 伤+标记 ×1.20 4s）/安魂曲（减速+回复 20%）/血月狂化（移速+30%、倍率 +0.40 加法、接触光环 25 伤/s 平摊、击杀回 1HP）；角色技能帧/特效程序剪影 | gdd-active-skill §3.2 / §6 | 4 技类型/CD/充能与 GDD 一致；狂化倍率加法 +0.40 断言；接触光环平摊断言；冲刺结束后保留原输入向量；伤害型只吃 0.5× 总倍率 | 扩展 `tests/unit/active-skill/active-skill.test.ts` + `active-skill-sim.test.ts`（4 技占比断言） |
| E4-S3 | 主动技强化分支 12 项生效（up_a_cd/charge/effect ×4；CD 型角色的「二次充能」槽替换为同强度效果增强）；HUD 冷却转圈 + 充能数更新 | gdd-active-skill §3.3 / upgrade-pool-v2 §3.5 | 12 分支各 1 次；强化后主动技占比 ≤20% 封顶（断言）；HUD CD 数字/充能数即时可见 | 扩展 `tests/unit/active-skill/active-skill-sim.test.ts`（强化后占比） |
| E4-S4 | 升级池 40 项生效（承接 E2-S8 泛化）：全局基础 9 + 被动·超武钥 7 + 主动技强化 12 + 武器类强化 12；标签过滤 + 抽取规则 5 条（×2 引导/满级剔除/防重复 ×0.5/进化卡 ×3/超时 30s）+ 回退兜底 | gdd-upgrade-pool-v2 §3.6 | 标签过滤正确（主动技强化仅当前角色、武器类仅已拥有类）；单局可选池 20~28；规则 5 条断言；标签命中为空回退全局 9 | 扩展 `tests/unit/upgrade/upgrade-pool.test.ts`（40 项抽取断言） |
| E4-S5 | 新武器解锁规则：初始 1 把 → 13 把经升级池三选一解锁（卡面 ★ 新武器徽记，未拥有该类时选择 = 解锁 1 把随机该类未拥有武器）；每局高概率 3~4 把成型 | gdd-upgrade-pool-v2 §3.7 | 解锁语义正确（未拥有类选强化项 = 解锁 1 把，不应用分支）；已拥有该类 = 纯强化；已拥有该类全部 = 纯强化 | 扩展 `tests/unit/upgrade/upgrade-pool.test.ts` |
| E4-S6 | 图鉴数据层：codex 35 条目结构 + `codex_unlock` 五类记录 + 事件挂钩（enemy:killed → kill；weapon 获得 → obtain；超武进化 → evolve；通关/解锁 → progress；血月化身 → trigger）；侧边浮字钩子预留（M3 UI 消费） | gdd-codex §3.1/§3.2 | 记录幂等（首杀/首获/首进化/首通不重复解锁）；化身首杀 → 隐藏条目 + 稀有掉落（`chest`）；事件条目按进度解锁 | 新建 `tests/unit/codex/codex-unlock.test.ts` |
| E4-S7 | 功绩数据层：session-stats 功绩点数计算（存活 +1/30s、击杀 +1/50、通关 +10、首杀 +2、化身 +5；典型 28~32/局）+ merit 4 加成配置（同时装 2、单加成 ≤10% 口径）+ 纯局内模式开关 + 结算页功绩条数据 | gdd-codex §3.4 | 功绩计算断言（28~32 典型）；4 加成对成型强度影响 ≤10%；纯局内模式开关生效（QA 用例在纯局内执行） | 扩展 `tests/unit/stats/session-stats.test.ts` |
| E4-S8 | 存档层 `save.ts`：localStorage 图鉴/功绩/解锁流；损坏回退空存档不崩溃 + `.bak` 备份；多端存档独立 | gdd-codex §3.2/§6 | 读写正确；损坏回退；重开/换角色不重复解锁（幂等） | 新建 `tests/unit/stats/save.test.ts` |
| E4-S9 | 解锁流：墓地默认 → 通关解锁血猎手 + 教堂 → 通关解锁修女 + 狼穴 → 击败芬里厄解锁狼裔；地图解锁与角色解锁联动 | gdd-codex §3.5 / maps §3.5 | 解锁条件正确（通关记录驱动）；血月化身任意图可触发 | 扩展 `tests/unit/stats/save.test.ts`（解锁流断言） |
| E4-S10 | M2 集成与收口：3 图可玩、4 角色各带主动技、超武可合成、40 升级池生效；双端性能基准（`npm run bench`）+ 全量回归 | plan-v1 §五 / sim-verify §10 | 见 §8 验收总门；`npm run bench` 桌面 60fps / 移动 30fps+；draw call ≤8；粒子 200/100 | `npm run test` / `typecheck` / `build` / `bench` 全绿 |

---

## 3. 主动技迷你验证 CONCERNS 修复条目（M2 首批/专项）

> 来源：`active-skill-mini-verification.md` §5。C1/C2/C3/C5 为 **M2-S1 首批 Story**（迷你验证基座上最小增量）；C4 为 **M2-S4 专项 Story**（真机复测，随双端收口）。

| # | 项 | 说明 | 修复 Story | 验收门 |
|---|---|---|---|---|
| AC-C1 | 桌面无冷却 HUD 指示 | 原型桌面仅键盘触发 + 释放特效反馈，无按钮/冷却转圈（移动端按钮有 conic-gradient 转圈） | M2-S1：桌面技能槽冷却指示（对齐武器槽风格，art-bible §6：图标 + 旁小转圈/数字，可关闭） | 桌面冒烟断言技能槽存在且冷却状态同步（ready/cooldown 事件） |
| AC-C2 | 伤害型主动技边界敏感 | 满 18 次 × 150 伤 × 低 DPS 33.5 → 占比 ≈15.8% 越线；中位 12 次安全 | M2-S1：`ACTIVE_SKILL_RULES` 增加 BURST 守则常量（**CD ≥18s 或单次 ≤120**）；`simulateActiveSkillDpsShare` 强制断言（≤15%） | `active-skill-sim.test.ts` 新增 BURST 边界断言：CD<18 且单次>120 的配置必须 FAIL（守则强制） |
| AC-C3 | 眩晕视觉反馈最小化 | 原型无逐敌眩晕指示，手感靠「敌人突然不动」 | M2-S1：逐敌 `marker-stun` 纸白星（tint/角标方案，0 新增 draw call；对齐 asset-spec §2.6） | 视觉快照：眩晕敌头顶纸白星；draw call 增量 0 |
| AC-C4 | 待真机验证 | 移动端技能按钮 96×96 按设计空间布局，热区由 overlay-scale 缩放到真机 | M2-S4：真机 Playtest 复测热区/误触（control-manifest §9 C-1 同款流程）；热区 ≥44×44 | 真机复测记录 PASS；触控矩阵（按钮 vs 摇杆/暂停键无重叠） |
| AC-C5 | 冒烟未覆盖主动技输入 | 既有 L2 冒烟只验场景装配；主动技触发/相位门禁由纯逻辑单测覆盖 | M2-S1：L2 冒烟扩展点按技能按钮 + 断言 `activeSkillCasts > 0`；非 RUNNING 态按钮隐藏断言 | `smoke.e2e.spec.ts` 扩展用例 PASS |

---

## 4. 冲刺划分（4 个冲刺）

> 每冲刺验收门统一包含：**既有 373 测试全绿（硬门）** + 该冲刺新增断言全绿 + `npm run typecheck` 0 error + `npm run build` exit 0。冲刺内 Story 按上表顺序执行（表内即依赖序）。

### Sprint 1（M2-S1）· 数据基座 + 主动技补全

| 项 | 内容 |
|---|---|
| 范围（Story） | E1-S1~S9 + AC-C1 / AC-C2 / AC-C3 / AC-C5 |
| 依赖 | 无（在迷你验证基座上起步；先经用户审批提交基线，见 §6.7） |
| 验收门 | ① 373 既有测试全绿（硬门）+ E1/AC 新增断言全绿（预计 +100~140 例）；② 帧名注册表导出 diff vs content-id-frame-map PASS；③ weapon-config / enemy-panel / upgrade-pool / map-config / codex-data 断言与 GDD 表逐项一致；④ AC-C1 桌面冷却 HUD 冒烟 PASS、AC-C2 BURST 边界守则断言 PASS、AC-C3 眩晕纸白星视觉快照 PASS、AC-C5 冒烟断言 casts>0 PASS；⑤ 数值断言（E1-S8）全部 PASS |
| 依赖顺序说明 | E1 数据表（S1→S9）先行 → AC 补全可在既有 `src/active-skill/` 上并行；两者在冲刺末统一回归 |

### Sprint 2（M2-S2）· 武器系统扩展 + 超武合成

| 项 | 内容 |
|---|---|
| 范围（Story） | E2-S1~S10 |
| 依赖 | E1（数据表 + 帧名注册表） |
| 验收门 | ① 373 + E1 测试全绿 + E2 新增断言全绿；② 14 武器面板与行为模块可运行（四类手感 A 即时/B 近身/C 清屏/D 后台）；③ 超武合成规则正确（类强化满 3 + 持钥 → 进化卡 权重×3；不满足不出现；进化原子切换）；④ weapon-dps 断言（无超武 ≤20%、基础 DPS 表）；⑤ 弹道上限/无目标跳过/同目标内置 CD/扫掠碰撞断言；⑥ 桌面 60fps 冒烟（同屏 400 敌 + 全弹体）不掉帧 |
| 依赖顺序说明 | E2-S1（注册表重构）→ S2~S5（四类行为）→ S8（类强化写回）→ S6（合成引擎，依赖类强化）→ S7（超武质变）→ S9/S10（容错与数值校验收口） |

### Sprint 3（M2-S3）· 敌人 + 地图 + 生成器覆盖

| 项 | 内容 |
|---|---|
| 范围（Story） | E3-S1~S10 |
| 依赖 | E1（数据表 + 帧名注册表）；**敌人先于地图生成器覆盖**（E3-S2~S5 先于 E3-S7） |
| 验收门 | ① 全量测试全绿（新增 enemy/map/spawner 断言）；② 14 敌人 + 4 Boss 面板断言；特殊行为每地图 ≤2 种且有反制；③ 3 地图数据驱动渲染可玩（tile/障碍/血池；解锁门禁在 M2-S4 接通，Sprint 3 提供简化入口或由 E4-S9 提前合入）；④ 生成器参数覆盖断言（权重和 = 1.00；教堂 wolf +0.05；狼穴移速 ×1.08）；⑤ Boss 60~90s 断言（sim-verify §7）；⑥ 特殊行为标记 5 类视觉快照 + 预算 1 Image/怪 |
| 依赖顺序说明 | E3-S1（行为基座）→ S2~S4（14 敌人）→ S5（Boss）→ S6（地图渲染）→ S7（生成器覆盖）→ S8（障碍/血池）→ S9（标记视觉）→ S10（数值校验） |

### Sprint 4（M2-S4）· 角色差异化 + 主动技扩展 + 升级池生效 + 图鉴数据层 + 收口

| 项 | 内容 |
|---|---|
| 范围（Story） | E4-S1~S10 + AC-C4 |
| 依赖 | E1（角色/主动技/图鉴表）+ E2（武器类强化/超武钥/进化卡）+ E3（Boss 击杀记录/地图解锁流） |
| 验收门 | ① 全量测试全绿（最终 373 + M2 新增全绿，无回归）；② 4 角色可选各带 1 主动技（类型/CD/充能断言 + 手感冒烟）；③ 40 升级池生效（标签过滤收敛 20~28；抽取规则 5 条；机制型 85%）；④ 超武可合成全链路（3 图可玩）；⑤ 图鉴数据层（35 条目幂等记录 + 稀有掉落）+ 功绩数据层（28~32/局 + merit ≤10% + 纯局内模式）；⑥ AC-C4 真机热区复测 PASS；⑦ 双端性能基准（桌面 60fps / 移动 30fps+；同屏 400/250；draw call ≤8；粒子 200/100）；⑧ M2 验收总门（§8）全部满足 |
| 依赖顺序说明 | E4-S1（角色选择）→ S2/S3（主动技 4 技 + 强化）→ S4/S5（升级池 40 项 + 新武器解锁）→ S6/S7/S8（图鉴/功绩/存档数据层）→ S9（解锁流联动）→ S10（集成收口 + 双端基准 + AC-C4） |

---

## 5. 工程红线与复用（M2 全部冲刺强制）

1. **数据驱动配置铁律**：全部参数进 `balance.ts` 类表（`Record<Id, Config>` 分表），**禁止硬编码/魔法数字**；新内容一律带内容 ID（`hero_/wpn_/evo_/enemy_/boss_/map_/up_/key_/codex_`）。改数值 = 改 GDD，需评审（沿用 `enemy-types.ts` 注释纪律）。
2. **帧名注册表导出**：M2 导出 `frame-registry.json`（图集 key → 帧名列表），与 `content-id-frame-map.md` diff 一致（注册表 ⊆ 交付集且无多余名）；实体代码只引用注册表帧名；**保留帧名不可改名**（`player/missile/orb/shockwave/enemy-zombie/enemy-hound/enemy-boss/gem/tile-ground/tile-grass/p-circle/p-ring/p-streak/moon/vignette/decal-*` 等）；M4 外部素材按注册表无痛替换（实体零改动）。
3. **对象池与性能预算**（architecture §6 + runtime-config）：同屏实体桌面 400 / 移动 250；弹道上限按武器配置；粒子池 200/100；**特效 draw call ≤8**（复用批次，DOM HUD 0 draw call）；单次主动技粒子 ≤40（桌面）/≤26（移动）；超武质变 ≤60 粒子/次；特殊行为标记 1 Image/怪（随敌人组批次）；禁用运行时模糊/全屏 shader。
4. **分层与可测性纪律**（architecture §2 / test-framework §1.2）：`ui/` 不持有游戏状态（单向事件流）；`core/` 零热路径分配；纯函数抽离（能脱离 Phaser 实例化断言数值的模块必须抽纯函数）；`config/` 只被玩法与测试读取，唯一写回入口 = `upgrade/upgrade-apply.ts` + `player/player-stats.ts`。
5. **状态机联动**（control-manifest §5 / pillars §6.6）：主动技仅 RUNNING 可释放，LEVEL_UP / PAUSED / GAMEOVER 冻结；升级三选一期间技能按钮隐藏；释放不打断移动，冲刺类结束后保留原输入向量。
6. **验证驱动开发**：每个 Story 先写测试再实现；每冲刺硬门 = **既有 373 测试全绿无回归** + 新增断言全绿；测试证据路径已列于各 Story 表。
7. **迷你验证基座提交**：`src/active-skill/` + 16 处扩展**未提交 git**；M2-S1 首个动作 = 主理人提请用户审批提交基线（防后续改动与未提交改动混杂，git 提交属高影响动作需人工审批）。
8. **M2 边界**：图鉴/功绩仅**数据层**（UI / 叙事文本表 / 装备页 = M3）；外部素材集成 = M4（M2 用程序剪影兜底，`procedural-textures.ts` 扩展 + LOD 单一入口按 `cfg.isMobile` 收敛）；不新建 GDD、不改 `design/` 既有文档。

---

## 6. 已知风险与缓解

> 来源：`consistency-review-v1.md` §7（C1~C6）+ `active-skill-mini-verification.md` §5（C2~C5）+ 内容规模与性能风险。

| # | 风险 | 等级 | 触发信号 | 缓解 |
|---|---|---|---|---|
| R1 | 血猎手召唤流上限 kit DPS 88.5（+21.7% 超 ±15% 判据） | 中 | 真机埋点 `activeSkillDpsShare`/武器构成显示召唤流主导 | 真机埋点监控（M2-S4）；超限回调 D1 命中率 0.65→0.60（单点，sim-verify §4 预案） |
| R2 | 保守口径尼禄 Boss 战 96.2s 超 90s | 中 | `bossFightSeconds` 埋点 >90 | 真机复测（M2-S3/S4）；预案 ① 尼禄 HP 4500→4300（单点，92s→88s）② 保底武器抽取权重上调；改动前须主理人批准 |
| R3 | 狼裔主动技占比 15.1% 贴线（强化后 18.2%） | 低 | `contactAuraFlat` 断言 FAIL 或真机占比超限 | 接触光环平摊口径（25 伤/s 不按敌数叠加）为必要条件，E1-S5 断言先行；真机复测超限 → CD 24s→26s（回调预案） |
| R4 | wpn_a_5 骨钉标枪 powerTag BONE 不在五 tag 规范 | 低 | 无（已裁定） | 配置表标注归 BLOOD（world-bible §3 亡者=血月傀儡），无数值影响（consistency C1） |
| R5 | 血猎手 kit 含 HALLOWED 武器（守夜之环）设定张力 | 低 | 无（已裁定） | 共享武器池 = 守夜会军械库（consistency C2）；工程侧仅留注释，不做机制区分 |
| R6 | 功绩「初始 +20 HP / 磁力 +40px」绝对值超 10% 字面 | 低 | 无（已裁定） | 按「对 6 分钟成型强度影响 ≤10%」口径（gdd-codex §3.4 注）；纯局内模式开关兜底（consistency C6） |
| R7 | 伤害型主动技边界敏感（满 18 次 × 150 伤 → ≈15.8% 越线） | 中 | BURST 配置单次 >120 或 CD <18s | **AC-C2 守则强制**：CD ≥18s 或单次 ≤120；`simulateActiveSkillDpsShare` 断言 FAIL 即拒合入；复用迷你验证 §6 回调顺序（CD 上调 → 削单次 → 降被动） |
| R8 | 眩晕视觉反馈不足（手感靠「敌人突然不动」） | 低 | Playtest 反馈「不知道放没放」 | **AC-C3**：逐敌 `marker-stun` 纸白星（tint/角标 0 新增 draw call） |
| R9 | 移动端技能按钮真机热区/误触 | 中 | 真机热区 <44×44 或误触 | **AC-C4**：真机 Playtest 复测（control-manifest §9 C-1 流程）；触控矩阵验证按钮 vs 摇杆/暂停键无重叠 |
| R10 | 冒烟未覆盖主动技输入 | 低 | 主动技回归漏检 | **AC-C5**：L2 冒烟扩展点按技能按钮 + 断言 casts>0 |
| R11 | 内容量 4 倍扩充导致数值失控 | 高 | 任一 sim-verify 断言 FAIL / 角色成型 DPS 超 ±15% | 数据驱动配置 + 埋点断言（sim-verify §10 全量落地 E1-S8）+ 每冲刺数值门；改动走 balance.ts 评审 |
| R12 | 14 武器 + 特殊行为标记 + 3 图 + 400 敌人性能回退 | 高 | `npm run bench` 桌面 <60fps / 移动 <30fps；draw call >8；粒子超池 | 对象池 + 预算（§5.3）；特殊行为标记 1 Image/怪；相位 ghost 随粒子池（移动端 1 个）；每冲刺冒烟帧率断言；超标按架构 §6 预算表逐项排查 |
| R13 | 超武质变特效叠加导致批次/粒子超标 | 中 | 单次 >60 粒子 或 draw call 增量 >0 | asset-spec §3.7 预算模板（≤60 粒子/次）+ E2-S7 预算断言 |
| R14 | 40 项升级池稀释单局决策质量 | 中 | 单局可选池 >28 或「纠结时刻」<3 | 标签过滤收敛 20~28（E1-S4 标签模型 + E4-S4 抽取规则）；`hesitationCount ≥3` 断言 |
| R15 | UpgradeState 泛化（命名域 → stacks map）引入回归 | 中 | 既有升级写回测试漂移 | E2-S8 泛化时全量 upgrade 测试先行（验证驱动）；迁移保持既有 12 项语义等价（回归门） |
| R16 | 迷你验证基座未提交 git，M2 改动混杂 | 中 | git status 大量未提交改动 | M2-S1 首动作 = 用户审批提交基线（§5.7）；之后每冲刺 Story 提交粒度化 |

---

## 7. 既有资产复用清单（不重复造轮子）

| 复用资产 | 现状 | M2 用法 |
|---|---|---|
| `src/active-skill/`（控制器 + 数学纯函数 + 模拟） | 迷你验证已落地（守夜人 1 技） | 扩展至 4 角色（E4-S2）：充能制 + 效果注册表；`simulateActiveSkillDpsShare` 直接复用做 BURST 边界断言（AC-C2） |
| `src/weapons/`（homing-missile / orbit-orb / shockwave + weapon-math） | 3 武器 | E2-S1 注册表重构迁移；weapon-math 纯函数（冷却/命中/最近敌）直接复用 |
| `src/enemies/`（enemy / boss / boss-math / enemy-types） | 4 面板（zombie/wolf/tank/boss） | E1-S3 扩展 18 面板；E3-S1~S5 行为模块挂接；`stunnedUntil` 字段（迷你验证）作为主动技状态基础 |
| `src/spawner/`（spawner 纯函数 + enemy-spawner 装配） | budget/阶段/保底/环带 | E3-S7 参数覆盖（教堂/狼穴权重 + 移速加权）；`bossTriggerDue` 复用 |
| `src/map/`（MapSystem + buildObstacleLayout） | 3000×3000 单图 | E3-S6/S8 数据驱动 3 图 + 障碍/血池生成器（复用 mulberry32 种子 PRNG） |
| `src/upgrade/`（upgrade-pool + upgrade-apply） | 12 项 | E2-S8 泛化 stacks map + E4-S4 40 项标签过滤/抽取规则 |
| `src/stats/`（run-stats + session-stats） | 单局统计 + 会话重开 | E4-S7 功绩点数计算扩展；E4-S6 codex 记录挂事件 |
| `src/fx/`（fx-manager + fx-spec + procedural-textures） | 粒子/红闪/震动 + 程序剪影 v3.5 | 新帧程序剪影扩展（pro-*/enemy-*/hero-*/marker-*）；预算软上限复用 |
| `tests/unit/`（373 例） + `tests/smoke/` + `tests/bench/` | 全绿基线 | 每冲刺硬门；新增断言镜像 src 子目录 |

---

## 8. 验收总门（M2 完成判据）

> 全部满足才可宣布 M2 完成并进入 M3（图鉴 UI / 局外成长界面 / 叙事文本表）。`plan-v1.md` 质量门 = 烟雾测试 + 可玩性回环。

| # | 判据 | 验收方法 |
|---|---|---|
| 1 | **三图可玩**：墓地默认 → 通关解锁教堂 → 通关解锁狼穴；每图 Boss 战成立 | 手测 + 解锁流断言（E4-S9）；Boss 60~90s 断言 |
| 2 | **4 角色各带 1 主动技**：类型标签/CD/充能与 gdd-active-skill §3.2 一致 | `activeSkillConfig` 断言 + 手感冒烟；强化后占比 ≤20% 断言 |
| 3 | **超武可合成**：类强化满 3 次 + 持钥 → 进化卡（权重 ×3）；7 超武行为质变 | evolution-engine 断言 + 手测进化链路 |
| 4 | **40 升级池生效**：标签过滤 + 抽取规则 5 条 + 机制型 34/40 = 85% | upgrade-pool 断言；单局可选池 20~28；纠结时刻 ≥3 |
| 5 | **全量测试全绿**：既有 **373**（迷你验证后基线，原 347+ 表述已更新）无回归 + M2 新增断言全绿 | `npm run test`（预计最终 500+ 例） |
| 6 | **双端性能预算达标**：桌面 60fps / 移动 30fps+；同屏 400/250；draw call ≤8；粒子 200/100；单次主动技 ≤40（桌面）/≤26（移动） | `npm run bench` + 冒烟帧率断言 |
| 7 | **图鉴/功绩数据层落地**：35 条目五类幂等记录；功绩点数 28~32/局；merit 4 加成 ≤10% 红线口径；纯局内模式开关 | codex-unlock / session-stats / save 断言 |
| 8 | **sim-verify 数值断言全 PASS**：DPS 差异 ≤±15%；主动技占比 ≤15%·强化后 ≤20%；Boss 60~90s；无超武 ≤20%；功绩 ≤10% | sim-verify.test（E1-S8）全绿 |
| 9 | **帧名注册表导出 diff 一致**：注册表 ⊆ content-id-frame-map 且无多余名 | frame-registry diff 脚本 PASS |
| 10 | **主动技迷你验证 CONCERNS C1~C5 全部关闭**（C1 桌面 HUD / C2 BURST 边界 / C3 眩晕指示 / C4 真机热区 / C5 冒烟覆盖） | AC-C1~C5 各验收门 PASS |
| 11 | **工程门**：`typecheck` 0 error；`build` exit 0；无 console error 冒烟 | CI/本地三步绿 |

---

## 9. 首冲刺建议（M2-S1 执行序）

1. **第 0 步（前置）**：主理人提请用户审批提交迷你验证基座（`src/active-skill/` + 16 处扩展），锁 M2 起点。
2. **第 1~2 天**：E1-S1（内容 ID 类型 + 表骨架）+ E1-S2（武器表 14+7）→ 先写 `weapon-config.test` 断言再落表；AC-C2（BURST 边界守则常量 + 强制断言）同步做（迷你验证基座上最小增量，解锁后续 BURST 型设计空间）。
3. **第 3~4 天**：E1-S3/S4/S5（敌人 18 面板 / 升级池 40 / 角色+主动技表 + 红线常量断言）。
4. **第 5 天**：E1-S6/S7（地图配置表 + 帧名注册表导出 diff）。
5. **第 6 天**：E1-S8/S9（sim-verify 断言 + 图鉴/功绩数据表）+ AC-C1/C3/C5（桌面冷却 HUD / 眩晕纸白星 / 冒烟覆盖）。
6. **收口**：全量回归（373 无回归 + 新增全绿）+ typecheck/build；Sprint 1 验收门全部满足 → 进入 M2-S2。

> 若 Sprint 1 人力并行：E1-S1~S9 与 AC-C1/C3/C5 可两线并行（AC 线不依赖 E1 表，只依赖迷你验证基座），但两线都必须在冲刺末统一回归。
