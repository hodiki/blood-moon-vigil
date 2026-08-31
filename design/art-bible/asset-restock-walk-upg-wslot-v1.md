# 《血月守夜》美术资源补货（走循环 / 武器槽 / 升级图标）

> 版本：v1.0 · 日期：2026-08-31 · 作者：TA · **主理人确认：可交美工**
> 本文是给外部美工的接稿单。v0.8 已注册帧已基本进仓；本包补三块后置件。
> 契约：`asset-spec-v1.md` v1.3.2 §1.6 / §2.5 / §2.7；纪律沿用 `asset-production-order-v1.md` §0。
> 配套：制作工单 `asset-production-order-v1.md`、朝向/步态 `ta-review-handoff.md` §3、UI 切图 `ui-redesign-handoff-v1.md`。
> 图集：走循环 → **`characters`**；`upg-*` / `wslot-*` → **`ui`**（不要打进 `ui-slots` / `ui-portraits`）。

**本包数量**

| 批次 | 内容 | 张数 | 建议顺序 |
|---|---|---|---|
| R-2 | 其余武器槽图标 | **18** | 先做（有 3 张样张） |
| R-3 | 升级池图标 | **40** | 其次 |
| R-1a | 四英雄走循环 | **8** | 与 UI 并行亦可 |
| R-1b | 五精英走循环（可选） | **10** | UI 完成后再铺 |

合计最少 **66** 张；加上 R-1b 为 **76** 张。不要出四向、不要另出移动端文件名。

---

## 0. 本包纪律（开工前自检）

1. **帧名 = 文件名 = 引擎引用名**；全小写 ASCII 连字符；零改动替换。
2. 交稿 = 逐帧 PNG：`assets/raw/<帧名>.png`（可带纯底，管线抠图）。**不要**自打 TexturePacker；不要手写 pivot。
3. 世界实体单规格；UI **只出桌面 2x**（升级 128²、槽位 64²）。移动 96 / 48 由引擎缩放，**禁止** `@48` `@96` `@2x` 一类后缀。
4. UI 三态由引擎 tint，**帧只画常态**。无文字（R-3 主动技「技能」角标除外）。
5. 走循环：**只画朝右** + 引擎 flipX。**禁止四向、禁止上下走、禁止把 `-v` 当走路。**
6. 环 / 粒子 / 光晕 / 技能冲击波不画进 PNG。
7. 描边画进原图（`outlineW = 0`）。UI 图形与底对比 ≥3:1。

入仓后 TA 跑 `process.mjs --check` 全绿才算交稿。缺帧不阻塞运行（走循环缺则继续播 idle；槽位/升级缺则 DOM 仍用旧矢量/文案）。

---

## R-2 武器槽图标 · 补 18 张（优先）

**规格**：64×64 · 图集 `ui` · 居中安全框。  
**样张（已进仓，对齐语言，不要重画）**：`wslot-missile` / `wslot-orb` / `wslot-shockwave`  
**语言**：底 `#131722` + 冷青描边 `#54E6C9` + 无文字。超武 7 张加 **进化徽记**（★ 或等价几何徽，一眼区别通武槽）。

### 通武 11（须画）

| 帧名 | 内容 | 武器 ID |
|---|---|---|
| `wslot-proj-crossbow` | 银针连弩 | wpn_a_2 |
| `wslot-proj-blunderbuss` | 圣银火铳 | wpn_a_3 |
| `wslot-proj-boomerang` | 幽灵飞刃 | wpn_a_4 |
| `wslot-proj-javelin` | 骨钉标枪 | wpn_a_5 |
| `wslot-orb-thorn` | 荆棘圣环 | wpn_b_2 |
| `wslot-aura-barrier` | 圣光壁垒 | wpn_b_3 |
| `wslot-ring-bloodpool` | 血池喷涌 | wpn_c_2 |
| `wslot-ring-holyfire` | 审判圣火 | wpn_c_3 |
| `wslot-summon-bat` | 血蝠群 | wpn_d_1 |
| `wslot-summon-hound` | 狼影猎犬 | wpn_d_2 |
| `wslot-beam-chain` | 断罪锁链 | wpn_d_3 |

已有、勿重交：`wslot-missile`（血月猎手）· `wslot-orb`（守夜之环）· `wslot-shockwave`（月蚀脉冲）。

### 超武 7（须画，带进化徽）

| 帧名 | 内容 | 进化 ID |
|---|---|---|
| `wslot-super-moonwrath` | 血月天罚 | evo_moonwrath |
| `wslot-super-silverblast` | 血银霰弹 | evo_silverblast |
| `wslot-super-seraphring` | 炽天使之环 | evo_seraphring |
| `wslot-super-totaleclipse` | 月全食 | evo_totaleclipse |
| `wslot-super-bloodsea` | 血海 | evo_bloodsea |
| `wslot-super-batstorm` | 血蝠风暴 | evo_batstorm |
| `wslot-super-packleader` | 狼群领袖 | evo_packleader |

