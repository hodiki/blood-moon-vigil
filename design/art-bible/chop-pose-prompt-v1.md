# 下劈姿势 · 提示词包

> 2026-11-06 · 给主理人改
> 现状问题：两版都读成「拄剑 / 把剑插进地里」，不是「劈下去」

---

## 1. 为什么读成"拄剑"

| 我写的要求 | 实际画面 | 为什么错 |
|---|---|---|
| 剑**垂直向下**、**剑尖接近地面** | 一根竖在身前的柱子 | 这是**插剑/拄剑**的形态。下劈结束时剑**不在身体正下方**，而在**身体前方、略过垂直线** |
| 双手**在胸口高度**握着 | 抱在胸前 | 这是"端着"。劈完那一刻，**双臂是伸出去的**，肘几乎直 |
| 躯干前倾 30° | 只弯了一点 | 下劈终点是**胯往后坐、胸压过前膝**，不是"弯腰" |
| 前膝深屈 | 看着还行 | 但**后脚没跟上**，重心还在两脚之间 |

**根子在一句错话**：`blade pointing STRAIGHT DOWN with the tip almost touching the ground in front of his feet`——
"在脚前触地"直接把这姿势钉成了插剑。

---

## 2. 正确的下劈终点长什么样

想象一个人用斧头劈柴，斧子刚砸到地面的那一瞬：

- **剑**：在身体**前方**，刃面朝下，剑身与垂直线**约 20–30° 前倾**（不是垂直），剑尖在**前脚之前**、离地一点
- **双臂**：**向前下方伸出**，肘几乎伸直，肩前送
- **躯干**：**前倾 35–45°**，背是直的，不是弓背
- **胯**：**向后坐**，重心压在前脚
- **后腿**：向后伸直、脚尖点地、脚跟抬起
- **头**：低，看向剑落点

一句话记：**"斧头劈柴刚落地"**，不是"拄着剑站着"。

---

## 3. 可直接用的提示词

### V1 · 终点帧（推荐，用作 attack 单帧）

```
Change only the pose, keep everything else identical.

This is the instant a heavy overhead blow has just landed, exactly like a man splitting firewood with an axe.

The sword has finished its arc and is now LOW AND OUT IN FRONT of him, not underneath him:
the blade is in front of his chest line, leaning about twenty-five degrees forward of vertical,
the tip low but still clear of the ground and clearly ahead of his front foot,
the flat of the blade facing down, both hands together on the grip with the arms extended forward and down,
elbows almost straight, shoulders rolled forward over the blow.

His torso is pitched forward about forty degrees with a straight back, hips pushed back behind his heels,
weight driven onto the front leg which is deeply bent, the back leg extended straight behind him
with the toes down and the heel lifted clear of the ground. His head is low, looking down at where the blade landed.

He is NOT resting on the sword, the sword is NOT planted in the ground, the blade is NOT vertical,
the hands are NOT held close to the chest.

The blade is plain brushed steel with no glow, no shine, no trail and no particles anywhere.
Plain near-black empty background, no floor, no scenery, no text.
```

### V2 · 中段（备选，若想让它"正在下落"）

```
Change only the pose, keep everything else identical.

The blow is halfway down and still travelling.

The sword is descending in front of his centre line at about forty-five degrees,
the tip pointing forward and down and still above knee height, arms driving it,
both gauntlets ahead of his chest with the elbows only slightly bent,
the torso pitched forward thirty degrees, hips back, front knee bent, back heel lifted.

Nothing has landed yet: the blade is in the air in front of him, not touching the ground,
and there is no glow, no trail, no particles and no shine on the steel.
Plain near-black empty background, no floor, no scenery, no text.
```

---

## 4. 负面清单（写进 negative 或作为"不要"句）

```
sword planted in the ground, sword resting upright, blade vertical in front of the feet,
leaning on the sword, hands held at the chest, arms tucked in, standing upright,
looking straight ahead, glow, light beam, energy trail, particles, shine on blade, 
extra person, floor, scenery, text, watermark
```

---

## 5. 拖影规格（代码画，不靠模型）

模型做不出"从细到宽"，所以拖影后期合成。参数如下，**中心线跟着剑走，不要固定 x**。

| 项 | 值 | 说明 |
|---|---|---|
| 形态 | 楔形多边形，**上细下宽** | 顶部半宽 0.4px，底部半宽 **6–7px**（192 画布） |
| 起点 | 肩高（y≈46） | 挥砍起点 |
| 终点 | 剑尖所在处 | **这里最宽** |
| 中心线 | **沿剑的像素位置自动求** | 上一版固定 x=96，剑在 88，偏了 8px |
| 主体 | 色 `#ffedc4`，透明度 **0.34** | screen 混合，不压暗铠甲 |
| 亮芯 | 2.2px 宽，色 `#fff8e2`，透明度 **0.55** | 贴着剑线，让它读成"挥过"而不是"光柱" |
| 模糊 | 主体 blur 1.3，亮芯 blur 0.7 | |

**中心线怎么自动求**：在剑所在的纵向条带里，取"亮度高于背景"的像素的横向质心，逐行平滑。比手填坐标稳。

---

## 6. 判定标准

- 只看姿势、**先不管拖影**：像不像"斧头刚劈到地上那一下"
- 不像的话，最先看三处：**剑尖是不是在前脚之前**、**肘是不是直的**、**胯是不是后坐**
