# 《血月守夜》文本表终稿（narratives-spec）

> 版本：v1.0（M3-DESIGN-2 交付）· 日期：2026-08-23 · 作者：文策渊（设计策略师）
> 上游：`narrative-framework.md` v1.1（文案源头）· `world-bible.md` v1.1（专有名词/设定基线）· `content-design-outline.md` v1.4（内容 ID/超武表）· `asset-spec-v1.md` v1.1（UI 规格/帧名/进化卡裁定）· `upgrade-experience-v2.md`（进化播报触发）
> 下游：工程 M3 落 `src/narratives/narratives.ts` + 局内横幅/浮字组件（DOM 覆盖层 ADR-004）+ 图鉴/功绩 UI 文案来源
> 状态：**文本表终稿**——工程可直接按 §2 schema 落表；文案已逐条过字数/时长/触发/形式/双端约束
> 硬约束：台词总量 ≤30 条（§9 统计表）· 台词 ≤20 字 · 档案 ≤100 字 · 序章每屏 ≤3 句 · 移动单行 ≤14 字 · 移动字号 ≥16px 物理 · 专有名词拼写统一（§10）

---

## 1. 原则与口径

### 1.1 数据驱动
全部文案进 `narratives.ts` 配置表（key / text / form / durationSec / trigger / mobile），工程读取渲染，不硬编码（narrative-framework §1 原则 4）。**专有名词引用 §10 拼写表（world-bible §7 对齐）导出常量，禁止手写变体**（consistency-anchors A4）。

### 1.2 时长口径
`时长(s) = max(字数 × 0.25, 1.0)`，四舍五入至 0.1s；按形式套下限/上限：

| 形式 | 时长规则 |
|---|---|
| 顶部横幅渐隐（序章/开局） | 固定 3s（序章屏可点击跳过） |
| 底部横幅渐隐（Boss 登场） | `max(字数 × 0.25, 3.0)s`（配合霸体闪红 3s 登场表演） |
| 侧边浮字 | `max(字数 × 0.25, 1.0)s`，上限 3s |
| 中央大字 + 金描边（进化播报） | 固定 2.5s（moment 读出节奏；公式全部命中下限） |
| 结算标题 | 常驻（随结算页，直到玩家操作） |

### 1.3 双端约束
- **移动端单行 ≤14 字**：超 14 字自动折行（如卡珊德拉入场 15 字折 2 行）；桌面单行 ≤20 字。
- **移动端字号 ≥16px 物理**：设计空间 720×1280，overlay 经 `overlay-scale.ts` 整体缩放；工程须保证 `设计字号 × scale ≥ 16`，scale < 1 时按 `16/scale` 向上取整设计字号。
- 桌面字号：横幅 18px / 浮字 16px / 中央大字 32px / 结算标题 32px。

### 1.4 形式枚举（5 渲染形态）
`top-banner`（顶部横幅渐隐）· `bottom-banner`（底部横幅渐隐）· `side-toast`（侧边浮字）· `center-gold`（中央大字 + 金描边 #FFC93C）· `result-title`（结算标题）。
> 注：任务口径列「顶部横幅渐隐 / 侧边浮字 / 中央大字+金描边 / 结算标题」4 形式；Boss 登场按 narrative-framework §5 为**底部**横幅渐隐——横幅含 top/bottom 位置变体，不新增形式类。

### 1.5 z-index（与现有覆盖层协调，ADR-004）
叙事层（横幅/浮字）= **45**（HUD 40 之上、升级 50 之下）；进化播报 = **50**（升级卡关闭后 0.2s 播放）；结算标题 = 结算页内（results 60）。

---

## 2. narratives.ts schema（数据接口）

