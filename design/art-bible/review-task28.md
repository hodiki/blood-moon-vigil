# TASK-28 画面表现力专项 · 设计复核报告（review-task28）

> 复核人：林绘澄（美术总监）· TASK-29 · Lean 评审强度（只做设计/美术侧核对，不做代码工程质量评审）
> 复核对象：TASK-28 未提交代码（`src/fx/*` 新增 4 文件 + `tests/unit/fx/*` 新增 2 测试 + balance/runtime-config/map/PlayScene/orbit/shockwave/xp/procedural-textures 修改）
> 设计依据：art-bible v0.3、asset-audit.md §8（TASK-28 规格）、asset-spec.md v0.2
> 复核方式：只读源码 + 几何/色值/预算核对；未修改任何源码
> 日期：TASK-29

---

## 0. 复核范围与总览

| 组 | 判定 | 一句话 |
|---|---|---|
| ① 环境氛围 | **PASS** | 血月天幕/暗角渐晕/地面贴花全部落地，token 一致，draw call 增量符合规格 |
| ② 角色动画 | **CONCERNS** | 4 实体动画合格；**Boss 变体帧侧翼超帧 6–9px 被裁剪（阻塞项）**；王冠尖 2–5px 裁剪为既有遗留 |
| ③ 特效强化 | **PASS** | 拖尾/残影/涟漪/溅射/出场环 5 项全部接入，色值全 token；涟漪粒子密度偏稀（可调） |
| ④ 粒子系统 | **PASS** | 池 ≤200/100、soft-cap 拒绝、移动端 fxTrails=false 降级，全部符合 §8.1 ④ |
| ⑤ 预算与纪律 | **PASS（附 1 项轻微收敛建议）** | token 统一精神达成（fx-spec 全 token；procedural-textures 字面量=token 色）；对比度/可读性/可访问性达标；draw call ≤5 ≤8 ✔ |

**结论：建议「先改 1 项再提交」——Boss 变体帧侧翼超帧裁剪（低成本一行坐标修复）；其余全部 PASS，改完即可提交。**

---

## 1. ① 环境氛围（血月天幕 / 暗角渐晕 / 地面贴花）

### 核对结果：PASS

| 规格项（asset-audit §8.1 ①） | 落地位置 | 核对 |
|---|---|---|
| 血月天幕 `fx-ambient` moon 帧（暗红月盘+冷青光晕） | `procedural-textures.ts` drawBloodMoon | ✅ 月盘 `PALETTE.enemyZombie` 暗血红 + danger 环 + 冷青 `#54E6C9` 光晕，屏幕空间常驻（`fx-manager.ts` depth -80，桌面 190 / 移动 120） |
| 暗角渐晕 vignette 帧（径向压暗 ~20%） | `procedural-textures.ts` drawVignette | ✅ 透明中心 → 边缘 55% base 色；屏幕空间 depth 800，DOM HUD/选卡在 canvas 之上不受影响 |
| 地面贴花 decal-rock/grass/blood 三帧 | `procedural-textures.ts` effects 图集 + `map.ts` MapSystem | ✅ 确定性散布（`DECAL_SEED`），桌面 28 / 移动 14，随 effects 组批次（0 新增批次） |
| draw call 增量 ambient +1 / 贴花 +0 | `PlayScene.ts` finishBench、`perf.ts` estimateDrawCalls | ✅ 口径：背景1 + characters1 + effects1 + ambient1 + 粒子1 = 5 ≤ 8 |

**核对明细**：
- `fx-ambient` 收敛 1 图集 512×256（moon + 5 粒子形状 + vignette）＝1 组批次 ✔（asset-audit §8.1 ①"+1"）。
- 贴花深度 -98（草地 -99 / 石板 -100 之上），血月/渐晕 scrollFactor=0 屏幕空间 —— 天幕常驻不随相机滚动，符合「血月天幕」视觉锚点。
- 月盘位于 screen 高 16% 处，桌面 190px（屏宽 9.9%）——尺寸合理，不抢中下战斗区。
- 渐晕不遮 DOM（HUD/暂停/选卡 0 draw call 覆盖层），只压暗 canvas 边缘；Boss 顶部血条同为 DOM，不受影响。
- 无新增图集 key 冲突（幂等 create，scene.restart 兼容）。

