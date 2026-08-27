# 《血月守夜》AI 资产生成提示词 · 批次 1：核心实体（57 帧）

> 版本：v1.3 · 日期：2026-08-26 · 修订：时间轴 FAIL 17 帧按 idle 底板 img2img / 微量呼吸补绘  
> 范围：4 角色（16 帧）+ 15 敌人（30 帧）+ 4 Boss（11 帧）= **57 帧**，与 `frame-registry.json` 对齐  
> 契约：`asset-spec-v1.md` **v1.3.1**（英雄 64 / 小兵 40–68 / 精英 96 / Boss 240–256；无管线描边）  
> 用法：**主提示词 + 帧变体**——只替换 `[FRAME]`。描边**不要**写进提示词（管线后置）。技能帧**只换姿态**，环/粒子走引擎 FX。  
> 门禁：守夜人 4 帧经管线后，64px 一眼能叫出名字、32px 仍见帽檐+灯点，才准开其余 53 帧。角色优先用已落地 v3.5 程序剪影做 img2img 参考。

---

## 0. 全局硬约束（所有提示词通用，无需逐条重复）

### 0.1 视角：VS 式微俯

```
Vampire Survivors-like slight 3/4 elevated view.
NOT side view. NOT diamond isometric. NOT bird's-eye hat-disk (no looking straight down at a head circle).
Full body centered. Hat brim / widest feature reads in silhouette.
Default facing RIGHT (nose / muzzle / lantern on the RIGHT side of the canvas).
mirrored silhouette must stay readable.
Direction will be flipX in engine — pose should stay readable when mirrored.
```

禁止再写 `45-degree top-down`（会逼出纯 3/4 人视插画）。

### 0.2 画布与风格

```
1. 透明底或整块墨夜蓝黑 #0B0E14 垫底（便于抠图）；禁止白底、禁止棋盘格当「透明」
2. 按 64px 档语言设计：扁平色块，硬边，无光影烘焙、无渐变、无油画
3. 轮廓节奏 > 内部像素；五官/胡子/皮带扣/布洞一律禁止（过密必死）
4. 填充主体预留边距；不要顶满画布（管线还要后置描边）
5. 最多约 6 个平色区域（小敌 3~5）
```

原图建议 512² 即可，**按契约像素档来想**（英雄 64 / 小兵 40–68 / 精英 96 / Boss 240–256），不要当 1024 插画画。

### 0.3 14 token 色板（只许这些 hex）

| token | hex     | 谁当主体 |
| ----- | ------- | ------ |
| 墨夜蓝黑  | #0B0E14 | 垫底/1~2px 褶，**禁止当玩家主色** |
| 暗紫灰   | #131722 | 次级阴影褶 |
| 暗草绿   | #18201C | 草地（本批角色不用） |
| 草叶    | #2A3B2E | 草地亮（本批角色不用） |
| 月银白   | #E8F0FA | **玩家/英雄/召唤物填充主体** |
| 冷青    | #54E6C9 | 灯芯/圣辉/玩家信息；描边由管线画，原图只用在灯芯等锚点 |
| 暗血红   | #7E1E1E | **普通/精英敌填充主体**；玩家仅 tiny accent |
| 幽紫    | #B06AF0 | 精英魔法提示（角、杖光）；描边归管线 |
| 猩红    | #FF3B3B | Boss 危险；描边归管线 |
| 金     | #FFC93C | 稀有/仪式（主教冠、化身）；**玩家禁用** |
| 血橙红   | #FF3B30 | 预警/血灯芯（忏悔者、尊者） |
| 电光蓝   | #4FC3F7 | 本批实体不用 |
| 青绿    | #43D17C | 本批实体不用 |
| 纸白    | #F2F5F9 | 极小高光 |

**禁色（负向必须带）**：brown leather, tan skin, beige, gold on player, orange metal, painted lighting.

### 0.4 填色铁律

- **玩家/英雄**：不透明像素以月银白为主体。海军/暗紫只许 1~2px 褶。量化后必须仍是「银团」不是「黑团」。
- **狼裔**：仍银主体；暗红只披风边/兽纹。
- **普通敌**：暗红主体，无描边。
- **精英**：暗红主体 + **双角**（形状编码）；描边归管线。
- **Boss**：各条主色，描边归管线。

### 0.5 描边归管线

