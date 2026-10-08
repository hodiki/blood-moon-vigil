/**
 * E5 路 B：把去底人物贴进场景。无 GPU。
 * 脚点 = 人物不透明底边中点落在场景上的位置。
 *
 *   node compose-into-scene.mjs --scene <png> --person <rgba png> --foot 576,640 --height 576 --out <png>
 *   --foot 也可写 0.5,0.74（≤1 当画幅比例）
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire("d:/code/vampire-survivors-like/tools/asset-pipeline/package.json");
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return out;
}

function resolvePath(p) {
  if (!p) return p;
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

function parseFoot(s, w, h) {
  const [a, b] = String(s).split(",").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`bad --foot ${s}`);
  const x = Math.abs(a) <= 1 ? a * w : a;
  const y = Math.abs(b) <= 1 ? b * h : b;
  return [Math.round(x), Math.round(y)];
}

async function opaqueBBox(buf, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < width * height; i++) {
    if (buf[i * 4 + 3] < 16) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) throw new Error("人物没有不透明像素（去底失败？）");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  const args = parseArgs(process.argv);
  const scenePath = resolvePath(args.scene);
  const personPath = resolvePath(args.person);
  const outPath = resolvePath(args.out);
  if (!scenePath || !personPath || !outPath) {
    console.error("需要 --scene --person --out，以及 --foot x,y --height px");
    process.exit(1);
  }
  const sceneMeta = await sharp(scenePath).metadata();
  const sw = sceneMeta.width;
  const sh = sceneMeta.height;
  if (!sw || !sh) throw new Error("场景读不到尺寸");

  const raw = await sharp(personPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = await opaqueBBox(raw.data, raw.info.width, raw.info.height);
  const trimmed = await sharp(personPath).ensureAlpha().extract(box).png().toBuffer();
  const targetH = Number(args.height || Math.round(sh * (2 / 3)));
  if (!Number.isFinite(targetH) || targetH < 32) throw new Error("bad --height");
  const personBuf = await sharp(trimmed).resize({ height: targetH, fit: "inside" }).png().toBuffer();
  const sMeta = await sharp(personBuf).metadata();
  const pw = sMeta.width;
  const ph = sMeta.height;
  const [fx, fy] = parseFoot(args.foot || "0.5,0.74", sw, sh);
  let dstLeft = Math.round(fx - pw / 2);
  let dstTop = Math.round(fy - ph);
  let srcLeft = 0;
  let srcTop = 0;
  let cw = pw;
  let ch = ph;
  if (dstLeft < 0) {
    srcLeft = -dstLeft;
    cw += dstLeft;
    dstLeft = 0;
  }
  if (dstTop < 0) {
    srcTop = -dstTop;
    ch += dstTop;
    dstTop = 0;
  }
  if (dstLeft + cw > sw) cw = sw - dstLeft;
  if (dstTop + ch > sh) ch = sh - dstTop;
  if (cw < 8 || ch < 8) throw new Error("人物贴出画幅了，改 --foot / --height");
  const cropped = await sharp(personBuf)
    .extract({ left: srcLeft, top: srcTop, width: cw, height: ch })
    .png()
    .toBuffer();

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(scenePath)
    .composite([{ input: cropped, left: dstLeft, top: dstTop }])
    .png()
    .toFile(outPath);

  const rec = {
    scene: scenePath,
    person: personPath,
    out: outPath,
    scene_px: [sw, sh],
    bbox: box,
    placed: { left: dstLeft, top: dstTop, width: cw, height: ch, foot: [fx, fy] },
  };
  fs.writeFileSync(outPath.replace(/\.png$/i, ".json"), JSON.stringify(rec, null, 2));
  console.log(`composed ${pw}x${ph} at foot ${fx},${fy} -> ${outPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
