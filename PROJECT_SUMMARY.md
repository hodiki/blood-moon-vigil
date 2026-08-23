# 《血月守夜》(Blood Moon Vigil) Demo 项目总结

> 版本：v0.1.0（Demo 收尾）· 日期：2026-08-21 · 作者：工作室主理人 游承峰（汇编）
> 项目代号：vampire-survivors-like · 类型：幸存者 like（bullet heaven）2D 俯视角

## 一、项目概览

| 项 | 内容 |
|---|---|
| 游戏名 | 《血月守夜》(Blood Moon Vigil) |
| 类型 | Web 幸存者 like（bullet heaven），2D 俯视角 |
| 技术栈 | Phaser 3.90 + Vite 6.4.3 + TypeScript 5.9.3（WebGL 优先 / Canvas 兜底） |
| 平台 | 桌面浏览器 + 移动端浏览器（双端兼容） |
| 设计分辨率 | 桌面 1920×1080 / 移动 720×1280 |
| 视觉方向 | 暗夜血月（Deep Gothic Night）· 高对比剪影 · 红色即危险 |
| 美术形态 | 全程序化（零静态素材）：程序剪影 v3.5 + WebAudio 程序合成音效 |
| 交付形式 | 垂直切片 Demo（可发布，已部署为 WorkBuddy 轻应用） |

**核心体验承诺**：1% 移动操作 + 99% build 决策——走位是唯一操作，升级三选一是唯一爽点，体验"被围殴的脆弱者 → 割草无双的怪物"的权力成长曲线。

## 二、七阶段流水线成果

| 阶段 | 状态 | 关键产出 |
|---|---|---|
| Phase 0 立项 | ✅ | 引擎选型（Phaser 3+TS）、双端、垂直切片 Demo 定位、Lean 评审强度 |
| Phase 1 概念孵化 | ✅ | 概念文档（4 支柱/MDA/压力曲线）+ 美术圣经（暗夜血月） |
| Phase 2 系统设计 | ✅ | 4 份 GDD（武器/敌人/升级池/敌潮生成器）+ 系统依赖图 + 一致性评审 PASS |
| Phase 3 技术搭建 | ✅ | 主架构 + 4 条 ADR（对象池/输入抽象/状态时间/UI 覆盖层）+ 可访问性分级 |
| Phase 4 预制作 | ✅ | UX 规格 + 资产规格 + Epic/Story 拆分（4 Epic/22 Story）+ 三层测试框架 |
| Phase 5 制作 | ✅ | E1 工程地基 → E2 战斗闭环 → E3 成长闭环 → E4 收束与性能（4 冲刺） |
| Phase 6 打磨 | ✅ | 3 轮 bug 修复、美术 v2→v3.5 升级、音频引擎、R1/R2 Playtest、发布准备 |
| Phase 7 发布准备 | ✅ | 发布清单（10 门禁）、版本规范（0.2.0）、部署手册、CHANGELOG |

## 三、里程碑与 Playtest

| 里程碑 | 状态 |
|---|---|
| M1 可玩（完整循环跑通到 Boss 击杀） | ✅ 达成 |
| M2 性能验收（同屏 400/250、draw call ≤8、双端 30fps+/60fps） | ✅ 达成（真机复核通过） |
| R1 Playtest | ✅ 执行，反馈集中在画面表现 → 美术 v2→v3.5 升级应对 |
| R2 Playtest | ✅ 执行，无敌回归修复 + 节奏加速 |

**用户真机反馈处置**（R1 阶段）：3 bug 全修复（PC 选卡后 WASD 失效 / 移动端三选一可见性 / 飞弹分裂无限弹射）、手机局域网访问修复（--host）、美术圆点→剪影升级、音频接入。

## 四、收尾节奏调整（2026-08-21）

按用户要求提升游戏节奏，设计裁决（rhythm-pace-adj.md）+ 工程实施：

