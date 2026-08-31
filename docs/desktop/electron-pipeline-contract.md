# 《血月守夜》Electron 客户端化 · 流水线契约 v1.0

> 状态：待主理人裁决（决策点见 §5）
> 关联：方案分析轮已确认路线 A（Electron）；本文档将路线固化为**可判定、可重复执行、零侵入**的自动化规则。

## 0. 设计原则（为什么这套规则能"一定自动化"）

1. **可判定**：每条规则附带自动化判定命令（命令 + 期望输出），不需要人工判断"算不算满足"；
2. **幂等**：流水线重复执行结果一致——`desktop/` 层自包含，整体可增可删，无手工步骤；
3. **零侵入**：对 web 构建链"只增不改"。原 `scripts`、`vite.config.ts`、`index.html` 原样保留，可用 `git diff` 自动守护；
4. **自校验**：流水线末端自动断言产物 + 无头冒烟，失败即退出码非 0，可接 CI。

## 1. 规则集

### R-A 工程前提

| # | 规则 | 自动判定 | 通过标准 |
|---|---|---|---|
| R-A1 | Node ≥ 18.18（Electron / electron-builder 要求） | `node -v` | 主版本 ≥ 18 |
| R-A2 | 存在确定性静态构建命令，产出单目录静态产物 | `package.json` scripts | 存在 `build` 且引用 `vite build`，产物目录唯一 |
| R-A3 | 无服务端/后端运行时依赖 | 依赖表 + `grep -rE "from ['\"](ws|http):" src/` | 依赖仅前端库，无 server 代码 |

### R-B 构建产物约束

| # | 规则 | 自动判定 | 通过标准 |
|---|---|---|---|
| R-B1 | 单页入口 + `<script type="module">` | `grep -c 'type="module"' index.html` | == 1 |
| R-B2 | Vite `base: './'` 相对路径（产物可从任意 scheme 加载） | vite.config.ts | 含 `base: './'` |
| R-B3 | 产物自包含：dist 内无运行时外链（CDN/远程资源） | 构建 `dist/index.html` 中无 `https?://` 资源引用 | 全部本地 |
| R-B4 | 产物为 ES Module → **壳的义务**：必须以自定义协议加载，禁止 `file://` 与 `webSecurity:false` | 壳代码审查（grep 判定） | 存在 `protocol.handle` 注册 |

### R-C 运行时约束

| # | 规则 | 自动判定 | 通过标准 |
|---|---|---|---|
| R-C1 | 存储仅用 localStorage/IndexedDB，无 cookie / window.opener / file:// 假设 | `grep -rE "document\.cookie|window\.opener" src/` | 空 |
| R-C2 | 无网络硬依赖，断网可启动 | 冒烟（断网/离线缓存生效即通过） | 启动成功 |
| R-C3 | **平台分支判定在壳内正确**：UA 触屏/窄窗口不得误触发移动端分支 | 一次人工审计 + 壳侧窗口参数兜底 | 桌面窗口恒走 desktop RuntimeConfig |

### R-D 壳层规则（desktop/ 目录契约）

| # | 规则 | 内容 |
|---|---|---|
| R-D1 | 自包含 | `desktop/` 含 main.ts / preload.ts / electron-builder.yml / tsconfig；删除目录 + 卸载 devDeps = 完全回滚 |
| R-D2 | 加载协议唯一 | dev = `loadURL('http://localhost:5173')`；prod = `app://` 自定义协议（standard+secure）读 `dist/`；禁止 `webSecurity:false` |
| R-D3 | package.json 只增不改 | 新增 devDeps（electron / electron-builder / vite-plugin-electron）+ scripts（dev:desktop / build:desktop）；原 scripts 逐字节不动 |
| R-D4 | 国内镜像 | `.npmrc` 配 `electron_mirror=https://npmmirror.com/mirrors/electron/`，二进制下载不卡墙 |
| R-D5 | 窗口契约 | 默认 1600×900、`minWidth: 960`（规避 `innerWidth<768` 误判）、`autoHideMenuBar`、icon、appId、单实例锁 |
| R-D6 | 幂等 | `build:desktop` = `npm run build` + `electron-builder --win`，两步均为纯命令，无手工介入 |

### R-E 自校验闭环

| # | 规则 | 内容 |
|---|---|---|
| R-E1 | 产物断言 | dist/index.html 与 dist/atlas/ 存在且非空 |
| R-E2 | 无头冒烟 | Electron 启动加载 `app://index.html?smoke=1`（复用现有 `installConsoleErrorCapture` 钩子），窗口 title 匹配 + 无 console.error 后自动退出，退出码 0 |

## 2. 当前项目符合性审计

