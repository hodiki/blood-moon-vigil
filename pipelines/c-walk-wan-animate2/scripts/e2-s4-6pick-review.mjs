/**
 * E2 S4 review pack from boxed 128s: x4 strips, 3-col compare, 8fps loops.
 * Does not write assets/frames/.
 *
 * node e2-s4-6pick-review.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const PARK =
  "d:/code/vampire-survivors-like/characters/violet-oath/combat/walk/e2-s4-6pick-box";
const REVIEW =
  "d:/code/vampire-survivors-like/characters/violet-oath/combat/walk";
const SLATE = [42, 52, 68];
const INK = [0, 4, 12];
const SLATE_BG = { r: 42, g: 52, b: 68, alpha: 1 };
const PHASES = ["a", "e", "b", "c", "f", "d"];
const PHASE_CN = {
  a: "a 接触",
  e: "e 落下",
  b: "b 经过",
  c: "c 对侧",
  f: "f 落下",
  d: "d 经过",
};

async function loadRaw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: Buffer.from(data) };
}

function closedKeep(spr) {
  const w = spr.width;
  const h = spr.height;
  const exterior = new Uint8Array(w * h);
  const q = [];
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (exterior[i]) return;
    if (spr.data[i * 4 + 3] >= 128) return;
    exterior[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (q.length) {
    const i = q.pop();
    const x = i % w;
    const y = (i / w) | 0;
    seed(x - 1, y);
    seed(x + 1, y);
    seed(x, y - 1);
    seed(x, y + 1);
  }
  return (i) => !exterior[i];
}

function solidOnSlate(spr, scale) {
  const keep = closedKeep(spr);
  const w = spr.width * scale;
  const h = spr.height * scale;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(y / scale);
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x / scale);
      const i = sy * spr.width + sx;
      const o = (y * w + x) * 4;
      if (!keep(i)) {
        data[o] = SLATE[0];
        data[o + 1] = SLATE[1];
        data[o + 2] = SLATE[2];
        data[o + 3] = 255;
        continue;
      }
      const so = i * 4;
      if (spr.data[so + 3] >= 128) {
        data[o] = spr.data[so];
        data[o + 1] = spr.data[so + 1];
        data[o + 2] = spr.data[so + 2];
        data[o + 3] = 255;
      } else {
        data[o] = INK[0];
        data[o + 1] = INK[1];
        data[o + 2] = INK[2];
        data[o + 3] = 255;
      }
    }
  }
  return { width: w, height: h, data };
}

async function pngBuf(raw) {
  return sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function labeledStrip(title, foot, cells, out) {
  const pad = 10;
  const titleH = 36;
  const labelH = 18;
  const colW = cells[0].tile.width;
  const colH = cells[0].tile.height;
  const w = pad + cells.length * (colW + pad);
  const h = titleH + labelH + colH + pad + 24;
  const labels = cells
    .map(
      (c, i) =>
        `<text x="${pad + i * (colW + pad) + colW / 2}" y="${titleH + 14}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI" font-size="13" fill="#E8C36A">${c.label}</text>`,
    )
    .join("");
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${w / 2}" y="24" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI" font-size="14" fill="#DCD6CC">${title}</text>
  ${labels}
  <text x="${pad}" y="${h - 8}" font-family="Microsoft YaHei, Segoe UI" font-size="12" fill="#DCD6CC">${foot}</text>
</svg>`);
  const tiles = [];
  for (const c of cells) tiles.push(await pngBuf(c.tile));
  await sharp({
    create: { width: w, height: h, channels: 4, background: SLATE_BG },
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

async function writeAnim(frames, delay, gifPath, webpPath) {
  const w = frames[0].width;
  const h = frames[0].height;
  const n = frames.length;
  const stacked = Buffer.alloc(w * h * n * 4);
  for (let i = 0; i < n; i++) frames[i].data.copy(stacked, i * w * h * 4);
  const input = { raw: { width: w, height: h * n, channels: 4, pageHeight: h } };
  await sharp(stacked, input).webp({ loop: 0, delay, effort: 4 }).toFile(webpPath);
  console.log("wrote", webpPath);
  try {
    await sharp(stacked, input)
      .gif({ loop: 0, delay, effort: 1, dither: 0, reuse: true })
      .toFile(gifPath);
    console.log("wrote", gifPath);
    return "gif+webp";
  } catch (err) {
    console.warn("gif failed:", err.message);
    return "webp";
  }
}

const log = JSON.parse(readFileSync(`${PARK}/box-log.json`, "utf8"));
const idle = solidOnSlate(await loadRaw(`${PARK}/idle-128-knock.png`), 4);

const guns = [
  { id: "s2-a", title: "S2-a · 480×832 · 空手", strip: "19-e2-s4-s2-a-6x128-strip.png", gif: "20-e2-s4-s2-a-walk.gif", webp: "20-e2-s4-s2-a-walk.webp" },
  { id: "s3c-b", title: "S3c-b · 384×672 · 有烛", strip: "21-e2-s4-s3c-b-6x128-strip.png", gif: "22-e2-s4-s3c-b-walk.gif", webp: "22-e2-s4-s3c-b-walk.webp" },
];

const boxed = {};
for (const g of guns) {
  boxed[g.id] = [];
  for (const ph of PHASES) {
    const spr = await loadRaw(`${PARK}/${g.id}-walk-${ph}-128.png`);
    const rec = log.frames.find((f) => f.gun === g.id && f.phase === ph);
    boxed[g.id].push({ ph, f: rec.srcFrame, tile: solidOnSlate(spr, 4) });
  }
}

await labeledStrip(
  "E2 S4 S2-a 128 ×4 · 播序 a,e,b,c,f,d · 未过 · 未写 frames/",
  `共用缩放 ${Number(log.shared["s2-a"]).toFixed(4)} · 空手 · 脚底对齐 idle y${log.idleMetrics.footY} · 未印戳`,
  boxed["s2-a"].map((fr) => ({ tile: fr.tile, label: `${PHASE_CN[fr.ph]} · f${fr.f}` })),
  `${REVIEW}/${guns[0].strip}`,
);
await labeledStrip(
  "E2 S4 S3c-b 128 ×4 · 播序 a,e,b,c,f,d · 未过 · 未写 frames/",
  `共用缩放 ${Number(log.shared["s3c-b"]).toFixed(4)} · 烛偏低 · 脚底对齐 idle y${log.idleMetrics.footY} · 未印戳`,
  boxed["s3c-b"].map((fr) => ({ tile: fr.tile, label: `${PHASE_CN[fr.ph]} · f${fr.f}` })),
  `${REVIEW}/${guns[1].strip}`,
);

const pad = 8;
const titleH = 40;
const labelH = 18;
const rowH = 22;
const cell = idle.width;
const cols = 3;
const rows = 6;
const cmpW = pad + cols * (cell + pad);
const cmpH = titleH + labelH + rowH + rows * (cell + pad) + 28;
const tiles = [];
for (let r = 0; r < rows; r++) {
  tiles.push(await pngBuf(idle));
  tiles.push(await pngBuf(boxed["s2-a"][r].tile));
  tiles.push(await pngBuf(boxed["s3c-b"][r].tile));
}
const colSvg = ["已过 idle 128", guns[0].title, guns[1].title]
  .map(
    (t, i) =>
      `<text x="${pad + i * (cell + pad) + cell / 2}" y="${titleH + 14}" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI" font-size="13" fill="#E8C36A">${t}</text>`,
  )
  .join("");
const rowSvg = PHASES.map((ph, r) => {
  const y = titleH + labelH + rowH + r * (cell + pad) - 6;
  return `<text x="${pad + 6}" y="${y}" font-family="Microsoft YaHei, Segoe UI" font-size="12" fill="#E8C36A">${PHASE_CN[ph]}</text>`;
}).join("");
const svg = Buffer.from(`<svg width="${cmpW}" height="${cmpH}" xmlns="http://www.w3.org/2000/svg">
  <text x="${cmpW / 2}" y="26" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI" font-size="15" fill="#DCD6CC">E2 S4 对照 · idle / S2-a / S3c-b · 128 近邻 ×4 · 未过 · 未写 frames/</text>
  ${colSvg}
  ${rowSvg}
  <text x="${pad}" y="${cmpH - 8}" font-family="Microsoft YaHei, Segoe UI" font-size="12" fill="#DCD6CC">每枪六帧共用缩放与脚底。未印戳。循环首格 = idle。</text>
</svg>`);
const comp = [];
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    comp.push({
      input: tiles[r * cols + c],
      left: pad + c * (cell + pad),
      top: titleH + labelH + rowH + r * (cell + pad),
    });
  }
}
const cmpOut = `${REVIEW}/23-e2-s4-compare-3col.png`;
await sharp({
  create: { width: cmpW, height: cmpH, channels: 4, background: SLATE_BG },
})
  .composite([...comp, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(cmpOut);
console.log("wrote", cmpOut);

let animKind = "";
for (const g of guns) {
  animKind = await writeAnim(
    [idle, ...boxed[g.id].map((fr) => fr.tile)],
    125,
    `${REVIEW}/${g.gif}`,
    `${REVIEW}/${g.webp}`,
  );
}

writeFileSync(`${REVIEW}/24-e2-s4-gates.json`, JSON.stringify(log, null, 2));
writeFileSync(
  `${REVIEW}/25-e2-s4-6pick-loops.html`,
  `<!doctype html>
<meta charset="utf-8" />
<title>E2 S4 六帧对照</title>
<style>
  body { margin: 24px; background: #2A3444; color: #DCD6CC; font-family: "Microsoft YaHei", sans-serif; }
  h1 { font-size: 16px; font-weight: 600; }
  p { font-size: 13px; max-width: 1400px; }
  .row { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px; }
  figure { margin: 0; }
  figcaption { text-align: center; margin: 8px 0 0; color: #E8C36A; font-size: 13px; }
  img.loop { height: 512px; background: #1a222c; display: block; image-rendering: pixelated; }
</style>
<h1>E2 S4 六帧循环 · 8fps · 首格 idle · 未过 · 未写 frames/</h1>
<p>左 S2-a 空手；右 S3c-b 有烛。石板 ×4。静帧对照 <a href="23-e2-s4-compare-3col.png" style="color:#E8C36A">23-e2-s4-compare-3col.png</a>。</p>
<div class="row">
  <figure>
    <img class="loop" src="20-e2-s4-s2-a-walk.webp" alt="S2-a" />
    <figcaption>S2-a · idle→a,e,b,c,f,d</figcaption>
  </figure>
  <figure>
    <img class="loop" src="22-e2-s4-s3c-b-walk.webp" alt="S3c-b" />
    <figcaption>S3c-b · idle→a,e,b,c,f,d</figcaption>
  </figure>
</div>
`,
);
console.log("anim", animKind);
console.log("gates", `${REVIEW}/24-e2-s4-gates.json`);
