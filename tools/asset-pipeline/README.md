# 《血月守夜》AI 生图后处理管线（asset-pipeline）

> 版本：v0.9（守誓 idle / 走 / 技能 128 已过 · 魔化 idle 128 已过 · EXPLICIT 已切 · 近邻）· 2026-09-18 · 契约：asset-spec-v1.md + frame-registry.json
> 职责：AI 原图 → 边缘洪水抠图 → 族共享缩放 + 脚底对齐 → 同色相明度阶量化 → 单帧+时间轴校验 → 图集打包
> 128 转交：`design/art-bible/ta-combat-128-handoff-v1.md`。自检：`node combat-128-verify.mjs`

## 一、资产放哪（重要）

| 目录 | 内容 | 谁放 |
|---|---|---|
| **`assets/raw/<帧名>.png`** | **AI 生成原图（放这里）**，命名必须 = 契约帧名（如 `player.png`、`enemy-gravekeeper-v.png`） | 你（AI 生图后命名放入） |
| `assets/frames/<帧名>.png` | 管线处理后的成品帧（自动生成，勿手改） | 管线 |
| `assets/atlas/<图集>.png + .json` | 打包后的图集（自动生成） | 管线 |
| `assets/report.json` | 每帧验收报告（自动累加） | 管线 |

> 帧名清单：`node process.mjs --list` 可查看全部契约帧名与尺寸。
> 命名错了会报 `UNKNOWN_FRAME`——帧名是引擎引用名，**改名即毁契约**。

## 二、用法

```bash
cd tools/asset-pipeline

# 1. 处理指定帧（从 assets/raw/ 读，写 assets/frames/）
node process.mjs player enemy-zombie
# 只重跑一帧、不带同族 walk/skill（色修 idle）
node process.mjs --solo hero-cassandra

# 2. 批量处理 assets/raw/ 下全部已识别帧
node process.mjs --all

# 3. 列出全部契约帧名 + 尺寸
node process.mjs --list

# 4. 只校验已有产物（不重处理；无帧名 = 全部成品 + 时间轴）
node process.mjs --check
node process.mjs --check player

# 打包图集（characters / effects / ui / ui-portraits / ui-slots）
node pack.mjs

# 6. 校验已打包图集（≤2048² / JSON 数组格式）
node pack.mjs --check
```

## 三、管线做了什么（6 步）

```
AI 原图（512² 即可，可带背景）
  → ① 抠图：优先用原图 alpha；无 alpha 时从画布边洪水填充，只清连到边的底
       （tile/装饰/贴花类帧跳过抠图，直接铺满）
  → ② 安全框（P-1 + P-6）：裁紧包围盒 → **同一动画族共用 contain 缩放**（按能装下最大姿势的 scale，矮姿势留边，不再各自撑满）→ lanczos3 → **脚底对齐**（不透明 maxY 贴画布 −5% 边距，水平包围盒居中）
       「画布 − 2×描边宽 − 2×5%边距」；随后硬化 alpha（<160→0）
  → ③ 同色相明度阶量化（P-5）：14 token 锚 + §2.2 派生族（酒/巡夜/肤/橄榄/骨灰）；角色禁止草地 token
  → ③.5 描边后置（P-3）：**外部 AI 轨关闭**（`outlineW = 0`）。精英/Boss 身份靠体型 + 双角/独有剪影；程序剪影兜底仍可自绘描边
  → ④ 导出契约帧 PNG（RGBA 透明）
  → ⑤ 验收：尺寸 / 透明 / 填充边距（P-2）/ L* 分治（P-4）/ **时间轴门禁（P-6：重心 / 脚底 / 面积，对 base↔-v/skill/entrance）**
```

## 四、验收标准（report.json 中的 checks）

| 检查 | 标准 | 豁免 |
|---|---|---|
| size | 精确到契约尺寸（§2.2 表） | — |
| alpha | 帧非全透明、RGBA | — |
| margin | **填充**包围盒（不含描边环）≤ 帧 90% | 全幅贴图类帧 |
| luminance | 玩家/召唤物：须明显亮于普通敌（高亮≥3% 或均 L* 高于敌潮基线）。暗红普通敌豁免。精英/Boss：L* 不强制 | 背景类帧（tile/moon/vignette） |
| outline | 外部 AI 轨不画身份描边。精英靠体型+双角，Boss 靠独有剪影 | 程序剪影兜底仍可自绘 |
| temporal | **按变体分档** vs base。idle `-v`：重心 hypot ≤2/3/**4**/4px（64/96/**128**/Boss）、脚底 ΔY=0（直立）/1（四足或幽灵）、面积 Δ≤15%（犬科 20%）。`skill-*` / `-tombstone`：hypot 6/8/**12**/12、脚底 +1px、面积 25%。`-broken`：同 skill 档、面积 30%。`-walk-*`：hypot 3/4/**6**/6、脚底同 idle、面积 25%。`-entrance`：hypot 12/16/**24**/24、脚底 ≤2px（Boss 3）、面积 30% | 全幅贴图类帧；无 base 则跳过 |
| pivot | 写入 `report.json` + `atlas/*.json` 的 `meta.framePivots` + `atlas/pivots.json`（脚底归一化）。**不写** `frames[].pivot` | Phaser 会自动 setOrigin，会打乱现有碰撞圆心 |

