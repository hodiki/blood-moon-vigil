# 《血月守夜》批次 1 入局后 · 问题与建议交接

> 日期：2026-08-25  
> 给：主程 · 美术 / 提示词 · 策划  
> 背景：批次 1 入局后实测「移动鬼畜」「战斗/技能表现不足」。  
> **TA / 管线侧已落地，不必再排期。** 下文只列仍需你们处理的项。

---

## 0. 已落地（对照用，勿重复施工）

| 项 | 结果 |
|---|---|
| 同族共享 contain 缩放 | 矮姿势不再被独立撑满。血犬面积差曾 147%→现 22.8%；灰狼脚底 7px→0；芬里厄脚底 22px→1 |
| 脚底对齐 | 不透明 `maxY` 贴画布 −5% 边距；水平包围盒居中 |
| 时间轴门禁（分档） | **idle `-v` 最严**；`skill-*` / `-walk-*` / `-entrance` 允许姿态变化、仍锁脚。单帧 PASS 但时间轴 FAIL → 整帧 FAIL |
| 当前验收 | `node process.mjs --check` → **PASS 41 / FAIL 17**（FAIL 全是姿态内容，不是抠图/尺寸） |
| pivot | `assets/atlas/pivots.json` + 图集 `meta.framePivots`。同族共用 **base 脚底 pivot**。**不要**写入 `frames[].pivot`（Phaser 会自动 `setOrigin`，打乱碰撞圆心） |
| 走路抽搐（引擎） | `src/fx/anim.ts`：**不再**用 idle `-v` 做 9fps yoyo 走路。无 `-walk-a/b` 时移动也播 idle 1.4fps。到货后自动建 6fps 正向循环 |
| flipX | 工具函数已接。因批次 1 **朝向不统一**（守夜人偏右，犬/尸多朝左），目前 **只对 `player` 启用**，避免敌人月步 |

命令：

```bash
cd tools/asset-pipeline
node process.mjs --all && node pack.mjs   # 重处理
node process.mjs --check                  # 单帧 + 时间轴
node layout.test.mjs                      # 门禁自检（不碰 raw）
```

---

## 1. 给主程

### 仍需做

1. **技能姿态已在图集，引擎没播**  
   `anim.ts` 仍跳过 `*-skill-a/b`。`PlayScene.tryCastActiveSkill` 只结算玩法。  
   建议：`tryCast` **伤害/状态瞬间结算、不挡移动**；表现层叠 `skill-a` 约 300ms → `skill-b` 约 150ms → 回 idle。  
   与 GDD「无蓄力」的对齐见 §3。

2. **四主动技不要共用一个冷青环**  
   `PlayScene.tryCastActiveSkill` 末尾对四角色都调 `fx.lanternFlash`。按 `asset-spec` §3.2 拆模板（已有 `p-ring` / `p-streak` / `p-circle`）：  
   - 提灯闪耀：爆发环 + 最大半径白闪  
   - 血影突袭：路径 `p-streak` + ghost ×3（不必等 skill-ring PNG）  
   - 安魂曲：双环间隔 0.15s + 治疗绿点  
   - 血月狂化：体型 ×1.1 + 兽纹粒子；主体保持月银白

3. **行为标记用程序帧先挂，别等批次 2**  
   `src/fx/fx-spec.ts` 的 `SPECIAL_MARKERS` 有常量、零实例化。  
   - 亡魂：本体 `α0.5`  
   - 尸巫：脚下 `p-ring` tint 幽紫  
   - 狼裔猎手：Graphics 红线（规格已写「引擎绘制」）  
   - 侍僧：头顶一个 `p-circle`  
   - 眩晕 / 减速 / 标记：头顶小点，帧名到货再换

4. **Boss 出场**  
   `boss-*-entrance` 三帧已入仓且时间轴已 PASS。`spawnBoss` 只闪 α。出场 0.5s 切 `-entrance` 再回 idle。尊者（`enemy-boss`）无 entrance 后缀，维持闪红即可。

5. **全量 flipX（依赖美术统一朝向）**  
   `facingFlipX` / `defaultFacesRight` 在 `src/fx/anim.ts`。美术锁「默认朝右」后，把 `defaultFacesRight` 扩到 `hero-*` 与 `enemy-*`（或改成查表）。竖移保持上一朝向；死区 8 px/s。

6. **接入 pivot 时先做 body offset，再改 origin**  
   现在精灵 `origin 0.5` 对齐碰撞圆心。直接 `setOrigin(pivots.json)` 会让人「站到圈上面」。同族用 base 的 pivot。

### 不要做

