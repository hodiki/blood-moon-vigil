# 身份包验证 · 第一例（Vf1 · 单源派生）

> 2026-09-10 · **账本（第一例已做完 A/B，C 大部分过）。禁止当新角色开工卡。** 执行抄 `combat-identity-chengfa-v1.md`。  
> **成法全文（可复用）：** `combat-identity-chengfa-v1.md`  
> 调研：`combat-identity-pack-v1.md` · 停手：`combat-identity-drift-v1.md`  
> 本文件只是 **Vf1 第一例账本**，不是成法本身。走循环实验另开 `identity-validate-vo-walk-v1.md`（E2 **已过** S3c-b），不并进本表。  
> 「D 本例不上」= 这一例先走完 A→B→C，不是成法里没有 LoRA。Krea 无稳参考时的 LoRA 分支写在成法 §5。  
> 不写 `assets/frames/`。过关件现锁 `characters/violet-fallen/`。C 试 13–46 仍在 `review-identity-vf1/`（不搬）。过程 park 仍在 `_park/identity-vf1/`。未点名不 Queue。

**状态：A 走通。B-lo **已过**。C 提示词 i2i / 骨架 i2i **未过**。C I2V SVD **未过（停）**。C Wan 1.3B **未过（停）**。C Wan I2V 14B 枪 A **主理人：人锁、动太小，初步验证**。枪 B **已出**（张臂非叉腰）。Krea t2i 扩角 **主理人：约 80–90%，不用 i2i**（`vf1-krea2-20260911`）。E1 Identity Edit **主理人 2026-09-11：大部分过**（C1、C3 有效；C2 类小幅度可能失效）。原扩角词仅参考。H3 / Wan 枪 C 未点名不开。不写 `frames/`。**

---

## 1. 意见：新角色也该单源派生

后续若还要新人，**单源派生比「剪影、立绘、色键各锁一次再对齐」更合适。** 本例按这个验，验过就写成默认成法。

| | 单源派生 | 三层各锁再调和 |
|---|---|---|
| 新人怎么开始 | 先过一张全身图，全家从它长出 | 先过三张可能互相打架的纸 |
| 和社区元素库 | 同构：先入库一张（或同人多角度） | 不同构：三个作者 |
| 本项目已见的坑 | 印戳仍可能换件（B 轨自己的风险） | 魔化领 / 手套 / 发已经打架 |
| 换皮肤、一体两面 | **两张第一图 = 两份包** | 容易在一份包里塞两套衣 |

三层仍要交：剪影（远认）、色键（战斗色面积）、立绘/卡（认人）。但它们是 **图1 的派生**，不是三个独立锁。  
一体两面（守誓 / 魔化）= 两个第一张图，两份包，不是一张图听三套纸。

本例只回答：从图1 能不能长出卡、128、两个姿，且零件还在。答得了，成法固定。答不了，改 C 轨，不换图1 碰运气。身份 LoRA 不当前默认作者；C 像素变换走不通时成法 §5.1 允许它当最终手段（最低优先，不叫 C 过）。

---

## 2. 本例范围

| 做 | 不做 |
|---|---|
| 只认 Vf1（及步 0 之后的图1′） | 听 F-3 / E1 / `gpt-e` / 甲3-A |
| 验证 ① 零件 ② 动作不乱变 ③ 卡+战斗同源 | 插回现网、新帧名进 `frames/` |
| 两枪封顶 / 每步过了才下一步 | 无限换种子、IPA+OpenPose、WAI+Krea 同 Queue |
| 过程进 park | PixArFK 当作者、硬切绘画大图当 128 |

第一张图：

`assets/ui-menu/preview/archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T13-48-06-229Z/comfy_lan_style_vf_wai_00001_.png`

过目根：`characters/violet-fallen/`（A/B 过关件）· C 试仍在 `assets/ui-menu/preview/locked/review-identity-vf1/`（13–46）  
过程：`assets/ui-menu/preview/locked/combat-64/_park/identity-vf1/`

