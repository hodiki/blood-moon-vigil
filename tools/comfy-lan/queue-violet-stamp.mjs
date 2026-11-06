/**
 * Violet 128 stamp · secular nun direction (2026-10-30).
 * Two shoe variants: --variant=block (thick heel) / --variant=point (stiletto).
 *
 *   node queue-cassandra-stamp.mjs t2i  <seed> [...]      no reference, prompt only
 *   node queue-cassandra-stamp.mjs edit <seed> [refName]  reference = h23 illustration
 *
 * Output goes to characters/violet/review/20261030-violet-128/raw/{mode}-{seed}.png
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
const REF = REF_ARG ? REF_ARG.slice(6) : "characters/violet/identity/source/oath-o3.png";
const seeds = SEEDS.length ? SEEDS : [2026102101];
const OUT = path.join(root, "characters/violet/review/20261030-violet-128/raw");
const W = 768;
const H = 1344;
const TIMEOUT_S = 1800;

const VARIANT = (process.argv.find((a) => a.startsWith("--variant=")) || "--variant=block").slice(11);

const SHOE = {
  block: [
    "Chunky black block-heeled shoes with a rounded toe and a single pale strap across the instep.",
    "The sole reads as a solid dark block, not a thin spike.",
  ].join(" "),
  point: "Black pointed stiletto pumps, very thin heel, sharp toe.",
}[VARIANT] || "Black block-heeled shoes.";

const SHAPE = [
  "Full body character reference sheet of one pale solemn woman in her late twenties, a secular nun-like night watcher,",
  "standing, body three-quarter toward the viewer's right, head level, hands relaxed at her sides.",
  "HEAD: a deep charcoal veil sits on the crown and falls to her shoulders, its whole outer edge traced with a thin pale line",
  "so the veil reads as a distinct shape against her black hair and the dark background. The veil is open at the front,",
  "the pale forehead and the hairline are visible, and long black hair falls out from under it down her back.",
  "The veil is not a headband and not a hood.",
  "TORSO: a high-collared black dress in a qipao cut, narrow and straight from chest to hip with no waist cinch,",
  "a pale stand collar at the throat, one thin pale placket line running diagonally down the right side of the chest,",
  "three small silver frog buttons. Shoulders are square and slightly broad, not narrow.",
  "CHEST MARK: a small eight-pointed star glyph in pale silver on the sternum where the placket ends. Geometric star, not a cross.",
  "LOWER BODY: the dress is split open at both sides from the hip, so the front panel and the back panel hang separately",
  "and a wide wedge of bare upper thigh shows between them on each side. The front panel ends at mid thigh,",
  "the back panel at mid calf. Under the split the white opaque thigh-high stocking is visible with a clear pale band",
  "at the top of the thigh, and a strip of bare skin sits between the band and the hem.",
  "No shorts, no wrapped skirt, no floor-length fabric, the legs stay fully visible from the side.",
  SHOE,
  "LIGHT: a soft amber orb about the size of her head floats in the air a hand's width from her left shoulder,",
  "with a visible warm halo and a faint rim of light on the veil. Nothing is held in her hands.",
  "Realistic proportions, head about one eighth of the total height, small head, long legs.",
  "Pale tired face, calm, unsmiling.",
  "Flat cel-shaded illustration, hard edges, no outline stroke, plain near-black empty background, no floor, no scenery, no text.",
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
  "long veil to the floor, veil covering the body, wimple, hood, habit, headband,",
  "cross, crucifix, rosary, halo, religious symbol, candle, candlestick, lantern, holding anything in hand,",
  "shorts, trousers, floor-length skirt, wide A-line skirt, skirt covering both legs, waist cinched, corset,",
  "black stockings, bare legs, platform boots,",
  "headband, tiara, hairband, big head, chibi, short legs, stray dot, tiny floating speck, background scenery, floor, text, watermark, smiling, glossy latex, leather shine",
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
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `violet_stamp_v2_${VARIANT}_${seed}` } },
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
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `violet_edit_${seed}` } },
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