**备注（不阻塞）**：渐晕边缘 55% 压暗比 art-bible §5「压暗 20%」的**字面值强**（0→0.55 渐变均值 ~0.26）。作为氛围加强可接受，已在 §6 微调建议给出收敛位。

---

## 2. ② 角色动画（5 实体双帧：idle 1.4fps / move 9fps）

### 核对结果：CONCERNS（1 项阻塞 + 1 项既有遗留）

| 规格项（§8.1 ②） | 落地位置 | 核对 |
|---|---|---|
| 玩家/3 普通敌/Boss 各 +1 变体帧（`*-v`） | `procedural-textures.ts` createCharactersAtlas | ✅ 5 变体帧同图集（512×256），+0 draw call |
| idle 1.4fps / move 9fps 两帧循环 | `fx/anim.ts` createCharacterAnims | ✅ yoyo 循环，Boss 恒 idle，节奏符合 |
| 动画随 applyPhase 暂停/恢复 | `PlayScene.ts` applyPhase | ✅ LEVEL_UP/PAUSED `anims.pauseAll()`，RUNNING `resumeAll()` |
| 实体零逻辑改动 | anim.ts tickPlayer/tickEnemy 只读 velocity | ✅ Player/Enemy 均为 Arcade.Sprite（已确认），kind 字段驱动敌型动画 |

**✅ 合格项**：
- 玩家 pose=1（帽冠上浮 1px + 披风外扩下摆）、僵尸 pose=1（下颚张开啃咬）、疾行 pose=1（躯干拉长 + 四足收拢奔跑）、厚血 pose=1（肩部外扩 + 双角外倾蓄力）——四实体变体帧**均在帧内**（已逐帧核对坐标，无超界）。
- 移动态判定 `|vx|+|vy| > 5` 防静止抖动换帧 ✔。
- `playEntity` 仅在 key 变化时 play，避免每帧重复开销 ✔。
- Boss 恒 idle（慢速巨体不做快速 bob）符合纪律 ✔。

**❌ 阻塞项 C-1：Boss 变体帧（`enemy-boss-v`）侧翼超帧 6–9px 被裁剪**
- 位置：`procedural-textures.ts` bossShape pose=1 侧翼尖端 `x=±66`，加中心 (60,116) → 世界 x=126，**超出 120px 帧右界 6px**（主体层直接缺失；桌面放大层 ×1.05 → ±69.3 → 超 9.3px）。
- 影响：Boss「披风摆动」动画切到变体帧时，两侧翼尖部 6px 闪没/变钝，动画中可见跳变；**双端均发生**（移动端 outlineEnabled=false 不画放大层，主体 126−120=6px 仍超）。
- 建议改法（任选，最小成本为 a）：
  - a) `bossShape` pose=1 侧翼尖端 `±66 → ±56`、披风外扩 `f=60 → 56`；同时 pose=0 侧翼 `±58 → ±52` 保持两帧差异；王冠最高点 `-62 → -54`。校验：放大 1.05 后最外点 ≈ 56×1.05+60 = 118.8 < 120 ✔（王冠 -54×1.05 → 59.3 ≥ 帧顶 56 ✔）。
  - b) 图集重排给 Boss 帧留足 padding（改 `BOSS.TEXTURE_SIZE` 会触碰碰撞/血条口径，成本更高，不推荐本次做）。
- 涉及文件：`src/fx/procedural-textures.ts`。

**⚠️ 既有遗留 C-2（不阻塞本次，建议顺手修）**：Boss 王冠最高点 `(0,-62)` 主体层超帧 2px、桌面放大层超 5.1px，王冠尖轻微削平（asset-audit §7 记为「1–2px 可接受」属低估）。随 C-1 方案 a 一并收到 `-54` 即可消除。

