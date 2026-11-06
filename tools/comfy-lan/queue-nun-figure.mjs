/**
 * 类修女角色 · 双引擎对照（Qwen-Image 2.1 × 2 + Krea2 Turbo × 2）
 * 只做实验，不写 assets/frames。
 *
 *   node queue-nun-figure.mjs
 *
 * 输出：characters/_experiments/20261102-nun-figure/raw/{engine}-{seed}.png
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");

const OUT = path.join(root, "characters/_experiments/20261102-nun-figure/raw");
const W = 768;
const H = 1344;
const TIMEOUT_S = 2400;

const PROMPT = [
  "Full body character reference sheet of one pale solemn woman in her late twenties,",
  "a fantasy cloister acolyte in a convent-inspired costume, not a real nun, standing,",
  "body three-quarter toward the viewer's right, head level, hands relaxed at her sides.",
  "HEAD: a black lace eye mask forms one horizontal band across the middle of her face",
  "and covers both eyes; its lower edge is scalloped, and its upper and lower edges are",
  "traced with a hair-thin pale line so the mask reads as a separate shape on her pale",
  "skin. The lace is dense, the eyes are not visible through it, and the bare pale",
  "forehead shows above it. A short white lace veil is pinned to the crown, open at the",
  "front, falls only to her jaw, and sits behind the mask; it is white, not black. Long",
  "black hair falls from under it down her back. This is a lace veil, not a hood, not a",
  "wimple, not a nun's habit, not a headband.",
  "TORSO: black dress, a narrow white lace stand collar at the throat, three small silver",
  "hooks. The bodice is fitted at the chest, drawn in at the waist so the waistline",
  "reads, and follows the hips without flaring; tailored, not a corset, not lingerie.",
  "A small eight-pointed star glyph in pale silver on the sternum. Geometric star, not a",
  "cross, not a crucifix, no rosary on the costume.",
  "LOWER BODY: the dress splits open at both sides from just below the waist bone, so the",
  "front panel and the back panel hang separately and a wide wedge of bare hip and upper",
  "thigh shows on each side. The front panel ends well above the knee, both knees fully",
  "visible; the back panel falls to mid calf. No shorts, no wrapped skirt, no apron, no",
  "floor-length fabric.",
  "LEGS: white opaque thigh-high stockings, a clear pale band at the top of each thigh, a",
  "strip of bare skin between the band and the hem. Matte and fully opaque, not sheer,",
  "not black.",
  "PROPORTION: She has a curvy figure with a narrow waist, broad hips, and smooth thighs,",
  "with a fine visible skin grain and soft two-tone shading inside each colour area.",
  "Realistic proportions, head about one eighth of the total height, small head, long",
  "legs. Shoulders square and slightly broad, not narrow.",
  "LIGHT: a soft amber orb about half the size of her head floats a hand's width from her",
  "left shoulder, a visible warm halo, a faint rim of light along the veil and the top",
  "edge of the mask. Nothing is held in her hands.",
  "STYLE: Flat cel-shaded illustration in fantasy game concept-art language; the soft",
  "shading stays inside each flat colour area, the outer edges stay hard, no outline",
  "stroke. Plain near-black empty background, no floor, no scenery, no text, no",
  "watermark. Pale tired face, calm, mouth closed, unsmiling.",
].join(" ");

const NEGATIVE = [
  "cross, crucifix, rosary, halo, wimple, coif, nun habit, hood, floor-length veil,",
  "veil covering the face, black veil, black stockings, sheer stockings, bare legs,",
  "shorts, trousers, floor-length skirt, A-line skirt, apron, corset, lingerie,",
  "big head, chibi, short legs, narrow hips, boyish figure, plastic skin, doll skin,",
  "smiling, glossy latex, leather shine, background scenery, floor, text, watermark,",
  "stray dot",
].join(" ");

const JOBS = [
  { engine: "qwen", seed: 2026110201 },
  { engine: "qwen", seed: 2026110202 },
  { engine: "krea", seed: 2026110203 },
  { engine: "krea", seed: 2026110204 },
];

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

async function freeVram() {
  await fetch(`${base}/free`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unload_models: true, free_memory: true }),
  }).catch(() => {});
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
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `nun_qwen_${seed}` } },
  };
}

function kreaGraph(seed) {
  return {
    2: { class_type: "UNETLoader", inputs: { unet_name: "krea2_turbo_int8_convrot.safetensors", weight_dtype: "default" } },
    3: { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_4b_fp8_scaled.safetensors", type: "krea2", device: "cpu" } },
    4: { class_type: "VAELoader", inputs: { vae_name: "qwen_image_vae.safetensors" } },
    12: {
      class_type: "Krea2T-Enhancer-Advanced",
      inputs: { model: ["2", 0], enabled: false, strength: 1, text_scale: 1, debug: false },
    },
    5: { class_type: "CLIPTextEncode", inputs: { text: PROMPT, clip: ["3", 0] } },
    6: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["5", 0] } },
    7: { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    8: {
      class_type: "KSampler",
      inputs: {
        seed, steps: 8, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1,
        model: ["12", 0], positive: ["5", 0], negative: ["6", 0], latent_image: ["7", 0],
      },
    },
    9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["4", 0] } },
    11: { class_type: "SaveImage", inputs: { filename_prefix: `nun_krea_${seed}`, images: ["9", 0] } },
  };
}

assertNotFrames(OUT);
fs.mkdirSync(OUT, { recursive: true });

let currentEngine = null;
for (const job of JOBS) {
  if (job.engine !== currentEngine) {
    await freeVram();
    currentEngine = job.engine;
    console.log(`--- switching engine: ${job.engine}, vram freed ---`);
  }
  const graph = job.engine === "qwen" ? qwenGraph(job.seed) : kreaGraph(job.seed);
  const t0 = Date.now();
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: graph, client_id: "nun-figure" }),
  });
  if (!res.ok) throw new Error(`prompt ${res.status} ${await res.text()}`);
  const { prompt_id: promptId } = await res.json();
  console.log(`${job.engine} seed ${job.seed} queued ${promptId}`);
  const history = await waitHistory(promptId, TIMEOUT_S);
  for (const img of collectMedia(history.outputs)) {
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || "", type: img.type || "output" });
    const r = await fetch(`${base}/view?${q}`);
    const dest = path.join(OUT, `${job.engine}-${job.seed}.png`);
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    console.log(`saved ${dest} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
}
console.log("ALL DONE");
