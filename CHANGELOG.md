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
- **TASK-36 剪影 v3 + 武器特效 P0 + 池契约修复**（src/fx/procedural-textures.ts + src/fx/fx-manager.ts + src/config/balance.ts 等 11 文件）：
  - **剪影 v3 P0**（按 silhouette-v2-spec）：玩家冷青提灯 + 帽带 + 三边开衩长袍；行尸颅骨裂纹 + 眉骨高光；血犬背脊棘刺 + 血口涎滴；屠夫屠刀（刃光纸白）+ 围裙带；Boss 冠上血月宝石 + 仪式权杖（杖首红宝石）。全部逐项过帧边界校验（Boss 放大 1.05 层 ≤120、屠刀刃光 x=22.5 ≤24、玩家开衩 ×1.12 ≤16）；帧名契约不变、色值全 token 来源、描边纪律不变。
  - **武器特效 P0**（按 weapon-fx-v2-spec，参数全收敛 `FX` 常量）：飞弹拖尾点→p-streak 彗尾（TRAIL_INTERVAL 90→70ms）+ 发射喷涌 + 命中冷青冲击环；环绕球自留尾迹 + 双层轨道环（外环 alpha 0.26/24°/s + 内环 0.12 反向 -12°/s）+ 命中火花节流 200ms；冲击波涟漪 18→36 加密提速（speed 90/size 4，移动端 24 降档）+ 最大半径白闪环 + 蓄力 2s 脉冲提示。+0 新增贴图批次（复用 fx-ambient p-ring/p-streak/p-circle），预算不变。
  - **池契约修复**（TASK-34 遗留建议）：`Enemy` 构造器 + `enemy-spawner` 的 `acquire` 显式传 `'characters'` + 帧名，与 XpGem/Boss/Missile 契约对齐，消除每次 spawn 的 `__MISSING enemy-zombie` 警告。
  - 新增 6 项单测（tests/unit/fx/fx-spec.test.ts：paper token 别名、拖尾帧、命中≤10、涟漪 36/24、白闪/蓄力、双层环常量）；全量 309 单测（37 文件）。

### Changed

- 厚血怪保底生成 20s→40s（TASK-15）→ 回调 30s（TASK-18）：修复前期厚血堆积超判据（E2 C3）。
- 冲击波改为"有目标才释放"（E2 C2 → E3 落地）：保宝石产出与清屏价值。
- **TASK-39 R1 波次 2 平衡落地**（用户已拍板：移速 235 / 厚血经验 10 / 首级强制武器；方案 production/gdd/balance-r1-tuning.md）：
  - **E1 磁吸强化**：`GEM.MAGNET_RADIUS 80→140`、`MAGNET_SPEED 320→360`（src/config/balance.ts）；升级第 9 项（磁力+100%）随之 140→280→420 不贬值。
  - **E1 E-lite 宝石慢漂**：落地 >3s 且距玩家 >磁吸半径的宝石以 80px/s 慢漂向玩家（src/xp/xp-manager.ts stepGem 新增 drifting 分支 + XpGem.age 字段）；进入磁吸半径后切换 360px/s 吸入，保留"地面战利品/贪心张力"。
  - **E1 玩家移速**：`PLAYER.MOVE_SPEED 220→235`（+6.8%，用户已批）。
  - **E2 敌潮重构**：`SPAWNER.LINEAR_SCALE 2.5→3.0`（20min 均值预算 4.2→4.8 点/s）、`WAVE_AMPLITUDE 0.4→0.3`（峰谷比 2.33→1.86 仍 ≥40%）；`SPAWN_STAGES` 四阶段权重按方案更新（0-3min 90/10/0、3-8min 78/20/2、8-15min 55/36/9、15-20min 45/35/16），屠夫随机 3%→2%、保底 30s 不动。
  - **E2 屠夫预警**：保底厚血出生前 2.5s 血月印记（`SPAWNER.TANK_WARNING_SECONDS=2.5`；enemy-spawner 预约落地时序 + PlayScene 红圈 p-ring 脉冲精灵 + audio-events 绑定低频重音，事件 `enemy:tank-warning`/`enemy:tank-spawned`）。
  - **E2 首级强制武器**：`rollThree(state, random, { forceWeaponFirst })` 保证首级三选一含 1/2 号（守夜之环/月蚀脉冲）之一（src/upgrade/upgrade-pool.ts；PlayScene 记首次抽取标志）。
  - **E2 厚血经验**：`ENEMIES.tank.xp 15→10`（E3 预授权判据 R1 Lv47 触发，压后期经验通胀）。
  - **文档同步**：`design/art-bible/art-bible.md` §4 精英"3 倍经验"口径改为 10、§7 拾取磁吸 80→140px（附 E-lite 漂移说明）。
  - 单测：新增 12 项（xp-manager 漂移 3 + 集成 1、upgrade-pool forceWeapon 4、tank-warning 时序 2、balance TANK_WARNING 断言并入既有项）；同步更新 §5.2 清单（balance/enemy-panel/player-stats/spawner/xp-manager 断言 220→235、80→140、15→10、预算新期望值）。全量 331 单测（38 文件，基线 321 + 10），`npm run bench` 通过（峰值 400/250、draw call 5、totalSpawned 3587）。

### Fixed