---

## 3. ③ 特效强化（拖尾 / 残影 / 涟漪 / 溅射 / 出场环）

### 核对结果：PASS

| 规格项（§8.1 ③） | 落地位置 | 核对 |
|---|---|---|
| 飞弹拖尾（冷青尾迹，90ms 节流） | `fx-manager.ts` tickMissileTrails + FX.TRAIL_INTERVAL_MS | ✅ 每 90ms 对活跃飞弹各发 1 粒，寿命 0.3s；峰值 ≈ 8 枚 × 3.3 ≈ 26 粒 |
| 环绕球轨道残影（p-ring 随玩家，解锁后可见） | `fx-manager.ts` tickOrbitRing / orbit-orb.ts unlocked getter | ✅ 160px 冷青环，alpha 0.22，20°/s 旋转；仅解锁后可见 |
| 冲击波涟漪（释放瞬间沿当前半径一圈） | `PlayScene.ts` 上升沿检测 + `shockwave.ts` radiusPx getter | ✅ active false→true 触发，半径含升级 +50% |
| 击杀溅射（颜色/形状按敌型分化） | `fx-manager.ts` deathBurst + fx-spec DEATH_BURST | ✅ zombie 方块/ wolf 横条/ tank 菱形/ boss 圆点双色；10/8/16/24 粒 |
| Boss 出场（猩红金冲击环 + 震动） | `fx-manager.ts` bossEntrance + `PlayScene.ts` spawnBoss | ✅ 22 粒环 + 8 金点 + shake 150ms/0.004 + 0.5s 霸体闪红 |

**核对明细**：
- 全部特效色值取 token（fx-spec FX_COLORS：trail=playerAccent、gem=GEM.COLOR、upgrade=gold+cyan、shockwave、boss=猩红金）——语义对齐 art-bible §2（红=危险/金=稀有/蓝=经验/青=玩家）✔。
- 溅射「形状优先于颜色」：色盲下 p-square/streak/diamond/circle 可辨（fx-spec.test 断言两两分化）✔。
- 拖尾节流集中在 balance.ts FX 常量，未散落魔法数 ✔。
- 冲击波涟漪：18 粒沿 280px 圆周（弧间距 ≈98px），粒子 size 3、径向速度 60px/s、寿命 0.5s → 扩散 30px。**视觉偏稀**（一圈稀疏散点，涟漪感弱），属可调参数（§6），不阻塞。

---

## 4. ④ 粒子系统（fx-manager：池 ≤200 桌面 / ≤100 移动）

### 核对结果：PASS

| 规格项（§8.1 ④） | 落地位置 | 核对 |
|---|---|---|
| 池容量 = cfg.maxParticles（200/100） | `fx-manager.ts` 构造预创建 | ✅ 容量即池大小，不超 |
| 池满 reject（soft-cap） | `spawnParticle` 返回 false，emitBurst/emitRing 计 emitted | ✅ 绝不超预算 |
| 全部粒子共用 `fx-ambient` 白底帧 + tint → 1 组批次 | `spawnParticle` setTexture('fx-ambient', frame) + setTint | ✅ 1 extra pass |
| 移动端 fxTrails=false 关闭拖尾/残影 | `tickMissileTrails/tickOrbitRing/tickGemTrails` 首行 `if (!cfg.fxTrails) return` | ✅ fxAmbient/fxBursts 保留 |
| 粒子寿命用真实 dt（基准 20× 不加速） | `PlayScene.ts` realDt + fx.update(realDt) | ✅ 视觉节奏不崩 |

**核对明细**：
- 单次爆发最大值 = Boss 24 粒 ≤ 移动端池 100 ✔（fx-spec.test 断言 ≤200 为桌面口径，移动 100 亦满足）。
- 粒子层 depth 70（orb 90 / shockwave 85 / orbitRing 89 之上，vignette 800 之下）——层级合理。
- 宝石磁吸拖尾 150ms/粒/寿命 0.2s：若 50 颗宝石同时在磁吸半径内 → 活跃 ≈67 粒，加飞弹拖尾 26 → ~93 < 200 ✔；超限被 soft-cap 拒绝，不破预算。
- 降级矩阵与 runtime-config 一致（桌面全开 / 移动 fxTrails=false）✔。

