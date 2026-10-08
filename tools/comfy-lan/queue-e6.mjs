/**
 * E6 I2V：无子命令不 Queue。
 *   node queue-e6.mjs s1
 *   node queue-e6.mjs s2
 * 落盘 characters/violet-fallen/_park/<ISO>/ 。拒绝写 assets/frames/。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(
  fs.readFileSync(path.join(here, "incoming", "handshake.json"), "utf8"),
);
const base = String(handshake.gpu.url).replace(/\/$/, "");
const tmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "wan21-e6-i2v.api.json"), "utf8"),
);
const firstFrame = path.join(
  root,
  "characters/violet-fallen/review/20260915-e6/00-e6-firstframe-v-480x832.png",
);
const review = path.join(root, "characters/violet-fallen/review/20260915-e6");
const SHOT = {
  s1: {
    length: 33,
    seed: 2026091331,
    cfg: 5,
    prefix: "comfy_lan_e6_s1",
    tag: "01",
    timeout: 1800,
    positive: "e6-i2v-positive.txt",
  },
  s2: {
    length: 49,
    seed: 2026091331,
    cfg: 5,
    prefix: "comfy_lan_e6_s2",
    tag: "02",
    timeout: 2400,
    positive: "e6-i2v-positive.txt",
  },
  s33hold: {
    length: 33,
    seed: 2026091333,
    cfg: 6,
    prefix: "comfy_lan_e6_s33hold",
    tag: "03",
    timeout: 1800,
    positive: "e6-i2v-positive-33-hold.txt",
    negative: "e6-i2v-negative-v2.txt",
  },
  s65round: {
    length: 65,
    seed: 2026091334,
    cfg: 6,
    prefix: "comfy_lan_e6_s65round",
    tag: "03b",
    timeout: 3000,
    positive: "e6-i2v-positive-65-round.txt",
    negative: "e6-i2v-negative-v2.txt",
  },
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

function assertNotFrames(dest) {
  const n = dest.replace(/\\/g, "/");
  if (n.includes("/assets/frames/")) throw new Error("拒绝写入 assets/frames/");
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep */
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function uploadImage(filePath) {
  const abs = path.resolve(filePath);
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
      for (const img of o[key] || []) {
        if (img.type === "input") continue;
        files.push(img);
      }
    }
  }
  return files;
}

async function waitHistory(promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await getJson(`${base}/history/${promptId}`, 15000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      if (collectMedia(item.outputs).length) return item;
      const status = item.status || {};
      if (status.status_str === "error") {
        throw new Error(`${promptId} error ${JSON.stringify(status)}`);
      }
      if (status.completed) throw new Error(`${promptId} completed with no images`);
    }
    await new Promise((ok) => setTimeout(ok, 4000));
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

function pickTriple(saved) {
  const pngs = saved
    .filter((p) => /\.png$/i.test(p) && !/job\.json$/i.test(p))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
  if (pngs.length < 3) return { pngs, f1: pngs[0], mid: pngs[0], last: pngs[pngs.length - 1] };
  const f1 = pngs[0];
  const last = pngs[pngs.length - 1];
  const mid = pngs[Math.floor((pngs.length - 1) / 2)];
  return { pngs, f1, mid, last };
}

async function runShot(stage) {
  const spec = SHOT[stage];
  if (!spec) throw new Error("s1 | s1b | s2 | s33hold | s65round");
  if (!fs.existsSync(firstFrame)) throw new Error(`missing first frame ${firstFrame}`);
  const destDir = path.join(
    root,
    "characters/violet-fallen/_park",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  assertNotFrames(destDir);
  fs.mkdirSync(destDir, { recursive: true });

  const free = await fetch(`${base}/free`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unload_models: true, free_memory: true }),
  });
  if (!free.ok) throw new Error(`POST /free ${free.status}`);
  console.log("POST /free ok");

  const refName = await uploadImage(firstFrame);
  console.log(`uploaded ref -> ${refName}`);

  const positive = fs
    .readFileSync(path.join(here, "workflows", spec.positive), "utf8")
    .trim();
  const negative = spec.negative
    ? fs.readFileSync(path.join(here, "workflows", spec.negative), "utf8").trim()
    : tmpl["6"].inputs.text;

  const prompt = JSON.parse(JSON.stringify(tmpl));
  prompt["10"].inputs.image = refName;
  prompt["5"].inputs.text = positive;
  prompt["6"].inputs.text = negative;
  prompt["7"].inputs.length = spec.length;
  prompt["8"].inputs.seed = spec.seed;
  prompt["8"].inputs.cfg = spec.cfg;
  prompt["11"].inputs.filename_prefix = `${spec.prefix}_frames`;
  prompt["13"].inputs.filename_prefix = spec.prefix;

  const t0 = Date.now();
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: randomUUID() }),
  });
  const queued = await res.json();
  if (!res.ok || !queued.prompt_id) {
    throw new Error(`queue fail ${res.status} ${JSON.stringify(queued)}`);
  }
  console.log(`queued ${stage} ${queued.prompt_id} length ${spec.length}`);
  const history = await waitHistory(queued.prompt_id, spec.timeout);
  const saved = await download(history, destDir);
  const triple = pickTriple(saved);
  const rec = {
    schema: "comfy-lan-job/v1",
    exp: "e6",
    stage,
    char: "violet-fallen",
    prompt_id: queued.prompt_id,
    seed: spec.seed,
    cfg: spec.cfg,
    length: spec.length,
    size: "480x832",
    positiveFile: spec.positive,
    negativeFile: spec.negative || null,
    ms: Date.now() - t0,
    dest: destDir,
    saved,
    triple: { f1: triple.f1, mid: triple.mid, last: triple.last, n: triple.pngs.length },
  };
  fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2) + "\n");
  fs.writeFileSync(path.join(here, "incoming", "last-job.json"), JSON.stringify(rec, null, 2) + "\n");
  fs.writeFileSync(path.join(review, `job-${stage}.json`), JSON.stringify(rec, null, 2) + "\n");
  const webp = saved.find((p) => /\.webp$/i.test(p));
  const tag = spec.tag;
  if (webp) fs.copyFileSync(webp, path.join(review, `${tag}-e6-${stage}.webp`));
  if (triple.f1) {
    fs.copyFileSync(triple.f1, path.join(review, `${tag}-e6-${stage}-f1.png`));
    fs.copyFileSync(triple.mid, path.join(review, `${tag}-e6-${stage}-mid.png`));
    fs.copyFileSync(triple.last, path.join(review, `${tag}-e6-${stage}-last.png`));
  }
  console.log(`saved ${saved.length} in ${rec.ms}ms -> ${destDir}`);
  return rec;
}

function help() {
  console.log(`E6 queue — 无子命令不 Queue。

  node queue-e6.mjs s1       # I2V 33f seed 2026091331 CFG 5
  node queue-e6.mjs s1b      # I2V 33f seed 2026091332 CFG 6 动作前置
  node queue-e6.mjs s2       # I2V 49f 同 s1 seed
  node queue-e6.mjs s33hold  # I2V 33f 单拍转头后停 CFG 6
  node queue-e6.mjs s65round # I2V 65f 往返（融化风险）

  首帧须已过。驱动未到则不要跑 Animate。打前 POST /free。`);
}

const { cmd } = parseArgs(process.argv);
try {
  if (cmd === "help" || cmd === "--help" || !SHOT[cmd]) {
    help();
    if (cmd !== "help" && cmd !== "--help" && cmd) process.exit(1);
  } else {
    await runShot(cmd);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
