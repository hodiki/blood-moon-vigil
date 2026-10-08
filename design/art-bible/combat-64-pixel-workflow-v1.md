# 战斗层 · 像素工作流（combat-128-pixel）

> 2026-09-10 · v1.7 · 守誓 idle + **走 128 已过（E2 S3c-b）** · 守誓者画布 **192**（比她高）· 一致性漂见 `combat-identity-drift-v1.md`  
> 成法：带眼印戳 → 近邻入盒 128。立绘 / 视频脸门见 `face-gate-spec-v1.md`（**战斗档不走立绘门**）。旧 `combat-64-pixel-*.json` / `combat-128-pixel-t2i.json` 留档，日常不要当 idle Queue

64 作为尸潮棋子仍成立。卡住的是「扩散模型当 2px 眼的作者」。主理人期望 AI 稳定出走 / 战斗帧，至少有一张能指认的脸。业内成法落在 128，故评 C。

---

## 画布裁定（C · 2026-09-10）

| 项 | 锁 |
|---|---|
| 新战斗帧（守誓技能、魔化 / 加尔文） | **128×128 权威**。硬色块直出，入盒近邻 |
| 守誓者 | **192×192**。她 128 的 1.5×（旧账：她还是 64 时写成 96）。屏上 1:1，禁止压回 128 |
| 已过 C / E 64 | **不重切、不加呼吸、不加走帧。** 入现网近邻放大到同一占地 |
| 已过守誓 idle / 走 128 | `hero-violet` / `-v` / `-walk-*`。禁止再量化重切、禁止压回 64 |
| 屏上 | 新帧按 **128 世界像素**画。`combatDisplayScale` 已接玩家精灵 |
| 碰撞 | 仍与视觉脱钩，暂不改半径 |
| 地砖 | 仍 64 |
| 脸 | 头约 **16–20px**。过目要能指出眼，不是空白肤块 |

不要把 SDXL IPA 塞进 SD1.5 像素条。不要 IPA + OpenPose 同 Queue。换引擎先 `POST /free`。

---

## 成法

作者不是盘上 PixArFK t2i（两枪仍出设定表）。作者是 **带眼硬色块印戳 + 近邻入盒**。

| 步 | 做什么 | 停下来 |
|---|---|---|
| 1 身份 | 本套立绘单人裁，只认人 | 双人成片、骑士、油画当切割源 |
| 2 印戳 | Krea 等硬色块全身，**必须有眼点**，色听色键 | 无脸、选人表、油画、PixArFK t2i 当作者 |
| 3 入盒 | 挖空 → 近邻进 **128**（约 4×～8×，不是 18×）+ 石板 ×4 | 压回 64、硬切 gpt-ok、无脸 D2 当源 |
| 4 已过角色的下一帧 | 以 **已过 idle 128 + 过关印戳** 为 i2i 底；**走循环**优先动作迁移（视频帧 → 去底 → 近邻 128，E2） | 重新从立绘硬切、再练一条像素 LoRA 当作者；脚本改姿凑对侧 |

样例：`portraits-follow-h23-wave13-notes-v1.md` · `portraits-follow-h23-wave14-notes-v1.md`。锁稿：`characters/violet-oath/combat/idle/hero-violet-idle-128-v1.png`。

---

## 一致性漂（立刻停）

条文：`combat-identity-drift-v1.md`。

过一张站姿 ≠ 模型记住了这个人。换动作 / 换角色 / 抬 denoise 都会漂。出现换人、丢脸、选人表、风格横跳，或同一条底连打 3 枪仍不认，**立刻停 Queue**，按该文 A→B→C 解析，禁止无限换种子。未到 C 不准给每个角色练 LoRA。

---

## 本机怎么 Queue（未过帧）

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
Invoke-RestMethod -Method POST -Uri http://192.168.101.200:8188/free `
  -ContentType application/json -Body '{"unload_models":true,"free_memory":true}'

.\run-job.ps1 queue -Workflow .\workflows\krea2-vo-stamp-w14-from-a.json `
  -Slots .\workflows\krea2-i2i-api.slots.json `
  -Ref <eyed-stamp-or-passed-idle.png> -TimeoutSec 300
```

输出只进 `_park/comfy-lan/<ISO>/`。主理人说「过」之前不写 `frames/`。已过 idle 禁止再跑 `process.mjs` 量化。

---

## 64 条为什么停（对照）

| 枪 | 现象 | 根因 |
|---|---|---|
| wave11 Krea 1024→~56 | 四份丢脸 | ~18× 碾脸 |
| PixArFK t2i 256 / LoRA 乱调 | 四宫格、双人、油画滤镜 | 没走作者的 512–768→4×/8× |
| PixArFK t2i 512×768 wave13 | 正背/三视图，错人 | LoRA 出设定表，不是单人 idle |

wave11 过目板只作丢脸对照。

转交：`ta-combat-128-handoff-v1.md`。守誓 idle 锁稿日已切 `EXPLICIT` idle/-v，并接上 `combatDisplayScale`。
