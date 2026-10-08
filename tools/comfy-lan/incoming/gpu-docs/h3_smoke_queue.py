"""Queue MiniMax H3 8GB rungs (0.2 MP, CLIP CPU).

Usage (Comfy already running):
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung b1
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v --image S01.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_upper --image S01_upper.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_upper_03 --image S01_upper.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_upper_04 --image S01_upper.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_upper_098 --image S01_upper.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_dance_124 --image S101_9x16.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_dance_v2a --image S101_9x16.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_dance_v2b --image S101_9x16.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_dance_v3_362 --image S101_9x16.png
  D:\\ComfyUI\\venv\\Scripts\\python.exe D:\\ComfyUI\\docs\\h3_smoke_queue.py --rung r2v_dance_04_362 --image S101_9x16.png
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE = "http://127.0.0.1:8188"
SEED = 20260915
W, H = 608, 352
TIMEOUT_S = 90 * 60
ROOT = Path(r"D:\ComfyUI\docs")
INPUT_DIR = Path(r"D:\ComfyUI\input")
TZ = timezone(timedelta(hours=8))
R2V_SEED = 20260916
R2V_W, R2V_H = 352, 608
R2V_IMAGE = "S01.png"
R2V_ID = (
    "Same woman as <Picture 1>. Keep her face, black-root red-tip horns, red eyes, "
    "long wavy black hair, pale skin, black evening gown with high slit and red lining, "
    "sheer black gloves. Full body from horns to heels. Locked camera, empty studio, "
    "soft light. No wings, tail, extra people, text, logos, or subtitles. "
)
R2V_PROMPT = (
    R2V_ID
    + "She stands in place; hair and the dress hem sway slightly. Quiet room tone."
)
R2V_B1_PROMPT = (
    R2V_ID
    + "She turns her head to her left, then looks back at the camera. "
    "Weight shifts onto one heel. Fabric rustle, one light heel tap."
)
R2V_B2_PROMPT = (
    R2V_ID
    + "She takes two slow steps toward the camera, pauses, turns a quarter to her right "
    "so the red lining shows, then drops one gloved hand back to her side. "
    "Heels on a hard floor, dress fabric, quiet room tone."
)
R2V_B3_PROMPT = (
    R2V_ID
    + "She walks three steps toward the camera, stops, turns in place so the red lining "
    "flashes, looks at the camera, then walks two steps back to the starting pose. "
    "At most two hard cuts. Continuous heel clicks and fabric. Horns to heels stay in frame."
)
R2V_UPPER_PROMPT = (
    "Same woman as <Picture 1>. Keep her face, black-root red-tip horns, red eyes, "
    "long wavy black hair, pale skin, black evening gown with lace bib, sheer black gloves. "
    "Upper body from horns to waist fills the frame; face large and readable. "
    "Locked camera, empty studio, soft light. No wings, tail, extra people, text, logos, or subtitles. "
    "She slowly turns her head to her left, looks back at the camera, then a small breath "
    "moves her hair and collar. Quiet room tone, faint fabric. No walking, no legs in frame."
)
R2V_UPPER_04_PROMPT = (
    "Same woman as <Picture 1>. Keep her face, black-root red-tip horns, red eyes, "
    "long wavy black hair, pale skin, black evening gown with lace bib, sheer black gloves. "
    "Upper body from horns to waist fills the frame; face large and readable. "
    "Locked camera, empty studio, soft light. No wings, tail, extra people, text, logos, or subtitles. "
    "She turns her torso to the right, then looks back over her left shoulder at the camera. "
    "She raises one gloved hand and draws her long hair behind her ear, then lets the hand fall. "
    "Clear body turn, a glance back, fabric rustle. No walking, no legs in frame."
)
R2V_DANCE_124_PROMPT = (
    "Same woman as <Picture 1>. Keep her identity exactly as shown: pale skin, red eyes, "
    "long wavy black hair with soft face-framing strands, glossy black horns with red tips, "
    "black lipstick. Do not change her face, hair, horn design or eye colour at any point. "
    "Her chest is bare as in <Picture 1>; do not add a top, jacket, coat, or dress. "
    "Wardrobe for this shot: high-waisted matte black shorts, sheer black thigh-high stockings, "
    "black ankle-strap stiletto heels, sheer black gloves, a thin silver chain belt. "
    "Set: empty dance studio, one seamless matte charcoal-grey backdrop wall, matte black "
    "sprung floor with a single faint seam line. No props, no furniture, no mirrors. "
    "Locked-off tripod camera, shot from a fixed wide full-body position, framed horns to "
    "heels with headroom above her hands, eye level, 35mm look, deep focus. Soft even key "
    "light from camera left, cool rim light from behind separating the black wardrobe from "
    "the dark backdrop, faint soft shadow under her feet. "
    "Choreography, a confident K-pop girl-group routine: "
    "[0.0s-0.8s] She holds a low ready stance, weight on the back leg, chin up, one hand on "
    "her hip, a slow breath in. "
    "[0.8s-1.8s] Two crisp hip isolations to the right, then a sharp side-step-together "
    "step, her heels striking the floor on each beat. "
    "[1.8s-2.8s] Both hands rise and frame her cheekbones, then sweep outward and down with "
    "the wrists leading, finishing on a pointed toe-tap forward. "
    "[2.8s-3.8s] A quick shoulder shimmy travelling one step to her left, hair swinging with "
    "natural follow-through, then she settles into a half-turn and glances over her shoulder. "
    "[3.8s-5.1s] She returns to centre, lifts one hand and sweeps the hair back off her "
    "shoulder in one clean arc, hips counter-swaying, and holds a final pose with a faint "
    "confident smile. "
    "She stays inside the frame the whole time, her feet stay on the floor, her movement is "
    "continuous and readable, and her hair follows through with natural lag. "
    "Audio: an upbeat dance-pop backing track, four-on-the-floor kick, bright synth-brass "
    "stabs on the off-beats, a simple female vocal hook, plus the crisp click of her heels "
    "on the floor. No dialogue, no crowd noise, no announcer. "
    "No camera movement, no cuts, no zoom, no slow motion. No wings, no tail, no second "
    "person, no reflections, no mirror images, no stage rigs, no text, no logos, no "
    "watermarks, no subtitles, no scene transitions, no outfit changes."
)
R2V_DANCE_V3_362_PROMPT = """Same woman as <Picture 1>. Keep her identity exactly as shown: pale skin, red eyes, long wavy black hair, and exactly two glossy black horns with red tips - two horns only, nothing else protrudes from her head or her hair. Her hair is smooth and lies flat against her head with no extra horn shapes. Her face, hair colour, horn colour and eye colour stay identical from the first frame to the last.

