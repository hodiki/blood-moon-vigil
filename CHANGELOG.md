# 变更日志（Changelog）

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [Semantic Versioning](https://semver.org/lang/zh-CN/)。
版本号唯一权威来源：package.json；发布升版规则见 `production/release/versioning.md`。

## [0.1.0-Demo] - Unreleased

> 垂直切片 Demo（当前内部基线，未发布）。R3 通过后正式验收发布，届时升版 **0.2.0**。
> 首个可完整游玩 20 分钟循环的版本：移动 → 击杀 → 经验 → 升级三选一 → 变强 → 20:00 Boss 收束 → 结算重开。

### Added

- **垂直切片核心玩法（E1–E4，22 Story）**：
  - 工程地基与移动（E1）：Vite + Phaser 3.90 + TS 脚手架、core 基建（事件/状态/时间/对象池）、RuntimeConfig 双端配置、键盘 WASD/方向键 + 移动端虚拟摇杆、3000×3000 地图边界与障碍碰撞。
  - 战斗闭环（E2）：伤害结算、3 种敌人（僵尸/疾行/厚血）、三武器（自动飞弹「血月猎手」/护体环绕球「守夜之环」/定时冲击波「月蚀脉冲」）、敌潮生成器（budget 压力曲线）。
  - 成长闭环（E3）：经验宝石与磁吸、need 升级曲线、12 项升级池（机制型 75%）、升级三选一 DOM 覆盖层、效果即时写回。
  - 收束与性能（E4）：HUD（DOM、0 draw call）、Boss「血月尊者」（6000HP/0.5s 霸体/顶部血条）、20:00 清场收束、结算页（存活/击杀/等级/build 回顾 + 再来一局）、性能基准与双端真机验证。
- **重开率埋点**：SessionStats（restartCount → 重开率，TASK-21），支撑 concept §9 留存判据。
- **剪影 v2**：程序生成高对比剪影（procedural-textures + 草地双材质，art-bible v0.3），敌我形状区分、描边纪律、双端可读。
- **音频引擎**（src/audio）：WebAudio 程序心跳层 + 6 项基础 SFX（武器发射/击杀闷响/宝石叮声/受击/选卡确认/Boss 出场）+ 手势解锁（audio-bible 首版必落）。
- **工程与发布基建**：git 仓库初始化（单提交 86eafcd）、283 单测（33 文件）、Playwright 冒烟、WorkBuddy 轻应用发布流程（production/release/）。
- **TASK-28 画面表现力专项**（src/fx + 环境氛围 + 双帧动画）：
  - 程序化 FX 粒子系统（fx-manager/fx-math/fx-spec/anim）：飞弹拖尾 / 环绕残影 / 冲击波涟漪 / 击杀溅射 / Boss 出场环，池 ≤200 桌面 / ≤100 移动，移动端 fxTrails=false 降级；粒子共用 fx-ambient 白底帧 + tint（1 组批次，+0 新贴图）。
  - 双帧角色动画：玩家 / 3 普通敌 / Boss 各 +1 变体帧（`*-v`，idle 1.4fps / move 9fps），随 applyPhase 暂停/恢复，同图集换帧 +0 draw call。
  - 环境氛围：血月天幕（moon 帧）+ 暗角渐晕（vignette 帧）+ 地面贴花 ×3（decal-rock/grass/blood），收敛 1 图集 fx-ambient（ambient +1 组批次）。
  - 纹理烘焙色值全量收敛为 token 派生（`hexToRgba`，code-review P1-2）；Boss 变体帧坐标收进 120px 帧界（美术复核 C-1 阻塞项修复）。
  - 新增 11 项单测（tests/unit/fx 9 + tests/unit/utils 2）；全量 294 单测（36 文件）。
- **TASK-33 矢量图标 DOM 落地**（src/ui/icons.ts + 升级卡 / 武器槽集成）：
  - 15 项矢量图标（升级卡 12 + 武器槽 3）由 Ardot 画布导出 SVG，本模块内联为模板（零静态资产、+0 draw call 增量）。
  - 编码总则（asset-spec §3 一眼分型）：机制型 = 蓝紫底 PALETTE.baseLight + 信息蓝描边（1/2 号带 ★ 星徽 = 新武器解锁）；数值型 = 琥珀金底（读"数字加多少"）。
  - **token 统一来源纪律**：模板内颜色一律 `{{token}}` 占位符，`ICON_COLORS` 全量派生自 balance.ts PALETTE / BOSS / GEM token（含新增 `PALETTE.uiPaper` 纸白），零散落字面量；同页多图标共存时 clipPath id 按 key 唯一化防 url 串扰。
  - DOM 覆盖层（levelup-overlay / hud）消费 `renderIconSvg()` 替换原 CSS 圆点占位；武器槽未解锁态降饱和变暗（区分解锁/锁定）；DOM 布局沿用 ux-spec §2/§3（升级桌面 128/移动 72、武器桌面 48/移动 44）。
  - 新增 9 项单测（tests/unit/ui/icons.test.ts：15 项 key 覆盖、类型分型、SVG 合法、token 解析、clipPath 唯一化、底色分型）；全量 303 单测（37 文件）。

### Changed

- 厚血怪保底生成 20s→40s（TASK-15）→ 回调 30s（TASK-18）：修复前期厚血堆积超判据（E2 C3）。
- 冲击波改为"有目标才释放"（E2 C2 → E3 落地）：保宝石产出与清屏价值。

### Fixed

- **P0 Bug1**：选卡后 WASD 持续按住失效（键盘恢复守卫）。
- **P0 Bug2**：移动端 DOM 覆盖层视口适配（升级/结算层在真机错位）。
- **P0 Bug3**：飞弹分裂无限弹射（同屏子弹数超预算 8；修复后 1 主弹 + 2 次级 ≤8）。

### Performance

- 桌面峰值同屏 400 / 子弹 7.96 / draw call 3；移动峰值 250（perf-analysis.md）。
- **TASK-28**：draw call 口径 3 → 5（背景 1 + characters 1 + effects 1 + ambient 1 + 粒子 1，≤8 硬预算）；桌面同屏峰值 400 / 移动 250 不变。
- 主 chunk 1.55MB（gzip 约 360KB）。
