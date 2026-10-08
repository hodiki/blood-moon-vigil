# 开工卡 · 薇奥莱守誓技能 128

> 2026-09-17 · 流程 v1.22 · **已过（A1 / B2 · 128）**  
> 条：`pipelines/c-pose-krea2-identity-edit/`（E1 大部分过）  
> 底：已过印戳 `characters/violet-oath/stamps/idle-from-a.png`（512×1024）
> 现网：`assets/frames/hero-violet-skill-a.png` · `hero-violet-skill-b.png`（128，近邻）。旧修女 64 退 `combat/_superseded-nun64/`。

现网 `hero-violet-skill-a/b` = 守誓 128（A1 / B2）。帧名不改。两姿独立（R22），不交联动 GIF。骑士不进本帧。

## 形象套（本套，不另开）

| 层 | 听 |
|---|---|
| 剪影 | O-3 已过 |
| 立绘 | 双人成片已锁；本枪参考 = 印戳，不挂成片 |
| 战斗设计 | D2 已过 |
| idle | 128 from-a **已过** |

不用：六人表、现网修女 64 当身份蓝本、魔化、骑士、C2 类微调姿。

## 本两帧

| 契约 | 画面（一眼可辨，相对 idle 胸前捧烛） |
|---|---|
| `hero-violet-skill-a` | 同一支白烛举过头顶，焰在画幅上沿 |
| `hero-violet-skill-b` | 一只手仍捧胸前烛，另一臂向画幅一侧张开 |

无环、无粒子、无拖尾。专武第二波，不换持物。

## 形锚

| 锚 | 必须仍在 |
|---|---|
| 发 | 长发垂背，不是头巾 / 兜帽 |
| 衣 | 披 + 落地裙夜行灰为大块 |
| 甲 | 银只胸/肩小块 |
| 烛 | 同一支白烛，焰心一点；禁止丢烛、禁止第二支 |
| 脸 | 可读肤块 |

## 参数（E1 最优格）

`grounding_px=768` · `ref_boost=4` · LoRA 1.0 · 10 步 · CFG 1 · denoise 1 · 源出 512×1024。  
两姿各两枪。落 `characters/violet-oath/_park/<ISO>/`。

## 点选（2026-09-17 · 主理人）

| 契约 | 枪 | 入盒 |
|---|---|---|
| `hero-violet-skill-a` | **A1** seed 2026091701 | 跟 idle 共用 scale≈0.1364，脚底 y127，裁顶 1px |
| `hero-violet-skill-b` | **B2** seed 2026091704 | 同缩放。B1 丢烛退对照 |

门禁相对 idle hypot / 面积 **ok**。`--check`：skill-b PASS；skill-a 填充高 128 触顶（举烛），边距红记 TA，**不准为绿缩小身子**。已写 `frames/` + pack。

## 已知风险

条 §8：手持物移位（举灯类）——本轮 A 两枪举烛成立。B1 张臂丢烛；B2 留烛。烛比底略长略粗。skill-a `--check` 边距红（举烛触顶），视觉已过。

## 不做

不改已过 idle / walk / skill。不把 a/b 做成联动 GIF。不画骑士。不 Queue Wan。不压回 64。