- 不要为鬼畜去出 4 向 × 8 帧走循环（轴心不锁一样抽；规格已定 flipX）。
- 不要改 `PLAYER.RADIUS`（已与 64 档脱钩）。
- 不要把 `frames[].pivot` 写进 TexturePacker JSON。
- 不要再把 idle `-v` 接到 9fps move 上（已拆掉）。

---

## 2. 给美术 / 提示词

### 重绘原则

以 **idle / base 帧做 img2img 底板**，只改四肢/道具 2–4px。写死：

```
same ground line, same hat/head height, same body scale,
no stretch-compress, no second costume, no shockwave rings
```

`-v` = 呼吸 / 披风 1–3px，**不是另一张立绘**。禁止 stretch vs compress。  
技能帧只换姿态；帽檐顶与脚底与 idle 同高。环 / 粒子归引擎，不要画进 PNG。

**朝向契约（给 flipX）：** 全部实体 **默认朝右**（鼻尖 / 吻部 / 灯在画面右侧）。批次 1 犬、尸、部分英雄偏左，引擎因此不能全量镜像。重绘时一并改过来。负向加：`mirrored silhouette must stay readable`。

### P0 重绘队列（时间轴 FAIL，管线救不了）

数字来自 2026-08-25 `process.mjs --check`（P-6 后成品）。共 **17** 帧。

| 优先级 | 帧 | 问题 | 建议 |
|---|---|---|---|
| P0 | `enemy-hound-v` | 面积 +22.8%（脚已齐） | 两帧都是「小步」，体长锁定；删 stretch/compress |
| P0 | `enemy-greywolf-v` | 面积 +21.1% | 同上 |
| P0 | `enemy-wolfhunter-v` | 重心 8.4px、面积 +28.5% | 同剪影换步，不要换一套服装/体型 |
| P0 | `boss-fenrir-v` | 重心 12.2px | 呼吸不要整只平移；出场帧已过关，只改 `-v` |
| P0 | `boss-cardinal-v` | 重心 7.2px | 圣杯/袖不要把质心拽出 4px |
| P0 | `enemy-stonewolf-v` | 重心 5.9px | 体型锁定，只动腿 |
| P1 | `enemy-bat-v` | 重心 4.5px、面积 +30% | 翅膀开合不要改身体大小 |
| P1 | `enemy-cupbearer-v` | 重心 3.8px、脚 1px、面积 **+57.1%** | 两帧体量差过大，几乎像两个怪 |
| P1 | `hero-galvan-v` | 重心 3.0px | `-v` 改呼吸，不要换姿势 |
| P1 | `hero-galvan-skill-b` | 面积 +29.7% | 狂化 +10% 不要靠整帧放大 |
| P1 | `hero-violet-v` | 脚 1px、面积 +15.2% | 脚钉死；面积贴 15% 门 |
| P1 | `boss-moonavatar-v` | 重心 11.0px、脚 1px | 呼吸不要升降整座身体；出场帧已过关 |
| P1 | `enemy-boss-v` | 重心 6.9px | 尊者 idle 对呼吸 |
| P2 | `enemy-necro-v` | 重心 2.8px、脚 1px、面积 +23.6% | img2img from idle |
| P2 | `enemy-penitent-v` | 重心 4.1px | 同上 |
| P2 | `enemy-fleshmass-v` | 重心 3.8px | 同上 |
| P2 | `enemy-zombie-v` | 重心 2.1px（卡在 2px 门上） | 微调即可 |

**已 PASS、不必重绘（含技能/出场）：** 守夜人全家（idle + skill）；卡珊德拉全家；紫衣 skill-a/b；加尔凡 skill-a；守墓者；血信徒；甲虫；暗影狼；亡魂；三 Boss 的 `-entrance`。

### 提示词文档（`01-prompts-core-entities.md`）

- 全文仍写 32/28/24px，契约已是 **64 / 56 / 48**（`frame-specs.mjs`）。按 64 档写像素预算。
- **删掉**犬/狼的 `sprint A stretched / B compressed`——血犬鬼畜的源句。
- 英雄 `-v` 改成 `idle breathe, cloak 1-2px, feet glued`。
- 加：`default facing right` + `mirrored silhouette must stay readable`。
- 技能继续禁止画冲击环/粒子。

### 验收

看管线后的 **契约尺寸成品**，不要只看 raw。重绘后：

```bash
cd tools/asset-pipeline
node process.mjs <帧名>     # 会自动纳入同族 raw 算共享缩放
node pack.mjs
node process.mjs --check <帧名>
```

`assets/report.json` → `checks.temporal.ok === true` 才算这一对过关。

