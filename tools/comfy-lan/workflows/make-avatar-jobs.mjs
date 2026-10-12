/**
 * 拼图小游戏头像批次 · 2026-10-10
 * 从两份基础 API 工作流烘焙 8 份任务 JSON（A/B/C/D × qwen/krea）。
 * 用法: node make-avatar-jobs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'avatar');
fs.mkdirSync(outDir, { recursive: true });

const qwenBase = null; // 融合模板节点 API 不可用，改用原生链
const kreaBase = JSON.parse(fs.readFileSync(path.join(here, 'krea2-turbo-t2i-api.json'), 'utf8'));

// Qwen-Image 2.1 原生 T2I 链：TextEncodeQwenImage21 一次产出 pos/neg 条件与空 latent
// （comfy_extras/nodes_qwen；已核对 GPU /object_info 枚举：UNETLoader 收 int8_convrot，CLIPLoader type=qwen_image）
function qwenTemplate() {
  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'qwen_image_2.1_int8_convrot.safetensors', weight_dtype: 'default' }, _meta: { title: 'UNETLoader' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_8b_w4a8.safetensors', type: 'qwen_image', device: 'cpu' }, _meta: { title: 'CLIPLoader' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' }, _meta: { title: 'VAELoader' } },
    '4': { class_type: 'TextEncodeQwenImage21', inputs: { clip: ['2', 0], prompt: '', negative_prompt: '', resolution: 1024 }, _meta: { title: 'TextEncodeQwenImage21' } },
    '5': { class_type: 'KSampler', inputs: { seed: 0, steps: 40, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1, model: ['1', 0], positive: ['4', 0], negative: ['4', 1], latent_image: ['4', 2] }, _meta: { title: 'KSampler' } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['3', 0] }, _meta: { title: 'VAEDecode' } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: '' }, _meta: { title: 'SaveImage' } },
  };
}

const ZH_NEG =
  '文字, 字母, 数字, 水印, 签名, logo, 边框, 真实人物, 人脸, 写实照片, 复杂背景, 多主体堆叠, 暗色调, 恐怖, 低对比, 模糊, 变形的拼图块, 错误的拼图形状, 多余的拼图凸起, 低质量';

const DIRS = {
  A: {
    zh: 'App 图标设计，一枚圆润的拼图块居中放置，主体占画面约 65%。拼图块为暖金色到蜜桃橙的柔和渐变，边缘圆润，顶部有一道柔和的余晖光晕，仿佛刚刚被拾起还带着温度。扁平插画风格，带轻微软 3D 质感与细腻颗粒肌理。背景为纯净的奶油白色，拼图块底部有一小片柔和的椭圆投影。整体为顶部柔光照明，无强烈明暗对比。配色限定：暖金、蜜桃橙、奶油白。画面干净简洁，无任何文字，无边框，治愈感。',
    en: 'App icon design: a single rounded jigsaw puzzle piece centered in frame, occupying about 65% of the canvas. The piece has a soft gradient from warm gold to peach orange, smooth rounded edges, with a gentle afterglow halo above it, as if just picked up and still warm. Flat illustration style with subtle soft-3D depth and fine grain texture. Clean creamy off-white background, a small soft elliptical drop shadow beneath the piece. Soft top lighting, no harsh contrast. Restricted palette: warm gold, peach orange, cream white. Minimal and clean, no text, no border, soothing mood. Square 1:1, high resolution.',
  },
  B: {
    zh: 'App 图标设计，一枚拼图块形状的取景框居中放置，主体占画面约 70%。拼图块内部是一幅微缩治愈场景：黄昏时分的窗台，一轮暖橙色落日悬在窗边，一小只猫的圆润剪影坐在窗台望向落日，两三粒光斑漂浮。拼图块外部为纯净的奶油米色背景。扁平插画风格，配色限定：暖橙、蜜桃、奶油白、少量暮色淡紫。外轮廓圆润清晰，无任何文字，无边框，治愈感。',
    en: 'App icon design: a jigsaw-puzzle-piece shaped frame centered in composition, occupying about 70% of the canvas. Inside the piece, a miniature cozy scene: a windowsill at dusk, a warm orange setting sun by the window, a small round silhouette of a cat sitting on the sill gazing at it, two or three floating light bokeh dots. Outside the puzzle piece, a clean creamy beige background. Flat illustration style. Restricted palette: warm orange, peach, cream white, a touch of dusk lavender. Rounded clear silhouette, no text, no border, soothing mood. Square 1:1.',
  },
  C: {
    zh: 'App 图标设计，三到四枚圆角拼图块悬浮在画面中央，正在拼合成一轮温暖的圆月，中央留出一个拼图块形状的缺口，缺口处透出柔和的金色光芒，几粒细小光尘漂浮。主体占画面约 65%。扁平插画风格带轻微软 3D 质感，背景为纯净的奶油米色，柔和均匀照明。配色限定：暖金、奶油白、淡杏色。无任何文字，无边框，治愈感。',
    en: 'App icon design: three to four rounded jigsaw puzzle pieces floating at the center, assembling into a warm glowing full moon, with one puzzle-piece-shaped gap left at the middle where soft golden light shines through, a few tiny dust particles floating. Subject occupies about 65% of the canvas. Flat illustration with subtle soft-3D depth, clean creamy beige background, soft even lighting. Restricted palette: warm gold, cream white, pale apricot. No text, no border, soothing mood. Square 1:1.',
  },
  D: {
    zh: 'App 图标设计，一只圆滚滚的奶橘色小猫居中，主体占画面约 70%。小猫呈 chibi 比例，眯眼幸福微笑，双爪抱着一枚发光的金色拼图块，拼图块的光轻轻映在小猫脸上。扁平插画风格带柔和立体感，背景为纯净的奶油白色，顶部柔光。配色限定：奶橘、奶油白、暖金。无任何文字，无边框，治愈可爱。',
    en: 'App icon design: a round chubby cream-orange kitten centered, occupying about 70% of the canvas. Chibi proportions, happily squinting smile, hugging a glowing golden jigsaw puzzle piece whose light softly reflects on its face. Flat illustration with soft 3D feel, clean cream-white background, soft top lighting. Restricted palette: cream orange, cream white, warm gold. No text, no border, cute and soothing. Square 1:1.',
  },
};

// 每方向两张：1 张 Qwen-Image 2.1（非二次元主力）+ 1 张 Krea 2 Turbo
const JOBS = [
  { id: 'a1-qwen', dir: 'A', engine: 'qwen', seed: 2026101001, prefix: 'avatar_A1_qwen' },
  { id: 'b1-qwen', dir: 'B', engine: 'qwen', seed: 2026101003, prefix: 'avatar_B1_qwen' },
  { id: 'c1-qwen', dir: 'C', engine: 'qwen', seed: 2026101005, prefix: 'avatar_C1_qwen' },
  { id: 'd1-qwen', dir: 'D', engine: 'qwen', seed: 2026101007, prefix: 'avatar_D1_qwen' },
  { id: 'a2-krea', dir: 'A', engine: 'krea', seed: 2026101002, prefix: 'avatar_A2_krea' },
  { id: 'b2-krea', dir: 'B', engine: 'krea', seed: 2026101004, prefix: 'avatar_B2_krea' },
  { id: 'c2-krea', dir: 'C', engine: 'krea', seed: 2026101006, prefix: 'avatar_C2_krea' },
  { id: 'd2-krea', dir: 'D', engine: 'krea', seed: 2026101008, prefix: 'avatar_D2_krea' },
];

const manifest = [];
for (const job of JOBS) {
  const dir = DIRS[job.dir];
  let wf;
  if (job.engine === 'qwen') {
    wf = qwenTemplate();
    wf['4'].inputs.prompt = dir.zh;
    wf['4'].inputs.negative_prompt = ZH_NEG;
    wf['5'].inputs.seed = job.seed;
    wf['7'].inputs.filename_prefix = job.prefix;
  } else {
    wf = JSON.parse(JSON.stringify(kreaBase));
    wf['5'].inputs.text = dir.en;
    wf['8'].inputs.seed = job.seed;
    wf['11'].inputs.filename_prefix = job.prefix;
  }
  const file = path.join(outDir, `avatar-${job.id}.api.json`);
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  manifest.push({
    id: job.id,
    dir: job.dir,
    engine: job.engine,
    seed: job.seed,
    prefix: job.prefix,
    workflow: path.basename(file),
    positive: job.engine === 'qwen' ? dir.zh : dir.en,
    negative: job.engine === 'qwen' ? ZH_NEG : '(ConditioningZeroOut, cfg=1)',
  });
}
fs.writeFileSync(path.join(outDir, 'jobs.json'), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} job workflows -> ${outDir}`);
