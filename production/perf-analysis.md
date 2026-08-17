# 《血月守夜》性能剖析（Phase 6 · TASK-21 P2）

> 日期：Phase 6 打磨 · 作者：程基岩（工程主程）
> 方法：`npm run bench` 无头逻辑基准（桌面/移动各 20 分钟峰值模拟，72000 帧@60Hz）+
> 桌面 Chrome 等效 `/?bench=1` 60s（20× 时缩放覆盖 20:00 收束；headless chromium 用 swiftshader 软件渲染）。

## 1. 性能摘要

| 指标 | 桌面 | 移动 | 预算 |
|---|---|---|---|
| 无头同屏敌人峰值 | 400 | 250 | 400/250 ✔ |
| 无头子弹峰值 | 7.96 | 7.96 | ≤8 ✔ |
| draw call 估算 | 3 | 3 | ≤8 ✔ |
| 浏览器 fps（软件渲染） | avg 25.6 / min 19.4（1338 帧） | — | 真机复核（M2 已过） |

软件渲染 avg 25.6fps **不代表真实 GPU**（swiftshader 为 CPU 光栅化）；M2 真机桌面 Chrome 60fps 闸门已通过，本数值仅作相对参考。

## 2. 瓶颈定位（按理论热点）

1. **O(missiles × enemies) 命中检测**（`weapon-system.checkMissileHits`）：峰值 8×400=3200 次圆-圆判定/帧 ≈ 19 万次/s，JS 可承受；普通敌 12HP 被 12 伤飞弹一枪毙 → 实战同屏子弹远低于 8（浏览器峰值 3），非真实瓶颈。
2. **nearestEnemy 重复扫描**：`tryFireMissile` + 每枚飞弹 tick 各扫一次敌人（≤8 次/帧），O(enemies) 重复。
3. **refreshEnemies 每帧重建数组**：O(enemies) 一次全扫 + graceUntil 过滤，供 3 武器共享目标列表，属必要开销。

结论：当前无真实帧率瓶颈；三处均为理论热点，规模在预算内。

## 3. 对象池命中率（maxSize vs 峰值）

| 池 | maxSize | 无头峰值 | 浏览器峰值 | 利用率 |
|---|---|---|---|---|
| 敌人（桌面/移动） | 400/250 | 400/250 | 400 | ~100%（达上限即节流，健康） |
| 子弹 | 8 | 7.96 | 3 | 无头 ~99% / 实战 ~38% |

池满策略 'reject' 生效：敌人池满生成器暂停 2s 重试；子弹池满跳过冷却，均无溢出。分裂稳态（1 主弹 + 2 次级）已被无头模拟建模，总弹数 ≤8（TASK-21 Bug3 修复后一致）。

## 4. 优化建议清单（优先级）

1. **[P2] 缓存飞弹最近目标**：missile 持 targetRef，逐帧复用 `nearestEnemy` 结果（目标死亡/超出再重扫），消除重复 O(enemies)。
2. **[P2] 命中检测剪枝**：`hitEnemy` 击杀后 `enemy.active=false` 已短路 continue，无需改动；未来可加半径粗筛。
3. **[P3] 距离裁剪**（ARCH §6 #6）：视口 +200px 外敌人跳过 AI/命中，当前 400 敌未触瓶颈，P1 内容扩展前再上。
4. **[P3] 构建体积**：主 chunk 1.55MB（gzip 360KB，Phaser 单包）；接入更多内容前评估 manualChunks/懒加载。
5. **[P3] fps 复核**：headless swiftshader 不达标属预期；发布前用真机桌面 Chrome 跑 `npm run bench:browser` 复核 M2 闸门。
