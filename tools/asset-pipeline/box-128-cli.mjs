// box-128-cli.mjs — 从 384×672 棚拍原图批量入盒 128（走 / 站 / 技能通用）
//
// 用法：
//   node box-128-cli.mjs --src <raw目录> --prefix <文件名前缀> \
//        --map a=3,e=7,b=11,c=15,f=18,d=22 \
//        --name hero-violet-walk --out <输出目录>
//
// 选项：
//   --foot <y>        脚底基线（默认 127，与现网 / pivots.json 一致）
//   --content-h <px>  内容目标高（默认 112，与现网 11 帧集合一致）
//   --kernel <k>      nearest | lanczos3（默认 nearest，与现网 128 集合一致）
//   --thresh <n>      去背亮度阈值（默认 30）
//   --margin <px>     四边最小透明边距（默认 1）
//
// 任何一帧审计不过（贴边 / 脚底不对 / 悬空尖角）→ 打印违约项并以 exit 1 结束，
// **不写半成品**（先全部审计通过再落盘）。

import fs from 'node:fs';
import path from 'node:path';
import { boxTo128, knockStudioBackground, sharpIo, contentBox, auditSource, shoeBlobs, BOX, FOOT_Y, CONTENT_H, MIN_MARGIN } from './box-128.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[key] = val;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.src || !args.map || !args.out || !args.name) {
  console.error('usage: node box-128-cli.mjs --src <dir> --prefix <p> --map a=3,f=18 --name hero-x-walk --out <dir>');
  process.exit(2);
}

const footY = Number(args.foot ?? FOOT_Y);
const contentH = Number(args['content-h'] ?? CONTENT_H);
const kernel = String(args.kernel ?? 'nearest');
const thresh = Number(args.thresh ?? 30);
const minMargin = Number(args.margin ?? MIN_MARGIN);
const requireBottomMargin = args['require-bottom-margin'] === true || args['require-bottom-margin'] === 'true';
const prefix = String(args.prefix ?? '');

const map = String(args.map).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
  const [slot, n] = s.split('=');
  return { slot: slot.trim(), n: Number(n) };
});

const io = await sharpIo();
fs.mkdirSync(args.out, { recursive: true });

const staged = [];
const report = [];
let bad = 0;
for (const { slot, n } of map) {
  const file = path.join(args.src, `${prefix}${String(n).padStart(5, '0')}_.png`);
  if (!fs.existsSync(file)) {
    console.error(`NO_RAW ${file}`);
    process.exit(1);
  }
  const src = await io.load(file);
  const knocked = knockStudioBackground(src, { thresh });
  const srcBb = contentBox(knocked);
  if (!srcBb) {
    console.error(`EMPTY ${file}（去背后无主体）`);
    process.exit(1);
  }
  const srcAudit = auditSource(knocked, { frame: `${args.name}-${slot}` });
  const res = await boxTo128(knocked, io, {
    frame: `${args.name}-${slot}`, footY, contentH, minMargin, kernel, requireBottomMargin,
  });
  // 鞋块：走/站循环应有 2 只。只 1 只 = 断腿签名（本缺陷）。合并成 1 块时面积≈两块之和，故只作 warn。
  const shoes = shoeBlobs(res);
  const shoeWarn = shoes.count < 2
    ? [`鞋块只有 ${shoes.count} 个（面积 ${shoes.blobs.map((b) => b.area).join('/')}）—— 确认是否两鞋相邻合并，还是缺脚`]
    : [];
  report.push({
    slot,
    srcFrame: n,
    src: path.relative(process.cwd(), file),
    srcBox: { w: srcBb.w, h: srcBb.h },
    srcEdges: srcAudit.edges,
    scale: +res.plan.scale.toFixed(4),
    widthClamped: res.plan.widthClamped,
    placed: { w: res.plan.tw, h: res.plan.th },
    audit: {
      ok: res.audit.ok,
      margins: res.audit.margins,
      footY: res.audit.footY,
      dangling: res.audit.dangling,
      violations: res.audit.violations,
      warnings: [...res.audit.warnings, ...shoeWarn],
      shoes: { count: shoes.count, blobs: shoes.blobs.map((b) => ({ area: b.area, x: [b.minX, b.maxX] })) },
    },
  });
  if (!res.audit.ok || !srcAudit.ok) bad++;
  staged.push({ slot, img: res, srcAudit });
}

for (const r of report) {
  const tag = r.audit.ok ? 'PASS' : 'FAIL';
  console.log(`${tag} ${args.name}-${r.slot}  src#${r.srcFrame}  bbox ${r.srcBox.w}x${r.srcBox.h} → ${r.placed.w}x${r.placed.h}  ` +
    `m=[T${r.audit.margins.top} B${r.audit.margins.bottom} L${r.audit.margins.left} R${r.audit.margins.right}]  foot=${r.audit.footY}` +
    (r.widthClamped ? '  [宽降s]' : '') +
    (r.audit.violations.length ? `  ⚠ ${r.audit.violations.join('；')}` : '') +
    (r.audit.warnings.length ? `  ⚠warn ${r.audit.warnings.join('；')}` : ''));
}
for (const r of report) {
  const sa = staged.find((s) => s.slot === r.slot)?.srcAudit;
  if (sa && !sa.ok) console.error(`源帧 FAIL ${args.name}-${r.slot} #${r.srcFrame}: ${sa.violations.join('；')}`);
}

if (bad > 0) {
  console.error(`\n${bad} 帧审计未过 —— 不落盘。修内容或换候选帧后重跑。`);
  process.exit(1);
}

for (const { slot, img } of staged) {
  const outFile = path.join(args.out, `${args.name}-${slot}.png`);
  await io.save(img, outFile);
  console.log(`wrote ${path.relative(process.cwd(), outFile)}`);
}
fs.writeFileSync(path.join(args.out, '_box-audit.json'), JSON.stringify({ name: args.name, footY, contentH, kernel, minMargin, box: BOX, frames: report }, null, 2));
