/**
 * Build Krea t2i API graphs from krea2-turbo-t2i-api.json + a prompt txt.
 * Usage: node build-krea-t2i.mjs <prompt.txt> <seed> <filename_prefix> <out.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [promptPath, seedStr, prefix, outPath] = process.argv.slice(2);
if (!promptPath || !seedStr || !prefix || !outPath) {
  console.error('usage: node build-krea-t2i.mjs <prompt.txt> <seed> <prefix> <out.json>');
  process.exit(1);
}

const tmpl = JSON.parse(
  fs.readFileSync(path.join(here, 'krea2-turbo-t2i-api.json'), 'utf8'),
);
const text = fs
  .readFileSync(path.resolve(promptPath), 'utf8')
  .replace(/\s+/g, ' ')
  .trim();
tmpl['5'].inputs.text = text;
tmpl['8'].inputs.seed = Number(seedStr);
tmpl['11'].inputs.filename_prefix = prefix;
fs.writeFileSync(path.resolve(outPath), JSON.stringify(tmpl, null, 2) + '\n');
console.log(`wrote ${outPath} seed=${seedStr} prefix=${prefix} chars=${text.length}`);
