# 开工卡 · 薇奥莱魔化整套 128

> 2026-09-18 · 流程 v1.24 · **技能暂停 · 待技能设计**  
> idle 128 B-lo **已过、已写 frames**。技能 / 走 **不写 `frames/`。**

玩法侧魔化线没有单独技能 GDD（裁决⑧）。主理人 2026-09-18：记 **待技能设计**；**暂跳过技能美术**，先做其他角色。守誓 skill 不得当参考。

`review/20260918-skill-128/` 与 `_park/2026-09-17T16-16-43-174Z/` 只留过目，不当锁。C1 叉腰不作 skill-a。B1/B2 张臂不作 skill-b，直到技能设定回填。

**契约族：`hero-violet-fallen*`。** 与守誓 `hero-violet` 分族（`familyKey` 不剥 `-fallen`）。一体两面，不是第五张选人卡。互不当参考。引擎选人仍显示守誓，直到形变接线。

现网 idle：`assets/frames/hero-violet-fallen.png` · `-v`（同像素，B-lo 已过，不量化、不重切）。技能 / 走 **未过，不写 `frames/`。**

## 点选（待主理人）

| 契约 | 候选 | 过目 |
|---|---|---|
| skill-a | E1 **C1 A** 叉腰 | `review/20260918-skill-128/05-pick-c1a-shared-card.png`（跟 idle 共用 scale≈0.1348，脚底 y127）。面积 Δ 46.8% 红记 TA（叉腰比垂臂宽），不准为绿缩小 |
| skill-b | **B1** seed 2026091801 · **B2** seed 2026091802 | `review/20260918-skill-128/06-pick-skill-b-stamps.png`。两枪留角、空手、无翼。Park `characters/violet-fallen/_park/2026-09-17T16-16-43-174Z/` |

## 形象套（本套，不另开）

| 层 | 听 |
|---|---|
| 剪影 | F-3 已过 |
| 立绘 | 优雅 GPT 身份已锁（优先）；本枪参考 = idle 印戳，不挂成片、不用甲3-A |
| 战斗设计 | E1 已过 |
| idle | B-lo 128 **已过** → 现网 |

不用：守誓印戳 / 修女 64 / 骑士 / 烛 / C2 类微调姿 / 尼龙高跟设定表。

## 本套帧

| 契约 | 画面 | 本轮 |
|---|---|---|
| `hero-violet-fallen` / `-v` | 空手垂臂站姿（B-lo） | **已过 · 已写 frames** |
| `hero-violet-fallen-skill-a` | 双手叉腰，肘外，双脚承重（E1 C1 A） | 已过姿；跟 idle 共用缩放过目；**未写 frames** |
| `hero-violet-fallen-skill-b` | 双臂向画幅两侧张开，空手 | Identity Edit 新枪；未过 |
| `hero-violet-fallen-walk-*` | 走循环 | **本轮不开**（Wan Animate 2 权重须在盘） |

无烛、无翼、无环、无粒子。专武第二波，不换持物。两姿独立（R22），不交联动 GIF。

## 形锚

| 锚 | 必须仍在 |
|---|---|
| 角 | 两只，根黑尖红 |
| 发 | 长卷墨发过肩，不是马尾 / 头巾 |
| 衣 | 墨裙为大块；高叉红衬；蕾丝手套止于前臂（上臂有断） |
| 鞋 | 红高跟 |
| 手 | 空手；禁止烛、禁止第二件持物 |
| 脸 | 红眼可读；肤块在脸/臂/叉 |

## 参数（E1 最优格）

`grounding_px=768` · `ref_boost=4` · LoRA 1.0 · 10 步 · CFG 1 · denoise 1 · 源出 512×1024。  
skill-b 两枪。落 `characters/violet-fallen/_park/<ISO>/`。

## 已知风险

- C1 旧 128 是单帧 contain（scale≈0.109），过目须跟 idle **共用缩放** 重入盒，不把旧盒当现网。
- 张臂可能丢角 / 生翼 / 变持物。丢角 = 废。
- 走须另确认 Wan 权重；本卡不开。

## 不做

不改已过 idle。不写未过 skill / walk 进 `frames/`。不用守誓当参考。不 Queue Wan。不压回 64。不加尔文、不开守誓者 192。