- **玩家 / 英雄：不画冷青身份描边**（主理人 2026-08-23：青边观感差，身份改靠月银白主体 + 帽檐/武器/提灯）。
- 精英 / Boss：原图仍不画边；管线后置幽紫 3px / 猩红 4px。
- 提示词禁止 `2px cyan outline`。冷青只许出现在灯芯/圣辉锚点，不要箍一圈角色。

### 0.6 尺寸分级

| 班 | 帧 | 提示词密度 |
| --- | -- | ------ |
| 64px 角色 | 4 英雄 ×4 | 像素预算 + v3.5 参考 |
| 40–68px 普通敌 | 多数敌 | 3~5 色块，零五官 |
| 96px 精英 | 守墓者 / 畸体 / 石甲狼 | 剪影 + 双角 |
| 240–256 Boss | 4 Boss | 可密写主体，仍扁平 |

### 0.7 技能 / 出场

- `-skill-a` / `-skill-b`：**只换姿态**（蓄力 / 放出）。禁止冲击环、bloom、粒子、残影——引擎已有 `shockwave` / `p-ring` / ghost。
- `-v` = 呼吸 / 披风 1–2px，**不是另一张立绘**。禁止 stretch vs compress、禁止换一套服装/体型。
- `-entrance`：姿态可以更张，仍不要满屏特效环。
- 默认朝右；负向：`facing left as default`。

### 0.8 通用负向

```
blurry, 3d render, gradient, realistic photo, side view, diamond isometric,
bird's-eye top of head only, text, watermark, signature, extra limbs,
ground shadow, checkerboard background, brown leather, painted lighting,
face details, beard, extra lanterns, outline stroke, shockwave ring,
default facing left, stretch-compress body, second costume
```

### 0.9 后处理（本文真实步骤，无虚引用）

```
assets/raw/<帧名>.png
→ 抠图 → 填充装进安全框（画布 − 2×描边 − 2×边距）
→ 14 token 量化 → 管线后置描边 → assets/frames/<帧名>.png
```

实现见 `tools/asset-pipeline/README.md`（P-1~P-4 已落地）。

### 0.10 时间轴 FAIL 补绘（17 帧，2026-08-26）

以 **idle / base raw 做底板**。`-v` 只许胸腔/披风/皮毛上扩 1–2px 语言，脚钉死。禁止 stretch-compress、禁止换服装/体型/道具。`hero-galvan-skill-b` 以 `skill-a` 为底板，同尺度跟枪姿态，禁止整帧放大。

清单与门禁：`ta-review-handoff.md` §2。验收：`report.json` → `checks.temporal.ok === true`。

---

## 1. 角色（4 名 · 16 帧）

> 帧：`<slug>` idle1 + `-v` idle 呼吸（1.4fps，cloak 1–2px，feet glued）+ `-skill-a` 前摇姿态 + `-skill-b` 施放姿态  
> 画布 **64×64**。默认朝右。优先把 v3.5 `player` 剪影（锥顶 + 宽檐 + 灯）当作参考图。

### 1.0 守夜人身份锚点（细致原图，不再做 6 色块剪影）

| 特征 | 要求 |
| --- | --- |
| 帽 | 锥顶宽檐夜巡帽，檐为全身最宽；可见帽带、檐下阴影、破边 |
| 袍 | 破斗篷有层次与开衩，不是单块三角形 |
| 灯 | 单盏古董提灯：提柄、灯笼骨架、冷青灯芯（身份光，不是描边） |
| 填色 | 月银白仍是主色；允许更多褶与暗部，但不要变成海军主袍 |
| 描边 | **无冷青身份描边** |

### 1.1 守夜人·艾德蒙 — `player` / `player-v` / `player-skill-a` / `player-skill-b`

**主提示词**：

```text
Vampire Survivors-like 2D game character sprite, [FRAME], Edmund the lantern-keeper vigilante,
DETAILED pixel-art character (not a 6-color blob, not a primitive silhouette toy),
worn conical pointed night-watch hat with a very wide ragged brim (widest part of the sprite),
visible hat-band, underside of brim in shadow, tattered cloak with folds, three hem slits,
weathered silver-grey coat and boots, exactly ONE antique metal lantern with handle and cage,
cyan #54E6C9 flame ONLY inside the lantern (identity light, NOT a body outline),
slight 3/4 elevated view, full body centered, readable costume, face mostly under the hat (no photoreal portrait),
crisp pixel art with internal detail, limited palette,
dominant cloth moon silver #E8F0FA with navy #0B0E14 and dark violet #131722 used as folds and lining,
tiny dark blood red #7E1E1E accent only, NO gold, NO brown leather,
NO cyan/teal outline around the body, NO glow ring, NO shockwave, NO extra lanterns,
empty margin, flat #0B0E14 void or transparent, no ground shadow, no checkerboard, no text
```

