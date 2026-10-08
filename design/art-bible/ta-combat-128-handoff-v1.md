# 战斗层改 128 · 给 TA / 管线 / 主程的转交

> 日期：2026-09-10  
> 给：TA / 管线 · 主程  
> 抄送：美术总监 · 主理人  
> 裁定：主理人评 **C**。期望 AI 稳定出走 / 战斗帧，至少有能指认的脸。64 棋子仍成立；**未过新帧权威 128**。  
> 验证：`tools/asset-pipeline/combat-128-verify.mjs` + `layout.test.mjs` **PASS**（2026-09-10）  
> 画布摘要：Cursor 画布 `canvases/ta-combat-128-handoff.canvas.tsx`

**现网已过 C/E 64 不重切、不重跑 `--all`。** 守誓 idle / `-v` / walk / **skill** 已过 128（idle from-a；walk E2 S3c-b；skill A1 / B2）。魔化 idle / `-v` 已过 128（B-lo · 族 `hero-violet-fallen`）。`player` / `hero-cassandra` 不改。

---

## 0. 一句话

64 当游戏棋子没问题。扩散模型当 **2px 眼** 的作者不成立。同一张硬色块印戳：近邻入盒 **64 → 眼点 0**；入盒 **128 → 眼点 4**。所以新战斗帧改 128，已过帧留 64，锁稿日再切契约并统一世界占地。

---

## 1. 已落地（对照用，勿重复施工）

| 项 | 文件 | 结果 |
|---|---|---|
| 128 时间轴档（64 的 2×，不进 96 精英档） | `layout.mjs` `sizeBand` / `temporalLimits` | idle hypot **4** / skill 12 / walk 6 |
| 锁稿日尺寸表（现网仍旧档） | `frame-specs.mjs` `COMBAT_128_LOCK_PLAN` | Vo / 加尔文 → 128；守誓者 → **192**（比她高）；C/E 不动 |
| 128 角色帧缩放核 | `resizeKernel` → `process.mjs` `rasterEntity` | `nearest`；现网 64 仍默认 lanczos |
| 入盒脚本认画布 | `vo-idle-o3d2-box.mjs` `C64_BOX` | 默认 64；F′ 用 `C64_BOX=128` |
| 世界缩放公式（未接到精灵） | `src/fx/combat-display-scale.ts` | `scale = 128 / frameW` |
| 像素 API | `combat-128-pixel-t2i.json` | 512×768 → 4× 入盒 128 |
| 自检 | `node combat-128-verify.mjs` · `node layout.test.mjs` | PASS |

现网抽检 `--check player hero-cassandra hero-violet summon-oathkeeper`：C / 现网 Vo **PASS**。`player` L\* 15.3 与守誓者跪姿边距 FAIL **是旧债**（idle v9 视觉已过；跪姿未过），不是这次引入。

---

## 2. 给 TA / 管线（锁稿日必做）

第一张守誓 idle **主理人说「过」** 之后，按序：

1. 把 `COMBAT_128_LOCK_PLAN` 写进 `EXPLICIT`（`hero-violet*` 128，`kernel: 'nearest'`）。走帧跟族，不必逐条写。
2. 新 PNG 放 `assets/raw/hero-violet.png`（已经是 128 语言或 512×768 印戳）。**禁止**再 lanczos 压回 64。
3. `node process.mjs --solo hero-violet`（不要 `--all`，不要带已过 C/E 族）。
4. `--check hero-violet`：尺寸必须 128×128；时间轴等有 `-v` / walk 再验。
5. `node pack.mjs`。characters 图集 2048²：约 40 张 128 英雄帧像素量约 0.66M，远小于 4.19M 上限。
6. 量化器仍是方案 B 派生族（`ta-pipeline-color-handoff-v1.md`）。128 **不**再开一套色。近邻入盒后若再 lanczos+量化，会重演酒红变灰 / 暖肤变血。

**不要做**

- 不要为了 128 重切 `player` / `hero-cassandra`。
- 不要 128 再压回 64（否决 D）。
- 不要把已过族和 Vo 放进同一 `expandToFamilies` 共享 contain。
- 不要写 `frames[].pivot`。

时间轴新档（写入 README）：

