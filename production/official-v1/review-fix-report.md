# NV-REVIEW-FIX 审查修复总报告（批次 A~E 收官）

- 审查基线：`production/official-v1/项目审查结论-v0.8-2026-09-01.md`
- 修复范围：批次 A~E 全量（P0-1~P0-8、P1-1~P1-14 中归属 A~E 的全部条目）
- 日期：2026-09-01
- 质量门：`npm run typecheck` 0 错误；`npm test` **1291 / 1291 全绿**（104 文件）；`npm run build` 通过（chunk >500kB 警告为既有提示，非阻塞）
- 分支：master（本地，未 push——按纪律）

---

## 一、提交清单（按批次）

| 批次 | hash | 内容 |
|---|---|---|
| A | `3286635` | P0-2 眩晕挡接触 + P0-3 易伤收敛唯一伤害入口 + P1-18 抗性范围按表（含相位抗性生效条件） |
| B | `4e057c2` | P0-7 五子项 + P1-14 衍生技语义 + P0-1 圣物层进局（含审查单结论文档进仓） |
| B | `40ec3c0` | 批次 B 运行时用例 36 例 + P1-1 默认专武契约可测化（smoke/bench applyLoadout） |
| B | `1a18310` | control-manifest 同步：补齐技能/圣物技输入映射 |
| C-1 | `e4658b8` | P0-4 突袭三敌 lunge 前扑 + P0-5 精英 180s 技能门 |
| C-2 | `3487f77` | P0-6 Boss 技能消费抽离 `boss-skill-runtime`：zone 几何自结算，删除 dist≤160/300 全图桩 |
| C-3 | `ac4e83a` | P1-12 方阵个体 AI（围猎包抄/血旗破碎减速/骑士团群体冲锋）+ P1-13 rewardGemCluster 方阵解散 XP 簇 + KNIGHT_ESCORT_ELITE 接 spawn-group |
| D-1 | `207e0bf` | P0-8 P4 卡查错 id 修正（up_d_* 窗口外不进池）+ P1-2 兜底 N 渠道 granted 消费 |
| D-2 | `018dfd0` | P1-8 攻速/冷却/XP 天赋写回 + P1-9 Q-s1 攻速窗口 + P1-11 Q-s4 P4 卡前移 |
| D-3 | `a0819de` | P1-7 角色支线 machine 补齐与接线（12 条支线全数值化） |
| D-4 | `6778ffc` | P1-10 Q-d「携行旧兵」预选通武 UI（解锁口径查图鉴 + 同名禁选 + 写 save.preselectedWeapon） |
| E | `03941b1` | P1-3 R-3 印记 ×1.2 + P1-4 R-7 拖拽真位移/斧 ×1.5 + P1-5 R-5 圣域重叠区/墓碑转化 +20pp + P1-6 R-8 共享召唤上限 |

---

## 二、各批次完成定义对照

### 批次 A · 战斗正确性（P0-2 / P0-3 / P1-18）—— 完成

- 眩晕目标挡接触伤害（contact 层读状态）；所有武器伤害收敛走 `damage.hitEnemy` 唯一入口吃易伤（不再各自乘 `markUntil`/散落乘区）；Boss/精英抗性按表生效（相位抗性带生效条件）。
- 完成定义全数满足：眩晕挡接触 ✓、伤害吃易伤 ✓、抗性按表 ✓、不再新增 `markUntil` 消费者 ✓。

### 批次 B · 专武最后一公里（P0-1 / P0-7 / P1-1 / P1-14）—— 完成

- P0-1 圣物层进局（Boss 掉落 → 圣物键释放 → 长 CD 二次受击）；P0-7 五子项全绿；P1-1 smoke/bench 也走 `applyExclusiveSelection`（默认专武进局开火可测化）；P1-14 衍生技按 GDD §4 逐条对齐（月狙 1.2s 蓄力、审判光环、血影突进密度方向、双狂化 id 分离）。
- 附带 36 例运行时用例（`tests/unit/review-fix-b.test.ts`）与 control-manifest 输入映射同步。

### 批次 C · 怪物身份（P0-4 / P0-5 / P0-6 / P1-12 / P1-13）—— 完成（按 3 PR 拆分）

- 三突袭敌人 lunge 前扑前摇可读；精英 180s 技能门（首只精英 181s 起带技能）。
- P0-6 Boss 技能消费抽离 `boss-skill-runtime.ts`：zone 几何自结算（圈/扇/冲锋路径），删除全图 dist 桩——四 Boss 每只 ≥2 可解技能。
- 方阵个体 AI：围猎包抄 / 血旗破碎减速 50%×3s / 骑士团群体冲锋；方阵解散掉 5~20 XP 簇；骑士护卫精英接 spawn-group。

### 批次 D · 成长接线（P0-8 / P1-2 / P1-7~P1-11）—— 完成（按 4 PR 拆分）

