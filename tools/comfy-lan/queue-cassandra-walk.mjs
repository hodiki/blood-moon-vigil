/**
 * Scheme A round 1 · Cassandra walk via Wan Animate 2.
 *
 *   node queue-cassandra-walk.mjs [384|480] [seed] [length]
 *
 * Patches the proven E2 walk graph for Cassandra:
 *   - VAE name -> Wan2_1_VAE_bf16 (the box has the official VAE now, not wan_2.1_vae)
 *   - reference -> the alpha-cut stamp at full resolution
 *   - prompt -> Cassandra's form lock, no props
 * Output: characters/cassandra/review/20261021-scheme-a-128/walk/raw/<stamp>/
 * Never writes assets/frames.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");
const tmpl = JSON.parse(fs.readFileSync(path.join(here, "workflows/wan-animate2-vo-walk.api.json"), "utf8"));

const ENVELOPE = Number(process.argv[2] || 384);
const SEED = Number(process.argv[3] || 2026102101);
const LENGTH = Number(process.argv[4] || 49);
const W = ENVELOPE === 480 ? 480 : 384;
const H = ENVELOPE === 480 ? 832 : 672;

const argOf = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const REF = path.join(root, argOf("ref", "characters/cassandra/review/20261021-scheme-a-128/ref/stamp-109-alpha.png"));
const DRIVE = path.join(root, argOf("drive", "characters/violet-oath/video/drive/8c3b8794-drive-generic-walkinplace.mp4"));
const TAG = argOf("tag", `w${W}-s${SEED}`);
const OUT = path.join(root, "characters/cassandra/review/20261021-scheme-a-128/walk/raw", TAG);

// Per-character. The walk prompt used to be hard-coded for Cassandra, and that
// leaked: Edmund came out with her silver ponytail because the text told the
// model to swing one. Pass --prompt=<file> for anyone who is not Cassandra.
const DEFAULT_POSITIVE = [
  "Static camera at chest height. Empty pure black void behind her, no floor, no scenery, no props.",
  "Same flat cel-shaded illustration as the reference image.",
  "She walks in place facing the viewer's right, natural stride, one leg swinging forward while the other passes under her body.",
  "Her long wine-red coat and silver ponytail swing with each step.",
].join(" ");

const PROMPT_ARG = process.argv.find((a) => a.startsWith("--prompt="));
const POSITIVE = PROMPT_ARG
  ? fs.readFileSync(path.join(root, PROMPT_ARG.slice(9)), "utf8").trim().replace(/\s*\n\s*/g, " ")
  : DEFAULT_POSITIVE;

function assertNotFrames(dest) {
  if (dest.replace(/\\/g, "/").includes("/assets/frames/")) throw new Error("拒绝写入 assets/frames/");
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, body: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, body: text }; }
  } finally { clearTimeout(t); }
}

async function upload(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".mp4" ? "video/mp4" : "application/octet-stream";
  const fd = new FormData();
  fd.append("image", new Blob([fs.readFileSync(filePath)], { type }), path.basename(filePath));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(filePath);
}

function collectMedia(outputs) {
  const files = [];
  for (const id of Object.keys(outputs || {})) {
    const o = outputs[id] || {};
    for (const key of ["images", "gifs", "videos"]) {
      for (const m of o[key] || []) if (m.type !== "input") files.push(m);
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
      if (status.status_str === "error") throw new Error(`${promptId} error ${JSON.stringify(status)}`);
      if (status.completed) throw new Error(`${promptId} completed with no media`);
    }
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  throw new Error(`timeout ${promptId}`);
}

if (!fs.existsSync(REF)) throw new Error(`missing ref ${REF}`);
if (!fs.existsSync(DRIVE)) throw new Error(`missing drive ${DRIVE}`);
assertNotFrames(OUT);
fs.mkdirSync(OUT, { recursive: true });

const refName = await upload(REF);
const driveName = await upload(DRIVE);
console.log("uploaded ref", refName, "drive", driveName);

await fetch(`${base}/free`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
});

const p = JSON.parse(JSON.stringify(tmpl));
if (!p["7"] || p["7"].class_type !== "VAELoader") throw new Error("node 7 is not VAELoader");
p["7"].inputs.vae_name = "Wan2_1_VAE_bf16.safetensors";
p["10"].inputs.image = refName;
p["1"].inputs.file = driveName;
p["19"].inputs.noise_seed = SEED;
p["19"].inputs.cfg = 2;
p["3"].inputs.text = POSITIVE;
p["247"].inputs.width = W;
p["247"].inputs.height = H;
p["247"].inputs.length = LENGTH;
p["90"].inputs.filename_prefix = `cass_walk_${TAG}`;
p["91"].inputs.filename_prefix = `cass_walk_${TAG}_loop`;

const t0 = Date.now();
const res = await fetch(`${base}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: p, client_id: randomUUID() }),
});
const queued = await res.json();
if (!res.ok || !queued.prompt_id) throw new Error(`queue fail ${res.status} ${JSON.stringify(queued)}`);
console.log("queued", queued.prompt_id, `${W}x${H}`, "len", LENGTH, "seed", SEED);

const history = await waitHistory(queued.prompt_id, 5400);
let saved = 0;
for (const m of collectMedia(history.outputs)) {
  const q = new URLSearchParams({ filename: m.filename, subfolder: m.subfolder || "", type: m.type || "output" });
  const r = await fetch(`${base}/view?${q}`);
  if (!r.ok) throw new Error(`view ${m.filename} ${r.status}`);
  fs.writeFileSync(path.join(OUT, m.filename), Buffer.from(await r.arrayBuffer()));
  saved++;
}
const info = { promptId: queued.prompt_id, size: `${W}x${H}`, length: LENGTH, seed: SEED, ref: refName, drive: driveName, ms: Date.now() - t0, saved, dir: OUT };
fs.writeFileSync(path.join(OUT, "job.json"), JSON.stringify(info, null, 2));
console.log(JSON.stringify(info, null, 2));
