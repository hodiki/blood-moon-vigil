/**
 * Phase 0 + Phase 1 of characters-migration-map-v1.md
 * Copy only. Old paths stay valid. Do not touch assets/frames|raw|atlas.
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(
  "d:/code/vampire-survivors-like/tools/asset-pipeline/package.json",
);
const sharp = require("sharp");

const ROOT = "d:/code/vampire-survivors-like";
const L = `${ROOT}/assets/ui-menu/preview/locked`;
const P = `${L}/combat-64/_park`;
const A = `${ROOT}/assets/ui-menu/preview/archive/process`;
const I = `${L}/combat-64/_inspect`;
const W = `${ROOT}/tools/comfy-lan/workflows`;
const CHAR = `${ROOT}/characters`;
const DATE = "2026-09-13";

const IDS = [
  "cassandra",
  "edmund",
  "violet-oath",
  "violet-fallen",
  "galvan",
  "oathkeeper",
];

/** @type {Map<string, {file: string, src: string, note: string}[]>} */
const ledger = new Map();
const missing = [];
let copied = 0;
let generated = 0;

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function record(dest, src, note) {
  const dir = path.dirname(dest);
  if (!ledger.has(dir)) ledger.set(dir, []);
  ledger.get(dir).push({ file: path.basename(dest), src: rel(src), note });
}

