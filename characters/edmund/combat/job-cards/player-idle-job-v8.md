# 开工卡 · `player` idle v8

> 2026-09-06 · 流程 v1.2 · **未过** · 不准写 `assets/frames/`

## 形象套（本套，不另开）

| 层 | 路径 |
|---|---|
| 剪影 | `locked/silhouettes/char-bible-edmund-lock-ce.png` 右（单人裁：`archive/process-v1-deprecated/combat-64-parked-2026-09/inspect-dumps/`ref-edmund-lock-ce-body.png`） |
| 立绘 | `locked/portraits/char-bible-portrait-edmund-v1.png` + `locked/faces/face-edmund.png` |
| 战斗设计 | 色键 v2 的艾德蒙大图（单人裁：`archive/process-v1-deprecated/combat-64-parked-2026-09/inspect-dumps/`ref-edmund-colorkey-large.png`） |

不用：六人表、排队全图、现网 `player*`、`player-idle-art-v5/v6`、C 的 64。

## 本帧

- 动作：3/4 呆站，朝右，双脚钉地。不是走、不是技能。
- 风格：大图 = 立绘那套绘画哥特，**只核身份**。64 按硬色块语言另出，禁止硬切本大图。

## 形锚（锁人，不锁死动作）

| 锚 | 必须仍在 |
|---|---|
| 帽 | 中锥顶 + 檐是横条；檐不是全身最宽（肩+斗篷帆更宽） |
| 衣 | 两层：双排扣炭灰大衣 `#3A4554`（前胸/腰带可读）+ 身后一块布帆 |
| 斗篷 | 两肩连着；齿只在下摆 3–4 大齿；禁止脊上三角刺、禁止碎成许多飘带 |
| 灯 | 髋侧外挂一盏（画面右侧髋）；灯体+笼+焰心 `#FFC93C`；不举手、不举过顶 |
| 脸 | 帽下疲倦成人：颧/鼻梁/胡茬可读；禁少年、禁无脸黑洞 |

层次：斗篷最暗 `#2A3038` → 大衣中 `#3A4554` → 近灯一小块受光 `#4A5566`。禁止整身平涂抬亮。无外圈描边。

## 元素出入

| 元素 | 类别 |
|---|---|
| 帽 / 两层衣 / 髋侧灯 / 帽下脸 | 在（降密度到 64 时块变小，仍须能指认） |
| 灯举过顶 | 禁止（那是 skill 的动作位移） |
| 第二盏灯 / 血灯 / 冷青焰 | 禁止 |
| 生成没了或管线吃了 | 禁止 = 废帧 |

## 本步停点

大图出现 Q / 刺 / 第二套衣服 / 宽檐猎人帽 → 废。大图过了也不准硬切。64 另走硬色块语言。

## v8 大图（2026-09-06）

落点：`archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-idle-parked/`player-idle-art-v8.png`（未切、未进现网）

| 项 | 看 |
|---|---|
| Q / 六人表 / 第二套衣服 | 无 |
| 脊上刺 | 无；帆从两肩落下 |
| 灯 | 髋侧一盏，焰在笼里，未举手 |
| 脸 / 双排扣 / 腰带 | 在 |
| 风险 | 帽檐偏宽，像猎人帽；下摆齿偏碎，多于 3–4 大齿 |

## v8 硬切 64（2026-09-06 · **废方法** · 未进现网）

落点：`archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-idle-parked/`player-idle-cut-v8.png` + `-x4.png` + `-board.png`

主理人裁定：硬切效果不合格，且历来最糟、浪费大。已升格为流程 **R19**。此切不作候选。v8 大图仍可作身份参考。

| 计量 | 值 |
|---|---|
| 盒 | 36×56 @ (14,4) |
| 近墨 | 0 |
| 真洞 | 0 |
| L\* | 25.3 |
| 焰心金 | 3 |
| 脸向像素 | 5（檐下） |
| 帽/衣宽 | 17 / 32 |

## v9 64 语言（2026-09-06 · 未进现网）

学 C：单人、硬色块语言直接生成；入盒只用近邻，不 token、不补脸灯。

- 源：`archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-idle-parked/`player-idle-64-v9.png`
- 入盒：`player-idle-64-v9-box.png` + `-x4.png` + `-board.png`

参考：C idle 只学语言；lock-ce 剪影；色键 E 衣色。不用 v8 油画、不用现网 `player`。
