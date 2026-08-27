# 《血月守夜》AI 资产生成提示词 · 批次 2：标记 / 技能环 / 武器 / 超武

> 版本：v1.1 · 日期：2026-08-26 · 第一波 13 帧 + **第二波 19 帧**（武器 11 + `decal-bloodpool` + 超武 7）  
> 不下 40 个升级图标。批次 1 时间轴 17 FAIL 已于 2026-08-26 补绘。  
> 契约：`asset-spec-v1.md` §1.2 / §2.6 / §3.2 / §3.7；尺寸：`frame-specs.mjs`  
> 用法：主提示词 + 各帧变体。**环/粒子禁止画进角色 PNG**（本批本身就是环、弹体、召唤剪影）。

---

## 0. 全局硬约束（本批特效/弹体）

### 0.1 这不是角色立绘

```
Vampire Survivors-like detailed gothic PIXEL ART game SPRITE.
Hard-edge pixels, flat fills. NOT illustration, NOT 3D, NOT painterly.
ISOLATED object only. NO character, NO full body, NO ground plane, NO drop shadow.
NOT a UI button, NOT an app icon with rounded rectangle chrome.
```

视角：弹体可微俯；环与标记为正视平面符号（可读性优先）。不要钻石等轴、不要纯顶视帽盘。

### 0.2 画布

```
1. 整块墨夜蓝黑 #0B0E14 垫底（或透明）；禁止白底、禁止棋盘格
2. 主体居中，四周约 8% 空边（管线要 contain，且本批走「居中」不是脚底对齐）
3. 无文字、无水印、无签名、无外框
4. 环类：必须空心（中间是底色，禁止实心圆盘）
5. 标记类（引擎会 tint）：主体画纸白 #F2F5F9，不要预涂幽紫/冷青（乘色会脏）
```

原图 512²、`1:1` 即可。按契约像素档想形状（8 / 16 / 32 / 64），不要当 1024 插画画。

### 0.3 14 token（本批只用到的）

| token | hex | 本批用途 |
| --- | --- | --- |
| 墨夜蓝黑 | `#0B0E14` | 垫底 |
| 暗紫灰 | `#131722` | 环上 1px 暗齿（可选） |
| 月银白 | `#E8F0FA` | 箭体、卡桑德拉/狼裔环 |
| 冷青 | `#54E6C9` | 箭羽、守夜人/修女环、灯芯语义 |
| 幽紫 | `#B06AF0` | **不要画进 marker-aura**（引擎 tint） |
| 血橙红 | `#FF3B30` | 冲击波环、警告线 |
| 暗血红 | `#7E1E1E` | 狼裔环内缘 1~2 个齿，禁止当主色 |
| 青绿 | `#43D17C` | 修女环内缘微齿 |
| 纸白 | `#F2F5F9` | 可 tint 标记、环上高光 |

**禁色**：brown, tan, beige, gold, orange metal, painted lighting, rainbow.

### 0.4 通用负向

```
blurry, 3d render, gradient, bloom, glow halo, realistic photo,
checkerboard, white background, ground shadow, text, watermark,
character, face, full body, leather, extra objects, filled disk instead of ring,
UI chrome, app icon, rounded rectangle button
```

---

## 1. 行为标记（6）

引擎：`StatusMarkerLayer`。`marker-aura/rune/stun/slow/mark` 到货后自动换帧；`marker-warningline` 本波仍走 Graphics，PNG 入库备用。  
**可 tint 标记一律纸白主体。**

### 1.1 `marker-aura` · 32×32 · 尸巫脚下环

引擎 tint `#B06AF0`、缩到约 88px 呼吸。

**[FRAME]** 空心细环，纸白 `#F2F5F9`，线宽约 2px（按 32px 语言），正圆，居中。环内完全是底色空洞。不要符文、不要实心圆、不要角色。

### 1.2 `marker-rune` · 16×16 · 侍僧头顶圣杯

引擎 tint 纸白。形状编码 = 圣杯。

**[FRAME]** 极简圣杯剪影：杯身 + 短柄 + 底座，纸白 `#F2F5F9`。16px 语言，3~4 色块，无五官、无液体高光油画。居中。

### 1.3 `marker-warningline` · 32×8 · 猎手警告线（全幅）

管线 `full-bleed`。引擎本波仍画 Graphics。

**[FRAME]** 一条水平血橙红 `#FF3B30` 实心长条，上下留窄底色。不要箭头、不要文字、不要渐变。想成 32×8 像素条，不是正方形插画（生成用 1:1 时把条子放画面正中水平）。

### 1.4 `marker-stun` · 8×8 · 眩晕星

**[FRAME]** 四角星/火花，纸白 `#F2F5F9`，8px 语言，居中，四周空边。禁止复杂曼陀罗。

