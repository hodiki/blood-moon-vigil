# blood-moon-vigil v0.8-RC1 AI 自动化测试报告（2026-09-02 · ai-auto-test）

> 执行：AI 测试线（WorkBuddy Agent）· 主理人：游承峰
> 被测：`http://localhost:5173/`（Vite dev，主理人本机启动）
> 代码基线：HEAD `80a8b37`（批次收官 `b7d402c` + 文档提交），工作区干净，version 0.5.0
> 依据文档：`production/official-v1/真机验收单-v0.8.md`（手测十条 / 回填 6 项 / §三判据）
> 职责边界：AI 专职测试不做修复；P0 修复由主理人/工程线决策

---

## 一、总体结论

| 项 | 状态 |
|---|---|
| 验收进度 | **BLOCKED —— P0-1 拦截全部进局路径** |
| 已完成检查 | 启动页 UI（PASS）/ QA 钩子（PASS）/ 测试基建验证（PASS，含注入通道判定） |
| P0 缺陷 | **1 项（P0-1 PlayScene 场景 key 丢失，点击开始即黑屏）** |
| 恢复条件 | P0-1 修复 → AI 立即续跑手测 9 冒烟 → 全链路解封 |

---

## 二、P0-1：PlayScene 场景注册 key 丢失（点击开始即黑屏）

### 现象
- `?smoke=1`：60s 内 `__SMOKE_RESULT__` 永不写入，console 报 **`Scene key not found: Play`**
- 正常路径：启动页点击「点击开始」→ overlay 销毁 → **画面永久黑屏**（截图 `menu-after-start.png`）
- 影响面：**所有进局路径全部断裂**（点击开始 / smoke / bench / qa 挂机），游戏当前不可玩

### 证据链
| # | 证据 | 位置 |
|---|---|---|
| 1 | BootScene 跳转目标 `this.scene.start('Play')` | `src/scenes/BootScene.ts:40` |
| 2 | 场景注册表 `[BootScene, PlayScene]` 正常 | `src/config/game-config.ts:39` |
| 3 | 当前 HEAD PlayScene 类 **无 constructor、无 super()**，无场景 key | `src/scenes/PlayScene.ts:100` |
| 4 | 基线 `3286635` 存在 `super('Play')`（PlayScene.ts:264） | git 考古 |
| 5 | W-F1 拆分将 `isSmoke/isBench/isQa` 读取搬入 BenchSmokeRunner（正确），`super('Play')` 随 constructor 整体遗失 | `src/scenes/run/bench-smoke-runner.ts:57-63` |

### 根因判定
W-F1 PlayScene 拆分（2015→1200 行）机械搬移时，constructor 的**参数读取逻辑**被正确承接，但 **`super('Play')` 这一行随整个 constructor 被删除**。Phaser 对无 key 场景回退类名 `'PlayScene'` 注册，跳转找 `'Play'` 失败。

### 为什么三道门禁均未拦截
| 门禁 | 结果 | 原因 |
|---|---|---|
| typecheck | 0 错误 | TS 不强制显式 constructor（隐式 `super()` 合法） |
| 1368 单测 | 全绿 | 单测不跑真实 Phaser 引导链 |
| build | ✔ | 编译期无感知 |
| e2e 冒烟 | **未执行** | `playwright test` 属 CI §5 P2 可选增强，未入常规门 |

> **结构性建议**（记录待议）：e2e 冒烟（`npx playwright test`，需先 build）应纳入 commit/tag 门禁——批次 F 落地至本次真机验收前无人真实进局，此空洞持续约一整天未被察觉。

### 建议修复方案（供工程线采纳，AI 不执行）
```ts
export class PlayScene extends Phaser.Scene {
  constructor() {
    super('Play');
  }
  // ...原有类体不变（isSmoke/isBench/isQa 已由 BenchSmokeRunner 承接，无需搬回）
}
```

---

## 三、已执行检查项明细

### 3.1 手测 9：`?smoke=1` 冒烟 —— ⛔ BLOCKED（P0-1）
- headless 与 headed 双模式均确认：`__SMOKE_RESULT__` 不产出，60 帧判据无法达到（场景未启动）
- 诊断截图：`menu-after-start.png`（黑屏实证）

### 3.2 启动页 / 主菜单 UI 检查 —— ✅ PASS
| 检查点 | 结果 |
|---|---|
| 标题渲染「血月守夜 / Blood Moon Vigil」 | ✅ |
| 4 角色卡（艾德蒙默认选中·冷青描边 / 卡珊德拉 / 薇奥莱 / 加尔文） | ✅ 齐全，选中态正确 |
| 3 地图卡（月下墓地选中 / 血教堂 / 狼穴，尺寸+Boss 标注） | ✅ |
| 功能按钮：守夜日志 / **滤月余辉**（树入口，手测 10 用） | ✅ 存在可点 |
| 「点击开始」按钮 | ✅ 存在可点（点击后进 P0-1 黑屏） |
| DOM 交互元素总数 | 10 个 button，全部 visible |
| 截图 | `menu-start.png` |