| 规则 | 现状证据 | 判定 |
|---|---|---|
| R-A1 | Node 22.22.2（managed） | ✅ |
| R-A2 | `build: tsc --noEmit && vite build` → dist/ | ✅ |
| R-A3 | 唯一运行时依赖 phaser；无 server 代码 | ✅ |
| R-B1 | index.html L47 单入口 module script | ✅ |
| R-B2 | vite.config.ts L71 `base: './'` | ✅ |
| R-B3 | 全程序化资产 + writeBundle 将 atlas/frames 拷入 dist | ✅ |
| R-B4 | 壳的义务 → 设计于改造清单 #1 | ✅（待建） |
| R-C1 | 存档/音频/统计均走 localStorage；无 cookie/opener | ✅ |
| R-C2 | 零网络请求（全程序化资产 + WebAudio） | ✅ |
| R-C3 | ⚠️ **两个边界 gap**（见下） | ❌ 需处理 |
| R-D1~D6 / R-E1~E2 | 尚无 desktop/ 层 | ⬜ 待建 |

**R-C3 的两个 gap（本轮审计核心发现）：**

1. **触屏 Windows 误判**：`detectIsMobile()`（src/utils/device.ts）规则 = `maxTouchPoints>0 && 'ontouchstart' in window` **或** `innerWidth<768`。浏览器场景下"触屏笔记本判移动端"是 ARCH §4.2 定案可接受；但**桌面客户端里触屏硬件同样会让 1920×1080 桌面窗口误入移动端分支**（720×1280 分辨率 + 触控 UI），与玩家预期相悖。
   **解法（唯一需要动 src 的点，1 行）**：`detectIsMobile()` 顶部加 UA 前置分支——`navigator.userAgent` 含 `Electron/` 时直接 `return false`。不破坏"全局唯一、运行期只读"的 RuntimeConfig 架构。
2. **窄窗口误判**：客户端窗口缩到 <768px 宽会切移动 UI。R-D5 `minWidth: 960` 直接规避；若希望保留"缩窗变手机版"作为特性，删除该约束即可（决策点 WD-2）。

## 3. 改造清单

| # | 类型 | 文件 | 内容规格 |
|---|---|---|---|
| 1 | 新增 | `desktop/main.ts` | BrowserWindow（1600×900 / min 960×600 / autoHideMenuBar / 单实例锁）；dev 分支 loadURL dev server；prod 分支 `protocol.handle('app')` 读 dist；contextIsolation + sandbox 默认开启 |
| 2 | 新增 | `desktop/preload.ts` | 最小 contextBridge：appVersion / toggleFullscreen（D2 再扩存档导出） |
| 3 | 新增 | `desktop/electron-builder.yml` | appId `cn.hodiki.bloodmoon`；win：nsis + portable 双 target；asar 开；icon |
| 4 | 新增 | `desktop/tsconfig.json` | main/preload 编译配置（module: esnext → bundle，独立于游戏 tsconfig） |
| 5 | 修改 | `package.json` | devDeps：electron（当前稳定版）/ electron-builder / vite-plugin-electron（Vite 6 兼容版）；scripts：`dev:desktop` / `build:desktop`（= `npm run build && electron-builder --win`）/ `verify:desktop` |
| 6 | 新增 | `.npmrc` | `electron_mirror=https://npmmirror.com/mirrors/electron/`（npmmirror 已是你的 npm 源，对齐） |
| 7 | 修改（可选，建议） | `src/utils/device.ts` | UA 含 `Electron/` → 强制 desktop（R-C3 gap#1，1 行 + 注释） |
| 8 | 新增 | `docs/architecture/adr-005-desktop-shell.md` | 按项目 ADR 惯例记录本次决策（实施时补） |

## 4. 自动化流水线定义

```
npm run build:desktop
  ├─ step1  tsc --noEmit && vite build        （与 web 版同一步，dist 共享）
  ├─ step2  R-E1 产物断言                      （index.html + atlas/ 非空）
  └─ step3  electron-builder --win             （asar + nsis/portable → release/*.exe）

npm run verify:desktop
  └─ Electron 无头启动 app://index.html?smoke=1 → title 断言 + console.error 监听
     → 无错误自动退出，退出码 0（复用 ?smoke=1 现成钩子，断言细节按 smoke.ts 实装对齐）

npm run dev:desktop
  └─ vite dev server + electron 并行，HMR 照常
```

回滚方式：删除 `desktop/` + `.npmrc` + 3 个 scripts + 3 个 devDeps + device.ts 可选行 → 与改造前逐字节一致。

## 5. 决策点（待主理人裁决）

| # | 决策 | 选项 | 建议 |
|---|---|---|---|
| WD-1 | 触屏误判解法 | a) UA 前置分支（1 行改动） b) 不处理（触屏 Windows 玩家进移动 UI） | a |
| WD-2 | 窄窗口行为 | a) minWidth 960 禁止过窄 b) 保留缩窗变手机 UI 为特性 | a |
| WD-3 | 分发形态 | a) NSIS+portable 双 target b) 仅 portable（发好友最快） | a（多一个 target 无成本） |
| WD-4 | 首版平台 | a) 仅 win x64 b) 加 mac arm64 | a（外测好友均为 Windows） |

## changelog

- v1.0（2026-08-31）：初版。规则集 R-A~R-E 共 17 条 + 符合性审计（14 条 ✅ / 1 条 ❌ 2 gap / 6 条待建）+ 改造清单 8 项（仅 1 项动 src）。
