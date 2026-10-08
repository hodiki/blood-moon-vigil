/**
 * Build Krea i2i API graphs from krea2-i2i-api.json + prompt txt.
 * Usage: node build-krea-i2i.mjs <prompt.txt> <seed> <denoise> <prefix> <out.json>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [promptPath, seedStr, denoiseStr, prefix, outPath] = process.argv.slice(2);
if (!promptPath || !seedStr || !denoiseStr || !prefix || !outPath) {
  console.error("usage: node build-krea-i2i.mjs <prompt.txt> <seed> <denoise> <prefix> <out.json>");
  process.exit(1);
}

const tmpl = JSON.parse(fs.readFileSync(path.join(here, "krea2-i2i-api.json"), "utf8"));
const text = fs.readFileSync(path.resolve(promptPath), "utf8").replace(/\s+/g, " ").trim();
tmpl["5"].inputs.text = text;
tmpl["8"].inputs.seed = Number(seedStr);
tmpl["8"].inputs.denoise = Number(denoiseStr);
tmpl["11"].inputs.filename_prefix = prefix;
fs.writeFileSync(path.resolve(outPath), JSON.stringify(tmpl, null, 2) + "\n");
console.log(`wrote ${outPath} seed=${seedStr} denoise=${denoiseStr} prefix=${prefix}`);