---

## 3. 零件表（从图1 抄，未减脏）

过目指。不是提示词作文。

| # | 零件 | 图1′（去脏后） |
|---|---|---|
| 1 | 双角 | 黑根，红尖 |
| 2 | 眼 | 红，须能指 |
| 3 | 发 | 墨色长卷，过肩 |
| 4 | 肤 | 苍 |
| 5 | 裙 | 黑礼裙，抹胸 + 蕾丝 bib 高领 |
| 6 | 手套 | 黑蕾丝。原图到前臂；图1′略长到肘，已知小漂，不换件 |
| 7 | 开叉 | 高开叉，里衬红 |
| 8 | 鞋 | 红高跟 |

脏已减：沙漏、碎带拟眼。不列入零件。

---

## 4. 计划与跟踪

| 步 | 轨 | 工 | 过关 | 状态 | 落盘 |
|---|---|---|---|---|---|
| 0 | 补强 | 只减沙漏、碎带拟眼 → **图1′** | 还是她；脏没了；没长新衣 | **已做** | `characters/violet-fallen/identity/source/vf1-clean.png` |
| 1a | A | 零件表以图1′为准（本文 §3） | 能指，无第二套领/手套 | **已写** | 本文 §3 |
| 1b | A | 角色卡 = 图1′ 胸像裁 | 裁，不另抽 | **已做** | `02-card-bust.png` |
| 1c | A | 剪影 = 图1′ 压实心黑 | 派生，不另抽 | **已做** | `03-silhouette-from-clean.png` |
| 1d | A | 色键 = 图1′ 压大色块 | 派生，不另抽 | **已做** | `04-color-key-from-clean.png` |
| 2a | B | 图1′ 夜空底 → 带眼硬色块印戳 | 零件在；两枪封顶 | **已打两枪** | 印戳 park 见 §6 |
| 2b | B | 近邻入盒 128 | 能指零件；换头/换裙/没角 = 废 | **B-lo 已过** | `07-blo-128.png` · `12-idle-blo-passed-128.png` |
| 3a | C | 过关印戳 i2i 姿 1（叉腰）→ 近邻 128 | 只改姿 | **未过**（i2i） | `15-c1-stamp-and-128.png` |
| 3a′ | C | E1 Identity Edit 叉腰 | 画面向指令 · 满降噪 | **大部分过** | `review-exp-e1/04` · `07` |
| 3b | C | 过关印戳 i2i / Identity Edit 换重心 | 只改姿 | **未过**（幅度过小） | `18-c2` · `review-exp-e1/17` · `20` |
| 3c | C | I2V：已过印戳 → 8 帧 → 抽 3 / 7 | 时间轴还是她；姿有变更好 | **已出 · 未过目** | `36-c-i2v-f1-to-f8.png` |
| 3d | C | E1 Identity Edit 走接触（C3） | 预看，不替代 E2 | **有效**（主理人） | `review-exp-e1/23` |
| 4 | 裁定 | 2+3 过 → 成法固定进总则 | 见成法 §6 | **未全绿**（E1 部分） | — |

D 轨成法里有（`combat-identity-chengfa-v1.md` §4–§5）。**本例先不上 D**。C 静姿作者已换成 Identity Edit（E1 大部分过）。**E2 走循环已过**（2026-09-12 · S3c-b），账本 `identity-validate-vo-walk-v1.md`，不是本文件。E1-b 只是静姿小幅度失效时的可选补救（叠骨架 LoRA），主理人点名才开，不是加种子。下一条实验是 **E3**（像素原生探针），待点名。

---

## 5. 怎样算本例成功（固定成法）

| 需求 | 过 |
|---|---|
| ① | 图1′、卡、剪影、色键、128、两个姿，能指同一张零件表 |
| ② | 两个姿相对 128 idle 不换头、不换衣、不全身乱长 |
| ③ | 卡来自裁；战斗来自降阶；没有第三张「另一个她」 |

