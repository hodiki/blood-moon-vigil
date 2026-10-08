/**
 * E6 S3 · 驱动贴到过关首帧。
 *   node queue-e6-s3.mjs
 * 本机开源视频只剩 MiniMax H3（Wan 权重已卸）。R2V：
 *   <Picture 1> = 过关竖首帧 · <Video 1> = 已过 0.98MP 驱动。
 * 768×1344 ×124（≈5.2s；非 15s 用 0.98MP）。落盘 characters/violet-fallen/_park/ 。拒绝写 frames/。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handshake = JSON.parse(fs.readFileSync(path.join(here, "incoming/handshake.json"), "utf8"));
const base = String(handshake.gpu.url).replace(/\/$/, "");
const review = path.join(root, "characters/violet-fallen/review/20260915-e6");

const WIDTH = 768;
const HEIGHT = 1344;
const LENGTH = 124;
const SEED = 2026091752;
const TIMEOUT = 9000;
const REF = path.join(review, "00-e6-firstframe-h3-768x1344.png");
const REF_FALLBACK = path.join(root, "characters/violet-fallen/identity/video/e6-firstframe-v.png");
const DRIVE = path.join(review, "drive/20260917-drive-h3-t2v-098-5s.mp4");
const POSITIVE = fs.readFileSync(path.join(here, "workflows/e6-h3-s3-r2v-5s-positive.txt"), "utf8").trim();
const LORA = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors";

function assertNotFrames(dest) {
  if (dest.replace(/\\/g, "/").includes("/assets/frames/")) {
    throw new Error("拒绝写入 assets/frames/");
  }
}

function mimeForUpload(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".mp4") return "video/mp4";
  return "application/octet-stream";
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, body: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, body: text };
    }
  } finally {
    clearTimeout(t);
  }
}

async function upload(filePath) {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], { type: mimeForUpload(filePath) });
  const fd = new FormData();
  fd.append("image", blob, path.basename(filePath));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(filePath);
}

function collectMedia(outputs) {
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

async function waitHistory(promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await getJson(`${base}/history/${promptId}`, 15000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      if (collectMedia(item.outputs).length) return item;
      const status = item.status || {};
      if (status.status_str === "error") throw new Error(`${promptId} error ${JSON.stringify(status)}`);
      if (status.completed) throw new Error(`${promptId} completed with no media`);
    }
    await new Promise((ok) => setTimeout(ok, 4000));
  }
  throw new Error(`timeout ${promptId}`);
}

async function download(history, destDir) {
  const saved = [];
  for (const img of collectMedia(history.outputs)) {
    const q = new URLSearchParams({
      filename: img.filename,
      subfolder: img.subfolder || "",
      type: img.type || "output",
    });
    const res = await fetch(`${base}/view?${q}`);
    if (!res.ok) throw new Error(`view ${img.filename} ${res.status}`);
    const dest = path.join(destDir, img.filename);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    saved.push(dest);
  }
  return saved;
}

function graphR2v(refName, driveName) {
  return {
    1: { class_type: "UnetLoaderGGUF", inputs: { unet_name: "MiniMax-H3-REF2VA-Q3_K_M.gguf" } },
    2: {
      class_type: "CLIPLoaderGGUF",
      inputs: { clip_name: "qwen3vl-32B-MiniMax-H3-Q2_K.gguf", type: "minimax", device: "cpu" },
    },
    3: { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_video_vae_fp16.safetensors" } },
    4: { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_audio_vae_fp32.safetensors" } },
    5: {
      class_type: "LoraLoaderModelOnly",
      inputs: { model: ["1", 0], lora_name: LORA, strength_model: 1 },
    },
    16: { class_type: "LoadImage", inputs: { image: refName } },
    20: { class_type: "LoadVideo", inputs: { file: driveName } },
    21: { class_type: "GetVideoComponents", inputs: { video: ["20", 0] } },
    6: {
      class_type: "MiniMaxH3ReferenceToVideo",
      inputs: {
        clip: ["2", 0],
        vae: ["3", 0],
        audio_vae: ["4", 0],
        prompt: POSITIVE,
        width: WIDTH,
        height: HEIGHT,
        length: LENGTH,
        ref_image_size: "match",
        "ref_images.ref_image_0": ["16", 0],
        "ref_videos.ref_video_0": ["21", 0],
      },
    },
    7: { class_type: "RandomNoise", inputs: { noise_seed: SEED } },
    8: { class_type: "KSamplerSelect", inputs: { sampler_name: "res_multistep" } },
    9: {
      class_type: "BasicScheduler",
      inputs: { model: ["5", 0], scheduler: "simple", steps: 4, denoise: 1 },
    },
    10: { class_type: "BasicGuider", inputs: { model: ["5", 0], conditioning: ["6", 0] } },
    11: {
      class_type: "SamplerCustomAdvanced",
      inputs: { noise: ["7", 0], guider: ["10", 0], sampler: ["8", 0], sigmas: ["9", 0], latent_image: ["6", 1] },
    },
    12: { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    13: { class_type: "VAEDecodeAudio", inputs: { samples: ["11", 0], vae: ["4", 0] } },
    14: { class_type: "CreateVideo", inputs: { images: ["12", 0], audio: ["13", 0], fps: 24 } },
    15: { class_type: "SaveVideo", inputs: { video: ["14", 0], filename_prefix: "video/e6_s3_r2v5s", format: "auto" } },
  };
}

const refPath = fs.existsSync(REF) ? REF : REF_FALLBACK;
if (!fs.existsSync(refPath)) throw new Error(`missing ref ${refPath}`);
if (!fs.existsSync(DRIVE)) throw new Error(`missing drive ${DRIVE}`);

const destDir = path.join(root, "characters/violet-fallen/_park", new Date().toISOString().replace(/[:.]/g, "-"));
assertNotFrames(destDir);
fs.mkdirSync(destDir, { recursive: true });

const free = await fetch(`${base}/free`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ unload_models: true, free_memory: true }),
});
if (!free.ok) throw new Error(`POST /free ${free.status}`);
console.log("POST /free ok");

const refName = await upload(refPath);
const driveName = await upload(DRIVE);
console.log(`uploaded ref ${path.basename(refPath)} -> ${refName}`);
console.log(`uploaded drive -> ${driveName}`);

const graph = graphR2v(refName, driveName);
const t0 = Date.now();
const res = await fetch(`${base}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: graph, client_id: randomUUID() }),
});
const queued = await res.json();
if (!res.ok || !queued.prompt_id) throw new Error(`queue fail ${res.status} ${JSON.stringify(queued)}`);
console.log(`queued s3-r2v ${queued.prompt_id} ${WIDTH}x${HEIGHT} L${LENGTH}`);
const history = await waitHistory(queued.prompt_id, TIMEOUT);
const saved = await download(history, destDir);
const rec = {
  schema: "comfy-lan-job/v1",
  exp: "e6",
  engine: "minimax-h3-r2v",
  stage: "s3",
  char: "violet-fallen",
  prompt_id: queued.prompt_id,
  seed: SEED,
  length: LENGTH,
  size: `${WIDTH}x${HEIGHT}`,
  steps: 4,
  ms: Date.now() - t0,
  dest: destDir,
  saved,
  positiveFile: "e6-h3-s3-r2v-5s-positive.txt",
  ref: path.relative(root, refPath).replace(/\\/g, "/"),
  drive: "drive/20260917-drive-h3-t2v-098-5s.mp4",
  note: "5.2s retake; 3s S3 was rushed",
};
fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2) + "\n");
fs.writeFileSync(path.join(here, "incoming/last-job.json"), JSON.stringify(rec, null, 2) + "\n");
fs.writeFileSync(path.join(review, "job-s3b.json"), JSON.stringify(rec, null, 2) + "\n");
const vid = saved.find((p) => /\.(mp4|webm|mkv)$/i.test(p));
if (vid) fs.copyFileSync(vid, path.join(review, "03b-e6-s3.mp4"));
console.log(`saved ${saved.length} in ${rec.ms}ms -> ${destDir}`);
