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

const OUT = path.join(root, "characters/violet/review/20261103-s1/raw");
const W = 768;
const H = 1344;
const TIMEOUT_S = 2400;

const PROMPT = "Full body character reference sheet of one pale solemn woman in her late twenties, a fantasy cloister acolyte in a convent-inspired costume, not a real nun, standing with her weight even on both feet, body three-quarter toward the viewer's right, head level, hands relaxed at her sides. FIGURE: She has a curvy figure with a narrow waist, broad hips, a full voluptuous bust and smooth round thighs, rendered with detailed skin texture and soft two-tone shading inside each colour area. Realistic proportions, head about one eighth of the total height, small head, long legs, shoulders square and slightly broad. Her body stays curvy and full under the clothes; the black panels are narrow, but her hips are broad and round beneath them. HEAD: a black lace eye mask forms one horizontal band across the middle of her face and covers both eyes; its lower edge is scalloped, and its upper and lower edges are traced with a hair-thin pale line so the mask reads as a separate shape on her pale skin. The lace is dense, the eyes are not visible through it, and the bare pale forehead shows above it. A short white lace veil is pinned at the crown and falls behind the head only; her temples, ears and cheeks are bare, her hairline is visible, and her black hair falls down her back in front of the veil on both sides, so nothing wraps around her face. The veil's outer edge is traced with a thin dark line so it stays readable against the white top. This is an open veil, not a hood, not a coif, not a wimple, not a headband. TORSO: she wears a white sleeveless top. The white covers both shoulders, the whole upper back and the upper chest, cut in at the armholes, and both arms are bare from the shoulder to the wrist, pale skin. At each wrist she wears a narrow band of white lace, one finger wide, sitting on the bare arm. There are no sleeves of any kind. The white stops at a straight horizontal seam just under the bust that runs all the way round the body, front and back; no white below that seam and no black above it. The front of the white then opens into a shallow V from the throat down to the seam, lined with one layer of sheer white mesh so no bare chest is exposed. A black lace stand collar at the throat above the V, reading as a clear black band against the white. There are no straps, no sleeveless cut, no bare shoulder and no bare arm anywhere. A small eight-pointed star in blackened silver at the point of the V, just above the seam. Geometric star, not a cross, not a crucifix, no rosary on the costume. LOWER BODY: below the under-bust seam the dress becomes two narrow black panels only, one hanging in front and one hanging behind, joined at the waist and nowhere else. Both panels hang narrow, but her hips are broad and full beneath them, so the flanks, the bare hip and the outer thigh show openly on both sides from the hip bone down. The front panel is a narrow band reaching mid-thigh with both knees fully visible; the back panel is an equally narrow band falling to mid calf. No wide skirt, no wrapped skirt, no apron, no shorts, no floor-length fabric, no waist seam. There is no shoulder mantle, no cape and no second layer over the shoulders. LEGS: white opaque thigh-high stockings, a clear pale band at the top of each thigh, a strip of bare skin between the band and the hem. Matte and fully opaque, not sheer, not black. Black chunky block-heeled shoes with a rounded toe, a solid dark sole and a single black strap across the instep; the white stocking disappears into the shoe opening at the ankle. LIGHT: a soft amber orb about half the size of her head floats a hand's width from her left shoulder, clear of her body, drawn as a distinct bright sphere with a visible warm halo that lights the edge of her veil and the top edge of her mask. The orb is unmistakable against the dark background, never a small dot. Nothing is held in her hands. STYLE: Flat cel-shaded illustration in fantasy game concept-art language; each limb carries one hard-edged shadow shape, never a soft gradient; the white top falls in long straight folds with sharp-edged shadows; the black skirt is matte wool with no sheen; the lace is a dense pattern of small dark holes; the stockings are smooth matte fabric. The outer edges stay hard, no outline stroke. Plain near-black empty background, no floor, no scenery, no text, no watermark. Pale tired face, calm, mouth closed, unsmiling. Hands are relaxed with visible knuckles, fingers slightly parted.";

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
    10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: `s1v6_${seed}` } },
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