过了：总则写「新人默认单源派生」；本文件状态改 **已过（成法）**。  
不过：在本文件记哪一步、哪一类漂（换人 / 换件 / 乱变形），只修那一轨。

---

## 6. 过目记录

| 日 | 步 | 结果 | 记 |
|---|---|---|---|
| 2026-09-10 | 开例 | 方案立 | 第一张 = Vf1。单源。已锁可重做 |
| 2026-09-10 | 0 | 去做脏 | GenerateImage 只减沙漏+碎带。人/裙/红高跟在。手套略长到肘，记小漂 |
| 2026-09-10 | 1 | A 派生 | 卡裁、剪影压黑、色键压块。都从图1′。未另抽 |
| 2026-09-10 | 过目 | A 无大问题 | 主理人：裁剪本身看着无大问题。B 先不推进 |
| 2026-09-10 | 2 | B 两枪满 | 图1′ 落到夜空 `05-ref-void-512x1024.png`。Krea i2i，Euler+simple，8 步，CFG 1。B-lo denoise 0.48 seed 2026091001；B-mid 0.58 / 2026091002。未听 E1 / F-3。未第三枪 |
| 2026-09-10 | 2b | 入盒重切 | 第一刀把浅夜空光晕当成人，128 缩成点。同印戳重切（种子生长抠人），不是新枪 |
| 2026-09-10 | 过目 | B-lo 较好 | 主理人：印戳与 128 一致性较高。对照卡疑似丢像素 |
| 2026-09-10 | 2b | 入盒补洞 | 蛀孔是抠图把近墨裙打成体内洞，不是印戳缺件。同印戳补 4554 洞再近邻。不是新枪 |
| 2026-09-10 | 过目 | B-lo **过** | 主理人点过。idle = `12-idle-blo-passed-128.png` + 印戳 `12-idle-blo-passed-stamp.png` |
| 2026-09-10 | 3 | C 两姿 | 底 = 过关 B-lo 印戳。C1 denoise 0.40 叉腰；C2 0.36 换重心。Krea i2i，未加 OpenPose，未叠 IPA。未写 frames/ |
| 2026-09-10 | 过目 | C **未过** | 主理人：没改动作，反倒改了脸。发和角基本锁住。其它元素基本锁住 |
| 2026-09-10 | 过目 | 脸漂分层 | 主理人：脸漂主要在印戳上可见；128 只是呼吸级脸像素 |
| 2026-09-10 | C | DWPose idle | 已过印戳抽骨架。`20-c-dwpose-from-idle.png`。Krea 骨架槽仍未装，不能改姿 |
| 2026-09-10 | C | Wan 1.3B 枪 B | 紧词 + CFG 4 + crop none。prompt `3c63f93d-a3cc-41c4-99bb-0ca409bed0e2`。助理：短角叉腰更贴词，灰棚闭眼无手套，仍换人。不第三枪 1.3B |
| 2026-09-10 | D | 换档 14B fp8 | GPU「D 好了」：`wan2.1_i2v_480p_14B_fp8_scaled`。SVD/1.3B 已进 `_park_models`。共用三件留 |
| 2026-09-10 | 过目 | Wan 14B 枪 A | 主理人：远好于 SVD / 1.3B。角色基本锁住。动作幅度太小。只算视频模型初步验证。下一刀加幅，不换种子碰运气 |
| 2026-09-10 | C | Wan 14B 枪 B | 大动作叉腰词 + CFG 6 + 负向垂手。seed 2026091015。prompt `3a3d655d-0b8e-4235-ae28-4369c91f8cfd`。助理：人仍锁；臂张开，不是叉腰。不写 frames/ |
| 2026-09-10 | C | A 节点过、第一枪红 | 握手 12:30。`Krea2ControlApply` 非空。LoRA 文件在。i2i+facok 在 Loader 要 `(6144,128)` 扩展投影，thedeoxen 没有。目标骨架已画：`21-c-dwpose-akimbo.png` / `22-c-dwpose-shift.png`。等 A2 Ostris。不抬 denoise |
| 2026-09-10 | C | A2 节点过、合法两枪已出 | Ostris `TextEncodeKrea2OstrisEdit` / `Krea2OstrisEditModelPatch` 非空。未下 edit LoRA、未挂基础图（对）。印戳 i2i denoise 0.40 + image1=骨架 + `LoraLoaderModelOnly` 0.85。C1 seed 2026091007；C2 2026091008。未走 EmptyLatent。助理：两枪仍垂手；C1 夜空有麻点。过目先看印戳。不抬 denoise |
| 2026-09-11 | Krea t2i | 扩角成片 | 主理人：不用图生图。抽零件后大量改词。一致性约 80–90%。原 `prompts.md` i2i 词仅参考、不可用。结构：定义 → 姿/镜头 → 体型 → 零件 → 强调。鞋必须黑高跟。成片 `tools/comfy-lan/workflows/vf1-krea-lora/vf1-krea2-20260911/`。不当 C 过，不替代已过 B-lo |
| 2026-09-11 | E1 | C2 v2 + C3 一枪 | 画面向提示词。C2 v2 A `c609d26c-aa9d-43cc-a17d-8ef99b99d396` seed 2026091108；B `d2803b04-9bdc-469c-b8ff-ecce09c3b36a` seed 2026091109。助理：仍无抬踵屈膝；枪 A 画幅左侧略沉。C3 A `d3827cbe-bd90-442e-9b80-4da432da97b6` seed 2026091106。助理：侧 3/4 向右迈步可读，多地面投影。过目 `review-exp-e1/` 的 `17 / 20 / 23`。不写 frames/ |
| 2026-09-11 | 过目 | E1 **大部分过** | 主理人：C1、C3 有效。C2 类动作幅度过小或与原图区别不明显的可能失效。提示词须视觉描述，不要物理描述。不成全绿。不写 frames/ |
| 2026-09-12 | E2 | **已过 · 另账** | 走循环不记本文件。见 `identity-validate-vo-walk-v1.md` · `review-exp-e2/18-e2-summary.md`。现网 `hero-violet-walk-*` 128（S3c-b） |

