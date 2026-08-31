# C-1～C-3 帧名冻结表（ui 图集 · 35 帧）

> 版本：v1.0 · 日期：2026-08-31 · 作者：像素君（UI 设计师 / AI 侧）· 供外部美工接稿
> 上游：ui-redesign-handoff v1.1（§3.1 切图规范 / §5 契约缺口）、asset-production-order v1.0（C 批）、gdd-talent-tree v1.0（§3.2/§④）、gdd-exclusive-weapons v1.0（尾章 + 表 T-1）。
> 冻结声明：本表帧名**写死即冻结**，随下一轮进 `frame-registry` 与 `content-id-frame-map`（升 v1.2）；**先注册后制作，未注册不接稿**（工单 §6 铁律）；同名零改动替换。
> 全表共性：图集意向原为 **ui**；工程已拆包，本表 35 帧落地 **`ui-slots`**（桌面 64 / 移动运行时 48）。三态由引擎 tint 承载，**帧只画常态**；桌面 2x 出档 64（raw 可 128）；带 alpha PNG，禁垫底。

## C-1 树界面节点图标 · 决议：方案 B（按节点，22 帧）

> 选 B 理由（一句话）：帧名与 `treeState` 节点 ID 一一映射（引擎零对照表）、逐节点独立图形对齐已验收的 P0-1 设计稿双编码可读性、P1-3 缩小复用时 Q-b/Q-d/Q-s1 各自可辨；较方案 A 仅 +1 帧。

### 质变 ×11（词根色余辉金 #FFC93C，引擎 tint）

| 帧名 | 用途一句话 | 尺寸（桌面 2x / 移动 1x） | 图集 |
|---|---|---|---|
| `tree-q-a` | 树根「认灯」宿主节点（默认习得、永不熄灭） | 64×64（2x 出档 128）/ 48×48（1x） | ui |
| `tree-q-b` | 伴灯：开局自带所选招专武的配对共鸣通武 | 同上 | ui |
| `tree-q-c` | 残焰托誓：HP 归 0 复活一次（50%） | 同上 | ui |
| `tree-q-d` | 携行旧兵：预选 1 把已解锁通武入场 | 同上 | ui |
| `tree-q-e` | 再燃：复活次数 1→2（前置 Q-c） | 同上 | ui |
| `tree-q-f1` | 首猎之赏：首个精英击杀 +1 次 offer | 同上 | ui |
| `tree-q-f2` | 二赏：首猎再 +1 次 offer（前置 f1） | 同上 | ui |
| `tree-q-f3` | 三钟：首猎第三次 offer（前置 f2） | 同上 | ui |
| `tree-q-s1` | 银炉预热：开局 30s 伤害/攻速 +20% 窗口 | 同上 | ui |
| `tree-q-s3` | 遗言余烬：首死掉落余烬宝石 / 终局折算 +2 余辉 | 同上 | ui |
| `tree-q-s4` | 双灯并祀：耗 1 次抽卡换落选专武衍生卡 P4 前移 | 同上 | ui |

### 属性 ×10（对齐天赋树 A-1～A-10，词根色冷青 #54E6C9，引擎 tint）

| 帧名 | 用途一句话 | 尺寸 | 图集 |
|---|---|---|---|
| `tree-a-atk` | 攻击 +1~2 基础伤（A-1） | 64×64（2x 出档 128）/ 48×48（1x） | ui |
| `tree-a-dmg` | 伤害 +2%（A-2） | 同上 | ui |
| `tree-a-aspd` | 攻速 +2%（A-3） | 同上 | ui |
| `tree-a-cdr` | 冷却 −3%（A-4） | 同上 | ui |
| `tree-a-exp` | 经验获取 +5%（A-5） | 同上 | ui |
| `tree-a-magnet` | 磁力 +20px（A-6） | 同上 | ui |
| `tree-a-hp` | 生命 +15（A-7） | 同上 | ui |
| `tree-a-spd` | 移速 +2%（A-8） | 同上 | ui |
| `tree-a-heal` | 治疗效能 +10%（A-9） | 同上 | ui |
| `tree-a-pickup` | 拾取半径 +10px（A-10） | 同上 | ui |