| 画布 | idle hypot | skill / broken | walk | entrance |
|---|---|---|---|---|
| 64（已过英雄） | 2 | 6 | 3 | 12 |
| 96（精英） | 3 | 8 | 4 | 16 |
| **128（新英雄）** | **4** | **12** | **6** | **24** |
| 240+ Boss | 4 | 12 | 6 | 24 |

面积% 与脚底规则不变。128 脚底钉：`specH − 5% − 1`。

---

## 3. 给主程（锁稿日必做）

碰撞 **不改**：`PLAYER.RADIUS = 14`，视觉与 hurtbox 继续脱钩。

Phaser 按帧像素画。128 纹理若不缩放，人是 64 的两倍高。裁定：新帧按 128 世界像素画；已过 64 **近邻放大到同一占地**。

```ts
import { combatDisplayScale } from '@/fx/combat-display-scale';
sprite.setScale(combatDisplayScale(sprite.frame.width));
```

| 纹理 | scale | 世界边 |
|---|---|---|
| 已过 C/E 64 | 2 | 128 |
| 新 Vo / 加尔文 128 | 1 | 128 |
| 守誓者 192（过了才） | 1 | **192**（比她高，不要压回 128） |

守誓 idle 入现网后，玩家精灵已接 `applyCombatDisplayScale`（64→2，128→1）。狂化是 `rage × combatDisplayScale(frameW)`，不要裸 `setScale(rage)`。

C / E 入局会按 64×2 画到世界 128——人比砖高约 2 砖，是产品裁定，不是 bug。守誓 idle / 走 / 技能已过 128，同乘区 1:1。

地砖仍 64。英雄 128 占地后，人比砖高约 2 砖——这是产品可见变化，不是管线 bug。精英仍 96，新英雄会略高，另案再升。

图集已支持混尺寸。帧名契约不改。

---

## 4. 给美术 / 提示词（新帧）

| 项 | 锁 |
|---|---|
| 权威画布 | **128×128**，人站满高，头约 16–20px，眼须能指认 |
| 生成 | Anything V5 + PixArFK，**512×768**，再 **4× 近邻**入盒。不要 1024 压 18× |
| 参考 | 立绘只认人。色听 D2 / E1。禁止硬切 gpt-ok。禁止无脸 D2 当 64/128 源 |
| 守誓者 | **192**，比她高。96 是她还 64 时的 1.5×，评 C 后作废 |
| 已过 C/E | 不重画 |

过目：128 + 石板 ×4。脸和烛/灯能指出才交主理人。

---

## 5. 验证记录（2026-09-10）

命令（管线目录，用本机 node）：

```
node layout.test.mjs          # PASS
node tokens.test.mjs          # PASS
node combat-128-verify.mjs    # PASS
node process.mjs --check player hero-cassandra hero-violet summon-oathkeeper
# C / 现网 Vo PASS；player L* 与跪姿边距 = 旧债
```

同一程序印戳（512×768，8px 眼块）近邻入盒：

| 画布 | 身高压满 | 眼点（近黑像素） | 肤块 |
|---|---|---|---|
| 128 | 112 | **4** | 206 |
| 64 | 56 | **0** | — |

这就是评 C 的计量，不是口味。

---

## 5.1 样例 wave13（2026-09-10）

过目：`review-h23-wave13/`。

| 条 | 结论 |
|---|---|
| 带眼印戳 → 近邻 128 | 脸留下。A 能指认五官；t2i 有 2 暗眼 + 烛。**128 画布可定** |
| PixArFK t2i 512×768 | 选人表 / 错人。**不定为战斗帧作者** |

TA 锁稿日仍按近邻入盒 128，不要把 PixArFK t2i 当默认前级。

---

## 6. 未做（明确交给后续）

| 谁 | 未做 | 何时 |
|---|---|---|
| 管线 | 守誓技能过了再把对应 EXPLICIT 改 128；走已切 128（2026-09-12） | 主理人点技能 |
| 主程 | 守誓者 192 过了再验占地（1:1，比她高） | 守誓者过 |
| 美术 | 守誓者 192 idle 或守誓走 128 | 主理人点 |
| 策划 | 精英 96 vs 英雄 128 体量比 | 另案 |
