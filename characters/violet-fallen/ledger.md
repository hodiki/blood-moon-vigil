# 过目账本

| 文 | 管什么 |
|---|---|
| `design/art-bible/identity-validate-vf1-plan-v1.md` | 图1′ / A / B-lo |
| `design/art-bible/exp-e1-krea2-identity-edit-v1.md` | C 轨 Identity Edit（C1/C3 过、C2 反例） |
| `design/art-bible/character-art-bible-v1.md` §4.1 / §5.1 | F-3 + E1；优雅 GPT 优先 |
| `design/art-bible/exp-e4-portrait-restage-face-gate-v1.md` | 立绘 re-stage / D 轨（部分过） |
| `design/art-bible/exp-e5-scene-two-input-v1.md` | 进场景（部分过：tombstone/pew；Krea 路 B 对照） |
| `design/art-bible/exp-e6-video-firstframe-chain-v1.md` | 视频首帧链（部分过：H3 段内+段间） |

脸门基准已发（2026-09-13）：`identity/face-gate/`，**不回溯判**。图1′ 不进 dataset。

| 日期 | 格 | 三态 | 备注 |
|---|---|---|---|
| 2026-09-15 | E4 P1–P6 | 过 | Krea 原图进 `lora/dataset/lace-red-heels/` `e4-P1…P6.png`。图1′ 仍 vf1-clean，不进。未写 `frames/`。未训。 |
| 2026-09-15 | E5 tombstone / pew | 过 | Cursor 少枪融景。锁 `identity/scene/`。D 进 `lora/dataset/lace-red-heels/e5-scene-*`。Krea `03` 路 B 更好、不过。未写 `frames/`。姿势优化只记想法。 |
| 2026-09-15 | E6 竖首帧 | 过 | GenerateImage。锁 `identity/video/`。全身竖幅接受。 |
| 2026-09-15 | E6 S1 I2V 33 | 不过 | 无期望动作。Wan 2.1 I2V 14B。词锁太死 + 转头方向空。 |
| 2026-09-15 | E6 S1b I2V 33 | 等视频级 | CFG 6 · seed 2026091332。头转向烛，未转回。`01b-e6-s1b.webp` |
| 2026-09-15 | E6 33 单拍 | 等视频级 | CFG 6 · seed 2026091333。小幅右转后停，未出画。`03-e6-s33hold.webp` |
| 2026-09-15 | E6 S2 I2V 49 | 预筛融化 | 973s。中/尾糊。不用此尾帧续段。 |
| 2026-09-16 | E6 H3 I2V 124 | 过 | 480×864 ×124。转头向烛后停。锁 `identity/video/e6-i2v124.mp4`。未写 `frames/`。 |
| 2026-09-17 | E6 S4 尾帧续 | 不过 | 只接首帧，中/尾没锁脸。 |
| 2026-09-17 | E6 S4b 首+尾帧 | 过 | FL2VA first+last。锁 `identity/video/e6-s4b.mp4`。未写 `frames/`。 |
| 2026-09-17 | E6 S5 重出首帧 | 过（I2V） | 静帧还可以。I2V 锁 `identity/video/e6-s5.mp4`。未写 `frames/`。 |
| 2026-09-17 | E6 S3 驱动 | 过 | H3 T2V 0.98 MP `drive/20260917-drive-h3-t2v-098.mp4`。只作内部驱动。 |
| 2026-09-17 | E6 S3 指定动作 | 等视频级；本机 R2V+视频不作日常 | `03-e6-s3.mp4`（73f 33.5 min）· `03b-e6-s3.mp4`（124f ~125 min）。优先 I2V / 拼接 / 线上 API |

| 2026-09-18 | 魔化 idle 128 入现网 | 过 | 契约族 `hero-violet-fallen` / `-v`。B-lo 不量化。 |
| 2026-09-18 | 魔化 skill | **待技能设计** | 无单独魔化技能 GDD。美术暂停。过目留 `review/20260918-skill-128/`，不写 `frames/`。 |

C 试 13–46 与 E1 其余不搬：见 [_park/legacy-c-trials.md](../_park/legacy-c-trials.md)。
