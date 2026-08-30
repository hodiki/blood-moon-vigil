# 《血月守夜》五系统实装口径现状基线（工程侧）

- **任务 ID**：NV-BASE-ENG
- **作者**：程基岩（engineering-lead）
- **日期**：2026-08-28
- **基线 tag**：v0.5.0（src 103 文件 ≈2.1 万行，873/873 全绿）
- **性质**：现状回溯，不含改进方案。已知技术债只在相关处一行带过，详见 `production/official-v1/code-review-v05.md`。
- **取证范围**：只读 `src/`，全部数值摘录带 文件:行号。H5/H7/H2 根因假设相关实装事实以 **[H5]/[H7]/[H2]** 标注。

---

## 域 1 · 武器

### 1.1 代码入口
- 注册表接口：`src/weapons/weapon-behavior.ts:31-50`（WeaponBehavior 接口）、`:53-93`（WeaponRegistry，WeaponId→行为 Map）
- 装配：`src/weapons/weapon-system.ts:281-424`（WeaponSystem；`:257-279` registerNewWeaponBehaviors；`:306-321` 既有 3 武器注册 + 全量门控）
- 行为实现：`weapon-system.ts:52-182`（血月猎手 MissileWeaponBehavior）、`:189-219`（守夜之环 adapter）、`:222-254`（月蚀脉冲 adapter）；`projectile-weapon.ts`（A2~A5）、`orbit-weapons.ts`（B2~B3）、`ground-weapons.ts`（C2~C3）、`summon-weapons.ts`（D1~D3）、`super-weapon-behavior.ts`（超武）
- 数值表：`src/config/balance.ts:115-136`（WEAPONS Demo 3 武器）、`:526-597`（WEAPON_CONFIGS 14 主武器）、`:612-620`（EVOLUTIONS 7 超武）
- 超武规格：`src/weapons/super-weapons.ts:46-89`（SUPER_WEAPON_SPECS 7 模式）；进化引擎 `src/weapons/evolution-engine.ts:21,60-68,102-120`；类强化 `src/weapons/class-upgrades.ts:49-52,93-156`

### 1.2 实装现状
- **14 主武器行为注册**（weapon-system.ts:306-321）：
  - A 弹幕类 ×5：wpn_a_1 血月猎手 = 追踪飞弹（MissileWeaponBehavior，nearestEnemy 锁敌 `weapon-system.ts:135-149`）；A2~A5 统一 ProjectileWeaponBehavior（直射/霰弹/回旋/标枪，`:264-266`）
  - B 环绕类 ×3：B1 守夜之环（OrbitBehaviorAdapter）；B2 荆棘圣环/B3 圣光壁垒（OrbitWeaponBehavior，B3 为光环减伤形态 `:268-270`）
  - C 范围类 ×3：C1 月蚀脉冲（ShockwaveBehaviorAdapter）；C2 血池/C3 圣火（GroundPoolWeaponBehavior 地面持续池 `:271-274`）
  - D 召唤类 ×3：D1 血蝠/D2 猎犬/D3 断罪锁链（SummonWeaponBehavior，D3 实为定向击退光束归入召唤类 `:275-278`）
- **门控**：开局仅 wpn_a_1 启用；其余 11 把 `setEnabled(false)`（weapon-system.ts:315-321）；E4-S1 按角色 `applyInitialWeapon` 启用初始武器（`:368-371`，PlayScene.ts:266）
- **超武进化触发链**：类累计强化 ≥2（`CLASS_UPGRADE_EVOLUTION_THRESHOLD = 2`，class-upgrades.ts:52；M3-DESIGN-1 由 3→2）+ 持对应钥（`UpgradeState.hasKey`）→ 进化卡入池权重 ×5（`WEIGHT_EVOLUTION` balance.ts:1028）+ 三选一 P1 保底必占一席（upgrade-pool-v2.ts:319-325）→ PlayScene:1037-1039 消费 → `WeaponSystem.evolve` 原子切换（weapon-system.ts:379-391：清旧弹体→同 key 覆盖注册→EvolutionState.commit 不可逆）；超武不再吃类强化
- **手感四类 A/B/C/D 对应行为差异**（WEAPON_CONFIGS.feel 列，balance.ts:527-596）：A=投射（追踪/直射/霰弹 45°/往返双段/重型贯穿）；B=环绕防御（均衡/减速 30%/领域减伤 10%）；C=定时清屏（全向冲击波/持续池/灼烧）；D=召唤增援（自动蝙蝠/肉盾猎犬/击退链）
- **伤害公式**：命中伤害 = 基础伤害 × 总倍率（`computeHitDamage`，damage.ts:34-36）；C2/C3 的 damage 字段为每秒 tick（balance.ts:482 注释）