---

## 7. B 过目（等人 · 两枪已满）

先看对照卡，再看 128 原大。路线图：`combat-identity-chengfa-v1.md` §1.1 / §6.1。

过目根：A/B 过关件 `characters/violet-fallen/` · C 试 13–46 仍在 `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\`

| 看什么 | 完整路径 |
|---|---|
| **B-lo 对照卡（先看这张）** | `characters/violet-fallen/combat/idle/08-blo-stamp-and-128.png` |
| **B-mid 对照卡（先看这张）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\11-bmid-stamp-and-128.png` |
| B-lo 印戳 | `characters/violet-fallen/combat/idle/06-raw-blo.png`（过关印戳另见 `stamps/idle-blo.png`） |
| B-lo 128 | `characters/violet-fallen/combat/idle/07-blo-128.png` |
| B-mid 印戳 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\09-raw-bmid.png` |
| B-mid 128 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\10-bmid-128.png` |
| 夜空底（i2i 输入） | `characters/violet-fallen/combat/idle/05-ref-void-512x1024.png` |
| 图1′ | `characters/violet-fallen/identity/source/vf1-clean.png` |
| 图1 原片 | `characters/violet-fallen/identity/source/vf1-raw.png` |
| B-lo park 原出 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T02-11-45-047Z\comfy_lan_vf1_lo_00001_.png` |
| B-mid park 原出 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T02-12-01-213Z\comfy_lan_vf1_mid_00001_.png` |

助理对照零件表（**不是过**；过只听主理人）：

