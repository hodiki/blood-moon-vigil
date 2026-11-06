/**
 * 类修女 v3 · empire waist + 深V纱衬 + 插肩黑袖 + 开放头纱
 * Qwen-Image 2.1，两张。
 *
 *   node queue-nun-figure-v3.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");

const OUT = path.join(root, "characters/oathkeeper/review/20261104-oath/raw");
const W = 832;
const H = 1216;
const TIMEOUT_S = 2400;

const KNIGHT = [
  "Full body character reference of one standing knight of the oath: a tall heavy figure in full plate armour.",
  "He stands at a three-quarter angle toward the viewer's right, about thirty degrees off the camera,",
  "so that both the breastplate and the closed visor read at once; upright, still, weight even, not kneeling.",
  "HELM: a closed-visor helm with no face visible; a SINGLE HORIZONTAL eye slit only, no vertical slit,",
  "no cross-shaped opening, no cross on the visor; the brow is a plain angular ridge that runs across, not down;",
  "a tuft of deep red feathers rises from the crest and a smaller tuft sits on the left pauldron.",
  "ARMOUR: full plate in mid-grey steel, brushed rather than mirror-polished, broad pauldrons, articulated fauld, heavy sabatons;",
  "silver appears only as a bright edge along the plate rims, never as a whole plated surface,",
  "and the plate is never blackened. A deep red cloth tabard hangs from the waist to mid thigh.",
  "WEAPON: a greatsword, point-down, both gauntlets resting on the pommel; the blade is plain steel,",
  "the crossguard straight, no ornament, no glow.",
  "PROPORTION: heavy and tall, about eight heads, wide shoulders, thick limbs, small head.",
  "STYLE: flat cel-shaded illustration in fantasy game concept-art language, hard edges, no outline stroke,",
  "each surface carries one hard-edged shadow shape, matte metal with a single soft highlight per plate.",
  "Plain near-black empty background, no floor, no scenery, no text, no watermark.",
].join(" ");

const PROMPT = KNIGHT;

const NEGATIVE = [
  "white skirt, black bodice, drop waist, seam at the waist, belt, cummerbund,",
  "hood, coif, wimple, nun habit, veil covering the face, black veil,",
  "cross, crucifix, rosary, halo, floor-length veil,",
  "black stockings, sheer stockings, bare legs, shorts, trousers, floor-length skirt,",
  "A-line skirt, apron, corset, lingerie, ombre, gradient at the waist, faded hem,",
  "big head, chibi, short legs, narrow hips, boyish figure, plastic skin, doll skin,",
  "smiling, glossy latex, leather shine, background scenery, floor, text, watermark, stray dot",
].join(" ");

const CLI_SEEDS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const JOBS = (CLI_SEEDS.length ? CLI_SEEDS : [2026110516, 2026110517, 2026110518]).map((seed) => ({ seed }));

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
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  throw new Error(`timeout ${promptId}`);
}

function qwenGraph(seed) {
  return {
    2: { class_type: "UNETLoader", inputs: { unet_name: "qwen_image_2.1_int8_convrot.safetensors", weight_dtype: "default" } },
    3: { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_8b_w4a8.safetensors", type: "qwen_image", device: "default" } },
    4: { class_type: "VAELoader", inputs: { vae_name: "qwen_image_2.1_vae_bf16.safetensors" } },
    5: { class_type: "QwenImage21Cache", inputs: { model: ["2", 0], device: "auto", dtype: "default" } },
    6: {
      class_type: "TextEncodeQwenImage21",
      inputs: { clip: ["3", 0], vae: ["4", 0], prompt: PROMPT, negative_prompt: NEGATIVE, resolution: 1024 },
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
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `knight_idle_v2_${seed}` } },
  };
}

assertNotFrames(OUT);
fs.mkdirSync(OUT, { recursive: true });

await fetch(`${base}/free`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
}).catch(() => {});

for (const job of JOBS) {
  const t0 = Date.now();
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: qwenGraph(job.seed), client_id: "nun-figure-v3" }),
  });
  if (!res.ok) throw new Error(`prompt ${res.status} ${await res.text()}`);
  const { prompt_id: promptId } = await res.json();
  console.log(`qwen-v3 seed ${job.seed} queued ${promptId}`);
  const history = await waitHistory(promptId, TIMEOUT_S);
  for (const img of collectMedia(history.outputs)) {
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || "", type: img.type || "output" });
    const r = await fetch(`${base}/view?${q}`);
    const dest = path.join(OUT, `qwen-v3-${job.seed}.png`);
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    console.log(`saved ${dest} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
}
console.log("ALL DONE");
