/**
 * Scheme A round 1 · Cassandra skill poses (Qwen image edit on the stamp).
 *
 *   node queue-cassandra-skill.mjs a|b [seed]
 *
 * Same character, same colours, only the pose changes. Output:
 * characters/edmund/review/20261026-edmund-128/skill/raw/
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
const REF = path.join(root, "characters/edmund/review/20261026-edmund-128/ref/stamp-edmund-alpha.png");
const OUT = path.join(root, "characters/edmund/review/20261026-edmund-128/skill/raw");

const KEEP = [
  "Keep this exact character and costume: same tired adult face, same pointed night-watch hat with a narrow brim,",
  "same dark slate-blue coat, same torn black cloak behind him, same leather belt and brass buckles.",
  "Same colours, same flat cel-shaded rendering, hard edges, no outline stroke, plain near-black empty background,",
  "no floor, no scenery, no props, no text.",
].join(" ");

const POSES = {
  a: [
    "Change only his pose: he lifts the antique lantern off the belt and raises it to chest height in his left hand,",
    "the elbow bent, his head tilted down toward the flame, the right hand drawn back behind his hip.",
    "The lantern now hangs from his hand, not from the belt. Whole body visible from hat to boots.",
  ].join(" "),
  b: [
    "Change only his pose: he thrusts the lantern forward at arm's length toward the viewer's right,",
    "the arm straight, the flame flaring brighter, his body leaning forward after it and the torn cloak streaming behind.",
    "The lantern is in his extended hand, not at his belt. Whole body visible from hat to boots.",
  ].join(" "),
  // The revolver skill is a 6-round burst at 0.1 s intervals, and the art bible
  // already names it "left wheel firing pose" (专武包：左轮开火姿). That is an
  // extended arm with muzzle flash, not the aimed-at-the-cheek pose the lantern
  // frame used.
  b4: [
    "Change only his pose: he is firing the revolver. His right arm is stretched straight out toward the viewer's right",
    "at shoulder height, elbow locked, the hand gripping a worn silver revolver, barrel level and pointing the same way.",
    "A bright yellow-white muzzle flash bursts from the muzzle and a thin curl of smoke trails from it.",
    "His torso is turned slightly past the gun and leans back against the recoil, the torn cloak blown back behind him.",
    "His left hand is braced at his hip beside the antique lantern, which still hangs from the hook on his belt.",
    "His head is level, eyes following the barrel. Whole body visible from hat to boots.",
  ].join(" "),
  b3: [
    "Change only his pose: he raises a worn silver revolver in his right hand, the arm extended toward the viewer's right,",
    "the barrel level and aimed forward, his head level behind the sights, the left hand braced near his hip.",
    "The antique lantern still hangs from the hook on his belt at the left hip. The torn cloak is pulled back by the motion.",
    "Whole body visible from hat to boots.",
  ].join(" "),
  b2: [
    "Change only his pose: he thrusts the lantern forward at full arm's length in front of him, the elbow straight,",
    "the lantern held out and away from his body at chest height, clearly lower than his hat brim,",
    "the flame burning bright and steady, his torso turned slightly after the outstretched arm,",
    "the torn cloak streaming behind him. The lantern is in his extended hand, not at his belt.",
    "The arm is horizontal, not raised. Whole body visible from hat to boots.",
  ].join(" "),
};

const NEGATIVE = [
  "rifle, long gun, shotgun, two-handed grip, both hands on the gun, gun pointed at the camera, gun hidden behind the cloak, lantern in the hand, no gun, missing gun, cropped hands, two lanterns, extra limbs, cropped body, cut off feet,",
  "white hair, long hair, ponytail, hood, background scenery, floor, text, watermark, different character, different clothes",
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

if (!POSES[WHICH]) throw new Error("a or b");
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
  9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: `edmund_skill_${WHICH}_${SEED}` } },
};

const res = await fetch(`${base}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: graph, client_id: "edmund-skill" }),
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