```ts
type PowerTag = 'HALLOWED' | 'SILVER' | 'BLOOD' | 'BEAST' | 'MOON';
type NarrativeForm = 'top-banner' | 'bottom-banner' | 'side-toast' | 'center-gold' | 'result-title';
type NarrativeContext = 'prologue' | 'hero' | 'boss' | 'toast' | 'evolution' | 'result' | 'event';

interface NarrativeText {
  key: string;                 // 唯一键（本表 §3~§8 的 key 列）
  context: NarrativeContext;
  text: string;                // 文案（集中此表，不硬编码）
  form: NarrativeForm;
  durationSec: number;         // 时长（§1.2 计算值）
  trigger: string;             // 触发条件（事件名/条件表达式，供事件系统匹配）
  mobile: { maxLineChars: number; fontSize: number }; // 移动单行上限 / 字号（物理 px 目标）
  exception?: string;          // 例外标注（仅薇奥莱濒死台词）
}

interface HeroArchiveText {    // 角色档案（§4，供图鉴/选人界面）
  key: string;                 // hero_<id>
  name: string; enName: string;
  faction: string; powerTag: PowerTag;
  identity: string;            // 一句话
  background: string;          // ≤80 字（加尔文 85 见 §4.4 注，待批）
  activeSkill: { name: string; desc: string };
  initialWeapon: { name: string; desc: string };
  lines: { enter: string; dying: string; death: string }; // ≤20 字/条
  unlock: string;              // 解锁条件
  exception?: string;          // 薇奥莱 dying 例外
}

interface BossArchiveText {    // Boss 档案（§5，供图鉴/结算）
  key: string;                 // boss_<id>
  name: string; faction: string; powerTag: PowerTag;
  identity: string; background: string; // ≤100 字
  enterLine: string; defeatLine: string; // ≤20 字
  map: string; drop: string;
  hidden?: boolean;            // boss_4 血月化身
}

interface EventArchiveText {   // 事件档案（§8.2，供图鉴事件页）
  key: string; name: string; text: string; // ≤100 字
  unlock: string;
}
```

字段验收：key 唯一；text 字数符合红线；durationSec = §1.2 计算值；mobile 双端约束达标。

---

## 3. 序章表（4 条；每屏 ≤3 句，P1-5 红线）

| key | 文案 | 句数 | 展示位置 | 形式 | 时长 | 触发 | 移动单行 |
|---|---|---|---|---|---|---|---|
| n_prologue_common | 血月升起，死者自墓中爬出。今夜，守夜人独守月光。 | 3 | 主菜单 → 开战前 | top-banner | 3s | 点击「开始」后进入战斗前 | 分 3 行，每行 ≤13 字 ✔ |
| n_prologue_map_graveyard | 封印的石冢在月光下渗血。亡者认得这条路——它们要回家。 | 2 | 选图后（月下墓地） | top-banner | 3s | 选图确认后 | 第一句 12 字 / 第二句 14 字（正好）✔ |
| n_prologue_map_cathedral | 钟声早已停了。彩窗映着血月，圣坛上淌着不是圣水的东西。 | 2 | 选图后（血教堂） | top-banner | 3s | 选图确认后 | 第二句 18 字折行 |
| n_prologue_map_den | 山脊上的狼嚎越过血月。它们嗅到了血的气味。 | 2 | 选图后（狼穴） | top-banner | 3s | 选图确认后 | 各句 ≤11 字 ✔ |

> 序章屏均「可点击跳过」。
> **开局横幅**：进入战斗后 5s 内顶部渐隐显示**地图序章句**（与序章屏同文案，narrative-framework §5「开局 5s（每图）」）；防重复展示见 §12 C-1。

---

## 4. 角色档案表（4 条；档案字段供图鉴/选人界面，narrative-framework §3 模板）

