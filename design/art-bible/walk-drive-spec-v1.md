# 走姿驱动视频 · 要求与提示词

> 2026-11-06 · 给主理人拿去生成/找素材
> 用途：喂 Wan Animate，让守誓者（以及后续同类）产出走/移动帧

---

## 0. 一句话原理

**驱动视频只提供"运动"，不提供"长相"。**

Wan Animate 会把驱动里的人体动作套到参考图上；参考图决定角色长什么样、朝哪个方向。所以驱动视频不需要长得像骑士，**只要动作对、角度对、镜头别动**。

---

## 1. 硬要求（不满足就白跑）

| 项 | 要求 | 为什么 |
|---|---|---|
| **镜头** | **完全固定**，三脚架，零推拉摇移 | 上次薇奥莱走帧"越走越大 +11.6%"，就是镜头/人物在靠近 |
| **构图** | 全身入画（头顶到脚底），人物高度占画面 **75–85%**，居中 | 与 192/128 画布比例匹配，取帧后不用重排 |
| **视角** | **必须与目标角色朝向一致** | 守誓者是 30° 斜向 → 驱动就拍 **30° 斜向**。别用正侧去套 30° 的参考，否则身体会被"拧" |
| **动作** | **原地踏步**（跑步机式），**不要真的往前走** | 有位移，帧就对不齐，等于白跑 |
| **步幅** | **小**，脚底离地约 2–3cm 就够 | 重甲是"踏步"，不是大跨步 |
| **摆肩** | 要。前腿**异侧**的肩向前送，胸廓转几度 | 只有腿在动的话，192 上几乎看不出循环 |
| **手臂** | 自然垂在身侧，小幅前后摆；**不要甩、不要举** | 会串到骑士持剑的手上 |
| **服装** | **紧身纯色**（深灰/炭黑），无裙摆、无飘带、无大袖、无披风 | 布料摆动会污染动作 |
| **道具** | 无 | — |
| **背景** | 纯色（中灰或纯黑），**无地板纹理、无阴影投地** | 地面纹理会被当成角色的一部分 |
| **时长** | **3–4 秒**，至少含 **2 个完整步循环** | 取 4 帧要有余量 |
| **帧率** | 24 或 30fps，**不要慢动作、不要变速** | — |
| **分辨率** | 竖幅 ≥ 720×1080 | — |

**明确不要**：镜头运动、走位位移、中途转身、加速/减速、重运动模糊、第二个人入画、字幕水印。

---

## 2. 现成提示词（可直接喂视频模型）

> 用于文生视频（可灵 / H3 / Veo / Runway 等）。**两个版本按目标朝向二选一。**

### V1 · 30° 斜向（守誓者、多数人形怪用这个）

```
A single adult man in a plain dark charcoal skin-tight bodysuit with no props and no accessories,
standing on a plain flat mid-grey background with no scenery and no visible floor texture,
seen from a fixed chest-height camera in a three-quarter view about thirty degrees off the front,
full body from the top of the head to the soles of the feet inside the frame, centred, occupying about eighty percent of the frame height.

He walks in place on the spot like a treadmill, never travelling forward or sideways:
short heavy steps, each foot lifting only two or three centimetres off the ground,
weight shifting side to side, and with every step the shoulder on the opposite side of the leading leg pushes forward,
the chest turning a few degrees with each step, arms hanging at his sides and swinging only slightly.

The camera is completely locked off and never moves, pans, zooms or shakes.
His size in frame stays exactly constant for the entire shot.
Neutral even lighting, no shadows on the background, no motion blur, no text, no watermark, no other person.
```

### V2 · 正侧身（只给"要侧身循环"的角色用）

把上面第二段的 `three-quarter view about thirty degrees off the front`
换成 `perfect side view, he faces the right side of the frame`。

---

## 3. 拿到视频后我会验的三条

1. **人物高度波动 < 2%**（逐帧量内容框高度）
2. **左右脚确实交替**（不是同一条腿反复抬）
3. **脚底离地不超过 3cm**（不是高抬腿）

三条都过，取 4 帧进下一步；不过就换一条驱动，**不要用提示词硬修**。

---

## 4. 一条省事的备选

如果视频模型出不来"原地踏步"，**实拍也行**：手机架三脚架、固定机位、拍 4 秒原地踏步，剪掉头尾。这比反复抽卡快得多，而且动作一定真实。