- **P0 Bug1**：选卡后 WASD 持续按住失效（键盘恢复守卫）。
- **P0 Bug2**：移动端 DOM 覆盖层视口适配（升级/结算层在真机错位）。
- **P0 Bug3**：飞弹分裂无限弹射（同屏子弹数超预算 8；修复后 1 主弹 + 2 次级 ≤8）。
- **TASK-34 Bug-1**：守夜之环轨道残影「p-ring」显示为半圆（`drawParticleShapes` 环心 `ox+40` 偏离帧中心 `ox+60` 20px，左半被帧界裁掉；修复后环心对齐帧中心 (188,24)，r=22 → 完整圆环；其它粒子形状经核验 p-circle/p-square/p-streak/p-diamond 绘制坐标均在帧内，未受影响）。
- **TASK-34 Bug-2**：自动飞弹「血月猎手」渲染异常（`weapon-system` 调 `acquire(x,y,'missile')` 把帧名 'missile' 误传入池契约的 **texture** 槽；HomingMissile.launch() 不像 Enemy.spawn() 那样纠正帧 → 飞弹挂在 Phaser `__MISSING` 全透明纹理上不可见。修复：两处 `acquire` 调用补齐 `'characters'` 纹理参数，帧契约 `'missile'` 不变、实体零改动；池契约与其它调用方（Enemy.spawn 显式 setTexture 纠正 / PlayScene Boss 'enemy-boss' / XpGem 'effects'+'gem'）的差异在注释中点明）。
- **TASK-37 R1 波次 1（玩家撞怪卡死 / 飞弹残留 / 图标居中）**：
  - **B1（P0）玩家碰撞敌人后游戏卡死**（`src/scenes/PlayScene.ts` + 新 `src/combat/contact.ts`）：根因 = `physics.add.overlap(player, group, this.onPlayerEnemyOverlap)` 把方法引用直接传入，物理 step 内 `this` 为 `undefined` → 首次接触抛 `TypeError: Cannot read properties of undefined (reading 'hurt')` → 异常沿物理 step 冒泡导致 Phaser 主循环崩溃，画面卡在最后一帧（"卡着不动"）。修复：抽取 `playerEnemyContact(enemy, nowSeconds, player)` 纯函数（test-framework §1.2 可测性要求）封装敌人攻击门 + `Player.hurt` 调用，overlap 改用箭头函数闭包 `(_o1, o2) => playerEnemyContact(...)`，`this` 词法绑定到 PlayScene；同时移除原 `onPlayerEnemyOverlap` 私有方法（死代码）。新增 5 项单测（`tests/unit/combat/contact.test.ts`：未激活/冷却中/造成伤害/同帧多敌/无敌帧）。
  - **B2（P0）飞弹命中精英（厚血怪/Boss）后留在身上抖动**（`src/weapons/homing-missile.ts` + `src/weapons/weapon-math.ts`）：根因 = 升级 6「飞弹穿透」后，穿透飞弹命中厚血怪（600HP）穿出，tick 中 `nearestEnemy` 仍把同一厚血怪选为最近目标，`checkMissileHits` 走 `hasHit` 跳过但飞弹继续追踪 → 飞到目标身上速度归零绕着抖动至 3s 寿命结束。修复：`weapon-math` 新增 `selectHomingTarget(origin, enemies, hasHit)` 纯函数（已命中目标过滤），`HomingMissile.tick` 用之替换 `nearestEnemy`；若场上无未命中目标则按 W8 §⑥.2「无目标原地消散」立即 `dissipate()`，不再绕残敌。新增 1 项单测（`tests/unit/weapons/homing-missile.test.ts`：跳过已命中、选次近、全已命中→null、未命中仍可选）。
  - **B3（P1）升级/武器图标不居中**（`src/ui/icons.ts`）：根因 = 15 项图标由 Ardot 画布导出，画布稿部分内容（飞弹箭头偏右、屠刀偏右下、+15%/-8%/+20 数字型偏角、护体球+1 偏上等）未对齐 viewBox 中心。修复：用 Playwright + `SVGGraphicsElement.getCTM() × getBBox()` 测量 15 项图标「内容 bbox 中心 → viewBox 中心」差值；新增 `ICON_CENTERS: Record<IconKey, {dx,dy} | null>` 数据表（3 项已居中 `null`，12 项带 `dx/dy`），`renderIconSvg` 在 token 替换后、clip id 唯一化前，于背景 rect 之后、最后一组描边 frame 的 `<clipPath>` 之前插入 `<g transform="translate(dx dy)">…内容…</g>` 平移组——底色与外层描边 frame 保持原位，仅图形内容平移到 viewBox 中心；每 key 首次渲染缓存复用。新增 6 项单测（`tests/unit/ui/icons.test.ts`）。
  - 全量 321 单测（38 文件，+12），`npx tsc --noEmit` 0；Playwright 实测：站桩 25s + 移动 25s 无 `pageerror`/无 `console.error`，游戏持续运行；图标对照页 15 项全部居中（`D:\code\.workbuddy\screenshots\task37-b3-icons-compare.png`）。

### Performance

- 桌面峰值同屏 400 / 子弹 7.96 / draw call 3；移动峰值 250（perf-analysis.md）。
- **TASK-28**：draw call 口径 3 → 5（背景 1 + characters 1 + effects 1 + ambient 1 + 粒子 1，≤8 硬预算）；桌面同屏峰值 400 / 移动 250 不变。
- 主 chunk 1.55MB（gzip 约 360KB）。
