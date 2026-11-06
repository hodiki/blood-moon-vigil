# 走姿驱动视频 · 提示词 v2（斜前方 30°）

> 2026-11-06 · 基于 `walk-drive-spec-v1.md` 整理
> 用途：喂 Wan Animate，产出走/移动帧

---

## 0. 先纠正一个说法：不要用"跟拍"

你的描述是「视角和角色同步移动」，视觉上确实等于两者相对静止。但**实现方式不能用跟拍**，要用「原地踏步 + 固定机位」——两者在最终视频里看起来几乎一样，但对 Animate 的可用性差别很大：

| | 跟拍（相机移动） | 原地踏步（固定机位） |
|---|---|---|
| 相对位置 | 恒定（靠运镜维持） | 恒定（本来就不动） |
| 背景 | 快速平移 → 视差、运动模糊 | 完全静止 |
| 人物大小 | 会漂 ±1–3% | 严格不变 |
| 废片风险 | 高（追焦迟滞、轻微推拉） | 低 |

v1 文档里"薇奥莱走帧越走越大 +11.6%"就是运镜问题的后果。**原地踏步 + 固定机位是唯一能保证「人物大小与位置零漂移」的做法**，这正是 Animate 需要的。

---

## 1. 相对 v1 的三处改动

| 项 | v1 | v2 | 原因 |
|---|---|---|---|
| 视角 | `three-quarter view about thirty degrees off the front` | 明确到**哪一侧**：相机在角色**右前方 30°**，鼻尖朝画面右边缘，右肩近镜头 | "斜前方"没说左右，模型会随机镜像；镜像会让 Animate 把身体拧反 |
| 背景 | 中灰 **或纯黑** | **只允许中灰** | 炭黑紧身衣 + 纯黑背景 = 剪影消失，pose 提取必崩 |
| 位移 | 只说"原地踏步" | 补 `never travels forward, backward or sideways` + `size and position in frame stay exactly constant` | 只写 in place，模型仍可能给一点前移 |

---

## 2. 正向提示词（可直接喂视频模型）

```
A single adult man in a plain dark charcoal skin-tight bodysuit, no props, no accessories,
standing on a plain flat mid-grey background with no scenery, no floor line and no cast
shadow on the ground.

Fixed camera on a tripod, at chest height, level horizon, sixty millimetres or longer,
no zoom and no handheld shake. The camera sits thirty degrees off his front, on his right
side, so his nose points toward the right edge of the frame and his right shoulder is
nearer the lens; his body is turned about thirty degrees away from facing the camera.

He walks in place on the spot, like a treadmill, and never travels forward, backward or
sideways; his position in the frame and his size in the frame stay exactly constant from
the first frame to the last. Short heavy steps, each foot lifting only two or three
centimetres, the heel landing first and the foot rolling flat, weight shifting from side
to side; with every step the shoulder on the opposite side of the leading leg pushes
forward so the chest turns a few degrees. His arms hang at his sides and swing only
slightly; he never raises them and holds nothing.

Full body from the top of the head to the soles of the feet inside the frame, centred,
occupying about eighty percent of the frame height, with even margin above the head and
below the feet. Neutral even lighting, no motion blur, no text, no watermark, no other person.
```

---

## 3. 负向提示词

```
camera movement, camera tracking, dolly, pan, tilt, zoom, handheld shake, parallax,
walking out of frame, drifting in frame, changing size, approaching the camera,
receding from the camera, forward travel, turning away, turning around,
running, jumping, high knees, big strides, dancing,
background scenery, floor texture, horizon line, cast shadow, motion blur,
slow motion, speed ramp, second person, text, watermark, cropped feet, cropped head
```

---

## 4. 生成参数（写在参数里，不要写进提示词）

| 项 | 值 |
|---|---|
| 分辨率 | 720×1280 或 1080×1920（竖幅） |
| 时长 | 3–4 秒 |
| 帧率 | 24 或 30fps，不慢放不变速 |
| 循环 | ≥2 个完整步态周期 |
| 音频 | 关闭 |

---

## 5. 出片后先验三条（v1 的三条保留，加一条）

1. 人物高度波动 **< 2%**（逐帧量内容框高度）
2. 左右脚确实交替（不是同一条腿反复抬）
3. 脚底离地不超过 3cm（不是高抬腿）
4. **新增：鼻尖始终朝画面右边缘**（若中途转向，直接换一条，不要修）

不过就换一条驱动，**不要用提示词硬修**。

---

## 6. 两个可调参数

| 现象 | 调整 |
|---|---|
| Animate 提取后腿部动作读不出 | 脚底离地量从 2–3cm 提到 **4–6cm**（仍属踏步） |
| 胸口转动在 192px 上看不出 | 肩部摆动幅度加一句 `a clear shoulder swing, the chest turning five to ten degrees` |

---

## 7. 一句提醒

驱动视频只提供运动、不提供长相。**驱动里的这个人越不像目标角色越好**——紧身纯色、无道具、无装饰，反而不会把多余信息带进 Animate。
