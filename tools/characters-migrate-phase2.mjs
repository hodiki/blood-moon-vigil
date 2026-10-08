/**
 * Phase 2: write 00-已迁.md at old dirs, then delete copied lock files.
 * Does not delete: frames/raw/atlas, review-h23-wave*, archive/process,
 * _park/comfy-lan, _inspect, 留 parks, workflows (except vf1-clean / vf1-idle-stamp).
 */
import fs from "fs";
import path from "path";

const ROOT = "d:/code/vampire-survivors-like";
const CHAR = path.join(ROOT, "characters");
const DATE = "2026-09-13";

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function parseSourceMd(file) {
  const rows = [];
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\| `([^`]+)` \| `([^`]+)` \|/);
    if (m) rows.push({ destFile: m[1], srcRel: m[2].replace(/\\/g, "/") });
  }
  return rows;
}

function skipDelete(srcRel) {
  const s = srcRel.replace(/\\/g, "/");
  if (s.includes("/review-h23-wave")) return "review-h23-wave 不搬";
  if (s.includes("/archive/process")) return "archive 不搬";
  if (s.includes("/_park/comfy-lan/")) return "历史落盘不搬";
  if (s.includes("/combat-64/_inspect/")) return "_inspect 脚本不删";
  if (s.includes("/tools/comfy-lan/workflows/")) {
    if (s.endsWith("/vf1-clean.png") || s.endsWith("/vf1-idle-stamp.png")) return null;
    return "workflows 不搬";
  }
  if (s.includes("/_park/vo-idle-o3d2")) return "留";
  if (s.includes("/_park/identity-vf1")) return "留";
  if (s.includes("/_park/identity-e1")) return "留";
  if (s.includes("/_park/ok-idle-")) return "留";
  if (s.startsWith("characters/")) return "新目录";
  return null;
}

function posix(p) {
  return p.split(path.sep).join("/");
}

const byDir = new Map();
const deleted = [];
const skipped = [];
const missing = [];

for (const md of walk(CHAR).filter((f) => path.basename(f) === "source.md")) {
  const destDir = path.dirname(md);
  for (const row of parseSourceMd(md)) {
    const srcRel = row.srcRel;
    const why = skipDelete(srcRel);
    if (why) {
      skipped.push({ srcRel, why });
      continue;
    }
    const abs = path.join(ROOT, srcRel);
    const destRel = posix(path.relative(ROOT, path.join(destDir, row.destFile)));
    const dir = path.dirname(abs);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push({ srcRel, destRel, abs });
  }
}

const extra = [
  "tools/comfy-lan/workflows/vf1-krea-lora/vf1-clean.png",
  "tools/comfy-lan/workflows/vf1-krea-lora/vf1-idle-stamp.png",
];
for (const srcRel of extra) {
  const abs = path.join(ROOT, srcRel);
  const dir = path.dirname(abs);
  if (!byDir.has(dir)) byDir.set(dir, []);
  byDir.get(dir).push({
    srcRel,
    destRel:
      srcRel.endsWith("vf1-clean.png")
        ? "characters/violet-fallen/identity/source/vf1-clean.png"
        : "characters/violet-fallen/stamps/idle-blo.png",
    abs,
  });
}

for (const [dir, rows] of byDir) {
  const uniq = [];
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.srcRel)) continue;
    seen.add(r.srcRel);
    uniq.push(r);
  }
  const lines = [
    `# 已迁（${DATE} · Phase 2）`,
    ``,
    `本夹锁件已复制进 \`characters/\`。现行以角色目录为准。红线：\`characters/README.md\`。`,
    ``,
    `| 原文件 | 迁到 |`,
    `|---|---|`,
  ];
  for (const r of uniq) {
    lines.push(`| \`${path.basename(r.srcRel)}\` | \`${r.destRel}\` |`);
  }
  lines.push("");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "00-已迁.md"), lines.join("\n"));

  for (const r of uniq) {
    if (!fs.existsSync(r.abs)) {
      missing.push(r.srcRel);
      continue;
    }
    fs.unlinkSync(r.abs);
    deleted.push(r.srcRel);
  }
}

const report = {
  deleted: deleted.length,
  skipped: skipped.length,
  missing,
  deletedSample: deleted.slice(0, 20),
};
fs.writeFileSync(
  path.join(CHAR, "_phase2-report.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