Wardrobe exactly as in <Picture 1>: black high-waisted shorts with a chain belt, sheer black thigh-high stockings, black ankle-strap stiletto heels, and short black gloves ending at the wrist. Do not lengthen the gloves and do not add any garment that is not visible in <Picture 1>.

Set: reuse the exact same empty photo studio as <Picture 1>. The wall and floor are one continuous matte light-grey cyclorama, the same colour and texture as Picture 1. Dry matte painted floor, no gloss, no wet look, no reflections, no seam lines. No gold, no green, no mesh, no lattice, no net, no LED wall, no disco lights, no concert stage, no spotlight tunnel, no mirrored floor. Nothing else in the room. This is a still-photo cyclorama, not a performance venue.

Lighting: the same even flat frontal high-key light as <Picture 1>. No rim light, no backlight halo, no shaft of light behind her. The whole image stays bright, matching Picture 1. Her skin stays clean, bright and evenly lit.

Camera: locked-off tripod, fixed wide full-body framing from horns to heels, eye level, 35mm look, deep focus. Her whole body, including both hands, stays fully inside the frame at all times with clear margin from all four edges.

Choreography, a restrained K-pop girl-group routine that keeps her arms close to her body, with a clear accent on every beat:

[0.0s-1.5s] INTRO. She stands at centre in a low ready stance, weight on the back leg, chin up, one hand resting near her hip. She takes a slow visible breath and shifts her weight forward as the track starts.

[1.5s-4.0s] VERSE. Two crisp hip isolations to her right, then a small side-step-together pattern travelling one step left, her heels striking the floor on each beat. Her arms stay low, relaxed, and close to her torso.

