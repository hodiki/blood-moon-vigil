# 《血月守夜》设定一致性锚点检查表 v1.1

> 版本：v1.1（评审修订版）· 日期：2026-08-22 · 作者：文策渊（设计策略师）
> 修订依据：`review-world-narrative-v1.md`（P0×2 / P1×10 / P2×7，全部采纳）· 修订留痕见下方「版本历史」
> 上游：`plan-v1.md`（需求④ 设定一致性门控）· `world-bible.md`（设定基线）· `pillars-v1.md`（支柱基线）· `art-bible.md`（视觉编码）· `content-design-outline.md`（内容落点）
> 用途：**每批新内容过检的自检清单**——角色/武器/敌人/Boss/地图/升级项/叙事条目，在任何质量门放行前逐条勾选。
> 判定：A/B/C/D 四类全部 PASS 才放行；任一 FAIL 标注偏离 + 修复建议后打回。

---

## 版本历史

| 版本 | 日期 | 修订内容（对应评审项） |
|---|---|---|
| **v1.1** | 2026-08-22 | ① A3 血王命名扩展：哥特名 Alaric 可用（P1-3）；② A4 专有名词表补「阿拉里克」（P1-3 连带）；③ C1 血月一元论补「月光=血月之力流通的媒介」，圣辉/血术表述与 world-bible §2/§8 对齐（P1-9/P0-1 连带）；④ C 类新增 C7：新 Boss 对照 world-bible §9 角色-反派镜像表（P2-1）；⑤ B 类新增 B9：血月尊者必须带锈蚀提灯（血色光）视觉锚点（P0-2 连带） |
| v1.0 | 2026-08-21 | 初版 |

---

## 1. 检查流程

1. 新内容批次进入评审时，填写本表（内容 ID 清单 + 逐条勾选）。
2. 判定：A（命名语义）/ B（视觉编码）/ C（背景自洽）/ D（支柱符合）四类全 PASS → 放行；任一 FAIL → 标注偏离位置与修复建议，回设计侧修订。
3. 数值一致性以 §5 关键常量表为准，跨文档歧义在此仲裁。
4. 本表由设计策略师维护；主理人质量门引用结果。

---

## 2. A 类 · 命名语义锚点

| # | 检查项 | 判定 | 依据 |
|---|---|---|---|
| A1 | 内容 ID 符合 `content-design-outline §1.3` 规范（hero_/wpn_/evo_/enemy_/boss_/map_/up_/key_/codex_） | ☐ PASS ☐ FAIL | ID 规范表 |
| A2 | 所有内容带 `powerTag`（SILVER/HALLOWED/BEAST/BLOOD/MOON），且与表现一致 | ☐ PASS ☐ FAIL | world-bible §4.1 |
| A3 | 命名落在阵营词根表内（守夜会/血族/兽群/亡者/武器前缀/主动技动词意象）；血王可用哥特名（如 Alaric） | ☐ PASS ☐ FAIL | world-bible §7 |
| A4 | 专有名词拼写统一（血月/守夜会/圣辉/银器/血术/兽血；艾德蒙/卡珊德拉/薇奥莱/加尔文；阿拉里克/尼禄/芬里厄） | ☐ PASS ☐ FAIL | narrative-framework §6 |
| A5 | 无体系外命名（元素魔法/精灵/神祇/现代语） | ☐ PASS ☐ FAIL | world-bible §8 红线 3 |
| A6 | 台词/档案字数符合轻叙事限制（台词 ≤20 字、档案 ≤100 字、序章 ≤3 句） | ☐ PASS ☐ FAIL | narrative-framework §6 |

## 3. B 类 · 视觉编码锚点

| # | 检查项 | 判定 | 依据 |
|---|---|---|---|
| B1 | 敌人层级三要素编码：体型（普通 0.8~1.0x / 精英 1.4~1.8x / Boss ≥3x）+ 色相（暗红 / 幽紫 / 猩红金）+ 角饰双编码 | ☐ PASS ☐ FAIL | art-bible §4 · content-design-outline §4.1 |
| B2 | 特殊行为标记齐全：光环怪=幽紫光环 / 相位怪=半透明+残影 / 冲锋怪=蓄力红警告线 / 召唤怪=头顶符文 / 远程怪=投射红色预警 | ☐ PASS ☐ FAIL | content-design-outline §4.1 |
| B3 | 红色即危险：危险区/受击/Boss 用红；玩家冷青 `#54E6C9`；精英幽紫 `#B06AF0`；Boss 猩红金 `#FF3B3B+#FFC93C` | ☐ PASS ☐ FAIL | art-bible §2/§4 |
| B4 | 无障碍双编码：不依赖颜色区分（形状+角饰优先）；色盲替换色板可生效 | ☐ PASS ☐ FAIL | art-bible §9 |
| B5 | 双端最小实体 ≥16px（720×1280 设计空间）；描边不撞背景色 | ☐ PASS ☐ FAIL | art-bible §3/§8 |
| B6 | 地图视觉：新地图 tile/障碍色值对齐色板（室内石砖、岩地暗绿草；危险区禁全屏红晕） | ☐ PASS ☐ FAIL | art-bible §5 |
| B7 | UI 升级卡底色分型语义（裁定 R-B）：机制=蓝紫底+信息蓝描边 / 数值=琥珀金底 / **进化卡=幽紫底+冷青 3px 描边+★★ 双星徽记**；玩家侧实体（角色/召唤物）主体月银白+冷青描边常亮，敌方色只作 accent | ☐ PASS ☐ FAIL | asset-spec v1.1 §3.7 · content-design-outline §3.3 |
| B8 | 同名实体敌我区分（裁定 R-D）：召唤物与同名敌人（血蝠/猎犬）以主体色+描边区分——玩家侧月银白+冷青描边，敌方暗红；装饰红与危险红动态区分（裁定 R-C）：装饰=低饱和静态无斜纹，危险=高饱和斜纹+闪烁+白描边 | ☐ PASS ☐ FAIL | art-bible §4/§5 · asset-spec v1.1 §6 |
| B9 | 血月尊者（boss_1）必须带**锈蚀初代提灯（灯内血色光）**视觉锚点——守夜提灯被血月污染=封印渗血的具象化 | ☐ PASS ☐ FAIL | narrative-framework §4.1 · world-bible §2/§9 |