| # | 零件 | B-lo 印戳 | B-lo 128 | B-mid 印戳 | B-mid 128 |
|---|---|---|---|---|---|
| 1 | 双角 · 黑根红尖 | 在 | 能指角 | 更偏通红 | 能指角 |
| 2 | 红眼 | 偏暗，不像红 | 难指红 | 不像红 | 难指 |
| 3 | 墨发长卷 | 在，仍卷 | 在 | 更直 | 在 |
| 4 | 苍肤 | 在 | 在 | 在 | 在 |
| 5 | 黑裙抹胸 + 蕾丝领 | 在 | 领变细带 | 在 | 领弱 |
| 6 | 黑蕾丝手套 | 变实心黑（降密度） | 在 | 在 | 在 |
| 7 | 开叉红衬 | 在 | 红条在 | 在 | 腿更露，红弱 |
| 8 | 红高跟 | 在 | 底有红 | **变黑高跟 = 换件** | 黑鞋 |

主理人：B-lo **过**。B-mid 废。B5 不开。

## 8. C 过目（等人）

底 = 过关 B-lo 印戳。Krea i2i，未加 OpenPose，未叠 IPA。

| 看什么 | 完整路径 |
|---|---|
| **三姿条（先看）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\19-c-idle-c1-c2.png` |
| 已过 idle 128 | `characters/violet-fallen/combat/idle/12-idle-blo-passed-128.png` |
| 已过 idle 印戳 | `characters/violet-fallen/stamps/idle-blo.png` |
| C1 对照卡 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\15-c1-stamp-and-128.png` |
| C1 印戳 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\13-c1-raw.png` |
| C1 128 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\14-c1-128.png` |
| C2 对照卡 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\18-c2-stamp-and-128.png` |
| C2 印戳 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\16-c2-raw.png` |
| C2 128 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\17-c2-128.png` |
| C1 park | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T02-54-21-897Z\comfy_lan_vf1_c1_00001_.png` |
| C2 park | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T02-54-46-478Z\comfy_lan_vf1_c2_00001_.png` |

主理人（2026-09-10）：C1/C2 **没有改变动作**，反倒改了脸。发和角、其它元素基本锁住。  
补：脸漂**主要在印戳**；**128 只是呼吸级**脸像素，不当 128 换头。

漂类：① 衣发角鞋还在 · ② 提示词 i2i **没改姿**。128 不换头。

## 9. C 两条合法分岔（2026-09-10）

GPU 请求全文：`design/art-bible/gpu-request-c-pose-i2v-v1.md`

| 分岔 | 本机现状 | 已做 | 卡住 |
|---|---|---|---|
| Krea 骨架挂在 i2i 上 | Ostris 节点在 | 合法两枪已出，见 §10 | 助理看没改姿。等过目。不抬 denoise |
| 已过印戳 → I2V → 抽两帧 | 14B 枪 A 人锁动小；枪 B 已出 | 见 §13 / §14 | 等过目 |

骨架图（完整路径）：

- idle：`d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\20-c-dwpose-from-idle.png`
- 对照：`d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\21-c-pose-maps-compare.png`
- C1 叉腰：`d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\21-c-dwpose-akimbo.png`
- C2 换重心：`d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\22-c-dwpose-shift.png`
- idle park：`d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T03-37-42-518Z\comfy_lan_vf1_dwpose_idle_00001_.png`

A2 已 Queue。不按 thedeoxen 自带 t2i 图。不抬 denoise，不写 `frames/`。

## 10. C Ostris 过目（等人）

底 = 过关 B-lo 印戳 i2i。Ostris `image1`=骨架。普通 LoRA 挂 thedeoxen 0.85。denoise 0.40。未叠 IPA。未下 edit LoRA。

| 看什么 | 完整路径 |
|---|---|
| **三姿条（先看 128）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\29-c-ostris-idle-c1-c2.png` |
| **C1 对照卡（先看印戳）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\25-c-ostris-c1-stamp-and-128.png` |
| **C2 对照卡（先看印戳）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\28-c-ostris-c2-stamp-and-128.png` |
| 已过 idle 128 | `characters/violet-fallen/combat/idle/12-idle-blo-passed-128.png` |
| C1 印戳 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\23-c-ostris-c1-raw.png` |
| C1 128 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\24-c-ostris-c1-128.png` |
| C2 印戳 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\26-c-ostris-c2-raw.png` |
| C2 128 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\27-c-ostris-c2-128.png` |
| C1 park | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T05-34-56-649Z\comfy_lan_vf1_c_ostris_c1_00001_.png` |
| C2 park | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T05-35-45-982Z\comfy_lan_vf1_c_ostris_c2_00001_.png` |