| 帧 | [FRAME] | 说明 |
| --- | --- | --- |
| `player` | `idle pose, both feet planted, lantern low at right hip, calm stance` | idle 1 |
| `player-v` | `idle breathe, cloak 1-2px, feet glued, lantern 1px sway` | idle 2 |
| `player-skill-a` | `windup: same double-breasted silver coat and hat as idle, ONE lantern raised above the hat, hips empty, no second lantern, no rings` | 前摇（必须同 idle 那件袍） |
| `player-skill-b` | `cast pose only: lantern thrust forward, body braced, no shockwave ring, no particles` | 施放姿态 |

### 1.2 血猎手·卡珊德拉 — `hero-cassandra` / `-v` / `-skill-a` / `-skill-b`

```text
Vampire Survivors-like 2D game character sprite, [FRAME], hooded huntress silhouette,
ponytail as one silver spike shape (no face), compact silver crossbow as a 6-8px rectangle,
slight 3/4 elevated view, full body centered,
flat chunky pixel art, hard color blocks, max 6 regions,
dominant fill moon silver #E8F0FA, cyan #54E6C9 only on bolt tip 2px,
navy #0B0E14 and dark violet #131722 1-2px folds only, dark blood red tiny accent,
NO outline, NO brown leather, NO face, designed as 64x64 big-pixel sprite,
empty margin, transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `hero-cassandra` | `idle, crossbow at side, hood up, alert` |
| `hero-cassandra-v` | `idle breathe, cloak 1-2px, feet glued` |
| `hero-cassandra-skill-a` | `windup pose only: crossbow raised, body coiled, no attack FX` |
| `hero-cassandra-skill-b` | `cast pose only: crossbow kicked back as if just fired, no streak, no motion lines` |

### 1.3 夜祷修女·薇奥莱 — `hero-violet` / `-v` / `-skill-a` / `-skill-b`

```text
Vampire Survivors-like 2D game character sprite, [FRAME], nun silhouette,
white wimple as a moon-silver block, dark habit as silver folds not black mass,
exactly one candle, flame 2px cyan #54E6C9,
slight 3/4 elevated view, full body centered, no face,
flat chunky pixel art, max 6 regions,
dominant fill moon silver #E8F0FA, navy/violet 1-2px folds only,
NO outline, NO shockwave rings, designed as 64x64 big-pixel sprite,
empty margin, transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `hero-violet` | `idle, candle at chest height, upright habit A-shape` |
| `hero-violet-v` | `idle breathe, cloak 1-2px, feet glued` |
| `hero-violet-skill-a` | `windup pose only: candle raised, habit flared one block, no rings` |
| `hero-violet-skill-b` | `cast pose only: both arms out, still no concentric rings (engine FX)` |

### 1.4 狼裔·加尔文 — `hero-galvan` / `-v` / `-skill-a` / `-skill-b`

```text
Vampire Survivors-like 2D game character sprite, [FRAME], upright werewolf-blood humanoid,
wolf-head SILHOUETTE (ears as two silver triangles, no snout detail), short cape,
clawed hands as simple wedges,
slight 3/4 elevated view, full body centered,
flat chunky pixel art, max 6 regions,
dominant fill moon silver #E8F0FA,
dark blood red #7E1E1E ONLY as cape trim and two small beast-marks,
navy/violet 1-2px folds only, NO outline, NO gold,
designed as 64x64 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `hero-galvan` | `idle, slight hunch, claws down, ears up, cape still` |
| `hero-galvan-v` | `idle breathe, cloak 1-2px, feet glued` |
| `hero-galvan-skill-a` | `windup pose only: crouch, beast-marks a bit larger, no aura` |
| `hero-galvan-skill-b` | `cast pose only: claws out, marks brighter, SAME body scale as idle, no motion blur ghosts` |

---

## 2. 敌人（15 种 · 30 帧）

> idle `-v` = 呼吸 1.4fps（同剪影换步，禁止 stretch-compress）。步态等 `-walk-a/b`。默认朝右。普通敌无描边。精英：**双角**必须进剪影；描边归管线。  
> 40–68px：3~5 色块，零五官，零服装扣。

### 2.1 墓地（g1，6 种）

#### 行尸 `enemy-zombie` / `-v`（56×56）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], shambling corpse as a simple hunched block,
arms hanging, 3-5 flat color regions, no face, no clothes detail,
slight 3/4 elevated view, full body centered,
fill dark blood red #7E1E1E, shadows #0B0E14/#131722, tiny moon-silver skull glint 1px only,
NO outline, designed as 56x56 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-zombie` | `lurch pose A, left arm forward` |
| `enemy-zombie-v` | `lurch pose B, right arm forward` |

