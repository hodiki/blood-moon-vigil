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
const REF = path.join(root, "characters/cassandra/review/20261029-weapons/04-held-bow-v2.png");
const OUT = path.join(root, "characters/cassandra/review/20261029-weapons/raw");

const KEEP = [
  "Keep this exact character: same pale sharp face, same silver-white high ponytail shaped like a blade,",
  "same high-collared long wine-red leather coat nipped at the waist with triangular hems, black high collar,",
  "one small white cross on the chest, black leather belts with silver buckles, sheer charcoal stockings,",
  "matte black pointed high-heeled ankle boots. Same colours, same flat cel-shaded rendering, hard edges,",
  "no outline stroke, plain near-black empty background, no floor, no scenery, no props, no text.",
].join(" ");

const POSES = {
  b1v2: [
    "Change only her pose and hands: she now holds one barbed falchion in each hand, both hilts gripped.",
    "Blade type, follow exactly: a broad single-edged falchion, not a slim sabre. Along the spine there are exactly three",
    "deep concave scallops, each ending in a sharp backward hook, the last one running out into a long needle point that",
    "sweeps upward. Below the scallops the blade swells into a deep belly, so the widest part sits near the middle.",
    "The blade length is about three and a half times the grip length, and its width about one sixth of its length.",
    "A silver steel face with a single blood-red line running along the cutting edge. The guard is a short ornate cross",
    "with a small cross set inside a circle where it meets the blade, and the grip is dark wrapped with silver wire,",
    "ending in a pointed pommel set with a small red gem.",
    "She drops into a low forward lunge, front knee bent, back leg driving straight behind her,",
    "torso leaning into the movement, the long coat swept behind her and the ponytail thrown back.",
    "Whole body visible from hair tip to boot sole, facing the viewer's right.",
  ].join(" "),
  b1: [
    "Change only her pose and hands: she now holds one curved short sword in each hand, both hilts gripped,",
    "the blades angled forward and slightly up, silver steel faces with a single blood-red line along each inner edge,",
    "a row of small spikes on each spine near the guard, short cross guards carrying a small cross, dark wrapped grips.",
    "She drops into a low forward lunge, front knee bent, back leg driving straight behind her,",
    "torso leaning into the movement, the long coat swept behind her and the ponytail thrown back.",
    "Whole body visible from hair tip to boot sole, facing the viewer's right.",
  ].join(" "),
  b2w: [
    "Change only one thing in this frame: the bowstring. Make the string pure white and clearly visible, a solid bright white cord",
    "running from tip to tip of the bow, thick enough to read as an unbroken white line at small size,",
    "with a slight highlight so it does not disappear against the dark coat.",
    "Everything else stays exactly as it is: same pose, same fully drawn anchor, same arrow, same bow limbs and barbs,",
    "same blue grip, same hands, same coat, same hair, same lighting, same flat cel-shaded rendering.",
    "Do not change the pose, do not change the bow shape, do not add glow.",
  ].join(" "),
  b2v2: [
    "Change only her pose and hands: she has drawn a recurve longbow to full anchor. The bow arm is locked straight forward,",
    "the bow limbs bent deeply under load, the pale teal string pulled all the way back until her draw hand touches her cheek,",
    "one arrow nocked and drawn with the shaft running past her jaw, leaf-shaped crystal head and teal fletching,",
    "the grip wrapped in blue, silver-grey limbs with crescent barbs along their outer edges.",
    "Her weight is settled hard on the back leg, the front leg braced and straight, hips turned side-on to the target,",
    "the long coat hanging from the twist of her torso, ponytail pulled back by the draw.",
    "Both hands are on the bow only. Whole body visible from hair tip to boot sole, facing the viewer's right.",
  ].join(" "),
  b2: [
    "Change only her pose and hands: she draws a recurve longbow. The bow arm is extended forward,",
    "the silver-grey limbs carry crescent-shaped barbs along their outer edges, the pale teal string is drawn back",
    "to her cheek, one arrow nocked with a leaf-shaped crystal head and teal fletching, the grip wrapped in blue.",
    "Her weight settles back, front leg braced and straight, torso turned side-on to the target, coat hanging from the draw.",
    "Whole body visible from hair tip to boot sole, facing the viewer's right.",
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
  9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: `cass_held_${WHICH}_${SEED}` } },
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
