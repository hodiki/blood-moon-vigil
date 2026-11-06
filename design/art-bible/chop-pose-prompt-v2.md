# 下劈姿势 · 提示词 v2（含剑影/拖影）

> 2026-11-06 · 基于 `chop-pose-prompt-v1.md` 整理
> 目标：既修掉"拄剑"的误读，又让模型画出一条**弯三角形**的拖影（窄→宽）

---

## 0. 先说结论：拖影能试，但别指望它稳定

v1 §5 的判断是对的——**"由窄到宽"这种渐变几何，图像模型成功率不高**。它常见三种失败：

| 失败形态 | 原因 |
|---|---|
| 变成均匀宽度的弧带 | 模型把它当"轨迹线"，默认等宽 |
| 变成发光光柱 / 能量束 | `trail` 一词在训练数据里大量对应特效 |
| 宽度反了（起点粗、剑尖细） | 模型理解的"拖尾"是尾巴拖在后面 |

所以建议 **A/B 双轨**：
- **A 轨**：先用下面带拖影的提示词抽 4–6 张，只要出现一张"窄→宽"方向正确的，就值得继续；
- **B 轨**：若全部失败，回到 v1 §5 的代码合成（参数已列在文末，保持原样即可）。

**A 轨还有一个附加价值**：即使拖影不完美，它也能作为代码合成时的形状参考图。

---

## 1. 相对 v1 的四处改动

| 项 | v1 | v2 | 原因 |
|---|---|---|---|
| 开头 | `Change only the pose` | `Change the pose and add one effect` | 原句会把新增的拖影当成"不该改的东西"压掉 |
| 拖影用词 | 无 | **不用 `trail`**，改用 `a flat shape that marks the path` + 几何描述 | 避开"特效/发光"的语义坑 |
| 亮度 | 负向里禁 `glow` | 保留禁 glow，但明确允许**哑光平涂的浅色楔形** | 要的是"画的形状"，不是"光" |
| 起点/终点 | 无 | 写死**起点在肩、最宽处在剑尖** | 不给锚点，宽度方向必错 |

---

## 2. V1 · 终点帧 + 拖影（主推）

```
Change the pose and add one effect; keep everything else identical.

This is the instant a heavy overhead blow has just landed, exactly like a man splitting
firewood with an axe.

The sword has finished its arc and is now low and out in front of him, not underneath him:
the blade sits in front of his chest line, leaning about twenty-five degrees forward of
vertical, the tip low but clear of the ground and clearly ahead of his front foot, the flat
of the blade facing down. Both hands are together on the grip, the arms extended forward and
down with the elbows almost straight, the shoulders rolled forward over the blow.

His torso is pitched forward about forty degrees with a straight back, hips pushed back
behind his heels, weight driven onto the front leg which is deeply bent, the back leg
extended straight behind him with the toes down and the heel lifted clear of the ground.
His head is low, looking at where the blade landed.

Behind the blade, one flat shape marks the path the sword has just swept: a curved wedge
like a bent triangle, hair-thin at his shoulder where the swing began, widening steadily
along the arc, and widest where it meets the blade. Its outer edge is one clean curve
following the swing; its inner edge cuts back toward his shoulder. The wedge is a single
flat pale-cream colour with a hard crisp edge, like a painted motion smear — not a glow,
not a light beam, no bloom, no particles, no lens flare, no camera blur. It sits behind
the blade and never crosses his face.

He is NOT resting on the sword, the sword is NOT planted in the ground, the blade is NOT
vertical, the hands are NOT held close to the chest. The steel itself is plain and matte
with no shine.

Plain near-black empty background, no floor, no scenery, no text.
```

---

## 3. V2 · 中段 + 短拖影（弧更短、更好读，适合动作中间帧）

```
Change the pose and add one effect; keep everything else identical.

The blow is halfway down and still travelling.

The sword is descending in front of his centre line at about forty-five degrees, the tip
pointing forward and down and still above knee height, arms driving it, both gauntlets
ahead of his chest with the elbows only slightly bent, the torso pitched forward thirty
degrees, hips back, front knee bent, back heel lifted.

Trailing behind the moving blade there is one short curved wedge, like a bent triangle,
narrow at the tail and widest where it meets the blade; it is a single flat pale-cream
colour with a hard edge, not a glow, not a beam, no particles, no bloom.

Nothing has landed yet: the blade is in the air in front of him and not touching the
ground. Plain near-black empty background, no floor, no scenery, no text.
```

---

## 4. 拖影句库（替换主版里那一段，其余不动）

**形状 A · 单弧楔形（主推）**
```
a curved wedge like a bent triangle, hair-thin at his shoulder, widening along the arc,
widest where it meets the blade
```

**形状 B · 双弧（更华丽，适合必杀）**
```
two nested curved wedges marking the same arc, the inner one brighter and narrower, the
outer one broader and softer in value, both widest at the blade
```

**形状 C · 窄带（保守，成功率最高但不像"刀光"）**
```
a curved band of even width following the arc, widest at the blade by a small amount
```

**颜色 A · 暖米（贴 v1 代码参数 #ffedc4）**
```
a single flat pale-cream colour
```
**颜色 B · 冷银白**
```
a single flat pale blue-white colour
```
**颜色 C · 暖金**
```
a single flat warm gold colour, low saturation
```

**加一条亮芯（想让边界更锐利时追加）**
```
a thin brighter line runs along the inner edge of the wedge, the same colour at higher value
```

---

## 5. 负向提示词

```
sword planted in the ground, sword resting upright, blade vertical in front of the feet,
leaning on the sword, hands held at the chest, arms tucked in, standing upright,
looking straight ahead, cropped feet, cropped head, extra person, floor, scenery,
text, watermark,
glowing trail, energy beam, light beam, bloom, lens flare, smoke, sparks, particles,
motion blur, long exposure, double exposure
```

> 注意：v1 的负向里有 `energy trail`。**带拖影的版本必须把它去掉**，否则模型会把整个楔形一并压制。改成上面这组"发光类"词即可。

---

## 6. 提示词用词 ↔ v1 §5 代码参数对照

| 提示词里写的 | 代码里对应 |
|---|---|
| `hair-thin at his shoulder` | 起点 y≈46，顶部半宽 0.4px |
| `widest where it meets the blade` | 终点剑尖，底部半宽 6–7px |
| `pale-cream` | `#ffedc4`，透明度 0.34，screen 混合 |
| `a thin brighter line along the inner edge` | 亮芯 2.2px，`#fff8e2`，0.55，blur 0.7 |
| `hard crisp edge` | 主体 blur 1.3（不要更大） |

**这张对照表就是 A 轨与 B 轨的桥**：模型出来的形状如果方向对、比例不对，可以直接按它量出中心线，再套代码参数修宽窄。

---

## 7. 判定顺序（不要跳）

1. **先只看姿势**，把拖影遮住判断：像不像"斧头刚劈到地上那一下"
2. 姿势过了再看拖影：**窄端是不是在肩、宽端是不是在剑尖**
3. 两项都过再谈颜色与亮度

姿势不对时优先看三处：**剑尖是不是在前脚之前、肘是不是直的、胯是不是后坐**。
