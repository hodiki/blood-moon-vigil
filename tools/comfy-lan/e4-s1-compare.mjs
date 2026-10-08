/**
 * E4 S1a vs S1b side-by-side. Node + sharp. Does not write assets/frames/.
 *
 *   node tools/comfy-lan/e4-s1-compare.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire("d:/code/vampire-survivors-like/tools/asset-pipeline/package.json");
const sharp = require("sharp");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SLATE = { r: 0x2a, g: 0x34, b: 0x44 };
const ROW_H = 512;
const PAD = 16;
const LABEL_H = 36;
const CELLS = ["P1", "P2", "P3", "P4", "P5", "P6"];

const S1A = {
  "violet-fallen": {
    P1: "characters/violet-fallen/_park/2026-09-14T02-11-29-747Z/comfy_lan_e4_vf_P1_s0_00001_.png",
    P2: "characters/violet-fallen/_park/2026-09-14T02-15-06-188Z/comfy_lan_e4_vf_P2_s1_00001_.png",
    P3: "characters/violet-fallen/_park/2026-09-14T02-16-38-122Z/comfy_lan_e4_vf_P3_s1_00001_.png",
    P4: "characters/violet-fallen/_park/2026-09-14T02-18-09-625Z/comfy_lan_e4_vf_P4_s1_00001_.png",
    P5: "characters/violet-fallen/_park/2026-09-14T02-19-41-248Z/comfy_lan_e4_vf_P5_s1_00001_.png",
    P6: "characters/violet-fallen/_park/2026-09-14T02-23-23-707Z/comfy_lan_e4_vf_P6_s1-g768_00001_.png",
  },
  cassandra: {
    P1: "characters/cassandra/_park/2026-09-14T02-26-17-205Z/comfy_lan_e4_cas_P1_s1_00001_.png",
    P2: "characters/cassandra/_park/2026-09-14T02-27-10-454Z/comfy_lan_e4_cas_P2_s1_00001_.png",
    P3: "characters/cassandra/_park/2026-09-14T02-28-41-982Z/comfy_lan_e4_cas_P3_s1_00001_.png",
    P4: "characters/cassandra/_park/2026-09-14T02-30-13-636Z/comfy_lan_e4_cas_P4_s1_00001_.png",
    P5: "characters/cassandra/_park/2026-09-14T02-31-47-175Z/comfy_lan_e4_cas_P5_s1_00001_.png",
    P6: "characters/cassandra/_park/2026-09-14T02-33-14-654Z/comfy_lan_e4_cas_P6_s1_00001_.png",
  },
};

function loadManifest(id) {
  const p = path.join(root, "characters", id, "review", "20260913-e4", "s1b-manifest.json");
  const raw = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

async function cellPng(file, height) {
  const abs = path.isAbsolute(file) ? file : path.join(root, file);
  const meta = await sharp(abs).metadata();
  const w = Math.round((meta.width / meta.height) * height);
  return {
    buf: await sharp(abs)
      .resize({ height, width: w, kernel: "lanczos3" })
      .png()
      .toBuffer(),
    w,
    h: height,
  };
}

function labelSvg(w, h, text) {
  const esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#2A3444"/>` +
      `<text x="8" y="${Math.round(h * 0.7)}" fill="#E8EEF6" font-size="18" font-family="Segoe UI, sans-serif">${esc}</text>` +
      `</svg>`,
  );
}

async function board(id) {
  const man = loadManifest(id);
  const byCell = Object.fromEntries(man.map((r) => [r.cell, r.png]));
  const cols = [];
  for (const cell of CELLS) {
    const a = await cellPng(S1A[id][cell], ROW_H);
    const b = await cellPng(byCell[cell], ROW_H);
    cols.push({ cell, a, b });
  }
  const colW = Math.max(...cols.flatMap((c) => [c.a.w, c.b.w]));
  const width = PAD + colW + PAD + colW + PAD;
  const height = PAD + LABEL_H + (ROW_H + LABEL_H) * 6 + PAD;
  let canvas = sharp({
    create: { width, height, channels: 3, background: SLATE },
  });
  const composites = [
    {
      input: labelSvg(width, LABEL_H, `${id}  ·  S1a (left) vs S1b (right)  ·  same seed`),
      left: 0,
      top: PAD,
    },
  ];
  for (let i = 0; i < cols.length; i++) {
    const y = PAD + LABEL_H + i * (ROW_H + LABEL_H);
    composites.push({ input: labelSvg(colW, LABEL_H, `${cols[i].cell} S1a`), left: PAD, top: y });
    composites.push({
      input: labelSvg(colW, LABEL_H, `${cols[i].cell} S1b`),
      left: PAD + colW + PAD,
      top: y,
    });
    composites.push({ input: cols[i].a.buf, left: PAD, top: y + LABEL_H });
    composites.push({
      input: cols[i].b.buf,
      left: PAD + colW + PAD,
      top: y + LABEL_H,
    });
  }
  const out = path.join(root, "characters", id, "review", "20260913-e4", `12-e4-${id}-s1-compare.png`);
  await canvas.composite(composites).png().toFile(out);
  console.log("wrote", out);
}

await board("violet-fallen");
await board("cassandra");