---

## 5. ⑤ 预算与纪律（token 统一 / 对比度 / 可读性 / 可访问性 / 性能）

### 核对结果：PASS（附 1 项轻微收敛建议）

**5.1 token 统一纪律**
- fx-spec.ts 全部色值取 PALETTE/BOSS/GEM token ✔；DEATH_BURST/FX_COLORS 无装饰色、无新色相。
- procedural-textures.ts 顶部 `INK('#0B0E14')` / `PAPER('#F2F5F9')` / `WHITE('#FFFFFF')` 为**字面量**（注释声明 = art-bible 基底/纸白）。值等于 token（INK=PALETTE.base），未引入新色相——精神达标；字面严格性建议后续收敛（见 5.4 建议 S-1）。
- 帧内 rgba 硬编码（石缝/石斑/草叶/高光/血迹/光晕/渐晕）经逐一比对均为 token 色的 alpha 变体：`rgba(11,14,20,…)`=base、`rgba(84,230,201,…)`=playerAccent、`rgba(255,59,48,…)`=danger、`rgba(140,47,47,…)`≈enemyZombie。无新色相 ✔。

**5.2 对比度硬标准（art-bible §2）**
- 背景明度 L\*≤18：石板 `#131722` L\*≈7.7 ✔；草地基底 `#18201C` L\*≈11.4 ✔。草叶 `#2A3B2E` L\*≈23（纹理细节非基底，且远低于剪影，不构成抢眼，判 PASS 附注）。
- 主体剪影 L\*≥45：玩家月银白、Boss 猩红金、敌暗红均远超 ✔。
- UI 文字 ≥4.5:1、图形 ≥3:1：DOM 纸白文字维持（未在本次改动范围）；宝石白描边 1px 后深地可见 ✔。

**5.3 可读性 / 可访问性**
- 敌我不共用形状：圆帽披风 vs 骷髅/鼠形/盾形/王冠——维持 v2 ✔；溅射形状按敌型分化，色盲下形状可辨（Basic#1 满足）✔。
- 血月月盘为环境氛围（非信息载体），暗红盘+青晕在暗背景可辨；红=危险语义未挪用（月盘用 enemyZombie 暗红而非 danger 血橙，避免与「危险区」混淆）✔。
- 「减少闪烁」开关（暂停菜单）与特效不冲突：新增特效为单次爆发/拖尾，无持续闪烁源；陷阱/受击白闪不受本次改动影响 ✔。

**5.4 性能预算（asset-audit §8.2）**
- draw call：背景1 + characters1（含动画变体帧）+ effects1（含贴花）+ ambient1（血月/渐晕）+ 粒子 extra pass1 = **5 ≤ 8** ✔；bench 口径已同步（ambient 恒 1 + particlePasses 条件 1）。
- 粒子池 ≤200/100 ✔；图集 ≤2048²（characters 512×256 / effects 256×128 / fx-ambient 512×256）✔；`premultipliedAlpha=false` ✔（createCanvas 默认）。
- 无运行时模糊/全屏 shader（渐晕为预烘焙贴图）✔。

**⚠️ 轻微收敛建议 S-1（不阻塞）**：`INK/PAPER/WHITE` 与帧内 rgba 字面量建议改为从 token 派生（如 `hexToRgba(PALETTE.danger, 0.75)`），并把纸白 `#F2F5F9` 补为 `PALETTE.paper` token，彻底落实「唯一配置来源」。改法与 C-1 同文件，可合并处理。

---

## 6. 视觉参数微调建议（集中收敛位）

> 全部参数已按 ARCH §2 纪律收敛，改一处即可全局生效；以下为「观感微调菜单」，默认值均合格，供主理人/后续真机快照按需调整。