### 4.1 守夜人·艾德蒙 hero_edmund · HALLOWED · 默认解锁
| 字段 | 内容 |
|---|---|
| 名讳 | 守夜人·艾德蒙（Edmund the Vigilant） |
| 阵营 | 守夜会 |
| 身份 | 守夜会末代提灯人 |
| 背景 | 初代守夜人的血脉传到今日只剩他一人——提灯认血，只有他能重新点亮祖传之灯。他提着它走回千年封印之地，灯里是初代守夜人留下的最后一点圣辉。（≈66 字 ≤80 ✔） |
| 主动技 | 提灯闪耀 —— 爆发圣光，眩晕周围亡者片刻，给自己一瞬喘息。 |
| 初始武器 | 血月猎手 —— 银制月光箭。 |
| 台词 | 入场「灯还亮着，夜就还没输。」(11) / 濒死「灯芯……快尽了。」(8) / 死亡「替我……守到天亮。」(9) |
| 解锁条件 | 默认 |

### 4.2 血猎手·卡珊德拉 hero_cassandra · SILVER（半 BLOOD 血统表现层）· 通关地图 1
| 身份 | 猎杀血族的银器赏金猎人，半血裔 |
| 背景 | 她以自愿饮下的血族之血完成自我改造，换取不被血月支配的体质——代价是永远介于人与猎物之间。半血裔对银器灼烧免疫，银弩是她对血廷的投名状，银是她的驯服之刃。（≈76 字 ≤80 ✔） |
| 主动技 | 血影突袭 —— 向移动方向冲刺，路径上敌人被银刃割伤并标记，标记目标受武器伤害额外加成。 |
| 初始武器 | 银针连弩 —— 快速穿透银矢。 |
| 台词 | 入场「猎物和猎人，今夜只有一个能走。」(15，移动折行) / 濒死「我的血……也在沸腾。」(10) / 死亡「血债……清了。」(7) |

### 4.3 夜祷修女·薇奥莱 hero_violet · HALLOWED（祷言）· 通关地图 2
| 身份 | 血教堂幸存的执烛修女，以圣诗驱魔的夜祷者 |
| 背景 | 教堂沦陷那夜，她唱完了最后一首安魂曲，从血井边爬出来。从此她不再为死者安魂——她为亡者送行。（≈45 字 ≤80 ✔） |
| 主动技 | 安魂曲 —— 圣诗震荡周围空间，亡者行动迟缓，她自身的伤缓缓愈合。 |
| 初始武器 | 圣银火铳 —— 近距圣银散射。 |
| 台词 | 入场「尘归尘，血归血。」(8) / 濒死「主……不，月亮不会怜悯。」(12) **⚠️ 例外** / 死亡「让安魂曲……替我唱完。」(11) |

> **薇奥莱例外标注（narrative-framework §6 P1-6）**：濒死台词含宗教实指「主」——刻意的改口修辞（信仰崩塌瞬间），为**全游戏唯一例外**。narratives.ts 中该条 `exception: 'religious-word-exception'`；其余任何台词/档案不得出现「主/神」等宗教实指（以「月亮/圣辉」替代）。

### 4.4 狼裔·加尔文 hero_galvan · BEAST · 通关地图 3
| 身份 | 狼群中的异类，兽血诅咒的持有者 |
| 背景 | 血月之夜他出生在狼穴，被狼群养大，曾是狼王麾下的前锋。盈满之夜，狼王要踏平北境——他选择了背叛。他能在人形与狂化间切换：狼群视他为叛徒，人类视他为怪物，他只为黎明而战。（≈85 字 ⚠️ 见注） |
| 主动技 | 血月狂化 —— 短暂进入狂化：移速与伤害飙升，爪牙撕咬接触的敌人并汲取生命。 |
| 初始武器 | 狼影猎犬 —— 召唤兽影猎犬自动索敌。 |
| 台词 | 入场「月光是我的血，也是我的枷锁。」(14，正好) / 濒死「狼群……咬得更紧些。」(10) / 死亡「我终究……不是人。」(9) |

> ⚠️ **加尔文背景字数注**：narrative-framework v1.1 原文 ≈85 字，超角色卡模板「背景 ≤80 字」5 字（全局档案上限 ≤100 字未越线，narrative-framework §6）。本表保留原文（硬约束 = 与框架一致）。**待主理人拍板**：A) 接受 85 字（建议，语义完整）；B) 删「他能在人形与狂化间切换：」12 字 → ≈73 字（该信息由主动技描述补足）。