function copyOne(src, dest, note) {
  if (!fs.existsSync(src)) {
    missing.push(`${rel(src)} → ${rel(dest)}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  record(dest, src, note);
  copied++;
  return true;
}

function copyNamed(srcDir, destDir, names, note) {
  for (const name of names) {
    copyOne(path.join(srcDir, name), path.join(destDir, name), note);
  }
}

function copyMatching(srcDir, destDir, pred, note) {
  if (!fs.existsSync(srcDir)) {
    missing.push(`${rel(srcDir)} (dir)`);
    return;
  }
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    if (!fs.statSync(src).isFile()) continue;
    if (pred(name)) copyOne(src, path.join(destDir, name), note);
  }
}

function copyDirFiles(srcDir, destDir, note) {
  copyMatching(srcDir, destDir, () => true, note);
}

function gitkeep(dir) {
  ensureDir(dir);
  const p = path.join(dir, ".gitkeep");
  if (!fs.existsSync(p)) fs.writeFileSync(p, "");
}

function pointer(dest, title, body) {
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, `# ${title}\n\n> Phase 1 留档指针。原件不搬，旧路径仍有效。\n\n${body.trim()}\n`);
}

function skeleton() {
  ensureDir(`${CHAR}/_shared/lineup`);
  ensureDir(`${CHAR}/_shared/color-keys`);
  ensureDir(`${CHAR}/_shared/combat-bible`);

  for (const id of IDS) {
    const c = `${CHAR}/${id}`;
    gitkeep(`${c}/identity/source`);
    gitkeep(`${c}/identity/face-gate`);
    gitkeep(`${c}/identity/card`);
    gitkeep(`${c}/identity/silhouette`);
    gitkeep(`${c}/identity/color-key`);
    gitkeep(`${c}/portraits/_park`);
    gitkeep(`${c}/stamps`);
    gitkeep(`${c}/combat/idle`);
    gitkeep(`${c}/combat/walk`);
    gitkeep(`${c}/combat/skill`);
    gitkeep(`${c}/combat/job-cards`);
    gitkeep(`${c}/video`);
    gitkeep(`${c}/lora/dataset`);
    gitkeep(`${c}/lora/runs`);
    gitkeep(`${c}/review`);
    gitkeep(`${c}/_park`);
  }

  gitkeep(`${CHAR}/violet-oath/combat/_superseded-nun64`);
  gitkeep(`${CHAR}/violet-oath/video/drive`);
  gitkeep(`${CHAR}/violet-oath/video/wan-animate2-2026-09-12`);
  gitkeep(`${CHAR}/violet-fallen/stamps/poses`);
  gitkeep(`${CHAR}/violet-fallen/lora/dataset-candidates/nylon-black-heels`);
  gitkeep(`${CHAR}/oathkeeper/stamps/_unpassed`);
  gitkeep(`${CHAR}/oathkeeper/combat/idle/_unpassed`);
}

function shared() {
  const note = "跨角色锁件 · §3.1";
  copyNamed(
    `${L}/silhouettes`,
    `${CHAR}/_shared/lineup`,
    [
      "char-bible-party-lineup-v4.png",
      "char-bible-party-lineup-v3.png",
      "char-bible-party-lineup-v2.png",
      "char-bible-edmund-lock-ce.png",
    ],
    note,
  );
  copyNamed(
    `${L}/color-keys`,
    `${CHAR}/_shared/color-keys`,
    ["char-bible-color-keys-v2.png"],
    note,
  );
  copyNamed(
    `${L}/combat-64`,
    `${CHAR}/_shared/combat-bible`,
    [
      "char-bible-combat-color-key-v2.png",
      "char-bible-combat-idle-row1-v1.png",
      "char-bible-combat-idle-row1-v2.png",
      "char-bible-combat-idle-v6.png",
    ],
    note,
  );
}

async function cropLockCe() {
  const src = `${L}/silhouettes/char-bible-edmund-lock-ce.png`;
  const meta = await sharp(src).metadata();
  const w = meta.width;
  const h = meta.height;
  // 1536×1024 锁纸：顶栏标题、左卡珊德拉、中艾德蒙、右下 64 双人缩图。
  const top = 110;
  const cropH = h - top;
  const cassW = 720;
  const edmLeft = 700;
  const edmW = 580;
  const cassDest = `${CHAR}/cassandra/identity/silhouette/lock-ce.png`;
  const edmDest = `${CHAR}/edmund/identity/silhouette/lock-ce.png`;
  ensureDir(path.dirname(cassDest));
  ensureDir(path.dirname(edmDest));
  await sharp(src).extract({ left: 0, top, width: cassW, height: cropH }).png().toFile(cassDest);
  await sharp(src)
    .extract({ left: edmLeft, top, width: edmW, height: cropH })
    .png()
    .toFile(edmDest);
  record(cassDest, src, `§4 裁左半（0..${cassW} × ${top}..${h}，整图在 _shared/lineup）`);
  record(
    edmDest,
    src,
    `§4 裁中段（${edmLeft}..${edmLeft + edmW} × ${top}..${h}，不含右下 64 缩图）`,
  );
  generated += 2;
  console.log({ lockCe: `${w}x${h}`, cassW, edmLeft, edmW });
}

async function cropVoOk() {
  const src = `${L}/portraits/char-bible-portrait-violet-oath-gpt-ok.png`;
  const meta = await sharp(src).metadata();
  const w = meta.width;
  const h = meta.height;
  const voW = Math.floor(w * 0.48);
  const okLeft = Math.floor(w * 0.5);
  const okW = w - okLeft;
  const voDest = `${CHAR}/violet-oath/identity/source/oath-solo.png`;
  const okDest = `${CHAR}/oathkeeper/identity/source/ok-solo.png`;
  ensureDir(path.dirname(voDest));
  ensureDir(path.dirname(okDest));
  await sharp(src).extract({ left: 0, top: 0, width: voW, height: h }).png().toFile(voDest);
  await sharp(src).extract({ left: okLeft, top: 0, width: okW, height: h }).png().toFile(okDest);
  record(voDest, src, `crop-vo-oath-solo.mjs 同参：left=0 width=${voW}`);
  record(okDest, src, `crop-ok-knight-solo.mjs 同参：left=${okLeft} width=${okW}`);
  generated += 2;
  console.log({ duo: `${w}x${h}`, voW, okLeft, okW });
}

function violetOath() {
  const c = `${CHAR}/violet-oath`;
  copyOne(
    `${L}/portraits/char-bible-portrait-violet-oath-gpt-ok.png`,
    `${c}/identity/source/oath-gpt-ok-duo.png`,
    "双人成片已锁 · 亮银红羽",
  );
  copyOne(
    `${L}/portraits/char-bible-portrait-violet-oath-O-flame.png`,
    `${c}/portraits/_park/char-bible-portrait-violet-oath-O-flame.png`,
    "退对照",
  );
  copyNamed(
    `${L}/silhouettes`,
    `${c}/identity/silhouette`,
    [
      "char-bible-violet-oath-lock-o3.png",
      "char-bible-violet-oath-lock-o2.png",
      "char-bible-violet-explore-v1.png",
      "char-bible-violet-silhouette-v4.png",
    ],
    "O-3 已过；其余对照",
  );
  copyOne(
    `${L}/color-keys/char-bible-violet-oath-color-key-d2.png`,
    `${c}/identity/color-key/d2.png`,
    "D2 已过",
  );
  copyOne(
    `${L}/faces/face-violet-oath.png`,
    `${c}/identity/card/face-violet-oath.png`,
    "旧裁，随成片重开",
  );

  copyNamed(
    `${L}/combat-64`,
    `${c}/combat/idle`,
    [
      "hero-violet-idle-128-v1.png",
      "hero-violet-idle-128-v1-x4.png",
      "hero-violet-idle-128-v1-stamp.png",
      "hero-violet-idle-v1-board.png",
    ],
    "idle 128 已过（from-a）",
  );
  copyOne(
    `${L}/combat-64/hero-violet-idle-128-v1-stamp.png`,
    `${c}/stamps/idle-from-a.png`,
    "idle 128 已过印戳（from-a）",
  );
  copyOne(
    `${L}/review-h23-wave14/11-from-a-stamp-and-128.png`,
    `${c}/combat/idle/11-from-a-stamp-and-128.png`,
    "wave14 过关对照卡",
  );

  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/_superseded-nun64`,
    (n) =>
      n.startsWith("hero-violet-idle-64-") ||
      /^hero-violet-walk-.*-64-/.test(n) ||
      n.startsWith("hero-violet-walk-6-") ||
      n.startsWith("hero-violet-skill-"),
    "旧修女 64 · 未过 / 已退",
  );
  copyDirFiles(
    `${P}/hero-violet-walk-nun64-superseded-2026-09-12`,
    `${c}/combat/_superseded-nun64`,
    "旧修女 walk 退 park · 2026-09-12",
  );

  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/walk`,
    (n) => /^hero-violet-walk-[a-f]-128-v1\.png$/.test(n),
    "walk 128 已过（E2 S3c-b）· 现网源；映射表未点名，按已过契约帧收入",
  );
  copyMatching(
    `${L}/review-exp-e2`,
    `${c}/combat/walk`,
    (n) => /^(16|17|18|19|20|21|22|23|24|25)-/.test(n),
    "E2 挑帧 / 六帧 128 / GIF / 门禁 / 总结",
  );
  copyDirFiles(
    `${P}/e2-s4-6pick-box`,
    `${c}/combat/walk/e2-s4-6pick-box`,
    "E2 S4 六帧入盒",
  );

  copyOne(
    `${L}/review-exp-e2/drive/8c3b8794-drive-generic-walkinplace.mp4`,
    `${c}/video/drive/8c3b8794-drive-generic-walkinplace.mp4`,
    "E2 走循环驱动视频",
  );
  copyOne(
    `${L}/review-exp-e2/01-e2-drive-contact-sheet.png`,
    `${c}/video/drive/01-e2-drive-contact-sheet.png`,
    "E2 驱动接触表",
  );
  copyMatching(
    `${L}/review-exp-e2`,
    `${c}/video/wan-animate2-2026-09-12`,
    (n) => /^(00|02|03|04|05|06|07|08|09|10|11|12|13|14|15)-/.test(n),
    "E2 预备 + S0–S4 帧条",
  );

  copyMatching(
    I,
    `${c}/combat/job-cards`,
    (n) => n.startsWith("hero-violet-") && n.endsWith(".md"),
    "守誓 job 卡",
  );

  pointer(
    `${c}/_park/legacy-2026-09.md`,
    "守誓历史落盘（不搬）",
    `
- \`assets/ui-menu/preview/locked/combat-64/_park/vo-idle-o3d2/\` — idle O-3/D2 过程
- \`assets/ui-menu/preview/locked/review-h23-wave13/\` — idle 过程
- \`assets/ui-menu/preview/locked/review-h23-wave14/\` — idle 过程（\`11-from-a-stamp-and-128.png\` 已复制到 \`combat/idle/\`）
- \`assets/ui-menu/preview/locked/review-h23-wave8/08-krea.png\` — O-3 源
- \`assets/ui-menu/preview/locked/review-h23-wave9/04-gi-d2.png\` — D2 源
- \`assets/ui-menu/preview/archive/process-v1-deprecated/combat-64-parked-2026-09/violet-oath-parked/\`
`,
  );
}

function violetFallen() {
  const c = `${CHAR}/violet-fallen`;
  copyOne(
    `${L}/review-identity-vf1/00-vf1-raw.png`,
    `${c}/identity/source/vf1-raw.png`,
    "图1 原片",
  );
  copyOne(
    `${L}/review-identity-vf1/01-vf1-clean.png`,
    `${c}/identity/source/vf1-clean.png`,
    "图1′ 减脏",
  );
  copyOne(
    `${L}/review-identity-vf1/02-card-bust.png`,
    `${c}/identity/card/02-card-bust.png`,
    "A 轨卡裁",
  );
  copyOne(
    `${L}/review-identity-vf1/03-silhouette-from-clean.png`,
    `${c}/identity/silhouette/03-silhouette-from-clean.png`,
    "A 轨压黑",
  );
  copyOne(
    `${L}/review-identity-vf1/04-color-key-from-clean.png`,
    `${c}/identity/color-key/04-color-key-from-clean.png`,
    "A 轨压块",
  );
  copyOne(
    `${L}/portraits/char-bible-portrait-violet-fallen-gpt-e.png`,
    `${c}/portraits/char-bible-portrait-violet-fallen-gpt-e.png`,
    "优雅 GPT · 身份已锁（优先）",
  );
  copyNamed(
    `${L}/portraits`,
    `${c}/portraits/_park`,
    [
      "char-bible-portrait-violet-fallen-armor3-a.png",
      "char-bible-portrait-violet-fallen-armor-c.png",
      "char-bible-portrait-violet-fallen-F-allure.png",
    ],
    "备用已锁 / 退对照",
  );
  copyOne(
    `${L}/silhouettes/char-bible-violet-fallen-lock-f3.png`,
    `${c}/identity/silhouette/f3.png`,
    "F-3 已过",
  );
  copyOne(
    `${L}/color-keys/char-bible-violet-fallen-color-key-e1.png`,
    `${c}/identity/color-key/e1.png`,
    "E1 已过",
  );
  copyOne(
    `${L}/faces/face-violet-fallen.png`,
    `${c}/identity/card/face-violet-fallen.png`,
    "旧裁，随成片重开",
  );

  copyOne(
    `${L}/review-identity-vf1/12-idle-blo-passed-stamp.png`,
    `${c}/stamps/idle-blo.png`,
    "B-lo idle 印戳已过",
  );
  copyNamed(
    `${L}/review-identity-vf1`,
    `${c}/combat/idle`,
    [
      "05-ref-void-512x1024.png",
      "06-raw-blo.png",
      "07-blo-128.png",
      "08-blo-stamp-and-128.png",
      "12-idle-blo-passed-128.png",
    ],
    "B-lo 128 已过及相关底",
  );

  copyNamed(
    `${L}/review-exp-e1`,
    `${c}/stamps/poses`,
    [
      "02-e1-c1-a-raw.png",
      "03-e1-c1-a-128.png",
      "04-e1-c1-a-card.png",
      "05-e1-c1-b-raw.png",
      "06-e1-c1-b-128.png",
      "07-e1-c1-b-card.png",
      "21-e1-c3-a-raw.png",
      "22-e1-c3-a-128.png",
      "23-e1-c3-a-card.png",
      "box-C1A.json",
      "box-C1B.json",
      "box-C3A.json",
    ],
    "E1 C1 A/B、C3 A 已过（印戳 + 128 + 卡）",
  );

  const nylon = `${c}/lora/dataset-candidates/nylon-black-heels`;
  copyMatching(
    `${W}/vf1-krea-lora`,
    nylon,
    (n) => n.endsWith(".json") || n.endsWith(".md"),
    "尼龙设定表 · 另一衣套候选（未过脸门）",
  );
  copyDirFiles(
    `${W}/vf1-krea-lora/vf1-krea2-20260911`,
    `${nylon}/vf1-krea2-20260911`,
    "S01–S14 尼龙候选 · 未过脸门",
  );

  const vf1Drive = `${L}/review-exp-e2/drive/e4c22590-vf1-r2v-walk.mp4`;
  if (fs.existsSync(vf1Drive)) {
    copyOne(
      vf1Drive,
      `${c}/video/e4c22590-vf1-r2v-walk.mp4`,
      "落在 E2 drive 夹里的魔化走段；映射未点名，按文件名收入",
    );
  }

  pointer(
    `${c}/_park/legacy-c-trials.md`,
    "魔化 C 试与历史过目（不搬）",
    `
- \`assets/ui-menu/preview/locked/review-identity-vf1/\` 的 13–46（C 试：i2i、Ostris、SVD、Wan 1.3B / 14B）
- \`assets/ui-menu/preview/locked/review-exp-e1/\` 其余（C2 反例、六格扫描、摘要）— C1 A/B、C3 A 已复制到 \`stamps/poses/\`
- \`assets/ui-menu/preview/locked/combat-64/_park/identity-vf1/\`
- \`assets/ui-menu/preview/locked/combat-64/_park/identity-e1/\`
- \`tools/comfy-lan/workflows/vf1-krea-lora/vf1-clean.png\` · \`vf1-idle-stamp.png\` — 与 \`identity/source/vf1-clean.png\`、\`stamps/idle-blo.png\` 重复；Phase 2 再删副本
`,
  );
}

function cassandra() {
  const c = `${CHAR}/cassandra`;
  copyOne(
    `${L}/portraits/char-bible-portrait-cassandra-h23.png`,
    `${c}/identity/source/h23.png`,
    "风格帧已过（H23）；E4 前为图1",
  );
  copyOne(
    `${L}/portraits/ui-sel-portrait-cassandra-v2.png`,
    `${c}/portraits/_park/ui-sel-portrait-cassandra-v2.png`,
    "退对照",
  );
  copyOne(
    `${L}/faces/face-cassandra.png`,
    `${c}/identity/card/face-cassandra.png`,
    "旧裁，随成片重开",
  );
  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/idle`,
    (n) => n.startsWith("hero-cassandra-idle-"),
    "idle 64 已过",
  );
  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/walk`,
    (n) => n.startsWith("hero-cassandra-walk-"),
    "walk 64 已过",
  );
  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/skill`,
    (n) => n.startsWith("hero-cassandra-skill-"),
    "skill-a/b 64 已过",
  );
  pointer(
    `${c}/_park/legacy-2026-09.md`,
    "卡珊德拉历史落盘（不搬）",
    `
- \`assets/ui-menu/preview/archive/process-v1-deprecated/combat-64-parked-2026-09/cassandra-parked/\`
- \`tools/comfy-lan/workflows/style-frame-m1-hose2*\` · \`style-frame-wai-cassandra*\` — 已入 \`pipelines/portrait-wai-h23-style-frame/\`
`,
  );
}

