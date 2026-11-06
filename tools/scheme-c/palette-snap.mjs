// Snap a detail pass back onto the block's palette. Diffusion decoders emit
// continuous tone; at 64 px a continuous tone is mud. Snapping turns a soft
// ramp into two or three hard steps, which is what the art bible means by
// "hard colour blocks" and what survives a coverage box.
//
//   node tools/scheme-c/palette-snap.mjs <in.png> <colors.json> <out.png> [extraHex,...]
import fs from "node:fs";
import { readRgba, writeRgba } from "./read-png.mjs";

export function parsePalette(jsonPath, extra = []) {
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const hexes = Object.entries(data)
    .filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.startsWith("#"))
    .map(([, v]) => v);
  return [...new Set([...hexes, ...extra])].map((h) => {
    const v = h.replace("#", "");
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  });
}

export function snapToPalette(img, palette) {
  const out = Buffer.from(img.rgba);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const r = out[i], g = out[i + 1], b = out[i + 2];
    let best = palette[0];
    let bestD = Infinity;
    for (const c of palette) {
      // weight green a little higher: at 64 the eye reads tone, not hue
      const d = 2 * (r - c[0]) ** 2 + 4 * (g - c[1]) ** 2 + 3 * (b - c[2]) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    out[i] = best[0];
    out[i + 1] = best[1];
    out[i + 2] = best[2];
  }
  return { rgba: out, width: img.width, height: img.height };
}

// A limited palette taken from the image itself. Snapping to the block's seven
// tokens collapses every fold (islands 424 -> 43); a 12-16 colour ramp keeps the
// tonal steps and still gives hard edges after the coverage box.
export function kmeansPalette(img, k, iterations = 8) {
  const buckets = new Map();
  for (let i = 0; i < img.rgba.length; i += 4) {
    if (img.rgba[i + 3] === 0) continue;
    const key = `${img.rgba[i] >> 3},${img.rgba[i + 1] >> 3},${img.rgba[i + 2] >> 3}`;
    const slot = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    slot.n++; slot.r += img.rgba[i]; slot.g += img.rgba[i + 1]; slot.b += img.rgba[i + 2];
    buckets.set(key, slot);
  }
  const seeds = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, k)
    .map((s) => [s.r / s.n, s.g / s.n, s.b / s.n]);
  let centroids = seeds;
  for (let it = 0; it < iterations; it++) {
    const sums = centroids.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
    for (const s of buckets.values()) {
      const r = s.r / s.n, g = s.g / s.n, b = s.b / s.n;
      let best = 0, bestD = Infinity;
      centroids.forEach((c, i) => {
        const d = 2 * (r - c[0]) ** 2 + 4 * (g - c[1]) ** 2 + 3 * (b - c[2]) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      sums[best].n += s.n; sums[best].r += s.r; sums[best].g += s.g; sums[best].b += s.b;
    }
    centroids = centroids.map((c, i) => (sums[i].n ? [sums[i].r / sums[i].n, sums[i].g / sums[i].n, sums[i].b / sums[i].n] : c));
  }
  return centroids.map((c) => c.map((v) => Math.round(v)));
}

if (process.argv[1]?.endsWith("palette-snap.mjs")) {
  const [inPath, colorsPath, outPath, extraArg] = process.argv.slice(2);
  if (!inPath || !colorsPath || !outPath) {
    console.error("usage: node tools/scheme-c/palette-snap.mjs <in.png> <colors.json> <out.png> [extraHex,...]");
    process.exit(1);
  }
  const extra = extraArg ? extraArg.split(",").filter(Boolean) : [];
  const img = await readRgba(inPath);
  // colorsPath may be a number instead of a file: then take k colours from the image.
  const k = Number(colorsPath);
  const palette = Number.isFinite(k) && k > 1 ? kmeansPalette(img, k) : parsePalette(colorsPath, extra);
  const snapped = snapToPalette(img, palette);
  await writeRgba(outPath, snapped.rgba, snapped.width, snapped.height);
  const seen = new Set();
  for (let i = 0; i < snapped.rgba.length; i += 4) {
    if (snapped.rgba[i + 3]) seen.add(`${snapped.rgba[i]},${snapped.rgba[i + 1]},${snapped.rgba[i + 2]}`);
  }
  console.log(JSON.stringify({ palette: palette.length, used: seen.size }));
}
