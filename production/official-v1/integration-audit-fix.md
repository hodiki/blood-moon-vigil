# NV-INTEG-FIX · 运行时集成审核与修复批报告

- 执行人：程基岩（engineering-lead）
- 派发：游承峰（主理人）
- 范围：用户八项本地实测反馈的运行时真值审核（Phase 1）+ P0/P1/P2 修复（Phase 2）+ 分组提交（Phase 3）
- 结论：**五项 P0 全部修复、两项 P1 全部修复、一项 P2 修复；质量门全绿（typecheck 0 错误 / build 通过 / 99 文件 1163 测试全过）**

---

## 一、八项实测反馈 → 运行时生效矩阵

| # | 反馈 | 根因 | 修复 | 状态 |
|---|------|------|------|------|
| ① | 树界面点击卡死 | `.bmv-tree` 未自启 `pointer-events:auto`，被 `#ui-overlay` 宿主 `pointer-events:none`（ADR-004）吞掉事件 | tree-overlay.ts 补 `pointer-events: auto` | ✅ 已修（4d72253） |
| ② | 各屏美术未接线 | 帧资产已就位但 UI 层未贴帧 | 升级卡图标（upg-* 帧）、HUD 动态武器槽（exw-emblem-* / wslot-*）、共鸣徽记（reso-* 四态）全部接 preferFrameImg（404 自移除=文字兜底） | ✅ 已修（1ccc7fe）；**角色/场景立绘接线归美术批，本批不越权** |
| ③ | 专武 2 选 1 流程缺失 | 状态机无插入相位、无双卡 UI、loadout 二次转换 bug、映射表 6 条语义错位 | 新增 `EXCLUSIVE_SELECT` 相位 + 独立选择页 overlay + `derivativeForChoice` 改键=选中者 + 以 `DERIVATIVE_SKILLS[*].sourceExclusiveId` 为权威修正 exclusive.ts 映射表 6 条 + 全对一致性回归测试 | ✅ 已修（16d9284） |
| ④ | 升级卡纯文本 | upgrade 图标帧映射缺失 | `upgradeFrameForId`（`up_*`/`key_*` → `upg-*`）+ 卡面图标区贴帧 | ✅ 已修（1ccc7fe） |
| ⑤ | 怪物域疑似未生效 | 方阵首掷 `lastRollAt===null` 时按 `time>=nextInterval` 误判（60s 起即掷，早于 S1 结束窗） | 首掷 gate 对齐 `FORMATION_RULES.S1_END_WINDOW_START`=100s；enemy-spawner 新增 `groupRollLogger` 观测点 + PlayScene 接 `?qa=1` | ✅ 已修（4d72253） |
| ⑥ | 血猎手不实时索敌 | `aimAngle` 锁定首帧目标不刷新 | 改为逐帧遍历活跃敌取最近者（`atan2` 实时刷新） | ✅ 已修（4d72253） |
| ⑦ | 守夜人左轮/持续伤害不可见 | 即时结算（exclusive-math）无弹体表现；灯环无渲染实体 | `ExclusiveWeaponBehavior.onEvents` 事件钩子（fired → `spawnRevolverTracer` 月银 p-streak 曳光，speed 420 锚参数表）；FxManager 新增 `lanternAura` 暗金 p-ring（depth 87 / alpha 0.22 / 半径联动质变卡 auraRadius，PlayScene `tickLanternAura` 接线） | ✅ 已修（bb52139） |
| ⑧ | 技能战斗重做部分生效 | —（属技能重做批范畴，本批仅核对接线） | 审核确认：守誓者条件绑定 `hero_violet && xw_bell`（选择回调联动）；幻影/血渍实体化已在 d198902 落地 | ⚠️ 部分生效项归技能重做批复核 |

## 二、附加修复（P1/P2）