- P0-8：`buildUpgradeContext` 改查 `up_d_*` 升级 id（原查技能 id 恒 false）；`buildV3Candidates` 对窗口外且未取的 `up_d_*` 直接不进池（「不再出现」由池层保证）。
- P1-2：兜底 N 渠道 `{granted}` 不再丢弃——卡 2 就绪即发。
- P1-7：12 条角色支线 machine 全数值化（`BRANCH_MACHINES`）→ `computeTreeApplication` 支线汇总 → 消费点：拾取半径+10×2（edmund br_1）、范围+5%×2（提灯/圣铃 machine areaPct）、受击移速+10%×2（hitSpeedBoostBonusPct）、吸血效+25%×2（双刃 healPerHitPct）、治疗效能+10%×2（既有 XP/治疗乘区口）、墓碑回血+1×2（tombHealFlatBonus）、击杀回血+0.5×2（killHealBonus）、狂化移速+5%×2（rageSpeedBonusPct）。**顶点「同袍之诺」为图鉴联动节点（GDD §4.3 L164/L206），无数值效果**——machine 留空为定案，非缺漏。
- P1-8/P1-9/P1-11：攻速/冷却乘区进 `WeaponSystem.applyTalentIntervals`（冷却下限保护）、XP 乘区进 XpManager、Q-s1 30s 窗口攻速 +20%、Q-s4 消耗 1 次 offer 把 P4 卡提前进池。
- P1-10 Q-d：树界面新增预选段——解锁口径 = 图鉴「首次获得」（`codexUnlocked` 含 `codex_wpn_<weaponId>`；**真实 entryId 为 `codex_wpn_wpn_*` 双前缀格式**，codex.ts L81）；选择写 `save.preselectedWeapon`（v3 同键同步 localStorage）；同名禁选：角色初始通武恒禁 + Q-b 点亮时两把候选专武的配对共鸣通武禁选（见 §五解读）。

### 批次 E · 共鸣补完（P1-3~P1-6）—— 完成

- **P1-3（R-3）**：`stepTwinblades` 主斩乘 `resonanceTwinbladesDamageMult`——对 R-3 印记目标（vulnerable source='resonance_R3'）×1.2（machine['twinbladesMarkMult'] 可覆写）；非 R-3 来源易伤不加成。
- **P1-4（R-7）**：`onHitResonance` 钩子改返回落点 `{x,y}|null`，`updateChain` 据此**真位移**（修复原实现命中后只 `body.reset` 原坐标 = 名拖实不动的缺陷）；`stepAxe` 加 drag 参数——对被拖拽者 ×1.5，挥击结算即消费（喂食即耗）。
- **P1-5（R-5）**：弃全局 `addDamageReduction(0.08)`，改 `PlayerStats.dynamicDamageReductionPct` 帧级判定——壁垒光环与铃音领域均玩家居中，几何重叠 ≡ 双武启用（`refreshSanctuaryOverlap` 每帧写，不占静态池 30% 上限）；墓碑转化 +20pp 走守誓者 `machine['reviveConvertBonusPp']`（与 mc_bell_2 的 rate 覆写独立叠加）。
- **P1-6（R-8）**：猎犬 `summonGate` 接 `sharedSummonCount` 真判定（月狼数 + 猎犬 ≤ maxWolves）；月狼侧 `stepHorn` 加 `externalOccupants`（猎犬在场占 1 席）。双向对称共享。
- R-1 / R-2 / R-6 纯函数层未动，全量回归不回退。

---

## 三、测试统计

| 套件 | 数量 |
|---|---|
| 批次 A 前基线 | — |
| 批次 B 新增（review-fix-b.test.ts） | 36 例 |
| 批次 C 新增（review-fix-c.test.ts） | 46 例（三段累计） |
| 批次 D 新增（review-fix-d.test.ts） | 21 例（D-3 16 + D-4 5） |
| 批次 E 新增（review-fix-e.test.ts） | 11 例 |
| 其他批次内嵌用例（special-behaviors / upgrade-pool-v3 等） | 若干 |
| **全量** | **1291 / 1291 绿（104 文件）** |

- 批次 D-3 关键用例：支线 machine 锚逐条、38 节点数、`computeTreeApplication` 支线汇总×层数、PlayerStats 三消费窗口语义、双刃 cap 同秒窗 5 连击法、灯环/铃域边界、墓碑加值、D-4 解锁口径与存档 round-trip。
- 批次 E 关键用例：R-3 乘区（默认锚/覆写/过期/异源）、斧 ×1.5 喂食即耗、链钩落点、圣域 DR 独立乘区、转化 +20pp 三态、sharedSummonCount 边界、stepHorn 占位。

---

## 四、§9 手测十条（QA 最小集 · 逐条）

> 单测不替代手测。以下为修完 A~E 后的验收视角：每条给出操作与期望，标注对应批次。

