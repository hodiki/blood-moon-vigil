/**
 * E4 S3: WAI 0.35 + 0.45 on mixed chosen Krea stills.
 *   node tools/comfy-lan/e4-s3-run.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const node = process.execPath;
const CELLS = ["P1", "P2", "P3", "P4", "P5", "P6"];
const IDS = ["violet-fallen", "cassandra"];
const DNS = [0.35, 0.45];

const chosen = JSON.parse(
  fs.readFileSync(
    path.join(root, "characters", "violet-fallen", "review", "20260913-e4", "chosen.json"),
    "utf8",
  ),
);

function run(args, cwd = here) {
  const r = spawnSync(node, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`fail ${args.join(" ")} status ${r.status}`);
}

const manifests = { "violet-fallen": [], cassandra: [] };

for (const id of IDS) {
  const review = path.join(root, "characters", id, "review", "20260913-e4");
  for (const cell of CELLS) {
    const krea = path.join(root, chosen[id][cell].png);
    if (!fs.existsSync(krea)) throw new Error(`missing krea ${krea}`);
    for (const dn of DNS) {
      console.log(`==== S3 ${id} ${cell} dn ${dn} ====`);
      run([
        path.join(here, "queue-e4.mjs"),
        "s3",
        "--char",
        id,
        "--cell",
        cell,
        "--krea",
        krea,
        "--dn",
        String(dn),
        "--timeout",
        "420",
      ]);
      const job = JSON.parse(fs.readFileSync(path.join(here, "incoming", "last-job.json"), "utf8"));
      const png = job.saved[0];
      const tag = dn === 0.35 ? "wai035" : "wai045";
      run([
        path.join(root, "tools", "face-gate", "make-card.mjs"),
        "--id",
        id,
        "--new",
        png,
        "--topic",
        `e4-${cell}-${tag}`,
      ], root);
      const stem = `20260914-e4-${cell}-${tag}-fg`;
      const gate = path.join(root, "characters", id, "identity", "face-gate");
      fs.copyFileSync(path.join(gate, `${stem}.png`), path.join(review, `02-e4-${id}-${cell}-${tag}-fg.png`));
      fs.copyFileSync(path.join(gate, `${stem}.json`), path.join(review, `02-e4-${id}-${cell}-${tag}-fg.json`));
      manifests[id].push({
        cell,
        dn,
        png,
        prompt_id: job.prompt_id,
        ms: job.ms,
        dest: job.dest,
      });
    }
  }
  fs.writeFileSync(path.join(review, "s3-manifest.json"), JSON.stringify(manifests[id], null, 2));
}

console.log("==== S3 queue done ====");
