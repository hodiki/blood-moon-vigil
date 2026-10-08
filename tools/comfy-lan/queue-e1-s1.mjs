/**
 * E1 S1 scan: C1, 5 remaining cells (skip g768×rb4 = S0 LoRA 1.0).
 * Same engine as S0; no /free. Park only. Does not write assets/frames/.
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
    path.join(here, "workflows", "krea2-vf1-identity-edit.api.json"),
    "utf8",
  ),
);
const handshake = JSON.parse(
  fs.readFileSync(path.join(here, "incoming", "handshake.json"), "utf8"),
);
const base = String(handshake.gpu.url).replace(/\/$/, "");
const refPath = path.join(
  root,
  "assets",
  "ui-menu",
  "preview",
  "locked",
  "review-identity-vf1",
  "12-idle-blo-passed-stamp.png",
);

const SHOTS = [
  { id: "g512-rb2", grounding: 512, ref_boost: 2, prefix: "comfy_lan_e1_s1_g512_rb2" },
  { id: "g512-rb4", grounding: 512, ref_boost: 4, prefix: "comfy_lan_e1_s1_g512_rb4" },
  { id: "g768-rb2", grounding: 768, ref_boost: 2, prefix: "comfy_lan_e1_s1_g768_rb2" },
  { id: "g1024-rb2", grounding: 1024, ref_boost: 2, prefix: "comfy_lan_e1_s1_g1024_rb2" },
  { id: "g1024-rb4", grounding: 1024, ref_boost: 4, prefix: "comfy_lan_e1_s1_g1024_rb4" },
];

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

function makePrompt(shot, imageName) {
  const g = JSON.parse(JSON.stringify(tmpl));
  g["10"].inputs.image = imageName;
  g["32"].inputs.strength_model = 1.0;
  g["40"].inputs.ref_boost = shot.ref_boost;
  g["41"].inputs.grounding_px = shot.grounding;
  g["42"].inputs.grounding_px = shot.grounding;
  g["11"].inputs.filename_prefix = shot.prefix;
  return g;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destDir = path.join(parkRoot, stamp);
fs.mkdirSync(destDir, { recursive: true });

const imageName = await uploadImage(refPath);
console.log(`uploaded ref -> ${imageName}`);
console.log("S1 skip /free (Krea already resident from S0)");

const results = [];
for (const shot of SHOTS) {
  const t0 = Date.now();
  const prompt = makePrompt(shot, imageName);
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: randomUUID() }),
  });
  const queued = await res.json();
  if (!res.ok || !queued.prompt_id) {
    throw new Error(`${shot.id} queue fail ${res.status} ${JSON.stringify(queued)}`);
  }
  console.log(`queued ${shot.id} ${queued.prompt_id}`);
  const history = await waitHistory(queued.prompt_id, 420);
  const saved = await download(history, destDir);
  const rec = {
    id: shot.id,
    prompt_id: queued.prompt_id,
    grounding: shot.grounding,
    ref_boost: shot.ref_boost,
    ms: Date.now() - t0,
    saved,
  };
  results.push(rec);
  console.log(`saved ${shot.id} ${saved.length} in ${rec.ms}ms`);
}

const job = {
  schema: "comfy-lan-job/v1",
  at: new Date().toISOString(),
  exp: "e1-s1",
  url: base,
  dest: destDir,
  results,
};
fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(job, null, 2));
fs.writeFileSync(
  path.join(here, "incoming", "last-job.json"),
  JSON.stringify(job, null, 2),
);
console.log(`done -> ${destDir}`);