1. **守夜人墓地 / 提灯**：灯环常驻可见；闪技能（dv_lantern_flash）后 4s 内射程内敌人受击变快；左轮若落选则衍生技为左轮技（月痕狙击不出现）。〔B 批〕
2. **修女 / 圣铃**：守誓者在场跟随；安魂曲可回满复活/填墓碑；吃质变卡 2 后承伤转移比例变化。〔B 批 + D-3 墓碑回血支线：薇奥莱 br_2 点满后墓碑回血 2→4 HP/s〕
3. **加尔文 / 巨斧**：血月狂化期间挥击，HP 不因自伤下降（selfHpCost=0）；狂化外每次挥击 −2 HP、HP≤20% 停止消耗。〔B 批〕
4. **任意局 / CC**：贴脸打眩晕敌，眩晕 1s 内不掉血（接触被挡）；带易伤的怪换武器打，伤害高于无易伤状态。〔A 批〕
5. **`?qa=1`**：100s 前方阵不掷枪；120s 精英无技能预警；181s 后新精英有技能；血犬进 100px 有前扑前摇。〔C-1/C-3 批〕
6. **Boss**：至少能看出并**走位躲开** 1 个 zone 几何技能（圈/扇/冲锋路径有 telegraph，非站桩 dist 扣血）。〔C-2 批〕
7. **升级**：第 8~14 次可见衍生技强化（P4）；刻意不拿则第 15 次起不再出现（池层剔除）；卡 1 后连续 8 次非卡 2 升级应赠卡 2。〔D-1 批〕
8. **Boss 击杀 / 圣物**：掉圣物；圣物键可放；第二次受长 CD。〔B 批〕
9. **`?smoke=1`**：60 帧内 RUNNING **且**默认专武在开火（P1-1 契约可测化）。〔B 批〕
10. **树界面**：买攻速节点进局，武器冷却可感知缩短；买角色支线有可描述效果（受击加速/击杀回血/墓碑加量等）。〔D-2/D-3 批〕
   - 补充（D-4 新增）：Q-d「携行旧兵」点亮后，树界面预选段列出图鉴已解锁通武；选中后本局开局即得该武器；与开局同名的武器置灰并标「开局同名不重复」。

---

## 五、定案与解读（评审裁决留痕）

1. **顶点「同袍之诺」无数值**：GDD §4.3（L164/L206）定性为图鉴联动节点（L-2），machine 留空 = 定案；测试固化「顶点零贡献」。
2. **Q-b 同名禁选的解读**：Q-d 预选与开局专武「同名不重复」的判定落在**树界面**，此时局内 2 选 1 专武尚未确定——故 Q-b 点亮时两把候选专武的配对共鸣通武**一律禁选**（保守口径，宁可少选不错发）。若需「仅禁实际带入者」，须把专武选择前置到树界面之后，属规格变更。
3. **R-5 重叠区几何简化**：壁垒光环（orbit-weapons.tickAura，玩家居中 auraRadius ?? 120）与铃音领域均以玩家为中心 → 「重叠区」恒等于「双武同时启用」，帧级判定退化为双武开关检查，无需逐点求交。若未来光环改为弹体居中，需回退为真几何求交。
4. **R-8 锁存残留**：§⑦-2 满员时月狼召唤请求「静默丢弃」，`sharedSummonCount` 返回的 `latchedRequest`（猎犬消失瞬间释放锁存 1 次）**未接线**——当前语义为丢弃后等下个 summonInterval 自然重试（12s 节拍），行为差异仅为最多一个节拍的补狼延迟。挂账 P2 级。

---

## 六、残留与风险

| 项 | 状态 | 说明 |
|---|---|---|
| P1-15 / P1-16 / P1-17（BUG-3/4/6：结算页矮视口、序章 Esc、音频手势 resume） | **未修** | 不在批次 A~E 任务包内（审查单 §八未归属），建议随批次 F 或热修批处理 |
| 批次 F（PlayScene 拆分 / 双轨隔离） | 未启动 | 结构批，无玩法数值变更 |
| 批次 G（难度切换） | 未启动 | 前置：XP/budget 在 A~E 完成前**未动**（遵守禁令），切 c 案待沙盘裁决 |
| R-8 锁存释放 | 挂账 | 见 §五-4 |
| P2-1~P2-10 挂账表 | 未动 | 按审查单 §六不阻塞 0.8 手感验收 |
| chunk >500kB 构建警告 | 既有 | 非本轮引入；可随批次 F 做代码分割 |
| 版本号 / tag | 未裁决 | §十二-3：0.8 tag 是否在 A~E 完成后打，待主理人裁决 |

---

## 七、复测路径

```bash
cd D:/code/vampire-survivors-like
npm run typecheck   # 0 错误
npm test            # 1291/1291
npm run build       # 通过
npm run dev         # 按 §四 手测十条（含 ?qa=1 / ?smoke=1）
```
