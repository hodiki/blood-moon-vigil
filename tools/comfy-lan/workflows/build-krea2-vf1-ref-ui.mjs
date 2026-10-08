/**
 * Clone KREA2-Turbo-基础 UI graph: LoadImage + VAEEncode i2i, EmptyLatent muted.
 * Does not write frames/. Does not Queue.
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
const out = path.join(outDir, "KREA2-Turbo-Vf1-底图.json");

const IDENTITY = `Same woman as the reference image. One woman only, full body.

MUST KEEP these parts: two horns with BLACK roots and RED tips; two RED eyes; pale skin; long wavy jet-black hair past the shoulders; black evening gown with sweetheart neckline and a thin black lace bib / high collar; sheer black lace gloves on the forearms; high dress slit with RED lining; RED high heels.

Do not change the costume. No gold eyes, no brown ram horns, no bat wings, no demon tail, no pointed elf ears, no white lingerie, no white stockings, no barefoot.

Front full-body idle stand, arms down at the sides, looking at camera. Empty night void behind her. Professional illustration, sharp focus.`;

fs.mkdirSync(outDir, { recursive: true });
const g = JSON.parse(fs.readFileSync(src, "utf8"));
g.id = "krea2-turbo-vf1-ref";
g.last_node_id = 21;
g.last_link_id = 22;

const note = g.nodes.find((n) => n.id === 1);
note.title = "Krea 2 Turbo · Vf1 底图（LoRA 扩角）";
note.widgets_values[0] = `## Vf1 底图图

从 \`KREA2-Turbo-基础.json\` 复制，只加 LoadImage + VAEEncode。不挂 IPA / OpenPose / 风格 LoRA。Enhancer 默认可关。

### GPU 机先拷

1. 本 JSON → \`D:\\\\ComfyUI\\\\user\\\\default\\\\workflows\\\\KREA2-Turbo-Vf1-底图.json\`
2. \`vf1-clean.png\` → \`D:\\\\ComfyUI\\\\input\\\\vf1-clean.png\`
   （备用印戳 \`vf1-idle-stamp.png\` 也可，一次只用一张）

LoadImage 选 \`vf1-clean.png\`。提示词见同目录 \`prompts.md\`：身份段不动，只换机位段。

### 带底图（默认）

- LoadImage / VAEEncode **开**
- EmptyLatent **mute**（已 mute）
- denoise **0.55**（0.48 几乎不换机位；≥0.58 印戳上红高跟容易变黑，那枪丢掉）
- Euler + simple，8 步，CFG 1，CLIP type=krea2
- 不要开官方 prompt_enhance
- 与 WAI / SVD **分 Queue**，换引擎 \`POST /free\`

### 无底图

- mute LoadImage + VAEEncode
- unmute EmptyLatent（768×1280）
- denoise **1**
- 提示词仍用身份段 + 机位段。换人不收。

输出前缀 \`krea2_vf1_ref\`。不要写游戏 \`assets/frames/\`。
`;
note.widgets_values_named.text = note.widgets_values[0];

const sampler = g.nodes.find((n) => n.id === 8);
sampler.widgets_values = [2026091020, "increment", 8, 1, "euler", "simple", 0.55];
sampler.widgets_values_named.seed = 2026091020;
sampler.widgets_values_named.control_after_generate = "increment";
sampler.widgets_values_named.denoise = 0.55;
sampler.title = "8 steps / CFG 1 / denoise 0.55 i2i";
const latIn = sampler.inputs.find((i) => i.name === "latent_image");
latIn.link = 22;

const empty = g.nodes.find((n) => n.id === 7);
empty.mode = 2;
empty.title = "无底图时 unmute · 768x1280";
empty.outputs[0].links = null;
empty.widgets_values = [768, 1280, 1];
empty.widgets_values_named.width = 768;
empty.widgets_values_named.height = 1280;

const prompt = g.nodes.find((n) => n.id === 5);
prompt.widgets_values[0] = IDENTITY;
prompt.widgets_values_named.text = IDENTITY;
prompt.title = "Vf1 身份 + 机位（只换机位段）";

const save = g.nodes.find((n) => n.id === 11);
save.widgets_values[0] = "krea2_vf1_ref";
save.widgets_values_named.filename_prefix = "krea2_vf1_ref";

const enhancer = g.nodes.find((n) => n.id === 12);
enhancer.widgets_values[0] = false;
enhancer.widgets_values_named.enabled = false;

const vae = g.nodes.find((n) => n.id === 4);
vae.outputs[0].links = [3, 21];

g.nodes.push(
  {
    id: 20,
    type: "LoadImage",
    pos: [460, 560],
    size: [340, 340],
    flags: {},
    order: 3,
    mode: 0,
    inputs: [],
    outputs: [
      { localized_name: "图像", name: "IMAGE", type: "IMAGE", links: [20] },
      { localized_name: "蒙版", name: "MASK", type: "MASK", links: null },
    ],
    title: "Vf1 底图（input/vf1-clean.png）",
    properties: { "Node name for S&R": "LoadImage" },
    widgets_values: ["vf1-clean.png", "image"],
  },
  {
    id: 21,
    type: "VAEEncode",
    pos: [820, 560],
    size: [220, 50],
    flags: {},
    order: 4,
    mode: 0,
    inputs: [
      { localized_name: "像素", name: "pixels", type: "IMAGE", link: 20 },
      { localized_name: "vae", name: "vae", type: "VAE", link: 21 },
    ],
    outputs: [{ localized_name: "Latent", name: "LATENT", type: "LATENT", links: [22] }],
    title: "底图 → latent",
    properties: { "Node name for S&R": "VAEEncode" },
  },
);

g.links = g.links.filter((l) => l[0] !== 7);
g.links.push(
  [20, 20, 0, 21, 0, "IMAGE"],
  [21, 4, 0, 21, 1, "VAE"],
  [22, 21, 0, 8, 3, "LATENT"],
);

g.groups[0].title = "Krea 2 Turbo · Vf1 底图 i2i（Enhancer 默认关）";
g.groups[0].bounding = [0, 20, 1680, 920];

fs.writeFileSync(out, JSON.stringify(g, null, 2) + "\n");
console.log("wrote", out);
