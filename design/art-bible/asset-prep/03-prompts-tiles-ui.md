# 《血月守夜》AI 资产生成提示词 · 批次 3：地砖 / 障碍 / 装饰 / 贴花 / 局内 UI

> 版本：v1.0 · 日期：2026-08-26  
> **不下 40 个升级图标、不下 6 个图鉴事件、不下其余 18 个武器槽。**  
> 本批目标：三张地图地面 + 障碍/装饰入局，HUD 三武器槽 + 四主动技图标 + 技能按钮能对上整体观感。  
> 契约：`asset-spec-v1.md` §1.4 / §1.5 / §1.6；尺寸：`frame-specs.mjs`

---

## 0. 全局硬约束

### 0.1 地砖（`tile-*`）≠ 立绘

```
Vampire Survivors-like detailed gothic PIXEL ART seamless TILE TEXTURE.
Hard-edge pixels, flat fills. NOT illustration, NOT 3D, NOT painterly, NOT photo.
FULL BLEED square: paint edge to edge. NO character, NO UI chrome, NO text, NO frame.
Seamless repeating: left matches right, top matches bottom.
Ground luminance 12–18%, low saturation, must not overpower characters.
Top-down orthographic floor, not isometric diamond, not 3/4 portrait.
```

### 0.2 障碍 / 装饰（`obst-*` / `decor-*`）= 孤立物件

```
Vampire Survivors-like detailed gothic PIXEL ART game SPRITE.
ISOLATED object only on solid ink-navy #0B0E14.
Micro-overhead (Vampire Survivors), not top-down cap, not isometric diamond.
Object base near bottom, ~8% empty margin. NO drop shadow, NO ground plane, NO character.
```

`decor-church-glasslight` 例外：居中光斑贴花，不是落地物件。

### 0.3 14 token（本批用到的）

| token | hex | 本批用途 |
| --- | --- | --- |
| 墨夜蓝黑 | `#0B0E14` | 垫底 / 缝 |
| 暗紫灰 | `#131722` | 石板、UI 底 |
| 灰蓝 | `#2A3346` | 障碍石、墙 |
| 草地底 | `#18201C` | 草地 / 狼穴草 |
| 草叶 | `#2A3B2E` | 短草，禁止亮柠绿 |
| 暗血红 | `#7E1E1E` | 血迹贴花（低面积） |
| 地毯底 | `#3A2426` | 教堂地毯（装饰，不是危险） |
| 岩地 | `#241F1C` / `#332B26` | 狼穴土 |
| 月银白 | `#E8F0FA` | 石高光极少量 |
| 冷青 | `#54E6C9` | 圣辉细缝 / UI 描边；禁止大面积铺地 |
| 治疗绿 | `#43D17C` | **仅** `heal` |
| 信息蓝 | `#4FC3F7` | **仅** `gem` |
| 纸白 | `#F2F5F9` | UI 图形主体 |
| 血橙红 | `#FF3B30` | `tile-trap` 斜纹危险编码 |

**禁色**：gold `#FFC93C` 铺地/玩家侧、brown tan beige、rainbow、亮草绿。地毯暗红 ≠ 血池斜纹。

### 0.4 通用负向

```
blurry, 3d render, gradient, bloom, glow halo, realistic photo,
checkerboard, white background, text, watermark, character, face,
isometric diamond tiles, UI window chrome on tiles
```

---

## 1. 地砖 9 帧（全幅 64×64 · effects）

| 帧名 | 内容 |
| --- | --- |
| `tile-ground` | 共享石板：`#131722` 底 + 3×3 暗缝 + 风化斑，明度 12–18% |
| `tile-grass` | 共享草地：`#18201C` + 短草叶 `#2A3B2E`，禁止治疗绿 |
| `tile-grave-soil` | 墓地土：更冷的灰褐土 + 稀疏碎石，比石板更「土」 |
| `tile-church-stone` | 教堂冷灰砖，错缝砌，比墓地石板更冷、更「室内」 |
| `tile-church-carpet` | 低饱和暗红地毯 + 菱形暗纹；可有极淡冷青缝线；**禁止红斜纹/白描边**（那是血池） |
| `tile-den-earth` | 狼穴岩地：`#241F1C` + 碎石裂纹 |
| `tile-den-grass` | 比共享草地更暗更密的短草 |
| `tile-obstacle` | 可平铺石墙/断垣材质（灰蓝 `#2A3346`，顶缘微亮、底缘微暗） |
| `tile-trap` | 危险贴花：暗红底 + 血橙红斜纹 + 暗示闪烁，边缘可 1px 纸白 |

## 2. 障碍 7 帧（抠图 · 64×64 · effects）

墓碑、断篱、立柱、长椅、祭坛、巨石、倒木。实心可读，顶高光底阴影。

## 3. 装饰 7 帧

枯树 / 墓烛 / 兽骨；彩玻光斑（居中）；狼穴兽骨 / 篝火 / 尖刺。

## 4. 贴花 + 拾取

`decal-rock` / `decal-grass` / `decal-blood`：孤立小物件，居中抠图。  
`gem`：信息蓝菱。`heal`：纸白或治疗绿十字（引擎会再 tint 绿）。

## 5. 局内 UI（本批只这些）

| 帧名 | 尺寸 | 内容 |
| --- | --- | --- |
| `wslot-missile` | 64² | HUD 弹幕槽：蓝紫底 `#131722` + 冷青描边 + 月银箭 |
| `wslot-orb` | 64² | 环绕球槽 |
| `wslot-shockwave` | 64² | 冲击波槽 |
| `skill-edmund` | 64² | 提灯闪耀 |
| `skill-cassandra` | 64² | 血影突袭 |
| `skill-violet` | 64² | 安魂曲 |
| `skill-galvan` | 64² | 血月狂化 |
| `hud-skillbtn` | 96² | 移动端技能按钮底 |

**明确不做**：`upg-*` ×40、其余 `wslot-*`、`codex-event-*` ×6、`chest`（可下一批）。
