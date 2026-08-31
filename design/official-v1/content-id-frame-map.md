# 《血月守夜》内容 ID ↔ 帧名 slug 映射表（content-id-frame-map）

> 版本：v1.3（C-1~C-3 UI 帧名冻结编入：天赋树节点 22 + 圣物背包图标 5 + 专武徽记 8，见 §5A）· 日期：2026-08-31 · 作者：文策渊（设计策略师） / TA 回填
> 上游引用：`content-design-outline.md` §1.3（内容 ID 规范）· `asset-spec-v1.md` §2.1.1（帧名契约：`<类目前缀>-<slug>[-<后缀>]`，全小写 ASCII 连字符）· `asset-spec-v1.md` §1.1~§1.6（各资产帧名）· `asset-production-order-v1.md` v1.2
> 用途：**闭合 CONCERN C2**——供美术规格全局替换与工程帧名注册表对照；M4 资产集成以本表为唯一映射基准。
> 说明：✅ = Demo 保留帧名（不可改名，无痛替换基准）；🔵 = 新增帧名（已冻结）；全部内容 ID ↔ 帧名一一对应，无歧义。
> v1.1：R-C3-RULING 新增 `enemy_g1_6 守墓者`。v1.2：对齐 gdd-enemies-v3 / 专武 / 圣物层；当时未冻 `tree-q-*`、C-2、C-3。v1.3：**C-1~C-3 全量编入冻结**（35 帧全部对应引擎真实内容 ID，逐一核对 `talent-tree.ts` / `exclusive.ts`，无半截补造；见 §5A）。

---

## 1. 角色（4）

| 内容 ID | 角色 | powerTag | 帧名（引擎引用） | 说明 |
|---|---|---|---|---|
| hero_edmund | 守夜人·艾德蒙 | HALLOWED | ✅ `player` / `player-v` / 🔵 `player-skill-a` / `player-skill-b` | Demo 保留；提灯手持画进帧内（`player-lantern-close` 道具槽可选打包，不入引用表） |
| hero_cassandra | 血猎手·卡珊德拉 | SILVER | 🔵 `hero-cassandra` / `-v` / `-skill-a` / `-skill-b` | — |
| hero_violet | 夜祷修女·薇奥莱 | HALLOWED | 🔵 `hero-violet` / `-v` / `-skill-a` / `-skill-b` | — |
| hero_galvan | 狼裔·加尔文 | BEAST | 🔵 `hero-galvan` / `-v` / `-skill-a` / `-skill-b` | 玩家侧剪影（人形 + 冷青 2px 描边），暗红仅 accent（R-A） |

## 2. 武器（14）+ 超武（7）

| 内容 ID | 武器 | 类 | 帧名 | 说明 |
|---|---|---|---|---|
| wpn_a_1 | 血月猎手 | A | ✅ `missile` | Demo 保留；银制月光箭双编码画进帧内 |
| wpn_a_2 | 银针连弩 | A | 🔵 `proj-crossbow` | — |
| wpn_a_3 | 圣银火铳 | A | 🔵 `proj-blunderbuss` | 多发实例 |
| wpn_a_4 | 幽灵飞刃 | A | 🔵 `proj-boomerang` | 旋转残影 |
| wpn_a_5 | 骨钉标枪 | A | 🔵 `proj-javelin` | 贯穿尾迹 |
| wpn_b_1 | 守夜之环 | B | ✅ `orb` | Demo 保留 |
| wpn_b_2 | 荆棘圣环 | B | 🔵 `orb-thorn` | — |
| wpn_b_3 | 圣光壁垒 | B | 🔵 `aura-barrier` | 半透明光环 |
| wpn_c_1 | 月蚀脉冲 | C | ✅ `shockwave` | Demo 保留；帧宽=baseSize 不可变 |
| wpn_c_2 | 血池喷涌 | C | 🔵 `ring-bloodpool` + `decal-bloodpool` | 地面池圈 + 池内贴花 |
| wpn_c_3 | 审判圣火 | C | 🔵 `ring-holyfire` | 地面火圈 |
| wpn_d_1 | 血蝠群 | D | 🔵 `summon-bat` | 玩家侧色系（R-D） |
| wpn_d_2 | 狼影猎犬 | D | 🔵 `summon-hound` | 玩家侧色系（R-D） |
| wpn_d_3 | 断罪锁链 | D | 🔵 `beam-chain` | 中心轴对齐按长度拉伸 |

