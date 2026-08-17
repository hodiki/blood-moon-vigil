# 《血月守夜》部署手册（Deploy Guide）

> 版本 v0.1 · 作者：路远行（发布运营管理）· TASK-29 · 适用：垂直切片 Demo 0.2.0
> 前提：Node 环境就绪、`npm install` 已完成（package-lock.json 已提交）

## 1. 本地操作

| 命令 | 用途 | 说明 |
|---|---|---|
| `npm run dev` | 开发 | 打开 http://localhost:5173 |
| `npm run dev -- --host` | 手机真机 | 手机与 PC 同 Wi-Fi，访问 http://<PC 局域网 IP>:5173 |
| `npm run typecheck` | 类型检查 | tsc --noEmit，退出码 0 为过 |
| `npm test` | 单测 | 当前 35 文件 292 全绿 |
| `npm run build` | 构建 | tsc --noEmit && vite build，产出 dist/（base './'，任意静态托管可用） |
| `npm run preview` | 预览产物 | 本地预览 dist/，验证构建结果 |
| `npm run bench` | 性能基准 | 无头逻辑基准（发布前按 G2 复核） |

## 2. 部署（WorkBuddy 轻应用）

1. `npm run build` 成功（退出码 0）。
2. 打开 WorkBuddy 轻应用发布，选择 dist/ 目录部署。
3. 发布成功后复制分享链接。
4. **管理入口：「设置 - 数据管理 - 我发布的应用」**（可查看、更新、下线已发布应用）。
5. 验证：桌面 Chrome + 手机真机各一次冒烟（开局 5s 首怪 / HUD LV1 / 结算可进 / 0 console error）。

## 3. 更新与回滚

- **更新**：重新 build → 管理入口重新发布（覆盖当前版本）→ 按 §1 验证。
- **回滚**：管理入口切回上一版部署/链接；24h 内完成根因分析；热修走简化流程（release-checklist §3）。

## 4. 常见问题（FAQ）

| 问题 | 处理 |
|---|---|
| 部署后页面仍是旧版 | 强刷 Ctrl+F5 / 清缓存；确认新版本已发布成功且链接正确；静态资源带版本号防缓存 |
| 手机访问白屏/打不开 | 确认同网络或链接本身可访问；浏览器需支持 WebGL（Chrome/Safari 最新版）；换浏览器重试 |
| 手机可访问但卡顿 | 中端机目标 30fps+；确认未开启高对比/描边增强；关闭后台 App；性能问题回报程基岩 |
| 分享链接失效 | 到「设置 - 数据管理 - 我发布的应用」检查应用是否在线，必要时重新发布 |
| 构建报错 | 先 `npm run typecheck` 定位类型错误；依赖异常时按 package-lock.json 重新 `npm install` |
