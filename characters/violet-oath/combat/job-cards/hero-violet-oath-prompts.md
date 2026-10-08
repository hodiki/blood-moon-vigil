# 薇奥莱守誓 · 抽卡提示词（开工后用）

> 不是锁。一次一张。挂单人参考，禁止六人表、禁止骑士、禁止现网旧 `hero-violet*`。

参考根：`archive/process-v1-deprecated/combat-64-parked-2026-09/violet-oath-parked/refs/`

| 抽 | 挂 |
|---|---|
| idle | `ref-vo-sil-nun` + `ref-vo-color-key` + `ref-vo-idle-v6` |
| 走 | 自检过的 idle 64 + 上表三张里的色块两张 |
| skill | 自检过的 idle 64 + walk-a 64 |

成片 `ref-vo-portrait-solo` 只给人核身份，**不挂生成**（防油画）。

## idle

```text
ONE isolated Vampire Survivors-like 2D pixel-art character sprite, not a painting.
Same nun as the reference sprites. Hard color blocks, no outline, no ground shadow.
3/4 camera, facing RIGHT. Full body, empty sides, hem on the bottom edge.
White wimple block #F2F5F9. Charcoal A-shape habit #3A4250, smooth hem, NOT tattered.
Exactly ONE candle at chest height, flame #FFC93C only 2-4 pixels. No second candle.
No knight, no book, no staff, no cyan jewel, no horns, no slit skirt.
Void background #00040C.
```

## 走（六相位条 · 16:9）

```text
ONE isolated 2D pixel-art SPRITE SHEET, not a painting.
Exactly SIX equal cells in ONE row, 16:9. Same nun, same scale, same ground line.
Left to right: 1 CONTACT, 2 DOWN, 3 PASSING, 4 OPPOSITE CONTACT, 5 DOWN, 6 PASSING 2.
Copy the idle reference: white wimple, charcoal A-habit, ONE chest candle, flame #FFC93C.
3/4 facing RIGHT in every cell. Hard color blocks. Void #00040C.

Walking RIGHT. The habit covers the feet — still a walk, not idle sway.
Weight shifts left/right. Hem kicks then closes. Wimple bob 1-2px. Candle stays at chest.
FORBIDDEN: only hem jitter, treadmill, mirroring the whole body, facing left, knight,
tattered hem, cyan, second person, labels, rings.
```

## skill（两格条 · 16:9）

```text
ONE isolated 2D pixel-art SPRITE SHEET, not a painting.
Exactly TWO equal cells in ONE row, 16:9. Same nun as the references.
Left = RAISE CANDLE. Right = ARMS OPEN. No labels.

Same identity: white wimple, charcoal A-habit, exactly ONE candle, flame #FFC93C.
3/4 facing RIGHT. Hard color blocks. Void #00040C.

CELL 1: candle raised above the wimple, habit may flare one block, hips empty or still holding the one candle. No rings.
CELL 2: both arms out, candle NOT lost, no rings, no particles, no bloom.

FORBIDDEN: a-to-b motion lines, knight, book, staff, horns, cyan jewel, text.
```
