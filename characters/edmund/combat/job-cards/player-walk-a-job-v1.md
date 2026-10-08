# 开工卡 · `player-walk-a` v1

> 2026-09-06 · 流程 v1.2 · idle 已过 · **本帧已过（v2 r2）** · 现网 `player-walk-a`

## 形象套

同 idle v9。64 底板：`assets/frames/player.png`（已过）。

不用：现网旧 `player-walk-*`、v8 油画硬切、六人表、C 的酒衣马尾。

## 本帧

- 动作：走姿 **接触**（contact）。前脚跟着地，后脚将离。不是呆站分腿。
- 风格：与已过 idle 同一套硬色块语言。上身、斗篷帆、灯要有相位。

## 形锚（须仍在）

帽檐横条、两层衣、髋侧一盏灯、帽下脸。灯可随走摆一点（动作位移），不得举手、不得消失。

## 元素出入

| 元素 | 类别 |
|---|---|
| 帽 / 两层衣 / 灯 / 脸 | 在（降密度） |
| 灯随髋摆、斗篷反向摆 | 动作位移 |
| 生成丢灯/脸或切成另一套人 | 禁止 |
| 侧视相机 / 手提灯 / 大跨步侧向循环 | 禁止（v1 废） |

## v1（2026-09-06 · 废）

源 `archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-walk-parked/`player-walk-a-64-v1.png`。近邻入盒后：侧视多于 3/4、灯像手提、底宽 47（idle 33 / C 接触 24）。不交过目、不写 `frames/`。

## v2（2026-09-06 · 待过目）

64 语言直出，近邻入盒。参考：已过 `player` idle、C walk-a（只学姿态）、lock-ce 剪影。

- 源：`archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-walk-parked/`player-walk-a-64-v2.png`
- 入盒：`-box.png` + `-x4.png` + `-board.png`

| | idle v9 | walk-a v2 |
|---|---|---|
| 盒 | 33×56 | 42×56 |
| 脸向 | 10 | 9 |
| 焰心金 | 10 | 11（略肥） |
| 帽/衣宽 | 16/28 | 16/31 |
| 真洞 | 0 | 0 |
| 近墨 | 31.3% | 31.4% |
| L\* | 15.3 | 14.6 |
| 脚底宽 y55 | 17 | 28（接触跨步） |

主理人：源 `player-walk-a-64-v2.png` 可；入盒 r1 帽尖、鞋灰。r2 只修入盒，不重出源。

- r1：顶上空白进近邻 → 帽收尖；`flood sum<=16` 吃暗靴
- r2：`player-walk-a-64-v2-box-r2.png` 紧裁顶、只抠真底、冠回 6px、靴色跟 idle 棕皮
- 过目板不再放 C walk-a（C 细腿是锁稿语言，不是废素材）