### 顶点 ×1

| 帧名 | 用途一句话 | 尺寸 | 图集 |
|---|---|---|---|
| `tree-peak` | 四角色支线顶点「同袍之诺」共用（×4 同图） | 64×64（2x 出档 128）/ 48×48（1x） | ui |

## C-2 圣物背包图标 ×5

> 定位：背包/图鉴静态图标；**不是**局内 `relic-<slug>` 演出覆盖帧（那 5 帧走 B-5 effects 图集，勿混淆）。符号锚点对齐 B-5 主体符号。

| 帧名 | 用途一句话 | 尺寸 | 图集 |
|---|---|---|---|
| `relic-icon-mooneclipse` | 月蚀之陨（MOON）：全场月光脉冲眩晕背包图标 | 64×64（2x 出档 128）/ 48×48（1x） | ui |
| `relic-icon-bloodtide` | 血海退潮（BLOOD）：全场减速 6s 背包图标 | 同上 | ui |
| `relic-icon-twelvelamps` | 十二灯誓约（HALLOWED）：灯环灼烧+承伤−20% 背包图标 | 同上 | ui |
| `relic-icon-silvertide` | 银潮汐（SILVER）：银质灼烧+落场银雨背包图标 | 同上 | ui |
| `relic-icon-wolfspirit` | 狼灵巡夜（BEAST）：先祖狼灵横扫背包图标 | 同上 | ui |

## C-3 专武徽记 ×8

> 与立绘 slug 一一对应（立绘帧名 `exw-card-<slug>` 待 S-1 冻结）；取色按 ui-handoff v1.1 **表 T-1**；**不画光晕**（底光走 DOM 层 CSS 渐变，wglow 已裁定取消）。

| 帧名 | 用途一句话 | 主题色（T-1） | 尺寸 | 图集 |
|---|---|---|---|---|
| `exw-emblem-lantern` | 破旧提灯徽记（卡面/武器槽/图鉴） | 暗金（#FFC93C 压暗变体） | 64×64（2x 出档 128）/ 48×48（1x） | ui |
| `exw-emblem-revolver` | 圣徒左轮徽记 | 银白 #E8F0FA | 同上 | ui |
| `exw-emblem-twinblade` | 血契双刃徽记 | 血橙红 #FF3B30 | 同上 | ui |
| `exw-emblem-longbow` | 月痕长弓徽记 | 电光蓝 #4FC3F7 | 同上 | ui |
| `exw-emblem-bell` | 安魂圣铃徽记 | 纸白 #F2F5F9 高透明派生 | 同上 | ui |
| `exw-emblem-cross` | 圣辉十字徽记 | 亮焰金（#FFC93C 提亮焰心） | 同上 | ui |
| `exw-emblem-axe` | 葬仪巨斧徽记 | 暗血红 #7E1E1E | 同上 | ui |
| `exw-emblem-horn` | 月啸号角徽记 | 青绿 #43D17C 低饱和派生 | 同上 | ui |

## 复用与边界声明

1. **P1-3 开局树来源徽记**：直接复用 C-1 `tree-q-b` / `tree-q-d` / `tree-q-s1`（引擎缩小档 + tint），**不另开帧名**。
2. 图鉴轻联动词根色「幽蓝（月）」已裁定映射电光蓝 `#4FC3F7`（主理人 2026-08-30），相关 tint 取值不再依赖新 token。
3. 徽记内图形主体对比 ≥3:1；`tree-a-*` 与 `tree-q-*` 靠形状区分（形状优先于颜色的双编码红线）。
4. 本表 35 帧入工程图集 **`ui-slots`**（桌面出档 64×64；移动 48 为同一 PNG 运行时缩放，asset-spec §2.5 不另出档）。512 立绘已拆到 **`ui-portraits`**，勿再打进 `ui`。
5. 提交格式与验收：asset-production-order §4 + asset-spec §5.1 十四项。
   文件名 = 冻结帧名 → `assets/raw/<帧名>.png`。入仓后 `process.mjs` 再 `pack.mjs ui-slots`。

---

> 《血月守夜》UI 侧 · ui-frame-freeze-c1-c3 v1.0 · 像素君 · 2026-08-31
