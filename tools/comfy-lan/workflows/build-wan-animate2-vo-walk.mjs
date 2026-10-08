/**
 * Build flattened Wan Animate 2 API graph for E2.
 * Usage: node build-wan-animate2-vo-walk.mjs [length] [--no-cache] [--size=WxH] [--stage=s3b]
 *   17 → S0, 33 → S1, 49 → S2 (4n+1). Default 17.
 * Pose = every 2nd source frame (~31.5 fps → ~16 fps).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const POSITIVE =
  "Static camera at chest height. Empty pure black void behind her, no floor, no scenery, no props. Same flat cel-shaded illustration as the reference image. She walks in place facing the viewer's right, natural stride, arms and cloak swinging with each step.";
const NEGATIVE =
  "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走, camera motion, zoom, new background, landscape, second person, realistic photo, blurry";

const raw = process.argv.slice(2);
let LENGTH = 17;
let WIDTH = 480;
let HEIGHT = 832;
let USE_CACHE = true;
let STAGE = "";
for (const a of raw) {
  if (a === "--no-cache") USE_CACHE = false;
  else if (a.startsWith("--stage=")) STAGE = a.slice("--stage=".length);
  else if (a.startsWith("--size=")) {
    const [w, h] = a.slice("--size=".length).split("x").map(Number);
    WIDTH = w;
    HEIGHT = h;
  } else if (/^\d+$/.test(a)) LENGTH = Number(a);
}
if (![17, 33, 49].includes(LENGTH)) {
  throw new Error(`length must be 17/33/49 (4n+1), got ${LENGTH}`);
}
if (!STAGE) {
  STAGE =
    LENGTH === 17 ? "s0" : LENGTH === 33 ? "s1" : LENGTH === 49 ? "s2" : "s";
}
const STRIDE = 2; // ~31.5 fps source → ~16 fps
const indices = Array.from({ length: LENGTH }, (_, i) => i * STRIDE);
const modelSrc = USE_CACHE ? "224" : "11";

const g = {};

g["2"] = {
  class_type: "UNETLoader",
  inputs: {
    unet_name: "wan_animate_2_distill_int8_convrot.safetensors",
    weight_dtype: "default",
  },
};
g["11"] = {
  class_type: "LoraLoaderModelOnly",
  inputs: {
    model: ["2", 0],
    lora_name:
      "lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors",
    strength_model: 1.0,
  },
};
if (USE_CACHE) {
  g["224"] = {
    class_type: "WanAnimate2Cache",
    inputs: { model: ["11", 0], device: "cpu", dtype: "int8" },
  };
}
g["95"] = {
  class_type: "ModelSamplingSD3",
  inputs: { model: [modelSrc, 0], shift: 5 },
};
g["18"] = {
  class_type: "BasicScheduler",
  inputs: {
    model: [modelSrc, 0],
    scheduler: "simple",
    steps: 6,
    denoise: 1,
  },
};
g["27"] = {
  class_type: "KSamplerSelect",
  inputs: { sampler_name: "lcm" },
};
g["9"] = {
  class_type: "CLIPLoader",
  inputs: {
    clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    type: "wan",
    device: "cpu",
  },
};
g["3"] = {
  class_type: "CLIPTextEncode",
  inputs: { clip: ["9", 0], text: POSITIVE },
};
g["4"] = {
  class_type: "CLIPTextEncode",
  inputs: { clip: ["9", 0], text: NEGATIVE },
};
g["7"] = {
  class_type: "VAELoader",
  inputs: { vae_name: "wan_2.1_vae.safetensors" },
};
g["75"] = {
  class_type: "CLIPVisionLoader",
  inputs: { clip_name: "clip_vision_h.safetensors" },
};
g["10"] = {
  class_type: "LoadImage",
  inputs: { image: "hero-violet-idle-128-v1-stamp.png" },
};
g["50"] = {
  class_type: "ImageScale",
  inputs: {
    image: ["10", 0],
    upscale_method: "area",
    width: WIDTH,
    height: HEIGHT,
    crop: "center",
  },
};
g["76"] = {
  class_type: "CLIPVisionEncode",
  inputs: { clip_vision: ["75", 0], image: ["50", 0], crop: "none" },
};
g["1"] = {
  class_type: "LoadVideo",
  inputs: { file: "8c3b8794-drive-generic-walkinplace.mp4" },
};
g["241"] = {
  class_type: "GetVideoComponents",
  inputs: { video: ["1", 0] },
};

indices.forEach((srcIdx, i) => {
  g[String(300 + i)] = {
    class_type: "ImageFromBatch",
    inputs: { image: ["241", 0], batch_index: srcIdx, length: 1 },
  };
});

let poseId = "300";
for (let i = 1; i < LENGTH; i++) {
  const id = String(400 + i);
  g[id] = {
    class_type: "ImageBatch",
    inputs: { image1: [poseId, 0], image2: [String(300 + i), 0] },
  };
  poseId = id;
}

g["243"] = {
  class_type: "ImageScale",
  inputs: {
    image: [poseId, 0],
    upscale_method: "area",
    width: WIDTH,
    height: HEIGHT,
    crop: "center",
  },
};
g["236"] = {
  class_type: "ImageFromBatch",
  inputs: { image: ["243", 0], batch_index: 0, length: 1 },
};
g["220"] = {
  class_type: "CLIPVisionEncode",
  inputs: { clip_vision: ["75", 0], image: ["236", 0], crop: "none" },
};
g["247"] = {
  class_type: "WanAnimate2ToVideo",
  inputs: {
    positive: ["3", 0],
    negative: ["4", 0],
    vae: ["7", 0],
    width: WIDTH,
    height: HEIGHT,
    length: LENGTH,
    batch_size: 1,
    video_frame_offset: 0,
    pose_strength: 1.0,
    pose_start_percent: 0.0,
    pose_end_percent: 1.0,
    reference_image_strength: 1.0,
    reference_image: ["50", 0],
    pose_video: ["243", 0],
    clip_vision_output: ["76", 0],
    clip_vision_output_pose: ["220", 0],
  },
};
g["19"] = {
  class_type: "SamplerCustom",
  inputs: {
    model: ["95", 0],
    add_noise: true,
    noise_seed: 2026091201,
    cfg: 2,
    positive: ["247", 0],
    negative: ["247", 1],
    sampler: ["27", 0],
    sigmas: ["18", 0],
    latent_image: ["247", 2],
  },
};
g["223"] = {
  class_type: "TrimVideoLatent",
  inputs: { samples: ["19", 0], trim_amount: ["247", 3] },
};
g["6"] = {
  class_type: "VAEDecode",
  inputs: { samples: ["223", 0], vae: ["7", 0] },
};
g["90"] = {
  class_type: "SaveImage",
  inputs: { images: ["6", 0], filename_prefix: `comfy_lan_e2_${STAGE}` },
};
g["91"] = {
  class_type: "SaveAnimatedWEBP",
  inputs: {
    images: ["6", 0],
    filename_prefix: `comfy_lan_e2_${STAGE}_loop`,
    fps: 16,
    lossless: false,
    quality: 80,
    method: "default",
  },
};

fs.writeFileSync(
  path.join(here, "wan-animate2-vo-walk.api.json"),
  JSON.stringify(g, null, 2),
);
fs.writeFileSync(
  path.join(here, "wan-animate2-vo-walk.slots.json"),
  JSON.stringify(
    {
      image_ref: ["10", "inputs", "image"],
      video_drive: ["1", "inputs", "file"],
      positive: ["3", "inputs", "text"],
      seed: ["19", "inputs", "noise_seed"],
      length: ["247", "inputs", "length"],
      width: ["247", "inputs", "width"],
      height: ["247", "inputs", "height"],
    },
    null,
    2,
  ),
);
console.log(
  `wrote wan-animate2-vo-walk.api.json ${STAGE} nodes`,
  Object.keys(g).length,
  `${WIDTH}x${HEIGHT}`,
  USE_CACHE ? "cache=cpu/int8" : "cache=off",
);
console.log("pose frames src", indices.join(","));
