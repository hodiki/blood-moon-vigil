/**
 * 魔化 skill-b 两枪过目卡（印戳级）。不入盒、不写 frames。
 */
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const REVIEW = "d:/code/vampire-survivors-like/characters/violet-fallen/review/20260918-skill-128";
const IDLE = "d:/code/vampire-survivors-like/characters/violet-fallen/stamps/idle-blo.png";
const B1 = path.join(REVIEW, "comfy_lan_vf_skill_b_1_00001_.png");
const B2 = path.join(REVIEW, "comfy_lan_vf_skill_b_2_00001_.png");
const SLATE = { r: 42, g: 52, b: 68, alpha: 1 };
const colW = 280;
const imgH = 560;
const pad = 24;
const titleH = 44;
const labelH = 36;
const w = pad * 4 + colW * 3;
const h = titleH + labelH + imgH + pad + 28;

async function fit(file) {
  return sharp(file)
    .resize(colW, imgH, { fit: "inside", kernel: "lanczos3", background: SLATE })
    .ensureAlpha()
    .png()
    .toBuffer({ resolveWithObject: true });
}

const idle = await fit(IDLE);
const b1 = await fit(B1);
const b2 = await fit(B2);
const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${w / 2}" y="30" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="20" fill="#DCD6CC">魔化 skill-b · 张臂空手 · 未过 · 不写 frames/</text>
  <text x="${pad + colW / 2}" y="${titleH + 26}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#DCD6CC">idle B-lo 印戳已过</text>
  <text x="${pad + colW + pad + colW / 2}" y="${titleH + 26}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#E8C36A">B1 · seed 2026091801</text>
  <text x="${pad + colW * 2 + pad * 2 + colW / 2}" y="${titleH + 26}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="16" fill="#E8C36A">B2 · seed 2026091802</text>
  <text x="${pad}" y="${h - 10}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="13" fill="#DCD6CC">两枪都留角、空手、无翼。点选后再跟 idle 共用缩放入盒。</text>
</svg>`);

function left(buf, col) {
  return pad + col * (colW + pad) + Math.floor((colW - buf.info.width) / 2);
}
function top(buf) {
  return titleH + labelH + Math.floor((imgH - buf.info.height) / 2);
}

await sharp({
  create: { width: w, height: h, channels: 4, background: SLATE },
})
  .composite([
    { input: idle.data, left: left(idle, 0), top: top(idle) },
    { input: b1.data, left: left(b1, 1), top: top(b1) },
    { input: b2.data, left: left(b2, 2), top: top(b2) },
    { input: svg, left: 0, top: 0 },
  ])
  .png()
  .toFile(path.join(REVIEW, "06-pick-skill-b-stamps.png"));
console.log("wrote 06-pick-skill-b-stamps.png");
