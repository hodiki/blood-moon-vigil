# 《血月守夜》Demo 发布清单（Release Checklist）

> 版本 v0.1 · 作者：路远行（发布运营管理）· TASK-29 · Phase 7 发布准备（穿插）
> 当前包版本：package.json v0.1.0（内部）· 目标发布版本：**0.2.0-Demo**（R3 通过后正式验收发布）
> 依据：concept §9（成功标准）、qa-plan-sprint4 §5/§7（M2 三闸与出口）、playtest-plan §6（R3 终验）、architecture §1.2（base './'）、accessibility-tiers §3（Basic 级）

## 1. 发布前门禁（Go / No-Go 检查表）

| # | 门禁项 | 通过标准 | 数据源 / 责任 | 状态 |
|---|---|---|---|---|
| G1 | R3 Playtest | 出口判定 PASS：concept §9 全项 + 双端矩阵验收达标 | playtest-plan §6 结算表 / 严守真 | ☐ |
| G2 | M2 性能三闸 | 桌面 avg≥58 且 min≥50；移动 avg≥30；峰值≤400/250；子弹≤8；draw call≤8 | `npm run bench` + `bench:browser` + 真机 / 程基岩 | ☐ |
| G3 | 单元测试 | ≥292 全绿（当前 35 文件 292 passed） | `npm test` / 严守真 | ☐ |
| G4 | 构建 | `npm run build` 退出码 0（tsc --noEmit && vite build） | 本地/CI / 程基岩 | ☐ |
| G5 | 双端冒烟 | 桌面 Chrome + 移动真机：开局 5s 首怪、HUD LV1、结算可进、0 console error | 冒烟手测 / 严守真 | ☐ |
| G6 | 可访问性 Basic | §3 八条落实：双编码/对比度/触控热区/字号/减少闪烁/焦点可见/高对比/双通道 | accessibility-tiers §3 / 林绘澄 | ☐ |
| G7 | Bug 门禁 | 无未关闭 P0/P1 Bug | QA bug 记录 / 严守真 | ☐ |
| G8 | 版本一致性 | package.json 版本 = 发布版本（0.2.0）；构建产物与部署备注一致 | 发布核对 / 路远行 | ☐ |
| G9 | 商店/法务 | 静态托管可访问、无敏感内容、字体/音频许可合规（CC0，audio-bible §5） | 发布核对 / 路远行 | ☐ |
| G10 | 回滚预案 | 上一版部署/链接保留可切换 | 见 §3 / 路远行 | ☐ |

**判定**：G1~G10 全 ☑ → GO；任一 ☐ → NO-GO（除非主理人明确豁免并记录原因）。

## 2. 发布动作（流程）

1. 确认门禁 G1~G10 全过。
2. 升版：package.json `0.1.0 → 0.2.0`（见 versioning.md），同步 CHANGELOG.md。
3. `npm run build`（产出 dist/，base './'，任意静态托管可用）。
4. 部署：WorkBuddy 轻应用发布 dist/（管理入口：**设置 - 数据管理 - 我发布的应用**）。
5. 分享链接验证：桌面 + 手机各一次冒烟（对应 G5 用例）。
6. 告知测试：将新链接与补丁说明同步严守真/测试者。
7. 打 tag：发布成功后 `git tag v0.2.0`。

## 3. 回滚预案

- 轻应用部署保留上一版：新版本异常 → 管理入口切回上一版部署/链接。
- 回滚后 24h 内完成根因分析并记录；热修走简化流程（保留审计与回滚预案），patch 版本 0.2.1。
- 若回滚 30 分钟内完成且无数据残留，可仅发简短玩家沟通；否则发正式致歉与修复时间表。