[4.0s-6.5s] She raises one hand to frame her cheek, holds it, then lowers it slowly. The other hand stays near her waist. A small pointed toe-tap forward on the accent, then a second toe-tap to the side. Both hands remain well inside the frame.

[6.5s-9.0s] A gentle shoulder roll travelling one small step to her left, hair swinging with natural follow-through. She glances over her shoulder toward camera to re-anchor her face, then turns back to front. She never fully turns her back.

[9.0s-11.0s] CHORUS. Bigger hip isolations and two quick side steps to her right, hips leading, chin tracking the movement. One forearm makes a small diagonal close across her torso. Arms never rise overhead and never spread outward.

[11.0s-13.0s] A single clean hair sweep: she lifts one hand and draws the hair off her shoulder in one small arc, steps back onto the rear foot, and lets her hips counter-sway once.

[13.0s-15.08s] FINAL POSE. She settles into a grounded stance, one hand near her hip, the other relaxed, chest lifted, faint confident smile. She holds to the last frame with only a small breath and her hair settling.

Both hands are open with the fingers together and clearly five fingers each. Her arms stay close to her torso and never spread outward. Her feet stay on the floor, her body stays entirely within the frame, and her movement is smooth and continuous.

Audio: an upbeat dance-pop backing track played in the studio, four-on-the-floor kick, bright synth-brass stabs on the off-beats, a simple female vocal hook, plus the soft click of her heels on the matte floor. No dialogue, no crowd noise. The room never becomes a concert.

