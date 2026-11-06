# 攻击拖影 · 提示词库

> 2026-11-06 · 首次用在守誓者的下劈，**已通过**
> 用途：其它角色 / 怪物的攻击动作需要"挥砍残影"时直接复用

---

## 0. 结论先行

这套参数出的结果：**弧线方向、起止点、由细到宽的形状都成立**，唯一偏差是——

> **靠近剑身处的宽度只有剑身的约 20%，而要求是 80%。**

也就是说模型对"指数增长到很大的宽度"这一档**打了折扣**（它更愿意画得克制）。

**用法**：当"形状对了、宽度不够"时，**不要继续抽卡**——直接在提示词里把百分比往上翻（要 80% 就写 150%），或者后期用代码加宽厚端。

---

## 1. 提示词全文（可直接复制）

```
Keep the character, the armour, the helmet, the tabard, the pose and the sword EXACTLY as they are in this image.
Do not stand him up, do not move the sword, do not change the blade angle.

Only add ONE motion smear: a curved wedge like a bent triangle.
It starts as a hair-thin point, about one pixel wide, at the top of the character's head,
and sweeps down along the path the blade travelled, an arc of about one hundred and twenty degrees,
ending at the sword's body, where the wedge is at its widest.
The width increases exponentially from that one-pixel start along the whole arc,
eventually reaching about eighty percent of the length of the sword blade at the point where it meets the blade.
So the shape is a long bent triangle: a needle at the head, swelling wider and wider, fat where it touches the steel.

It is one flat pale bone-white colour with a crisp hard edge, like a painted shape,
semi-transparent enough that the armour and the background still read through it.
No glow, no beam, no bloom, no particles, no sparks, no double exposure.

Everything else identical: same plain near-black background, no floor, no scenery, no text.
```

---

## 2. 参数表

| 参数 | 值 | 说明 |
|---|---|---|
| 弧度 | **120°** | 小于 90° 会变成"贴着剑的一小段"，大于 150° 会绕过头变成旗子 |
| 起点 | **角色头顶** | 写死起点，否则模型从剑柄起画 |
| 终点 | **剑身**（最宽处） | 必须写"widest where it meets the blade" |
| 宽度曲线 | **指数增长**，1px 起 | 线性增长会画成等宽带子 |
| 末端宽度 | 写 **80% 剑长**（实际出 ~20%，见 §0） | 想要更宽就把数字往上翻 |
| 颜色 | `pale bone-white`（骨白） | 冷白会像冰，暖白会像火 |
| 边缘 | `crisp hard edge` | 别写 soft，软边会糊成雾 |
| 透明度 | `semi-transparent` | 必须写，否则是一块实心色块 |

---

## 3. 三个必须写死的句子

这三句少一句就废：

1. `Keep the ... pose ... EXACTLY as they are in this image.` + `Do not stand him up`
   → **不写这句，模型会把姿势改回站立**
2. `starts as a hair-thin point ... at the top of the character's head`
   → 不写起点，残影会从剑柄开始，变成"给剑描边"
3. `widest where it meets the blade`
   → 不写这句，宽度方向会反（模型理解的"拖尾"是尾巴在最后）

---

## 4. 参考图必须是对的那张

**底图必须是"动作终点姿势"本身**（剑已经扫到位的那张），不能拿 idle / 立姿当参考。

第一次失败就是这个原因：脚本的 `ref` 还指向立姿，模型一编辑就把人"扶正"、剑"插回地里"，残影只能贴在竖剑旁边。

做法：把终点姿势抠掉背景，存成 `ref-chop-alpha.png`，再作为 `ref` 喂进去。

---

## 5. 反面案例（别重蹈）

| 现象 | 原因是 | 修法 |
|---|---|---|
| 残影贴着剑身，像"白底大剑" | 残影没离开剑；起点写成了剑柄 | 起点写头顶，强调 `curving away` |
| 变成披风 / 翅膀 | 弧度过大（>150°）+ 宽度过大 | 收到 120°，宽度按 §0 折扣 |
| 变成旗子，穿过身体 | 没说"不要穿过身体" | 加 `never crossing his body or face` |
| 变成发光光柱 | 用了 `trail` / `effect` 这类词 | 改用 `a flat shape that marks the path` |
| 姿势被改回站立 | 没写 `do not stand him up` | 见 §3 第 1 条 |

---

## 6. 复用时的替换清单

给别的角色 / 怪物用时，只改这几处：

| 位置 | 原来 | 换成 |
|---|---|---|
| 起点 | `at the top of the character's head` | 匕首/短兵改成 `at his shoulder`；大型怪改成 `above his back` |
| 弧度 | `one hundred and twenty degrees` | 横扫 → `about one hundred and eighty degrees`；刺 → `twenty degrees` |
| 终点 | `where it meets the blade` | 爪击 → `where it meets his claws`；尾扫 → `where it meets his tail` |
| 颜色 | `pale bone-white` | 血系 → `dark crimson`；月银系 → `pale silver-blue` |

---

## 7. 出片记录（守誓者）

| seed | 结果 |
|---|---|
| 1901 | 几何完全命中，但过宽（像披风） |
| **1902** | **采用** —— 弧线与宽度最平衡 |
| 1903 / 1904 | 变成旗子，穿过身体 |

素材：`characters/oathkeeper/review/20261104-oath/raw/ac-2026111902.png`
定稿：`.../sets/summon-oathkeeper-attack-a.png`
