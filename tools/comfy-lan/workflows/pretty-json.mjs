/**
 * Pretty-print a JSON file for grepping. Usage: node pretty-json.mjs <src> <dst>
 */
import fs from 'node:fs';
const [, , src, dst] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf8'));
fs.writeFileSync(dst, JSON.stringify(data, null, 1));
console.log(`ok ${Object.keys(data).length} top-level keys`);
