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
const REF = path.join(root, "characters/oathkeeper/review/20261104-oath/ref-chop-alpha.png");
const OUT = path.join(root, "characters/oathkeeper/review/20261104-oath/raw");

const KEEP = [
  "Keep this exact knight: the same closed-visor helm with ONE horizontal eye slit and no cross on the face,",
  "the same deep red plume and the small red tuft on the left pauldron, the same mid-grey brushed plate armour",
  "with silver only on the rims, the same broad pauldrons and heavy sabatons, the same deep red cloth tabard",
  "hanging from the waist, the same greatsword. He stays at the same three-quarter angle toward the viewer's right,",
  "about thirty degrees off the camera. Same flat cel-shaded rendering, hard edges, no outline stroke,",
  "plain near-black empty background, no floor, no scenery, no text. Nobody else in the frame.",
].join(" ");

const POSES = {
  // 主理人给的几何：弯三角楔形，从头项起、弧度 ~120°、到剑身最宽、宽度指数增长到剑长 80%
  ac: [
    "Keep the character, the armour, the helmet, the tabard, the pose and the sword EXACTLY as they are in this image.",
    "Do not stand him up, do not move the sword, do not change the blade angle.",
    "Only add ONE motion smear: a curved wedge like a bent triangle.",
    "It starts as a hair-thin point, about one pixel wide, at the top of the character's head,",
    "and sweeps down along the path the blade travelled, an arc of about one hundred and twenty degrees,",
    "ending at the sword's body, where the wedge is at its widest.",
    "The width increases exponentially from that one-pixel start along the whole arc,",
    "eventually reaching about eighty percent of the length of the sword blade at the point where it meets the blade.",
    "So the shape is a long bent triangle: a needle at the head, swelling wider and wider, fat where it touches the steel.",
    "It is one flat pale bone-white colour with a crisp hard edge, like a painted shape, semi-transparent enough that the armour",
    "and the background still read through it. No glow, no beam, no bloom, no particles, no sparks, no double exposure.",
    "Everything else identical: same plain near-black background, no floor, no scenery, no text.",
  ].join(" "),
};

const NEGATIVE = [
  "sword planted in the ground, sword resting upright, blade vertical in front of the feet,",
  "leaning on the sword, hands held at the chest, arms tucked in, standing upright,",
  "looking straight ahead, cropped feet, cropped head, extra person, floor, scenery, text, watermark,",
  "glowing trail, energy beam, light beam, bloom, lens flare, smoke, sparks, particles,",
  "motion blur, long exposure, double exposure, crucifix-like emblem on the visor",
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
  9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: `chop5_${WHICH}_${SEED}` } },
};

const res = await fetch(`${base}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: graph, client_id: "cass-held" }),
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