### 1.3 关键数值表（摘录）
| 项 | 数值 | 出处 |
|---|---|---|
| 血月猎手 | 12 伤 / 1.2s / 400px/s / 寿命 3s / 同屏 ≤8 / 弹半径 6 | balance.ts:117 |
| 守夜之环 | 3 球 / 半径 80 / 240°/s / 8 伤 / 同目标 0.4s CD / 上限 6 | balance.ts:119-127 |
| 月蚀脉冲 | 60 伤 / 8s / 半径 280 / 扩散 0.4s / 击退 80px（升级） | balance.ts:129-135 |
| 银针连弩 A2 | 8 伤 / 0.45s / 520px/s / 穿透 1 / 寿命 1.2s | balance.ts:533-535 |
| 圣银火铳 A3 | 10×5 发 / 45° 扇形 / 2.2s / 射程 220 | balance.ts:538-540 |
| 幽灵飞刃 A4 | 18+18（去/回）/ 1.6s / 去 380 回 500 / 上限 4 | balance.ts:543-545 |
| 骨钉标枪 A5 | 30 伤 / 3s / 700px/s / 贯穿 3 / 射程 560 | balance.ts:548-550 |
| 荆棘圣环 B2 | 8 伤 + 减速 30%（1s）/ 4 球 / 180°/s | balance.ts:557-560 |
| 圣光壁垒 B3 | 6/s 光环 120px + 承伤 −10% | balance.ts:562-565 |
| 血池喷涌 C2 | 20/s / 6s 间隔 / 半径 180 / 持续 3s / 减速 20% | balance.ts:572-575 |
| 审判圣火 C3 | 35/s / 8s / 半径 200 / 持续 2.5s | balance.ts:577-580 |
| 血蝠群 D1 | 2 只 × 6 伤/0.5s / 寿命 12s / 复活 CD 5s | balance.ts:582-585 |
| 狼影猎犬 D2 | 1 只 × 15 伤/1s / 寿命 15s / 复活 CD 4s | balance.ts:587-590 |
| 断罪锁链 D3 | 25 伤 + 击退 100 / 3.5s / 直线 200px | balance.ts:592-595 |
| 超武 7（等效 DPS） | 血月天罚 27.0（3 连+分裂）/ 血银霰弹 27.2（8 发+60px 溅射）/ 炽天使之环 28.8（6 大球+击退 60+小爆）/ 月全食 15.0（双脉冲 420 眩晕 1s）/ 血海 15.4（300px 池 5s 减速 40%）/ 血蝠风暴 33.3（6 蝠+吸血 0.5）/ 狼群领袖 26.7（3 犬+减速 30%） | balance.ts:612-620；super-weapons.ts:46-89（params 逐项） |
| 类强化分支 | 每分支上限 2 层；A1 分裂 +1（×0.6 伤）/ A2 穿透 +1 / A3 弹速 ×1.2 / B1 数量 +1 / B2 转速 ×1.2 / B3 半径 ×1.15 / C1 半径 ×1.25 / C2 伤 ×1.2 / C3 持续 ×1.3 / D1 召唤 +1 / D2 索敌 ×1.3 / D3 存在 ×1.3 | class-upgrades.ts:7-23,103-156 |
| 初始 DPS 参考 | 开局实际 10（仅飞弹）；三武器齐备参考 33.5 | balance.ts:138-141 **[H2]** |

