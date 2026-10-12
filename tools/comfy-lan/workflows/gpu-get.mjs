/**
 * GET an endpoint from the handshake GPU and save to file. Same trust pattern as run-job.mjs.
 * Usage: node gpu-get.mjs <path> <outfile>   e.g. node gpu-get.mjs /object_info incoming/object-info-full.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , rel, outArg] = process.argv;
if (!rel || !outArg) {
  console.error('usage: node gpu-get.mjs <path> <outfile>');
  process.exit(1);
}
const hs = JSON.parse(fs.readFileSync(path.join(here, '..', 'incoming', 'handshake.json'), 'utf8'));
const base = String(hs.gpu.url).replace(/\/$/, '');
const url = rel.startsWith('http') ? rel : `${base}${rel}`;
const res = await fetch(url);
const buf = Buffer.from(await res.arrayBuffer());
const out = path.resolve(outArg);
fs.writeFileSync(out, buf);
console.log(`GET ${url} -> ${res.status}, ${buf.length} bytes -> ${out}`);
if (!res.ok) process.exit(2);