> 玩家须明显亮于普通敌（银发/金属可当高亮）。压饱和大衣走 §2.2 派生族，不再要求「银主体」。
> 单帧 PASS 但时间轴 FAIL → 整帧 FAIL。姿态差过大（面积/重心）需重绘，管线不能补。

## 五、目录结构

```
tools/asset-pipeline/
  package.json          # 依赖（sharp）
  tokens.mjs            # 14 token 色相锚 + §2.2 派生族（酒/巡夜/肤/橄榄/骨灰；角色禁草地）
  tokens.test.mjs       # 案 A 量化自检（node tokens.test.mjs，不碰 raw）
  frame-specs.mjs       # 帧名 → 尺寸/图集 映射（契约基准）
  process.mjs           # 主入口：洪水抠图→族共享缩放+脚底对齐→量化→单帧+时间轴校验
  combat-128-verify.mjs  # 评 C 画布自检（不写 frames/）
  layout.mjs            # P-6：族名 / 共享缩放 / 脚底对齐 / 分档时间轴门禁 / pivot；P-7：128 档
  layout.test.mjs       # P-6 门禁自检（node layout.test.mjs，不碰 raw）
  pack.mjs              # binpack 图集打包（TexturePacker JSON 数组格式；pivot 在 meta）
  selftest.mjs          # 自检：生成模拟原图跑通全链路（会覆盖 raw 占位，勿对正式原图跑）
```

## 六、自检记录

2026-08-23 首轮自检：5 张模拟原图 → 5/5 PASS。  
2026-08-23 v0.2：P-1~P-4（安全框 + 填充边距 + 描边必做后置 + L* 分治）。  
2026-08-24 v0.4：P-5 修「管线破碎」——14 精确 hex 最近邻把银灰中间调吸进草叶；全局抠底把暗褶抠穿；nearest 降采样把抖动打成椒盐。

2026-08-25 v0.5：P-6 修「入局鬼畜」——每帧独立 contain 撑满 + 垂直居中导致脚底乱跳。同族共享缩放、脚底对齐、时间轴门禁。pivot 写 meta.framePivots / pivots.json，禁止 frames[].pivot。

2026-08-25 v0.5.1：时间轴按变体分档（idle 严 / skill·walk·entrance 宽）；幽灵脚底 1px；`--check` 不再双打印。批次 1 重校验 **PASS 41 / FAIL 17**（FAIL 全是姿态内容）。

2026-09-10 v0.6：评 C。`sizeBand(128)` 独立档（64 的 2×）。`COMBAT_128_LOCK_PLAN` 锁稿日才写进 EXPLICIT。128 角色帧 `resizeKernel=nearest`。现网 64 不切。自检 `combat-128-verify.mjs`。

2026-09-10 v0.7：守誓 idle 128 过。`hero-violet` / `-v` EXPLICIT 128 nearest。走 / 技能显式留 64。现网 PNG 为 from-a 入盒原像素，未再量化。

2026-08-26：批次 2 环/弹体/标记走 `isCenteredFxFrame`（画布正中，不套角色脚底对齐）。

修复记录：
- tile 类帧误抠成空 → `isFullBleedFrame` 跳过抠图
- 暗红精英 L* → 现按 P-4 分治（普通敌豁免，精英可用描边豁免）
- contain 铺满再外扩描边导致边距 FAIL → 改为先安全框再描边
- 角色帧椒盐/草斑 → 同色相明度阶 + 低彩度走银阶 + 禁草地 token
- 暗褶破洞 → 边缘洪水抠图（不再全局按底色抹）
- 降采样噪点 → `lanczos3` 后再硬化 alpha、量化
- 走路抽搐 → P-6 族共享缩放 + 脚底对齐；面积/重心超标标 FAIL 交重绘
