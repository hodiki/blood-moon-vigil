/**
 * 图库首批总生成器（v1.2 §八）：8 批共 60 张 = 45 Qwen + 15 Krea。
 * 批次 a~g=7 主题×8 张（4 shot：Q+K / Q+K / Q+Q / Q+Q），h=sky(Q+K)+food 修复小样(Q,Q)。
 * 正式任务命名 {theme}-{seq:3d}；food 小样走 _sample-002。
 * 用法: node make-gallery-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'gallery-batch');
fs.rmSync(outDir, { recursive: true, force: true });
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

// 每主题 4 个首批 shot（★ 选题，来自标准 v1.2 §六）
const THEMES = {
  cat: {
    batch: 'a',
    shots: [
      { zh: '一只橘色虎斑猫在木质窗台上打盹，柔和的晨光洒入，窗边有盆栽绿植', en: 'an orange tabby cat napping on a wooden windowsill in soft morning light, potted green plants beside' },
      { zh: '一只奶白色小猫在地毯上打哈欠伸懒腰，前爪前伸屁股翘起，午后阳光，旁边有一只毛线球', en: 'a cream kitten yawning and stretching on a rug, front paws forward and rump up, afternoon sunlight, a yarn ball beside' },
      { zh: '一只灰蓝色的猫埋在柔软的毯子里熟睡，只露出毛茸茸的尾巴尖和一小撮耳朵，暖色调卧室角落', en: 'a grey-blue cat sleeping buried in a soft blanket with only a fluffy tail tip and ears showing, warm cozy bedroom corner' },
      { zh: '一只橘猫贴在玻璃窗内侧看窗外的小红鸟，玻璃上留着两个爪印，窗外有绿树', en: 'an orange cat pressing against the inside of a glass window watching a small red bird outside, paw prints on the glass, green trees outside' },
    ],
  },
  scene: {
    batch: 'b',
    shots: [
      { zh: '黄昏时分湖边的小木屋，暖黄窗灯亮起，湖面有清晰的倒影，天边晚霞呈雾霾蓝与鹅黄渐变，岸边有芦苇与小船', en: 'a small lakeside wooden cabin at dusk with warm glowing windows and calm water reflections, reeds and a tiny rowboat at the shore, dusk sky in misty blue and honey yellow' },
      { zh: '雪夜中的山间小镇，屋顶覆雪，家家户户透出温暖的橙黄灯火，街角亮着一盏路灯，深蓝色雪夜天空', en: 'a mountain village on a snowy night, snow-covered rooftops with warm orange glowing windows, a glowing street lamp at the corner, deep blue snowy sky' },
      { zh: '春日樱花盛开的石板小巷，粉色花瓣飘落，巷子尽头有暖光的小店，石板缝里长出青苔', en: 'a spring stone-paved alley lined with blooming cherry blossoms, pink petals drifting down, a warm-lit little shop at the end of the alley' },
      { zh: '月夜下的湖心中式凉亭，圆月倒映在平静湖面，亭子挂着一盏暖黄灯笼，两三只飞鸟掠过月前', en: 'a Chinese pavilion on a calm lake under the moon, full moon reflected on the water, a warm lantern hanging in the pavilion, birds flying across the moon' },
    ],
  },
  flower: {
    batch: 'c',
    shots: [
      { zh: '一只玻璃瓶里插着粉白色郁金香花束，放在木质小桌上，几片花瓣落在桌面，背景干净', en: 'a bouquet of pink and white tulips in a glass vase on a wooden table, a few petals fallen on the table, clean background' },
      { zh: '阳台角落的一盆蓝紫色绣球花，陶土色花盆，旁边有浇水壶与园艺手套', en: 'a blue-purple hydrangea plant in a terracotta pot at a balcony corner, a watering can and gardening gloves beside' },
      { zh: '郁金香花田与远处的小风车，粉色黄色蓝色郁金香成排种植，蓝天白云', en: 'rows of pink yellow and blue tulip fields with a small windmill in the distance, blue sky and white clouds' },
      { zh: '窗台上一排形态各异的多肉植物小花盆，阳光斜照，窗台木纹清晰', en: 'a row of small succulent pots in various shapes on a windowsill, slanted sunlight, clear wood grain' },
    ],
  },
  ocean: {
    batch: 'd',
    shots: [
      { zh: '浅海中一群发光的粉蓝色水母缓缓漂浮，光斑点点，海草在底部摇曳', en: 'a group of glowing pink-blue jellyfish drifting in shallow sea water, sparkling light dots, seaweed swaying at the bottom' },
      { zh: '一头圆润友好的蓝色大鲸鱼游过深海，身边升起一串气泡，远处有小鱼群', en: 'a round friendly blue whale swimming in the deep sea, a trail of bubbles rising beside it, a small fish school in the distance' },
      { zh: '热带鱼群在彩色珊瑚礁间穿行，橙黄条纹小鱼，珊瑚呈陶土橘与豆绿', en: 'tropical fish swimming among colorful coral reefs, orange striped fish, corals in terracotta and sage green' },
      { zh: '沙滩浅水边的贝壳与一只红色海星，湿润沙滩上有浪花痕迹，周围散落小贝壳', en: 'seashells and a red starfish on wet sand by shallow waves, wave traces on the sand, small shells scattered around' },
    ],
  },
  animals: {
    batch: 'e',
    shots: [
      { zh: '一只圆滚滚的熊猫宝宝坐在草地上抱着竹子啃，身边散落竹叶', en: 'a round chubby panda cub sitting on grass munching bamboo, bamboo leaves scattered around' },
      { zh: '一只长耳朵白兔坐在木栅栏边啃胡萝卜，耳朵上停着一只小蝴蝶', en: 'a white rabbit with long ears nibbling a carrot by a wooden fence, a small butterfly resting on its ear' },
      { zh: '一只笑眯眯的柴犬坐在飘落的秋叶中，尾巴卷起，叶色暖橙', en: 'a smiling shiba inu sitting among falling autumn leaves, curled tail, warm orange leaf colors' },
      { zh: '两只小企鹅在冰面上溜冰，一只滑行一只张开翅膀保持平衡，冰面有滑冰划痕', en: 'two little penguins skating on ice, one gliding and one balancing with spread wings, skate marks on the ice' },
    ],
  },
  night: {
    batch: 'f',
    shots: [
      { zh: '星河下的湖畔帐篷，紫色星空与银河横贯天际，湖面倒映星光，帐篷透出暖光', en: 'a lakeside tent under the galaxy, purple starry sky with the milky way, starlight reflected on the lake, warm light glowing from the tent' },
      { zh: '一座带烟囱的小木屋坐落在弯月上，窗外透出暖光，周围星星点缀，深蓝夜空', en: 'a small wooden cottage with a chimney sitting on a crescent moon, warm light from the window, stars around, deep blue night sky' },
      { zh: '一只热气球夜航在星空下，吊篮里挂着一盏暖黄灯，远处是山峦剪影', en: 'a hot air balloon floating under the starry night sky, a warm yellow lantern in the basket, distant mountain silhouettes' },
      { zh: '雪夜村庄上空舞动的绿色极光，屋顶积雪，几扇窗透出暖橙灯光', en: 'green aurora dancing above a snowy village at night, snow-covered roofs, warm orange light from a few windows' },
    ],
  },
  desk: {
    batch: 'g',
    shots: [
      { zh: '书桌上摞起的旧书与一盏亮着暖光的绿色台灯，旁边一杯冒着热气的咖啡', en: 'a stack of old books on a desk with a warm glowing green lamp, a steaming cup of coffee beside' },
      { zh: '摊开的信纸与钢笔，旁边一杯拿铁与几颗方糖，午后阳光斜照', en: 'an open letter paper with a fountain pen, a latte and sugar cubes beside, slanted afternoon sunlight' },
      { zh: '午后阳光洒进的书桌角落，有小绿植、闹钟与散放的铅笔，光斑落在木桌上', en: 'a desk corner in afternoon sunlight with a small plant, an alarm clock and scattered pencils, light spots on the wooden desk' },
      { zh: '一台复古打字机与插着干花的小瓶，纸张半卷在打字机上', en: 'a vintage typewriter with a small vase of dried flowers, a half-rolled paper in the typewriter' },
    ],
  },
  sky: {
    batch: 'h',
    shots: [
      { zh: '草原上空跨着一道大彩虹，白云朵朵，几只圆滚滚的绵羊在草地上吃草', en: 'a big rainbow across the sky over a grassland, fluffy clouds, round sheep grazing below' },
    ],
  },
};

const FOODFIX = {
  batch: 'h',
  shots: [
    { zh: '一块草莓奶油蛋糕放在深陶土色小圆盘上，45 度微俯视，旁边一把小叉子与一颗完整草莓，背景为统一的浅奶油纯色，主体与背景明度分明', en: 'a slice of strawberry cream cake on a small deep terracotta plate, 45-degree top-down view, a small fork and one whole strawberry beside, unified light cream plain background with clear subject-background contrast' },
    { zh: '一杯热可可盛在深可可棕色马克杯里，顶部漂浮三颗棉花糖，旁边两块小饼干，45 度微俯视，背景为统一的浅奶油纯色，主体与背景明度分明', en: 'a cup of hot cocoa in a deep cocoa-brown mug with three marshmallows on top and two small cookies beside, 45-degree top-down view, unified light cream plain background with clear subject-background contrast' },
  ],
};

// 任务展开：7 主题 × 8（Q+K / Q+K / Q+Q / Q+Q）+ sky(Q+K) + foodfix(Q,Q)
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

const tasks = [];
let seedCounter = 2026101015;
function addTask({ batch, theme, seq, engine, shotIdx, subjectZh, subjectEn, isFoodfix }) {
  const seed = seedCounter++;
  const prefix = isFoodfix ? `h_foodfix_${String(seq).padStart(3, '0')}` : `${batch}_${theme}_${String(seq).padStart(3, '0')}`;
  let wf;
  let prompt;
  let neg;
  if (engine === 'qwen') {
    prompt = `扁平治愈系插画，${subjectZh}，${ZH_STYLE}`;
    neg = ZH_NEG;
    wf = qwenTemplate();
    wf['4'].inputs.prompt = prompt;
    wf['4'].inputs.negative_prompt = neg;
    wf['5'].inputs.seed = seed;
    wf['7'].inputs.filename_prefix = prefix;
  } else {
    prompt = `Flat healing illustration, ${subjectEn}, ${EN_STYLE}`;
    neg = EN_NEG;
    wf = JSON.parse(JSON.stringify(kreaBase));
    wf['5'].inputs.text = prompt;
    wf['8'].inputs.seed = seed;
    wf['11'].inputs.filename_prefix = prefix;
  }
  const id = `${prefix}`;
  const file = path.join(outDir, `${id}.api.json`);
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  tasks.push({
    id, batch, theme, seq, engine, shot: shotIdx, seed, prefix,
    prompt, negative_prompt: neg,
    model: engine === 'qwen' ? 'qwen_image_2.1_int8_convrot.safetensors' : 'krea2_turbo_int8_convrot.safetensors',
    workflow: path.basename(file),
    is_foodfix: !!isFoodfix,
  });
}

for (const [theme, t] of Object.entries(THEMES)) {
  const s = t.shots;
  if (s.length === 1) {
    // sky：1 shot → Q + K
    addTask({ batch: t.batch, theme, seq: 1, engine: 'qwen', shotIdx: 1, subjectZh: s[0].zh, subjectEn: s[0].en });
    addTask({ batch: t.batch, theme, seq: 2, engine: 'krea', shotIdx: 1, subjectZh: s[0].zh, subjectEn: s[0].en });
    continue;
  }
  let seq = 1;
  s.forEach((shot, i) => {
    const shotIdx = i + 1;
    if (i < 2) {
      addTask({ batch: t.batch, theme, seq: seq++, engine: 'qwen', shotIdx, subjectZh: shot.zh, subjectEn: shot.en });
      addTask({ batch: t.batch, theme, seq: seq++, engine: 'krea', shotIdx, subjectZh: shot.zh, subjectEn: shot.en });
    } else {
      addTask({ batch: t.batch, theme, seq: seq++, engine: 'qwen', shotIdx, subjectZh: shot.zh, subjectEn: shot.en });
      addTask({ batch: t.batch, theme, seq: seq++, engine: 'qwen', shotIdx, subjectZh: shot.zh, subjectEn: shot.en });
    }
  });
}
FOODFIX.shots.forEach((shot, i) => {
  addTask({ batch: 'h', theme: 'food', seq: i + 1, engine: 'qwen', shotIdx: i + 1, subjectZh: shot.zh, subjectEn: shot.en, isFoodfix: true });
});

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(tasks, null, 2));
const qwenList = tasks.filter((t) => t.engine === 'qwen').map((t) => t.workflow);
const kreaList = tasks.filter((t) => t.engine === 'krea').map((t) => t.workflow);
fs.writeFileSync(path.join(outDir, 'qwen-list.txt'), qwenList.join('\n'));
fs.writeFileSync(path.join(outDir, 'krea-list.txt'), kreaList.join('\n'));
console.log(`tasks=${tasks.length} qwen=${qwenList.length} krea=${kreaList.length} seeds=${2026101015}..${seedCounter - 1}`);