助理（不是过）：两枪都还是垂手站，没有叉腰、没有换重心。衣发角鞋基本还在。C1 夜空有麻点，入盒把麻点算进框，128 偏瘦，过目以印戳为准。C2 领/bib 似乎变细。脸按分层：印戳细看，128 按呼吸。

漂类：① 零件大体在 · ② 合法 Ostris+i2i **仍没改姿**。thedeoxen 训练默认是 denoise 1 空 latent；合法低 denoise 可能就是这堵墙。不抬 denoise。I2V 已出，见 §11。身份 LoRA 兄弟姿见成法 §5.1，最低优先；本例 LoRA 测试图不是 Vf1 料。

## 11. C I2V（已出 · 未过目）

底 = 过关 B-lo 印戳。SVD XT `svd_xt.safetensors`。8 帧 576×1024，motion_bucket 70，seed 2026091010。prompt `240b8baf-b63d-4eed-ab73-0381a2b56394`。不写 `frames/`。

| 看什么 | 完整路径 |
|---|---|
| **8 帧条（先看）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\36-c-i2v-f1-to-f8.png` |
| 第 3 帧对照卡 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\32-c-i2v-f3-stamp-and-128.png` |
| 第 7 帧对照卡 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\35-c-i2v-f7-stamp-and-128.png` |
| 已过 idle 印戳 | `characters/violet-fallen/stamps/idle-blo.png` |
| park 8 帧 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T08-48-57-715Z\` |

助理（不是过）：f1–f3 还是垂手站，零件大体在；f4 起脸/衣/手融化，f7/f8 不当姿。过目先看 8 帧条和印戳。128 脸按呼吸。

## 12. GPU Krea t2i 7–10（不是 Vf1 LoRA 料）

拷本：`d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\identity-vf1\krea2-lora-probe\`  
原盘：`D:\ComfyUI\output\krea2_base_00007_.png` … `00010_.png`。`KREA2-Turbo-基础` 未改参。独立 t2i，不是图1′ / 印戳派生。零件表对不上。不准进训练集。

## 13. C Wan I2V 14B（已出 · 未过目）

底 = 过关 B-lo 印戳。`wan2.1_i2v_480p_14B_fp8_scaled.safetensors`。480×832、17 帧、uni_pc 20 步、CFG 5、crop none、seed 2026091014。prompt `123367fe-6661-4791-8a49-5f5663b8f561`。不写 `frames/`。

| 看什么 | 完整路径 |
|---|---|
| **关键帧条（先看）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\43-c-wan14-stamp-f1-f5-f9-f17.png` |
| 循环播放 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\44-c-wan14-play.html` |
| 已过 idle 印戳 | `characters/violet-fallen/stamps/idle-blo.png` |
| park 17 帧 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T12-10-34-966Z\` |

助理（不是过）：和 1.3B 反过来。零件还在。17 帧垂手。主理人：远好于 SVD / 1.3B，人锁，动太小，只算视频模型初步验证。

## 14. C Wan I2V 14B 枪 B（已出 · 未过目）

同印戳。大动作叉腰词 + 负向垂手。CFG 6。seed 2026091015。prompt `3a3d655d-0b8e-4235-ae28-4369c91f8cfd`。不写 `frames/`。

| 看什么 | 完整路径 |
|---|---|
| **A/B 对照条（先看）** | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\45-c-wan14-a-vs-b.png` |
| 枪 B 循环 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\46-c-wan14b-play.html` |
| park 17 帧 | `d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_park\comfy-lan\2026-09-10T12-21-52-840Z\` |

助理（不是过）：人仍锁。臂从垂手张到两侧，幅度够；姿是张臂，不是叉腰。

## 15. Wan I2V 为什么是连续 PNG · 什么配置才叫视频（2026-09-10）

模型是视频模型。Comfy 的 `WanImageToVideo` 产出的是 **按时间排好的帧 latent**，VAE 解出来就是一串图。官方模板用 `SaveAnimatedWEBP` **16 fps** 收成片（[Comfy Wan 教程](https://docs.comfy.org/tutorials/video/wan/wan-video)、[720p 例图](https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/blob/main/example%20workflows_Wan2.1/image_to_video_wan_720p_example.json)）。我们前几枪只挂了 `SaveImage`，是为了 C 抽帧入盒，所以看起来像「连续静图」。按 16 fps 播才是原速（[r/comfyui 帧率说明](https://www.reddit.com/r/comfyui/comments/1juaj96/a_small_explainer_on_video_framerates_in_the/)）。已有循环：`44-c-wan14-play.html` / `46-c-wan14b-play.html`。

| 项 | 官方 / 社区 | 我们 A/B | 枪 C |
|---|---|---|---|
| `length` | 默认 **81**（16 fps ≈ **5 秒**）。须 `4n+1` | **17** ≈ 1 秒 | **33** ≈ 2 秒（8GB 先不冲 81） |
| 采样 | 20 步、CFG **6**、uni_pc / simple | A CFG 5；B CFG 6 | CFG 6 |
| 负向 | 官方含 **static / still / 静止** | 自写英负 | 官方英负 + 禁张臂 |
| 正向 | **写动作**，一张只一件事 | 锁人段落很长，「slowly」压幅 | 先写叉腰，再锁镜头/零件 |
| 成片 | SaveAnimatedWEBP 16 fps | 只有 PNG | PNG + webp 16 fps |

提示词结构（[ai-inspo I2V 指南](https://www.ai-inspo.com/blogs/video/wan-2-1-image-to-video-prompting-guide)）：主体在做什么 · 幅度/速度 · 镜头（不要动就写 static camera）· 一镜一事。外观主要靠 start_image，不必把零件表再写一遍。

shift：社区 480p 有写 3；我们现网 A/B 用 8 已经能动。枪 C **不改 shift**，只改长度+词+成片。81 帧 / H3 等 33 过目。未点名不开。

## 16. Krea t2i 扩角（2026-09-11 · 主理人）

**不用图生图。** 从零件抽出后大量优化提示词。编码机原 i2i 词仅参考、不可用。

成片：`d:\code\vampire-survivors-like\tools\comfy-lan\workflows\vf1-krea-lora\vf1-krea2-20260911\`  
现网词：`tools/comfy-lan/workflows/vf1-krea-lora/prompts.md`  
归档词：`prompts-ref-i2i-v0.md`

结构：基本定义 → 姿态/摄像头 → 画面与体型 → 服饰零件 → 特殊强调。  
这批鞋必须黑高跟；bib/手套走薄黑尼龙；有黑丝。与已过 B-lo（红高跟 + 蕾丝）不是同一套衣，不准混炼，除非主理人点名。  
S13 叉腰是 t2i 兄弟姿，**不叫 C 过**。

助理核训练料（不是过）：20 张角度够，**不能整包炼**。衣在尼龙无袖 / 蕾丝短袖两套之间晃。必丢：`krea2_vf1_t2i_00025_.png`（尖耳）。无逐张 caption。不要和 B-lo 红高跟混炼。

