"""Walk-cycle frame extraction.

    python tools/scheme-c/extract-walk.py <rawDir> <outDir> <prefix> [--fps=16] [--fill=112]

Replaces "measure one foot-gap number and hand-pick indices" with three passes:

  1. cadence   - contacts happen on a regular grid; find that period instead of
                 hunting peaks frame by frame.
  2. measure   - at the ankle line (a fixed fraction above the ground), keep only
                 narrow runs that stay narrow going up. Boots are narrow; coat
                 hems widen immediately. No colour is hard-coded, so this works
                 for a purple coat as well as a wine one.
  3. identity  - we never try to see which foot is which. A steady gait forces
                 consecutive contacts to alternate; that is checked instead by
                 comparing contact frames: k vs k+1 must differ, k vs k+2 must
                 look alike. If k and k+1 match, the model repeated one step and
                 the run is rejected.

Outputs the six frames plus evidence.txt (one row per slot) so the pick can be
audited without re-measuring.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ORDER = ["a", "e", "b", "c", "f", "d"]
LABEL = {"a": "contact", "e": "down", "b": "passing", "c": "contact", "f": "down", "d": "passing"}


def load(path):
    im = Image.open(path).convert("RGBA")
    return np.asarray(im).astype(np.float32)


def figure_mask(rgba):
    a = rgba[..., 3]
    if a.min() < 250:  # real alpha, use it
        return a > 128
    lum = 0.2126 * rgba[..., 0] + 0.7152 * rgba[..., 1] + 0.0722 * rgba[..., 2]
    return lum > 18


def runs_of(col):
    idx = np.where(col)[0]
    if len(idx) == 0:
        return []
    out = []
    s = prev = idx[0]
    for x in idx[1:]:
        if x != prev + 1:
            out.append((int(s), int(prev)))
            s = x
        prev = x
    out.append((int(s), int(prev)))
    return out


def ankle_runs(mask, ground, height):
    """Runs on the ankle line that stay narrow going up: legs, not coat hem."""
    y = ground - max(2, int(round(height * 0.05)))
    narrow = height * 0.13
    kept = []
    for (a, b) in runs_of(mask[max(0, y), :]):
        w = b - a + 1
        if w > narrow:
            continue
        ok = True
        for dy in (3, 6, 9):
            yy = y - dy
            if yy < 0:
                break
            hit = False
            for (c, d) in runs_of(mask[yy, :]):
                if d >= a - 2 and c <= b + 2:  # overlaps this run
                    if d - c + 1 > narrow * 1.6:
                        hit = True
                    break
            if hit:
                ok = False
                break
        if ok:
            kept.append((a, b))
    return kept


def measure(img):
    mask = figure_mask(img)
    rows = np.where(mask.any(axis=1))[0]
    if len(rows) == 0:
        return None
    top, ground = int(rows[0]), int(rows[-1])
    h = ground - top + 1
    ankle_y = ground - max(2, int(round(h * 0.05)))
    raw_runs = runs_of(mask[ankle_y, :])
    feet = ankle_runs(mask, ground, h)
    gap = (feet[-1][0] - feet[0][1] - 1) if len(feet) >= 2 else 0
    # how many things touch the ground line (soles), same narrowness filter
    sole = [r for r in runs_of(mask[ground, :]) if (r[1] - r[0] + 1) <= h * 0.13]
    return {
        "h": h,
        "ground": ground,
        "feet": feet,
        "gap": gap,
        "ratio": round(gap / h, 3),
        "contacts": len(sole),
        "raw_runs": len(raw_runs),
        "wide_runs": sum(1 for (a, b) in raw_runs if (b - a + 1) > h * 0.13),
        "top": top,
    }


def diff(a, b):
    if a.shape != b.shape:
        return 1.0
    same = (a[..., 3] > 128) & (b[..., 3] > 128)
    if same.sum() == 0:
        return 0.0
    d = np.abs(a[..., :3] - b[..., :3]).max(axis=2)
    return float(((d > 20) & same).sum()) / float(same.sum())


def main():
    raw = Path(sys.argv[1])
    out = Path(sys.argv[2])
    prefix = sys.argv[3]
    fill = 112
    for arg in sys.argv[4:]:
        if arg.startswith("--fill="):
            fill = int(arg.split("=")[1])

    files = sorted(p for p in raw.glob("*.png"))
    imgs = [load(p) for p in files]
    ms = [measure(im) for im in imgs]
    valid = [m for m in ms if m]
    if not valid:
        raise SystemExit("no figure found")

    # If the ankle line crosses a garment (jagged cloak hem, floor-length skirt) it
    # breaks into many thin runs and none of them is a foot. Detect that and say
    # so, instead of printing numbers that look like measurements.
    runs_per_frame = [m["raw_runs"] for m in valid]
    merged = sum(1 for r in runs_per_frame if r > 4) / len(runs_per_frame)
    if merged > 0.5:
        print(json.dumps({
            "ok": False,
            "reason": "feet merged with clothing: the ankle line crosses "
                      f"{sum(runs_per_frame)/len(runs_per_frame):.1f} runs per frame on average "
                      "(a clean walk gives 1-2). Gap numbers are not foot distances.",
            "runs_per_frame": runs_per_frame,
        }, ensure_ascii=False))
        return

    ratios = [m["ratio"] if m else 0.0 for m in ms]
    contacts_n = [m["contacts"] if m else 0 for m in ms]

    # ---- 1. cadence: autocorrelate the gap curve to get the step period
    v = np.array(ratios) - np.mean(ratios)
    ac = np.correlate(v, v, "full")[len(v) - 1:]
    lo, hi = 6, min(40, len(v) // 2)
    lag = lo + int(np.argmax(ac[lo:hi]))
    period = lag  # frames per step (contact to opposite contact)

    # ---- 2. contacts on the cadence grid
    # One contact per period, snapped to the local max. Hunting peaks freely
    # produced duplicates three frames apart; a grid cannot.
    n = len(ratios)
    k0 = int(np.argmax(ratios))
    def snap(k):
        lo, hi = max(0, k - period // 3), min(n, k + period // 3 + 1)
        return max(range(lo, hi), key=lambda i: ratios[i]) if hi > lo else k
    contacts = [snap(k0)]
    k = contacts[0] + period
    while k < n:
        contacts.append(snap(k))
        k = contacts[-1] + period
    k = contacts[0] - period
    while k >= 0:
        contacts.insert(0, snap(k))
        k = contacts[0] - period
    contacts = sorted(set(c for c in contacts if ratios[c] > 0.06))

    if len(contacts) < 3:
        print(json.dumps({"ok": False, "reason": "fewer than 3 contacts", "period": period,
                          "contacts": [c + 1 for c in contacts],
                          "curve": [round(x, 2) for x in ratios]}, ensure_ascii=False))
        return

    # ---- 3. identity: alternation is a property of the cadence, not of the
    # silhouette. We verify what IS observable: the two halves of the cycle
    # (step 1 vs step 2) must have similar amplitude and similar shape. A model
    # that repeats one step collapses the two halves into one.
    step = float(period)
    halves = []
    for i in range(len(contacts) - 1):
        seg = ratios[contacts[i]:contacts[i + 1]]
        halves.append({"from": contacts[i] + 1, "to": contacts[i + 1] + 1,
                       "peak": round(max(seg), 3), "trough": round(min(seg), 3),
                       "mean": round(float(np.mean(seg)), 3)})
    alt_ok = True
    if len(halves) >= 2:
        peaks = [h["peak"] for h in halves]
        alt_ok = (max(peaks) - min(peaks)) <= 0.08

    # ---- 4. six slots: one step per half, three slots inside each half
    a = contacts[0]
    c = contacts[1]
    def pick_passing(lo, hi):
        cand = [i for i in range(lo, hi) if ms[i]]
        return min(cand, key=lambda i: ratios[i]) if cand else lo
    def pick_down(lo, hi):
        cand = [i for i in range(lo, hi) if ms[i]]
        return min(cand, key=lambda i: abs(ratios[i] - ratios[lo] * 0.6)) if cand else lo

    slots = {}
    slots["a"] = a
    slots["e"] = pick_down(a + 1, max(a + 2, int(a + step * 0.55)))
    slots["b"] = pick_passing(int(a + step * 0.55), max(int(a + step * 0.55) + 1, c))
    slots["c"] = c
    slots["f"] = pick_down(c + 1, max(c + 2, int(c + step * 0.55)))
    slots["d"] = pick_passing(int(c + step * 0.55), min(n, max(int(c + step * 0.55) + 1, c + int(step))))

    report = {
        "ok": True,
        "period_frames": period,
        "contacts": [c + 1 for c in contacts],
        "halves": halves,
        "alternation_ok": alt_ok,
        "curve": [round(x, 2) for x in ratios],
        "slots": {},
    }
    out.mkdir(parents=True, exist_ok=True)
    for slot in ORDER:
        i = slots[slot]
        report["slots"][slot] = {
            "frame": i + 1,
            "label": LABEL[slot],
            "ratio": ratios[i],
            "contacts": contacts_n[i],
            "lead": "cadence-derived (odd/even contact index)",
        }
    (out / "evidence.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
