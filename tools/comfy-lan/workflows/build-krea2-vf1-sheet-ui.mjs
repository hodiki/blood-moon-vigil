/**
 * Build Krea 2 Turbo UI graph: Vf1 nylon LoRA character sheet.
 * Freeze blocks (layers 1 / 4 / 5) are single nodes concatenated into every shot.
 * Layers 2–3 (camera + crop) are rewritten per shot.
 * t2i, denoise 1, Enhancer off. Default: only T01 unmuted (8GB).
 * Does not write assets/frames/. Does not Queue.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(
  here,
  "..",
  "incoming",
  "gpu-docs",
  "workflows",
  "KREA2-Turbo-基础.json",
);
const outDir = path.join(here, "vf1-krea-lora");
const outJson = path.join(outDir, "KREA2-Turbo-Vf1-设定表.json");
const outMd = path.join(outDir, "prompts-sheet-v1.md");

const LAYER1 = `One woman only.
masterpiece, best quality, amazing quality, very aesthetic, Professional illustration; masterpiece; best quality; very aesthetic.`;

const LAYER4 = `two horns with BLACK roots and RED tips; two RED eyes; pale skin; long wavy jet-black hair past the shoulders; black evening gown with sweetheart neckline; a sheer black nylon bib; second-skin; body-hugging; sheer black nylon short gloves on the forearms; high dress slit with RED lining; Black high heels; smooth and unpatterned black pantyhose.`;

const LAYER5 = `MUST KEEP: two horns with BLACK roots and RED tips; two RED eyes; pale skin; long wavy jet-black hair past the shoulders; black evening gown with sweetheart neckline; sheer black nylon bib; sheer black nylon short gloves on the forearms; high dress slit with RED lining; Black high heels; unpatterned black pantyhose.
MUST CHANGE TO: Black high heels.
Do not add gold eyes, brown ram horns, bat wings, a demon tail, pointed elf ears, white lingerie, a lace bib, red high heels, lace gloves, or a second person.
Empty night void behind her. No scenery, no cyclorama, no extra props.`;

const SHOTS = [
  {
    id: "T01",
    file: "full_front",
    title: "全身-正面",
    band: "全身",
    seed: 2026091101,
    camera: `Full-body vertical shot, camera at chest height about three metres back. Frame from the floor under her black high heels up to a little headroom above the tips of her horns. She stands idle facing the camera, feet planted, arms relaxed at her sides, looking at the lens. She fills most of the frame height. Both horns, both red eyes, the nylon bib at her chest, the red slit lining, and both black heels must be readable.
curvy body; big breasts; wide hips; slender waist; smooth thighs.`,
  },
  {
    id: "T02",
    file: "full_profile_r",
    title: "全身-右侧面",
    band: "全身",
    seed: 2026091102,
    camera: `Full-body vertical shot, true right profile. Camera at chest height, about three metres to her right. Frame from the floor under the black high heels up to a little headroom above the horn tips. She stands idle in profile, nose and the nearer red eye readable, not a cropped bust. Black gown silhouette, high slit with red lining, black heel, both horn tips in the outline. Arms relaxed at her sides.
curvy body; slender waist; smooth thighs.`,
  },
  {
    id: "T03",
    file: "full_profile_l",
    title: "全身-左侧面",
    band: "全身",
    seed: 2026091103,
    camera: `Full-body vertical shot, true left profile. Camera at chest height, about three metres to her left. Frame from the floor under the black high heels up to a little headroom above the horn tips. She stands idle in profile, nose and the nearer red eye readable, not a cropped bust. Black gown silhouette, high slit with red lining, black heel, both horn tips in the outline. Arms relaxed at her sides.
curvy body; slender waist; smooth thighs.`,
  },
  {
    id: "T04",
    file: "full_back",
    title: "全身-背面",
    band: "全身",
    seed: 2026091104,
    camera: `Full-body vertical shot, back view. Camera at chest height about three metres behind her. Frame from the floor under the black high heels up to a little headroom above the horn tips. She stands idle facing away, feet planted, arms down. Long wavy jet-black hair down her back. Two horns with BLACK roots and RED tips readable from behind. Black gown back, black heels. Face not required. No wings, no tail.
curvy body; wide hips; slender waist.`,
  },
  {
    id: "T05",
    file: "half_front",
    title: "半身-正面",
    band: "半身",
    seed: 2026091105,
    camera: `Medium-wide vertical cowboy shot from mid-thigh up to just above the tips of her horns, with a little headroom above them. Camera at chest height, about three metres back. She faces the camera, upper body centered, filling most of the frame. The crop ends at her thigh slit so the red lining shows along the bottom edge. Red eyes sharply lit; the sheer black nylon bib reads clearly at her chest.
curvy body; big breasts; wide hips; slender waist; smooth thighs.`,
  },
  {
    id: "T06",
    file: "half_q45_r",
    title: "半身-右45°",
    band: "半身",
    seed: 2026091106,
    camera: `Medium-wide vertical cowboy shot, camera at the front-right three-quarter angle, chest height, about three metres back. Frame from mid-thigh to a little headroom above the horn tips. Face still readable; both red horn tips visible; nylon bib and red slit lining visible at the thigh crop. She stands idle, body turned a little right of camera.
curvy body; big breasts; wide hips; slender waist.`,
  },
  {
    id: "T07",
    file: "half_profile_r",
    title: "半身-右侧面",
    band: "半身",
    seed: 2026091107,
    camera: `Medium vertical half-body, true right profile. Camera at chest height, about two and a half metres to her right. Frame from the waist / upper thigh to a little headroom above the horn tips. Nose and the nearer red eye readable. Sweetheart neckline and sheer black nylon bib in profile. Not a face-only close-up, not a full-body including heels.
curvy body; big breasts; slender waist.`,
  },
  {
    id: "T08",
    file: "half_q45_l",
    title: "半身-左45°",
    band: "半身",
    seed: 2026091108,
    camera: `Medium-wide vertical cowboy shot, camera at the front-left three-quarter angle, chest height, about three metres back. Frame from mid-thigh to a little headroom above the horn tips. Face still readable; both red horn tips visible; nylon bib and red slit lining visible at the thigh crop. She stands idle, body turned a little left of camera.
curvy body; big breasts; wide hips; slender waist.`,
  },
  {
    id: "T09",
    file: "half_profile_l",
    title: "半身-左侧面",
    band: "半身",
    seed: 2026091109,
    camera: `Medium vertical half-body, true left profile. Camera at chest height, about two and a half metres to her left. Frame from the waist / upper thigh to a little headroom above the horn tips. Nose and the nearer red eye readable. Sweetheart neckline and sheer black nylon bib in profile. Not a face-only close-up, not a full-body including heels.
curvy body; big breasts; slender waist.`,
  },
  {
    id: "T10",
    file: "half_back",
    title: "半身-背面",
    band: "半身",
    seed: 2026091110,
    camera: `Medium vertical half-body, back view. Camera at upper-back height about two and a half metres behind her. Frame from the hips to a little headroom above the horn tips. Back of the head, both horn roots, the fall of jet-black wavy hair, the back of the black gown. Face not required. No wings. Not a full-body including heels.
wide hips; slender waist.`,
  },
  {
    id: "T11",
    file: "face_front",
    title: "脸-正面",
    band: "脸",
    seed: 2026091111,
    camera: `Close-up vertical portrait. Camera at eye height, about one metre back. Frame from the upper chest / sheer black nylon bib up to a little headroom above the horn tips. Face fills the frame: two RED eyes sharply lit and in focus, pale skin, black-root red-tip horns, long wavy jet-black hair. Sweetheart neckline and nylon bib readable at the bottom edge. Not a full-body shot, not a side view.`,
  },
  {
    id: "T12",
    file: "face_profile_r",
    title: "脸-右侧面",
    band: "脸",
    seed: 2026091112,
    camera: `Close-up vertical portrait, true right profile. Camera at eye height, about one metre to her right. Frame from the nylon bib / collarbone up to a little headroom above the horn tips. Nose, lips, the nearer RED eye, pale skin, the nearer horn with BLACK root and RED tip, wavy black hair along the cheek. Not a full-body shot.`,
  },
  {
    id: "T13",
    file: "face_profile_l",
    title: "脸-左侧面",
    band: "脸",
    seed: 2026091113,
    camera: `Close-up vertical portrait, true left profile. Camera at eye height, about one metre to her left. Frame from the nylon bib / collarbone up to a little headroom above the horn tips. Nose, lips, the nearer RED eye, pale skin, the nearer horn with BLACK root and RED tip, wavy black hair along the cheek. Not a full-body shot.`,
  },
  {
    id: "T14",
    file: "ots_r",
    title: "过肩-右",
    band: "过肩",
    seed: 2026091114,
    camera: `Over-the-shoulder vertical shot from her right-back. Camera at neck height, standing behind her right shoulder. The character's back faces the camera; keep head and body on the same level. Frame the back of the head, both horn roots, the fall of jet-black wavy hair, the back of the black gown. A sliver of cheek or one red eye may show; face is not required. No wings, no tail.`,
  },
  {
    id: "T15",
    file: "ots_l",
    title: "过肩-左",
    band: "过肩",
    seed: 2026091115,
    camera: `Over-the-shoulder vertical shot from her left-back. Camera at neck height, standing behind her left shoulder. The character's back faces the camera; keep head and body on the same level. Frame the back of the head, both horn roots, the fall of jet-black wavy hair, the back of the black gown. A sliver of cheek or one red eye may show; face is not required. No wings, no tail.`,
  },
];

const NOTE = `# Krea 2 Turbo · Vf1 设定表（LoRA 备料）

**新建图，不是改 \`KREA2-Turbo-基础.json\`。** t2i，denoise 1，Enhancer **关**。不挂 IPA / OpenPose / 风格 LoRA。不要写 \`assets/frames/\`。

这张图把「全身 4 + 半身 6 + 脸 3 + 过肩 2」做成 **15 路可见节点**。  
**冻块（层 1 / 4 / 5）只有一份**，经 Concatenate 接到每一路。  
**层 2–3（镜头 + 裁切）每路重写**，改冻块会进全部机位。

## 衣套

现网尼龙包（黑高跟 / 薄黑尼龙 bib / 短尼龙手套 / 黑丝）。  
**不要和已过 B-lo（红高跟 + 蕾丝 bib）混炼。** 换衣套 = 只改左侧三个冻块，不要改 15 条镜头。

## 8GB 怎么跑

默认 **只开 T01**，其余 KSampler / Save / Encode **已静音**。  
要打哪一路：选中那一路的红色采样节点，\`Ctrl+M\` 解除静音。一次不要超过 **2 路**。每机位仍两枪封顶。

采样：Euler + simple，8 步，CFG 1，CLIP type=\`krea2\`，画布 **768×1280**。  
与 WAI / Wan **分 Queue**，换引擎 \`POST /free\`。

## 过目

只问零件表。换头 / 尖耳 / 金瞳 / 褐羊角 / 翼 / 尾 / 白内衣 / 红高跟 = 废，不进袋。  
文件名：\`vf1_nylon_Txx_…\`。不当 C 过，不替代已过 B-lo 印戳。

词表：\`tools/comfy-lan/workflows/vf1-krea-lora/prompts-sheet-v1.md\`
`;

function clone(n) {
  return JSON.parse(JSON.stringify(n));
}

function outSlot(node, name) {
  const i = node.outputs.findIndex((o) => o.name === name);
  if (i < 0) throw new Error(`no output ${name} on ${node.type}#${node.id}`);
  return i;
}

function inSlot(node, name) {
  const i = node.inputs.findIndex((inp) => inp.name === name);
  if (i < 0) throw new Error(`no input ${name} on ${node.type}#${node.id}`);
  return i;
}

function ensureLinks(output) {
  if (!Array.isArray(output.links)) output.links = [];
}

const base = JSON.parse(fs.readFileSync(src, "utf8"));
const byId = Object.fromEntries(base.nodes.map((n) => [n.id, n]));

const g = {
  id: "krea2-turbo-vf1-sheet",
  revision: 0,
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {
    ds: { scale: 0.55, offset: [620, 80] },
    frontendVersion: base.extra?.frontendVersion || "1.51.9",
  },
  version: 0.4,
};

let order = 0;
let linkId = 0;

function addNode(node) {
  node.order = order++;
  if (!node.flags) node.flags = {};
  if (!node.mode) node.mode = 0;
  g.nodes.push(node);
  g.last_node_id = Math.max(g.last_node_id, node.id);
  return node;
}

function link(fromNode, fromName, toNode, toName, type) {
  const fid = outSlot(fromNode, fromName);
  const tid = inSlot(toNode, toName);
  const id = ++linkId;
  g.links.push([id, fromNode.id, fid, toNode.id, tid, type]);
  const out = fromNode.outputs[fid];
  ensureLinks(out);
  out.links.push(id);
  toNode.inputs[tid].link = id;
  g.last_link_id = id;
  return id;
}

const note = clone(byId[1]);
note.title = "Krea 2 Turbo · Vf1 设定表（LoRA 备料）";
note.pos = [-1100, 40];
note.size = [520, 820];
note.widgets_values = [NOTE];
note.widgets_values_named = { text: NOTE };
addNode(note);

const unet = clone(byId[2]);
unet.pos = [-520, 40];
unet.outputs[0].links = [];
addNode(unet);

const enhancer = clone(byId[12]);
enhancer.pos = [-520, 160];
enhancer.widgets_values = [false, 1, 1, false];
enhancer.widgets_values_named.enabled = false;
enhancer.inputs.forEach((inp) => {
  if (inp.name !== "model") inp.link = null;
});
enhancer.outputs[0].links = [];
enhancer.title = "Krea2T Enhancer（必须关）";
addNode(enhancer);

const clip = clone(byId[3]);
clip.pos = [-520, 350];
clip.outputs[0].links = [];
addNode(clip);

const vae = clone(byId[4]);
vae.pos = [-520, 500];
vae.outputs[0].links = [];
addNode(vae);

const latent = clone(byId[7]);
latent.pos = [-520, 600];
latent.title = "768×1280 竖构图";
latent.widgets_values = [768, 1280, 1];
latent.widgets_values_named = { width: 768, height: 1280, batch_size: 1 };
latent.outputs[0].links = [];
addNode(latent);

function primitiveMultiline(id, title, text, pos, size) {
  return addNode({
    id,
    type: "PrimitiveStringMultiline",
    pos,
    size: size || [480, 280],
    flags: {},
    mode: 0,
    inputs: [],
    outputs: [
      {
        localized_name: "STRING",
        name: "STRING",
        type: "STRING",
        links: [],
      },
    ],
    title,
    properties: { "Node name for S&R": "PrimitiveStringMultiline" },
    widgets_values: [text],
    widgets_values_named: { value: text },
    color: "#323",
    bgcolor: "#535",
  });
}

function concatNode(id, title, pos) {
  return addNode({
    id,
    type: "StringConcatenate",
    pos,
    size: [280, 100],
    flags: {},
    mode: 0,
    inputs: [
      {
        localized_name: "string_a",
        name: "string_a",
        type: "STRING",
        widget: { name: "string_a" },
        link: null,
      },
      {
        localized_name: "string_b",
        name: "string_b",
        type: "STRING",
        widget: { name: "string_b" },
        link: null,
      },
      {
        localized_name: "delimiter",
        name: "delimiter",
        type: "STRING",
        widget: { name: "delimiter" },
        link: null,
      },
    ],
    outputs: [
      {
        localized_name: "STRING",
        name: "STRING",
        type: "STRING",
        links: [],
      },
    ],
    title,
    properties: { "Node name for S&R": "StringConcatenate" },
    widgets_values: ["", "", "\n\n"],
    widgets_values_named: { string_a: "", string_b: "", delimiter: "\n\n" },
  });
}

const l1 = primitiveMultiline(20, "冻块 · 层1 基本定义（共用）", LAYER1, [-520, 780], [
  480,
  160,
]);
const l4 = primitiveMultiline(21, "冻块 · 层4 服饰零件（共用 · 一字不改）", LAYER4, [-520, 980], [
  480,
  220,
]);
const l5 = primitiveMultiline(22, "冻块 · 层5 强调（共用）", LAYER5, [-520, 1240], [
  480,
  260,
]);
const freezeTail = concatNode(23, "冻块层4+层5", [-520, 1540]);

link(unet, "MODEL", enhancer, "model", "MODEL");
link(l4, "STRING", freezeTail, "string_a", "STRING");
link(l5, "STRING", freezeTail, "string_b", "STRING");

const encodeTmpl = clone(byId[5]);
const zeroTmpl = clone(byId[6]);
const samplerTmpl = clone(byId[8]);
const decodeTmpl = clone(byId[9]);
const saveTmpl = clone(byId[11]);

const COL_W = 860;
const ROW_H = 1120;
const ORIGIN_X = 80;
const ORIGIN_Y = 40;

const layout = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [0, 4],
  [1, 4],
];

const bandColor = {
  全身: "#3f789e",
  半身: "#3f789e",
  脸: "#a1309b",
  过肩: "#8AA",
};

SHOTS.forEach((shot, i) => {
  const [col, row] = layout[i];
  const gx = ORIGIN_X + col * COL_W;
  const gy = ORIGIN_Y + row * ROW_H;
  const baseId = 100 + i * 10;
  const muted = shot.id !== "T01";
  const muteMode = muted ? 2 : 0;

  g.groups.push({
    id: 10 + i,
    title: `${shot.id} ${shot.title}  ·  层2–3 只改这里${muted ? "  ·  默认静音 Ctrl+M" : "  ·  默认开"}`,
    bounding: [gx - 20, gy - 50, COL_W - 40, ROW_H - 60],
    color: bandColor[shot.band] || "#3f789e",
    flags: {},
  });

  const cam = primitiveMultiline(
    baseId,
    `${shot.id} 层2–3 镜头+裁切`,
    shot.camera,
    [gx, gy],
    [500, 300],
  );

  const c1 = concatNode(baseId + 1, `${shot.id} 层1+镜头`, [gx + 520, gy]);
  const c2 = concatNode(baseId + 2, `${shot.id} +冻块衣`, [gx + 520, gy + 140]);

  const encode = clone(encodeTmpl);
  encode.id = baseId + 3;
  encode.pos = [gx, gy + 340];
  encode.size = [500, 80];
  encode.mode = muteMode;
  encode.title = `${shot.id} CLIP encode`;
  encode.widgets_values = [""];
  encode.widgets_values_named = { text: "" };
  encode.outputs[0].links = [];
  const textIn = encode.inputs.find((inp) => inp.name === "text");
  textIn.link = null;
  const clipIn = encode.inputs.find((inp) => inp.name === "clip");
  clipIn.link = null;
  addNode(encode);

  const zero = clone(zeroTmpl);
  zero.id = baseId + 4;
  zero.pos = [gx + 520, gy + 340];
  zero.mode = muteMode;
  zero.title = `${shot.id} neg=zero`;
  zero.inputs[0].link = null;
  zero.outputs[0].links = [];
  addNode(zero);

  const sampler = clone(samplerTmpl);
  sampler.id = baseId + 5;
  sampler.pos = [gx, gy + 460];
  sampler.mode = muteMode;
  sampler.title = muted
    ? `${shot.id} 静音 · Ctrl+M 开`
    : `${shot.id} 8 step / CFG 1 / denoise 1`;
  sampler.widgets_values = [shot.seed, "increment", 8, 1, "euler", "simple", 1];
  sampler.widgets_values_named = {
    seed: shot.seed,
    control_after_generate: "increment",
    steps: 8,
    cfg: 1,
    sampler_name: "euler",
    scheduler: "simple",
    denoise: 1,
  };
  sampler.inputs.forEach((inp) => {
    if (["model", "positive", "negative", "latent_image"].includes(inp.name)) {
      inp.link = null;
    }
  });
  sampler.outputs[0].links = [];
  if (muted) {
    sampler.color = "#432";
    sampler.bgcolor = "#653";
  }
  addNode(sampler);

  const decode = clone(decodeTmpl);
  decode.id = baseId + 6;
  decode.pos = [gx + 340, gy + 460];
  decode.mode = muteMode;
  decode.inputs.forEach((inp) => {
    inp.link = null;
  });
  decode.outputs[0].links = [];
  addNode(decode);

  const save = clone(saveTmpl);
  save.id = baseId + 7;
  save.pos = [gx, gy + 780];
  save.size = [500, 120];
  save.mode = muteMode;
  save.title = `${shot.id} ${shot.title}`;
  const prefix = `vf1_nylon_${shot.id}_${shot.file}`;
  save.widgets_values = [prefix];
  save.widgets_values_named = { filename_prefix: prefix };
  save.inputs.find((inp) => inp.name === "images").link = null;
  save.outputs[0].links = [];
  addNode(save);

  link(l1, "STRING", c1, "string_a", "STRING");
  link(cam, "STRING", c1, "string_b", "STRING");
  link(c1, "STRING", c2, "string_a", "STRING");
  link(freezeTail, "STRING", c2, "string_b", "STRING");
  link(clip, "CLIP", encode, "clip", "CLIP");
  link(c2, "STRING", encode, "text", "STRING");
  link(encode, "CONDITIONING", sampler, "positive", "CONDITIONING");
  link(encode, "CONDITIONING", zero, "conditioning", "CONDITIONING");
  link(zero, "CONDITIONING", sampler, "negative", "CONDITIONING");
  link(enhancer, "model", sampler, "model", "MODEL");
  link(latent, "LATENT", sampler, "latent_image", "LATENT");
  link(sampler, "LATENT", decode, "samples", "LATENT");
  link(vae, "VAE", decode, "vae", "VAE");
  link(decode, "IMAGE", save, "images", "IMAGE");
});

g.groups.unshift(
  {
    id: 1,
    title: "模型（Krea 2 Turbo · 与 WAI 分 Queue）",
    bounding: [-540, 20, 540, 720],
    color: "#88A",
    flags: {},
  },
  {
    id: 2,
    title: "冻块（层1定义 · 层4零件 · 层5强调）改这里 = 15 路一起改",
    bounding: [-540, 750, 540, 920],
    color: "#a1309b",
    flags: {},
  },
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(g, null, 2) + "\n");

const md = `# Vf1 · LoRA 设定表词（v1）

工作流：\`KREA2-Turbo-Vf1-设定表.json\`  
引擎：Krea 2 Turbo t2i，denoise 1，768×1280，Enhancer 关。  
衣套：**尼龙包**（黑高跟）。不要和已过 B-lo 红高跟+蕾丝混炼。

图里 **层 1 / 4 / 5 是节点冻块**。下面全文只作对照；改衣只改 Comfy 左侧三个冻块。

## 冻块

### 层1 基本定义

\`\`\`
${LAYER1}
\`\`\`

### 层4 服饰零件（一字不改）

\`\`\`
${LAYER4}
\`\`\`

### 层5 强调

\`\`\`
${LAYER5}
\`\`\`

## 15 机位（层2–3）

${SHOTS.map(
  (s) => `### ${s.id} ${s.title}  \`${s.file}\`

\`\`\`
${s.camera}
\`\`\`
`,
).join("\n")}
`;

fs.writeFileSync(outMd, md);
console.log("wrote", outJson);
console.log("wrote", outMd);
console.log("nodes", g.nodes.length, "links", g.links.length, "groups", g.groups.length);