#### 血犬 `enemy-hound` / `-v`（48×48）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], lean quadruped blood hound silhouette,
compact body + two ear triangles, no face, 3-4 color blocks, same body length both frames,
slight 3/4 elevated view, fill #7E1E1E, shadows #0B0E14/#131722,
NO outline, designed as 48x48 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-hound` | `small step A, body length locked, no stretch` |
| `enemy-hound-v` | `small step B, body length locked, no compress` |

#### 墓穴甲虫 `enemy-beetle` / `-v`（40×40）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], tiny oval shell beetle,
3 color blocks only, no legs detail beyond 2 side nubs,
slight 3/4 elevated view, fill #7E1E1E, underside #0B0E14,
NO outline, designed as 40x40 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-beetle` | `scuttle A, oval wide` |
| `enemy-beetle-v` | `scuttle B, oval tilted` |

#### 亡魂 `enemy-wraith` / `-v`（56×56）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], legless ghost torso + ragged robe triangle,
3-4 flat blocks, no face, engine will show at 50% opacity,
slight 3/4 elevated view, fill moon silver #E8F0FA spectral body, wisps #0B0E14,
tiny cyan #54E6C9 1-2px core, NO outline,
designed as 56x56 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-wraith` | `glide A, robe up` |
| `enemy-wraith-v` | `glide B, robe sideways` |

#### 尸巫 `enemy-necro` / `-v`（68×68）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], hooded staff caster, hunched robe block,
crooked staff as one 8-10px stick, no face, 4-5 color blocks,
slight 3/4 elevated view, fill #7E1E1E + #131722 robe, tiny #B06AF0 2px staff glow,
NO outline, designed as 68x68 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-necro` | `shuffle A, staff planted` |
| `enemy-necro-v` | `shuffle B, staff slightly raised` |

#### 守墓者 `enemy-gravekeeper` / `-v`（96×96，精英）

```text
Vampire Survivors-like 2D elite enemy sprite, [FRAME], hulking grave keeper,
TWO purple-tinted horns on the hood (elite shape code, required),
rusty shovel as one large wedge on the shoulder, no face, 5-6 color blocks,
slight 3/4 elevated view, fill #7E1E1E, shadows #0B0E14/#131722, shovel glint #E8F0FA tiny,
NO outline (pipeline will add 3px purple), designed as 96x96 big-pixel sprite,
empty margin, transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-gravekeeper` | `heavy step A, shovel on shoulder` |
| `enemy-gravekeeper-v` | `heavy step B, shovel slightly raised` |

### 2.2 教堂（g2，5 种）

#### 血信徒 `enemy-acolyte` / `-v`（56×56）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], hooded acolyte block, tiny dagger wedge,
3-5 color blocks, no face, slight 3/4 elevated view,
fill #7E1E1E with darker robe #0B0E14/#131722, NO outline,
designed as 56x56 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-acolyte` | `advance A, dagger low` |
| `enemy-acolyte-v` | `advance B, dagger raised` |

#### 血蝠 `enemy-bat` / `-v`（40×40）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], flying bat as a wide V-wing + tiny head nub,
3 color blocks, slight 3/4 elevated view so wings read,
fill #7E1E1E, wing shadow #0B0E14, NO outline,
designed as 40x40 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-bat` | `flight A, wings up` |
| `enemy-bat-v` | `flight B, wings half folded` |

