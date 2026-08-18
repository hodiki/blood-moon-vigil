# 《血月守夜》Demo 收尾 · 阶段盘点

> 盘点日期：2026-08-18 · 主理人：游承峰
> 版本基线：package.json v0.1.0（内部 Demo 基线）· 最新提交 2805fe0（TASK-36）

## 1. 当前阶段判断

**Phase 6 打磨 → Phase 7 发布过渡期。**

美术资源与画面表现力优化专项（TASK-28/31/33/34/35/36）已全链路闭环并上线（轻应用为 TASK-36 版）。项目功能、美术、音频、图标、特效均已达到垂直切片 Demo 完整态；**剩余工作集中在"发布验收"而非"开发"**——走 release-checklist G1~G10 门禁 → 升版 0.2.0-Demo → 正式发布。

## 2. 已完成资产（质量基线）

| 类别 | 内容 | 证据 |
|---|---|---|
| 玩法 | E1–E4 垂直切片（22 Story）：移动/战斗/成长/收束全闭环 | git 86eafcd |
| 美术 | 程序剪影 v2→v3（玩家提灯/帽带/开衩、行尸裂纹、血犬棘刺、屠夫屠刀、Boss 宝石+权杖）+ 血月氛围 + 双帧动画 + 粒子系统 + 15 项矢量图标 | TASK-28/31/33/36 |
| 音频 | WebAudio 程序引擎：心跳 BGM + 6 SFX | audio-bible + src/audio |
| 质量 | **309 单测 / 37 文件全绿**（tsc strict 通过） | `npm test` |
| 文档 | CHANGELOG 完整（记录至 TASK-36）；GDD/架构/美术圣经/发布三件套齐备 | design/ docs/ production/ |
| 部署 | 轻应用已部署 TASK-36 版（DSo8XuSS）；Lighthouse 待更新 | workbuddy.link |
| 画布 | 美术探索板三件套（色板/图标 15 项/剪影） | ardot 715915279168165 |

## 3. 收尾缺口清单（按优先级）

| # | 缺口 | 状态 | 责任 |
|---|---|---|---|
| 1 | **R1 Playtest 未执行**（round-1-raw 仍为模板+示例；G1 链 R1→R2→R3 全未跑） | ⬜ | 严守真 + 用户协调受测者 |
| 2 | **Lighthouse 未更新**（服务器仍 TASK-28 版 DqD3uLSK；本地 zip 383KB 已就绪） | ⬜ | 用户上传 zip / MCP 部署 |
| 3 | **git push 未做**（本地无远程，6 提交仅在本机） | ⬜ | 用户提供远程 URL |
| 4 | **2 份美术方案未提交**（silhouette-v2-spec / weapon-fx-v2-spec，TASK-35 产物） | ⬜ | 程基岩/主理人 |
| 5 | **发布门禁未过**（G1-G10 全 ☐；G3 单测数需更新为 309/37，G2 需复跑 bench） | ⬜ | 严守真/程基岩/路远行 |
| 6 | P1/P2 剪影细节 + 特效 P1（冲击波裂环/飞弹摆动）留批 | ⬜（不阻塞 Demo） | 林绘澄/程基岩 |

## 4. 收尾路径（两步）

### 第一步：短期收尾（半天，纯运维/提交，不依赖受测者）
1. 提交 2 份美术方案（TASK-35 产物）→ 补 CHANGELOG
2. 复跑 `npm run bench`（G2 三闸：桌面 avg≥58 移动 avg≥30）→ 更新 release-checklist 状态
3. 更新 release-checklist G3（309/37）、G4（build 已过）
4. Lighthouse 部署 TASK-36 版（zip 就绪 → 上传 → unzip 覆盖 → 验证引用 DSo8XuSS）
5. 可选：配置 git 远程并 push（6 提交）

### 第二步：发布验收（需用户协调，数天~1 周）
1. **R1 Playtest**（内部 4-6 人，桌面+移动）→ 回收 round-1-raw + 问卷 → QA 汇总（严守真）
2. 按 R1 反馈处理 P1/P2 + 微调菜单（fx-spec/balance.FX 收敛位）
3. **R2**（修复回归）→ **R3 终验**（G1 出口：concept §9 全项 + 双端矩阵）
4. G1~G10 全过 → 升版 `0.2.0-Demo`（package.json + CHANGELOG）→ build → 部署 → `git tag v0.2.0`

## 5. 决策点（主理人请用户拍板）

1. 短期收尾是否立即执行？（纯运维，无风险，建议立刻做）
2. R1 Playtest 的受测者来源：内部同事自测 4-6 人？还是已有名单？
3. 是否要配置 git 远程（GitHub/CNB）做备份 push？
4. P1/P2（冲击波裂环、飞弹摆动、剪影 P1）是否纳入 R1 前完成，还是 R1 后按反馈决定？

## 6. 已知风险

- R1 依赖用户协调受测者——若延期，Demo 发布（0.2.0）将顺延
- Lighthouse 服务器旧 JS 残留（D2kLwToC/DqD3uLSK）不影响功能但占空间，建议部署时一并清理
- 浏览器缓存问题已定位（无 Cache-Control）——建议发布时给 /blood-moon/index.html 加 no-cache，防玩家看到旧版