---

## 5. Boss 档案表（4 条；登场/击败台词 ≤20 字，narrative-framework §4 模板）

### 5.1 血月尊者 boss_1 · MOON · 地图 1 月下墓地
| 字段 | 内容 |
|---|---|
| 身份 | 守夜会初代成员的尸骸，被血月复活，守着封印石冢 |
| 背景 | 千年前封印血王的十二人之一，战死后葬在石冢旁。血月把他从土里拉起，扭曲了他的守护本能：他守着石冢，不准任何人靠近封印——包括来加固封印的守夜人。他忘了自己守护过什么，只记得"守住这里"。（≈85 字 ≤100 ✔） |
| 登场台词 | 「凡人，你守不住这夜。」(10) · bottom-banner · max(10×0.25, 3) = 3.0s · 触发 boss:spawned(boss_1) + 霸体闪红 |
| 击败台词 | 「……灯，交给你了。」(9) · 结算页/图鉴展示 · 触发 boss:defeated(boss_1) |
| 所属地图/掉落 | map_graveyard · XP 100 |

### 5.2 血主教·尼禄 boss_2 · BLOOD · 地图 2 血教堂
| 身份 | 叛变的教堂主教，血廷在人间的代行者 |
| 背景 | 为求永生，尼禄打开地下血井，以整座教堂的信众献祭。如今他站在井口，等着把最后一位闯入者也献进井里。（≈52 字 ≤100 ✔） |
| 登场台词 | 「圣血已污，你的祷言没有回音。」(14，移动单行正好) · bottom-banner · max(14×0.25, 3) = 3.5s |
| 击败台词 | 「井……会记得每一个名字。」(12) |
| 所属地图/掉落 | map_cathedral · XP 120 |

### 5.3 狼王·芬里厄 boss_3 · BEAST · 地图 3 狼穴
| 身份 | 兽群之王，血月兽血之力的顶点（「化身」一词专留给血月化身，P1-4） |
| 背景 | 他统一狼穴诸部，只等血月盈满之夜踏平北境。狼穴祭坛上的爪痕，是他与血月的契约。（≈43 字 ≤100 ✔） |
| 登场台词 | 「月光属于狼群。」(7) · bottom-banner · 3.0s |
| 击败台词 | 「黎明……不属于兽。」(9) |
| 所属地图/掉落 | map_den · XP 120 |
| 镜像 | 狼裔·加尔文（父与叛子，world-bible §9 角色-反派镜像表） |

### 5.4 血月化身 boss_4 · MOON · 任意地图（稀有）
| 身份 | 血月意志降临的实体——月光凝成的人形 |
| 背景 | 血月盈满至极时，月光会"落下来"行走片刻。它不守护任何封印，只是来看一眼"这个还在挣扎的世界"。（≈52 字 ≤100 ✔） |
| 登场台词 | 「我就是那轮月亮。」(8) · bottom-banner · 3.0s |
| 击败台词 | 「……下一个满月，再见。」(11) |
| 所属地图/掉落 | 任意 · 不掉通关进度；图鉴隐藏条目 + 稀有宝箱（chest） |
| 出场规则 | 4:30 后随机地图 5% 触发「月坠」预警（屏幕边缘月光泛白 + 心跳双拍）→ 降临（narrative-framework §4.4） |
| 隐藏 | 图鉴条目锁定态 = 「？？？」（见 codex-ui-spec §7） |

---

## 6. 局内点缀表（9 条；台词红线计入 5 条，narrative-framework §5）