### 1.4 已知差异 / 技术债
- B1/B3、C1 类强化写回在既有 3 武器 adapter 中部分为 no-op/走旧接口（weapon-system.ts:199-204,232-235）——接口分层债一行带过，见 code-review-v05.md。
- key_scope 射程 +15% 对追踪飞弹不接线（行程 1200px 已超环带，weapon-system.ts:62-64 记档不实现）。

---

## 域 2 · 成长

### 2.1 代码入口
- XP 曲线：`src/xp/xp-manager.ts:31-40`（needXp/cumulativeXpToReach）、`:99-192`（XpManager 磁吸/拾取/连升队列）
- 宝石参数：`src/config/balance.ts:354-364`（GEM）
- 升级池 v2：`src/upgrade/upgrade-pool-v2.ts`（buildV2Candidates :160-209 / 保底 :312-339 / rollThreeV2 :342-391）；规则常量 `balance.ts:1018-1054`（UPGRADE_POOL_RULES）；池 40 项 `balance.ts:965-1010`（UPGRADE_POOL）
- 效果写回：`src/upgrade/upgrade-apply-v2.ts:160-268`（applyUpgradeByIdV2 全量 40 项）；钥被动派生 `:55-72`
- 角色成长：`src/player/player-stats.ts:44-108`（PlayerStats/levelUp）、`:36-42`（专属被动常量）；角色表 `balance.ts:820-825`（HEROES）
- 局外功绩：`src/stats/merit.ts:33-44,70-78,130-166`；开局生效 `PlayScene.ts:1106-1118`
- 旧 Demo 池 12 项：`balance.ts:413-426`（UPGRADES，与 v2 并存）

### 2.2 实装现状
- **XP 曲线**：need(n) = 5 + 3×(n−1)（xp-manager.ts:31-33）；首级 5 点约 30s；6 分钟模拟累计 ≈1200 点 → Lv~27（balance.ts:339）；Lv30 累计 1363（xp-manager.ts:35）。大宝石连升经 pendingLevelUps 串行消费（xp-manager.ts:165-184）
- **拾取**：磁吸 140px / 速度 360px/s / 拾取 16px；落地 >3s 且超磁吸半径 → 80px/s 慢漂（balance.ts:354-364；xp-manager.ts:68-97）
- **升级池 v2（40 项）**：全局 9（up_g_1~9）+ 武器类强化 12（up_w_a1~d3，各叠 2 层）+ 超武钥 7（key_*，兼进化钥）+ 主动技强化 12（4 角色 ×3 分支）。抽取：标签过滤（全局/钥→所有人；武器类→持有类或可解锁；主动技→仅当前角色，upgrade-pool-v2.ts:85-101）
- **权重常量**：已拥有类 ×2（WEIGHT_OWNED_CLASS=2）/ 未拥有可解锁 ×1 / 进化卡 ×5 / 上次选过 ×0.5 / 满级剔除 / 全满回退 up_g_1（balance.ts:1024-1032）
- **保底席位 P1~P5**（rollThreeV2 先占 1 席再加权抽 2）：P1 进化卡（取权重最高）→ P2 领先类钥（类强化 ≥1 且未持钥，平局取初始武器类，upgrade-pool-v2.ts:279-305）→ P3 已拥有类强化 → P4 主动技 → P5 解锁卡兜底；全空回退 up_g_1（:312-339）
- **阶段节奏权重**（按局时 0–120 S1 / 120–240 S2 / 240–360 S3 / 360+ BOSS，upgrade-pool-v2.ts:130-135）：S1 numeric ×0.5；S2 ownedClass ×1.5 / key ×1.2 / unlock ×0.8；S3 numeric ×1.2 / unlock ×0.6；BOSS 同 S3（balance.ts:1048-1053）。乘序 = 基础 × 阶段 × 防重复（:184-187）
- **解锁变体**：选未持有类的强化项 → 解锁 1 把随机该类未拥有武器（卡面 ★，upgrade-apply-v2.ts:237-251）
- **角色成长**：每级 maxHp +hpPerLevel 且回复同量、伤害倍率 +damagePctPerLevel（加法）、每 speedEveryNLevels 级移速 +speedPerStep（player-stats.ts:100-108）。总倍率 = 1 + 0.04×(等级−1) + Σ升级加成 + 狂化 +0.40（加法叠加防指数，:94-97）
- **4 角色专属被动**（player-stats.ts:36-42,88-90）：守夜人磁力 +20px / 血猎手受击后 3s 移速 +10% / 修女治疗道具 ×1.5 / 狼裔击杀回 0.5 HP
- **局外功绩**：4 加成（+20 HP 成本 20 / 伤害 +5% 成本 30 / 磁力 +40px 成本 40 / 移速 +4% 成本 30），同时最多装 2；点数 = 存活 +1/30s + 击杀 +1/50 + 通关 +10 + 首杀 Boss/精英 +2 + 化身 +5（merit.ts:33-44,70-78）；开局写进 PlayerStats（PlayScene.ts:1106-1118）；纯局内模式开关可全关