| 参数 | 当前值 | 建议区间 | 收敛位置 |
|---|---|---|---|
| 渐晕边缘压暗 | rgba(base, 0.55) | 0.40–0.45（§5「压暗 20%」更贴合） | `procedural-textures.ts` drawVignette |
| 月盘尺寸 | 桌面 190 / 移动 120 | 桌面 190–220 / 移动 120–140 | `fx-manager.ts` moon setDisplaySize（可上收为 FX 常量） |
| 月盘位置 | screen 高 16% | 12–18% | `fx-manager.ts` moon y |
| 冲击波涟漪密度 | RIPPLE_COUNT 18 / size 3 / speed 60 | 36 / 4 / 90（现 98px 弧距偏稀） | `balance.ts` FX 常量 |
| 飞弹拖尾节流 | TRAIL_INTERVAL_MS 90 | 60（更密）/ 110（降载） | `balance.ts` FX 常量 |
| 宝石磁吸拖尾节流 | GEM_TRAIL_INTERVAL_MS 150 | 120–180 | `balance.ts` FX 常量 |
| 地面贴花密度 | 桌面 28 / 移动 14 | 桌面 36–48 / 移动 18–24（现每 ~321px² 一个偏稀，建议沿出生区→外围路径聚类） | `map.ts` DECAL_COUNT_* |
| Boss 出场环 | BOSS_RING_COUNT 22 | 22–28 | `balance.ts` FX 常量 |
| 环绕球残影环 | ORBIT_RING_ALPHA 0.22 / 20°/s | 0.22–0.30 / 20–30 | `balance.ts` FX 常量 |
| 粒子形状基准 | size/8 scale | 保持（p-streak 12×4 按视觉接受） | `fx-manager.ts` spawnParticle |

降级开关收敛位：`runtime-config.ts` fxTrails / fxAmbient / fxBursts（移动端 fxTrails=false，不可再调为 true 除非程基岩确认负载）。

---

## 7. 测试覆盖核对（tests/unit/fx）

- `fx-math.test.ts` 5 项：burstVectors 确定性/多样性、ringParticles 均匀/count=0 安全、capBurstCount 预算裁剪 ✔ 覆盖视觉几何关键路径。
- `fx-spec.test.ts` 4 项：4 敌型全覆盖、字段有效性、单次溅射 ≤200 预算、敌型分化（形状优先）✔ 覆盖「色盲可辨 + 预算软上限」两条视觉纪律。
- 覆盖评价：PASS。token 来源为静态代码保证（值从 PALETTE import，无需单测）；真机观感（渐晕/月盘/粒子密度）属人工快照项，非单测范围，已在 §6 给出收敛位。

---

## 8. 结论

**判定：需要先改 1 项再提交（阻塞项 C-1），改完即可提交；其余全部 PASS。**

提交前必改：
1. **C-1（阻塞）**：`procedural-textures.ts` bossShape pose=1 侧翼尖端 `±66 → ±56`（含 pose=0 `±58 → ±52`、披风 `f 60→56`、王冠 `-62→-54`），消除 Boss 变体帧双端 6–9px 超帧裁剪。属坐标级一行修复，不动帧名/图集 key/逻辑，无回归风险。

建议顺手（非阻塞）：
2. C-2：王冠尖随 C-1 一并收到 `-54`，消除既有 2–5px 削平。
3. S-1：INK/PAPER/WHITE 及帧内 rgba 收敛为 token 派生（可后续单独提交）。

不阻塞微调：§6 渐晕强度 / 涟漪密度 / 贴花密度 / 月盘大小等，建议随 R1 真机快照按需调整（收敛位均已明确）。

**对工程侧交接**：C-1 仅改贴图绘制坐标，贴图 API/帧名/图集 key 不变，程基岩无联动改动；若采纳方案 B（扩帧）则需同步 BOSS.TEXTURE_SIZE 相关口径，本次不推荐。