文件名清单（18，可复制）：

```
wslot-proj-crossbow
wslot-proj-blunderbuss
wslot-proj-boomerang
wslot-proj-javelin
wslot-orb-thorn
wslot-aura-barrier
wslot-ring-bloodpool
wslot-ring-holyfire
wslot-summon-bat
wslot-summon-hound
wslot-beam-chain
wslot-super-moonwrath
wslot-super-silverblast
wslot-super-seraphring
wslot-super-totaleclipse
wslot-super-bloodsea
wslot-super-batstorm
wslot-super-packleader
```

---

## R-3 升级池图标 · 40 张

**规格**：128×128 · 图集 `ui` · 圆角底可画进帧（样张语言对齐 HUD 槽：机制蓝紫 / 数值金）。  
**禁止**使用旧矢量名 `upg-01`～`upg-12`。

### 底色分型（asset-spec §1.6）

| 类型 | 底 | 描边 | 本包哪些 |
|---|---|---|---|
| 机制型 | `#131722` | 信息蓝 `#4FC3F7` | 除下表「金底」外全部 |
| 数值型 | `#FFC93C` | 数字感深色即可 | **仅** `upg-g-1` `upg-g-2` `upg-key-tome` `upg-key-silver` |

主动技 12 张可加小「技能」角标；新武器解锁 ★ 由引擎叠，帧不必画星。超武进化卡（幽紫底 + 双星）**不是这 40 张**，本包不出。

### 全局 9

| 帧名 | 卡面主题（勿写字进图） | 底 |
|---|---|---|
| `upg-g-1` | 武器共鸣 / 总伤 | 金 |
| `upg-g-2` | 专精疾射 / 攻速 | 金 |
| `upg-g-3` | 鲜血契约 / 受击回血 | 蓝紫 |
| `upg-g-4` | 踏月而行 / 移速 | 蓝紫 |
| `upg-g-5` | 吸血 | 蓝紫 |
| `upg-g-6` | 经验磁力 | 蓝紫 |
| `upg-g-7` | 减伤 | 蓝紫 |
| `upg-g-8` | 濒死护盾 | 蓝紫 |
| `upg-g-9` | 拾取范围 | 蓝紫 |

### 武器类强化 12

全机制蓝紫。图形须能区分四类：A 弹幕 · B 环绕 · C 范围 · D 召唤。

| 帧名 | 主题 |
|---|---|
| `upg-w-a1` | A 弹幕分裂 +1 |
| `upg-w-a2` | A 弹幕穿透 +1 |
| `upg-w-a3` | A 弹幕弹速 |
| `upg-w-b1` | B 环绕数量 +1 |
| `upg-w-b2` | B 环绕转速 |
| `upg-w-b3` | B 环绕半径 |
| `upg-w-c1` | C 范围半径 |
| `upg-w-c2` | C 范围伤害 |
| `upg-w-c3` | C 范围持续 |
| `upg-w-d1` | D 召唤数 +1 |
| `upg-w-d2` | D 召唤索敌 |
| `upg-w-d3` | D 召唤存在 |

### 钥 7

| 帧名 | 主题 | 底 |
|---|---|---|
| `upg-key-scope` | 鹰眼镜片 / 射程 | 蓝紫 |
| `upg-key-holy` | 圣辉坠饰 / 范围 | 蓝紫 |
| `upg-key-tome` | 月相秘典 / 冷却 | 金 |
| `upg-key-silver` | 圣银弹丸 / 伤害 | 金 |
| `upg-key-pact` | 血契印 / 召唤数 | 蓝紫 |
| `upg-key-bone` | 兽骨图腾 / 召唤存在 | 蓝紫 |
| `upg-key-grail` | 血祭圣杯 / 范围持续 | 蓝紫 |

### 主动技强化 12

全机制蓝紫。四角色身份须可辨（提灯 / 弩与血色 / 烛与十字 / 狼耳），再分 CD / 充能 / 效果三分支。

| 角色 | CD | 充能 | 效果 |
|---|---|---|---|
| 守夜人 | `upg-a-cd-edmund` | `upg-a-charge-edmund` | `upg-a-effect-edmund` |
| 血猎手 | `upg-a-cd-cassandra` | `upg-a-charge-cassandra` | `upg-a-effect-cassandra` |
| 修女 | `upg-a-cd-violet` | `upg-a-charge-violet` | `upg-a-effect-violet` |
| 狼裔 | `upg-a-cd-galvan` | `upg-a-charge-galvan` | `upg-a-effect-galvan` |

文件名清单（40，可复制）：

