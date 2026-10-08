import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire("d:/code/vampire-survivors-like/tools/asset-pipeline/package.json");
const sharp = require("sharp");

const rev = "d:/code/vampire-survivors-like/characters/violet-fallen/review/20260915-e5";
const SLATE = { r: 0x2a, g: 0x34, b: 0x44 };
const ROW_H = 420;
const PAD = 16;
const LABEL_H = 32;

async function col(file, h) {
  const meta = await sharp(file).metadata();
  const w = Math.round((meta.width / meta.height) * h);
  return {
    buf: await sharp(file).resize({ height: h, width: w, kernel: "lanczos3" }).png().toBuffer(),
    w,
    h,
  };
}

function lab(w, h, text) {
  const esc = String(text).replace(/&/g, "&amp;");
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#2A3444"/>` +
      `<text x="8" y="${Math.round(h * 0.7)}" fill="#E8EEF6" font-size="18" font-family="Segoe UI, Microsoft YaHei, sans-serif">${esc}</text>` +
      `</svg>`,
  );
}

async function board(files, labels, outName) {
  const cols = [];
  for (const f of files) cols.push(await col(f, ROW_H));
  const colW = Math.max(...cols.map((c) => c.w));
  const width = PAD + cols.length * (colW + PAD);
  const height = PAD + LABEL_H + ROW_H + PAD;
  const canvas = await sharp({ create: { width, height, channels: 3, background: SLATE } })
    .png()
    .toBuffer();
  const composites = [];
  for (let i = 0; i < cols.length; i++) {
    const x = PAD + i * (colW + PAD);
    const xOff = x + Math.round((colW - cols[i].w) / 2);
    composites.push({ input: lab(colW, LABEL_H, labels[i]), left: x, top: PAD });
    composites.push({ input: cols[i].buf, left: xOff, top: PAD + LABEL_H });
  }
  await sharp(canvas).composite(composites).png().toFile(path.join(rev, outName));
  console.log("wrote", outName);
}

await board(
  [rev + "/00-e5-scene-A.png", rev + "/01-e5-A-routeA.png", rev + "/02-e5-A-routeB.png"],
  ["A2 底", "路 A 双输入", "路 B 合成调和"],
  "03-e5-A-routeAB-full.png",
);
await board(
  [rev + "/00-e5-scene-B.png", rev + "/01-e5-B-routeA.png", rev + "/02-e5-B-routeB.png"],
  ["B1 底", "路 A 双输入", "路 B 合成调和"],
  "03-e5-B-routeAB-full.png",
);
