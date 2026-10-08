/**
 * E6 MiniMax H3：无子命令不 Queue。
 *   node queue-e6-h3.mjs i2v22
 *   node queue-e6-h3.mjs i2v124
 *   node queue-e6-h3.mjs r2v124
 * 落盘 characters/violet-fallen/_park/<ISO>/ 。拒绝写 assets/frames/。
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

const SHOT = {
  i2v22: {
    mode: "i2v",
    length: 22,
    width: 352,
    height: 608,
    steps: 8,
    seed: 2026091631,
    timeout: 1800,
    prefix: "video/e6_h3_i2v22",
    tag: "05a",
    lora: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
    loraStrength: 1,
    scheduler: "simple",
    image: "00-e6-firstframe-h3-352x608.png",
    positive: "e6-h3-i2v-smoke-positive.txt",
  },
  i2v124: {
    mode: "i2v",
    length: 124,
    width: 480,
    height: 864,
    steps: 8,
    seed: 2026091632,
    timeout: 2400,
    prefix: "video/e6_h3_i2v124",
    tag: "05b",
    lora: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
    loraStrength: 1,
    scheduler: "simple",
    image: "00-e6-firstframe-h3-480x864.png",
    positive: "e6-h3-i2v-positive.txt",
  },
  s4: {
    mode: "i2v",
    length: 124,
    width: 480,
    height: 864,
    steps: 8,
    seed: 2026091731,
    timeout: 2400,
    prefix: "video/e6_h3_s4",
    tag: "04",
    lora: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
    loraStrength: 1,
    scheduler: "simple",
    image: "04-e6-s4-start.png",
    positive: "e6-h3-s4-positive.txt",
  },
  s4b: {
    mode: "i2v",
    length: 124,
    width: 480,
    height: 864,
    steps: 8,
    seed: 2026091732,
    timeout: 2400,
    prefix: "video/e6_h3_s4b",
    tag: "04b",
    lora: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
    loraStrength: 1,
    scheduler: "simple",
    image: "04-e6-s4-start.png",
    lastImage: "00-e6-firstframe-h3-480x864.png",
    positive: "e6-h3-s4b-positive.txt",
  },
  s5: {
    mode: "i2v",
    length: 124,
    width: 480,
    height: 864,
    steps: 8,
    seed: 2026091733,
    timeout: 2400,
    prefix: "video/e6_h3_s5",
    tag: "05",
    lora: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
    loraStrength: 1,
    scheduler: "simple",
    image: "05-e6-s5-restage-480x864.png",
    positive: "e6-h3-i2v-positive.txt",
  },
  drive: {
    mode: "t2v",
    length: 73,
    width: 768,
    height: 1344,
    steps: 8,
    seed: 2026091743,
    timeout: 2400,
    prefix: "video/e6_h3_drive098",
    tag: "00b",
    lora: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
    loraStrength: 1,
    scheduler: "simple",
    positive: "e6-h3-drive-positive.txt",
    driveOut: "drive/20260917-drive-h3-t2v-098.mp4",
  },
  drive5s: {
    mode: "t2v",
    length: 124,
    width: 768,
    height: 1344,
    steps: 8,
    seed: 2026091751,
    timeout: 3600,
    prefix: "video/e6_h3_drive5s",
    tag: "00c",
    lora: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
    loraStrength: 1,
    scheduler: "simple",
    positive: "e6-h3-drive-5s-positive.txt",
    driveOut: "drive/20260917-drive-h3-t2v-098-5s.mp4",
  },
};

function assertNotFrames(dest) {
  if (dest.replace(/\\/g, "/").includes("/assets/frames/")) {
    throw new Error("拒绝写入 assets/frames/");
  }
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

async function uploadImage(filePath) {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], { type: "image/png" });
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

function graphI2v(spec, prompt, firstName, lastName) {
  const g = {
    1: { class_type: "UnetLoaderGGUF", inputs: { unet_name: "MiniMax-H3-FL2VA-Q3_K_M.gguf" } },
    2: {
      class_type: "CLIPLoaderGGUF",
      inputs: { clip_name: "qwen3vl-32B-MiniMax-H3-Q2_K.gguf", type: "minimax", device: "cpu" },
    },
    3: { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_video_vae_fp16.safetensors" } },
    4: { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_audio_vae_fp32.safetensors" } },
    5: {
      class_type: "LoraLoaderModelOnly",
      inputs: { model: ["1", 0], lora_name: spec.lora, strength_model: spec.loraStrength },
    },
    16: { class_type: "LoadImage", inputs: { image: firstName } },
    6: {
      class_type: "MiniMaxH3ImageToVideo",
      inputs: {
        clip: ["2", 0],
        vae: ["3", 0],
        prompt,
        width: spec.width,
        height: spec.height,
        length: spec.length,
        first_frame: ["16", 0],
      },
    },
    7: { class_type: "RandomNoise", inputs: { noise_seed: spec.seed } },
    8: { class_type: "KSamplerSelect", inputs: { sampler_name: "res_multistep" } },
    9: {
      class_type: "BasicScheduler",
      inputs: { model: ["5", 0], scheduler: spec.scheduler, steps: spec.steps, denoise: 1 },
    },
    10: { class_type: "BasicGuider", inputs: { model: ["5", 0], conditioning: ["6", 0] } },
    11: {
      class_type: "SamplerCustomAdvanced",
      inputs: { noise: ["7", 0], guider: ["10", 0], sampler: ["8", 0], sigmas: ["9", 0], latent_image: ["6", 1] },
    },
    12: { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    13: { class_type: "VAEDecodeAudio", inputs: { samples: ["11", 0], vae: ["4", 0] } },
    14: { class_type: "CreateVideo", inputs: { images: ["12", 0], audio: ["13", 0], fps: 24 } },
    15: { class_type: "SaveVideo", inputs: { video: ["14", 0], filename_prefix: spec.prefix, format: "auto" } },
  };
  if (lastName) {
    g[17] = { class_type: "LoadImage", inputs: { image: lastName } };
    g[6].inputs.last_frame = ["17", 0];
  }
  return g;
}

function graphT2v(spec, prompt) {
  const g = graphI2v(spec, prompt, null, null);
  delete g[16];
  delete g[6].inputs.first_frame;
  return g;
}

function graphR2v(spec, prompt, imageName) {
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
      inputs: { model: ["1", 0], lora_name: spec.lora, strength_model: spec.loraStrength },
    },
    16: { class_type: "LoadImage", inputs: { image: imageName } },
    6: {
      class_type: "MiniMaxH3ReferenceToVideo",
      inputs: {
        clip: ["2", 0],
        vae: ["3", 0],
        audio_vae: ["4", 0],
        prompt,
        width: spec.width,
        height: spec.height,
        length: spec.length,
        ref_image_size: "match",
        "ref_images.ref_image_0": ["16", 0],
      },
    },
    7: { class_type: "RandomNoise", inputs: { noise_seed: spec.seed } },
    8: { class_type: "KSamplerSelect", inputs: { sampler_name: "res_multistep" } },
    9: {
      class_type: "BasicScheduler",
      inputs: { model: ["5", 0], scheduler: spec.scheduler, steps: spec.steps, denoise: 1 },
    },
    10: { class_type: "BasicGuider", inputs: { model: ["5", 0], conditioning: ["6", 0] } },
    11: {
      class_type: "SamplerCustomAdvanced",
      inputs: { noise: ["7", 0], guider: ["10", 0], sampler: ["8", 0], sigmas: ["9", 0], latent_image: ["6", 1] },
    },
    12: { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    13: { class_type: "VAEDecodeAudio", inputs: { samples: ["11", 0], vae: ["4", 0] } },
    14: { class_type: "CreateVideo", inputs: { images: ["12", 0], audio: ["13", 0], fps: 24 } },
    15: { class_type: "SaveVideo", inputs: { video: ["14", 0], filename_prefix: spec.prefix, format: "auto" } },
  };
}

async function runShot(stage) {
  const spec = SHOT[stage];
  if (!spec) throw new Error("i2v22 | i2v124 | r2v124 | s4 | s4b | s5 | drive | drive5s");
  const prompt = fs.readFileSync(path.join(here, "workflows", spec.positive), "utf8").trim();
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

  let graph;
  if (spec.mode === "t2v") {
    graph = graphT2v(spec, prompt);
    console.log("t2v no image");
  } else {
    const imgPath = path.join(review, spec.image);
    if (!fs.existsSync(imgPath)) throw new Error(`missing ${imgPath}`);
    const refName = await uploadImage(imgPath);
    console.log(`uploaded ${spec.image} -> ${refName}`);
    let lastName = null;
    if (spec.lastImage) {
      const lastPath = path.join(review, spec.lastImage);
      if (!fs.existsSync(lastPath)) throw new Error(`missing last ${lastPath}`);
      lastName = await uploadImage(lastPath);
      console.log(`uploaded last ${spec.lastImage} -> ${lastName}`);
    }
    graph = spec.mode === "r2v" ? graphR2v(spec, prompt, refName) : graphI2v(spec, prompt, refName, lastName);
  }

  const t0 = Date.now();
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph, client_id: randomUUID() }),
  });
  const queued = await res.json();
  if (!res.ok || !queued.prompt_id) throw new Error(`queue fail ${res.status} ${JSON.stringify(queued)}`);
  console.log(`queued ${stage} ${queued.prompt_id} ${spec.width}x${spec.height} L${spec.length}`);
  const history = await waitHistory(queued.prompt_id, spec.timeout);
  const saved = await download(history, destDir);
  const rec = {
    schema: "comfy-lan-job/v1",
    exp: "e6",
    engine: "minimax-h3",
    stage,
    char: "violet-fallen",
    prompt_id: queued.prompt_id,
    seed: spec.seed,
    length: spec.length,
    size: `${spec.width}x${spec.height}`,
    steps: spec.steps,
    ms: Date.now() - t0,
    dest: destDir,
    saved,
    positiveFile: spec.positive,
  };
  fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2) + "\n");
  fs.writeFileSync(path.join(here, "incoming/last-job.json"), JSON.stringify(rec, null, 2) + "\n");
  fs.writeFileSync(path.join(review, `job-${stage}.json`), JSON.stringify(rec, null, 2) + "\n");
  const vid = saved.find((p) => /\.(mp4|webm|mkv)$/i.test(p));
  if (vid) {
    fs.copyFileSync(vid, path.join(review, `${spec.tag}-e6-${stage}.mp4`));
    if (spec.driveOut) {
      const driveDest = path.join(review, spec.driveOut);
      fs.mkdirSync(path.dirname(driveDest), { recursive: true });
      fs.copyFileSync(vid, driveDest);
    }
  }
  console.log(`saved ${saved.length} in ${rec.ms}ms -> ${destDir}`);
}

function help() {
  console.log(`E6 H3 queue — 无子命令不 Queue。

  node queue-e6-h3.mjs i2v22   # FL2VA 首帧 352x608 22f turbo 8（I2V 冒烟）
  node queue-e6-h3.mjs i2v124  # FL2VA 首帧 480x864 124f turbo 8
  node queue-e6-h3.mjs r2v124  # REF2VA 参考图 480x864 124f turbo 4
  node queue-e6-h3.mjs s4      # FL2VA 仅首帧续（已不过）
  node queue-e6-h3.mjs s4b     # FL2VA 首+尾帧锁脸
  node queue-e6-h3.mjs s5      # FL2VA 重出首帧 I2V
  node queue-e6-h3.mjs drive   # FL2VA T2V 灰棚驱动 768x1344 73f 0.98MP
  node queue-e6-h3.mjs drive5s # FL2VA T2V 灰棚驱动 768x1344 124f 5.2s

  官方 INT8+NVFP4 不要 Queue。不和 WAI/Krea 同队。打前 POST /free。`);
}

const cmd = process.argv[2] || "help";
try {
  if (cmd === "help" || cmd === "--help" || !SHOT[cmd]) {
    help();
    if (cmd !== "help" && cmd !== "--help" && cmd) process.exit(1);
  } else {
    await runShot(cmd);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