```
upg-g-1
upg-g-2
upg-g-3
upg-g-4
upg-g-5
upg-g-6
upg-g-7
upg-g-8
upg-g-9
upg-w-a1
upg-w-a2
upg-w-a3
upg-w-b1
upg-w-b2
upg-w-b3
upg-w-c1
upg-w-c2
upg-w-c3
upg-w-d1
upg-w-d2
upg-w-d3
upg-key-scope
upg-key-holy
upg-key-tome
upg-key-silver
upg-key-pact
upg-key-bone
upg-key-grail
upg-a-cd-edmund
upg-a-charge-edmund
upg-a-effect-edmund
upg-a-cd-cassandra
upg-a-charge-cassandra
upg-a-effect-cassandra
upg-a-cd-violet
upg-a-charge-violet
upg-a-effect-violet
upg-a-cd-galvan
upg-a-charge-galvan
upg-a-effect-galvan
```

---

## R-1 走循环（不是四向）

**规则**：每实体恰好 2 帧：`<基帧>-walk-a` + `<基帧>-walk-b`。画布 **等于该角色 idle**。图集 `characters`。引擎 6fps 正向循环；两帧必须成对进仓，缺一帧则整段仍播 idle。

时间轴（相对 idle 基帧）：重心 hypot ≤3px（64 档）/ 4px（96 档）；脚底 ΔY 与 idle 同档（直立 0 / 四足 1px）；面积 Δ≤20%。同剪影换步，禁止 stretch-compress，脚钉死。默认朝右。

### R-1a 四英雄 · 本包必做（8 张 · 64×64）

| 基帧 | 走帧 | 角色 |
|---|---|---|
| `player` | `player-walk-a` `player-walk-b` | 守夜人 |
| `hero-cassandra` | `hero-cassandra-walk-a` `hero-cassandra-walk-b` | 血猎手 |
| `hero-violet` | `hero-violet-walk-a` `hero-violet-walk-b` | 修女 |
| `hero-galvan` | `hero-galvan-walk-a` `hero-galvan-walk-b` | 狼裔 |

img2img from 现有 idle；只换腿/重心起伏 2–4px，帽/灯/弩/烛/耳位置锁住。

### R-1b 五精英 · 本包可选（10 张 · 96×96）

UI 两包完成后再排。双角必须进剪影。

| 基帧 | 走帧 |
|---|---|
| `enemy-gravekeeper` | `enemy-gravekeeper-walk-a` `enemy-gravekeeper-walk-b` |
| `enemy-fleshmass` | `enemy-fleshmass-walk-a` `enemy-fleshmass-walk-b` |
| `enemy-stonewolf` | `enemy-stonewolf-walk-a` `enemy-stonewolf-walk-b` |
| `enemy-bonethrower` | `enemy-bonethrower-walk-a` `enemy-bonethrower-walk-b` |
| `enemy-penitent` | `enemy-penitent-walk-a` `enemy-penitent-walk-b` |

石甲狼破甲走循环（`enemy-stonewolf-broken-walk-a/b`）**本包不做**（等破甲 idle 进仓后再说）。

普通敌、Boss、召唤物、四向攻击帧：**本包不做**。

---

## 4. 本包明确不画

| 项 | 原因 |
|---|---|
| 四向走 / 上下走 / 八向 | 冻结：只 flipX |
| 用 `-v` 当走路 | `-v` = idle 呼吸 |
| 已有 3 个 `wslot-missile/orb/shockwave` | 已进仓 |
| `upg-01`～`upg-12` | 旧 Demo 矢量名，作废 |
| `key_nail` / `up_w_g1` `up_w_g2` / `up_d-*` ×8 / `mc_*` ×16 | **未冻进本 40 张**；另开包再注册 |
| 超武进化卡整卡（幽紫底 ★★） | 进化卡不是 `upg-*` |
| `codex-event-*` / `chest` | 仍后置 |
| 普通敌走循环、Boss 走循环 | 非本包 |
| S-3 滤月壁面 | 跳过 |
| 移动端第二套尺寸 | 运行时缩放 |

---

## 5. 交货与验收

```
美工：assets/raw/<帧名>.png
  → TA：node process.mjs <帧名…> && node pack.mjs ui   （R-2/R-3）
         node process.mjs <帧名…> && node pack.mjs characters   （R-1）
  → node process.mjs --check 全绿
```

| 包 | 验收 |
|---|---|
| R-2 | 18 帧在 `assets/frames/`；与已有三槽同一套底/描边；超武 7 张有进化徽 |
| R-3 | 40 帧；金底恰好 4 张（g-1 g-2 key-tome key-silver）；角色主动 12 张可辨角色 |
| R-1 | 成对；`checks.temporal.ok`；朝右；脚钉死 |

走循环、`upg-*`、未接 HUD 的 `wslot-*` 进仓后即可被管线打包；局内三选一贴图、14 武器槽 DOM 扩位由 TA 另排，**不挡美工交稿**。

---

> 《血月守夜》美术组 · asset-restock-walk-upg-wslot v1.0 · 2026-08-31
