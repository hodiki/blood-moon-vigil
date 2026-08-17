# 《血月守夜》Playtest 计划与首轮设计

> 版本 v0.1 · 作者：严守真（质量保障与测试）· Phase 6 并行线 C · TASK-23 · 简体中文
> 上游依据：`production/qa/qa-plan-sprint4.md`（M2 阈值/出口标准）、`design/gdd/design-review-e4.md`（Playtest 前 3 验证项 + Phase 6 交接项）、`design/concepts/concept.md` §9（成功标准）、`src/stats/run-stats.ts` + `session-stats.ts`（埋点）、`design/art-bible/art-bible.md` v0.3（剪影 v2 已落地）
> 性质：质量门为建议性（advisory）；每轮 PASS/CONCERNS/FAIL 由 QA 给出，进入下一阶段由主理人拍板。

## 1. 测试目标与轮次设计（≥3 轮）

| 轮次 | 时机 | 目标 | 采集重点 |
|---|---|---|---|
| R1 首轮 | Phase 6a 修复后（现节点） | 基线验证 Playtest 前 3 件事 + 暴露体验硬伤 | 纠结埋点×主观交叉、真机性能复核、20min 真机等级曲线、3min 爽感 |
| R2 调优后 | R1 反馈调参后 | 验证调参收敛（纠结代理/厚血/Boss） | R1 CONCERNS 项复测、reachedLevel47 触发率、后期升级间隔 <45s |
| R3 终验 | 打磨期最终 | concept §9 全项 + 双端矩阵验收 | §9 各项达标率、双端性能 |

每轮单人 30~45 分钟（含问卷）；单轮结论给 PASS/CONCERNS/FAIL。
**R1 前置校验**：① M2 真机性能三闸已复核通过（qa-sprint4 §5，未过先跑 bench 再开）；② 重开率埋点（session-stats，TASK-21）确认已接入，场景 C 方可采数。

## 2. 受测者分组

| 组 | 来源 | 人数/轮 | 设备 | 输入 |
|---|---|---|---|---|
| 内部·桌面 | 项目方策划/程序/美术，**含 1-2 名无游戏经验者**（行政/非玩家同事） | 2-3 | 桌面 Chrome | 键盘 WASD |
| 内部·移动 | 项目方 | 1-2 | 中端手机真机 | 触屏 |
| 外部·目标用户 | 幸存者 like/肉鸽玩家 | 3-5 | 桌面或移动 | 键盘或触屏 |

合计 6-9 人/轮。Lean 评审样本量为倾向性判断（非统计显著），以"≥80%""≥50%"作达标口径。

## 3. 测试场景与流程

| 场景 | 内容 | 采集 |
|---|---|---|
| A 单局完整 | 20 分钟（或玩家意愿提前死亡结算），全程观察 | RunResult 埋点 |
| B 即时问卷 | 单局结束后 5 分钟内填卷（趁记忆新鲜） | 问卷 8 题 |
| C 多局对比 | 重开率埋点接入后连续 ≥3 局 | restartCount / 结算次数 |
| D 移动真机 | 手机实际触屏：HUD 可读、暂停键热区、摇杆偏移（CM C-1） | 行为观察 + Q6 |

流程（45 分钟预算）：告知+上手 3min → A 20min → B 问卷 5-8min → C 两局 10min → 口播收尾 2min；移动组另跑 D 10min。

## 4. 问卷模板（8 题）

| 编号 | 题目 | 类型 | 判定阈值 |
|---|---|---|---|
| Q1 | 3 分钟节点自评爽感（1=无聊，5=很爽） | 李克特 1-5 | ≥80% 受测者 ≥4 分 |
| Q2 | 30s 内说出"只用移动"；首次升级达成 | 行为观察 + 是非 | 无游戏经验者 ≤30s 识别；firstLevelUpSeconds ≤30s（收紧口径，concept 原文 60s） |
| Q3 | 本局几次"两个都想选"；纠结强度 | 计数 + 李克特 1-5 | 主观 ≥3 次/局；与 hesitationCount 交叉，差 >1 → CONCERNS（代理偏宽） |
| Q4 | 5min 后是否意识到厚血怪（更大更硬） | 是非 | 明确意识 ≥70%；场上堆积 ≤2（FUNC-E3-07 延续，观察项） |
| Q5 | 重开意愿自发言语 | 自发言语捕捉 + 行为观察 | "停不下来/想再来一局" ≥50%；重开率埋点 ≥50% |
| Q6 | 移动端 HUD 可读性 + 暂停键热区 | 李克特 1-5 + 行为观察 | HUD 可读 ≥4 分；暂停键首点命中 ≥90%（44×44 物理热区） |
| Q7 | Boss 战紧张感 | 李克特 1-5 | 中位 ≥4；与 bossFightSeconds∈[60,90] 交叉 |
| Q8 | 视觉观感（圆点 → 剪影 v2） | 自发言语 + 李克特 1-5 | "更清晰/更有氛围" ≥80%；无"分不清敌我"言语 |