### 2.3 关键数值表（摘录）
| 项 | 数值 | 出处 |
|---|---|---|
| XP 公式 | need(n)=5+3(n−1)，MAX_LEVEL 99 | balance.ts:341-345 |
| HEROES | 艾德蒙 100HP/8 每级/速 220→运行时 235；卡珊德拉 85/6/245（每 4 级 +4）；薇奥莱 115/10/205（每 6 级）；加尔文 125/12/215；四人 damagePctPerLevel 均 0.04 | balance.ts:820-825；player-stats.ts:80-86 |
| 池规则 | TIMEOUT 30s 自动选第 1 张；GUARANTEE_PRIORITY 五级 | balance.ts:1019-1040 |
| 全局升级效果 | up_g_1 +0.15/层∞；up_g_2 最短 CD 2 把 ×0.88×2；up_g_3 +20HP+受击 5s 回 10（12s CD）×3；up_g_4 移速 +8%+击杀 2s +15% ×3；up_g_6 磁力 ×2×2；up_g_7 减伤 +10%（上限 30%）；up_g_8 濒死 25% 得 60 盾/局 1 次；up_g_9 拾取 +40px×2 | balance.ts:1063-1092,1056-1060 |
| 钥被动 | scope 射程 1.15 / holy 范围 1.15 / tome 冷却 0.9 / silver 伤害 1.12 / pact 召唤 +1 / bone 存在 1.2 / grail 持续 1.25 | upgrade-apply-v2.ts:55-63 |
| 单局升级次数口径 | 模拟 6min ≈ Lv27 → 约 26 次三选一 | balance.ts:339 |

### 2.4 已知差异 / 技术债
- 双池并存：Demo UPGRADES 12 项引擎（upgrade-pool.ts）与 v2 40 项引擎并存，PlayScene 已切 v2（PlayScene.ts:990），旧引擎仅供测试回归（upgrade-pool-v2.ts:5-6）——技术债一行，见 code-review-v05.md。
- 守夜人移速 HEROES 表 220 与运行时 235 双口径（balance.ts:817-819 注明以 PLAYER.MOVE_SPEED 为准）。
- **[H2]** 开局战力仅飞弹 DPS=10，第一把新武器依赖升级抽卡（初始门控 weapon-system.ts:315-321），0~2min 为战力平台期窗口。

---

## 域 3 · 战斗

### 3.1 代码入口
- 玩家实体：`src/player/player.ts:35-121`（移动 :64-69 / 受击 :76-97 / 姿态 :113-120）
- 属性容器：`src/player/player-stats.ts`（移速聚合 :163-170 / 护盾减伤 :239-247）
- 接触伤害：`src/combat/contact.ts:50-58`（playerEnemyContact 纯函数）；伤害结算 `src/combat/damage.ts:29-72`
- 主动技控制器：`src/active-skill/active-skill.ts:13-116`（CD/充能/防抖）；效果纯函数 `src/active-skill/active-skill-effects.ts`（标记/冲刺/减速/回复/狂化光环）；技表 `balance.ts:863-868`（ACTIVE_SKILLS）+ 红线 `:312-335`（ACTIVE_SKILL_RULES）
- 输入：`src/input/joystick-math.ts:21-36`、`keyboard-input.ts`、`touch-input.ts`；摇杆常量 `balance.ts:77-82`

