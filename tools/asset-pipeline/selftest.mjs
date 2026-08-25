// selftest.mjs — 管线自检：生成模拟 AI 原图 → 跑 process → 跑 pack → 输出汇总
// 用途：验证管线闭环可用（不依赖真实 AI 生图）；测试完成后模拟图留在 assets/raw/ 可被真实素材覆盖
// 用法：node selftest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const RAW_DIR = path.join(PROJECT_ROOT, 'assets', 'raw');

// 模拟原图生成：在 256×256 画布上画一个简单剪影（圆身 + 头 + 帽尖），背景 = 暗色
function makeSilhouettePng({ body = [232, 240, 250], outline = [84, 230, 201], bg = [11, 14, 20], accent = [] } = {}) {
  const W = 256, H = 256;
  const data = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const cx = 128, cy = 128;
      // 主体：椭圆（身体）+ 圆（头）+ 三角（帽尖），整体偏移造一点姿态
      const bodyDx = (x - cx) / 60, bodyDy = (y - cy) / 78;
      const headDx = (x - cx) / 26, headDy = (y - (cy - 62)) / 26;
      const inBody = bodyDx * bodyDx + bodyDy * bodyDy <= 1;
      const inHead = headDx * headDx + headDy * headDy <= 1;
      const hatTip = (y < cy - 88) && Math.abs(x - cx) < (cy - 88 - y) * 0.5;
      if (inBody || inHead || hatTip) {
        // 边缘像素 = 描边色（模拟 2px 描边）
        const isEdge = (inBody && bodyDx * bodyDx + bodyDy * bodyDy > 0.72) ||
                       (inHead && headDx * headDx + headDy * headDy > 0.72);
        const c = isEdge ? outline : body;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      } else {
        // 背景
        data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255;
      }
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

// 模拟敌人图（暗红主体 + 幽紫描边）
function makeEnemyPng() {
  return makeSilhouettePng({
    body: [126, 30, 30],       // 暗血红 #7E1E1E
    outline: [176, 106, 240],  // 幽紫 #B06AF0
    bg: [19, 23, 34]           // 暗紫灰 #131722
  });
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  // 生成 3 张模拟原图
  const hero = await makeSilhouettePng();
  fs.writeFileSync(path.join(RAW_DIR, 'player.png'), hero);
  fs.writeFileSync(path.join(RAW_DIR, 'player-v.png'), hero);

  const enemy = await makeEnemyPng();
  fs.writeFileSync(path.join(RAW_DIR, 'enemy-gravekeeper.png'), enemy);
  fs.writeFileSync(path.join(RAW_DIR, 'enemy-gravekeeper-v.png'), enemy);

  // 一个地图 tile（无主体要求，直接平铺色）
  const tileData = Buffer.alloc(256 * 256 * 4);
  for (let i = 0; i < tileData.length; i += 4) {
    tileData[i] = 24; tileData[i + 1] = 32; tileData[i + 2] = 28; tileData[i + 3] = 255;
  }
  fs.writeFileSync(path.join(RAW_DIR, 'tile-grave-soil.png'),
    await sharp(tileData, { raw: { width: 256, height: 256, channels: 4 } }).png().toBuffer());

  console.log('[selftest] 已生成 5 张模拟原图到 assets/raw/：player, player-v, enemy-gravekeeper, enemy-gravekeeper-v, tile-grave-soil');
  console.log('[selftest] 现在跑 process --all ...\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