function edmund() {
  const c = `${CHAR}/edmund`;
  copyOne(
    `${L}/portraits/char-bible-portrait-edmund-gpt.png`,
    `${c}/identity/source/char-bible-portrait-edmund-gpt.png`,
    "身份已锁（GPT）",
  );
  copyOne(
    `${L}/portraits/char-bible-portrait-edmund-v1.png`,
    `${c}/portraits/_park/char-bible-portrait-edmund-v1.png`,
    "退对照",
  );
  copyOne(
    `${L}/faces/face-edmund.png`,
    `${c}/identity/card/face-edmund.png`,
    "旧裁，随成片重开",
  );
  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/idle`,
    (n) => n.startsWith("player-idle-"),
    "idle 64 已过（v9）；v5/v6 为过程对照",
  );
  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/walk`,
    (n) => n.startsWith("player-walk-"),
    "walk 64 已过（V4）；v2 为过程对照",
  );
  copyMatching(
    `${L}/combat-64`,
    `${c}/combat/skill`,
    (n) => n.startsWith("player-skill-"),
    "skill-a/b 64 已过（v1）",
  );
  copyMatching(
    I,
    `${c}/combat/job-cards`,
    (n) => n.startsWith("player-") && n.endsWith(".md"),
    "艾德蒙 job 卡",
  );
  pointer(
    `${c}/_park/legacy-2026-09.md`,
    "艾德蒙历史落盘（不搬）",
    `
- \`assets/ui-menu/preview/archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-idle-parked/\`
- \`assets/ui-menu/preview/archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-walk-parked/\`
- \`assets/ui-menu/preview/archive/process-v1-deprecated/combat-64-parked-2026-09/edmund-skill-parked/\`
`,
  );
}

