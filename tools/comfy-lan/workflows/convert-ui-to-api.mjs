/**
 * Convert ComfyUI web-format workflow (nodes/links) to API format (node table).
 * Faithful mapping only: links -> [srcId, slot]; widget inputs <- widgets_values_named
 * (fallback: positional widgets_values). Skips Note/MarkdownNote. Reroute passthrough.
 * SaveImageAdvanced is downgraded to plain SaveImage (drops format.* keys).
 * Usage: node convert-ui-to-api.mjs <src.json> <dst.json>
 */
import fs from 'node:fs';

const [, , srcPath, dstPath] = process.argv;
if (!srcPath || !dstPath) {
  console.error('usage: node convert-ui-to-api.mjs <src.json> <dst.json>');
  process.exit(1);
}
const ui = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const nodes = new Map(ui.nodes.map((n) => [String(n.id), n]));
const links = new Map();
for (const l of ui.links || []) {
  // [id, origin_id, origin_slot, target_id, target_slot, type]
  links.set(String(l[0]), { src: String(l[1]), slot: l[2] });
}
const SKIP = new Set(['MarkdownNote', 'Note']);

function resolveLink(linkId) {
  let cur = String(linkId);
  for (let hop = 0; hop < 10; hop++) {
    const l = links.get(cur);
    if (!l) return null;
    const srcNode = nodes.get(l.src);
    if (srcNode && srcNode.type === 'Reroute') {
      const inLink = srcNode.inputs && srcNode.inputs[0] && srcNode.inputs[0].link;
      if (inLink == null) return null;
      cur = String(inLink);
      continue;
    }
    return { id: l.src, slot: l.slot };
  }
  return null;
}

const api = {};
const warnings = [];
for (const node of ui.nodes || []) {
  if (SKIP.has(node.type)) continue;
  if (node.mode && node.mode !== 0) {
    warnings.push(`skip node ${node.id} (${node.type}) mode=${node.mode}`);
    continue;
  }
  const inputs = {};
  let posIdx = 0;
  const named = node.widgets_values_named || null;
  const positional = Array.isArray(node.widgets_values) ? node.widgets_values : null;
  for (const inp of node.inputs || []) {
    if (inp.link != null) {
      const r = resolveLink(inp.link);
      if (!r) {
        warnings.push(`node ${node.id} (${node.type}) input '${inp.name}' has dangling link`);
        continue;
      }
      inputs[inp.name] = [r.id, r.slot];
      if (inp.widget && named && named[inp.widget.name] !== undefined) {
        // widget driven by a link: link wins; nothing to do
      }
      continue;
    }
    if (inp.widget && inp.widget.name) {
      const name = inp.widget.name;
      let value;
      if (named && named[name] !== undefined) {
        value = named[name];
      } else if (positional && posIdx < positional.length) {
        value = positional[posIdx++];
        warnings.push(`node ${node.id} (${node.type}) widget '${name}' fell back to positional value ${JSON.stringify(value)}`);
      } else {
        warnings.push(`node ${node.id} (${node.type}) widget '${name}' has NO value`);
        continue;
      }
      inputs[name] = value;
      continue;
    }
    warnings.push(`node ${node.id} (${node.type}) input '${inp.name}' has neither link nor widget`);
  }
  let cls = node.type;
  if (cls === 'SaveImageAdvanced') {
    cls = 'SaveImage';
    for (const k of Object.keys(inputs)) {
      if (k === 'format' || k.startsWith('format.')) delete inputs[k];
    }
  }
  api[String(node.id)] = { class_type: cls, inputs, _meta: { title: node.title || cls } };
}
fs.writeFileSync(dstPath, JSON.stringify(api, null, 2));
console.log(`nodes: ${Object.keys(api).length} -> ${dstPath}`);
if (warnings.length) {
  console.log('WARNINGS:');
  for (const w of warnings) console.log('  ' + w);
} else {
  console.log('no warnings');
}
