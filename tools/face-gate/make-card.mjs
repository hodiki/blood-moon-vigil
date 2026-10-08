/**
 * Face-gate card. Node + sharp, no GPU.
 * Spec: design/art-bible/face-gate-spec-v1.md §2–§3 · §7
 *
 * Init refs (no judge):
 *   node make-card.mjs --init-ref --id cassandra [--ref path] [--eyes x,y] [--crown y] [--clavicle y]
 *
 * Portrait card:
 *   node make-card.mjs --id cassandra --ref <图1′> --new <新图> --topic e4-P1 [--eyes x,y]
 *
 * Video card:
 *   node make-card.mjs --id cassandra --ref <图1′> --frames f1,f2,f3 --topic e6-seg1
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire("d:/code/vampire-survivors-like/tools/asset-pipeline/package.json");
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SLATE = { r: 0x2a, g: 0x34, b: 0x44, hex: "#2A3444" };
const BUST_H = 768;
const BUST_W = Math.round(BUST_H * 0.75); // 576
const FULL_H = 512;
const IDS = ["cassandra", "edmund", "violet-oath", "violet-fallen", "galvan", "oathkeeper"];

const DEFAULT_REF = {
  cassandra: "characters/cassandra/identity/source/h23.png",
  edmund: "characters/edmund/identity/source/char-bible-portrait-edmund-gpt.png",
  "violet-oath": "characters/violet-oath/identity/source/oath-solo.png",
  "violet-fallen": "characters/violet-fallen/identity/source/vf1-clean.png",
  galvan: "characters/galvan/identity/source/char-bible-portrait-galvan-bulk-a.png",
  oathkeeper: "characters/oathkeeper/identity/source/ok-solo.png",
};

/** Source-pixel anchors for 图1′. Override with --eyes / --crown / --clavicle. */
const DEFAULT_ANCHORS = {
  cassandra: { eyes: [378, 198], crown: 10, clavicle: 355 },
  edmund: { eyes: [478, 278], crown: 72, clavicle: 455 },
  "violet-oath": { eyes: [242, 342], crown: 212, clavicle: 448 },
  "violet-fallen": { eyes: [360, 172], crown: 8, clavicle: 348 },
  galvan: { eyes: [392, 188], crown: 28, clavicle: 348 },
  oathkeeper: { eyes: [198, 218], crown: 10, clavicle: 390 },
};

function parseArgs(argv) {
  const out = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    if (k === "init-ref") {
      out.flags.add("init-ref");
      continue;
    }
    out[k] = argv[++i];
  }
  return out;
}

function resolvePath(p) {
  if (!p) return p;
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

function parseXY(s) {
  const [x, y] = String(s).split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`bad --eyes ${s}`);
  return [x, y];
}

function gateDir(id) {
  return path.join(ROOT, "characters", id, "identity", "face-gate");
}

function loadAnchors(id, args) {
  const file = path.join(gateDir(id), "00-anchors.json");
  let base = DEFAULT_ANCHORS[id] ? { ...DEFAULT_ANCHORS[id] } : null;
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    base = { eyes: saved.eyes, crown: saved.crown, clavicle: saved.clavicle };
  }
  if (!base) throw new Error(`no default anchors for ${id}; pass --eyes --crown --clavicle`);
  if (args.eyes) base.eyes = parseXY(args.eyes);
  if (args.crown != null) base.crown = Number(args.crown);
  if (args.clavicle != null) base.clavicle = Number(args.clavicle);
  return base;
}

function scaleAnchors(anchors, fromMeta, toMeta) {
  const sx = toMeta.width / fromMeta.width;
  const sy = toMeta.height / fromMeta.height;
  return {
    eyes: [anchors.eyes[0] * sx, anchors.eyes[1] * sy],
    crown: anchors.crown * sy,
    clavicle: anchors.clavicle * sy,
  };
}

function bustBox(meta, anchors) {
  const { width: w, height: h } = meta;
  const [ex, ey] = anchors.eyes;
  const inner = Math.max(8, anchors.clavicle - anchors.crown);
  const top = Math.max(0, Math.round(anchors.crown - 0.05 * inner));
  const bottom = Math.min(h, Math.round(anchors.clavicle));
  let boxH = Math.max(8, bottom - top);
  let boxW = Math.round(boxH * 0.75);
  let left = Math.round(ex - boxW / 2);
  if (boxW > w) {
    boxW = w;
    left = 0;
  } else {
    if (left < 0) left = 0;
    if (left + boxW > w) left = w - boxW;
  }
  return {
    left,
    top,
    width: boxW,
    height: boxH,
    eyes: [ex, ey],
    crown: anchors.crown,
    clavicle: anchors.clavicle,
  };
}