function galvan() {
  const c = `${CHAR}/galvan`;
  copyOne(
    `${L}/portraits/char-bible-portrait-galvan-bulk-a.png`,
    `${c}/identity/source/char-bible-portrait-galvan-bulk-a.png`,
    "身份已锁（bulk-a）",
  );
  copyNamed(
    `${L}/portraits`,
    `${c}/portraits/_park`,
    [
      "char-bible-portrait-galvan-vigil-b.png",
      "char-bible-portrait-galvan-v2.png",
    ],
    "退对照",
  );
  copyOne(
    `${L}/silhouettes/char-bible-galvan-lock-v2.png`,
    `${c}/identity/silhouette/char-bible-galvan-lock-v2.png`,
    "G-披剪影已锁；战斗帧未过",
  );
  copyOne(
    `${L}/faces/face-galvan.png`,
    `${c}/identity/card/face-galvan.png`,
    "旧裁，随成片重开",
  );
  pointer(
    `${c}/_park/legacy.md`,
    "加尔文不搬件",
    `
- \`assets/raw/hero-galvan*\` — 契约旧帧源，未过，不搬
- \`tools/comfy-lan/workflows/style-follow-h23-galvan-*\` — 留
`,
  );
}

function oathkeeper() {
  const c = `${CHAR}/oathkeeper`;
  copyDirFiles(
    `${L}/review-h23-wave15`,
    `${c}/combat/idle/_unpassed/wave15`,
    "96 入盒 / 印戳 · 未过（甲件漂）",
  );
  copyDirFiles(
    `${L}/review-h23-wave16`,
    `${c}/combat/idle/_unpassed/wave16`,
    "192 入盒 / 印戳 · 未过（甲件漂）",
  );
  for (const [name, destName] of [
    ["08-raw-hi.png", "wave15-08-raw-hi.png"],
    ["09-raw-lo.png", "wave15-09-raw-lo.png"],
    ["11-hi-stamp-and-96.png", "wave15-11-hi-stamp-and-96.png"],
  ]) {
    copyOne(
      `${L}/review-h23-wave15/${name}`,
      `${c}/stamps/_unpassed/${destName}`,
      "wave15 印戳 · 未过",
    );
  }
  for (const [name, destName] of [
    ["08-raw-hi.png", "wave16-08-raw-hi.png"],
    ["09-raw-lo.png", "wave16-09-raw-lo.png"],
    ["12-hi-stamp-and-192.png", "wave16-12-hi-stamp-and-192.png"],
    ["16-blo-stamp-and-192.png", "wave16-16-blo-stamp-and-192.png"],
    ["18-raw-blo.png", "wave16-18-raw-blo.png"],
    ["19-raw-bmid.png", "wave16-19-raw-bmid.png"],
  ]) {
    copyOne(
      `${L}/review-h23-wave16/${name}`,
      `${c}/stamps/_unpassed/${destName}`,
      "wave16 印戳 · 未过",
    );
  }
  copyMatching(I, `${c}/combat/job-cards`, (n) => /^ok-.*\.(mjs|md)$/.test(n), "守誓者 job / 脚本");
  copyOne(
    `${I}/gpt-ok-palette.json`,
    `${c}/combat/job-cards/gpt-ok-palette.json`,
    "成片取样色板",
  );
  pointer(
    `${c}/_park/legacy-2026-09.md`,
    "守誓者历史落盘（不搬）",
    `
- \`assets/ui-menu/preview/locked/combat-64/_park/ok-idle-96/\`
- \`assets/ui-menu/preview/locked/combat-64/_park/ok-idle-192/\`
- \`tools/comfy-lan/workflows/krea2-ok-stamp-w15*\` · \`w16*\` — 若存在则留
`,
  );
}

