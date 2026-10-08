# 生图引擎许可核定（engine-license-check）

> 版本：v1 · 日期：2026-09-13 · 补核 2026-09-17（MiniMax H3）· 执行：编码机助理（主理人 2026-09-13 ④ 指派）
> 状态：**已核 · 待主理人过目。** 本文是对公开许可文本的技术性通读与对照，**不是法律意见**；上线前的最终判断请以法务或发行方要求为准。
> 范围：GPU 机 HodikiX 现网权重（握手 2026-09-10 清单）+ Identity Edit LoRA、Wan Animate 2、MiniMax H3 本机权重 + Cursor `GenerateImage`。核的是三件事：**生成物能否用于商业游戏 · 我们要承担什么义务 · 有没有不能进商用产线的件。**

---

## 0. 结论一页

| 件 | 生成物商用 | 条件 / 义务 | 判 |
|---|---|---|---|
| **WAI-illustrious-SDXL v17.0**（`waiIllustriousSDXL_v170.safetensors`） | **可** | Fair AI Public License 1.0-SD：生成物不在许可范围内、无人主张权利；义务只在**分发模型 / 派生模型**或**对外提供网络服务**时触发（同许可共享 + 提供源）；禁用清单 | **进产线。** 本机内部推理、生成物入游戏，无附加义务。若日后炼 WAI LoRA：内部用无义务；对外发布须同许可并附权重与配方；不得作闭源在线服务 |
| **Krea 2 Turbo / Raw**（`krea2_turbo_int8_convrot`） | **可（有门槛）** | Krea 2 Community License：公司（含关联方）**过去 12 个月总收入 < 100 万美元**；部署须有**内容过滤或等效人工审核**；法律 / 平台要求时须**标注 AI 生成**；遵守可接受使用政策；Krea 不主张生成物权利 | **进产线。** 现阶段满足门槛；主理人过目即「人工审核」；收入接近门槛前须取企业许可（opensource@krea.ai） |
| **Krea 2 Identity Edit LoRA v1.2**（社区，conradlocke） | 同 Krea 2 | 派生模型，沿用 Krea 2 Community License（作者已声明）；非官方 | **进产线**，义务同上 |
| **Krea 官方风格 LoRA**（retroanime / darkbrush / softwatercolor） | 同 Krea 2 | 同上 | 进产线 |
| **Wan 2.2 Animate 2 · Wan 2.1 I2V 14B** | **可** | Apache 2.0；官方声明不主张生成物权利；README 的负责任使用要求 | **进产线**（E6 后本机已卸，战斗走循环仍可） |
| **MiniMax H3 本机权重**（FL2VA GGUF 等） | **可（有门槛）** | MiniMax H3 Community License（2026-08-02）：适用地不含美 / 欧 / 英 / 韩；年收入 >2000 万美元须另申请；MiniMax 不主张生成物权利；商业产品界面须显著标 “MiniMax H3”；不得用输出改进其它 AI 模型 | **本机日常进产线。** 项目在适用地内、远低于收入门槛；主理人过目 = 审核。官方 API 另走服务条款，不是这份开源许可 |
| **LightX2V 蒸馏 LoRA · umt5-xxl · Qwen3-VL-4B 编码器 · Qwen-Image VAE · clip_vision_h · IP-Adapter · xinsir OpenPose · DWPose / controlnet_aux · InSPyReNet** | 可 | Apache 2.0 / MIT 一类宽松许可 | 进产线 |
| **Anything V5 · PixArFK LoRA** | 可 | CreativeML Open RAIL-M（禁用清单） | 可用；现已不当作者 |
| **4x-UltraSharp.pth** | **否** | **CC BY-NC-SA 4.0，禁商用**；作者亦认为生成物随之受限 | **不得进商用产线。** 现网 143 条工作流均未引用；建议从日常工作流里明确排除，或换 Apache / MIT 许可的放大模型 |
| **FLUX.2 Klein 4B** | 未核 | 已停用 | 不核；启用前再核 |
| **`krea2_turbo_openpose_controlnet`（thedeoxen）· `Krea2_Anything2RealCharacters-V3`** | 未核 | 社区件，页面未见明确许可 | 只在 E1-b 备选里出现；启用前核 |
| **Cursor `GenerateImage`** | 按 Cursor 服务条款 | 输出权属与商用许可取决于 Cursor 与其底层供应商条款；本地无法核 | **主理人核 Cursor 条款。** 现已用于 Vf1 步 0 减脏（图1′ 经过它）；若条款不明，建议用 Identity Edit 在本地权重上重做减脏，切断依赖 |