| 内容 ID | 超武 | 主武器 | 帧名（super 覆盖帧） |
|---|---|---|---|
| evo_moonwrath | 血月天罚 | 血月猎手 | 🔵 `super-moonwrath` |
| evo_silverblast | 血银霰弹 | 圣银火铳 | 🔵 `super-silverblast` |
| evo_seraphring | 炽天使之环 | 守夜之环 | 🔵 `super-seraphring` |
| evo_totaleclipse | 月全食 | 月蚀脉冲 | 🔵 `super-totaleclipse` |
| evo_bloodsea | 血海 | 血池喷涌 | 🔵 `super-bloodsea` |
| evo_batstorm | 血蝠风暴 | 血蝠群 | 🔵 `super-batstorm` |
| evo_packleader | 狼群领袖 | 狼影猎犬 | 🔵 `super-packleader` |

> 超武 = 复用主武器帧 + super 光效覆盖帧（同图集运行时叠加），不另出整套动画。

### 2.1 专武弹体 / 召唤（v1.2）

| 内容 ID | 内容 | 帧名 | 说明 |
|---|---|---|---|
| xw_revolver | 圣徒左轮弹 | 🔵 `proj-revolver` | 16×16；选择卡见 §5 `exw-card-revolver` |
| xw_longbow | 月痕长弓箭 | 🔵 `proj-longbow` | 16×16 |
| xw_twinblades | 血契双刃弹 | 🔵 `proj-twinblade` | 16×16（帧名单数 twinblade） |
| xw_bell | 守誓者 | 🔵 `summon-oathkeeper` / `-v` / `-tombstone` | 48×48；墓碑同族同尺寸 |
| xw_horn | 月狼 | 🔵 `summon-moonwolf` / `-v` | 48×48；画 1 只（场上限是规则） |

破旧提灯 / 十字 / 斧 无独立弹体帧（灯环、落点、近战走程序层）。立绘卡 8 张见 §5 `xw_cards`。

## 3. 敌人（17）+ Boss（4）

| 内容 ID | 敌人 | 地图 | 层级 | 帧名 |
|---|---|---|---|---|
| enemy_g1_1 | 行尸 | 墓地 | 普通 | ✅ `enemy-zombie` / `-v` |
| enemy_g1_2 | 血犬 | 墓地 | 普通·快速 | ✅ `enemy-hound` / `-v` |
| enemy_g1_3 | 墓穴甲虫 | 墓地 | 普通·廉价 | 🔵 `enemy-beetle` / `-v` |
| enemy_g1_4 | 亡魂 | 墓地 | 普通·相位 | 🔵 `enemy-wraith` / `-v` |
| enemy_g1_5 | 尸巫 | 墓地 | 普通·光环 | 🔵 `enemy-necro` / `-v` |
| enemy_g1_6 | 守墓者 | 墓地 | 精英 | 🔵 `enemy-gravekeeper` / `-v` |
| enemy_g1_7 | 腐朽骑士 | 墓地 | 方阵专属（视觉 96） | 🔵 `enemy-decayedknight` / `-v` |
| enemy_g1_8 | 掷骨者 | 墓地 | 精英·远程 | 🔵 `enemy-bonethrower` / `-v` |
| enemy_g2_1 | 血信徒 | 教堂 | 普通 | 🔵 `enemy-acolyte` / `-v` |
| enemy_g2_2 | 血蝠 | 教堂 | 普通·空中 | 🔵 `enemy-bat` / `-v` |
| enemy_g2_3 | 圣杯侍僧 | 教堂 | 普通·召唤 | 🔵 `enemy-cupbearer` / `-v` |
| enemy_g2_4 | 血肉畸体 | 教堂 | 精英 | 🔵 `enemy-fleshmass` / `-v` |
| enemy_g2_5 | 忏悔者 | 教堂 | 精英·远程（升档 96） | 🔵 `enemy-penitent` / `-v` |
| enemy_g3_1 | 灰狼 | 狼穴 | 普通·快速 | 🔵 `enemy-greywolf` / `-v` |
| enemy_g3_2 | 暗影狼 | 狼穴 | 普通·高速 | 🔵 `enemy-shadowwolf` / `-v` |
| enemy_g3_3 | 石甲狼 | 狼穴 | 精英 | 🔵 `enemy-stonewolf` / `-v` / `-broken` / `-broken-v` |
| enemy_g3_4 | 狼裔猎手 | 狼穴 | 普通·冲锋 | 🔵 `enemy-wolfhunter` / `-v` |

