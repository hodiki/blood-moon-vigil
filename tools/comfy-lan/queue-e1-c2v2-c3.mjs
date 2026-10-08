/**
 * E1 C2 v2 (visual prompt) two guns + C3 one probe.
 * Same cell g768×rb4. Park only. Does not write assets/frames/.
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

const IDENTITY =
  "Keep this exact woman and her costume unchanged: two horns with black roots and red tips, red eyes, pale skin, long wavy jet-black hair past the shoulders, black evening gown with a lace bib high collar, black lace gloves ending on the forearms, high slit with red lining, red high heels, empty dark void background, same flat cel-shaded illustration style.";

const C2 =
  "Repose the character into a contrapposto stance. Her weight rests on the straight vertical leg on the LEFT side of the frame; the opposite knee bends slightly forward and its toe stays lightly on the ground, heel raised. The hip on the supporting side rises, the pelvis tilts, and the shoulder line counter-tilts in the opposite direction, creating a subtle S-curve through the torso.";

const C3 =
  "Change her pose to a mid-stride walk moving toward the RIGHT side of the frame, her body turned into a three-quarter profile facing right. The front leg extends forward with the heel striking the ground, while the back leg extends fully behind with the heel raised high. Both feet stay on the same ground line. The torso leans slightly forward so the shoulders sit ahead of the hips; the hips counter-rotate against the shoulders; the coat hem and her hair trail backwards, away from the direction of travel, lifted slightly by the step.";

const SHOTS = [
  { id: "c2v2-a", seed: 2026091108, prompt: `${IDENTITY}\n${C2}`, prefix: "comfy_lan_e1_c2v2_a" },
  { id: "c2v2-b", seed: 2026091109, prompt: `${IDENTITY}\n${C2}`, prefix: "comfy_lan_e1_c2v2_b" },
  { id: "c3-a", seed: 2026091106, prompt: `${IDENTITY}\n${C3}`, prefix: "comfy_lan_e1_c3_a" },
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
  g["40"].inputs.ref_boost = 4.0;
  g["41"].inputs.grounding_px = 768;
  g["42"].inputs.grounding_px = 768;
  g["41"].inputs.prompt = shot.prompt;
  g["8"].inputs.seed = shot.seed;
  g["11"].inputs.filename_prefix = shot.prefix;
  return g;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destDir = path.join(parkRoot, stamp);
fs.mkdirSync(destDir, { recursive: true });

const imageName = await uploadImage(refPath);
console.log(`uploaded ref -> ${imageName}`);

const free = await fetch(`${base}/free`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
});
if (!free.ok) throw new Error(`POST /free ${free.status}`);
console.log("POST /free ok");

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
  console.log(`queued ${shot.id} seed ${shot.seed} ${queued.prompt_id}`);
  const history = await waitHistory(queued.prompt_id, 420);
  const saved = await download(history, destDir);
  const rec = {
    id: shot.id,
    prompt_id: queued.prompt_id,
    seed: shot.seed,
    ms: Date.now() - t0,
    saved,
  };
  results.push(rec);
  console.log(`saved ${shot.id} ${saved.length} in ${rec.ms}ms`);
}

const job = {
  schema: "comfy-lan-job/v1",
  at: new Date().toISOString(),
  exp: "e1-c2v2-c3",
  cell: { grounding_px: 768, ref_boost: 4, lora: 1.0 },
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
