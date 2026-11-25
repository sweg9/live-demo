"""Reads the map team's LiDAR scan (OBJ) and writes a clean plan: straight walls and furniture
boxes, in the dashboard frame (cm, x right, y down; see src/mocks/layout.ts).

    uv run --with numpy --with scipy --with matplotlib python -I tools/scan_to_plan.py \
        <scan.obj> public/scan/home-plan.json [--debug plan-debug.png]

The output holds numbers only: no photo, no texture, nothing that shows belongings (C-05).
Walls come from points between 1.3 m and 2.1 m above the floor (above most furniture, below the
ceiling); furniture from connected blobs of points between 0.25 m and 1.0 m, away from walls.
Values are starting values to tune (C-12).
"""

import json
import sys

import numpy as np
from scipy import ndimage

A = np.radians(34.25)
SHIFT_X, FLIP_Y, FLOOR_Z = 2.5139, 7.6875, -1.2989  # same as tools/scan-to-glb.mjs
CELL = 0.05  # m per raster cell
WALL_BAND = (1.3, 2.1)
FURN_BAND = (0.25, 1.0)
MIN_WALL = 0.5  # m: shorter runs are clutter
MERGE = 0.15  # m: parallel runs closer than this are one wall
GAP = 3  # cells a wall run may skip (doors, holes in the scan)
TALL_BLOB = 0.12  # m²: a filled blob in the wall band is tall furniture, not a wall


def load(path):
    v = np.array([[float(t) for t in l.split()[1:4]] for l in open(path) if l.startswith("v ")])
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    c, s = np.cos(A), np.sin(A)
    X = x * c - y * s + SHIFT_X
    Y = FLIP_Y - (x * s + y * c)
    return X, Y, z - FLOOR_Z


def raster(X, Y, keep, shape):
    g = np.zeros(shape, dtype=np.int32)
    i = np.clip((Y[keep] / CELL).astype(int), 0, shape[0] - 1)
    j = np.clip((X[keep] / CELL).astype(int), 0, shape[1] - 1)
    np.add.at(g, (i, j), 1)
    return g


def runs_along(mask, axis):
    """Long runs of occupied cells along rows (axis=1) or columns (axis=0): (line, start, end) in cells."""
    m = mask if axis == 1 else mask.T
    out = []
    for line in range(m.shape[0]):
        row = m[line]
        # close small gaps so a door or a hole does not split a wall
        closed = ndimage.binary_closing(row, structure=np.ones(GAP * 2 + 1)) if row.any() else row
        lab, n = ndimage.label(closed)
        for k in range(1, n + 1):
            idx = np.flatnonzero(lab == k)
            if (idx[-1] - idx[0] + 1) * CELL >= MIN_WALL:
                out.append((line, idx[0], idx[-1] + 1))
    return out


def merge(runs):
    """Groups runs on nearby parallel lines that overlap into one wall: (line, start, end, thickness)."""
    runs = sorted(runs)
    walls = []
    used = [False] * len(runs)
    for a, (la, sa, ea) in enumerate(runs):
        if used[a]:
            continue
        group = [(la, sa, ea)]
        used[a] = True
        for b in range(a + 1, len(runs)):
            lb, sb, eb = runs[b]
            if used[b] or (lb - max(g[0] for g in group)) * CELL > MERGE:
                continue
            if sb < max(g[2] for g in group) and eb > min(g[1] for g in group):
                group.append((lb, sb, eb))
                used[b] = True
        lines = [g[0] for g in group]
        walls.append((float(np.median(lines)) + 0.5, min(g[1] for g in group), max(g[2] for g in group), (max(lines) - min(lines) + 1)))
    return walls


