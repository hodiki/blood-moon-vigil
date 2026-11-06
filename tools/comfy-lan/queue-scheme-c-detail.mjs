/**
 * Scheme C pilot · flat blockout -> Qwen-Image-2.1 detail pass.
 *
 *   node queue-scheme-c-detail.mjs [frame] [seed]
 *
 * Reads the 512 blockout of `frame` from the scheme-c review dir, uploads it,
 * asks Qwen 2.1 to add material detail *inside the existing blocks*, and saves
 * the raw result to characters/cassandra/review/20261021-scheme-c-detail/raw/.
 *
 * It does not lock the silhouette and does not touch assets/frames. That is
 * finish-detail-frame.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");

const FRAME = process.argv[2] || "hero-cassandra";
const SEED = Number(process.argv[3] || 2026102101);
const VARIANT = process.argv[4] || "flat";
const TIMEOUT_S = 1800;
// flat  = the 512 vector render (smooth shapes, the model paints smoothly)
// pixel = the 64 frame nearest-upscaled 8x (hard pixel blocks, the model stays
//         in the pixel idiom, which is what we actually want to keep)
const SRC = VARIANT === "pixel"
  ? path.join(root, "characters/cassandra/review/20261021-scheme-c-detail/input", `${FRAME}-x8.png`)
  : VARIANT === "hd"
    ? path.join(root, "characters/cassandra/review/20261019-scheme-c/src1024", `${FRAME}.png`)
    : path.join(root, "characters/cassandra/review/20261019-scheme-c/src", `${FRAME}.png`);
const OUT = path.join(root, "characters/cassandra/review/20261021-scheme-c-detail/raw");

const POSITIVE_PIXEL = [
  "<image1> is a flat colour blockout sprite of one character, drawn on a hard pixel grid with no anti-aliasing.",
  "Repaint the same sprite as a finished pixel-art game sprite, keeping the exact same pixel silhouette, pose, proportions, foot line and block layout.",
  "Inside each existing block add at most two extra tones: cloth folds on the dark wine-red coat, two bands of silver in the hair with a few separated strands,",
  "leather shading on the boots, a small readable face on the skin block.",
  "Hard edges only, no anti-aliasing, no blur, no gradient, no outline stroke, no background, nothing outside the existing pixels.",
].join(" ");

const NEGATIVE_PIXEL = [
  "anti-aliasing, soft edges, blur, gradient, glow, outline, black border, background,",
  "second character, extra limbs, different pose, changed silhouette, photorealistic, 3d render, watermark, text",
].join(" ");

// hd: draw at 1024 and let the coverage box make the pixels, which is how the
// live frames were made. Asking a general editor for "pixel art" at 512 gives
// mottle; asking it for a clean stylised figure at 1024 and then boxing does not.
const POSITIVE_HD = [
  "<image1> is a flat colour blockout of one character on transparency.",
  "Paint it as a finished stylised game character: cloth folds and a few shade steps on the dark wine-red coat,",
  "silver hair with separated strands and one lit band, leather shading on the dark boots, a small clean face.",
  "Keep the same silhouette, pose, proportions, foot line and colour blocks exactly.",
  "Clean shapes, crisp edges, no outline stroke, no border, no background, no extra props.",
].join(" ");

const NEGATIVE_HD = [
  "outline, black border, background, second character, extra limbs, different pose,",
  "changed silhouette, different colours, photorealistic, 3d render, blur, watermark, text",
].join(" ");

const POSITIVE = [
  "<image1> is a flat colour blockout of one character on transparency.",
  "Repaint it with material detail while keeping the exact same silhouette, pose, proportions, foot line and colour blocks:",
  "give the dark wine-red coat cloth folds and a few shade steps, keep its two hem panels and the front opening,",
  "split the silver hair into strands with one lit band and one shaded band,",
  "give the dark boots leather shading, and put a small readable face on the skin block.",
  "Everything must stay inside the existing shapes. Do not move, resize, rotate or add anything.",
  "No outline stroke, no border, no background, no extra limbs, no new accessories.",
].join(" ");

const NEGATIVE = [
  "outline, black border, background, second character, extra limbs,",
  "different pose, changed silhouette, different colours, photorealistic, 3d render, blur, noise, watermark, text",
].join(" ");

const PREFIX = VARIANT === "pixel" ? "scheme_c_detail_px" : VARIANT === "hd" ? "scheme_c_detail_hd" : "scheme_c_detail";

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
  const blob = new Blob([buf], { type: "image/png" });
  const fd = new FormData();
  fd.append("image", blob, path.basename(filePath));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(filePath);
}

function collectMedia(outputs) {
  const files = [];
  for (const nodeId of Object.keys(outputs || {})) {
    for (const img of outputs[nodeId]?.images || []) {
      if (img.type === "input") continue;
      files.push(img);
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
    const dest = path.join(destDir, `${FRAME}-${img.filename}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    saved.push(dest);
  }
  return saved;
}

function graph(refName) {
  return {
    1: { class_type: "LoadImage", inputs: { image: refName } },
    2: {
      class_type: "UNETLoader",
      inputs: { unet_name: "qwen_image_2.1_int8_convrot.safetensors", weight_dtype: "default" },
    },
    3: { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_8b_w4a8.safetensors", type: "qwen_image", device: "default" } },
    4: { class_type: "VAELoader", inputs: { vae_name: "qwen_image_2.1_vae_bf16.safetensors" } },
    5: { class_type: "QwenImage21Cache", inputs: { model: ["2", 0], device: "auto", dtype: "default" } },
    6: {
      class_type: "TextEncodeQwenImage21",
      inputs: {
        clip: ["3", 0],
        vae: ["4", 0],
        prompt: VARIANT === "pixel" ? POSITIVE_PIXEL : VARIANT === "hd" ? POSITIVE_HD : POSITIVE,
        negative_prompt: VARIANT === "pixel" ? NEGATIVE_PIXEL : VARIANT === "hd" ? NEGATIVE_HD : NEGATIVE,
        resolution: 0,
        "images.image_1": ["1", 0],
      },
    },
    7: {
      class_type: "KSampler",
      inputs: {
        model: ["5", 0],
        positive: ["6", 0],
        negative: ["6", 1],
        latent_image: ["6", 2],
        seed: SEED,
        steps: 40,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
      },
    },
    8: { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["4", 0] } },
    9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: PREFIX } },
  };
}

if (!fs.existsSync(SRC)) throw new Error(`missing blockout ${SRC}`);
assertNotFrames(OUT);
fs.mkdirSync(OUT, { recursive: true });

// The GPU box keeps the last model resident; burn it before a different engine.
await fetch(`${base}/free`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
}).catch(() => {});

const refName = await upload(SRC);
console.log("uploaded", refName, "seed", SEED);

const res = await fetch(`${base}/prompt`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ prompt: graph(refName), client_id: "scheme-c-detail" }),
});
if (!res.ok) throw new Error(`prompt ${res.status} ${await res.text()}`);
const { prompt_id: promptId } = await res.json();
console.log("queued", promptId);

const history = await waitHistory(promptId, TIMEOUT_S);
const saved = await download(history, OUT);
console.log(JSON.stringify({ promptId, saved }, null, 2));