一句话：**WAI 可以留在产线**（②.2 条件三成立）；Krea 2 有收入门槛与审核 / 标注义务；MiniMax H3 本机权重可日常用（适用地含中国大陆，排除美 / 欧 / 英 / 韩；年收入 >2000 万美元才另申请）；盘上唯一不能商用的是 4x-UltraSharp，且没在用；`GenerateImage` 与官方视频 API 的服务条款是无法用开源许可替代的两环。

---

## 1. WAI-illustrious-SDXL v17.0（②.2 条件三）

### 1.1 事实

| 项 | 内容 | 来源 |
|---|---|---|
| 作者 / 发布 | WAI0731 · Civitai 模型 `827184` · v17.0 版本 `2883731` | Civitai / HF 镜像说明 |
| 文件 | `waiIllustriousSDXL_v170.safetensors` · SHA-256 `f116b0c78ff441467b0cdc8f1936e1ed18ea31e9997c7b132b1b8db533f0bd04`（镜像记录，**GPU 机应核对本地哈希**） | HF `LocalMuseAI/coreml-wai-illustrious-sdxl-v17-6bit` 说明 |
| 声明许可 | **Fair AI Public License 1.0-SD**（Civitai 页面标「Illustrious License」，镜像与多个合并模型页均注为 FAIPL 1.0-SD） | 同上；`MellowMixClearly ILL` 等合并页 |
| 底模链 | v14 起底改为 **Illustrious XL v1.0**（作者说明「ill 1.0 use」）；Illustrious v1.0 在 HF 以 **SDXL 许可（CreativeML Open RAIL++-M）**发布；OnomaAI 2025-04 声明 v0.1 的 FAIPL「不是非商用」，并改以 CreativeML Open RAIL 重新分发 | Civitai 归档 v14 / v15 说明；HF `Illustrious-XL-v1.0` README；HF v2.0 讨论 #1 |
| 更名 | 原名 `WAI-NSFW-illustrious-SDXL`，后去掉 NSFW；Civitai 2026-04-15 站点分家后本模型在 NSFW 侧 | としあき wiki |

### 1.2 FAIPL 1.0-SD 与本项目的关系

| 条款 | 原文要点 | 对我们 |
|---|---|---|
| Output | 「The output of this software is not covered by this license, and no contributor claims any rights to it.」 | **生成物可商用，无署名义务** |
| Notices（分发） | 把模型或其任何部分给别人，须附许可文本与对应源 | 我们不分发权重 → 不触发 |
| Notices（网络） | 修改后**允许用户经网络使用**，须提供源（派生模型可只提供派生模型下载 / 书面要约） | 局域网内主理人与助理自用，不是对公众提供服务 → 不触发。**不得**拿 WAI 派生做闭源在线生图服务 |
| Share-alike | 软件、源、修改须以同许可或更宽许可提供 | 若日后**发布** WAI 身份 LoRA，须 FAIPL 并附权重 / 配方；内部使用无义务 |
| Prohibited Uses | 与 SD 许可同源的禁用清单（违法、伤害未成年人、虚假信息、歧视、医疗、司法等） | 游戏美术资产不涉及 |
| No Harm / No Liability | 放弃对贡献者的索赔；无担保 | 接受 |

底层 SDXL 许可（CreativeML Open RAIL++-M）同样「Licensor claims no rights in the Output」，与 FAIPL 一致，无更严条款叠加。

### 1.3 结论与备注

- **②.2 条件三成立：WAI 可留在产线**，作二次元风格化 / 终审层，生成物入游戏无附加义务。
- 备注一：Civitai 将其归入 NSFW 侧是平台分类，不是许可限制；作者建议负向加 `nsfw` 过滤。我们的产线全程主理人过目，等同人工审核。
- 备注二：合并模型的许可声明由作者自述，Civitai 不作核验；目前公开信息一致指向 FAIPL 1.0-SD，未见相反声明。建议把许可文本快照存档（§5）。

