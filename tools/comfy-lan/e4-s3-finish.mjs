/**
 * E4 S3 finish-ab: Krea chosen | WAI 0.35 | WAI 0.45, one PNG per cell.
 *   node tools/comfy-lan/e4-s3-finish.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire("d:/code/vampire-survivors-like/tools/asset-pipeline/package.json");
const sharp = require("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SLATE = { r: 0x2a, g: 0x34, b: 0x44 };
const H = 672;
const PAD = 16;
const LABEL_H = 32;
const CELLS = ["P1", "P2", "P3", "P4", "P5", "P6"];
const IDS = ["violet-fallen", "cassandra"];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
}

async function fit(file, height) {
  const abs = path.isAbsolute(file) ? file : path.join(root, file);
  const meta = await sharp(abs).metadata();
  const w = Math.round((meta.width / meta.height) * height);
  return {
    buf: await sharp(abs).resize({ height, width: w, kernel: "lanczos3" }).png().toBuffer(),
    w,
    h: height,
  };
}

function labelSvg(w, h, text) {
  const esc = String(text).replace(/&/g, "&amp;");
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#2A3444"/>` +
      `<text x="8" y="${Math.round(h * 0.72)}" fill="#E8EEF6" font-size="16" font-family="Segoe UI, sans-serif">${esc}</text>` +
      `</svg>`,
  );
}

async function cellBoard(id, cell, krea, w035, w045) {
  const a = await fit(krea, H);
  const b = await fit(w035, H);
  const c = await fit(w045, H);
  const colW = Math.max(a.w, b.w, c.w);
  const width = PAD * 4 + colW * 3;
  const height = PAD + LABEL_H + H + PAD;
  const out = path.join(root, "characters", id, "review", "20260913-e4", `03-e4-${id}-${cell}-finish-ab.png`);
  await sharp({ create: { width, height, channels: 3, background: SLATE } })
    .composite([
      { input: labelSvg(colW, LABEL_H, `${id} ${cell}  Krea`), left: PAD, top: PAD },
      { input: labelSvg(colW, LABEL_H, "WAI 0.35"), left: PAD * 2 + colW, top: PAD },
      { input: labelSvg(colW, LABEL_H, "WAI 0.45"), left: PAD * 3 + colW * 2, top: PAD },
      { input: a.buf, left: PAD, top: PAD + LABEL_H },
      { input: b.buf, left: PAD * 2 + colW, top: PAD + LABEL_H },
      { input: c.buf, left: PAD * 3 + colW * 2, top: PAD + LABEL_H },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

const chosen = loadJson(
  path.join(root, "characters", "violet-fallen", "review", "20260913-e4", "chosen.json"),
);
for (const id of IDS) {
  const manPath = path.join(root, "characters", id, "review", "20260913-e4", "s3-manifest.json");
  const man = loadJson(manPath);
  const byCell = {};
  for (const r of man) {
    if (!byCell[r.cell]) byCell[r.cell] = {};
    byCell[r.cell][String(r.dn)] = r.png;
  }
  for (const cell of CELLS) {
    await cellBoard(id, cell, chosen[id][cell].png, byCell[cell]["0.35"], byCell[cell]["0.45"]);
  }
}