## 4. C 类 · 背景自洽锚点

| # | 检查项 | 判定 | 依据 |
|---|---|---|---|
| C1 | 血月一元论：任何超自然设定可归因于血月之力变体；**月光=血月之力流通的媒介**（圣辉=经滤月仪式净化的月光 / 血术=主动攫取的月光 / 兽血=血月兽化诅咒 / 银器=血月下凝银） | ☐ PASS ☐ FAIL | world-bible §2/§8 |
| C2 | 角色/武器/敌人力量来源与表现一致（圣辉系不主打血术武器；兽血角色不做圣辉主打） | ☐ PASS ☐ FAIL | world-bible §4.3 |
| C3 | 阵营归属清晰（守夜会/血族/兽群/亡者/血月），无跨阵营混乱 | ☐ PASS ☐ FAIL | world-bible §3 |
| C4 | 时间线静态：内容设定在同一血月夜内成立，不引入"前局改变世界观" | ☐ PASS ☐ FAIL | world-bible §5/§8 |
| C5 | 地点设定与地图玩法身份一致（墓地=基准 / 教堂=高密度回廊+血池 / 狼穴=机动山地） | ☐ PASS ☐ FAIL | world-bible §6 · content-design-outline §5 |
| C6 | 档案卡/图鉴模板字段完整（narrative-framework §3/§4 模板） | ☐ PASS ☐ FAIL | narrative-framework |
| C7 | 新 Boss 必须对照 world-bible §9 角色-反派镜像表：每个 Boss 有对应角色镜像；缺镜像则标注偏离并评审（血月化身为终极威胁，镜像豁免） | ☐ PASS ☐ FAIL | world-bible §9 · narrative-framework §7 |

## 5. D 类 · 支柱符合锚点

| # | 检查项 | 判定 | 依据 |
|---|---|---|---|
| D1 | 支柱 1（修订）：新内容不引入第二个高频操作；主动技 CD ≥12s；主动技 DPS 占比 ≤15%（关主动技可通关 Boss） | ☐ PASS ☐ FAIL | pillars-v1 §5/§6 |
| D2 | 支柱 2：升级池机制型 ≥50%（当前 85%）；单局纠结时刻 ≥3 次 | ☐ PASS ☐ FAIL | content-design-outline §6 |
| D3 | 支柱 3：特殊行为敌人 ≤2 种/地图且有明确反制；不引入"无解怪" | ☐ PASS ☐ FAIL | content-design-outline §4.1 |
| D4 | 支柱 4：随机化保持（池标签过滤 + 三选一 + 生成器）；局间/跨地图差异成立 | ☐ PASS ☐ FAIL | pillars-v1 §5 |
| D5 | 角色成型强度差异 ≤±15%（无主导角色/武器） | ☐ PASS ☐ FAIL | content-design-outline §2.6 |
| D6 | Boss 战 60~90s 判据保持（Boss HP 对齐成型 DPS；主动技计入但非必需） | ☐ PASS ☐ FAIL | enemies.md §5 · content-design-outline §4.3 |

---

## 6. 关键常量表（跨文档仲裁基准）

> 任何新内容数值与此表冲突即视为 FAIL；M1b 起所有 GDD 引用本表。

| 常量 | 值 | 来源 |
|---|---|---|
| 玩家初始 HP | 100 | upgrade-pool v0.2 |
| 玩家初始移速 | 220 px/s | upgrade-pool v0.2 |
| 伤害倍率公式 | `1 + 0.04×(等级−1) + Σ加成`（加法） | upgrade-pool v0.2 |
| 升级需求 | `need(n) = 5 + 3×(n−1)` | upgrade-pool v0.2 |
| 局时 / Boss 收束 | 6:00（360s）+ 60~90s 击杀 | PROJECT_SUMMARY |
| 同屏上限 | 桌面 400 / 移动 250 | concept §8 |
| 敌人层级经验 | 普通 1~3 · 精英 基础×3 · Boss 100~150 | enemies.md · content-design-outline §4 |
| 无敌帧 | 0.5s（接触伤害限流） | enemies.md §③ |
| 主动技占比红线 | DPS ≤15%（强化后 ~20% 封顶） | pillars-v1 §6.5 |
| 生成器预算（基准） | `1.2 × (1 + 1.2×t/360) × (1 + 0.3×sin(2πt/60))` | PROJECT_SUMMARY |
| 移动端最小实体 | ≥16px（720×1280 设计空间） | art-bible §3 |
| 触控热区 | 移动 ≥44×44px · 桌面 ≥32×32px | art-bible §6 |

---

## 7. 判定与登记

| 批次 | 内容 ID 清单 | A | B | C | D | 结论 | 偏离备注 |
|---|---|---|---|---|---|---|---|
| （新批次填写） | | | | | | | |

> 填写示例：批次「M1b 敌人批次 1」→ 内容 enemy_g2_* 5 条 → A/B/C/D 全 PASS → 放行；如 B2 FAIL → 备注「亡魂缺相位残影标记，补半透明+残影」。
