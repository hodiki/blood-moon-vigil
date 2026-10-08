/**
 * 魔化 skill-b 128 · C 轨 Identity Edit（张臂空手，两枪）。
 * Park only. Does not write assets/frames/.
 * 参考 = 已过 B-lo 印戳。不用守誓。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..", "..");
const comfyLan = path.join(repo, "tools", "comfy-lan");
const tmpl = JSON.parse(
  fs.readFileSync(
    path.join(
      repo,
      "pipelines",
      "c-pose-krea2-identity-edit",
      "workflow.api.json",
    ),
    "utf8",
  ),
);
const handshake = JSON.parse(
  fs.readFileSync(path.join(comfyLan, "incoming", "handshake.json"), "utf8"),
);
const base = String(handshake.gpu.url).replace(/\/$/, "");
const refPath = path.join(
  repo,
  "characters",
  "violet-fallen",
  "stamps",
  "idle-blo.png",
);

const IDENTITY =
  "Keep this exact woman and her costume unchanged: two horns with black roots and red tips, red eyes, pale skin, long wavy jet-black hair past the shoulders, black evening gown with a lace bib high collar, black lace gloves ending on the forearms, high slit with red lining, red high heels, empty dark void background, same flat cel-shaded illustration style.";
const SKILL_B =
  "Change only her pose: both arms stretch out wide to the sides of the picture, empty hands open, elbows slightly bent, standing on both feet, facing the same direction as before.";

const SHOTS = [
  {
    id: "skill-b-1",
    seed: 2026091801,
    prompt: `${IDENTITY}\n${SKILL_B}`,
    prefix: "comfy_lan_vf_skill_b_1",
  },
  {
    id: "skill-b-2",
    seed: 2026091802,
    prompt: `${IDENTITY}\n${SKILL_B}`,
    prefix: "comfy_lan_vf_skill_b_2",
  },
];

async function getJson(url, timeoutMs, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, ...opts });
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
const destDir = path.join(repo, "characters", "violet-fallen", "_park", stamp);
fs.mkdirSync(destDir, { recursive: true });

const free = await getJson(`${base}/free`, 30000, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
});
console.log(`POST /free -> ${free.status}`);

const imageName = await uploadImage(refPath);
console.log(`uploaded ref -> ${imageName}`);
console.log("vf skill-b 128 · g768 rb4 · 张臂空手 x 2 seeds");

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
  exp: "vf-skill-b-128",
  char: "violet-fallen",
  cell: { grounding_px: 768, ref_boost: 4, lora: 1.0 },
  identity: IDENTITY,
  poses: { "skill-b": SKILL_B },
  url: base,
  dest: destDir,
  results,
};
fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(job, null, 2));
fs.writeFileSync(
  path.join(comfyLan, "incoming", "last-job.json"),
  JSON.stringify(job, null, 2),
);
console.log(`done -> ${destDir}`);
