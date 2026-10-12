/**
 * Backfill subject (选题名) into raw sidecars from the shot-list mapping, then pipeline re-ingest
 * regenerates manifest with subject populated.
 * 用法: node backfill-subject.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const RAW = 'D:/code/WechatMiniProgram/shiguang-pintu/assets/pipeline/raw';

const SUBJ = {
  'cat-001': '窗台打盹的橘猫（晨光）', 'cat-002': '窗台打盹的橘猫（晨光）',
  'cat-003': '打哈欠伸懒腰的猫', 'cat-004': '打哈欠伸懒腰的猫',
  'cat-005': '埋在毯子里只露尾巴的猫', 'cat-006': '埋在毯子里只露尾巴的猫',
  'cat-007': '贴玻璃窗看鸟的猫', 'cat-008': '贴玻璃窗看鸟的猫',
  'scene-001': '黄昏湖边小木屋与倒影', 'scene-002': '黄昏湖边小木屋与倒影',
  'scene-003': '雪夜小镇的温暖灯火', 'scene-005': '春日樱花小巷', 'scene-006': '春日樱花小巷',
  'scene-007': '湖心亭月夜', 'scene-008': '湖心亭月夜', 'scene-009': '雪夜小镇的温暖灯火（重抽）',
  'flower-001': '玻璃瓶花束（粉白郁金香）', 'flower-002': '玻璃瓶花束（粉白郁金香）',
  'flower-003': '绣球花盆栽角落', 'flower-004': '绣球花盆栽角落',
  'flower-005': '郁金香花田与风车', 'flower-006': '郁金香花田',
  'flower-007': '多肉植物窗台一排', 'flower-008': '多肉植物窗台一排',
  'ocean-001': '发光水母群', 'ocean-002': '发光水母群',
  'ocean-003': '蓝鲸与气泡', 'ocean-004': '蓝鲸与气泡',
  'ocean-005': '热带鱼与珊瑚礁', 'ocean-006': '珊瑚礁鱼群',
  'ocean-007': '贝壳海星与浪花', 'ocean-008': '贝壳海星',
  'animals-001': '抱竹子啃的熊猫', 'animals-002': '熊猫',
  'animals-003': '长耳朵兔子与胡萝卜', 'animals-004': '兔子',
  'animals-005': '柴犬与落叶', 'animals-006': '柴犬',
  'animals-007': '双企鹅溜冰', 'animals-008': '企鹅溜冰',
  'night-001': '星河下的湖畔帐篷与倒影', 'night-002': '星河湖畔帐篷',
  'night-003': '弯月上的小屋与星光', 'night-004': '弯月上的小屋',
  'night-006': '夜航的热气球与星星', 'night-007': '雪夜极光村庄', 'night-008': '雪夜极光村庄',
  'night-009': '夜航的热气球与星星（重抽）',
  'desk-001': '书堆与暖光台灯', 'desk-002': '书堆与暖光台灯',
  'desk-003': '信纸钢笔与咖啡', 'desk-004': '信纸钢笔与咖啡',
  'desk-006': '午后阳光的书桌角落', 'desk-007': '复古打字机', 'desk-008': '复古打字机与干花',
  'desk-009': '午后阳光的书桌角落（重抽）',
  'sky-001': '草原上的大彩虹与云朵羊群', 'sky-002': '草原上的大彩虹',
  'food-001': '草莓奶油蛋糕切块', 'food-002': '一杯热可可与棉花糖',
};

let ok = 0;
const miss = [];
for (const [id, subject] of Object.entries(SUBJ)) {
  const theme = id.split('-')[0];
  const jp = path.join(RAW, theme, id + '.json');
  if (!fs.existsSync(jp)) { miss.push(id); continue; }
  const side = JSON.parse(fs.readFileSync(jp, 'utf8'));
  side.subject = subject;
  fs.writeFileSync(jp, JSON.stringify(side, null, 2));
  ok++;
}
console.log(`backfilled=${ok} missing=${miss.length}${miss.length ? ' -> ' + miss.join(',') : ''}`);