---

## 2. Krea 2（主引擎 · ②.2 已定）

| 条款 | 要点 | 对我们 |
|---|---|---|
| §2.3 收入门槛 | 商用（含模型、派生、**生成物**）仅限公司及关联方**过去 12 个月总收入 < 1,000,000 USD**；达到即须企业许可，否则立即停止商用 | 现阶段满足。**主理人列入年度检查项**；若融资 / 发行收入接近门槛，先联系 opensource@krea.ai |
| §4.2 内容过滤 | 部署须有合理的内容过滤措施：开源分类器、商业审核 API、**人工审核**或其组合 | 我们是内部生产 + 主理人逐张过目 = 人工审核。若日后把 Krea 接进面向用户的功能，要加分类器 |
| §4.3 溯源与披露 | 法律、法规或**平台政策**要求时，须明确披露生成物由 AI 生成 | 见 §4 平台义务 |
| AUP | 禁 CSAM / NCII / 冒充与选举干扰 / 欺诈诽谤 / 绕过安全措施 / 假冒人工创作以欺骗等 | 不涉及；「不得把 AI 生成物冒充人工以欺骗」与 §4 披露一起看 |
| 生成物权利 | Krea 不主张 | 生成物归我们处置 |
| Identity Edit LoRA | 作者声明：Krea 2 派生模型，按 Krea 2 Community License 分发；非官方、无背书 | 义务同 Krea 2；社区件的可持续性风险另记 |

---

## 3. 视频线与配件

### 3.1 MiniMax H3 本机权重（2026-09-17 补核）

| 项 | 内容 |
|---|---|
| 许可 | MiniMax H3 Community License Agreement（发布日 2026-08-02）· HF `MiniMaxAI/MiniMax-H3/LICENSE` |
| 适用地 | 全球，**排除**欧盟、英国、韩国、美国。中国大陆在适用地内。在排除地部署须另向 MiniMax 申请 |
| 生成物 | MiniMax 不主张 Output 权利；Output 不算 Model Derivative |
| 商用门槛 | 年收入超过 **2000 万美元**须事先书面授权（`api@minimax.io`，主题 `MiniMax H3 licensing - authorization request`） |
| 标识 | 使用 H3 的**商业产品 / 服务界面**须显著标 “MiniMax H3”（鼓励 Powered by；依法 / 平台披露 AI 生成） |
| 禁用 | 不得用 Output 改进其它 AI 模型；AUP 含未成年人伤害、虚假信息、军事用途等 |
| 编码器 | Qwen3-VL-32B 为 Apache 2.0，与 H3 许可分开 |

本机日常推理、生成物入游戏宣传片：现阶段满足适用地与收入门槛；主理人过目 = 审核。上线前把「界面 / 制作人员表标 MiniMax H3」列入检查。GGUF 量化件（如 `MiniMax-H3-FL2VA-Q3_K_M.gguf`）沿用同一社区许可。

**官方 API 不是这份开源许可。** 现网（2026-09-17）：`platform.minimax.io` · `POST /v2/video_generation` · 模型 `MiniMax-H3` · 768P $0.08/s · 2K $0.13/s · 4–15s。Hailuo 02 / 2.3 为遗留。账号、发票、服务条款由主理人开；本文件不替代那份合同。

### 3.2 Wan 与配件

- **Wan 2.2 Animate 2 / Wan 2.1 I2V 14B**：Apache 2.0（HF 与 GitHub 均标）；README 明示不主张生成物权利，要求合法、不伤害、不传播个人信息与虚假信息。进产线（E6 后本机已卸；战斗走循环仍可）。
- **LightX2V 蒸馏 LoRA**：Apache 2.0。
- **umt5-xxl**（Google）、**Qwen3-VL-4B**、**Qwen-Image VAE**（阿里）：Apache 2.0。
- **clip_vision_h**（LAION OpenCLIP ViT-H-14）：MIT。
- **IP-Adapter**、**xinsir OpenPose SDXL**、**DWPose / controlnet_aux**：Apache 2.0。
- **InSPyReNet**（去底）：MIT。
- **Anything V5 · PixArFK LoRA**：CreativeML Open RAIL-M（禁用清单，生成物可商用）；现已不当作者。
- **4x-UltraSharp**：**CC BY-NC-SA 4.0**。作者在 HF 讨论中自述：模型不得商用，生成物「大概率」也不得商用。全仓 143 条工作流**未引用**。处理：从日常工作流禁用；需要放大时换 Apache / MIT 许可模型（例如 RealESRGAN 系列 BSD-3），或不放大（现网入盒是近邻缩小，本就不放大）。
- **FLUX.2 Klein 4B**：停用，不核；启用前核 BFL 条款。
- **thedeoxen 姿态 LoRA · Anything2RealCharacters**：页面未见明确许可；只在备选里，启用前核。

