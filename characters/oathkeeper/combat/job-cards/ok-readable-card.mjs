/**
 * hi stamp | 96 actual | 96 x4. Not a lock.
 */
import { createRequire } from "module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const REVIEW =
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/review-h23-wave15";
const STAMP = `${REVIEW}/08-raw-hi.png`;
const BOX = `${REVIEW}/04-w15-hi-96.png`;
const OUT = `${REVIEW}/11-hi-stamp-and-96.png`;
const PX = 96;
const SLATE = { r: 42, g: 52, b: 68, alpha: 1 };
const colW = 520;
const pad = 24;
const labelH = 40;
const imgH = 512;
const titleH = 44;
const w = pad + colW + pad + colW + pad + colW + pad;
const h = titleH + labelH + imgH + pad + 36;
const x4 = PX * 4;

const stampFit = await sharp(STAMP)
  .resize(colW, imgH, { fit: "inside", kernel: "lanczos3", background: SLATE })
  .ensureAlpha()
  .png()
  .toBuffer({ resolveWithObject: true });
const stampX = pad + Math.floor((colW - stampFit.info.width) / 2);
const stampY = titleH + labelH + Math.floor((imgH - stampFit.info.height) / 2);
const px1 = await sharp(BOX).ensureAlpha().png().toBuffer();
const px4 = await sharp(BOX).resize(x4, x4, { kernel: "nearest" }).png().toBuffer();

const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${w / 2}" y="30" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="20" fill="#DCD6CC">守誓者 · 左边印戳 · 中间才是入盒 96 · 未过 · 停在两枪</text>
  <text x="${pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">印戳（绘画大图）</text>
  <text x="${pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#E8C36A">入盒 96 · 原大</text>
  <text x="${pad + colW + pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">同一张 96 ×4（看盔缝和红羽）</text>
  <text x="${pad}" y="${h - 12}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">人还是站立骑士。96 盔缝弱、甲偏亮。按漂纪律不打第三枪。不是锁稿。</text>
</svg>`);

await sharp({
  create: { width: w, height: h, channels: 4, background: SLATE },
})
  .composite([
    { input: stampFit.data, left: stampX, top: stampY },
    {
      input: px1,
      left: pad + colW + pad + Math.floor((colW - PX) / 2),
      top: titleH + labelH + Math.floor((imgH - PX) / 2),
    },
    {
      input: px4,
      left: pad + colW + pad + colW + pad + Math.floor((colW - x4) / 2),
      top: titleH + labelH + Math.floor((imgH - x4) / 2),
    },
    { input: svg, left: 0, top: 0 },
  ])
  .png()
  .toFile(OUT);
console.log(OUT);