> 注：验收单手测 2 写「修女」，启动页角色全名为「圣辉夜祷修女·**薇奥莱**」（技能：安魂曲），执行时以该卡为准。

### 3.3 QA 钩子可用性 —— ✅ PASS
| 钩子 | 状态 | 备注 |
|---|---|---|
| `?qa=1` → `__BMV_QA` | ✅ 安装成功 | `status()` 返回 `{hero:'hero_edmund', map:'map_graveyard', unlocks:{...false}}`（新存档） |
| `__BMV_QA.setHero/setMap/unlockAll` | ✅ 可用（未实测进局效果，待 P0-1 修复） | 免刷新切角色/地图，手测 1~3 准备就绪 |
| `?smoke=1` → `__SMOKE_RESULT__` | ⛔ 待 P0-1 | 机制本身在位（BootScene 直通分支确认） |
| DEV `__BMV_GAME__`（Phaser.Game 实例） | ✅ main.ts:29 | **回填 6 项运行时采样的官方通道**（kills 曲线定时采样/宽容触发率深读） |
| `?bench=1` → `__BENCH_RESULT__` | 待 P0-1 | 36s→720 局时秒挂机采样，kills 曲线辅助 |

### 3.4 资源加载降级检查 —— ✅ 符合 M4 预期（记录在案）
- `public/` 目录不存在，`atlas/characters|effects.{png,json}` 4 项请求经 Vite SPA fallback 返回 **200（HTML 内容）**
- Phaser loaderror 静默兜底 → **console 无错误**（headless 复跑 console 全净）→ 不污染冒烟判据
- 程序剪影兜底路径生效与否：待 P0-1 修复后进局视觉确认
- 另有一条 headed 环境单次 404（未复现、无游戏影响，低危挂账）

### 3.5 测试基建验证 —— ✅（desktop-gui-automation 路线定案）
| 项 | 结果 | 结论 |
|---|---|---|
| Playwright（项目自带 1.62.1 + chromium-1234） | ✅ headless/headed 双模可用 | **主通道** |
| Step 0 注入自检（diag_inject） | ❌ **INJECTION_BLOCKED**（会话级沙箱隔离，`EXIT=2`） | gtool 键鼠注入层**本轮禁用**（skill 纪律：不重试） |
| CDP 协议层（Playwright Input 域 / eval / DOM click） | ✅ 不经 OS 注入，沙箱内有效 | 键鼠操作全走此层 |
| 视觉判定（协议层截屏 + 多模态分析） | ✅ 不受注入封锁影响 | Boss telegraph / 演出类判定用 |

> 主理人问询回复：此前未弹浏览器 = headless 模式（进程在、窗口不显）；现 headed 模式已验证可见窗口正常调起。desktop-gui-automation 已按 Step 0 完成注入自检并出具 INJECTION_BLOCKED 判定，其 CDP 路线与 Playwright 同通道继续服役，注入层按纪律降级。

---

## 四、P0-1 修复后的续跑清单（AI 就绪待命）

| 顺序 | 项 | 方式 | 预计 |
|---|---|---|---|
| 1 | 手测 9 冒烟复跑 | `?smoke=1` + 默认专武开火截图判定 | ~1min |
| 2 | 手测 5 时序锚 | `?qa=1` 挂机 200s 采 console（方阵 100s/精英 120s/181s/血犬前扑） | ~4min/局 |
| 3 | UI 抽检 ②③④⑤⑥ | 进局后 DOM+截图逐项 | ~10min |
| 4 | UI 抽检 ⑦ BUG-3 矮视口 | 1280×656 viewport 复现 | ~2min |
| 5 | 手测 10 树界面机械检查 | 主菜单「滤月余辉」入口 + 节点购买状态读取 | ~5min |
| 6 | 回填 6 项采集管线 | 逐局 `__BMV_LAST_RUN` + `__BMV_GAME__` 定时采样脚本 | 随主理人游玩批次 |
| 7 | 手测 1~4/6~8 | 主理人亲手玩（AI 用 `__BMV_QA` 切角色/地图配合） | 主理人档期 |

---

## 五、附件与产物

| 文件 | 说明 |
|---|---|
| `D:\code\.workbuddy\tmp\bmv-qa\menu-start.png` | 启动页全景（PASS 实证） |
| `D:\code\.workbuddy\tmp\bmv-qa\menu-after-start.png` | 点击开始后黑屏（P0-1 实证） |
| `D:\code\.workbuddy\tmp\bmv-qa\smoke-60f.png` | smoke 模式卡 Boot（P0-1 实证） |
| `D:\code\.workbuddy\tmp\bmv-qa\q0_diag.cjs / q1_smoke.cjs / q2_menu.cjs / q3_404.cjs` | 可复跑测试脚本（Playwright 库模式） |

---

*报告生成：2026-09-02 10:47 · AI 测试线 · 下次更新：P0-1 修复后*