async function extractBust(srcPath, box) {
  const buf = await sharp(srcPath)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .resize({ width: BUST_W, height: BUST_H, fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
  return buf;
}

async function extractFull(srcPath) {
  return sharp(srcPath).resize({ height: FULL_H, kernel: "lanczos3" }).png().toBuffer();
}

function slatePng(w, h) {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: SLATE.r, g: SLATE.g, b: SLATE.b, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function titleSvg(w, h, text) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="${SLATE.hex}"/>
      <text x="24" y="${Math.round(h * 0.68)}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="22" fill="#E8EEF6">${escapeXml(text)}</text>
    </svg>`,
  );
}

function footerSvg(w, h, kind) {
  const line =
    kind === "video"
      ? "[ ] f1   [ ] mid   [ ] last     segment: ____     (pass / kin / swap)"
      : "[ ] 1 proportion   [ ] 2 eye   [ ] 3 hair   [ ] 4 mark   [ ] parts     result: ____";
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="${SLATE.hex}"/>
      <text x="24" y="36" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="18" fill="#C5D0DC">${escapeXml(line)}</text>
      <text x="24" y="64" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="14" fill="#8A97A8">owner fills result; assistant ticks parts only</text>
    </svg>`,
  );
}

async function paste(canvas, buf, left, top) {
  const { width, height } = await sharp(buf).metadata();
  return sharp(canvas)
    .composite([{ input: buf, left, top }])
    .png()
    .toBuffer()
    .then((out) => ({ buf: out, width, height }));
}

function isoDate() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

async function writeInitRef(id, args) {
  const ref = resolvePath(args.ref || DEFAULT_REF[id]);
  if (!fs.existsSync(ref)) throw new Error(`missing ref ${ref}`);
  const dir = gateDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const meta = await sharp(ref).metadata();
  const anchors = loadAnchors(id, args);
  const box = bustBox(meta, anchors);
  const bust = await extractBust(ref, box);
  const full = await extractFull(ref);
  const bustPath = path.join(dir, "00-bust-ref.png");
  const fullPath = path.join(dir, "00-full-ref.png");
  fs.writeFileSync(bustPath, bust);
  fs.writeFileSync(fullPath, full);
  const rec = {
    id,
    date: isoDate(),
    source: rel(ref),
    sourceSize: { width: meta.width, height: meta.height },
    eyes: box.eyes,
    crown: box.crown,
    clavicle: box.clavicle,
    box: { left: box.left, top: box.top, width: box.width, height: box.height },
    bust: { width: BUST_W, height: BUST_H },
    full: { height: FULL_H },
    note: "historical lock; no retrospective judge",
  };
  fs.writeFileSync(path.join(dir, "00-anchors.json"), JSON.stringify(rec, null, 2) + "\n");
  fs.writeFileSync(
    path.join(dir, "00-source.md"),
    `# ${id} · 脸门基准（不回溯判）\n\n` +
      `- 源：\`${rec.source}\`（${meta.width}×${meta.height}）\n` +
      `- 胸像：\`00-bust-ref.png\` ${BUST_W}×${BUST_H} · 全身缩略：\`00-full-ref.png\` 高 ${FULL_H}\n` +
      `- 锚：eyes ${box.eyes.join(",")} · crown ${box.crown} · clavicle ${box.clavicle}\n` +
      `- 裁框：x${box.left} y${box.top} ${box.width}×${box.height}\n` +
      `- 日期：${rec.date}。历史锁图补发基准，**不回溯判**。图1′ 本身不是 D 轨料，不进 \`lora/dataset/\`。\n`,
  );
  console.log("wrote", rel(bustPath), rel(fullPath), JSON.stringify(box));
}

function emptyJudge() {
  return {
    proportion: null,
    eye: null,
    hair: null,
    mark: null,
    parts: [],
    result: null,
    notes: "",
  };
}

async function writePortraitCard(id, args) {
  const ref = resolvePath(args.ref || DEFAULT_REF[id]);
  const neu = resolvePath(args.new);
  const topic = args.topic || "untitled";
  if (!neu || !fs.existsSync(neu)) throw new Error("need --new <path>");
  const dir = gateDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const refAnchors = loadAnchors(id, {});
  const refMeta = await sharp(ref).metadata();
  const newMeta = await sharp(neu).metadata();
  const newAnchors = scaleAnchors(refAnchors, refMeta, newMeta);
  if (args.eyes) newAnchors.eyes = parseXY(args.eyes);
  if (args.crown != null) newAnchors.crown = Number(args.crown);
  if (args.clavicle != null) newAnchors.clavicle = Number(args.clavicle);
  const refBox = bustBox(refMeta, refAnchors);
  const newBox = bustBox(newMeta, newAnchors);
  const col1 = await extractBust(ref, refBox);
  const col2 = await extractFull(neu);
  const col3 = await extractBust(neu, newBox);
  const fullMeta = await sharp(col2).metadata();
  const PAD = 24;
  const TITLE_H = 56;
  const GAP = 16;
  const FOOTER_H = 88;
  const col2W = fullMeta.width;
  const width = PAD + BUST_W + GAP + col2W + GAP + BUST_W + PAD;
  const height = PAD + TITLE_H + BUST_H + GAP + FOOTER_H + PAD;
  let canvas = await slatePng(width, height);
  const date = isoDate();
  const title = `${id}  ·  portrait  ·  ${rel(neu)}  ·  ${date}`;
  canvas = (await paste(canvas, titleSvg(width, TITLE_H, title), 0, PAD)).buf;
  const yImg = PAD + TITLE_H;
  canvas = (await paste(canvas, col1, PAD, yImg)).buf;
  const x2 = PAD + BUST_W + GAP;
  const y2 = yImg + Math.round((BUST_H - FULL_H) / 2);
  canvas = (await paste(canvas, col2, x2, y2)).buf;
  canvas = (await paste(canvas, col3, x2 + col2W + GAP, yImg)).buf;
  canvas = (await paste(canvas, footerSvg(width, FOOTER_H, "portrait"), 0, yImg + BUST_H + GAP)).buf;
  const stem = `${date.replace(/-/g, "")}-${topic}-fg`;
  const pngPath = path.join(dir, `${stem}.png`);
  const jsonPath = path.join(dir, `${stem}.json`);
  fs.writeFileSync(pngPath, canvas);
  const rec = {
    id,
    date,
    topic,
    level: "portrait",
    ref: rel(ref),
    new: rel(neu),
    crop: { ref: refBox, new: newBox },
    judge: emptyJudge(),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(rec, null, 2) + "\n");
  console.log("wrote", rel(pngPath), rel(jsonPath));
}

async function writeVideoCard(id, args) {
  const ref = resolvePath(args.ref || DEFAULT_REF[id]);
  const frames = String(args.frames)
    .split(",")
    .map((p) => resolvePath(p.trim()));
  if (frames.length !== 3) throw new Error("--frames needs three paths f1,mid,last");
  for (const f of frames) if (!fs.existsSync(f)) throw new Error(`missing frame ${f}`);
  const topic = args.topic || "untitled";
  const dir = gateDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const refAnchors = loadAnchors(id, {});
  const refMeta = await sharp(ref).metadata();
  const refBox = bustBox(refMeta, refAnchors);
  const col1 = await extractBust(ref, refBox);
  const busts = [];
  const fulls = [];
  const boxes = [];
  for (const f of frames) {
    const meta = await sharp(f).metadata();
    const box = bustBox(meta, scaleAnchors(refAnchors, refMeta, meta));
    boxes.push(box);
    busts.push(await extractBust(f, box));
    const full = await extractFull(f);
    const small = await sharp(full)
      .resize({ height: Math.round(BUST_H / 3) - 4, kernel: "lanczos3" })
      .png()
      .toBuffer();
    fulls.push(small);
  }
  const PAD = 24;
  const TITLE_H = 56;
  const GAP = 12;
  const FOOTER_H = 88;
  const stackW = Math.max(...(await Promise.all(fulls.map(async (b) => (await sharp(b).metadata()).width))));
  const width = PAD + BUST_W * 4 + GAP * 4 + stackW + PAD;
  const height = PAD + TITLE_H + BUST_H + GAP + FOOTER_H + PAD;
  let canvas = await slatePng(width, height);
  const date = isoDate();
  const title = `${id}  ·  video  ·  ${topic}  ·  ${date}`;
  canvas = (await paste(canvas, titleSvg(width, TITLE_H, title), 0, PAD)).buf;
  const yImg = PAD + TITLE_H;
  let x = PAD;
  canvas = (await paste(canvas, col1, x, yImg)).buf;
  x += BUST_W + GAP;
  for (const b of busts) {
    canvas = (await paste(canvas, b, x, yImg)).buf;
    x += BUST_W + GAP;
  }
  let y = yImg;
  for (const f of fulls) {
    canvas = (await paste(canvas, f, x, y)).buf;
    y += Math.round(BUST_H / 3);
  }
  canvas = (await paste(canvas, footerSvg(width, FOOTER_H, "video"), 0, yImg + BUST_H + GAP)).buf;
  const stem = `${date.replace(/-/g, "")}-${topic}-vfg`;
  const pngPath = path.join(dir, `${stem}.png`);
  const jsonPath = path.join(dir, `${stem}.json`);
  fs.writeFileSync(pngPath, canvas);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        id,
        date,
        topic,
        level: "video",
        ref: rel(ref),
        frames: frames.map(rel),
        crop: { ref: refBox, frames: boxes },
        judge: { f1: null, mid: null, last: null, segment: null, notes: "" },
      },
      null,
      2,
    ) + "\n",
  );
  console.log("wrote", rel(pngPath), rel(jsonPath));
}

const args = parseArgs(process.argv.slice(2));
const id = args.id;
if (!id || !IDS.includes(id)) {
  console.error("need --id " + IDS.join("|"));
  process.exit(1);
}

if (args.flags.has("init-ref")) {
  await writeInitRef(id, args);
} else if (args.frames) {
  await writeVideoCard(id, args);
} else {
  await writePortraitCard(id, args);
}