### 3.2 实装现状
- **玩家面板**：HP 100 / 移速 235px/s / 倍率 1.0 / 无敌帧 0.5s / 碰撞半径 14 / 出生点世界中心 (1500,1500)（balance.ts:58-66）
- **移动手感**：无加速度曲线——输入向量 × effectiveMoveSpeed 直接 setVelocity（player.ts:64-69）；移速聚合 = 基速 ×(1 + 受击加速 +10% + 狂化 +30% + 升级 +8%/层 + 踏月击杀 +15%)（player-stats.ts:163-170）；边界 clampToWorld 手动钳制；摇杆死区 10%、幅度=速度百分比（joystick-math.ts:21-36）；桌面 WASD+方向键 8 向、Space/Shift 施法，冻结恢复有 50ms fresh-keydown 防误触（keyboard-input.ts:31-40）
- **伤害结算管线**：
  - 对敌：`computeHitDamage = 基础 × 总倍率`（damage.ts:34-36）→ 圆-圆重叠判定（weapon-system.ts:151-173 等）→ `hitEnemy` 扣血 clamp 0 → 死亡 `kill()` emit `enemy:killed`（damage.ts:59-72；enemy.ts:167-181）
  - 对玩家：接触时敌侧攻击计时门（attackTimer ≤0 才伤害，重置为 attackInterval，contact.ts:50-58）→ `Player.hurt`：无敌帧判定 → 濒死护盾 → 减伤（上限 30%）+ 盾吸收 → 扣血 → 设 0.5s 无敌（player.ts:76-97）。多敌同帧只扣 1 次
  - 击杀反馈链（PlayScene.ts:687-733）：击杀统计 → 图鉴首杀 → 溅射 FX → 经验宝石掉落（Boss 不掉）→ 治疗掉落判定 → 吸血回血 → 狂化吸血 → 踏月移速 buff
- **受击无敌帧**：0.5s 时间戳判定，与主动技无敌共用 `invulnerableUntil`（取较晚者，damage.ts:47-53；player.ts:108-110）
- **4 主动技**（ACTIVE_SKILLS，balance.ts:863-868）：
  - 守夜人·提灯闪耀：DEFENSE，CD 20s，240px 眩晕 2.5s + 自身无敌 1.5s
  - 血猎手·血影突袭：MOBILITY，CD 12s 充能 2 段（8s/段），冲刺 240px/0.2s（1200px/s），路径 40 伤（吃 0.5× 总倍率），命中标记 4s 武器伤 ×1.2
  - 修女·安魂曲：DEFENSE，CD 22s，300px 减速 40% 4s + 回复 20% 最大生命
  - 狼裔·血月狂化：BURST，CD 24s，8s 内移速 +30%、倍率加法 +0.40、接触光环 25 伤/s 平摊（半径 60px，不按敌数叠加）、击杀回 1 HP；伤害类吃 0.5× 倍率
  - 控制器统一 100ms 输入锁防抖 + casts 计数埋点（active-skill.ts:77-96）；红线：输出占比 ≤15%、单局 ≤18 次（balance.ts:312-321）
- **施法姿态**：skill-a 前摇 300ms → skill-b 施放帧 150ms → 回 idle（FX.SKILL_POSE_A_MS/B_MS，balance.ts:257-258；player.ts:113-120）——两段单帧切换共 450ms，非动画；伤害瞬发、姿态只做表现、不挡移动（balance.ts:253-255）
- **强化分支**（UPGRADE_POOL up_a_*，balance.ts:998-1009）：每角色 3 分支各 1 次——CD −25% / 二次充能（CD 型角色为替换槽：眩晕 +1s、回复 +10%、狂化吸血 +1）/ 效果增强（冲刺距离 +25%、减速 40%→60%、狂化 8s→10s 等）

