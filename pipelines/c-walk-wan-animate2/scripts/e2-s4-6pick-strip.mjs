/**
 * E2 S4 Williams 6-pick strips (playback a,e,b,c,f,d).
 * Source painting frames on slate. Does not write assets/frames/.
 */
import { createRequire } from "node:module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const REVIEW =
  "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/review-exp-e2";
const SLATE = { r: 42, g: 52, b: 68, alpha: 1 };
const START = 50;

const GUNS = [
  {
    park: "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/2026-09-12T08-19-52-138Z",
    prefix: "comfy_lan_e2_s4_s2_a",
    out: "16-e2-s4-s2-a-6pick-strip.png",
    title: "E2 S4 S2-a 六帧 · 播序 a,e,b,c,f,d · 未过 · 未入盒",
    foot: "周期 f9→f25 = 16f。空手。c +1 / d +1。不写 frames/",
    picks: [
      { phase: "a 接触", f: 9 },
      { phase: "e 落下", f: 12 },
      { phase: "b 经过", f: 14 },
      { phase: "c 对侧", f: 18 },
      { phase: "f 落下", f: 20 },
      { phase: "d 经过", f: 23 },
    ],
  },
  {
    park: "d:/code/vampire-survivors-like/assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/2026-09-12T08-53-04-910Z",
    prefix: "comfy_lan_e2_s4_s3c_b",
    out: "17-e2-s4-s3c-b-6pick-strip.png",
    title: "E2 S4 S3c-b 六帧 · 播序 a,e,b,c,f,d · 未过 · 未入盒",
    foot: "周期 f9→f25 = 16f。烛在手（偏低）。f −1。不写 frames/",
    picks: [
      { phase: "a 接触", f: 9 },
      { phase: "e 落下", f: 12 },
      { phase: "b 经过", f: 14 },
      { phase: "c 对侧", f: 17 },
      { phase: "f 落下", f: 19 },
      { phase: "d 经过", f: 22 },
    ],
  },
];

function framePath(g, f) {
  const n = String(START + f - 1).padStart(5, "0");
  return `${g.park}/${g.prefix}_${n}_.png`;
}

async function tile(file, colW, colH) {
  const fit = await sharp(file)
    .resize(colW, colH, {
      fit: "contain",
      background: SLATE,
      kernel: "lanczos3",
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp({
    create: { width: colW, height: colH, channels: 4, background: SLATE },
  })
    .composite([
      {
        input: fit.data,
        left: Math.floor((colW - fit.info.width) / 2),
        top: Math.floor((colH - fit.info.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

const colW = 168;
const colH = 292;
const pad = 10;
const titleH = 36;
const labelH = 18;

for (const g of GUNS) {
  const n = g.picks.length;
  const w = pad + n * (colW + pad);
  const h = titleH + labelH + colH + pad + 24;
  const tiles = [];
  for (const p of g.picks) tiles.push(await tile(framePath(g, p.f), colW, colH));
  const labels = g.picks
    .map(
      (p, i) =>
        `<text x="${pad + i * (colW + pad) + colW / 2}" y="${titleH + 14}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI" font-size="12" fill="#E8C36A">${p.phase} · f${p.f}</text>`,
    )
    .join("");
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${w / 2}" y="24" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI" font-size="13" fill="#DCD6CC">${g.title}</text>
  ${labels}
  <text x="${pad}" y="${h - 8}" font-family="Microsoft YaHei, Segoe UI" font-size="11" fill="#DCD6CC">${g.foot}</text>
</svg>`);
  const out = `${REVIEW}/${g.out}`;
  await sharp({
    create: { width: w, height: h, channels: 4, background: SLATE },
  })
    .composite([
      ...tiles.map((buf, i) => ({
        input: buf,
        left: pad + i * (colW + pad),
        top: titleH + labelH,
      })),
      { input: svg, left: 0, top: 0 },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}