---

## 3. 给策划 / 文档

### 必须裁定：「无蓄力」vs 前摇帧

- `gdd-active-skill` §3.1：释放瞬间结算，无蓄力。
- 同文件 §④ 与 `asset-spec` §3.3：`SKILL_WINDUP_MS=300` + `skill-a`。
- 工程 `ActiveSkill.tryCast` 按「无蓄力」做成瞬发、不切姿态。

建议锁成一句：**无蓄力资源（没有蓄力条、伤害不延迟）；表现允许约 0.45s 姿态叠层，不打断移动。**  
改 GDD §3.1 一句即可，规格 §3.3 可保留。

### 写入契约（`asset-spec-v1` 建议新增 §2.7）

| 项 | 门禁 |
|---|---|
| 共享比例 | 同实体全部帧用族共享 scale（管线已做） |
| 脚底 | vs idle：ΔY = 0（直立）/ 1px（四足或幽灵） |
| 重心（idle `-v`） | hypot ≤2px（64）/ 3px（96）/ 4px（Boss） |
| 面积（idle `-v`） | 不透明像素 Δ ≤15%（犬科 ≤20%） |
| 技能 / 出场 | 只换姿态；门禁宽于 idle（管线已分档）；环/粒子归引擎 |
| 方向 | 只 flipX，不出四向；**原图默认朝右** |
| idle vs move | 当前 2 帧只承担 idle；move 用 `-walk-a/b` 再播 6fps。未到货时引擎播 idle（已落地） |

若加走循环，后缀 `-walk-a` / `-walk-b`，不要占用 `-v`。管线已识别该后缀并纳入同族缩放。

### 台账

`00-asset-prep-tracker.md` 的「PASS 58/0」应改成：

- 单帧契约（尺寸/边距/L*）：仍全过  
- 时间轴（含 idle/skill/entrance）：**41 PASS / 17 FAIL**（2026-08-25）

### 批次 2 顺序（不要先画 40 张升级图标）

1. 行为标记 6 帧 + 技能环 4 帧（战斗可读；主程可先用程序帧顶上）
2. 三把已进 Demo 的武器精修（`missile` / `orb` / `shockwave`）
3. 其余武器 / 超武 / 召唤物
4. UI / 图鉴

### 不要做

- 不要把技能环画进角色 PNG。
- 不要为了「更像 VS」去出四向攻击帧（武器自动开火，角色普攻循环不是缺口）。
- 不要把碰撞半径跟 64 档绑死。

---

## 4. 建议全组顺序

| 序 | 谁 | 事 |
|---|---|---|
| 1 | 主程 | 技能姿态 300+150ms；四技能分模板粒子；亡魂半透明 + 警告线；Boss `-entrance` |
| 2 | 策划 | 裁定「无蓄力 vs 前摇」；asset-spec 写入 §2.7；台账改 41/17 |
| 3 | 美术 | P0 六对：血犬、灰狼、猎手、芬里厄 `-v`、石甲狼、主教 `-v` |
| 4 | 提示词 | 64 档语言；删 stretch-compress；默认朝右 |
| 5 | 美术 + 主程 | 朝向统一后，把 `defaultFacesRight` 扩到英雄/敌人 |
| 6 | 全组 | 批次 2：标记 + 技能环 → Demo 三武器 |
| 7 | 可选 | 英雄/精英 `-walk-a/b`（仍 flipX，6fps 正向循环） |

---

## 5. 参考路径

| 文件 | 用途 |
|---|---|
| `tools/asset-pipeline/README.md` | 管线命令与门禁口径 |
| `tools/asset-pipeline/layout.mjs` | 时间轴门禁实现 |
| `assets/report.json` | 每帧 `checks.temporal` / `families` |
| `assets/atlas/pivots.json` | 脚底 pivot（接入时与碰撞圆心做 offset） |
| `src/fx/anim.ts` | 动画接线、`facingFlipX`、`walkCycleFrames` |
| `src/scenes/PlayScene.ts` `tryCastActiveSkill` | 技能 VFX 入口（约 L717） |
| `src/scenes/PlayScene.ts` `spawnBoss` | Boss 出场（约 L608） |
| `design/art-bible/asset-spec-v1.md` §1.1 / §3 | 技能帧与特效规格 |
| `design/official-v1/gdd-active-skill.md` §3.1 / §④ | 蓄力口径冲突 |
| `design/art-bible/asset-prep/00-asset-prep-tracker.md` | 台账（须更新 PASS 数字） |
| `design/art-bible/asset-prep/01-prompts-core-entities.md` | 批次 1 提示词 |
