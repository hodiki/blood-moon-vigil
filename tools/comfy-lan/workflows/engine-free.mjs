/**
 * POST /free to the handshake GPU. Same trust pattern as run-job.mjs.
 * Usage: node engine-free.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hs = JSON.parse(fs.readFileSync(path.join(here, '..', 'incoming', 'handshake.json'), 'utf8'));
const base = String(hs.gpu.url).replace(/\/$/, '');
const res = await fetch(`${base}/free`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ unload_models: true, free_memory: false }),
});
console.log(`POST ${base}/free -> ${res.status} ${await res.text()}`);