1. **四角色 flipX 补齐**（1ccc7fe）：`defaultFacesRight` 原仅登记守夜人 `player` → edmund/cassandra/violet/galvan 四角色不翻转、朝向错位；anim-policy 测试断言随扩表更新。
2. **树界面 codexPrerequisite 真查询**（1ccc7fe）：`resolveCodexPrerequisite` 四语义键（`codex_moon_avatar`=`codex_event_6`、`codex_heroes_all`=4×`codex_hero_*`、`codex_entries_25/40`=`codexUnlocked.length`），openTree 接 `codexQuery`。

## 三、提交清单（本批 5 笔，均未 push）

| hash | 主题 | 文件数 |
|------|------|--------|
| `16d9284` | fix(exclusive): 专武 2 选 1 选择流程落地 + loadout 汇聚接线 + 衍生技映射修正（P0-2/③/⑦） | 6 |
| `4d72253` | fix(runtime): 树界面可交互 + 银针索敌最近敌 + 方阵首掷节奏修复（P0-1/⑤/⑥） | 5 |
| `bb52139` | fix(fx): 提灯灯环常驻可见 + 左轮 tracer 曳光弹 + 专武结算事件视觉钩子（P0-5/⑦） | 3 |
| `1ccc7fe` | fix(ui): 升级卡图标帧 + HUD 动态武器槽/共鸣徽记 + codexPrerequisite 真查询 + 四角色 flipX（P1/P2/②④） | 5 |
| 本笔 | docs: 本报告 | 1 |

**提交纪律**：工作区美术 + 破甲换装外批变更（assets/、frame-registry.json、tools/asset-pipeline、src/enemies、src/config/frame-registry.ts 及对应测试等 397 项）**全部隔离未提交**；PlayScene.ts / anim.ts 中的外批行（EliteEnemyLike 类型简化、stripVariantSuffixes 重构、tombstone/holdFrame）经部分暂存舞步剔除，留工作区归对应批次。

## 四、残留项

1. **②角色/场景立绘接线**：归美术批（本批仅接 UI 层可工程化部分）。
2. **⑧技能战斗重做剩余项**：归技能重做批（本批完成守誓者条件接线复核）。
3. **工作区外批行**：anim.ts（stripVariantSuffixes/tombstone/holdFrame）、PlayScene.ts（EliteEnemyLike）——未动、未提交。
4. **幻影镜像标注**：接现帧表无独立镜像帧，暂以 flipX 表达；美术批出帧后可无缝替换。

## 五、复测路径

1. **专武 2 选 1**：真实局序章后 → 双卡选择页（数字键 1/2 可选）→ 选中/落选语义：键=选中者、值=落选者的技形态（如选双子刃 → 落选长弓者衍生 `dv_moon_snipe` 月狙）→ HUD 技能名/槽位联动刷新。
2. **怪物域**：`?qa=1` 进局 → 100s 首掷（S1 结束窗对齐）→ 每 60~90s 节奏位掷方阵；控制台观察 groupRollLogger 输出（time/rolled/reason/formationId/cost）。
3. **灯环/左轮**：守夜人选破旧提灯 → 玩家周身暗金灯环常驻（吃质变卡后半径扩大）；左轮开火 → 月银曳光弹朝最近敌。
4. **血猎手**：银针发射后绕敌移动 → 弹道逐帧转向最近活跃敌。
5. **树界面**：开始页点天赋树 → 可点击/悬停（不再卡死）；节点解锁项真查询 codex 进度。
6. **升级卡**：升级弹卡 → `up_*/key_*` 项显示 upg-* 图标帧（缺帧回落文字）。
7. **HUD**：解锁多武器 → 槽位动态扩展；共鸣 ready/待钥/达成 → 右上徽记四态切换。

## 六、质量门

- `npm run typecheck`：0 错误
- `npm run build`：通过（1.94MB chunk 警告为既有）
- `npm test`：99 文件 / 1163 用例全过（含本批新增 loadout 全对一致性、方阵首掷对齐、anim-policy 扩表断言）
