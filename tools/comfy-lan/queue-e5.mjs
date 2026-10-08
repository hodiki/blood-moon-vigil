/**
 * E5 排队：场景 t2i · 去底 · 路 A 双输入 · 路 B 调和。
 * 默认只打印，不 Queue。无子命令 = help。
 * 落盘 characters/<id>/_park/<ISO>/ 。拒绝写 assets/frames/。
 *
 *   node queue-e5.mjs list
 *   node queue-e5.mjs s0 --scene A --n 1
 *   node queue-e5.mjs rembg --char violet-fallen --person <png>
 *   node queue-e5.mjs a --scene A --scene-png <png> --person-png <png>
 *   node queue-e5.mjs b --scene A --compose-png <png>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const CHAR_IDS = ["cassandra", "edmund", "violet-oath", "violet-fallen", "galvan", "oathkeeper"];
const E5_CHARS = ["violet-fallen", "cassandra"];
const handshake = JSON.parse(
  fs.readFileSync(path.join(here, "incoming", "handshake.json"), "utf8"),
);
const base = String(handshake.gpu.url).replace(/\/$/, "");

const t2iTmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "krea2-turbo-t2i-scene.api.json"), "utf8"),
);
const scene2Tmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "krea2-identity-edit-scene2.api.json"), "utf8"),
);
const harmTmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "krea2-identity-edit-harmonize.api.json"), "utf8"),
);
const rembgTmpl = JSON.parse(
  fs.readFileSync(path.join(here, "workflows", "rembg-rgba-api.json"), "utf8"),
);

const PERSON = {
  "violet-fallen": {
    cell: "P1",
    png: path.join(
      root,
      "characters/violet-fallen/_park/2026-09-14T02-11-29-747Z/comfy_lan_e4_vf_P1_s0_00001_.png",
    ),
  },
  cassandra: {
    cell: "P1",
    png: path.join(
      root,
      "characters/cassandra/_park/2026-09-14T06-00-49-467Z/comfy_lan_e4_cas_P1_s1b_00002_.png",
    ),
  },
};

const SCENE_SEEDS = { A: [2026091311, 2026091312], B: [2026091313, 2026091314] };
const ROUTE_A_SEED = { A: 2026091321, B: 2026091322 };
const ROUTE_B_SEED = { A: 2026091323, B: 2026091324 };

function parseArgs(argv) {
  const out = { cmd: argv[2] || "help", flags: {} };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    out.flags[key] = val;
  }
  return out;
}

function parkRoot(charId) {
  if (!CHAR_IDS.includes(charId)) throw new Error(`--char 必须是: ${CHAR_IDS.join(" | ")}`);
  return path.join(root, "characters", charId, "_park");
}

function assertNotFrames(dest) {
  const n = dest.replace(/\\/g, "/");
  if (n.includes("/assets/frames/") || n.endsWith("/assets/frames")) {
    throw new Error("拒绝写入 assets/frames/");
  }
}

function parsePrompts(text) {
  const blocks = {};
  let cur = null;
  const lines = [];
  const flush = () => {
    if (cur) blocks[cur] = lines.join("\n").trim();
    lines.length = 0;
  };
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\[(.+)\]\s*$/);
    if (m) {
      flush();
      cur = m[1].trim();
      continue;
    }
    if (raw.startsWith("#") && !cur) continue;
    if (cur) lines.push(raw);
  }
  flush();
  return blocks;
}

const PROMPTS = parsePrompts(
  fs.readFileSync(path.join(here, "workflows", "e5-prompts.txt"), "utf8"),
);

function need(key) {
  if (!PROMPTS[key]) throw new Error(`缺指令块: [${key}]`);
  return PROMPTS[key];
}

function sceneKey(flags) {
  const s = String(flags.scene || "").toUpperCase();
  if (s !== "A" && s !== "B") throw new Error("--scene A | B");
  return s;
}

function needChar(flags) {
  const charId = String(flags.char || "violet-fallen");
  if (!E5_CHARS.includes(charId)) throw new Error("--char violet-fallen | cassandra");
  return charId;
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function uploadImage(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`缺源图 ${abs}`);
  const buf = fs.readFileSync(abs);
  const blob = new Blob([buf], { type: "image/png" });
  const fd = new FormData();
  fd.append("image", blob, path.basename(abs));
  fd.append("overwrite", "true");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(abs);
}

function collectMedia(outputs) {
  const files = [];
  for (const nodeId of Object.keys(outputs || {})) {
    const o = outputs[nodeId] || {};
    for (const key of ["images", "gifs", "videos"]) {
      for (const img of o[key] || []) files.push(img);
    }
  }
  return files;
}

async function waitHistory(promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await getJson(`${base}/history/${promptId}`, 10000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      if (collectMedia(item.outputs).length) return item;
      const status = item.status || {};
      if (status.status_str === "error") {
        throw new Error(`${promptId} error ${JSON.stringify(status)}`);
      }
      if (status.completed) throw new Error(`${promptId} completed with no images`);
    }
    await new Promise((ok) => setTimeout(ok, 2000));
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

async function queuePrompt(prompt) {
  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: randomUUID() }),
  });
  const queued = await res.json();
  if (!res.ok || !queued.prompt_id) {
    throw new Error(`queue fail ${res.status} ${JSON.stringify(queued)}`);
  }
  return queued.prompt_id;
}

async function runJob({ charId, prompt, recExtra, timeoutSec }) {
  const destDir = path.join(parkRoot(charId), new Date().toISOString().replace(/[:.]/g, "-"));
  assertNotFrames(destDir);
  fs.mkdirSync(destDir, { recursive: true });
  const t0 = Date.now();
  const promptId = await queuePrompt(prompt);
  const history = await waitHistory(promptId, timeoutSec);
  const saved = await download(history, destDir);
  const rec = {
    schema: "comfy-lan-job/v1",
    exp: "e5",
    char: charId,
    prompt_id: promptId,
    ms: Date.now() - t0,
    dest: destDir,
    saved,
    ...recExtra,
  };
  fs.writeFileSync(path.join(destDir, "job.json"), JSON.stringify(rec, null, 2));
  fs.writeFileSync(path.join(here, "incoming", "last-job.json"), JSON.stringify(rec, null, 2));
  console.log(`saved ${rec.route || rec.stage} ${saved.length} in ${rec.ms}ms -> ${destDir}`);
  return rec;
}

function help() {
  console.log(`E5 queue — 无子命令不 Queue。

  node queue-e5.mjs list
  node queue-e5.mjs s0 --scene A|B --n 1|2
  node queue-e5.mjs rembg [--char violet-fallen] [--person <png>]
  node queue-e5.mjs a --scene A|B --scene-png <png> --person-png <png> [--char violet-fallen]
  node queue-e5.mjs b --scene A|B --compose-png <png> [--char violet-fallen]

  合成（本机，不 Queue）：
  node ../face-gate/compose-into-scene.mjs --scene <底> --person <去底> --foot 0.5,0.74 --height 576 --out <png>

  默认受试魔化 P1。先 POST /free。全程 Krea，不要叠 WAI。`);
}

const { cmd, flags } = parseArgs(process.argv);
try {
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
  } else if (cmd === "list") {
    console.log("default char violet-fallen · alt cassandra");
    for (const id of E5_CHARS) {
      const p = PERSON[id];
      console.log(`  ${id} ${p.cell} ${p.png} exists=${fs.existsSync(p.png)}`);
    }
    console.log("scene t2i 1152x864");
    for (const s of ["A", "B"]) {
      console.log(`  S-${s} seeds ${SCENE_SEEDS[s].join(" ")}`);
      console.log(`    ${need(`scene ${s}`).replace(/\n/g, " / ")}`);
    }
    console.log(`route A seeds A ${ROUTE_A_SEED.A} / B ${ROUTE_A_SEED.B}`);
    console.log(`route B seeds A ${ROUTE_B_SEED.A} / B ${ROUTE_B_SEED.B}`);
  } else if (cmd === "s0") {
    const scene = sceneKey(flags);
    const n = Number(flags.n || 1);
    if (n !== 1 && n !== 2) throw new Error("--n 1 | 2");
    const charId = needChar(flags);
    const seed = SCENE_SEEDS[scene][n - 1];
    const g = JSON.parse(JSON.stringify(t2iTmpl));
    g["5"].inputs.text = need(`scene ${scene}`);
    g["8"].inputs.seed = seed;
    g["11"].inputs.filename_prefix = `comfy_lan_e5_scene_${scene}${n}`;
    await runJob({
      charId,
      prompt: g,
      timeoutSec: Number(flags.timeout || 300),
      recExtra: { stage: "s0", scene, n, seed, route: `s0-${scene}${n}` },
    });
  } else if (cmd === "rembg") {
    const charId = needChar(flags);
    const person = String(flags.person || PERSON[charId].png);
    const name = await uploadImage(person);
    const g = JSON.parse(JSON.stringify(rembgTmpl));
    g["1"].inputs.image = name;
    g["3"].inputs.filename_prefix = `comfy_lan_e5_cut_${charId === "violet-fallen" ? "vf" : "cas"}`;
    await runJob({
      charId,
      prompt: g,
      timeoutSec: Number(flags.timeout || 240),
      recExtra: { stage: "rembg", person, route: "rembg" },
    });
  } else if (cmd === "a") {
    const scene = sceneKey(flags);
    const charId = needChar(flags);
    const scenePng = String(flags["scene-png"] || "");
    const personPng = String(flags["person-png"] || PERSON[charId].png);
    if (!scenePng || !fs.existsSync(scenePng)) throw new Error("a 需要 --scene-png <主理人挑的场景底>");
    const sceneName = await uploadImage(scenePng);
    const personName = await uploadImage(personPng);
    const seed = flags.seed != null ? Number(flags.seed) : ROUTE_A_SEED[scene];
    const boost = flags.boost != null ? Number(flags.boost) : 4;
    const gpx = flags.gpx != null ? Number(flags.gpx) : 768;
    const g = JSON.parse(JSON.stringify(scene2Tmpl));
    g["10"].inputs.image = sceneName;
    g["12"].inputs.image = personName;
    g["40"].inputs.ref_boost = boost;
    g["41"].inputs.grounding_px = gpx;
    g["42"].inputs.grounding_px = gpx;
    g["41"].inputs.prompt = `${need(`identity ${charId}`)}\n${need(`routeA ${scene} ${charId}`)}`;
    g["8"].inputs.seed = seed;
    const tag = boost === 4 ? "A" : `A-rb${String(boost).replace(".", "")}`;
    g["11"].inputs.filename_prefix = `comfy_lan_e5_${scene}_${tag}`;
    await runJob({
      charId,
      prompt: g,
      timeoutSec: Number(flags.timeout || 420),
      recExtra: {
        stage: "s1",
        scene,
        seed,
        ref_boost: boost,
        grounding_px: gpx,
        route: "A",
        scene_png: scenePng,
        person_png: personPng,
      },
    });
  } else if (cmd === "b") {
    const scene = sceneKey(flags);
    const charId = needChar(flags);
    const composePng = String(flags["compose-png"] || "");
    if (!composePng || !fs.existsSync(composePng)) throw new Error("b 需要 --compose-png <合成图>");
    const name = await uploadImage(composePng);
    const seed = flags.seed != null ? Number(flags.seed) : ROUTE_B_SEED[scene];
    const gpx = flags.gpx != null ? Number(flags.gpx) : 512;
    const g = JSON.parse(JSON.stringify(harmTmpl));
    g["10"].inputs.image = name;
    g["41"].inputs.grounding_px = gpx;
    g["42"].inputs.grounding_px = gpx;
    g["41"].inputs.prompt = need(`routeB ${scene}`);
    g["8"].inputs.seed = seed;
    g["11"].inputs.filename_prefix = `comfy_lan_e5_${scene}_B`;
    await runJob({
      charId,
      prompt: g,
      timeoutSec: Number(flags.timeout || 420),
      recExtra: {
        stage: "s2",
        scene,
        seed,
        grounding_px: gpx,
        route: "B",
        compose_png: composePng,
      },
    });
  } else {
    help();
    process.exit(1);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
