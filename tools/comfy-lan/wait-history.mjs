/**
 * Wait for an already-queued Comfy prompt and download.
 *   node wait-history.mjs <prompt_id> <review-mp4-name> [timeoutSec]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");
const review = path.join(root, "characters/violet-fallen/review/20260915-e6");
const id = process.argv[2];
const outName = process.argv[3] || "03b-e6-s3.mp4";
const timeoutSec = Number(process.argv[4] || 5400);
if (!id) {
  console.error("usage: node wait-history.mjs <prompt_id> <mp4-name> [timeoutSec]");
  process.exit(1);
}

function collect(outputs) {
  const files = [];
  for (const nodeId of Object.keys(outputs || {})) {
    const o = outputs[nodeId] || {};
    for (const key of ["images", "gifs", "videos"]) {
      for (const img of o[key] || []) {
        if (img.type === "input") continue;
        files.push(img);
      }
    }
  }
  return files;
}

const destDir = path.join(root, "characters/violet-fallen/_park", new Date().toISOString().replace(/[:.]/g, "-"));
const deadline = Date.now() + timeoutSec * 1000;
while (Date.now() < deadline) {
  const qr = await fetch(`${base}/queue`);
  const q = await qr.json();
  const running = JSON.stringify(q.queue_running || []).includes(id);
  const hr = await fetch(`${base}/history/${id}`);
  const h = await hr.json();
  const item = h[id];
  const media = item ? collect(item.outputs) : [];
  console.log(new Date().toISOString(), `running=${running} history=${!!item} media=${media.length}`);
  if (media.length) {
    fs.mkdirSync(destDir, { recursive: true });
    const saved = [];
    for (const img of media) {
      const qs = new URLSearchParams({
        filename: img.filename,
        subfolder: img.subfolder || "",
        type: img.type || "output",
      });
      const res = await fetch(`${base}/view?${qs}`);
      if (!res.ok) throw new Error(`view ${img.filename} ${res.status}`);
      const dest = path.join(destDir, img.filename);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      saved.push(dest);
    }
    const rec = {
      schema: "comfy-lan-job/v1",
      exp: "e6",
      stage: "s3b",
      prompt_id: id,
      dest: destDir,
      saved,
      note: "wait-history after long R2V",
    };
    fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2) + "\n");
    fs.writeFileSync(path.join(review, "job-s3b.json"), JSON.stringify(rec, null, 2) + "\n");
    const vid = saved.find((p) => /\.(mp4|webm|mkv)$/i.test(p));
    if (vid) fs.copyFileSync(vid, path.join(review, outName));
    console.log(`saved ${saved.length} -> ${destDir}`);
    process.exit(0);
  }
  const st = item && item.status;
  if (st && st.status_str === "error") {
    console.error("gpu error", JSON.stringify(st));
    process.exit(1);
  }
  await new Promise((ok) => setTimeout(ok, 20000));
}
console.error("wait timeout", id);
process.exit(1);