| key | 触发 | 文案 | 字数 | 形式 | 时长 | 移动单行 |
|---|---|---|---|---|---|---|
| n_toast_first_levelup | 首次升级完成（选卡提交后 0.3s；每局仅 1 次） | 月光在回应你。 | 7 | side-toast | 1.8s | ✔ |
| n_toast_weapon_silver | 新武器解锁 · SILVER 系（升级池新武器解锁卡选中） | 银器出鞘。 | 5 | side-toast | 1.3s | ✔ |
| n_toast_weapon_hallowed | 新武器解锁 · HALLOWED 系 | 圣辉凝聚。 | 5 | side-toast | 1.3s | ✔ |
| n_toast_elite | 精英敌人（守墓者/血肉畸体/石甲狼）生成进屏；同单位仅 1 次 + 5s 冷却 | 有大家伙来了。 | 7 | side-toast + 低频重音 | 1.8s | ✔ |
| n_toast_codex | 局内 CodexTracker 首次解锁任一条目；多条目同帧合并 1 条 | 守夜日志已更新。 | 9 | side-toast | 2.3s | ✔ |
| n_boss_1_enter | boss:spawned(boss_1) | 凡人，你守不住这夜。 | 10 | bottom-banner + 霸体闪红 | 3.0s | ✔ |
| n_boss_2_enter | boss:spawned(boss_2) | 圣血已污，你的祷言没有回音。 | 14 | bottom-banner | 3.5s | ✔（正好） |
| n_boss_3_enter | boss:spawned(boss_3) | 月光属于狼群。 | 7 | bottom-banner | 3.0s | ✔ |
| n_boss_4_enter | boss:spawned(boss_4)（月坠后） | 我就是那轮月亮。 | 8 | bottom-banner | 3.0s | ✔ |

> 开局横幅（地图序章句 ×3）= §3 序章表复用（n_prologue_map_*），不重复建条目。
> 新武器 toast 只定义 SILVER/HALLOWED 两句（narrative-framework v1.1 仅 2 条）；BLOOD/BEAST/MOON 系新武器默认不弹（扩展受限见 §12 C-2）。
> 濒死（HP<30%）**无文字**（心跳加速已足够，禁重复提示，narrative-framework §5）。
> Boss 击败台词不在局内横幅弹（防与结算标题叠字）；展示于结算页 Boss 击杀条目 + 图鉴 Boss 档案（§5）。

---

## 7. 进化播报表（5 句，按 powerTag；台词红线计入 5 条，P2-5）

| key | powerTag | 文案 | 字数 | 形式 | 时长 | 命中超武 |
|---|---|---|---|---|---|---|
| n_evo_hallowed | HALLOWED | 圣辉燃尽暗影。 | 7 | center-gold | 2.5s | 炽天使之环 |
| n_evo_silver | SILVER | 银器淬火。 | 5 | center-gold | 2.5s | 血银霰弹 |
| n_evo_blood | BLOOD | 血池为你沸腾。 | 7 | center-gold | 2.5s | 血海 / 血蝠风暴 |
| n_evo_beast | BEAST | 兽血在骨中低吼。 | 8 | center-gold | 2.5s | 狼群领袖 |
| n_evo_moon | MOON | 月光凝成猎手之形。 | 9 | center-gold | 2.5s | 血月天罚 / 月全食 |

> **触发**：玩家选择进化卡并提交（EvolutionState.commit，upgrade-experience-v2 §2.4 进化必占一席 + 权重 ×5）→ 升级卡关闭后 0.2s 播放对应 powerTag 句；powerTag 取主武器（content-design-outline §3.4 超武合成表）。
> **视觉**：中央大字 + 金描边 #FFC93C；与进化卡（幽紫底 + 冷青 3px 描边 + ★★ + 「进化」标签，asset-spec v1.1 §1.6 R-B）载体不同——卡面在升级三选一，播报在提交后。

---

## 8. 结算文案与事件档案

### 8.1 结算标题（2 条；不计台词红线）
| key | 文案 | 形式 | 触发 |
|---|---|---|---|
| n_result_victory | 封印稳固·守夜完成 | result-title（结算页标题） | game:over victory=true（击杀 6:00 Boss） |
| n_result_defeat | 守夜失败。 | result-title | game:over victory=false |

