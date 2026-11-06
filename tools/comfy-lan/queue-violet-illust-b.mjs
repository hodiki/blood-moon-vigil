/**
 * Scheme A round 1 · Cassandra skill poses (Qwen image edit on the stamp).
 *
 *   node queue-cassandra-skill.mjs a|b [seed]
 *
 * Same character, same colours, only the pose changes. Output:
 * characters/cassandra/review/20261021-scheme-a-128/skill/raw/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");

const WHICH = (process.argv[2] || "a").toLowerCase();
const SEED = Number(process.argv[3] || (WHICH === "a" ? 2026102301 : 2026102302));
const REF = path.join(root, "characters/cassandra/identity/source/h23.png");
const OUT = path.join(root, "characters/violet/identity/source/raw");

const KEEP = [
  "Use ONLY the rendering style of the reference image: its semi-realistic painterly shading, its soft graduated lights and darks,",
  "its material rendering and the way its cloth and metal catch light.",
  "Do NOT copy anything else from the reference: not her red coat, not her silver ponytail, not her face, not her pose, not her footwear.",
  "The illustration is a fresh two-figure composition on the same plain near-black empty background.",
].join(" ");

const POSES = {
  a: [
    "FOREGROUND, one pale solemn woman in her late twenties, a fantasy cloister acolyte, standing three-quarter toward the viewer's right,",
    "one step ahead of the knight behind her, head level, hands relaxed at her sides.",
    "HEAD: a black lace eye mask forms one horizontal band across the middle of her face and covers both eyes; its lower edge is scalloped,",
    "its edges traced with a hair-thin pale line. The lace is dense, the eyes are not visible through it, the bare pale forehead shows above it.",
    "A short white lace veil is pinned at the crown and falls behind the head only; her temples, ears and cheeks are bare,",
    "and her black hair falls down her back in front of the veil on both sides. Open veil, not a hood, not a coif, not a wimple.",
    "TORSO: a white top covering the upper chest, both shoulders and the upper back, ending at a straight horizontal seam just under the bust.",
    "No shoulder mantle and no cape: the white shoulder is bare and fully visible on both sides.",
    "The white opens at the front into a deep V from the throat to the seam, filled with one layer of sheer white mesh;",
    "a black lace stand collar at the throat, narrow white lace cuffs at the wrists. A small eight-pointed star in blackened silver at the point of the V,",
    "a geometric star, not a cross, no rosary.",
    "LOWER BODY: from the under-bust seam down the dress is matte black wool, hugging the ribs and hips without flaring, split open at both sides",
    "from the hip bone down so a wedge of bare hip and upper thigh shows on each side; the front panel reaches mid-thigh with both knees visible,",
    "the back panel falls to mid calf. No shorts, no apron, no floor-length fabric.",
    "LEGS: white opaque matte thigh-high stockings with a clear pale band at the top and a strip of bare skin above it;",
    "black block-heeled shoes with a rounded toe, a solid dark sole and one strap across the instep.",
    "LIGHT: a small warm amber orb floats close to her left shoulder, inside her silhouette, a bright core with a soft pale halo.",
    "BEHIND HER, half a step back and to her left, only two thirds visible: a standing knight of the oath, taller by a head and a half,",
    "full plate in mid-steel, closed-visor helm, readable pauldrons, a tuft of deep red feathers at the helm and shoulder,",
    "silver only on the plate edges, gauntlets resting on the pommel of a greatsword standing point-down. Not kneeling.",
    "Framed wide enough for both figures, full body, no floor, no scenery, no text.",
  ].join(" "),
};

const NEGATIVE = [
  "red coat, silver ponytail, red hair, the reference woman's costume, the reference woman's face, copying the reference pose,",
  "shoulder mantle, cape over the shoulders, hood, coif, wimple, nun habit, veil covering the face,",
  "cross, crucifix, rosary, halo, candle, holding anything in hand,",
  "shorts, trousers, floor-length skirt, A-line skirt, apron, corset,",
  "black stockings, bare legs, platform boots, kneeling knight, faceless knight, fully silvered armour, blackened armour,",
  "flat cel shading, hard outline stroke, big head, chibi, background scenery, floor, text, watermark, glossy latex",
].join(" ");

async function upload(filePath) {
  const fd = new FormData();
  fd.append("image", new Blob([fs.readFileSync(filePath)], { type: "image/png" }), path.basename(filePath));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  return (await res.json()).name || path.basename(filePath);
}

function collectMedia(outputs) {
  const files = [];
  for (const id of Object.keys(outputs || {})) {
    for (const m of outputs[id]?.images || []) if (m.type !== "input") files.push(m);
  }
  return files;
}

async function waitHistory(promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/history/${promptId}`);
    const body = await res.json();
    const item = body[promptId];
    if (item) {
      if (collectMedia(item.outputs).length) return item;
      const st = item.status || {};
      if (st.status_str === "error") throw new Error(JSON.stringify(st));
      if (st.completed) throw new Error("completed with no media");
    }
    await new Promise((ok) => setTimeout(ok, 4000));
  }
  throw new Error(`timeout ${promptId}`);
}

if (!POSES[WHICH]) throw new Error("b1 or b2");
fs.mkdirSync(OUT, { recursive: true });

const refName = await upload(REF);
await fetch(`${base}/free`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
}).catch(() => {});

const graph = {
  1: { class_type: "LoadImage", inputs: { image: refName } },
  2: { class_type: "UNETLoader", inputs: { unet_name: "qwen_image_2.1_int8_convrot.safetensors", weight_dtype: "default" } },
  3: { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_8b_w4a8.safetensors", type: "qwen_image", device: "default" } },
  4: { class_type: "VAELoader", inputs: { vae_name: "qwen_image_2.1_vae_bf16.safetensors" } },
  5: { class_type: "QwenImage21Cache", inputs: { model: ["2", 0], device: "auto", dtype: "default" } },
  6: {
    class_type: "TextEncodeQwenImage21",
    inputs: {
      clip: ["3", 0], vae: ["4", 0], prompt: `${POSES[WHICH]} ${KEEP}`, negative_prompt: NEGATIVE,
      resolution: 0, "images.image_1": ["1", 0],
    },
  },
  7: {
    class_type: "KSampler",
    inputs: {
      model: ["5", 0], positive: ["6", 0], negative: ["6", 1], latent_image: ["6", 2],
      seed: SEED, steps: 40, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1,
    },
  },
  8: { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["4", 0] } },
  9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: `violet_illust_B_${SEED}` } },
};

const res = await fetch(`${base}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: graph, client_id: "violet-illust-b" }),
});
const queued = await res.json();
if (!res.ok || !queued.prompt_id) throw new Error(JSON.stringify(queued));
console.log("queued", WHICH, queued.prompt_id);

const history = await waitHistory(queued.prompt_id, 1800);
for (const m of collectMedia(history.outputs)) {
  const q = new URLSearchParams({ filename: m.filename, subfolder: m.subfolder || "", type: m.type || "output" });
  const r = await fetch(`${base}/view?${q}`);
  const dest = path.join(OUT, `${WHICH}-${SEED}.png`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  console.log("saved", dest);
}
