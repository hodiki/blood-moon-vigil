/**
 * 重抽+优化批（5 张全 Qwen，seed 2026101075~79）：
 * - desk-009 / night-009 / scene-009：不过图重抽（提示词针对性强化，night 夜空特化、scene 换 Qwen）
 * - sample-foodfix-003/004：food 环境优化 v2（加中景环境层次，保持浅底分离）
 * 用法: node make-retry-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'retry-batch');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const ZH_STYLE =
  '柔和淡彩配色（奶油白、暖米、陶土橘、雾霾蓝、豆绿、浅粉、鹅黄、可可棕），圆润柔和的形体，干净的矢量风着色，温馨绘本氛围，居中构图，细节在整个画面均匀分布且密度适中，无任何文字，无水印，无 logo，无人类';
const ZH_NEG =
  '文字, 字母, 数字, 水印, 签名, logo, 边框, 人类, 真实人脸, 照片写实, 3D 渲染, 黑暗恐怖, 血腥, 品牌角色, 名人, 有版权的角色, 国旗, 宗教符号, 政治符号, 大面积纯色空底, 低质量';

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
  {
    id: 'r_desk_009', theme: 'desk', seq: 9, seed: 2026101075,
    subject: '午后阳光洒进的书桌角落，桌面上有摊开的书本、小绿植、闹钟、散放的彩色铅笔与一杯冒着热气的茶，暖黄色光斑洒在木质桌面上，背景是浅色墙面与窗边一角，物品错落有致铺满画面，细节丰富',
  },
  {
    id: 'r_night_009', theme: 'night', seq: 9, seed: 2026101076,
    subject: '深夜星空下，一只热气球缓缓飘过山谷，深蓝紫色的夜空中缀满亮星与淡淡银河，热气球吊篮里挂着一盏发光的暖黄灯笼，暖橙灯光与深蓝夜空形成温柔的对比，远处山峦是深色剪影，山脚下小镇有点点灯火',
  },
  {
    id: 'r_scene_009', theme: 'scene', seq: 9, seed: 2026101077,
    subject: '雪夜中的山间小镇，屋顶覆盖着厚厚的白雪，家家户户的窗户透出温暖的橙黄灯火，一条积雪的小路蜿蜒穿过小镇，路旁立着一盏亮着暖光的街灯，天空深蓝飘着雪花，远处山坡上有几棵积雪的松树，小镇有近景中景远景的层次',
  },
  {
    id: 'r_foodfix_003', theme: 'food', seq: 3, seed: 2026101078, foodfix: true,
    subject: '一块草莓奶油蛋糕放在深陶土色小圆盘上，45 度微俯视，旁边一把小叉子与一颗完整草莓，蛋糕放在铺着米色格纹餐垫的木质桌面上，背景可见虚化的暖色窗光与小绿植，环境温馨有层次，背景整体仍是浅色调且不抢主体',
  },
  {
    id: 'r_foodfix_004', theme: 'food', seq: 4, seed: 2026101079, foodfix: true,
    subject: '一杯热可可盛在深可可棕色马克杯里，顶部漂浮三颗棉花糖，旁边一小碟两块曲奇饼干，杯子放在铺着米色格纹餐垫的木质桌面上，背景可见虚化的暖色台灯与小书堆，环境温馨有层次，背景整体仍是浅色调且不抢主体',
  },
];

const manifest = [];
for (const job of JOBS) {
  const wf = qwenTemplate();
  const prompt = `扁平治愈系插画，${job.subject}，${ZH_STYLE}`;
  wf['4'].inputs.prompt = prompt;
  wf['4'].inputs.negative_prompt = ZH_NEG;
  wf['5'].inputs.seed = job.seed;
  wf['7'].inputs.filename_prefix = job.id;
  const file = path.join(outDir, `${job.id}.api.json`);
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  manifest.push({
    id: job.id, batch: job.foodfix ? 'sample-002' : 'retry-20261010', theme: job.theme, seq: job.seq,
    engine: 'qwen', model: 'qwen_image_2.1_int8_convrot.safetensors', seed: job.seed,
    prefix: job.id, prompt, negative_prompt: ZH_NEG,
    workflow: path.basename(file), is_foodfix: !!job.foodfix,
  });
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'qwen-list.txt'), manifest.map((m) => m.workflow).join('\n'));
console.log(`wrote ${manifest.length} retry/optimization tasks`);
