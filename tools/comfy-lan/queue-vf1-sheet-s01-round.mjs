/**
 * One sheet round from S01 (nylon / white bg), T01–T15 sequential t2i.
 * 8GB: one shot per prompt. Park only. Does not write assets/frames/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const parkRoot = path.join(
  root,
  "assets",
  "ui-menu",
  "preview",
  "locked",
  "combat-64",
  "_park",
  "comfy-lan",
);
const tmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "krea2-turbo-t2i-api.json"), "utf8"),
);
const base = "http://192.168.101.200:8188";

const LAYER1 = `One woman only.
masterpiece, best quality, amazing quality, very aesthetic, Professional illustration; masterpiece; best quality; very aesthetic.`;

const LAYER4 = `two horns with BLACK roots and RED tips; two RED eyes; pale skin; long wavy jet-black hair past the shoulders; black evening gown with sweetheart neckline; a sheer black nylon bib; second-skin; body-hugging; sheer black nylon short gloves on the forearms; high dress slit with RED lining; Black high heels; smooth and unpatterned black pantyhose.`;

const LAYER5 = `MUST KEEP: two horns with BLACK roots and RED tips; two RED eyes; pale skin; long wavy jet-black hair past the shoulders; black evening gown with sweetheart neckline; sheer black nylon bib; sheer black nylon short gloves on the forearms; high dress slit with RED lining; Black high heels; unpatterned black pantyhose.
MUST CHANGE TO: Black high heels.
Do not add gold eyes, brown ram horns, bat wings, a demon tail, pointed elf ears, white lingerie, a lace bib, red high heels, lace gloves, or a second person.
Pure white background. No scenery, no cyclorama, no extra props, no floor shadow.`;

const SHOTS = [
  {
    id: "T01",
    file: "full_front",
    seed: 2026091101,
    camera: `Full-body vertical shot, camera at chest height about three metres back. Frame from the floor under her black high heels up to a little headroom above the tips of her horns. She stands idle facing the camera, feet planted, arms relaxed at her sides, looking at the lens. She fills most of the frame height. Both horns, both red eyes, the nylon bib at her chest, the red slit lining, and both black heels must be readable.
curvy body; big breasts; wide hips; slender waist; smooth thighs.`,
  },
  {
    id: "T02",
    file: "full_profile_r",
    seed: 2026091102,
    camera: `Full-body vertical shot, true right profile. Camera at chest height, about three metres to her right. Frame from the floor under the black high heels up to a little headroom above the horn tips. She stands idle in profile, nose and the nearer red eye readable, not a cropped bust. Black gown silhouette, high slit with red lining, black heel, both horn tips in the outline. Arms relaxed at her sides.
curvy body; slender waist; smooth thighs.`,
  },
  {
    id: "T03",
    file: "full_profile_l",
    seed: 2026091103,
    camera: `Full-body vertical shot, true left profile. Camera at chest height, about three metres to her left. Frame from the floor under the black high heels up to a little headroom above the horn tips. She stands idle in profile, nose and the nearer red eye readable, not a cropped bust. Black gown silhouette, high slit with red lining, black heel, both horn tips in the outline. Arms relaxed at her sides.
curvy body; slender waist; smooth thighs.`,
  },
  {
    id: "T04",
    file: "full_back",
    seed: 2026091104,
    camera: `Full-body vertical shot, back view. Camera at chest height about three metres behind her. Frame from the floor under the black high heels up to a little headroom above the horn tips. She stands idle facing away, feet planted, arms down. Long wavy jet-black hair down her back. Two horns with BLACK roots and RED tips readable from behind. Black gown back, black heels. Face not required. No wings, no tail.
curvy body; wide hips; slender waist.`,
  },
  {
    id: "T05",
    file: "half_front",
    seed: 2026091105,
    camera: `Medium-wide vertical cowboy shot from mid-thigh up to just above the tips of her horns, with a little headroom above them. Camera at chest height, about three metres back. She faces the camera, upper body centered, filling most of the frame. The crop ends at her thigh slit so the red lining shows along the bottom edge. Red eyes sharply lit; the sheer black nylon bib reads clearly at her chest.
curvy body; big breasts; wide hips; slender waist; smooth thighs.`,
  },
  {
    id: "T06",
    file: "half_q45_r",
    seed: 2026091106,
    camera: `Medium-wide vertical cowboy shot, camera at the front-right three-quarter angle, chest height, about three metres back. Frame from mid-thigh to a little headroom above the horn tips. Face still readable; both red horn tips visible; nylon bib and red slit lining visible at the thigh crop. She stands idle, body turned a little right of camera.
curvy body; big breasts; wide hips; slender waist.`,
  },
  {
    id: "T07",
    file: "half_profile_r",
    seed: 2026091107,
    camera: `Medium vertical half-body, true right profile. Camera at chest height, about two and a half metres to her right. Frame from the waist / upper thigh to a little headroom above the horn tips. Nose and the nearer red eye readable. Sweetheart neckline and sheer black nylon bib in profile. Not a face-only close-up, not a full-body including heels.
curvy body; big breasts; slender waist.`,
  },
  {
    id: "T08",
    file: "half_q45_l",
    seed: 2026091108,
    camera: `Medium-wide vertical cowboy shot, camera at the front-left three-quarter angle, chest height, about three metres back. Frame from mid-thigh to a little headroom above the horn tips. Face still readable; both red horn tips visible; nylon bib and red slit lining visible at the thigh crop. She stands idle, body turned a little left of camera.
curvy body; big breasts; wide hips; slender waist.`,
  },
  {
    id: "T09",
    file: "half_profile_l",
    seed: 2026091109,
    camera: `Medium vertical half-body, true left profile. Camera at chest height, about two and a half metres to her left. Frame from the waist / upper thigh to a little headroom above the horn tips. Nose and the nearer red eye readable. Sweetheart neckline and sheer black nylon bib in profile. Not a face-only close-up, not a full-body including heels.
curvy body; big breasts; slender waist.`,
  },
  {
    id: "T10",
    file: "half_back",
    seed: 2026091110,
    camera: `Medium vertical half-body, back view. Camera at upper-back height about two and a half metres behind her. Frame from the hips to a little headroom above the horn tips. Back of the head, both horn roots, the fall of jet-black wavy hair, the back of the black gown. Face not required. No wings. Not a full-body including heels.
wide hips; slender waist.`,
  },
  {
    id: "T11",
    file: "face_front",
    seed: 2026091111,
    camera: `Close-up vertical portrait. Camera at eye height, about one metre back. Frame from the upper chest / sheer black nylon bib up to a little headroom above the horn tips. Face fills the frame: two RED eyes sharply lit and in focus, pale skin, black-root red-tip horns, long wavy jet-black hair. Sweetheart neckline and nylon bib readable at the bottom edge. Not a full-body shot, not a side view.`,
  },
  {
    id: "T12",
    file: "face_profile_r",
    seed: 2026091112,
    camera: `Close-up vertical portrait, true right profile. Camera at eye height, about one metre to her right. Frame from the nylon bib / collarbone up to a little headroom above the horn tips. Nose, lips, the nearer RED eye, pale skin, the nearer horn with BLACK root and RED tip, wavy black hair along the cheek. Not a full-body shot.`,
  },
  {
    id: "T13",
    file: "face_profile_l",
    seed: 2026091113,
    camera: `Close-up vertical portrait, true left profile. Camera at eye height, about one metre to her left. Frame from the nylon bib / collarbone up to a little headroom above the horn tips. Nose, lips, the nearer RED eye, pale skin, the nearer horn with BLACK root and RED tip, wavy black hair along the cheek. Not a full-body shot.`,
  },
  {
    id: "T14",
    file: "ots_r",
    seed: 2026091114,
    camera: `Over-the-shoulder vertical shot from her right-back. Camera at neck height, standing behind her right shoulder. The character's back faces the camera; keep head and body on the same level. Frame the back of the head, both horn roots, the fall of jet-black wavy hair, the back of the black gown. A sliver of cheek or one red eye may show; face is not required. No wings, no tail.`,
  },
  {
    id: "T15",
    file: "ots_l",
    seed: 2026091115,
    camera: `Over-the-shoulder vertical shot from her left-back. Camera at neck height, standing behind her left shoulder. The character's back faces the camera; keep head and body on the same level. Frame the back of the head, both horn roots, the fall of jet-black wavy hair, the back of the black gown. A sliver of cheek or one red eye may show; face is not required. No wings, no tail.`,
  },
];

function fullPrompt(camera) {
  return [LAYER1, camera, LAYER4, LAYER5].join("\n\n");
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
  for (const nodeId of Object.keys(outputs || {})) {
    const o = outputs[nodeId] || {};
    for (const key of ["images", "gifs", "videos"]) {
      for (const img of o[key] || []) files.push(img);
    }
  }
  return files;
}

async function waitHistory(promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await getJson(`${base}/history/${promptId}`, 10000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      if (collectMedia(item.outputs).length) return item;
      const status = item.status || {};
      if (status.status_str === "error") {
        throw new Error(`${promptId} error ${JSON.stringify(status)}`);
      }
      if (status.completed) throw new Error(`${promptId} completed with no images`);
    }
    await new Promise((ok) => setTimeout(ok, 2000));
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
    const dest = path.join(destDir, img.filename);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    saved.push(dest);
  }
  return saved;
}

function makePrompt(shot) {
  const g = JSON.parse(JSON.stringify(tmpl));
  g["5"].inputs.text = fullPrompt(shot.camera);
  g["7"].inputs.width = 768;
  g["7"].inputs.height = 1280;
  g["8"].inputs.seed = shot.seed;
  g["8"].inputs.steps = 8;
  g["8"].inputs.cfg = 1;
  g["8"].inputs.denoise = 1;
  g["11"].inputs.filename_prefix = `vf1_nylon_${shot.id}_${shot.file}`;
  g["12"].inputs.enabled = false;
  return g;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destDir = path.join(parkRoot, stamp);
fs.mkdirSync(destDir, { recursive: true });
const s01 = path.join(here, "workflows", "vf1-krea-lora", "vf1-krea2-20260911", "S01.png");
fs.copyFileSync(s01, path.join(destDir, "S01-ref.png"));

const free = await fetch(`${base}/free`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
});
if (!free.ok) throw new Error(`POST /free ${free.status}`);
console.log("POST /free ok");

const results = [];
for (const shot of SHOTS) {
  const t0 = Date.now();
  const prompt = makePrompt(shot);
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: randomUUID() }),
  });
  const queued = await res.json();
  if (!res.ok || !queued.prompt_id) {
    throw new Error(`${shot.id} queue fail ${res.status} ${JSON.stringify(queued)}`);
  }
  console.log(`queued ${shot.id} ${queued.prompt_id}`);
  const history = await waitHistory(queued.prompt_id, 180);
  const saved = await download(history, destDir);
  const ms = Date.now() - t0;
  results.push({ id: shot.id, file: shot.file, prompt_id: queued.prompt_id, ms, saved });
  console.log(`saved  ${shot.id} ${ms}ms ${saved.map((p) => path.basename(p)).join(",")}`);
}

const rec = {
  schema: "comfy-lan-sheet-round/v1",
  at: new Date().toISOString(),
  note: "S01 nylon pack, white bg freeze, T01-T15 sequential t2i. Not C. Not frames/.",
  dest: destDir,
  results,
};
fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2));
fs.writeFileSync(
  path.join(here, "incoming", "last-job.json"),
  JSON.stringify(rec, null, 2),
);
console.log(`done ${results.length} -> ${destDir}`);
