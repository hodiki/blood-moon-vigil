/**
 * Height compare Vo 128 vs Ok 192, plus hi stamp | 192 | 192x4.
 */
import { createRequire } from "module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const REVIEW =
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/review-h23-wave16";
const VO = `${REVIEW}/00-vo-idle-128-passed.png`;
const HI = `${REVIEW}/04-w16-hi-192.png`;
const BLO = `${REVIEW}/13-w16-blo-192.png`;
const D2 = `${REVIEW}/03-cut-d2-192.png`;
const STAMP = `${REVIEW}/08-raw-hi.png`;
const STAMP_B = `${REVIEW}/18-raw-blo.png`;
const SLATE = { r: 42, g: 52, b: 68, alpha: 1 };

async function heightCard() {
  const vo = await sharp(VO).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const hi = await sharp(HI).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const d2 = await sharp(D2).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const pad = 32;
  const labelH = 44;
  const floor = 24;
  const titleH = 40;
  const col = 220;
  const imgH = 192;
  const w = pad + col + pad + col + pad + col + pad;
  const h = titleH + labelH + imgH + floor + 36;
  const foot = titleH + labelH + imgH;
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${w / 2}" y="28" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="18" fill="#DCD6CC">脚底对齐 · 她 128 · 他 192 · 未过 · 不写 frames/</text>
    <text x="${pad + col / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="15" fill="#DCD6CC">薇奥莱 idle 128（已过）</text>
    <text x="${pad + col + pad + col / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="15" fill="#E8C36A">守誓者 hi 192</text>
    <text x="${pad + col + pad + col + pad + col / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="15" fill="#DCD6CC">D2 骑士切 192（色面积，无脸）</text>
    <text x="${pad}" y="${h - 12}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">192 = 128 的 1.5 倍。他必须明显高于她。印戳语言未过。</text>
  </svg>`);
  const place = (buf, info, colIndex) => {
    const x = pad + colIndex * (col + pad) + Math.floor((col - info.width) / 2);
    const y = foot - info.height;
    return { input: buf, left: x, top: y };
  };
  await sharp({
    create: { width: w, height: h, channels: 4, background: SLATE },
  })
    .composite([
      place(vo.data, vo.info, 0),
      place(hi.data, hi.info, 1),
      place(d2.data, d2.info, 2),
      { input: svg, left: 0, top: 0 },
    ])
    .png()
    .toFile(`${REVIEW}/11-height-vo128-ok192.png`);
}

async function stampCard() {
  const colW = 520;
  const pad = 24;
  const labelH = 40;
  const imgH = 512;
  const titleH = 44;
  const PX = 192;
  const x4 = PX * 2;
  const w = pad + colW + pad + colW + pad + colW + pad;
  const h = titleH + labelH + imgH + pad + 36;
  const stampFit = await sharp(STAMP)
    .resize(colW, imgH, { fit: "inside", kernel: "lanczos3", background: SLATE })
    .ensureAlpha()
    .png()
    .toBuffer({ resolveWithObject: true });
  const px1 = await sharp(HI).ensureAlpha().png().toBuffer();
  const px2 = await sharp(HI).resize(x4, x4, { kernel: "nearest" }).png().toBuffer();
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${w / 2}" y="30" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="18" fill="#DCD6CC">守誓者 hi · 左边印戳 · 中间才是入盒 192 · 未过</text>
    <text x="${pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">印戳（绘画大图）</text>
    <text x="${pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#E8C36A">入盒 192 · 原大</text>
    <text x="${pad + colW + pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">同一张 192 ×2</text>
    <text x="${pad}" y="${h - 12}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">人是站立骑士。盔缝比 96 清楚。甲仍偏亮，还不是 D2 硬色块。不是锁稿。</text>
  </svg>`);
  await sharp({
    create: { width: w, height: h, channels: 4, background: SLATE },
  })
    .composite([
      {
        input: stampFit.data,
        left: pad + Math.floor((colW - stampFit.info.width) / 2),
        top: titleH + labelH + Math.floor((imgH - stampFit.info.height) / 2),
      },
      {
        input: px1,
        left: pad + colW + pad + Math.floor((colW - PX) / 2),
        top: titleH + labelH + Math.floor((imgH - PX) / 2),
      },
      {
        input: px2,
        left: pad + colW + pad + colW + pad + Math.floor((colW - x4) / 2),
        top: titleH + labelH + Math.floor((imgH - x4) / 2),
      },
      { input: svg, left: 0, top: 0 },
    ])
    .png()
    .toFile(`${REVIEW}/12-hi-stamp-and-192.png`);
}