| 内容 ID | Boss | 地图 | 帧名 | 角饰/剪影要点 |
|---|---|---|---|---|
| boss_1 | 血月尊者 | 墓地 | ✅ `enemy-boss` / `-v` | 残破守夜袍 + 锈蚀初代提灯（灯内血色光，B9） |
| boss_2 | 血主教·尼禄 | 教堂 | 🔵 `boss-cardinal` / `-v` / `-entrance` | 主教冠冕 + 圣杯 |
| boss_3 | 狼王·芬里厄 | 狼穴 | 🔵 `boss-fenrir` / `-v` / `-entrance` | 狼鬃王冠 |
| boss_4 | 血月化身 | 任意 | 🔵 `boss-moonavatar` / `-v` / `-entrance` | 半透明猩红金·月光人形·无角饰·边缘月白描边 |

## 4. 地图（3）

| 内容 ID | 地图 | 地面帧 | 障碍帧 | 装饰/危险帧 |
|---|---|---|---|---|
| map_graveyard | 月下墓地 | ✅ `tile-ground` / `tile-grass` / 🔵 `tile-grave-soil` | 🔵 `obst-grave-tomb` / `obst-grave-fence` | 🔵 `decor-grave-tree` / `decor-grave-candle` / `decor-grave-bone` |
| map_cathedral | 血教堂 | 🔵 `tile-church-stone` / `tile-church-carpet` | 🔵 `obst-church-pillar` / `obst-church-bench` / `obst-church-altar` | 🔵 `decor-church-glasslight`；危险区 `decal-bloodpool` |
| map_den | 狼穴 | 🔵 `tile-den-earth` / `tile-den-grass` | 🔵 `obst-den-rock` / `obst-den-log` | 🔵 `decor-den-bone` / `decor-den-fire` / `decor-den-spike` |

共享帧：`tile-obstacle`（通用障碍）· `tile-trap`（危险贴花，可选）· `moon` / `vignette` / `decal-rock` / `decal-grass` / `decal-blood`

## 5. 升级池（40）+ 主动技（4）+ 图鉴（35）

| 内容 | 帧名 | 说明 |
|---|---|---|
| 升级池图标 ×40 | 🔵 `upg-<key>` | key = 内容 ID 后缀（up_g_1 → upg-g-1；up_w_a1 → upg-w-a1；key_scope → upg-key-scope；up_a_cd → upg-a-cd） |
| 武器槽图标 ×21 | 🔵 `wslot-<slug>` | slug = 武器/超武帧名去前缀（missile → wslot-missile；super-moonwrath → wslot-super-moonwrath） |
| 主动技图标 ×4 | 🔵 `skill-edmund` / `skill-cassandra` / `skill-violet` / `skill-galvan` | 对齐英雄 slug |
| 主动技按钮（移动） | 🔵 `hud-skillbtn` | 视觉 96×96 / 热区 ≥44；冷却转圈引擎绘制 |
| 图鉴条目 ×35 | 🔵 `codex-event-<id>` ×6 + 复用角色/敌人/武器帧 | 事件条目专属帧；战斗条目复用实体帧 |
| 治疗道具 | ⏸ `heal`（M3 随修女落地） | 预留 |
| 稀有宝箱 | 🔵 `chest` | 血月化身掉落（升级三选一箱；**不是**圣髑匣） |
| 专武选择卡 ×8 | 🔵 `exw-card-lantern` / `revolver` / `twinblade` / `longbow` / `bell` / `cross` / `axe` / `horn` | 内容 ID `xw_cards`；样张最长边 512 |
| 复活灯焰 / 余辉货币 | 🔵 `hud-revive` / `hud-merit-glow` | 24×24；余辉**不可**复用旧 merit 加成卡 |
| 敌头顶状态 | 🔵 `sticon-hard` / `sticon-soft` / `sticon-vuln` | 24×24；引擎 tint |
| 席位角标 / 卡类徽记 | 🔵 `seat-p1`~`p5` / `badge-mech` / `badge-num` / `badge-evo` | 32×32 |
| 共鸣覆盖小徽记 | 🔵 `reso-ready` / `reso-awaiting` / `reso-achieved` | 16×16 |

C-1～C-3 见 **§5A**（已冻结）。

