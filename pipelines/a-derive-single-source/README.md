# a-derive-single-source · A 轨：单源派生（图1′ → 卡 / 剪影 / 色键 / 零件表）

> 状态：**已过** · 2026-09-10 · 主理人：「裁剪本身看着无大问题」（Vf1 第一例）
> 证据：`evidence/03-silhouette-from-clean.png` · `04-color-key-from-clean.png` · 全量 `characters/violet-fallen/identity/`
> 条文：`combat-identity-chengfa-v1.md` §2 · 账本 `identity-validate-vf1-plan-v1.md` §3–§4
> 一句话：**一张过关全身图 = 唯一身份源。** 卡裁、剪影压黑、色键压块都从它来，不另抽、不另锁再回头对齐。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 新角色、新皮肤、一体两面的第二套（每套一张图1） | 三层各锁再调和（魔化领 / 手套 / 发曾因此打架） |
| 图1 有「清单脏」（沙漏、浅棚、拟眼）先减脏成图1′ 再派生 | 用色键当脸源、用双人成片硬切 |

## 2. 输入 → 输出

| 输入 | 规格 | 来源 |
|---|---|---|
| 图1′ | 单人全身，浅棚或纯底，≥720×1280 | 立绘线出图 + `GenerateImage` 只减脏（不改人、衣、角、鞋） |

| 输出 | 规格 | 落盘 |
|---|---|---|
| 零件表 | 5–8 条，过目能指 | 账本 §3（人写） |
| 角色卡 | 胸像裁 | `review-<角色>/02-card-bust.png` |
| 剪影 | 去底压实心黑 | `03-silhouette-from-clean.png` |
| 色键 | 压大色块（不画衣） | `04-color-key-from-clean.png` |

## 3. 工具

无 GPU。`scripts/vf1-derive-a.mjs`（sharp）：洪水去浅棚（L>165 且 chroma<18 连到边的才算底）→ 胸像裁 → 实心黑 → 大色块。

## 4. 命令

```powershell
# 改脚本顶部 SRC / REVIEW / PARK 三个路径为目标角色，再：
node d:\code\vampire-survivors-like\assets\ui-menu\preview\locked\combat-64\_inspect\vf1-derive-a.mjs
```

## 5. 验收

| # | 问 |
|---|---|
| 1 | 卡、剪影、色键能对上同一张零件表（不是另一个她） |
| 2 | 剪影是去底压黑，不是另抽 |
| 3 | 色键无脸、无花纹，只有面积 |
| 4 | 减脏没有长出新衣 / 新脸 |

## 6. 已知限制

- 洪水阈值针对浅棚；纯黑底图要改 `isBg`。
- 剪影不等于旧三层里的「剪影锁」；本条过了以后，旧锁只作对照。

## 7. 文件

| 文件 | 说明 |
|---|---|
| `scripts/vf1-derive-a.mjs` | 冻结副本，来源 `assets/ui-menu/preview/locked/combat-64/_inspect/vf1-derive-a.mjs` |
| `evidence/03 · 04` | Vf1 派生结果 |

## 8. 变更记录

| 日 | 变了什么 |
|---|---|
| 2026-09-12 | 建条 |
