/**
 * E2 drive inspect: LoadVideo → frames → webp + 8 stills. No Wan UNET. Park only.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..", "..", "..", "..");
const parkRoot = path.join(
  root,
  "assets",
  "ui-menu",
  "preview",
  "locked",
  "combat-64",
  "_park",
  "comfy-lan",
);
const handshake = JSON.parse(
  fs.readFileSync(
    path.join(root, "tools", "comfy-lan", "incoming", "handshake.json"),
    "utf8",
  ),
);
const base = String(handshake.gpu.url).replace(/\/$/, "");
const drive = process.argv[2];
const prefix = process.argv[3] || "comfy_lan_e2_drive";
if (!drive) {
  console.error("usage: node e2-drive-extract.mjs <mp4> [prefix]");
  process.exit(1);
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep */
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function upload(filePath) {
  const abs = path.resolve(filePath);
  const buf = fs.readFileSync(abs);
  const blob = new Blob([buf], { type: "video/mp4" });
  const fd = new FormData();
  fd.append("image", blob, path.basename(abs));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(abs);
}

const prompt = {
  "1": {
    class_type: "LoadVideo",
    inputs: { file: "PLACEHOLDER" },
  },
  "2": {
    class_type: "GetVideoComponents",
    inputs: { video: ["1", 0] },
  },
  "3": {
    class_type: "SaveAnimatedWEBP",
    inputs: {
      images: ["2", 0],
      filename_prefix: `${prefix}_loop`,
      fps: 8,
      lossless: false,
      quality: 70,
      method: "fastest",
    },
  },
  "4": {
    class_type: "ImageFromBatch",
    inputs: { image: ["2", 0], batch_index: 0, length: 8 },
  },
  "5": {
    class_type: "SaveImage",
    inputs: { images: ["4", 0], filename_prefix: `${prefix}_head8` },
  },
};

async function waitHistory(promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await getJson(`${base}/history/${promptId}`, 10000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      const status = item.status || {};
      if (status.status_str === "error") {
        throw new Error(`Comfy fail ${JSON.stringify(status)}`);
      }
      if (status.completed) return item;
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error("timeout");
}

const name = await upload(drive);
prompt["1"].inputs.file = name;
console.log(`uploaded ${name}`);

const clientId = randomUUID();
const res = await fetch(`${base}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, client_id: clientId }),
});
if (!res.ok) throw new Error(`queue ${res.status} ${await res.text()}`);
const queued = await res.json();
console.log(`queued ${queued.prompt_id}`);
const history = await waitHistory(queued.prompt_id, 180);
const dest = path.join(parkRoot, new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(dest, { recursive: true });
const saved = [];
for (const nodeId of Object.keys(history.outputs || {})) {
  const o = history.outputs[nodeId] || {};
  for (const key of ["images", "gifs", "videos"]) {
    for (const img of o[key] || []) {
      const q = new URLSearchParams({
        filename: img.filename,
        subfolder: img.subfolder || "",
        type: img.type || "output",
      });
      const fileRes = await fetch(`${base}/view?${q}`);
      const buf = Buffer.from(await fileRes.arrayBuffer());
      const out = path.join(dest, img.filename);
      fs.writeFileSync(out, buf);
      saved.push(out);
    }
  }
}
fs.writeFileSync(
  path.join(dest, "job.json"),
  JSON.stringify({ prompt_id: queued.prompt_id, drive: name, saved }, null, 2),
);
console.log(`saved ${saved.length} -> ${dest}`);