## 5A. 滤月余辉天赋树节点（22）· 圣物背包图标（5）· 专武徽记（8）—— C-1~C-3 冻结（v1.3）

> 来源：`ui-frame-freeze-c1-c3-v1.md` v1.0（像素君 · 2026-08-31）。**工程拆包（v1.3 后）**：本 35 帧入 **`ui-slots`**（桌面 64；移动 48 运行时缩放，不另出帧名）。512 立绘 `exw-card-*` 入 **`ui-portraits`**（从 `ui` 拆出，因 8×512 已把 `ui` 撑到 2048²）。HUD / `upg-*` / `wslot-*` 仍在 **`ui`**。三态 tint，帧只画常态。本节只登记冻名表上的完整 ID（引擎节点 ID 逐一核对 `talent-tree.ts` / `exclusive.ts`），不补任何半截项。

### 5A.1 天赋树节点（C-1 · 22）

> P1-3 开局树来源徽记复用 `tree-q-b` / `tree-q-d` / `tree-q-s1`（引擎缩小档 + tint），不另开帧名。

| 内容 ID（引擎节点） | 节点 | 帧名 | 备注 |
|---|---|---|---|
| q_a | 认灯（树根·默认习得） | 🔵 `tree-q-a` | — |
| q_b | 伴灯 | 🔵 `tree-q-b` | — |
| q_c | 残焰托誓 | 🔵 `tree-q-c` | — |
| q_d | 携行旧兵 | 🔵 `tree-q-d` | — |
| q_e | 再燃 | 🔵 `tree-q-e` | — |
| q_f1 | 首猎之赏 | 🔵 `tree-q-f1` | — |
| q_f2 | 二赏 | 🔵 `tree-q-f2` | — |
| q_f3 | 三钟 | 🔵 `tree-q-f3` | — |
| q_s1 | 银炉预热 | 🔵 `tree-q-s1` | — |
| q_s3 | 遗言余烬 | 🔵 `tree-q-s3` | — |
| q_s4 | 双灯并祀 | 🔵 `tree-q-s4` | — |
| a_attack / a_attack_2 | 攻击（Ⅰ/Ⅱ） | 🔵 `tree-a-atk` | 双点位共用帧 |
| a_damage / a_damage_2 | 伤害（Ⅰ/Ⅱ） | 🔵 `tree-a-dmg` | 双点位共用帧 |
| a_attack_speed | 攻速 | 🔵 `tree-a-aspd` | 单节点 maxPurchases 2 |
| a_cooldown | 冷却 | 🔵 `tree-a-cdr` | 单节点 maxPurchases 2 |
| a_xp_gain / a_xp_gain_2 | 经验获取（Ⅰ/Ⅱ） | 🔵 `tree-a-exp` | 双点位共用帧 |
| a_magnet / a_magnet_2 | 磁力（Ⅰ/Ⅱ） | 🔵 `tree-a-magnet` | 双点位共用帧 |
| a_life / a_life_2 | 生命（Ⅰ/Ⅱ） | 🔵 `tree-a-hp` | 双点位共用帧 |
| a_move_speed | 移速 | 🔵 `tree-a-spd` | 单节点 maxPurchases 2 |
| a_heal_efficiency | 治疗效能 | 🔵 `tree-a-heal` | 单节点 maxPurchases 2 |
| a_pickup_radius | 拾取半径 | 🔵 `tree-a-pickup` | 单节点 maxPurchases 2 |
| br_edmund_top / br_cassandra_top / br_violet_top / br_galvan_top | 同袍之诺（四角色支线顶点） | 🔵 `tree-peak` | ×4 共用帧 |

### 5A.2 圣物背包图标（C-2 · 5）

> 背包/图鉴静态图标；局内演出覆盖帧走 §6 `relic-*`（B-5 effects 图集），两组勿混淆（符号锚点对齐）。

| 内容 ID | 圣物 | 帧名 |
|---|---|---|
| relic_moonfall | 月蚀之陨 | 🔵 `relic-icon-mooneclipse` |
| relic_bloodtide | 血海退潮 | 🔵 `relic-icon-bloodtide` |
| relic_twelve_lamps | 十二灯誓约 | 🔵 `relic-icon-twelvelamps` |
| relic_silver_tide | 银潮汐 | 🔵 `relic-icon-silvertide` |
| relic_wolf_spirit | 狼灵巡夜 | 🔵 `relic-icon-wolfspirit` |

