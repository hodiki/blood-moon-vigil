# scene-closed-source-few-shot · 角色进场景：少枪优先闭源融景

> 状态：**已过** · 2026-09-15 · 主理人：「场景工序就定为『少枪优先考虑闭源融景』。过的还是 05-e5-cursor-A-tombstone 和 05-e5-cursor-B-pew。」
> 证据：`characters/violet-fallen/identity/scene/` · 过目 `characters/violet-fallen/review/20260915-e5/05-e5-cursor.md` · 卡 `design/art-bible/exp-e5-scene-two-input-v1.md`
> 条文：`pipeline-gpu-first-v1.md` · `combat-identity-chengfa-v1.md` §4 场景 · `combat-64-workflow-v1.md` §10
> 一句话：角色已设计、这次不是抽人、要复杂场景和光、未触闭源限制、预期极少枪 → Cursor `GenerateImage`（人+景双参考）融景。本机 Krea 路 A/B 退对照。

**无 Comfy JSON。** 作者不是局域网节点；晋升规则第 2 条（冻结 API）对本条不适用。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 图鉴 / 剧情立绘 / 宣传：已设计角色放入世界观场景 | 角色抽卡、换脸、新形象套 |
| 复杂场景 + 光线（月、烛、接触影、人进景） | 走循环、技能静姿、战斗 128 帧 |
| 预期 1–2 枪 | 预期多枪、要种子可复现 |
| 未触发闭源限制 | 触限制、条款不允许进成片 |

本机兜底（不过关、只对照）：Krea Identity Edit 路 B（去底合成 + 调和）相对路 A 更好。路 A 一体但改场景画法。

## 2. 输入 → 输出

| 输入 | 规格 | 来源 |
|---|---|---|
| 人 | 过立绘级脸门的全身（E5 = 魔化 E4 P1） | `characters/<id>/` |
| 景 | 世界观场景底（E5 = Krea t2i A2 / B1） | 过目夹 `00-e5-scene-*.png` |
| 指令 | 写站位、与景物接触、主光方位；不写解剖 | 会话 `GenerateImage` description |

| 输出 | 规格 | 落盘 |
|---|---|---|
| 融景成片 | 4:3（E5） | 过目 `review/`；过了锁 `identity/scene/`；素材需求进同衣套 `lora/dataset/` |
| 战斗帧 | — | **不写 `assets/frames/`** |

## 3. 引擎

| 项 | 值 |
|---|---|
| 接口 | Cursor `GenerateImage` |
| 参考 | `reference_image_paths`：人 + 景 |
| 画幅 | E5 用 `4:3` |
| 无 | 种子、降噪、骨骼、身份槽 |

条款：`engine-license-check-v1.md` 仍待主理人核。过关图进游戏前须条款允许。

## 4. 参数（E5 验证）

| 参数 | 值 |
|---|---|
| 人 | 魔化 P1 |
| 景 A | 血月墓园 A2 |
| 景 B | 烛光教堂 B1 |
| 过关姿 | 扶墓碑看月 · 扶长凳看烛 |
| 未点 | 墓园走 / 教堂走 |
| 姿势优化 | **想法已记，本轮不改、不重抽** |

## 5. 命令

无 Queue。编码机会话调用 `GenerateImage`，参考两张，结果拷进该角色 `review/<yyyymmdd-topic>/`。主理人说「过」之前不锁、不写 `frames/`。

## 6. 后处理

无近邻入盒。脸门：人物 ≥60% 高走立绘级；更小走零件表 + 缩略（`face-gate-spec-v1.md` §8）。E5 过关两张由主理人看全图过，未另出 Cursor 脸门卡。

## 7. 验收

人还是她（零件表）；人进得去场景；光跟景（月/烛吃到人、接触影可信）。场景画法被二次元化可接受（E5 未要求保底图像素）。

## 8. 已知限制

- 无种子，不能按同一枪复现。
- 场景底会被重画风格，不是路 B 那种贴像素。
- 姿势听指令，但未锁；本轮不优化。
- 多枪会漂，所以才叫少枪。
- 不当走条作者、不当角色锁稿、不扛魔化战斗锚点。

## 9. 文件

| 文件 | 说明 |
|---|---|
| 本 README | 工序卡 |
| （无 `workflow.api.json`） | 作者不是 Comfy |

Krea 双输入 / 调和 JSON 仍在 `tools/comfy-lan/workflows/`，**不晋升**。

## 10. 变更记录

| 日 | 变了什么 | 谁点 |
|---|---|---|
| 2026-09-15 | 建条。E5 tombstone / pew 过 | 主理人 |