### 1.5 `marker-slow` · 8×8 · 减速螺旋

**[FRAME]** 极简螺旋或逗号涡，纸白 `#F2F5F9`（引擎再 tint 冷青）。8px，居中。

### 1.6 `marker-mark` · 8×8 · 标记箭头

**[FRAME]** 朝下小箭头（头顶标记），纸白 `#F2F5F9`（引擎 tint 月银白）。8px，居中。

---

## 2. 主动技专属环（4）· 64×64 · effects

引擎可选叠一层扩散 Image；粒子环仍在。环必须空心。不要画进角色。

### 2.1 `skill-ring-edmund` · 提灯闪耀

**[FRAME]** 双层空心环：外环冷青 `#54E6C9`，内环更细纸白 `#F2F5F9`。圣辉、提灯语义，无灯具实体、无角色。64px 语言。

### 2.2 `skill-ring-cassandra` · 血影突袭（入库；冲刺主视觉仍是轨迹）

**[FRAME]** 空心月银白 `#E8F0FA` 环，环上可有一处刃口缺口（银刃）。不要红色主导。无角色。

### 2.3 `skill-ring-violet` · 安魂曲

**[FRAME]** 空心冷青 `#54E6C9` 外环 + 内缘 3~4 个青绿 `#43D17C` 微齿（回血）。无角色、无乐谱文字。

### 2.4 `skill-ring-galvan` · 血月狂化

**[FRAME]** 空心月银白环为主；内缘最多 3 个暗血红 `#7E1E1E` 小齿（兽纹）。**禁止红色当主色**。无角色。

---

## 3. Demo 武器精修（3）

### 3.1 `missile` · 16×12 · characters · 血月猎手（银制月光箭）

默认朝 **右**（引擎按速度 `rotation`）。双编码画进帧内：

- 箭体月银白 `#E8F0FA`，箭头右侧 2px 纸白高光
- 尾羽在 **左**，冷青 `#54E6C9` 1~2px（月光通道）
- 无弓、无角色、无拖尾粒子（拖尾走 `p-streak`）

**[FRAME]** 一枚扁平像素箭，水平朝右，16×12 语言，居中。

### 3.2 `orb` · 20×20 · characters · 守夜之环

**[FRAME]** 冷青 `#54E6C9` 实心圆 + 1px 同色描边 + 左上纸白高光点。20px 语言。不是星球插画、无大陆纹理。

### 3.3 `shockwave` · 32×32 · 打包进 characters；局内 `effects` 帧宽=baseSize 不可变

**[FRAME]** 血橙红 `#FF3B30` **双层空心环** + 中心小点（α 可略低）。与程序剪影同构：外环粗、内环细。禁止实心圆盘、禁止角色。

---

## 4. 后处理

```
assets/raw/<帧名>.png
→ 抠图（warningline 全幅）→ 居中装框（本批 FX/弹体不走角色脚底对齐）
→ 14 token 量化 → assets/frames/<帧名>.png
→ pack.mjs
```

局内：`characters-ext` 覆盖 `missile`/`orb`；`shockwave` 再拷到 `effects`；`effects-ext` 的 `marker-*` 并入 `fx-ambient`。

---

## 5. 其余武器（11）+ 血池贴花

弹体默认朝 **右**（引擎按速度 `rotation`）。召唤物 = **玩家侧**：月银白主体 + 冷青 1px 语义，禁止敌血红当主色。环必须空心。`decal-bloodpool` 例外：实心池面（全幅贴花）。**禁金、禁橙金属。**

### 5.1 `proj-crossbow` · 16×16 · 银针连弩

**[FRAME]** 一根极细水平银针，朝右。针体月银白 `#E8F0FA`，针尖右侧 1px 纸白。尾在左，冷青 `#54E6C9` 1px。无弩、无角色、无拖尾粒子。16px 语言，居中。

### 5.2 `proj-blunderbuss` · 16×16 · 圣银火铳

**[FRAME]** 一颗短粗银弹丸/霰弹粒，略扁椭圆，朝右微尖。月银白主体 + 左上纸白高光。无枪、无角色。16px 语言，居中。

### 5.3 `proj-boomerang` · 16×16 · 幽灵飞刃

**[FRAME]** 月牙弯刃，开口向左、刃尖朝右（可旋转）。月银白 `#E8F0FA`，刃口 1px 冷青。无手、无角色。16px 语言，居中。

### 5.4 `proj-javelin` · 16×16 · 骨钉标枪

**[FRAME]** 粗骨钉标枪水平朝右。杆/骨月银白，钉头右侧可 1~2px 暗血红 `#7E1E1E`（血术，禁止整根染红）。尾在左。无持枪人。16px 语言，居中。

### 5.5 `orb-thorn` · 20×20 · 荆棘圣环