### 5A.3 专武徽记（C-3 · 8）

> 与立绘 slug 一一对应（立绘帧名 `exw-card-<slug>` 待 S-1 冻结另编）；取色按 ui-redesign-handoff v1.1 表 T-1；不画光晕（底光走 DOM 层 CSS 渐变，wglow 已裁定取消）。

| 内容 ID | 专武 | 帧名 |
|---|---|---|
| xw_lantern | 破旧提灯 | 🔵 `exw-emblem-lantern` |
| xw_revolver | 圣徒左轮 | 🔵 `exw-emblem-revolver` |
| xw_twinblades | 血契双刃 | 🔵 `exw-emblem-twinblade` |
| xw_longbow | 月痕长弓 | 🔵 `exw-emblem-longbow` |
| xw_bell | 安魂圣铃 | 🔵 `exw-emblem-bell` |
| xw_cross | 圣辉十字 | 🔵 `exw-emblem-cross` |
| xw_axe | 葬仪巨斧 | 🔵 `exw-emblem-axe` |
| xw_horn | 月啸号角 | 🔵 `exw-emblem-horn` |

## 6. 特效 / 行为标记 / 拾取（共享帧）

| 内容 | 帧名 | 用途 |
|---|---|---|
| 粒子·圆点/环/条 | ✅ `p-circle` / `p-ring` / `p-streak` | 全部命中/击杀/拖尾 |
| 经验宝石 | ✅ `gem` | 拾取 |
| 主动技专属环 | 🔵 `skill-ring-<id>`（4） | 衍生技四模板环（主动技退役后语义；非角色主动技扩散环） |
| 光环怪标记 | 🔵 `marker-aura` | 尸巫幽紫光环 |
| 召唤怪标记 | 🔵 `marker-rune` | 圣杯侍僧头顶符文 |
| 冲锋怪标记 | 🔵 `marker-warningline`（引擎绘制） | 狼裔猎手/狼王蓄力线 |
| 相位怪残影 | 引擎 ghost（复用 `p-circle`） | 亡魂残影 |
| 眩晕/减速/标记 | 🔵 `marker-stun` / `marker-slow` / `marker-mark` | 提灯闪耀眩晕 / 安魂曲减速 / 血影突袭标记 |
| 圣髑匣 | 🔵 `relic-reliquary` | 32×32 世界拾取；**不复用** `chest` |
| 圣物演出覆盖 | 🔵 `relic-mooneclipse` / `relic-bloodtide` / `relic-twelvelamps` / `relic-silvertide` / `relic-wolfspirit` | 对应 `relic_moonfall` / `relic_bloodtide` / `relic_twelve_lamps` / `relic_silver_tide` / `relic_wolf_spirit`；64×64 |

## 7. 映射规则（供扩展）

1. 内容 ID → slug：`<类别>_<地图或类>_<id>` 取 `<id>` 语义 slug（`enemy_g1_4 → wraith`）；已冻结，新内容须按 asset-spec §2.1.1 模板。
2. 帧名模板：`<类目前缀>-<slug>[-<后缀>]`；后缀 `-v`（pose 变体）/`-skill-a/-b`（前摇/施放）/`-entrance`（Boss 出场霸体）/`-walk-a/-b`（步态）/`-broken`（石甲狼破甲，同族）/`-tombstone`（守誓者墓碑，同族）。
3. **保留帧名不可改名**：`player/player-v/missile/orb/shockwave/enemy-zombie/enemy-zombie-v/enemy-hound/enemy-hound-v/enemy-boss/enemy-boss-v/gem/tile-ground/tile-grass/tile-obstacle/p-circle/p-ring/p-streak/moon/vignette/decal-rock/decal-grass/decal-blood`。
4. 替换铁律：外部素材只需把帧画成同名 PNG 重建图集，实体代码零改动（asset-spec §4.3）。
5. 可选道具槽/特写帧（`boss-lantern-rusty`/`player-lantern-close`）为打包素材，**不进入引擎引用表**。

## 8. 验收

1. M2 期工程导出帧名注册表（JSON：图集 key → 帧名列表），与本表 diff 一致（注册表 ⊆ 交付集且无多余名）。
2. M4 资产集成：外部素材按本表帧名替换，实体代码零改动，冒烟测试 PASS。
3. 本表为 C2 闭合交付物；asset-spec v1.1 §2.1.1 已冻结 slug，无需改动。
