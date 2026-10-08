import fs from "node:fs";

const src = "characters/galvan/combat/job-cards/krea2-stamp-galvan-blo.api.json";
const out = "characters/galvan/combat/job-cards/krea2-stamp-galvan-blo-a.api.json";
const g = JSON.parse(fs.readFileSync(src, "utf8"));
g["8"].inputs.denoise = 0.32;
g["8"].inputs.seed = 2026091803;
g["11"].inputs.filename_prefix = "comfy_lan_galvan_blo_a";
fs.writeFileSync(out, JSON.stringify(g, null, 2) + "\n");
console.log(JSON.stringify({ out, seed: 2026091803, denoise: 0.32 }));