#### 圣杯侍僧 `enemy-cupbearer` / `-v`（64×64）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], robe block holding a chalice square,
a 4px rune diamond hovering above the head (summon mark), no face, 5 color blocks,
slight 3/4 elevated view, fill #7E1E1E, rune #F2F5F9 with tiny #B06AF0,
NO outline, designed as 64x64 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-cupbearer` | `walk A, chalice level, rune steady` |
| `enemy-cupbearer-v` | `walk B, chalice tilted, rune 1px larger` |

#### 血肉畸体 `enemy-fleshmass` / `-v`（96×96，精英）

```text
Vampire Survivors-like 2D elite enemy sprite, [FRAME], bloated multi-limb mass,
TWO horn-like bone spikes on top (elite shape code, required),
5-6 color blocks, no anatomy detail, slight 3/4 elevated view,
fill #7E1E1E, crevices #0B0E14, bone glint #E8F0FA tiny,
NO outline (pipeline 3px purple), designed as 96x96 big-pixel sprite,
empty margin, transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-fleshmass` | `lurch A, arms splayed` |
| `enemy-fleshmass-v` | `lurch B, mass contracted` |

#### 忏悔者 `enemy-penitent` / `-v`（56×56）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], hooded flogger block,
lantern as a 4x5 wedge with 2px blood-orange #FF3B30 warning core (projectile tell),
no face, 4-5 color blocks, slight 3/4 elevated view,
fill #7E1E1E, body #0B0E14/#131722, NO outline,
designed as 56x56 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-penitent` | `aim A, lantern forward` |
| `enemy-penitent-v` | `aim B, lantern raised (pose only, no thrown projectile)` |

### 2.3 狼穴（g3，4 种）

#### 灰狼 `enemy-greywolf` / `-v`（56×56）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], grey wolf quadruped silhouette,
ears + tail as simple triangles, 3-4 color blocks, no face,
slight 3/4 elevated view, fill dark violet #131722, shadow #0B0E14,
tiny #E8F0FA ear glint, muzzle accent #7E1E1E 1px, NO outline,
designed as 56x56 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-greywolf` | `lope A, front legs reaching` |
| `enemy-greywolf-v` | `lope B, legs gathered` |

#### 暗影狼 `enemy-shadowwolf` / `-v`（48×48）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], sleek low wolf smear,
3 color blocks, reddish-purple, no face, slight 3/4 elevated view,
fill #7E1E1E with #B06AF0 undertone 1px, wisps #0B0E14, NO outline,
designed as 48x48 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-shadowwolf` | `lope A, front legs reaching, body length locked` |
| `enemy-shadowwolf-v` | `lope B, legs gathered, body length locked, no coil-compress` |

#### 石甲狼 `enemy-stonewolf` / `-v`（96×96，精英）

```text
Vampire Survivors-like 2D elite enemy sprite, [FRAME], massive plated wolf,
TWO stone horn plates on the head (elite shape code, required),
5-6 color blocks, slight 3/4 elevated view,
fill #131722 plates, #0B0E14 gaps, #7E1E1E fur between plates, tiny #E8F0FA edges,
NO outline (pipeline 3px purple), designed as 96x96 big-pixel sprite,
empty margin, transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-stonewolf` | `prowl A, weight forward` |
| `enemy-stonewolf-v` | `prowl B, head low` |

#### 狼裔猎手 `enemy-wolfhunter` / `-v`（64×64）

```text
Vampire Survivors-like 2D enemy sprite, [FRAME], wolf-head humanoid with a spear stick,
4-5 color blocks, no face detail, slight 3/4 elevated view,
fill #7E1E1E, body #0B0E14/#131722, spear tip 2px #FF3B30 charge tell,
NO outline, designed as 64x64 big-pixel sprite, empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-wolfhunter` | `charge coil A, spear low` |
| `enemy-wolfhunter-v` | `charge coil B, spear back, lunging pose only, no warning line drawn` |

---

## 3. Boss（4 名 · 11 帧）

> 可密写主体，仍扁平色块 + VS 微俯。描边归管线（猩红 4px）。  
> `enemy-boss` 无 `-entrance`（复用待机帧）。其余 3 名有 `-entrance` 姿态，不要满屏特效环。

### 3.1 血月尊者 — `enemy-boss` / `enemy-boss-v`（240×240）