No camera movement, no cuts, no zoom, no slow motion. No extra fingers, no extra limbs, no duplicated arms, no extra horns, no fur or feathers on the horns, no wings, no tail, no second person, no text, no logos, no watermarks, no subtitles, no outfit changes, no gold mesh, no green lattice, no LED wall, no wet floor, no glossy floor, no reflections on the ground, no concert stage, no spotlight tunnel."""

RUNGS = {
    "smoke": {
        "length": 5,
        "prefix": "video/MiniMax_H3_smoke",
        "result": "h3-smoke-results.json",
        "client_id": "h3-smoke",
        "prompt": (
            "A tabby cat walks across a wooden table from left to right. "
            "Soft indoor daylight. Footsteps on wood, a faint meow. "
            "No text, logos, or subtitles."
        ),
    },
    "b1": {
        "length": 22,
        "prefix": "video/MiniMax_H3_b1",
        "result": "h3-b1-results.json",
        "client_id": "h3-b1",
        "prompt": (
            "A tabby cat walks across a wooden table from left to right "
            "and stops at the near edge. Soft indoor daylight. "
            "Footsteps on wood, then a faint meow as it stops. "
            "No text, logos, or subtitles."
        ),
    },
    "b2": {
        "length": 124,
        "prefix": "video/MiniMax_H3_b2",
        "result": "h3-b2-results.json",
        "client_id": "h3-b2",
        "prompt": (
            "A tabby cat hops onto a wooden table, sniffs a small stack of books, "
            "then sits and licks one paw. Soft indoor daylight. Footsteps, "
            "a faint meow, quiet room tone. No lyrics, no text, logos, or subtitles."
        ),
    },
    "b3": {
        "length": 362,
        "prefix": "video/MiniMax_H3_b3",
        "result": "h3-b3-results.json",
        "client_id": "h3-b3",
        "prompt": (
            "A tabby cat walks across a wooden table, looks toward a sunlit window, "
            "jumps down onto a wooden chair, then lands on the floor and walks out of frame. "
            "Soft indoor daylight. Footsteps, a meow, chair creak, landing thump, "
            "continuous room tone. At most two hard cuts. No text, logos, or subtitles."
        ),
    },
    "r2v": {
        "mode": "r2v",
        "length": 5,
        "steps": 4,
        "seed": R2V_SEED,
        "width": R2V_W,
        "height": R2V_H,
        "prefix": "video/MiniMax_H3_r2v",
        "result": "h3-r2v-smoke-results.json",
        "client_id": "h3-r2v",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_PROMPT,
    },
    "r2v_b1": {
        "mode": "r2v",
        "length": 22,
        "steps": 4,
        "seed": R2V_SEED,
        "width": R2V_W,
        "height": R2V_H,
        "prefix": "video/MiniMax_H3_r2v_b1",
        "result": "h3-r2v-b1-results.json",
        "client_id": "h3-r2v-b1",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_B1_PROMPT,
    },
    "r2v_b2": {
        "mode": "r2v",
        "length": 124,
        "steps": 4,
        "seed": R2V_SEED,
        "width": R2V_W,
        "height": R2V_H,
        "prefix": "video/MiniMax_H3_r2v_b2",
        "result": "h3-r2v-b2-results.json",
        "client_id": "h3-r2v-b2",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_B2_PROMPT,
    },
    "r2v_b3": {
        "mode": "r2v",
        "length": 362,
        "steps": 4,
        "seed": R2V_SEED,
        "width": R2V_W,
        "height": R2V_H,
        "prefix": "video/MiniMax_H3_r2v_b3",
        "result": "h3-r2v-b3-results.json",
        "client_id": "h3-r2v-b3",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_B3_PROMPT,
    },
    "r2v_upper": {
        "mode": "r2v",
        "length": 124,
        "steps": 4,
        "seed": R2V_SEED,
        "width": R2V_W,
        "height": R2V_H,
        "prefix": "video/MiniMax_H3_r2v_upper",
        "result": "h3-r2v-upper-results.json",
        "client_id": "h3-r2v-upper",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_UPPER_PROMPT,
    },
    "r2v_upper_03": {
        "mode": "r2v",
        "length": 124,
        "steps": 4,
        "seed": R2V_SEED,
        "width": 416,
        "height": 736,
        "prefix": "video/MiniMax_H3_r2v_upper_03",
        "result": "h3-r2v-upper-03-results.json",
        "client_id": "h3-r2v-upper-03",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_UPPER_PROMPT,
    },
    "r2v_upper_04": {
        "mode": "r2v",
        "length": 124,
        "steps": 4,
        "seed": R2V_SEED,
        "width": 480,
        "height": 864,
        "prefix": "video/MiniMax_H3_r2v_upper_04",
        "result": "h3-r2v-upper-04-results.json",
        "client_id": "h3-r2v-upper-04",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_UPPER_04_PROMPT,
    },
    "r2v_upper_098": {
        "mode": "r2v",
        "length": 124,
        "steps": 4,
        "seed": R2V_SEED,
        "width": 768,
        "height": 1344,
        "prefix": "video/MiniMax_H3_r2v_upper_098",
        "result": "h3-r2v-upper-098-results.json",
        "client_id": "h3-r2v-upper-098",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_UPPER_04_PROMPT,
    },
    "r2v_dance_124": {
        "mode": "r2v",
        "length": 124,
        "steps": 4,
        "seed": R2V_SEED,
        "width": 768,
        "height": 1344,
        "snap_s": 15,
        "prefix": "video/S01_dance_768x1344_124f",
        "result": "h3-r2v-dance-124-results.json",
        "client_id": "h3-r2v-dance-124",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_DANCE_124_PROMPT,
    },
    "r2v_dance_v2a": {
        "mode": "r2v",
        "length": 124,
        "steps": 8,
        "scheduler": "beta",
        "lora_strength": 0.8,
        "turbo": True,
        "seed": R2V_SEED,
        "width": 768,
        "height": 1344,
        "snap_s": 15,
        "timeout_s": 90 * 60,
        "prefix": "video/S01_dance_v2_768x1344_124f",
        "result": "h3-r2v-dance-v2a-results.json",
        "client_id": "h3-r2v-dance-v2a",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "workflow": r"D:\ComfyUI\user\default\workflows\MiniMax-H3-R2V-S01-dance-v2-8step.json",
        "prompt": "",
    },
    "r2v_dance_v2b": {
        "mode": "r2v",
        "length": 124,
        "steps": 20,
        "scheduler": "beta",
        "lora_strength": None,
        "turbo": False,
        "seed": R2V_SEED,
        "width": 768,
        "height": 1344,
        "snap_s": 15,
        "timeout_s": 150 * 60,
        "prefix": "video/S01_dance_v2_noturbo_768x1344_124f",
        "result": "h3-r2v-dance-v2b-results.json",
        "client_id": "h3-r2v-dance-v2b",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": None,
        "workflow": r"D:\ComfyUI\user\default\workflows\MiniMax-H3-R2V-S01-dance-v2-noturbo-20step.json",
        "prompt": "",
    },
    "r2v_dance_v3_362": {
        "mode": "r2v",
        "length": 362,
        "steps": 8,
        "scheduler": "beta",
        "lora_strength": 0.8,
        "turbo": True,
        "seed": R2V_SEED,
        "width": 768,
        "height": 1344,
        "snap_s": 15,
        "timeout_s": 150 * 60,
        "prefix": "video/S01_dance_v3_studio_768x1344_362f",
        "result": "h3-r2v-dance-v3-362-retry-results.json",
        "client_id": "h3-r2v-dance-v3-362-retry",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_DANCE_V3_362_PROMPT,
    },
    "r2v_dance_04_362": {
        "mode": "r2v",
        "length": 362,
        "steps": 8,
        "scheduler": "beta",
        "lora_strength": 0.8,
        "turbo": True,
        "seed": R2V_SEED,
        "width": 480,
        "height": 864,
        "snap_s": 15,
        "timeout_s": 90 * 60,
        "prefix": "video/S01_dance_v3_studio_480x864_362f",
        "result": "h3-r2v-dance-04-362-results.json",
        "client_id": "h3-r2v-dance-04-362",
        "unet": "MiniMax-H3-REF2VA-Q3_K_M.gguf",
        "lora": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        "prompt": R2V_DANCE_V3_362_PROMPT,
    },
}


def req(method: str, path: str, payload=None, timeout=60):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        raw = resp.read()
        if not raw:
            return None
        return json.loads(raw.decode("utf-8"))


def free_vram():
    try:
        req("POST", "/free", {"unload_models": True, "free_memory": True})
        print("POST /free ok")
    except urllib.error.URLError as e:
        print("free failed:", e)
    time.sleep(3)


def snap_mem():
    out = {"t": datetime.now(TZ).isoformat(timespec="seconds")}
    try:
        stats = req("GET", "/system_stats", timeout=15) or {}
        devs = stats.get("devices") or []
        if devs:
            d0 = devs[0]
            out["vram_free_mb"] = round((d0.get("vram_free") or 0) / 1024 / 1024)
            out["vram_total_mb"] = round((d0.get("vram_total") or 0) / 1024 / 1024)
            out["torch_vram_used_mb"] = round((d0.get("torch_vram_used") or 0) / 1024 / 1024)
    except Exception as e:
        out["system_stats_err"] = str(e)
    try:
        ps = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                (
                    "$p = Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
                    "Where-Object { $_.CommandLine -match 'main\\.py' }; "
                    "if ($p) { [int64](($p | Measure-Object WorkingSetSize -Sum).Sum / 1MB) } else { 0 }"
                ),
            ],
            text=True,
            timeout=20,
        ).strip()
        out["python_working_set_mb"] = int(float(ps)) if ps else 0
    except Exception as e:
        out["ws_err"] = str(e)
    try:
        os = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                (
                    "$o = Get-CimInstance Win32_OperatingSystem; "
                    "'{0:N0}/{1:N0}' -f "
                    "(($o.TotalVisibleMemorySize-$o.FreePhysicalMemory)/1KB), "
                    "($o.TotalVisibleMemorySize/1KB)"
                ),
            ],
            text=True,
            timeout=20,
        ).strip()
        out["ram_used_total_mb"] = os
    except Exception as e:
        out["ram_err"] = str(e)
    try:
        smi = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=memory.used,memory.total,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            text=True,
            timeout=10,
        ).strip()
        out["nvidia_smi"] = smi
    except Exception as e:
        out["smi_err"] = str(e)
    return out


def graph(prompt: str, length: int, prefix: str) -> dict:
    return {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": {"unet_name": "MiniMax-H3-FL2VA-Q3_K_M.gguf"},
        },
        "2": {
            "class_type": "CLIPLoaderGGUF",
            "inputs": {
                "clip_name": "qwen3vl-32B-MiniMax-H3-Q2_K.gguf",
                "type": "minimax",
                "device": "cpu",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"},
        },
        "4": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"},
        },
        "5": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["1", 0],
                "lora_name": "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
                "strength_model": 1.0,
            },
        },
        "6": {
            "class_type": "MiniMaxH3ImageToVideo",
            "inputs": {
                "clip": ["2", 0],
                "vae": ["3", 0],
                "prompt": prompt,
                "width": W,
                "height": H,
                "length": length,
            },
        },
        "7": {
            "class_type": "RandomNoise",
            "inputs": {"noise_seed": SEED},
        },
        "8": {
            "class_type": "KSamplerSelect",
            "inputs": {"sampler_name": "res_multistep"},
        },
        "9": {
            "class_type": "BasicScheduler",
            "inputs": {
                "model": ["5", 0],
                "scheduler": "simple",
                "steps": 8,
                "denoise": 1.0,
            },
        },
        "10": {
            "class_type": "BasicGuider",
            "inputs": {"model": ["5", 0], "conditioning": ["6", 0]},
        },
        "11": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["7", 0],
                "guider": ["10", 0],
                "sampler": ["8", 0],
                "sigmas": ["9", 0],
                "latent_image": ["6", 1],
            },
        },
        "12": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["11", 0], "vae": ["3", 0]},
        },
        "13": {
            "class_type": "VAEDecodeAudio",
            "inputs": {"samples": ["11", 0], "vae": ["4", 0]},
        },
        "14": {
            "class_type": "CreateVideo",
            "inputs": {
                "images": ["12", 0],
                "audio": ["13", 0],
                "fps": 24.0,
            },
        },
        "15": {
            "class_type": "SaveVideo",
            "inputs": {
                "video": ["14", 0],
                "filename_prefix": prefix,
                "format": "auto",
            },
        },
    }


def prompt_from_workflow(path: Path) -> str:
    wf = json.loads(path.read_text(encoding="utf-8"))
    for n in wf.get("nodes") or []:
        if n.get("id") == 138 or n.get("title") == "Input Text (Prompt)":
            vals = n.get("widgets_values") or []
            if vals and isinstance(vals[0], str):
                return vals[0]
    raise KeyError(f"no prompt node in {path}")


def graph_r2v(
    prompt: str,
    length: int,
    prefix: str,
    image_name: str,
    width: int,
    height: int,
    steps: int = 4,
    scheduler: str = "simple",
    lora_strength: float | None = 1.0,
    lora_name: str = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
) -> dict:
    g = {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": {"unet_name": "MiniMax-H3-REF2VA-Q3_K_M.gguf"},
        },
        "2": {
            "class_type": "CLIPLoaderGGUF",
            "inputs": {
                "clip_name": "qwen3vl-32B-MiniMax-H3-Q2_K.gguf",
                "type": "minimax",
                "device": "cpu",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"},
        },
        "4": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"},
        },
        "16": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
        },
        "6": {
            "class_type": "MiniMaxH3ReferenceToVideo",
            "inputs": {
                "clip": ["2", 0],
                "vae": ["3", 0],
                "audio_vae": ["4", 0],
                "prompt": prompt,
                "width": width,
                "height": height,
                "length": length,
                "ref_image_size": "match",
                "ref_images.ref_image_0": ["16", 0],
            },
        },
        "7": {
            "class_type": "RandomNoise",
            "inputs": {"noise_seed": R2V_SEED},
        },
        "8": {
            "class_type": "KSamplerSelect",
            "inputs": {"sampler_name": "res_multistep"},
        },
        "11": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["7", 0],
                "guider": ["10", 0],
                "sampler": ["8", 0],
                "sigmas": ["9", 0],
                "latent_image": ["6", 1],
            },
        },
        "12": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["11", 0], "vae": ["3", 0]},
        },
        "13": {
            "class_type": "VAEDecodeAudio",
            "inputs": {"samples": ["11", 0], "vae": ["4", 0]},
        },
        "14": {
            "class_type": "CreateVideo",
            "inputs": {
                "images": ["12", 0],
                "audio": ["13", 0],
                "fps": 24.0,
            },
        },
        "15": {
            "class_type": "SaveVideo",
            "inputs": {
                "video": ["14", 0],
                "filename_prefix": prefix,
                "format": "auto",
            },
        },
    }
    if lora_strength is None:
        model_ref = ["1", 0]
    else:
        g["5"] = {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["1", 0],
                "lora_name": lora_name,
                "strength_model": float(lora_strength),
            },
        }
        model_ref = ["5", 0]
    g["9"] = {
        "class_type": "BasicScheduler",
        "inputs": {
            "model": model_ref,
            "scheduler": scheduler,
            "steps": steps,
            "denoise": 1.0,
        },
    }
    g["10"] = {
        "class_type": "BasicGuider",
        "inputs": {"model": model_ref, "conditioning": ["6", 0]},
    }
    return g


def collect_files(hist_entry: dict) -> list[str]:
    files = []
    for node in (hist_entry.get("outputs") or {}).values():
        for key in ("images", "gifs", "videos", "audio"):
            for item in node.get(key) or []:
                if isinstance(item, dict) and item.get("filename"):
                    sub = item.get("subfolder") or ""
                    files.append(f"{sub}/{item['filename']}".strip("/"))
                elif isinstance(item, str):
                    files.append(item)
    return files


def classify_error(err) -> str:
    text = json.dumps(err, ensure_ascii=False)
    low = text.lower()
    if "cuda out of memory" in low or "out of memory" in low and "cuda" in low:
        return "cuda_oom"
    if "memoryerror" in low or "paged out" in low or "commit" in low:
        return "system_ram_oom"
    if err == "timeout":
        return "timeout"
    if "killed" in low or "0xc0000005" in low:
        return "process_killed"
    return "other"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rung", choices=sorted(RUNGS), default="smoke")
    ap.add_argument("--no-free", action="store_true")
    ap.add_argument(
        "--image",
        default="S01.png",
        help="R2V only: filename under D:\\ComfyUI\\input",
    )
    args = ap.parse_args()
    cfg = RUNGS[args.rung]
    if cfg.get("workflow"):
        cfg = dict(cfg)
        cfg["prompt"] = prompt_from_workflow(Path(cfg["workflow"]))
        print("prompt from", cfg["workflow"], "chars", len(cfg["prompt"]), flush=True)
    result_path = ROOT / cfg["result"]
    skip_free = args.no_free
    started = datetime.now(TZ).isoformat(timespec="seconds")
    image_name = None
    if cfg.get("mode") == "r2v":
        image_path = Path(args.image)
        if not image_path.is_absolute():
            image_path = INPUT_DIR / image_path
        if not image_path.is_file():
            print("missing R2V ref image:", image_path, flush=True)
            result_path.write_text(
                json.dumps(
                    {
                        "ok": False,
                        "rung": args.rung,
                        "started": started,
                        "error": f"missing ref image: {image_path}",
                        "error_class": "missing_ref_image",
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            raise SystemExit(2)
        image_name = image_path.name
        if image_path.parent.resolve() != INPUT_DIR.resolve():
            dest = INPUT_DIR / image_name
            dest.write_bytes(image_path.read_bytes())
            print("copied ref image ->", dest, flush=True)
        print("R2V ref image", image_name, "bytes", image_path.stat().st_size, flush=True)
    print("H3", args.rung, "start", started, "length", cfg["length"], "skip_free", skip_free, flush=True)
    q = req("GET", "/queue")
    print("queue", {k: len(v or []) for k, v in (q or {}).items() if k.startswith("queue")}, flush=True)
    if skip_free:
        print("skip POST /free (retry, keep loaded weights)", flush=True)
    else:
        free_vram()
    mem_log = [snap_mem()]
    print("mem0", mem_log[0], flush=True)
    if cfg.get("mode") == "r2v":
        prompt = graph_r2v(
            cfg["prompt"],
            cfg["length"],
            cfg["prefix"],
            image_name,
            cfg.get("width", R2V_W),
            cfg.get("height", R2V_H),
            steps=int(cfg.get("steps", 4)),
            scheduler=str(cfg.get("scheduler", "simple")),
            lora_strength=cfg.get("lora_strength", 1.0),
            lora_name=cfg.get("lora")
            or "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
        )
    else:
        prompt = graph(cfg["prompt"], cfg["length"], cfg["prefix"])
    t0 = time.perf_counter()
    try:
        out = req("POST", "/prompt", {"prompt": prompt, "client_id": cfg["client_id"]})
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print("HTTP", e.code, body[:4000])
        result_path.write_text(
            json.dumps(
                {
                    "ok": False,
                    "rung": args.rung,
                    "started": started,
                    "error": body,
                    "error_class": "prompt_http",
                    "seconds": round(time.perf_counter() - t0, 1),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        raise
    pid = out["prompt_id"]
    print("queued", pid, "node_errors", out.get("node_errors"), flush=True)
    deadline = time.time() + float(cfg.get("timeout_s", TIMEOUT_S))
    last_snap = 0.0
    snap_s = float(cfg.get("snap_s", 20))
    result = None
    refused = 0
    while time.time() < deadline:
        now = time.time()
        if now - last_snap >= snap_s:
            mem_log.append(snap_mem())
            last_snap = now
            print(f"t={time.perf_counter()-t0:.0f}s mem={mem_log[-1]}", flush=True)
        try:
            hist = req("GET", f"/history/{pid}", timeout=30)
            refused = 0
        except Exception as e:
            print("history poll", e)
            refused += 1
            err_s = str(e).lower()
            if refused >= 5 and (
                "10061" in err_s
                or "10054" in err_s
                or "actively refused" in err_s
                or "forcibly closed" in err_s
                or "拒绝" in str(e)
            ):
                elapsed = time.perf_counter() - t0
                result = {
                    "ok": False,
                    "started": started,
                    "finished": datetime.now(TZ).isoformat(timespec="seconds"),
                    "prompt_id": pid,
                    "seconds": round(elapsed, 1),
                    "error": f"8188 down after {refused} refused polls: {e}",
                    "error_class": "process_killed",
                    "files": [],
                    "rung": args.rung,
                    "mem": mem_log + [snap_mem()],
                }
                print("SERVER_DOWN", result["seconds"], result["error_class"], flush=True)
                break
            time.sleep(3)
            continue
        if hist and pid in hist:
            elapsed = time.perf_counter() - t0
            status = hist[pid].get("status") or {}
            ok = bool(status.get("completed")) or status.get("status_str") == "success"
            err = status.get("messages") or status
            files = collect_files(hist[pid])
            result = {
                "ok": ok,
                "started": started,
                "finished": datetime.now(TZ).isoformat(timespec="seconds"),
                "prompt_id": pid,
                "seconds": round(elapsed, 1),
                "error": None if ok else err,
                "error_class": None if ok else classify_error(err),
                "files": files,
                "status": status,
                "rung": args.rung,
                "spec": {
                    "width": cfg.get("width", W),
                    "height": cfg.get("height", H),
                    "length": cfg["length"],
                    "steps": cfg.get("steps", 8),
                    "scheduler": cfg.get("scheduler", "simple"),
                    "turbo": cfg.get("turbo", True),
                    "lora_strength": cfg.get("lora_strength", 1.0),
                    "clip_device": "cpu",
                    "unet": cfg.get("unet", "MiniMax-H3-FL2VA-Q3_K_M.gguf"),
                    "clip": "qwen3vl-32B-MiniMax-H3-Q2_K.gguf",
                    "lora": cfg.get("lora"),
                    "seed": cfg.get("seed", SEED),
                    "prompt": cfg["prompt"],
                    "prefix": cfg["prefix"],
                    "image": image_name,
                },
                "mem": mem_log + [snap_mem()],
            }
            print("DONE", result["ok"], result["seconds"], result["files"], result.get("error_class"))
            break
        time.sleep(2)
    if result is None:
        elapsed = time.perf_counter() - t0
        result = {
            "ok": False,
            "started": started,
            "finished": datetime.now(TZ).isoformat(timespec="seconds"),
            "prompt_id": pid,
            "seconds": round(elapsed, 1),
            "error": "timeout",
            "error_class": "timeout",
            "files": [],
            "mem": mem_log + [snap_mem()],
        }
        print("TIMEOUT", elapsed)
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", result_path, flush=True)
    raise SystemExit(0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()