| 项 | 调整前 | 调整后 |
|---|---|---|
| Boss 出场 | 20:00（1200s） | **6:00（360s）** |
| Boss HP | 6000 | **4000**（保 60~90s 战时长判据） |
| 精英（厚血） | 3 分钟起 3% 随机 | **3 分钟前保底 ≥2 只**（120s 起保底 30s） |
| 阶段表 | 4 段（0-3/3-8/8-15/15-20min） | **3 段**（0-2/2-4/4-6min，S3 权重 tank 5%） |
| 整局时长 | ~20 分钟 | **~7 分钟**（6min Boss + 60~90s 击杀） |
| 心跳 BPM | 0-20min 60→140 | **0-6min 60→140**（240s 后翻倍加速） |
| budget 公式 | 1.2×(1+3.3t/1200)×(1+0.3sin(2πt/75)) | **1.2×(1+1.2t/360)×(1+0.3sin(2πt/60))** |
| 成功标准·中位存活 | ≥10min | **≥4min** |

**数值验证**：S3 权重 5% 下 4:30 场上厚血 3（≤5 ✅）、6:00 11（≤12 ✅），3min 前保底精英全种子成立。

## 五、产出物清单

```
design/    22 份：concept/4 GDD/art-bible/asset-spec/asset-audit/ux/audio-bible/rhythm-pace-adj
docs/       9 份：architecture/ADR×4/architecture-review/control-manifest/accessibility
production/ 9 份：epics/qa-plan×4/playtest-plan/release×3/perf-analysis
tests/     41 文件 347 用例（unit + bench + smoke）
src/       45+ TS 源文件（audio/combat/config/core/enemies/fx/input/map/player/scenes/spawner/stats/ui/utils/weapons）
CHANGELOG.md / PROJECT_SUMMARY.md
```

## 六、测试与性能基线

- **347 个单元测试全绿**（41 文件），含数值断言、状态机、对象池、budget 公式、BPM 曲线、C3 厚血模拟
- `npm run build` exit 0，主包 gzip ~370KB（Phaser 引擎占大头）
- bench 双端预算：桌面峰值 400/移动 250、子弹 ≤8、draw call 5（预算 8）
- 已发布轻应用：https://705afc08992144dba70844663c187c73.app.workbuddy.link

## 七、团队分工（游戏开发工作室）

| 成员 | 角色 | 主要贡献 |
|---|---|---|
| 游承峰 | 主理人（编排） | 阶段路由/质量门/汇编交付/与用户协作 |
| 文策渊 | 设计策略师 | 概念/4 GDD/UX/节奏裁决/多轮设计评审 |
| 程基岩 | 工程主程 | 架构/ADR/全代码实现/性能剖析/bug 修复 |
| 林绘澄 | 美术总监 | 美术圣经/资产规格/剪影 v2→v3.5/表现力升级 |
| 阮和鸣 | 音频总监 | 音频圣经/心跳 BGM/SFX 程序合成 |
| 严守真 | 测试负责人 | QA 计划×4/Playtest 计划/启动包/性能验收标准 |
| 路远行 | 发布运营 | 发布清单/版本规范/部署手册/CHANGELOG |

## 八、已知风险与后续建议

1. **Boss 战时长（60~90s 判据）**依赖真机 Playtest 验证；若保守玩家超 90s，降档 Boss HP 3600（预案已备）
2. **S3 精英密度**在真机（含 AoE 清怪）预期低于模型（3~6 只），需 6 分钟局真机复核
3. **美术上限**：程序剪影已达 v3.5；若追求商业级画面，需手动接入 Kenney CC0 素材包（沙箱无下载保障）
4. **文档遗留 20 分钟表述**：spawner.md/weapons.md/system-map.md 等仍含旧数值表述（历史评审记录不改），如需对齐可做一次专项
5. **完整产品路线**：Demo 验证核心循环后，可扩展多角色/多武器合成（超武）/局外成长/多地图；版本路径 0.1.0 → 0.2.0（Demo 验收）→ 1.0.0

## 九、致谢

本项目从立项到 Demo 收尾，完整走通"概念→设计→架构→预制作→制作→打磨→发布准备"七阶段流水线，是验证驱动开发（先测后写）+ 工作室多角色协作的一次完整实践。所有文档与代码均已沉淀于 `D:\code\vampire-survivors-like`（本地 git 仓库）。
