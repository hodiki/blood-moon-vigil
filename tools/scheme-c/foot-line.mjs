export function contentSpan(rgba, width, height) {
  let topY = height;
  let footY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] !== 255) continue;
      if (y < topY) topY = y;
      if (y > footY) footY = y;
    }
  }
  if (footY < 0) throw new Error('empty frame');
  return { topY, footY, span: footY - topY + 1 };
}

export function spansMatch(liveSpan, liveCanvas, blockSpan, blockCanvas) {
  return Math.abs(blockSpan / blockCanvas - liveSpan / liveCanvas) <= 1 / blockCanvas;
}

export function sameBuffer(a, b) {
  return a.length === b.length && a.equals(b);
}
