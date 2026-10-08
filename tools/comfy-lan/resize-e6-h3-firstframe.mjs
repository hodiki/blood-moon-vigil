import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("d:/code/vampire-survivors-like/tools/asset-pipeline/package.json");
const sharp = require("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = path.join(root, "characters/violet-fallen/identity/video/e6-firstframe-v.png");
const dest = path.join(root, "characters/violet-fallen/review/20260915-e6");
const sizes = [
  [352, 608],
  [480, 864],
  [768, 1344],
];
for (const [w, h] of sizes) {
  const out = path.join(dest, `00-e6-firstframe-h3-${w}x${h}.png`);
  await sharp(src).resize(w, h, { fit: "fill", kernel: "nearest" }).png().toFile(out);
  const m = await sharp(out).metadata();
  console.log(path.relative(root, out), `${m.width}x${m.height}`);
}