```text
Vampire Survivors-like 2D boss sprite, [FRAME], towering broken-vigilante silhouette,
tattered watcher robe as large silver-dark folds (not a painted illustration),
exactly ONE rusty lantern with BLOOD-ORANGE core #FF3B30 (mirror of the hero cyan lantern),
lantern body about 18-20px in a 240px canvas, slight 3/4 elevated view, full body centered,
flat chunky pixel art, hard blocks,
fill #7E1E1E rust and robe trim, #0B0E14/#131722 robe, tiny #E8F0FA edges,
NO gold, NO cyan lantern, NO outline (pipeline paints 4px scarlet),
empty margin, transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `enemy-boss` | `looming idle, lantern at side, robe pooling` |
| `enemy-boss-v` | `idle alternate, lantern slightly raised, head block tilted` |

### 3.2 血主教·尼禄 — `boss-cardinal` / `-v` / `-entrance`（256×256）

```text
Vampire Survivors-like 2D boss sprite, [FRAME], traitor cardinal silhouette,
tall miter as a gold-trimmed triangle #FFC93C, chalice as a cup block,
slight 3/4 elevated view, flat chunky pixel art,
fill #7E1E1E vestments, #0B0E14/#131722 shadows, gold ONLY on miter and chalice,
NO outline (pipeline 4px scarlet), empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `boss-cardinal` | `regal idle, chalice raised, miter tall` |
| `boss-cardinal-v` | `alternate, chalice lowered, arms spread` |
| `boss-cardinal-entrance` | `entrance pose: chalice high, robe flared, no mist storm, no full-screen rings` |

### 3.3 狼王·芬里厄 — `boss-fenrir` / `-v` / `-entrance`（256×256）

```text
Vampire Survivors-like 2D boss sprite, [FRAME], colossal wolf king,
mane as a crown of triangular fur blocks around the neck, glowing eye 2px #E8F0FA,
slight 3/4 elevated view, flat chunky pixel art,
fill #7E1E1E fur, #131722 mane, #0B0E14 shadows,
NO outline (pipeline 4px scarlet), empty margin,
transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `boss-fenrir` | `low stalk idle, mane bristled, tail out` |
| `boss-fenrir-v` | `head raised, jaws a simple V, mane flared` |
| `boss-fenrir-entrance` | `entrance pose: leaping forward, mane full, no howl ring FX` |

### 3.4 血月化身 — `boss-moonavatar` / `-v` / `-entrance`（256×256）

```text
Vampire Survivors-like 2D boss sprite, [FRAME], featureless humanoid of moonlight,
no weapon, no crown, no horns, semi-transparent intent (engine alpha 0.5),
slight 3/4 elevated view, flat chunky pixel art,
body #FFC93C and #FF3B30 same-hue blocks only (no new hues),
1.5px moon-silver #E8F0FA MATERIAL edge (not the faction outline),
NO 4px scarlet stroke in the raw image (pipeline adds faction outline separately),
empty margin, transparent or flat #0B0E14 void, no ground shadow, no text
```

| 帧 | [FRAME] |
| --- | --- |
| `boss-moonavatar` | `float idle, arms at sides` |
| `boss-moonavatar-v` | `float alternate, one arm raised` |
| `boss-moonavatar-entrance` | `entrance pose: descending, body a taller block, no full-screen beam storm` |

---

## 4. 产出与命名

| 项 | 规则 |
| --- | --- |
| 文件 | `assets/raw/<帧名>.png`（如 `player.png`），RGBA 或整块 `#0B0E14` 底 |
| 尺寸 | 原图 512² 即可；成品尺寸由管线落到契约（32/28/24/20/34/48/120/128） |
| 描边 | **原图不画**；管线后置 |
| 技能环 | **原图不画**；引擎 FX |
| 参考 | 角色用 v3.5 程序剪影 img2img；同一实体后续帧锁第一帧 |
| 备份 | 保留 raw，供重量化 |

---

## 5. 自检清单（交付前）

- [ ] 帧名与 `frame-registry.json` 完全一致
- [ ] 管线后尺寸精确（asset-spec v1.2 §2.2）
- [ ] **填充**包围盒 ≤90%（不含描边）；64px 角色一眼能叫出名字
- [ ] 32px 缩略仍见守夜人帽檐 + 灯点（风格锁门）
- [ ] 色板仅 14 token；玩家是银主体不是海军团
- [ ] 原图无身份描边；成品描边 = 管线（玩家冷青 / 精英幽紫 / Boss 猩红）
- [ ] 精英剪影有双角；拾取物双编码（三角/十字/菱形）不画进角色帧
- [ ] 技能帧无冲击环
- [ ] RGBA 或可抠的整块暗底，无棋盘格、无白底
