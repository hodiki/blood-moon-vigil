/**
 * 局域网 Comfy 薄客户端。无第三方依赖（Node 22 fetch）。
 * 默认写 _park/comfy-lan/；`--char <id>` 写 characters/<id>/_park/<ISO>/。
 * 拒绝写入 assets/frames/。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const CHAR_IDS = [
  'cassandra',
  'edmund',
  'violet-oath',
  'violet-fallen',
  'galvan',
  'oathkeeper',
];
const defaultParkRoot = path.join(
  repoRoot,
  'assets',
  'ui-menu',
  'preview',
  'locked',
  'combat-64',
  '_park',
  'comfy-lan',
);
const handshakePath = path.join(here, 'incoming', 'handshake.json');

function resolveParkRoot(flags) {
  if (!flags.char) return defaultParkRoot;
  const id = String(flags.char);
  if (!CHAR_IDS.includes(id)) {
    throw new Error(`--char 必须是: ${CHAR_IDS.join(' | ')}`);
  }
  return path.join(repoRoot, 'characters', id, '_park');
}

const NODE_PROBES = [
  'IPAdapterApply',
  'IPAdapterAdvanced',
  'IPAdapterModelLoader',
  'IPAdapterUnifiedLoader',
  'ControlNetApplyAdvanced',
  'ControlNetLoader',
  'OpenposePreprocessor',
  'DWPreprocessor',
  'Krea2ControlApply',
  'Krea2ControlLoRALoader',
  'Krea2ControlImageEncode',
  'TextEncodeKrea2OstrisEdit',
  'Krea2OstrisEditModelPatch',
  'Krea2EditModelPatch',
  'Krea2EditGroundedEncode',
  'InspyrenetRembg',
  'JoinImageWithAlpha',
  'SVD_img2vid_Conditioning',
  'VideoLinearCFGGuidance',
  'ImageOnlyCheckpointLoader',
  'WanImageToVideo',
  'WanAnimate2ToVideo',
  'WanAnimate2Cache',
  'LoadVideo',
  'GetVideoComponents',
  'CLIPVisionEncode',
  'ModelSamplingSD3',
];

function parseArgs(argv) {
  const out = { command: argv[2] || 'ping', flags: {} };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out.flags[key] = val;
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveUrl(flags) {
  if (flags.url) return String(flags.url).replace(/\/$/, '');
  if (!fs.existsSync(handshakePath)) {
    throw new Error(
      `没有 incoming/handshake.json，也没有 --url。拷到:\n${handshakePath}`,
    );
  }
  const hs = readJson(handshakePath);
  if (hs.schema !== 'comfy-lan-handshake/v1') {
    throw new Error(`handshake.schema 必须是 comfy-lan-handshake/v1`);
  }
  if (!hs.gpu?.url) throw new Error('handshake.gpu.url 为空');
  return String(hs.gpu.url).replace(/\/$/, '');
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
      /* keep text */
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function probeNodes(base, timeoutMs) {
  const found = {};
  for (const name of NODE_PROBES) {
    try {
      const r = await getJson(`${base}/object_info/${name}`, timeoutMs);
      found[name] = r.status === 200;
    } catch {
      found[name] = false;
    }
  }
  return found;
}

function setSlot(prompt, slotPath, value) {
  if (!Array.isArray(slotPath) || slotPath.length < 2) {
    throw new Error(`槽位路径无效: ${JSON.stringify(slotPath)}`);
  }
  let cur = prompt;
  for (let i = 0; i < slotPath.length - 1; i++) {
    const k = slotPath[i];
    if (cur[k] == null) {
      throw new Error(`工作流没有节点路径 ${slotPath.slice(0, i + 1).join('.')}`);
    }
    cur = cur[k];
  }
  cur[slotPath[slotPath.length - 1]] = value;
}

function assertNotFrames(dest) {
  const norm = path.normalize(dest);
  const frames = path.normalize(path.join(repoRoot, 'assets', 'frames'));
  if (norm === frames || norm.startsWith(frames + path.sep)) {
    throw new Error('拒绝写入 assets/frames/');
  }
}