---

## 4. 平台与法规侧义务（与引擎无关，但被 Krea §4.3 引用）

| 场景 | 义务 | 备注 |
|---|---|---|
| Steam 上架 | 内容调查表须披露预生成 AI 内容的使用与审核方式（Valve 2024-01 起） | 我们全程主理人过目，可如实填写 |
| 中国大陆分发 | 《人工智能生成合成内容标识办法》（2025-09-01 施行）对**生成合成服务提供者与传播平台**设标识义务；游戏内置美术资产是否落入其范围以发行方 / 法务口径为准 | 记为「上线前核」，不在本文定论 |
| 商店页 / 宣传 | Krea AUP 禁「把生成物冒充人工创作以欺骗」；如实说明即可 | — |

---

## 5. 建议动作（主理人勾）

- [ ] 在仓库建 `design/licenses/` 存四份许可文本快照：FAIPL 1.0-SD、CreativeML Open RAIL++-M（SDXL）、Krea 2 Community License + AUP、Apache 2.0；每份记来源 URL 与抓取日期
- [ ] GPU 机核对 `waiIllustriousSDXL_v170.safetensors` SHA-256 是否为 `f116b0c7…0bd04`，写进握手 `models` 备注
- [ ] 4x-UltraSharp：从 `KREA2-Turbo-仓库.json` 等网页参考图里确认未接线；`call-reference.md` 模型表加「非商用，勿用」
- [ ] Krea 收入门槛列入年度检查；接近前联系企业许可
- [ ] 核 Cursor `GenerateImage` 条款；若不明，Vf1 图1′ 的减脏用 Identity Edit 本地重做一遍（同源同法，只换工具）
- [ ] 若日后发布任何 WAI 派生 LoRA，按 FAIPL 附权重与配方；Krea 派生按 Community License
- [ ] `pipelines/README.md` §4 引擎表加「许可」列，指向本文
- [ ] MiniMax H3：商业产品界面 / 制作人员表标 “MiniMax H3”；年收入门槛 2000 万美元列入远期检查
- [ ] 复杂视频开官方 MiniMax-H3 API 账号（Pay-as-you-go）；条款另核，不套用开源许可

---

## 6. 来源

**2026-09-13：** Fair AI Public License 1.0-SD 全文（freedevproject.org）· Civitai `827184` 与 HF 镜像 `LocalMuseAI/coreml-wai-illustrious-sdxl-v17-6bit` 许可说明 · Civitai 归档 WAI v14 / v15 说明（底模 ill 1.0）· HF `OnomaAIResearch/Illustrious-XL-v1.0` README（sdxl-license）· HF `Illustrious-XL-v2.0` 讨论 #1（OnomaAI 2025-04-21 许可澄清）· Civitai 文章《What The License?!》（许可链解读）· Krea 2 Community License（github.com/krea-ai/krea-2/docs）与 krea.ai 许可 / AUP 页 · HF `krea/Krea-2-Turbo` 模型卡 · HF `conradlocke/krea2-identity-edit` 许可段 · HF `Wan-AI/Wan2.2-Animate-2-14B` 与 GitHub `Wan-Video/Wan-Animate-2`（Apache 2.0）· HF `Wan-AI/Wan2.2-Animate-14B` 许可段 · OpenModelDB / HF `Kim2091/UltraSharp`（CC BY-NC-SA 4.0）与讨论 #4。

**2026-09-17：** HF `MiniMaxAI/MiniMax-H3` LICENSE（Community License，2026-08-02）· `platform.minimax.io/docs/guides/models-intro` · `platform.minimax.io/docs/guides/pricing-paygo` · `platform.minimax.io/docs/guides/video-generation`。
