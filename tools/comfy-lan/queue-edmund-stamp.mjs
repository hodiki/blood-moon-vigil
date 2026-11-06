/**
 * Edmund 128 stamp · 3/4 view, lantern hung on the belt (plan A).
 *
 *   node queue-cassandra-stamp.mjs t2i  <seed> [...]      no reference, prompt only
 *   node queue-cassandra-stamp.mjs edit <seed> [refName]  reference = h23 illustration
 *
 * Output goes to characters/edmund/review/20261026-edmund-128/raw/{mode}-{seed}.png
 * Never writes assets/frames. Boxing to 128 is box-stamp.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");

const MODE = process.argv[2] || "t2i";
const SEEDS = process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
const REF_ARG = process.argv.find((a) => a.startsWith("--ref="));
const REF = REF_ARG ? REF_ARG.slice(6) : "characters/edmund/identity/portrait/edmund-portrait.png";
const seeds = SEEDS.length ? SEEDS : [2026102601];
const OUT = path.join(root, "characters/edmund/review/20261026-edmund-128/raw");
const W = 768;
const H = 1344;
const TIMEOUT_S = 1800;

const SHAPE = [
  "Full body character reference sheet of one tired man around thirty-five, a vampire-hunter and lampkeeper, standing in a three-quarter view toward the viewer's right, head level, the face partly shaded by his hat brim.",
  "A stiff pointed night-watch hat with a narrow horizontal brim, dark weathered leather.",
  "Layered dark clothing: a long dark slate-blue coat over near-black trousers, and over the coat a torn black cloak whose hem breaks into jagged points, the cloak's bulk hanging behind him, not wrapped around the body.",
  "Wide leather belt with tarnished brass buckles, one worn strap across the chest.",
  "One small antique lantern hangs from a hook on the left side of his belt at thigh height, glass panels with a warm amber flame inside. The lantern is not raised and not in his hand.",
  "Both hands empty and relaxed at his sides.",
  "Realistic proportions, head about one eighth of the total height, small head, long legs.",
  "Tired weathered adult face, a little stubble, narrow eyes, not a young anime face.",
  "Flat cel-shaded illustration, hard edges, no outline stroke, plain near-black empty background, no floor, no scenery, no props.",
].join(" ");

// Pure side view. The walk drive is a profile clip; if the reference is 3/4 the
// model has to satisfy two conflicting views and the torso drifts.
const SHAPE_PROFILE = SHAPE
  .replace(
    "standing, body three-quarter toward the viewer's right,",
    "standing in a perfect side view profile facing the viewer's right,",
  )
  .replace(
    "but her head turned slightly toward the viewer so one eye and the face are clearly visible.",
    "her head level, facing along the profile, one eye visible in the profile.",
  );

const NEGATIVE = [
  "holding the lantern, lantern in hand, raised lantern, lantern above the shoulder, hood, hooded cloak,",
  "white hair, long hair, twin blades, longbow, gun, big head, chibi, oversized head, short legs,",
  "two people, extra limbs, background scenery, floor, text, watermark, huge anime eyes, smiling,",
].join(" ");

const EDIT_PROMPT = [
  "Keep this exact character: same face, same silver-white ponytail, same wine-red high-collared coat, black collar,",
  "white cross on the chest, black belts, black stockings, matte black pointed high-heeled boots, same colours.",
  "Redraw her as a clean full-body battle sprite for a game: whole body visible from hair tip to boot sole,",
  "three-quarter view facing the viewer's right, arms relaxed, hands empty,",
  "flat cel shading, hard edges, no outline stroke, plain near-black empty background, no floor, no props, no text.",
].join(" ");

const EDIT_NEGATIVE = [
  "hood, hooded cloak, brown leather, twin blades, longbow, two people, extra limbs, cropped body, cut off feet,",
  "background scenery, floor, text, watermark",
].join(" ");

function assertNotFrames(dest) {
  if (dest.replace(/\\/g, "/").includes("/assets/frames/")) throw new Error("拒绝写入 assets/frames/");
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, body: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, body: text };
    }
  } finally {
    clearTimeout(t);
  }
}

async function upload(filePath) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append("image", new Blob([buf], { type: "image/png" }), path.basename(filePath));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(filePath);
}

function collectMedia(outputs) {
  const files = [];
  for (const id of Object.keys(outputs || {})) {
    for (const img of outputs[id]?.images || []) if (img.type !== "input") files.push(img);
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
    await new Promise((ok) => setTimeout(ok, 4000));
  }
  throw new Error(`timeout ${promptId}`);
}

function baseGraph() {
  return {
    2: { class_type: "UNETLoader", inputs: { unet_name: "qwen_image_2.1_int8_convrot.safetensors", weight_dtype: "default" } },
    3: { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_8b_w4a8.safetensors", type: "qwen_image", device: "default" } },
    4: { class_type: "VAELoader", inputs: { vae_name: "qwen_image_2.1_vae_bf16.safetensors" } },
    5: { class_type: "QwenImage21Cache", inputs: { model: ["2", 0], device: "auto", dtype: "default" } },
  };
}

function t2iGraph(seed, prompt = SHAPE) {
  return {
    ...baseGraph(),
    6: {
      class_type: "TextEncodeQwenImage21",
      inputs: { clip: ["3", 0], vae: ["4", 0], prompt, negative_prompt: NEGATIVE, resolution: 1024 },
    },
    7: { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    8: {
      class_type: "KSampler",
      inputs: {
        model: ["5", 0], positive: ["6", 0], negative: ["6", 1], latent_image: ["7", 0],
        seed, steps: 40, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1,
      },
    },
    9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["4", 0] } },
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `cass_stamp_t2i_${seed}` } },
  };
}

function editGraph(seed, refName) {
  return {
    ...baseGraph(),
    1: { class_type: "LoadImage", inputs: { image: refName } },
    6: {
      class_type: "TextEncodeQwenImage21",
      inputs: {
        clip: ["3", 0], vae: ["4", 0], prompt: EDIT_PROMPT, negative_prompt: EDIT_NEGATIVE,
        resolution: 0, "images.image_1": ["1", 0],
      },
    },
    8: {
      class_type: "KSampler",
      inputs: {
        model: ["5", 0], positive: ["6", 0], negative: ["6", 1], latent_image: ["6", 2],
        seed, steps: 40, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1,
      },
    },
    9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["4", 0] } },
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `cass_stamp_edit_${seed}` } },
  };
}

assertNotFrames(OUT);
fs.mkdirSync(OUT, { recursive: true });

await fetch(`${base}/free`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
}).catch(() => {});

let refName = null;
if (MODE === "edit") refName = await upload(path.join(root, REF));

for (const seed of seeds) {
  const graph =
    MODE === "edit"
      ? editGraph(seed, refName)
      : MODE === "profile"
        ? t2iGraph(seed, SHAPE_PROFILE)
        : t2iGraph(seed);
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: graph, client_id: "cass-stamp" }),
  });
  if (!res.ok) throw new Error(`prompt ${res.status} ${await res.text()}`);
  const { prompt_id: promptId } = await res.json();
  console.log(MODE, "seed", seed, "queued", promptId);
  const history = await waitHistory(promptId, TIMEOUT_S);
  for (const img of collectMedia(history.outputs)) {
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || "", type: img.type || "output" });
    const r = await fetch(`${base}/view?${q}`);
    const dest = path.join(OUT, `${MODE}-${seed}.png`);
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    console.log("saved", dest);
  }
}