### 3.3 关键数值表（摘录）
| 项 | 数值 | 出处 |
|---|---|---|
| PLAYER | 235px/s / 100HP / 1.0 倍率 / 0.5s 无敌 / R=14 | balance.ts:58-66 |
| 摇杆 | 底座 (180,1120)/R48/死区 10% | balance.ts:77-82 |
| 濒死护盾 | HP<25% → 60 盾，每局 1 次 | balance.ts:1056-1060 |
| 狂化红线 | 倍率加法 +0.40；光环 25 平摊；冲刺 0.2s/光环 60px 为工程常量 | balance.ts:327-334 |
| 主动技 4 表 | 见 3.2（balance.ts:863-868） | balance.ts:863-868 |

### 3.4 已知差异 / 技术债
- 击退仅存在于武器侧（冲击波升级/超武炽天使/断罪锁链），玩家受击无击退/顿帧——现状记录，非债。
- PlayScene 单文件装配所有系统（≈1100+ 行）——结构债一行，见 code-review-v05.md。

---

## 域 4 · 怪物设计

### 4.1 代码入口
- 面板表 15+4：`src/config/balance.ts:652-669`（ENEMY_CONFIGS 15）、`:691-696`（BOSSES 4）、`:98-106`（ENEMIES legacy 4 面板）、`:752-758`（ENEMY_BEHAVIORS 特殊行为）
- 实体：`src/enemies/enemy.ts:69-97`（spawn legacy 双源入口①）、`:104-131`（spawnByConfig 15 敌入口②）、`:136-154`（updateMovement 直线 AI）；类型收敛 `enemy-types.ts:44-49`
- 特殊行为纯函数：`src/enemies/enemy-behaviors.ts`（phase/aura/summon/ranged/charge 全套判定）
- Boss：`src/enemies/boss.ts:21-48`（实体）、`boss-math.ts:17-66`（霸体/阶段/月坠纯函数）；出场 `PlayScene.ts:640-679`（spawnBoss）

### 4.2 实装现状
- **15 敌清单**（按图 6/5/4，ENEMY_CONFIGS）：
  - 墓地：行尸 12HP/55速/10伤、血犬 10/150/8、墓穴甲虫 8/70/6、亡魂 12/95/10（相位）、尸巫 16/45/6（光环）、守墓者（elite）350/40/15
  - 教堂：血信徒 14/60/12、血蝠 8/130/8（air）、圣杯侍僧 16/50/8（召唤）、忏悔者 14/55/10（远程，烛火弹 8 伤）、血肉畸体（elite）500/40/18
  - 狼穴：灰狼 12/85/10、暗影狼 10/160/10、石甲狼（elite）400/45/15、狼裔猎手 16/70/12（冲锋）
  - 经验 1/2/3（特殊）/10（elite）；半径 10~24