function mimeForUpload(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

async function uploadImage(base, filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`参考图不存在: ${abs}`);
  const buf = fs.readFileSync(abs);
  const blob = new Blob([buf], { type: mimeForUpload(abs) });
  const fd = new FormData();
  fd.append('image', blob, path.basename(abs));
  fd.append('overwrite', 'true');
  const res = await fetch(`${base}/upload/image`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`上传失败 ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.name || path.basename(abs);
}

function collectMedia(outputs) {
  const files = [];
  for (const nodeId of Object.keys(outputs || {})) {
    const o = outputs[nodeId] || {};
    for (const key of ['images', 'gifs', 'videos']) {
      for (const img of o[key] || []) files.push(img);
    }
  }
  return files;
}

function historyHasImages(item) {
  return collectMedia(item?.outputs).length > 0;
}

async function waitHistory(base, promptId, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await getJson(`${base}/history/${promptId}`, 10000);
    const item = r.ok && r.body && r.body[promptId];
    if (item) {
      if (historyHasImages(item)) return item;
      const status = item.status || {};
      if (status.status_str === 'error') {
        throw new Error(`Comfy 失败 ${promptId}: ${JSON.stringify(status)}`);
      }
      if (status.completed && !historyHasImages(item)) {
        throw new Error(`任务完成但无输出图 ${promptId}`);
      }
    }
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error(`等待 ${promptId} 超时（${timeoutSec}s）`);
}

async function downloadOutputs(base, history, destDir) {
  assertNotFrames(destDir);
  fs.mkdirSync(destDir, { recursive: true });
  const saved = [];
  for (const img of collectMedia(history.outputs)) {
    const q = new URLSearchParams({
      filename: img.filename,
      subfolder: img.subfolder || '',
      type: img.type || 'output',
    });
    const res = await fetch(`${base}/view?${q}`);
    if (!res.ok) throw new Error(`拉图失败 ${img.filename} ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(destDir, img.filename);
    assertNotFrames(dest);
    fs.writeFileSync(dest, buf);
    saved.push(dest);
  }
  return saved;
}

async function cmdPing(flags) {
  const base = resolveUrl(flags);
  const stats = await getJson(`${base}/system_stats`, 8000);
  const nodes = await probeNodes(base, 5000);
  const report = {
    schema: 'comfy-lan-job-ping/v1',
    at: new Date().toISOString(),
    url: base,
    status: stats.status,
    ok: stats.ok,
    system_stats: stats.body,
    nodes,
  };
  const out = path.join(here, 'incoming', 'last-ping.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`GET ${base}/system_stats -> ${stats.status}`);
  console.log(
    'nodes    ' +
      Object.entries(nodes)
        .map(([k, v]) => `${k}=${v}`)
        .join(' '),
  );
  console.log(`wrote    ${out}`);
  if (!stats.ok) process.exit(1);
}

async function cmdQueue(flags) {
  const base = resolveUrl(flags);
  const wfPath = flags.workflow;
  const slotsPath = flags.slots;
  if (!wfPath || !fs.existsSync(wfPath)) {
    throw new Error('queue 需要 --workflow <API JSON>。握手通了但工作流未导出时先不要 queue。');
  }
  const raw = readJson(wfPath);
  const prompt = raw.prompt || raw;
  const slots = slotsPath && fs.existsSync(slotsPath) ? readJson(slotsPath) : {};

  if (flags.idle && slots.image_idle) {
    const name = await uploadImage(base, flags.idle);
    setSlot(prompt, slots.image_idle, name);
    console.log(`uploaded idle -> ${name}`);
  }
  if (flags['walk-a'] && slots.image_walk_a) {
    const name = await uploadImage(base, flags['walk-a']);
    setSlot(prompt, slots.image_walk_a, name);
    console.log(`uploaded walk-a -> ${name}`);
  }
  if (flags.ref && slots.image_ref) {
    const name = await uploadImage(base, flags.ref);
    setSlot(prompt, slots.image_ref, name);
    console.log(`uploaded ref -> ${name}`);
  }
  if (flags.pose && slots.image_pose) {
    const name = await uploadImage(base, flags.pose);
    setSlot(prompt, slots.image_pose, name);
    console.log(`uploaded pose -> ${name}`);
  }
  if (flags.drive && slots.video_drive) {
    const name = await uploadImage(base, flags.drive);
    setSlot(prompt, slots.video_drive, name);
    console.log(`uploaded drive -> ${name}`);
  }

  const clientId = randomUUID();
  const res = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: clientId }),
  });
  if (!res.ok) throw new Error(`排队失败 ${res.status} ${await res.text()}`);
  const queued = await res.json();
  const promptId = queued.prompt_id;
  if (!promptId) throw new Error(`排队无 prompt_id: ${JSON.stringify(queued)}`);
  console.log(`queued   ${promptId}`);

  const timeoutSec = Number(flags.timeout || 300);
  const history = await waitHistory(base, promptId, timeoutSec);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destDir = path.join(resolveParkRoot(flags), stamp);
  const saved = await downloadOutputs(base, history, destDir);
  const rec = {
    schema: 'comfy-lan-job/v1',
    at: new Date().toISOString(),
    url: base,
    prompt_id: promptId,
    char: flags.char ? String(flags.char) : null,
    dest: destDir,
    saved,
  };
  fs.writeFileSync(path.join(here, 'incoming', 'last-job.json'), JSON.stringify(rec, null, 2));
  fs.writeFileSync(path.join(destDir, 'job.json'), JSON.stringify(rec, null, 2));
  console.log(`saved    ${saved.length} -> ${destDir}`);
  if (saved.length === 0) {
    console.warn('没有输出图。检查工作流 SaveImage 节点。');
    process.exit(2);
  }
}

const { command, flags } = parseArgs(process.argv);
try {
  if (command === 'ping') await cmdPing(flags);
  else if (command === 'queue') await cmdQueue(flags);
  else throw new Error(`未知命令 ${command}（ping|queue）`);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
