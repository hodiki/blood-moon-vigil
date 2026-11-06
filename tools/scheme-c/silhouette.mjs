export function opaqueRows(rgba, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let min = width;
    let max = -1;
    let n = 0;
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] !== 255) continue;
      n += 1;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    if (n) rows.push({ y, w: max - min + 1, n, min, max });
  }
  if (!rows.length) throw new Error('empty frame');
  return rows;
}

function nearestRow(rows, y) {
  let best = rows[0];
  let bestD = Infinity;
  for (const row of rows) {
    const d = Math.abs(row.y - y);
    if (d < bestD) {
      best = row;
      bestD = d;
    }
  }
  return best;
}

export function idleIssues(rows, canvas) {
  const px = canvas / 64;
  const top = rows[0].y;
  const foot = rows[rows.length - 1];
  const span = foot.y - top + 1;
  const at = (t) => nearestRow(rows, top + t * (span - 1));
  const issues = [];

  const tip = rows[0];
  const hair = at(0.1);
  const band = (t0, t1) => rows.filter((row) => {
    const t = (row.y - top) / (span - 1);
    return t >= t0 && t <= t1;
  });
  const chestW = Math.min(...band(0.22, 0.36).map((row) => row.w));
  const topRows = rows.filter((row) => row.y <= top + span * 0.25);
  const topMax = Math.max(...topRows.map((row) => row.w));
  const taperedTip = hair.w >= tip.w + 4 * px && hair.w >= 8 * px;
  const sticksOut = topMax >= chestW + 4 * px;
  if (!taperedTip && !sticksOut) issues.push(`ponytail tip ${tip.w} hair ${hair.w} top ${topMax} chest ${chestW}`);

  const hemW = Math.max(...band(0.6, 0.85).map((row) => row.w));
  const waist = band(0.4, 0.58).find((row) => row.n < row.w && row.w > chestW && row.w < hemW);
  if (!waist) issues.push(`waist missing chest ${chestW} hem ${hemW}`);

  const hemRows = rows.filter((row) => {
    const t = (row.y - top) / span;
    return t >= 0.62 && t <= 0.84;
  });
  const hemMax = Math.max(...hemRows.map((row) => row.w));
  const hemMin = Math.min(...hemRows.map((row) => row.w));
  const hemHole = hemRows.some((row) => row.n <= row.w * 0.85);
  if (hemMax - hemMin < 3 * px && !hemHole) issues.push(`hem flat ${hemMin}-${hemMax}`);

  if (foot.w > hemW * 0.75 && foot.n > foot.w * 0.7) issues.push(`foot bar n${foot.n}/w${foot.w}`);
  return issues;
}

export function strideIssues(idleRows, walkRows, canvas) {
  const px = canvas / 64;
  const idleFoot = idleRows[idleRows.length - 1];
  const walkFoot = walkRows[walkRows.length - 1];
  const issues = [];
  const shifted = Math.abs(idleFoot.min - walkFoot.min) >= 3 * px
    || Math.abs(idleFoot.max - walkFoot.max) >= 3 * px;
  if (!shifted) issues.push('stride');
  const above = walkRows.filter((row) => row.y < walkFoot.y && row.y >= walkFoot.y - 14 * px);
  const lifted = above.some((row) => row.w >= walkFoot.w + 4 * px && row.n < row.w);
  if (!lifted) issues.push('lift');
  return issues;
}