- **[H5] 敌面板随局内时间零缩放**：双源均无任何时间/难度缩放——legacy `spawn()` 与 `spawnByConfig()` 都直接抄静态面板（enemy.ts:69-97,104-131）；全 src 检索无 hpScale/difficulty 类逻辑。敌侧强度恒定，压力爬升完全来自生成侧预算与权重 → H5 实装事实成立（敌静态 × 玩家线性成长 = 后期数值剪刀差）。
- **[H5] 双源现状**：ENEMIES legacy 4 面板（zombie/wolf/tank/boss）与 ENEMY_CONFIGS 15 并存；15 敌运行时按 tier 映射回 legacy 三类（elite→tank / fast,air→wolf / 其余→zombie，enemy-types.ts:44-49），Boss 走 legacy `spawn('boss')`。
- **5 类特殊行为实装方式**：配置（ENEMY_BEHAVIORS balance.ts:752-758）+ 纯函数全套判定（enemy-behaviors.ts）+ 表现层（亡魂半透明 α enemy.ts:160；冲锋警告线 FX status-markers.ts:14,164）。**运行时 AI 未接线**：updateMovement 对所有敌统一直线追踪（enemy.ts:136-154），summon/ranged/aura/charge dash 判定函数在 src 内无 AI 消费方（仅 warningLineAlpha 被 FX 消费）；passesObstacles（相位/空中穿障碍）亦无运行时消费。行为数值：光环 120px 攻速 +20%×3 层；召唤 5s 1 血信徒上限 3；远程 3s 弹速 180；冲锋 6s 蓄力 0.5→警告 0.15→冲刺 500px/s。
- **Boss 实装**：仅 boss_1 血月尊者接入运行时——360s 清场后 320px 处登场（BOSS.SPAWN_DISTANCE，PlayScene.ts:641-679），面板走 legacy `ENEMIES.boss`（4000HP/28速/30伤/2.0s/R40，balance.ts:105）；出场 0.5s 霸体期内不承伤（boss.ts:26-33；weapon-system.ts:418-424 refreshEnemies 过滤）；贴图按地图换 frame（PlayScene.ts:649-652）。**阶段 2 机制（HP<50% 召唤/血池/冲锋扑击）、转阶段 1s 霸体、血月化身月坠均为配置 + boss-math 纯函数层，PlayScene 无消费方（grep 证实仅 beginGrace 被调用）**。boss_2 尼禄 4500HP、boss_3 芬里厄 4200、boss_4 化身 3000/40速（balance.ts:691-696）均未生成；boss_4 击杀回调链（图鉴隐藏条目 + 功绩 +5 + 稀有宝箱，PlayScene.ts:697-703）已存在但无可达入口。
- **精英/变体**：elite tier = tank 槽专属（map-spawner.ts:23-39 R-C3-RULING），保底生成前 2.5s 血月印记预警（TANK_WARNING_SECONDS balance.ts:174；enemy-spawner.ts:128-153 预约落地制）。无随机词缀/变体系统。

### 4.3 关键数值表（摘录）
| 项 | 数值 | 出处 |
|---|---|---|
| legacy ENEMIES | zombie 12/55/10 · wolf 10/150/8 · tank 600/35/20（xp 已 15→10）· boss 4000/28/30 | balance.ts:98-106 |
| elite 三体 | 守墓者 350/40/15 · 血肉畸体 500/40/18 · 石甲狼 400/45/15 | balance.ts:659,663,667 |
| Boss 表 4 | boss_1 4000 · boss_2 4500 · boss_3 4200 · boss_4 3000（xp 100/120/120/150） | balance.ts:691-696 |
| Boss 战判据 | 实战折减 ×0.85，60~90s 目标；尼禄 HP 回退预案 4300（默认关） | balance.ts:761-772 |
| 特殊行为参数 | aura 120px/+0.2/3 层；summon 5s/g2_1/3；ranged 3s/180px/s/8 伤；charge 6s/0.5/0.15/500/0.4s | balance.ts:752-758 |

### 4.4 已知差异 / 技术债
- 特殊行为「配置齐、AI 未接线」与 Boss 阶段 2 未接线，是本轮对 H7（中段无威胁阶梯）最直接的实装事实之一：GDD 的威胁多样性未在运行时生效，当前威胁=数量×移速。
- 双面板源并存（enemy.ts 两个 spawn 入口）——技术债一行，见 code-review-v05.md。

---

## 域 5 · 怪物生成

### 5.1 代码入口
- 纯函数层：`src/spawner/spawner.ts:39-43`（SPAWN_STAGES）、`:50-62`（budget/budgetMean）、`:77-95`（pickEnemyKind/tankGuaranteeDue/bossTriggerDue）、`:101-111`（spawnPosition 环带）
- 装配层：`src/spawner/enemy-spawner.ts:68-154`（update 秒制累加/上限暂停/保底预约）、`:175-183`（spawnOneById）
- 地图覆盖：`src/spawner/map-spawner.ts:23-39`（MAP_ENEMY_SLOTS）、`:53-69`（权重覆盖）、`:93-101`（移速加权/环带）
- 常量：`src/config/balance.ts:154-175`（SPAWNER）、`:905-940`（MAP_CONFIGS 3 图）

