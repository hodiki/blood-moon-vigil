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
const REF = path.join(root, "characters/violet/review/20261103-s1/ref-stamp-alpha.png");
const OUT = path.join(root, "characters/violet/review/20261103-s1/skill/raw");

const KEEP = [
  "Keep this exact character and costume: the black lace eye mask as one horizontal band across the eyes,",
  "the short white lace veil pinned at the crown falling behind the head only with black hair in front of it,",
  "the white sleeveless top over both shoulders ending at a seam under the bust, the black lace stand collar,",
  "the small eight-pointed star in blackened silver at the point of the V, the narrow white lace band at each wrist,",
  "the two narrow black panels of the dress front and back with the sides fully open, the white opaque thigh-high",
  "stockings with the pale band at the top, and the black block-heeled shoes with one strap. Same pale skin,",
  "same flat cel-shaded rendering, hard edges, no outline stroke, plain near-black empty background,",
  "no floor, no scenery, no text. Nobody else in the frame.",
].join(" ");

const POSES = {
  // B2 光球即铃：她手上不拿东西，左肩那颗琥珀光球鸣响，化为脚边的铃音环
  a: [
    "Change only the pose and add one effect; keep the character and costume identical.",
    "She stands three-quarter toward the viewer's right, weight settled, chin level, calm and commanding.",
    "She raises the arm on the side AWAY from the orb, straight out and slightly up at shoulder height,",
    "hand open and completely empty, fingers spread, as if she is commanding the orb from a distance.",
    "The other arm hangs relaxed at her side. Both hands are empty.",
    "There is exactly ONE glowing sphere in the whole frame: it stays floating in place beside her shoulder,",
    "on the opposite side from the raised arm, and it does not move into her hand or touch her.",
    "The amber orb beside her left shoulder is now larger and brighter than usual, drawn as a distinct glowing sphere",
    "with visible concentric sound rings spreading from it.",
    "On the ground around her feet lies a bright warm ring of light, tilted to read as an ellipse under her stance,",
    "with two or three fine arcs rising from it, so the frame reads as a ringing aura rather than a standing pose.",
    "Both feet stay on the floor line, both shoes readable.",
  ].join(" "),
  // C1 抬手掷出：臂上扬，八角星刃环刚离手，在前上方
  b: [
    "Change only the pose and add one thrown object; keep the character and costume identical.",
    "She has just thrown: her right arm is raised high and forward, hand open at the end of the follow-through,",
    "her torso twisted into the throw, her left arm swung back low for balance, both feet planted wide.",
    "Out in front of her, a hand's width clear of her open fingers and at head height, flies a spinning blade ring.",
    "The ring is about the size of her head: a bright silver hoop with eight short blades radiating from it,",
    "a small eight-pointed star at its centre, its rim catching a bright cool light so it reads clearly against the dark.",
    "It is tilted in perspective, with two or three curved motion streaks trailing behind it.",
    "The centre of the ring glows a warm amber point. Nothing is held in her hands. No second person in frame.",
  ].join(" "),
};

const NEGATIVE = [
  "two people, extra limbs, extra hands, three swords, two bows, cropped body, cut off feet, weapon hidden behind the coat,",
  "slim sabre, katana, straight blade, machete, cleaver, serrated knife with many small teeth, plain oval guard, no guard, modern fencing sword, holding the weapon by the blade, floating weapons, weapons not in hands, scabbard, second sword at the belt, dagger, knife at the hip, background scenery, floor, text, watermark,",
  "different character, different clothes, hood, short hair, blonde hair",
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
  9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: `violet_skill_v3_${WHICH}_${SEED}` } },
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
