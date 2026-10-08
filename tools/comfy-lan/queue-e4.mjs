/**
 * E4 排队：Krea re-stage（S0/S1/S2）与 WAI 低降噪 pass（S3）。
 * 默认只打印单元格，不 Queue。无子命令 = help。
 * 落盘 characters/<id>/_park/<ISO>/ 。拒绝写 assets/frames/。
 *
 *   node queue-e4.mjs list
 *   node queue-e4.mjs s0
 *   node queue-e4.mjs s1 --char violet-fallen --cell P1
 *   node queue-e4.mjs s2 --char cassandra --cell P2
 *   node queue-e4.mjs s3 --char violet-fallen --cell P1 --krea <png> --dn 0.35
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const CHAR_IDS = ["cassandra", "edmund", "violet-oath", "violet-fallen", "galvan", "oathkeeper"];
const E4_CHARS = ["violet-fallen", "cassandra"];
const CELLS = ["P1", "P2", "P3", "P4", "P5", "P6"];
const handshake = JSON.parse(
  fs.readFileSync(path.join(here, "incoming", "handshake.json"), "utf8"),
);
const base = String(handshake.gpu.url).replace(/\/$/, "");

const kreaTmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "krea2-identity-edit-restage.api.json"), "utf8"),
);
const waiTmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "wai-style-pass-lowdn.api.json"), "utf8"),
);

const SRC = {
  "violet-fallen": path.join(
    root,
    "characters",
    "violet-fallen",
    "_park",
    "identity-e4",
    "src-vf1-768x1344.png",
  ),
  cassandra: path.join(root, "characters", "cassandra", "identity", "source", "h23.png"),
};

const SEEDS = {
  "violet-fallen": { P1: 2026091301, P2: 2026091302, P3: 2026091303, P4: 2026091304, P5: 2026091305, P6: 2026091306 },
  cassandra: { P1: 2026091311, P2: 2026091312, P3: 2026091313, P4: 2026091314, P5: 2026091315, P6: 2026091316 },
};

function parseArgs(argv) {
  const out = { cmd: argv[2] || "help", flags: {} };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    out.flags[key] = val;
  }
  return out;
}

function parkRoot(charId) {
  if (!CHAR_IDS.includes(charId)) throw new Error(`--char 必须是: ${CHAR_IDS.join(" | ")}`);
  return path.join(root, "characters", charId, "_park");
}

function assertNotFrames(dest) {
  const n = dest.replace(/\\/g, "/");
  if (n.includes("/assets/frames/") || n.endsWith("/assets/frames")) {
    throw new Error("拒绝写入 assets/frames/");
  }
}

function parsePrompts(text) {
  const blocks = {};
  let cur = null;
  const lines = [];
  const flush = () => {
    if (cur) blocks[cur] = lines.join("\n").trim();
    lines.length = 0;
  };
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\[(.+)\]\s*$/);
    if (m) {
      flush();
      cur = m[1].trim();
      continue;
    }
    if (raw.startsWith("#") && !cur) continue;
    if (cur) lines.push(raw);
  }
  flush();
  return blocks;
}

const PROMPTS = parsePrompts(
  fs.readFileSync(path.join(here, "workflows", "e4-prompts.txt"), "utf8"),
);

function identity(charId) {
  const key = `identity ${charId}`;
  if (!PROMPTS[key]) throw new Error(`缺身份句: ${key}`);
  return PROMPTS[key];
}

function cellPrompt(charId, cell) {
  const specific = PROMPTS[`cell ${cell} ${charId}`];
  const shared = PROMPTS[`cell ${cell}`];
  const body = specific || shared;
  if (!body) throw new Error(`缺机位句: ${cell} / ${charId}`);
  return `${identity(charId)}\n${body}`;
}

function prefix(charId, cell, stage) {
  const short = charId === "violet-fallen" ? "vf" : "cas";
  return `comfy_lan_e4_${short}_${cell}_${stage}`;
}

function listCells() {
  const rows = [];
  for (const charId of E4_CHARS) {
    for (const cell of CELLS) {
      rows.push({
        char: charId,
        cell,
        seed: SEEDS[charId][cell],
        seedS2: SEEDS[charId][cell] + 20,
        ref: SRC[charId],
        prompt: cellPrompt(charId, cell),
      });
    }
  }
  return rows;
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function uploadImage(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`缺源图 ${abs}`);
  const buf = fs.readFileSync(abs);
  const blob = new Blob([buf], { type: "image/png" });
  const fd = new FormData();
  fd.append("image", blob, path.basename(abs));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(abs);
}

function collectMedia(outputs) {
  const files = [];
  for (const nodeId of Object.keys(outputs || {})) {
    const o = outputs[nodeId] || {};
    for (const key of ["images", "gifs", "videos"]) {
      for (const img of o[key] || []) files.push(img);
    }
  }
  return files;
}

async function waitHistory(promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await getJson(`${base}/history/${promptId}`, 10000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      if (collectMedia(item.outputs).length) return item;
      const status = item.status || {};
      if (status.status_str === "error") {
        throw new Error(`${promptId} error ${JSON.stringify(status)}`);
      }
      if (status.completed) throw new Error(`${promptId} completed with no images`);
    }
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error(`timeout ${promptId}`);
}

async function download(history, destDir) {
  const saved = [];
  for (const img of collectMedia(history.outputs)) {
    const q = new URLSearchParams({
      filename: img.filename,
      subfolder: img.subfolder || "",
      type: img.type || "output",
    });
    const res = await fetch(`${base}/view?${q}`);
    if (!res.ok) throw new Error(`view ${img.filename} ${res.status}`);
    const dest = path.join(destDir, img.filename);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    saved.push(dest);
  }
  return saved;
}

function makeKreaPrompt({ imageName, seed, prompt, prefix, refBoost, groundingPx, loraStrength }) {
  const g = JSON.parse(JSON.stringify(kreaTmpl));
  g["10"].inputs.image = imageName;
  g["32"].inputs.strength_model = loraStrength ?? 1.0;
  g["40"].inputs.ref_boost = refBoost;
  g["41"].inputs.grounding_px = groundingPx;
  g["42"].inputs.grounding_px = groundingPx;
  g["41"].inputs.prompt = prompt;
  g["8"].inputs.seed = seed;
  g["11"].inputs.filename_prefix = prefix;
  return g;
}

function makeWaiPrompt({ imageName, denoise }) {
  const g = JSON.parse(JSON.stringify(waiTmpl));
  g["12"].inputs.image = imageName;
  g["16"].inputs.image = imageName;
  g["3"].inputs.denoise = denoise;
  g["3"].inputs.seed = 202609104;
  const tag = String(denoise).replace(".", "");
  g["9"].inputs.filename_prefix = `comfy_lan_e4_wai${tag}`;
  return g;
}

async function queuePrompt(prompt) {
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: randomUUID() }),
  });
  const queued = await res.json();
  if (!res.ok || !queued.prompt_id) {
    throw new Error(`queue fail ${res.status} ${JSON.stringify(queued)}`);
  }
  return queued.prompt_id;
}

async function runKrea({ charId, cell, seed, refBoost, groundingPx, loraStrength, stage, timeoutSec }) {
  const destDir = path.join(parkRoot(charId), new Date().toISOString().replace(/[:.]/g, "-"));
  assertNotFrames(destDir);
  fs.mkdirSync(destDir, { recursive: true });
  const t0 = Date.now();
  const imageName = await uploadImage(SRC[charId]);
  const prompt = makeKreaPrompt({
    imageName,
    seed,
    prompt: cellPrompt(charId, cell),
    prefix: prefix(charId, cell, stage),
    refBoost,
    groundingPx,
    loraStrength: loraStrength ?? 1.0,
  });
  const promptId = await queuePrompt(prompt);
  const history = await waitHistory(promptId, timeoutSec);
  const saved = await download(history, destDir);
  const rec = {
    schema: "comfy-lan-job/v1",
    exp: "e4",
    char: charId,
    cell,
    seed,
    ref_boost: refBoost,
    grounding_px: groundingPx,
    lora_strength: loraStrength ?? 1.0,
    stage,
    prompt_id: promptId,
    ms: Date.now() - t0,
    dest: destDir,
    saved,
  };
  fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2));
  fs.writeFileSync(path.join(here, "incoming", "last-job.json"), JSON.stringify(rec, null, 2));
  console.log(`saved ${charId} ${cell} ${stage} ${saved.length} in ${rec.ms}ms -> ${destDir}`);
  return rec;
}

async function runWai({ charId, cell, kreaPng, denoise, timeoutSec }) {
  const destDir = path.join(parkRoot(charId), new Date().toISOString().replace(/[:.]/g, "-"));
  assertNotFrames(destDir);
  fs.mkdirSync(destDir, { recursive: true });
  const t0 = Date.now();
  const imageName = await uploadImage(kreaPng);
  const prompt = makeWaiPrompt({ imageName, denoise });
  const promptId = await queuePrompt(prompt);
  const history = await waitHistory(promptId, timeoutSec);
  const saved = await download(history, destDir);
  const rec = {
    schema: "comfy-lan-job/v1",
    exp: "e4",
    char: charId,
    cell,
    seed: 202609104,
    denoise,
    stage: `s3-wai${String(denoise).replace(".", "")}`,
    prompt_id: promptId,
    ms: Date.now() - t0,
    dest: destDir,
    saved,
  };
  fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2));
  fs.writeFileSync(path.join(here, "incoming", "last-job.json"), JSON.stringify(rec, null, 2));
  console.log(`saved ${charId} ${cell} wai ${denoise} ${saved.length} in ${rec.ms}ms -> ${destDir}`);
  return rec;
}

function help() {
  console.log(`E4 queue — 无子命令不 Queue。

  node queue-e4.mjs list
  node queue-e4.mjs s0                          # Vf1 P1 冒烟
  node queue-e4.mjs s1 --char <id> --cell P1
  node queue-e4.mjs s2 --char <id> --cell P2    # ref_boost 6 · seed+20
  node queue-e4.mjs s3 --char <id> --cell P1 --krea <png> --dn 0.35|0.45

  --char: violet-fallen | cassandra
  --cell: P1…P6
  先 POST /free；Krea 与 WAI 分 Queue。`);
}

function needCharCell(flags) {
  const charId = String(flags.char || "");
  const cell = String(flags.cell || "").toUpperCase();
  if (!E4_CHARS.includes(charId)) throw new Error("--char violet-fallen | cassandra");
  if (!CELLS.includes(cell)) throw new Error("--cell P1…P6");
  return { charId, cell };
}

const { cmd, flags } = parseArgs(process.argv);
try {
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
  } else if (cmd === "list") {
    for (const row of listCells()) {
      console.log(`${row.char} ${row.cell} seed ${row.seed} s2 ${row.seedS2}`);
      console.log(`  ref ${row.ref}`);
      console.log(`  ${row.prompt.replace(/\n/g, " / ")}`);
      console.log("");
    }
  } else if (cmd === "s0") {
    await runKrea({
      charId: "violet-fallen",
      cell: "P1",
      seed: SEEDS["violet-fallen"].P1,
      refBoost: 4,
      groundingPx: 1024,
      stage: "s0",
      timeoutSec: Number(flags.timeout || 420),
    });
  } else if (cmd === "s1") {
    const { charId, cell } = needCharCell(flags);
    await runKrea({
      charId,
      cell,
      seed: flags.seed != null ? Number(flags.seed) : SEEDS[charId][cell],
      refBoost: flags.boost != null ? Number(flags.boost) : 4,
      groundingPx: flags.gpx != null ? Number(flags.gpx) : 1024,
      loraStrength: flags.lora != null ? Number(flags.lora) : 1.0,
      stage: flags.round
        ? flags.gpx
          ? `${flags.round}-g${flags.gpx}`
          : String(flags.round)
        : flags.gpx
          ? `s1-g${flags.gpx}`
          : "s1",
      timeoutSec: Number(flags.timeout || 420),
    });
  } else if (cmd === "s2") {
    const { charId, cell } = needCharCell(flags);
    await runKrea({
      charId,
      cell,
      seed: SEEDS[charId][cell] + 20,
      refBoost: 6,
      groundingPx: 1024,
      stage: "s2",
      timeoutSec: Number(flags.timeout || 420),
    });
  } else if (cmd === "s3") {
    const { charId, cell } = needCharCell(flags);
    const krea = String(flags.krea || "");
    const dn = Number(flags.dn);
    if (!krea || !fs.existsSync(krea)) throw new Error("s3 需要 --krea <已过脸门的 Krea PNG>");
    if (dn !== 0.35 && dn !== 0.45 && dn !== 0.3) throw new Error("--dn 0.35 | 0.45 | 0.30");
    await runWai({
      charId,
      cell,
      kreaPng: krea,
      denoise: dn,
      timeoutSec: Number(flags.timeout || 360),
    });
  } else {
    help();
    process.exit(1);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
