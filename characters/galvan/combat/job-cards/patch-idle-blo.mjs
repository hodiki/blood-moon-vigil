/**
 * Patch frozen Vf1 B-lo graph with Galvan prompt / seed. Does not Queue.
 * Output stays in this folder. Do not mutate pipelines/b-stamp-nearest-128/*.api.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..", "..");
const tmpl = JSON.parse(
  fs.readFileSync(
    path.join(repo, "pipelines", "b-stamp-nearest-128", "krea2-stamp-i2i-vf1-blo.api.json"),
    "utf8",
  ),
);
const text = fs
  .readFileSync(path.join(repo, "pipelines", "b-stamp-nearest-128", "prompt-galvan-blo.txt"), "utf8")
  .replace(/\s+/g, " ")
  .trim();
tmpl["5"].inputs.text = text;
tmpl["8"].inputs.seed = 2026091803;
tmpl["8"].inputs.denoise = 0.48;
tmpl["11"].inputs.filename_prefix = "comfy_lan_galvan_blo";
const out = path.join(here, "krea2-stamp-galvan-blo.api.json");
fs.writeFileSync(out, JSON.stringify(tmpl, null, 2) + "\n");
console.log(JSON.stringify({ out, seed: 2026091803, denoise: 0.48, chars: text.length }));
