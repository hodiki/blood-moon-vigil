/**
 * E2 S3b: S2 envelope · Cache off · seed 2026091201.
 * POST /free first. Park only. Does not write assets/frames/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const parkRoot = path.join(
  root,
  "assets",
  "ui-menu",
  "preview",
  "locked",
  "combat-64",
  "_park",
  "comfy-lan",
);
const tmpl = JSON.parse(
  fs.readFileSync(
    path.join(here, "workflows", "wan-animate2-vo-walk.api.json"),
    "utf8",
  ),
);
const handshake = JSON.parse(
  fs.readFileSync(path.join(here, "incoming", "handshake.json"), "utf8"),
);
const base = String(handshake.gpu.url).replace(/\/$/, "");
const refPath = path.join(
  root,
  "characters",
  "violet-oath",
  "stamps",
  "idle-from-a.png",
);
const drivePath = path.join(
  root,
  "characters",
  "violet-oath",
  "video",
  "drive",
  "8c3b8794-drive-generic-walkinplace.mp4",
);

function mimeForUpload(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".mp4") return "video/mp4";
  return "application/octet-stream";
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

async function upload(filePath) {
  const abs = path.resolve(filePath);
  const buf = fs.readFileSync(abs);
  const blob = new Blob([buf], { type: mimeForUpload(abs) });
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
    const r = await getJson(`${base}/history/${promptId}`, 10000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      if (collectMedia(item.outputs).length) return item;
      const status = item.status || {};
      if (status.status_str === "error") {
        throw new Error(`${promptId} error ${JSON.stringify(status)}`);
      }
      if (status.completed) {
        throw new Error(`${promptId} completed with no images`);
      }
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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destDir = path.join(parkRoot, stamp);
fs.mkdirSync(destDir, { recursive: true });

const refName = await upload(refPath);
const driveName = await upload(drivePath);
console.log(`uploaded ref -> ${refName}`);
console.log(`uploaded drive -> ${driveName}`);

const free = await fetch(`${base}/free`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
});
if (!free.ok) throw new Error(`POST /free ${free.status}`);
console.log("POST /free ok");

const prompt = JSON.parse(JSON.stringify(tmpl));
if (Number(prompt["247"]?.inputs?.length) !== 49) {
  throw new Error(
    `api json length is ${prompt["247"]?.inputs?.length}, rebuild with 49 first`,
  );
}
if (prompt["224"]) {
  throw new Error("s3b expected Cache off (no node 224)");
}
if (Number(prompt["247"]?.inputs?.width) !== 480) {
  throw new Error(`s3b width ${prompt["247"]?.inputs?.width}, want 480`);
}
prompt["10"].inputs.image = refName;
prompt["1"].inputs.file = driveName;
prompt["19"].inputs.noise_seed = 2026091201;
prompt["90"].inputs.filename_prefix = "comfy_lan_e2_s3b";
prompt["91"].inputs.filename_prefix = "comfy_lan_e2_s3b_loop";

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
console.log(`queued s3b ${queued.prompt_id}`);
const history = await waitHistory(queued.prompt_id, 3600);
const saved = await download(history, destDir);
const job = {
  schema: "comfy-lan-job/v1",
  at: new Date().toISOString(),
  exp: "e2-s3b",
  url: base,
  prompt_id: queued.prompt_id,
  seed: 2026091201,
  size: "480x832",
  length: 49,
  unet: "wan_animate_2_distill_int8_convrot.safetensors",
  vae: "wan_2.1_vae.safetensors",
  lora: "lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors",
  cache: "off",
  drive: driveName,
  ref: refName,
  ms: Date.now() - t0,
  dest: destDir,
  saved,
};
fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(job, null, 2));
fs.writeFileSync(
  path.join(here, "incoming", "last-job.json"),
  JSON.stringify(job, null, 2),
);
console.log(`saved ${saved.length} in ${job.ms}ms -> ${destDir}`);