**[FRAME]** 冷青 `#54E6C9` 实心圆（比 `orb` 略同）+ 外缘 4~6 个短刺。刺同色或纸白。左上高光点。不是星球、无角色。20px 语言，居中。

### 5.6 `aura-barrier` · 64×64 · 圣光壁垒

**[FRAME]** **空心**防护环：外环冷青 `#54E6C9`，内环更细纸白。中间必须是底色空洞。可有 3~4 个微齿。无角色、无实心圆盘。64px 语言。

### 5.7 `ring-bloodpool` · 64×64 · 血池喷涌（圈）

**[FRAME]** **空心**地面池圈：外环暗血红 `#7E1E1E`，外缘 1px 血橙红 `#FF3B30`。中间空洞。禁止实心圆盘、禁止角色。64px 语言。

### 5.8 `decal-bloodpool` · 64×64 · effects · 池内贴花（全幅）

**[FRAME]** 实心暗红椭圆血池（顶视），`#7E1E1E` 填充 + `#FF3B30` 1~2px 描边 + 内圈浅波纹。无角色、无墓碑。这是贴花不是 UI 图标。

### 5.9 `ring-holyfire` · 64×64 · 审判圣火

**[FRAME]** **空心**圣火圈：外环冷青 `#54E6C9`，内缘 4~6 个纸白/冷青火焰齿（向上）。**禁止金色、禁止橙金属**。中间空洞。无角色。64px 语言。

### 5.10 `summon-bat` · 16×16 · 血蝠群（玩家侧）

**[FRAME]** 极小蝠剪影，展翼，默认朝右。主体月银白 `#E8F0FA`，翼缘可 1px 冷青。禁止暗红当主色（那是敌蝠）。无五官油画。16px 语言。

### 5.11 `summon-hound` · 32×32 · 狼影猎犬（玩家侧）

**[FRAME]** 侧视猎犬剪影，朝右，四足。主体月银白 + 冷青 1px 语义。禁止敌血红填充。无项圈金牌、无角色主人。32px 语言，脚可靠下沿。

### 5.12 `beam-chain` · 32×64 · 断罪锁链

**[FRAME]** 竖直锁链（沿画布长边），中心轴对齐。链节月银白，缝 1px 冷青。无持链人、无钩在怪物上。想成 32×64 像素条，生成 1:1 时把链条放画面正中竖直。

---

## 6. 超武覆盖帧（7）

超武 = 主武器帧 + 本帧光效质变（asset-spec §3.7）。仍是孤立物体，不是角色立绘。比对应主武器「多一圈 / 更密的齿 / 双环」，不要换色相、不要金色。

### 6.1 `super-moonwrath` · 16×16 · 血月天罚

**[FRAME]** 朝右月光箭，比 `missile` 更粗；箭体月银白，尾羽冷青，箭头可加 1px 纸白芒。无角色。

### 6.2 `super-silverblast` · 16×16 · 血银霰弹

**[FRAME]** 比火铳弹更胀的银霰粒，月银白 + 四周 3~4 个纸白火花齿（爆炸语义）。无枪。居中。

### 6.3 `super-seraphring` · 20×20 · 炽天使之环

**[FRAME]** 冷青大球，比 `orb` 更大更亮；外缘一圈细纸白齿。不是金色光环、无翅膀人物。

### 6.4 `super-totaleclipse` · 32×32 · 月全食

**[FRAME]** **双层空心环**（比 `shockwave` 多一环），外冷青内纸白，或外月银白内冷青。中心小点。禁止实心盘、禁止角色。

### 6.5 `super-bloodsea` · 64×64 · 血海

**[FRAME]** **空心**大血池圈，比 `ring-bloodpool` 更粗；外 `#7E1E1E` + 外缘纸白闪齿（白闪）。中间空洞。禁止金色。

### 6.6 `super-batstorm` · 16×16 · 血蝠风暴

**[FRAME]** 月银白蝠，翼比 `summon-bat` 略张。冷青翼缘。禁止暗红主色。

### 6.7 `super-packleader` · 32×32 · 狼群领袖

**[FRAME]** 月银白猎犬朝右，额上 1~2px 冷青冠/纹（领袖）。禁止金冠、禁止敌血红主体。

---

## 7. 第二波后处理

```
assets/raw/<帧名>.png
→ 抠图（decal-bloodpool 全幅）→ 弹体/环/超武居中；summon-hound 仍脚底对齐
→ 14 token 量化 → assets/frames/<帧名>.png
→ pack.mjs
```

局内：`characters-ext` 覆盖 `proj-*` / `orb-thorn` / `aura-*` / `ring-*` / `summon-*` / `beam-chain` / `super-*`；`decal-bloodpool` 走 `effects-ext`。缺帧回退 `missile` / `orb` / `shockwave`。