def main():
    src, out = sys.argv[1], sys.argv[2]
    debug = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None
    X, Y, H = load(src)
    shape = (int(Y.max() / CELL) + 2, int(X.max() / CELL) + 2)

    wall = raster(X, Y, (H > WALL_BAND[0]) & (H < WALL_BAND[1]), shape) >= 2
    # Tall furniture (wardrobes, shelves) fills blobs in the wall band; walls are thin lines.
    opened = ndimage.binary_opening(wall, structure=np.ones((5, 5)))
    lab, n = ndimage.label(opened)
    tall = []
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        area = (lab[sl] == k).sum() * CELL * CELL
        if area >= TALL_BLOB:
            tall.append(sl)
    thin = wall & ~ndimage.binary_dilation(opened, iterations=1)

    walls = []
    for line, s, e, t in merge(runs_along(thin, axis=1)):  # horizontal: constant y
        walls.append({"x1": round(s * CELL * 100), "y1": round(line * CELL * 100), "x2": round(e * CELL * 100), "y2": round(line * CELL * 100), "t": max(10, round(t * CELL * 100))})
    for line, s, e, t in merge(runs_along(thin, axis=0)):  # vertical: constant x
        walls.append({"x1": round(line * CELL * 100), "y1": round(s * CELL * 100), "x2": round(line * CELL * 100), "y2": round(e * CELL * 100), "t": max(10, round(t * CELL * 100))})

    furniture = []
    for sl in tall:
        ys, xs = sl
        sel = (X >= xs.start * CELL) & (X < xs.stop * CELL) & (Y >= ys.start * CELL) & (Y < ys.stop * CELL) & (H > 0.1) & (H < 2.3)
        h = float(np.percentile(H[sel], 95)) if sel.any() else 1.9
        furniture.append(box("wardrobe", xs, ys, h))

    low = raster(X, Y, (H > FURN_BAND[0]) & (H < FURN_BAND[1]), shape) >= 2
    near_wall = ndimage.binary_dilation(thin, iterations=2) | ndimage.binary_dilation(opened, iterations=1)
    low = ndimage.binary_closing(low & ~near_wall, structure=np.ones((3, 3)))
    low = ndimage.binary_opening(low, structure=np.ones((4, 4)))
    lab, n = ndimage.label(low)
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        ys, xs = sl
        w, d = (xs.stop - xs.start) * CELL, (ys.stop - ys.start) * CELL
        if w * d < 0.25 or min(w, d) < 0.35:
            continue
        sel = (X >= xs.start * CELL) & (X < xs.stop * CELL) & (Y >= ys.start * CELL) & (Y < ys.stop * CELL) & (H > 0.1) & (H < 1.2)
        h = float(np.percentile(H[sel], 90)) if sel.any() else 0.5
        kind = "bed" if (h < 0.7 and w * d > 1.0 and max(w, d) > 1.6) else "desk" if h < 0.95 else "shelf"
        furniture.append(box(kind, xs, ys, h))

    plan = {
        "units": "cm, x right, y down, as src/mocks/layout.ts",
        "source": "LiDAR scan of 2026-11-24, tools/scan_to_plan.py",
        "ceiling": round(float(np.percentile(H, 99)) * 100),
        "walls": walls,
        "furniture": furniture,
    }
    with open(out, "w") as f:
        json.dump(plan, f, indent=1)
    print(f"{out}: {len(walls)} walls, {len(furniture)} furniture ({', '.join(sorted({b['kind'] for b in furniture}))}), ceiling {plan['ceiling']} cm")

    if debug:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Rectangle

        fig, ax = plt.subplots(figsize=(10, 12))
        band = (H > WALL_BAND[0]) & (H < WALL_BAND[1])
        ax.scatter(X[~band] * 100, Y[~band] * 100, s=0.1, c="#ccd")
        ax.scatter(X[band] * 100, Y[band] * 100, s=0.1, c="#888")
        for wl in walls:
            ax.plot([wl["x1"], wl["x2"]], [wl["y1"], wl["y2"]], c="red", lw=2)
        colors = {"bed": "tab:green", "desk": "tab:orange", "shelf": "tab:purple", "wardrobe": "tab:blue"}
        for b in furniture:
            ax.add_patch(Rectangle((b["x"], b["y"]), b["w"], b["d"], fill=False, ec=colors[b["kind"]], lw=2))
            ax.text(b["x"] + 3, b["y"] + 12, f"{b['kind']} {b['h']}", fontsize=7, color=colors[b["kind"]])
        ax.set_aspect("equal"); ax.invert_yaxis(); ax.grid(True, lw=0.3)
        plt.tight_layout(); plt.savefig(debug, dpi=80)


def box(kind, xs, ys, h):
    return {"kind": kind, "x": round(xs.start * CELL * 100), "y": round(ys.start * CELL * 100), "w": round((xs.stop - xs.start) * CELL * 100), "d": round((ys.stop - ys.start) * CELL * 100), "h": round(h * 100)}


if __name__ == "__main__":
    main()
