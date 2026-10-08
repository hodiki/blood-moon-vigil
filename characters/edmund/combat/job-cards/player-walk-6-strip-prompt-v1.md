# 单人六相位条 · 可携提示词 v1

> 2026-09-06 · 主理人授权试一轮（方案 C）· 不是锁稿 · 不准写 `frames/`
> 播序（从左到右）：`a 接触 → e 落下 → b 经过 → c 对侧接触 → f 落下 → d 经过2`
> 身份锁：已过 `assets/frames/player.png`（idle v9）+ `assets/frames/player-walk-a.png`（walk-a v2）

把下面「正提示 / 负提示」整段交给其它模型。有参考图槽就两张都挂上。有 ControlNet / img2img / 种子槽，用文末「有接口时」那段，**不要把那些词塞进正提示里冒充锁。**

---

## 正提示（英文，主用）

```text
ONE isolated Vampire Survivors-like 2D pixel-art SPRITE SHEET, not a painting, not a comic, not a city scene.

LAYOUT (mandatory):
Exactly SIX equal cells in ONE horizontal row. Widescreen 16:9.
Left to right play order, same ground line, same character scale, same camera:
1 CONTACT, 2 DOWN, 3 PASSING, 4 OPPOSITE CONTACT, 5 DOWN, 6 PASSING 2.
No gaps of different sizes. No seventh figure. No labels, no letters, no numbers, no watermark, no caption.

IDENTITY (same man in every cell — copy the two reference sprites):
Adult night-watchman, 7-8 heads, tired adult face under the hat (not a teen, not a wizard).
MEDIUM conical night-watch hat: FLAT crown + SHORT horizontal brim bar. Brim is NOT the widest part of the body.
TWO clothing layers: night-ash double-breasted coat #3A4554 (two button columns readable on the chest) + ONE cloak SAIL behind, attached at both shoulders, hanging as cloth. Sawtooth ONLY on the bottom hem (3-4 large teeth). FORBIDDEN: dorsal spikes, triangles glued on the spine.
Exactly ONE antique lantern HANGING at the viewer-right hip in EVERY cell. Flame #FFC93C only 2-4 pixels inside the cage. Hands empty. Never held. Never a second lantern. Never jumps to the crotch or the other hip.
Brown leather boots (warm brown, not grey, not orange).
3/4 camera, facing RIGHT in every cell. Full body fills the cell height, empty sides, feet on the bottom edge.
Hard color blocks, no outline stroke, no ground shadow, no bloom, no particles.
Value layers: cloak darkest #2A3038 / #131722, coat mid #3A4554, small lit plane near the lantern #4A5566.
Flat void background #00040C in every cell. No street, no cobblestone, no second person, no furniture.

COLOR LOCK:
The coat is muted grey-blue charcoal #3A4554, LOW saturation, the SAME darkness in all six cells.
FORBIDDEN: brighter navy, royal blue, electric blue, washing the coat lighter, flattening coat and cloak to one mid-grey, each cell a different blue.

LOCOMOTION (all six cells):
Walking FORWARD to the RIGHT. Travel, not a treadmill, not a pivot in place.
One support foot planted, the other is the swing foot. Hips commit right. Cloak trails left/behind.
Hat stays the same shape. Lantern stays on the viewer-right hip.
FORBIDDEN in any cell: rotating or swapping feet under a planted torso; mirroring a contact; flipping the whole body; facing left; idle standing pose.

CELL 1 — CONTACT (right):
Near (viewer-right, lantern-side) boot planted FORWARD, heel down. Far boot rear, toe push-off. Widest stride.

CELL 2 — DOWN after cell 1:
Same near boot still in front, now flat. Rear boot OFF the floor, swinging forward but STILL BEHIND. Knees bent. Stance clearly narrower than cell 1, clearly wider than cell 3. Not another contact. Not passing.

CELL 3 — PASSING:
Legs close under the hips. One boot on the floor, one in the air. NOT a wide stride.
The COAT stays bulky like cell 1 — only the boots are close. Do not shrink the man into a stick.

CELL 4 — OPPOSITE CONTACT:
Still facing RIGHT. The FAR boot (viewer-left) has stepped FORWARD and planted. The NEAR boot (lantern side) is now the BACK foot, under the rear of the coat. Do NOT mirror the whole body. Do NOT put the lantern-side boot in front. Lantern stays viewer-right hip. Wide stride, similar width to cell 1.

CELL 5 — DOWN after cell 4:
Same support as cell 4. Rear boot off the floor, still behind. Knees bent. Stance narrower than cell 4, wider than cell 6. Not another wide contact.

CELL 6 — PASSING 2:
Legs close under the hips, support the other foot from cell 3. Coat stays bulky. Lantern still viewer-right hip.

SAME costume, SAME hat, SAME coat value, SAME lantern, SAME face in all six cells.
```

---

## 负提示

```text
six different men, different coat colors per cell, royal blue coat, electric blue, bright navy, washed mid-grey coat,
photoreal, 3d render, oil painting, gradient, bloom, city street, cobblestone, second person, crowd, environment,
chibi, cute, stamp sheet of many characters, wizard pointed hat, wide hunter brim, outline stroke, ground shadow,
text, letters, numbers, watermark, caption, logo, held lantern, two lanterns, lantern in hand, facing left,
side view, bird's-eye, isometric, idle standing, treadmill feet swap, mirrored body, extra limbs, holes in the coat,
transparent gaps in the torso, checkerboard
```

---

## 中文对照（国产模型可与英文叠用）

```text
一张横条精灵表，不是插画，不是街景。从左到右整整六格、等宽等高、同一条地平线、同一人同一尺度：
1接触 2落下 3经过 4对侧接触 5落下 6经过2。不要字、不要第七个人。
同一套人：中等锥顶夜巡帽（帽冠平、中檐横条，檐不是最宽），双排扣巡夜炭灰大衣#3A4554，身后一块锯齿只在下摆的斗篷帆，观者右侧髋挂一盏灯，焰心#FFC93C只有2到4像素，空手，3/4朝右，棕皮靴，硬色块无描边，底#00040C。
六格大衣必须同一明度同一灰蓝，禁止有的格变亮蓝、有的格变死灰。
朝右走，不是原地转脚。第4格是另一只脚在前，整身不要镜像，灯仍在右侧髋。
经过格只收靴不收整个人。落下格步幅介于接触与经过之间，不要再画一张大开接触。
```

---

## 参考图（有槽就挂）

1. `assets/frames/player.png` — 已过 idle：身份 + 衣色
2. `assets/frames/player-walk-a.png` — 已过接触：第 1 格的脚相位 + 同一套人

第 1 格应像参考 2 的走姿，其余五格是同一人的其它相位，不是另画五个人。

建议画布：16:9，长边 1024 或 1536。不要 1:1 硬塞六个人。
