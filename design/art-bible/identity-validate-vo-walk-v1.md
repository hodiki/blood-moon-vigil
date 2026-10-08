# 身份包验证 · 走循环（E2 · 守誓）

> 2026-09-12 · **已过（S3c-b）。** 本文件只记走循环实验，不是成法全文，也不是 Vf1 账本。  
> 成法：`combat-identity-chengfa-v1.md` §4 C 走 · 卡：`exp-e2-wan-animate-walk-v1.md` · 过目：`characters/violet-oath/combat/walk/18-e2-summary.md`  
> 静姿仍记 `identity-validate-vf1-plan-v1.md`。技能未开。

---

## 0. 一句话

C 轨走循环作者 = **Wan Animate 2**。参考 = 已过印戳。姿势 = 驱动视频。一次出整段 → 人挑 Williams `a,e,b,c,f,d` → 去底 → 近邻 128（六帧共用缩放与脚底）。Cache cpu/int8 是工况。

现网：`assets/frames/hero-violet-walk-{a,e,b,c,f,d}.png`（128）。已过 idle / skill **不改**。S2-a 留对照，不入现网。

---

## 1. 过目记录

| 日 | 步 | 结果 | 记 |
|---|---|---|---|
| 2026-09-12 | 权重 / 节点 | 好了 | distill INT8 + LightX2V + `wan_2.1_vae`。不必升 Comfy。14B I2V 不作废 |
| 2026-09-12 | 驱动 | 主理人给 `8c3b8794` | 朝右走可读，**不是原地**，写实人脸。`e4c22590` 不当驱动 |
| 2026-09-12 | S0 | 冒烟过 | 人锁。Cache 要开。`prompt_id` `a3c2c2bf-…` |
| 2026-09-12 | S1 | 持烛踩坑 | 空手驱动 → 走里烛离手。主理人：人锁还可以，不因此停卡 |
| 2026-09-12 | S2-a | 对照 | 空手走可读。六帧 f9,12,14,18,20,23。不入现网 |
| 2026-09-12 | S3b | 废 | Cache-off |
| 2026-09-12 | S3c-b | **过** | 有烛偏低。六帧 f9,12,14,17,19,22。播序 a,e,b,c,f,d。无 flipX |
| 2026-09-12 | S4 入盒 | 现网 | 洪水 28 · 共用近邻 · 脚底 idle `footY=127`。未开 B 轨印戳 |
| 2026-09-12 | 落盘 | 已写 frames/ | 旧修女 64 退 `_park/hero-violet-walk-nun64-superseded-2026-09-12/` |

过目根：`assets/ui-menu/preview/locked/review-exp-e2/`  
三列对照 `23` · 循环 `25` · 门禁 `24`。

---

## 2. 过了什么 · 已知债

| 项 | 状态 |
|---|---|
| 人锁（相对 idle 零件表） | 过。不是驱动写实女人 |
| 走姿非站姿拧 | 过 |
| 播序 / 无 flipX | 过 |
| 持烛 | 接受偏低；空手是踩坑，专武须另给驱动 |
| 128 硬色块 | **未到。** 绘软。可再 B 轨印戳 denoise ≤0.35，本例未加 |
| `--check` 面积 | 多红（裙摆）。脚底 / hypot 绿。红只记 |
| 驱动原地 | 否。侧面加深，入盒钉脚底 |

工作流：`tools/comfy-lan/workflows/wan-animate2-vo-walk.api.json`。打前 `POST /free`。不与 WAI / Krea 同 Queue。

---

## 3. 不记在本文件

- 静姿 C1/C2/C3 → Vf1 / E1
- 技能 a/b → 未开。现网仍旧修女 64
- 像素原生走条 → E3（待点名）
- 已过 idle 印戳 → 不重切