> **现状冲突（工程必改）**：`src/ui/results-overlay.ts` 现用「血月退散·守夜完成」——narrative-framework v1.1 P1-7 已裁定为「**封印稳固·守夜完成**」（封印语义 + 守夜完成，呼应 world-bible §2 封印渗血）。M3 改 results-overlay 标题文案来源为 narratives.ts n_result_victory。

### 8.2 事件档案（6 条；静态设定档案，world-bible §2/§3/§5 精简版，供图鉴事件页；≤100 字，不计台词红线）

| key | 名称 | 档案（≤100 字） | 解锁 |
|---|---|---|---|
| n_event_bloodmoon_origin | 血月起源 | 千年前，血族之王阿拉里克屠尽北境三城，以万千亡魂的血浇灌永夜。十二位守夜人以十二盏圣辉提灯为锁，将他封入地脉之下。血王临死前诅咒月面——月光从此成为诅咒的通道。（≈82 字） | 首通地图 1 |
| n_event_vigil | 守夜会 | 人类守卫者：提灯守夜人、银器猎手、夜祷修女，以圣辉与银器对抗亡潮。圣辉是有限资源——每次守夜都在消耗封印的余力，这是封印渗血、守夜会衰微的根因。（≈76 字） | 首通地图 1 |
| n_event_alaric | 血王·阿拉里克 | 血族之王，被十二守夜人封印千年的存在。他的诅咒常驻月面，随月相起伏——唯有血月盈满之夜，封印最弱、亡潮最盛。（≈60 字） | 首通地图 2 |
| n_event_bloodcourt | 血廷 | 有组织的血族黑暗势力：血族贵族、血主教、圣杯侍僧、血信徒，以血术操纵亡者与人类。血教堂地下血井是血术的源头。（≈58 字） | 首通地图 2 |
| n_event_pack | 兽群 | 被血月兽血之力支配的狼群诸部，由狼王芬里厄统御。兽群袭击一切活物，只等血月盈满之夜踏平北境。（≈50 字） | 首通地图 3 |
| n_event_moonavatar | 血月化身 | 血月意志降临的实体——月光凝成的人形。它不守护任何封印，只是来看一眼"这个还在挣扎的世界"。（≈50 字） | 任意地图击杀化身 |

---

## 9. 台词总量红线统计（30/30 ✔）

**红线口径**（narrative-framework §5「全游戏局内台词 ≤30 条」）：台词 = 局内播报/角色/Boss 的 ≤20 字短句；序章句、结算标题、事件档案、档案背景为独立文案类别，不计入台词红线。

| 组 | 条数 | 明细 |
|---|---|---|
| 角色档案台词（入场/濒死/死亡 ×4） | 12 | §4 |
| Boss 登场台词 | 4 | §5 / §6 |
| Boss 击败台词 | 4 | §5 |
| 局内点缀短句（首次升级 1 + 新武器 2 + 精英 1 + 图鉴 1） | 5 | §6 |
| 进化播报（5 powerTag） | 5 | §7 |
| **合计** | **30** | ≤30 ✔ |

> **红线无余量**：当前恰 30 条。任何新增台词（如 BLOOD/BEAST/MOON 新武器 toast）必须同步裁剪等量（§12 C-2）。
> **文本条目总数**：台词 30 + 序章 4 + 结算标题 2 + 事件档案 6 = **42 条**（narratives.ts 条目级）；角色档案 4 + Boss 档案 4 = 8 个档案对象另计。

---

## 10. 专有名词拼写表（world-bible §7 对齐；narratives.ts 导出常量引用）