## 5. 数据采集

1. **埋点（客观）**：RunResult（survivalSeconds/kills/level/hesitationCount/upgradeTimestamps/reachedLevel47/bossFightSeconds/bossInTargetWindow）+ SessionStats（restartCount/结算次数 → 重开率）；Lv47 预警判据 = reachedLevel47 触发 + lastUpgradeIntervalSeconds <45s。
2. **问卷（主观）**：§4 八题，在线表单或手写。
3. **行为观察**：上手识别时间、纠结停顿时长、厚血躲避/无视、暂停键点中率，QA 现场记录。
4. **屏幕录像（可选）**：OBS/手机录屏，仅录局内，用于 R3 复看与 Bug 佐证。

## 6. 出口判定（每轮）

| 轮次 | PASS | CONCERNS | FAIL |
|---|---|---|---|
| R1 | 前 3 验证项数据可解读 + 无 Blocker | 数据可解读但有未达标项 → 放行进调优 | 数据不可解读 / 有 Blocker（崩溃、结算缺失）→ 修后重跑 |
| R2 | R1 未达标项收敛 | 收敛但个别项仍偏低 → 记 CONCERNS 供裁决 | 未收敛 → 回设计调参 |
| R3 | §9 全项 + 双端性能达标 → 建议放行 | 个别 §9 项未达 → 回设计，补测 | 关键项 FAIL → 阻塞发布签字 |

**concept §9 达标率表**（R3 结算用）：

| 指标 | 数据源 | 阈值 |
|---|---|---|
| 中位存活 | RunResult.survivalSeconds | ≥10min |
| 重开率 | session-stats | ≥50% |
| 纠结 | hesitationCount × Q3 | ≥3 次/局 |
| 3min 爽 | Q1 | ≥80% ≥4 分 |
| 上手 | Q2 + firstLevelUpSeconds | ≤30s 识别 / ≤30s 首级 |
| 自发言语 | Q5 | ≥50% |
| 性能 | M2 三闸 | 移动 ≥30fps / 桌面 ≥58/50 |

## 7. 首轮 Playtest 启动包（用户协调）

1. **测试版指引（一键体验 dev server）**：
   - 本地：`cd D:\code\vampire-survivors-like` → `npm install`（已装可跳过）→ `npm run dev` → 打开 `http://localhost:5173`。
   - 手机真机：`npm run dev -- --host` → 手机与 PC 同 Wi-Fi → 访问 `http://<PC 局域网 IP>:5173`。
   - 就绪检查：开局 5s 首批怪、HUD 左上 LV 1、移动响应正常。
2. **受测者告知用语（口播）**：
   "这是《血月守夜》试玩版。你只需要移动躲怪，武器自动攻击。像平时玩游戏一样玩，没有对错。我会观察记录，结束后问你几个问题。数据仅用于开发不外传，中途随时可停。"
   注意：不提前透露"只用移动/厚血/Boss"是考察点，保持自然。
3. **问卷填写方式**：首选在线表单 `playtest-questionnaire.html`（附 A，本地打开提交后导出 JSON）；备选手写纸质表（无网络/年长受测者）；QA 汇总入 `production/playtests/round-N-raw.md`（N=1,2,3）。
4. **数据导出脚本**：浏览器控制台运行附 B 片段 → 输出 restartCount + 本局结果 JSON → 粘贴给 QA；局内 RunResult 无法自动导出时由 QA 从结算页/屏幕录像补录。

## 附 A. 问卷 HTML 片段（示意）

```html
<form id="bmv-pt">
  <p>Q1 3分钟爽感(1-5): <input name="q1" type="number" min="1" max="5" required></p>
  <p>Q2 30s内说出"只用移动": <input name="q2" type="radio" value="yes">是 <input name="q2" type="radio" value="no">否</p>
  <p>Q3 本局"两个都想选"次数: <input name="q3" type="number" min="0" required></p>
  <p>Q4 5min后意识到厚血怪: <input name="q4" type="radio" value="yes">是 <input name="q4" type="radio" value="no">否</p>
  <p>Q5 自发言语: <textarea name="q5"></textarea></p>
  <p>Q6 HUD可读(1-5): <input name="q6" type="number" min="1" max="5" required></p>
  <p>Q7 Boss紧张感(1-5): <input name="q7" type="number" min="1" max="5" required></p>
  <p>Q8 视觉观感: <textarea name="q8"></textarea></p>
  <button type="submit">提交(输出JSON)</button>
</form>
<script>
document.getElementById('bmv-pt').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  console.log('[BMV-PT] ' + JSON.stringify(d));
});
</script>
```

## 附 B. 数据导出脚本（浏览器控制台）

```js
(() => {
  const out = {
    restartCount: localStorage.getItem('bmv.restartCount') || '0',
    ua: navigator.userAgent,
    ts: new Date().toISOString()
  };
  console.log('[BMV-PLAYTEST] ' + JSON.stringify(out));
})();
```