function writeSourceFiles() {
  for (const [dir, rows] of ledger) {
    const lines = [
      `# 本目录来源`,
      ``,
      `- 复制日：${DATE}`,
      `- 阶段：Phase 1（只复制；旧路径仍有效）`,
      `- 映射：\`design/art-bible/characters-migration-map-v1.md\``,
      ``,
      `| 本文件 | 原路径 | 过关 / 说明 |`,
      `|---|---|---|`,
    ];
    const seen = new Set();
    for (const r of rows) {
      const key = `${r.file}|${r.src}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`| \`${r.file}\` | \`${r.src}\` | ${r.note} |`);
    }
    lines.push("");
    fs.writeFileSync(path.join(dir, "source.md"), lines.join("\n"));
  }
}

function writeWeightsStubs() {
  for (const id of IDS) {
    const p = `${CHAR}/${id}/lora/weights.md`;
    if (!fs.existsSync(p) || fs.statSync(p).size === 0) {
      fs.writeFileSync(
        p,
        `# ${id} · LoRA 权重指针\n\n> 权重不入库。记 GPU 机路径 + sha256 + 训练卡链接。\n\n| 衣套 | GPU 路径 | sha256 | 训练卡 | 状态 |\n|---|---|---|---|---|\n| — | — | — | — | 未训 |\n`,
      );
    }
  }
}

async function main() {
  skeleton();
  violetOath();
  violetFallen();
  cassandra();
  edmund();
  galvan();
  oathkeeper();
  shared();
  await cropLockCe();
  await cropVoOk();
  writeSourceFiles();
  writeWeightsStubs();

  const report = {
    copied,
    generated,
    destDirs: ledger.size,
    missing,
  };
  fs.writeFileSync(`${CHAR}/_phase1-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (missing.length) {
    console.error(`missing: ${missing.length}`);
    process.exitCode = 1;
  }
}

await main();