| 类别 | 规范拼写 |
|---|---|
| 力量 | 圣辉 HALLOWED / 银器 SILVER / 兽血 BEAST / 血术 BLOOD / 月光 MOON |
| 角色 | 守夜人·艾德蒙 / 血猎手·卡珊德拉 / 夜祷修女·薇奥莱 / 狼裔·加尔文 |
| Boss | 血月尊者 / 血主教·尼禄 / 狼王·芬里厄 / 血月化身 |
| 反派 | 血王·阿拉里克（Alaric） |
| 阵营 | 守夜会 / 血族·血廷 / 兽群 / 亡者 / 血月 |
| 地图 | 月下墓地 / 血教堂 / 狼穴 / 守夜驻地 |
| 武器 | 血月猎手 / 银针连弩 / 圣银火铳 / 狼影猎犬 等（content-design-outline §3.2 全表） |
| 主动技 | 提灯闪耀 / 血影突袭 / 安魂曲 / 血月狂化 |
| 超武 | 血月天罚 / 血银霰弹 / 炽天使之环 / 月全食 / 血海 / 血蝠风暴 / 狼群领袖 |

> 实现：拼写由 narratives.ts 常量导出（如 `NP = { HALLOWED: '圣辉', SILVER: '银器', ... }`），UI/图鉴/结算统一引用，禁止手写变体（consistency-anchors A4）。
> ⚠️ 既有待审：wpn_a_5 骨钉标枪 powerTag `BONE` 不在 world-bible §4.1 五标签内（§12 C-3，本次范围外）。

---

## 11. 双端约束清单（逐条落表校验）

| 约束 | 规则 | 校验 |
|---|---|---|
| 台词 ≤20 字 | 全部台词条目 | §4~§7 全达标（最长 15 字卡珊德拉入场） |
| 档案 ≤100 字 | 角色背景 ≤80 / Boss 背景 ≤100 / 事件档案 ≤100 | 全达标（加尔文 85 见 §4.4 注，待批） |
| 序章每屏 ≤3 句 | 序章 4 屏 | 全达标（通用 3 句，其余 2 句） |
| 移动单行 ≤14 字 | 正文单行上限，超则折行 | 卡珊德拉入场 15 字折 2 行；尼禄登场 14 字正好单行 |
| 移动字号 ≥16px 物理 | 局内台词/点缀/横幅/浮字 | 工程校验 `设计字号 × scale ≥ 16` |
| 横幅/浮字自动消失/可跳过 | 不打断操作 | 叙事层 DOM `pointer-events: none`（z-45） |

---

## 12. 待审批项与现状冲突

| # | 项 | 建议 | 影响 |
|---|---|---|---|
| C-1 | 序章屏与开局横幅同文案（地图序章句展示 2 次） | 两处保留但加配置 `show_open_banner`；真机若感重复则关闭开局横幅 | 防叠字/认知过载 |
| C-2 | 台词红线已满 30 条无余量 | 新武器 toast 仅 SILVER/HALLOWED 2 条；后续新增台词必须裁剪等量 | 扩展受限（硬约束） |
| C-3 | wpn_a_5 骨钉标枪 powerTag BONE 不在五标签内 | 移交 M1b 一致性评审（world-bible §4.1 加 BONE 或改 BEAST） | 本次范围外 |
| C-4 | 加尔文背景 85 字 vs 角色卡模板 ≤80 | 建议 A（保留原文）；可选 B 删句至 ≈73 字 | §4.4 |
| C-5 | results-overlay 胜利标题改「封印稳固·守夜完成」 | M3 工程随 narratives.ts 落地 | 现状冲突必改 |

---

## 13. 验收标准

1. narratives.ts 恰 **42 条**文本条目 + 8 档案对象；key 唯一；无硬编码文案。
2. 台词总量 **30 ≤ 30**；逐条字数/时长/触发/形式符合 §3~§8。
3. 移动单行 ≤14 字、字号 ≥16px 物理（工程 scale 校验）。
4. 专有名词全部走常量，无拼写变体（grep 过检，consistency-anchors A4）。
5. 进化播报按 powerTag 映射正确（§7 表：7 超武命中 5 句，BLOOD/MOON 各命中 2 把）。
6. results-overlay 胜利标题 =「封印稳固·守夜完成」。
7. 薇奥莱濒死台词带 exception 标注，其余条目无宗教实指。