### 5.2 实装现状
- **预算公式**：budget(t) = 1.2 × (1 + 1.2×t/360) × (1 + 0.3×sin(2πt/60))（spawner.ts:50-54）；均值 1.2→2.64 点/s（360s）；秒制累加、掉帧不跳怪（enemy-spawner.ts:80）；同屏达 maxEnemies 暂停 2s 重试不丢预算（:118-127）
- **阶段表 3 段**（spawner.ts:39-43，权重和 1.0）：
  - S1 0–120s：zombie 0.90 / wolf 0.095 / tank 0.005（无保底，0.5% 惊喜首见）
  - S2 120–240s：0.80 / 0.17 / 0.03（厚血保底每 30s）
  - S3 240–360s：0.62 / 0.33 / 0.05（保底加密每 20s）
- **[H7] 敌种入池方式**：不是「15 敌开局全入池」，也**没有按时间解锁的新敌种**——3 抽象槽（zombie/wolf/tank）× 每图固定槽位池（MAP_ENEMY_SLOTS，map-spawner.ts:23-39），**槽内敌种（含全部特殊行为敌）开局即可出现**；阶段表只改三类数量权重，不引入新敌种/新机制 → 威胁阶梯仅由「数量斜率 + tank 保底加密」承担，H7 实装事实成立。
- **[H5] 生成侧是唯一压力源**：无敌面板缩放（见域 4），压力爬升 = 预算线性项 ×1.2t/360 + 正弦波 ±30%。
- **地图差异**（MAP_CONFIGS balance.ts:905-940）：墓地 3000² 基准（环带桌面 600–900）；教堂 2800²、环带 500–800、障碍 22/1000²、S2/S3 wolf +0.05、环境血池 ×8~10（减速 30% + 8/s，BLOOD_POOL balance.ts:781-787）；狼穴 3200²、敌潮移速 ×1.08（不含 Boss）、S1/S2/S3 wolf +0.055/+0.07/+0.09。覆盖规则：wolf += delta，zombie/tank 按占比削减，和恒 1.00（map-spawner.ts:53-62）。解锁链：墓地→教堂→狼穴。
- **Boss 时点**：t ≥ 360s 触发（±0.1s 精度，spawner.ts:93-95；enemy-spawner.ts:73-79）→ 停止生成 + onBossTime → PlayScene 静默清场（不掉经验）+ Boss 出场（见域 4）。
- **保底精英落地制**：预约出生点 → 2.5s 血月印记 → 落地（enemy-spawner.ts:128-153），敌种在预约时即从该图 tank 槽抽取。

### 5.3 关键数值表（摘录）
| 项 | 数值 | 出处 |
|---|---|---|
| SPAWNER | BASE 1.2 / LINEAR_SCALE 1.2 / 分母 360 / 波幅 0.3 / 周期 60 / BOSS_TIME 360 / 重试 2s | balance.ts:154-175 |
| 阶段权重 | 0.90/0.095/0.005 → 0.80/0.17/0.03 → 0.62/0.33/0.05 | spawner.ts:39-43 |
| 保底 | S1 无（随机 0.5%）/ S2 30s / S3 20s；预警 2.5s | balance.ts:170-174 |
| 环带 | 桌面 600–900（教堂 500–800）/ 移动 500–800（教堂 420–680） | balance.ts:912,921,932 |
| 障碍密度 | 12 / 22 / 14 座每 1000² | balance.ts:911,920,931 |

### 5.4 已知差异 / 技术债
- 教堂血池 danger 字段为描述字符串，运行时地形危险是否由 tile 层消费未在本轮回溯展开（BLOOD_POOL 常量已备）。
- 生成器与 maxEnemies 上限由 runtime-config 双端驱动（桌面/移动粒子与敌人池分档）——口径见 code-review-v05.md。

---

## 总评：GDD 与代码差异面（一行版）
GDD 侧 15 敌/Boss/特殊行为/主动技/超武的「数据面」已全量落地且与 GDD 数值逐项对齐，但**敌侧行为与 Boss 阶段的「运行时面」存在成片未接线**（特殊行为 AI、Boss 阶段 2、boss_2/3/4 生成、相位穿障），叠加敌面板零缩放（H5）与生成压力单源化（H7）——重构需求评审时建议把「配置已备、运行时未接」清单与「数值重调」清单分开裁决。
