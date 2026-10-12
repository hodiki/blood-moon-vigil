/**
 * 图库小样批次 _sample-001：3 主题 × shot#1 × 双引擎 = 6 张。
 * 风格锚 gate 用：跑完交主理人过目冻结，未冻结不得批量。
 * 用法: node make-gallery-samples.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'gallery-samples');
fs.mkdirSync(outDir, { recursive: true });

const kreaBase = JSON.parse(fs.readFileSync(path.join(here, 'krea2-turbo-t2i-api.json'), 'utf8'));

const ZH_STYLE =
  '柔和淡彩配色（奶油白、暖米、陶土橘、雾霾蓝、豆绿、浅粉、鹅黄、可可棕），圆润柔和的形体，干净的矢量风着色，温馨绘本氛围，居中构图，细节在整个画面均匀分布且密度适中，无任何文字，无水印，无 logo，无人类';
const EN_STYLE =
  'warm pastel palette (cream white, warm beige, soft terracotta, misty blue, sage green, blush pink, honey yellow, cocoa brown), soft rounded shapes, clean vector-style shading, cozy storybook atmosphere, centered composition, balanced details across the whole canvas, no text, no watermark, no logo, no humans';

const ZH_NEG =
  '文字, 字母, 数字, 水印, 签名, logo, 边框, 人类, 真实人脸, 照片写实, 3D 渲染, 黑暗恐怖, 血腥, 品牌角色, 名人, 有版权的角色, 国旗, 宗教符号, 政治符号, 低质量';
const EN_NEG =
  'text, watermark, signature, logo, border, human, realistic face, photorealistic, 3D render, dark horror, gore, brand characters, celebrity, copyrighted characters, national flag, religious symbols, political symbols, low quality';

const SUBJECTS = {
  cat: {
    seq: 1,
    subjectZh: '一只橘色虎斑猫在木质窗台上打盹，柔和的晨光洒入，窗边有盆栽绿植',
    subjectEn:
      'an orange tabby cat napping on a wooden windowsill in soft morning light, potted green plants beside',
  },
  scene: {
    seq: 1,
    subjectZh:
      '黄昏时分湖边的小木屋，暖黄窗灯亮起，湖面有清晰的倒影，天边晚霞呈雾霾蓝与鹅黄渐变，岸边有芦苇与小船',
    subjectEn:
      'a small lakeside wooden cabin at dusk with warm glowing windows and calm water reflections, reeds and a tiny rowboat at the shore, dusk sky in misty blue and honey yellow',
  },
  food: {
    seq: 1,
    subjectZh:
      '木桌上的草莓奶油蛋糕下午茶，切开的草莓奶油蛋糕、茶壶与茶杯、几颗新鲜草莓点缀，浅粉与奶油白为主调',
    subjectEn:
      'a strawberry cream cake afternoon tea set on a wooden table, sliced strawberry shortcake, teapot with cups and fresh strawberries, blush pink and cream white tones',
  },
};

// Qwen-Image 2.1 原生 T2I 链（同头像批次已验证）
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

const JOBS = [
  { id: 'sample-cat-qwen', theme: 'cat', engine: 'qwen', seed: 2026101009, prefix: 'sample_cat_qwen' },
  { id: 'sample-scene-qwen', theme: 'scene', engine: 'qwen', seed: 2026101011, prefix: 'sample_scene_qwen' },
  { id: 'sample-food-qwen', theme: 'food', engine: 'qwen', seed: 2026101013, prefix: 'sample_food_qwen' },
  { id: 'sample-cat-krea', theme: 'cat', engine: 'krea', seed: 2026101010, prefix: 'sample_cat_krea' },
  { id: 'sample-scene-krea', theme: 'scene', engine: 'krea', seed: 2026101012, prefix: 'sample_scene_krea' },
  { id: 'sample-food-krea', theme: 'food', engine: 'krea', seed: 2026101014, prefix: 'sample_food_krea' },
];

const manifest = [];
for (const job of JOBS) {
  const s = SUBJECTS[job.theme];
  let wf;
  let prompt;
  let neg;
  if (job.engine === 'qwen') {
    prompt = `扁平治愈系插画，${s.subjectZh}，${ZH_STYLE}`;
    neg = ZH_NEG;
    wf = qwenTemplate();
    wf['4'].inputs.prompt = prompt;
    wf['4'].inputs.negative_prompt = neg;
    wf['5'].inputs.seed = job.seed;
    wf['7'].inputs.filename_prefix = job.prefix;
  } else {
    prompt = `Flat healing illustration, ${s.subjectEn}, ${EN_STYLE}`;
    neg = EN_NEG;
    wf = JSON.parse(JSON.stringify(kreaBase));
    wf['5'].inputs.text = prompt;
    wf['8'].inputs.seed = job.seed;
    wf['11'].inputs.filename_prefix = job.prefix;
  }
  const file = path.join(outDir, `${job.id}.api.json`);
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  manifest.push({
    id: job.id,
    batch: 'sample-001',
    theme: job.theme,
    engine: job.engine,
    model: job.engine === 'qwen' ? 'qwen_image_2.1_int8_convrot.safetensors' : 'krea2_turbo_int8_convrot.safetensors',
    seed: job.seed,
    prefix: job.prefix,
    subject: s.subjectZh,
    prompt,
    negative_prompt: neg,
    workflow: path.basename(file),
  });
}
fs.writeFileSync(path.join(outDir, 'samples.json'), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} sample job workflows -> ${outDir}`);
