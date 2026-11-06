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

const OUT = path.join(root, "characters/violet/identity/source/raw");
const W = 1024;
const H = 1344;
const TIMEOUT_S = 2400;

const WOMAN = [
  "FOREGROUND, one pale solemn woman in her late twenties, a fantasy cloister acolyte, standing three-quarter toward the viewer's right,",
  "one step ahead of the knight beside her, head level.",
  "FIGURE: tall and slim, about eight and a half heads from crown to sole, long legs, narrow waist, hips slightly wider than the waist,",
  "square shoulders, fine wrists. STANCE: contrapposto, her weight on the leg on the left side of the frame, that hip tilted up,",
  "the other knee slightly bent with the foot set a little forward, shoulders counter-tilted, one arm hanging relaxed at her side,",
  "the other hand resting lightly at her hip.",
  "HEAD: a black lace eye mask forms one horizontal band across the middle of her face and covers both eyes; its lower edge is scalloped,",
  "and its upper and lower edges are traced with a hair-thin pale line. The lace is dense, the eyes are not visible through it,",
  "and the bare pale forehead shows above it. A short white lace veil is pinned at the crown and falls behind the head only;",
  "her temples, ears and cheeks are bare, and her black hair falls down her back in front of the veil on both sides.",
  "This is an open veil, not a hood, not a coif, not a wimple.",
  "TORSO: a white top covering the upper chest, both shoulders and the upper back, ending at a straight horizontal seam just under the bust.",
  "No shoulder mantle, no cape, no second layer over the shoulders: the white shoulder is bare and fully visible on both sides.",
  "The white opens at the front into a deep V from the throat to the seam, filled with one layer of sheer white mesh;",
  "a black lace stand collar at the throat above the V. Narrow white lace cuffs at the wrists, one finger wide.",
  "A small eight-pointed star in blackened silver at the point of the V. Geometric star, not a cross, no rosary.",
  "LOWER BODY: from the under-bust seam down the dress is matte black wool; it hugs the ribs and hips without flaring, then splits open at both sides",
  "from the hip bone down, so a wedge of bare hip and upper thigh shows on each side. The front panel reaches mid-thigh with both knees fully visible,",
  "the back panel falls to mid calf. No shorts, no apron, no floor-length fabric.",
  "LEGS: white opaque matte thigh-high stockings, a clear pale band at the top of each thigh, a strip of bare skin between band and hem.",
  "Black block-heeled shoes with a rounded toe, a solid dark sole and one black strap across the instep.",
  "LIGHT: a small warm amber orb floats close to her left shoulder, just outside the shoulder line but inside her silhouette at head height,",
  "a bright core with a soft pale halo. Nothing is held in her hands.",
].join(" ");

const KNIGHT = [
  "BEHIND HER, half a step back and to her left, only two thirds of him visible inside the frame:",
  "a standing knight of the oath, plainly taller than her, upright and still, not kneeling.",
  "He stands square to the viewer, facing front, both gauntlets resting on the pommel of a greatsword planted point-down in front of him.",
  "He wears full plate armour in mid-steel, a closed-visor helm with no face visible, and readable pauldrons;",
  "a tuft of deep red feathers sits at the helm and one at the shoulder. Silver appears only on the plate edges,",
  "the plate is mid-steel, never blackened and never fully silvered. Both gauntlets rest on the pommel of a greatsword standing point-down before him.",
].join(" ");

const STYLE = [
  "STYLE: semi-realistic fantasy gothic illustration, like a painted character key art.",
  "Soft graduated shading with visible brush quality, never flat cel shading, never a hard outline stroke.",
  "Skin has subsurface warmth, the matte wool skirt has visible nap, the lace reads as dense threadwork,",
  "the steel has soft reflections and a little wear. One warm light from the amber orb rimlights her left side.",
  "Painterly, restrained, no bloom, no lens flare.",
  "Plain near-black empty background, no floor, no scenery, no text, no watermark.",
  "Pale tired face, calm and self-possessed, chin level, mouth closed, no smile.",
  "Matte finish everywhere: no specular sheen on the stockings, the skin or the cloth; this is a painting, not a 3D render, not a figurine.",
].join(" ");

const PROMPT = [WOMAN, KNIGHT, STYLE, "Two figures in one illustration, framed wide enough for both."].join(" ");

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
const JOBS = (CLI_SEEDS.length ? CLI_SEEDS : [2026110401, 2026110402]).map((seed) => ({ seed }));

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
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `violet_illust_M_${seed}` } },
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