async function heightCardB() {
  const vo = await sharp(VO).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const blo = await sharp(BLO).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const d2 = await sharp(D2).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const pad = 32;
  const labelH = 44;
  const floor = 24;
  const titleH = 40;
  const col = 220;
  const imgH = 192;
  const w = pad + col + pad + col + pad + col + pad;
  const h = titleH + labelH + imgH + floor + 36;
  const foot = titleH + labelH + imgH;
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${w / 2}" y="28" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="18" fill="#DCD6CC">B-lo · 脚底对齐 · 她 128 · 他 192 · 未过 · 不写 frames/</text>
    <text x="${pad + col / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="15" fill="#DCD6CC">薇奥莱 idle 128（已过）</text>
    <text x="${pad + col + pad + col / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="15" fill="#E8C36A">守誓者 B-lo 192</text>
    <text x="${pad + col + pad + col + pad + col / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="15" fill="#DCD6CC">D2 骑士切 192（色面积，无脸）</text>
    <text x="${pad}" y="${h - 12}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">人还在。甲仍偏亮，肩比 O-3 瘦。B 两枪已满，停 Queue。</text>
  </svg>`);
  const place = (buf, info, colIndex) => {
    const x = pad + colIndex * (col + pad) + Math.floor((col - info.width) / 2);
    const y = foot - info.height;
    return { input: buf, left: x, top: y };
  };
  await sharp({
    create: { width: w, height: h, channels: 4, background: SLATE },
  })
    .composite([
      place(vo.data, vo.info, 0),
      place(blo.data, blo.info, 1),
      place(d2.data, d2.info, 2),
      { input: svg, left: 0, top: 0 },
    ])
    .png()
    .toFile(`${REVIEW}/15-height-vo128-blo192.png`);
}

async function stampCardB() {
  const colW = 520;
  const pad = 24;
  const labelH = 40;
  const imgH = 512;
  const titleH = 44;
  const PX = 192;
  const x4 = PX * 2;
  const w = pad + colW + pad + colW + pad + colW + pad;
  const h = titleH + labelH + imgH + pad + 36;
  const stampFit = await sharp(STAMP_B)
    .resize(colW, imgH, { fit: "inside", kernel: "lanczos3", background: SLATE })
    .ensureAlpha()
    .png()
    .toBuffer({ resolveWithObject: true });
  const px1 = await sharp(BLO).ensureAlpha().png().toBuffer();
  const px2 = await sharp(BLO).resize(x4, x4, { kernel: "nearest" }).png().toBuffer();
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${w / 2}" y="30" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="18" fill="#DCD6CC">守誓者 B-lo · 左边印戳 · 中间才是入盒 192 · 未过</text>
    <text x="${pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">B 印戳（denoise 0.48）</text>
    <text x="${pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#E8C36A">入盒 192 · 原大</text>
    <text x="${pad + colW + pad + colW + pad + colW / 2}" y="${titleH + 28}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">同一张 192 ×2</text>
    <text x="${pad}" y="${h - 12}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">盔缝还在。夜空底干净。甲仍偏亮，还不是她那种硬色块。不是锁稿。</text>
  </svg>`);
  await sharp({
    create: { width: w, height: h, channels: 4, background: SLATE },
  })
    .composite([
      {
        input: stampFit.data,
        left: pad + Math.floor((colW - stampFit.info.width) / 2),
        top: titleH + labelH + Math.floor((imgH - stampFit.info.height) / 2),
      },
      {
        input: px1,
        left: pad + colW + pad + Math.floor((colW - PX) / 2),
        top: titleH + labelH + Math.floor((imgH - PX) / 2),
      },
      {
        input: px2,
        left: pad + colW + pad + colW + pad + Math.floor((colW - x4) / 2),
        top: titleH + labelH + Math.floor((imgH - x4) / 2),
      },
      { input: svg, left: 0, top: 0 },
    ])
    .png()
    .toFile(`${REVIEW}/16-blo-stamp-and-192.png`);
}

await heightCard();
await stampCard();
await heightCardB();
await stampCardB();
console.log("wrote 11 12 15 16 review cards");
