/**
 * Where the plates go, in screen pixels.
 *
 * Pure on purpose. `FiberLabels` placed its callouts by hand in world space and
 * cellGeometry.js carries a 20-line comment explaining why that only survives
 * the aspect it was fitted at — five callouts were built, rendered into DOM, and
 * landed outside the canvas at 1024 px wide. Hand-fitted coordinates cannot hold
 * across four scales, three breakpoints and a camera the director is moving, so
 * the placement is solved from the projected anchor at the size the plate
 * actually measures, and the solver is a function so the gate can prove the
 * guarantees without a browser.
 *
 * Three guarantees, and they are what the gate lane will test:
 *   1. every plate is inside the viewport,
 *   2. no two plates overlap,
 *   3. no plate covers another gizmo's anchor — a callout that hides the thing
 *      its neighbour points at is worse than no callout.
 *
 * Grid scan, 4 px step, in a window around the anchor first and the whole
 * viewport only if that window is full. Scanning the whole viewport for every
 * plate is what this started as and it cost 161 ms at 1920x1080 with seven
 * callouts — ten frames, while lane 1's director is moving the camera under it.
 * The window is what makes it 3. A ring of candidate offsets would be faster
 * still and gets stuck in exactly the case that matters, two anchors on top of
 * each other.
 */

/** Candidate spacing. 6 px quantization on a plate's corner is invisible and
 *  costs a quarter of what 4 does, and this runs while the camera moves. */
const STEP = 6;
const MARGIN = 8;
/** Half-width of the fast scan. Wide enough to hold a plate at standoff plus
 *  room to slide past a neighbour; past this the full viewport is the answer. */
const WINDOW = 168;
/**
 * Clear space between the anchor and the NEAREST EDGE of its plate — not its
 * centre. Scored from the centre, a 280 px plate placed 46 px away has its edge
 * on top of the thing it names: measured in the browser at 1918x1038, the
 * shortest leader line was 4 px, which draws as a dot and reads as a plate
 * sitting on its own subject. Below ~24 px the line stops being traceable;
 * above ~70 it is longer than the geometry and stops reading as a pointer.
 */
const STANDOFF = 34;
const GAP = 6;

const grow = (r, by) => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by });
const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const holds = (r, [px, py]) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

/**
 * @param items    [{id, anchor:[x,y], w, h}] — anchor already projected to px
 * @param viewport {w, h}
 * @returns {[id]: {x, y, line?: {x1,y1,x2,y2}}}
 */
export function layoutGizmos(items, viewport) {
  const anchors = items.map((i) => i.anchor);
  const placed = [];
  const out = {};

  // Placement order is the input's, so the same constellation lays out the same
  // way every frame. A solver that re-sorted by score would dither between
  // frames while the camera moves, which is the one thing a callout must not do.
  for (const [self, item] of items.entries()) {
    const r = solve(item, viewport, placed, anchors, self);
    placed.push(r);
    out[item.id] = { x: r.x, y: r.y, line: leader(item.anchor, r) };
  }
  return out;
}

function solve(item, viewport, placed, anchors, self) {
  const { w, h } = item;
  const [ax, ay] = item.anchor;

  // A plate wider than the screen cannot honour the margin; keeping it on screen
  // matters more than keeping it off the edge. The component caps plate width so
  // this is the safety net, not the normal path.
  const loX = w > viewport.w - 2 * MARGIN ? 0 : MARGIN;
  const hiX = Math.max(loX, (w > viewport.w - 2 * MARGIN ? viewport.w : viewport.w - MARGIN) - w);
  /* THE STAGE HAS CHROME AT BOTH ENDS. `Gizmos.jsx` shortens `h` to clear the
     transport strip at the foot; `top` is the same thing at the head, where the
     one sentence on the stage sits. Defaults to 0, which is every caller with
     nothing up there. Kept in the viewport's own coordinates rather than by
     shifting the whole solve, because the anchors and the leader lines are in
     those coordinates and a shifted solve would draw the lines to the wrong
     place. */
  const top = viewport.top ?? 0;
  const band = viewport.h - top;
  const loY = top + (h > band - 2 * MARGIN ? 0 : MARGIN);
  const hiY = Math.max(loY, (h > band - 2 * MARGIN ? viewport.h : viewport.h - MARGIN) - h);

  // Grown once, not once per candidate cell: the scan visits thousands of them
  // and the neighbours do not move while it does.
  const blocked = placed.map((p) => grow(p, GAP));
  // By index, not by identity: two callers can legitimately hand the same
  // coordinate array to two gizmos, and a reference test would then let each of
  // them park on the other's subject.
  const foreign = anchors.filter((_, k) => k !== self);

  const scan = (x0, x1, y0, y1) => {
    let best = null;
    let bestCost = Infinity;
    for (let y = y0; y <= y1; y += STEP) {
      for (let x = x0; x <= x1; x += STEP) {
        const rect = { x, y, w, h };
        if (blocked.some((p) => hits(p, rect))) continue;
        if (foreign.some((a) => holds(rect, a))) continue;

        // Anchor to the nearest point of the plate. Zero while the plate covers
        // the anchor, which the standoff term then penalises.
        const d = Math.hypot(Math.max(x - ax, 0, ax - (x + w)), Math.max(y - ay, 0, ay - (y + h)));
        // Distance from the ideal standoff, plus a slight preference for sitting
        // above the subject, which is where a reader looks for a name.
        const cost = Math.abs(d - STANDOFF) + (y + h > ay ? 6 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = rect;
        }
      }
    }
    return best;
  };

  const clampX = (v) => Math.min(Math.max(v, loX), hiX);
  const clampY = (v) => Math.min(Math.max(v, loY), hiY);
  const near = scan(clampX(ax - WINDOW), clampX(ax + WINDOW), clampY(ay - WINDOW), clampY(ay + WINDOW));
  const best = near ?? scan(loX, hiX, loY, hiY);

  if (best) return best;

  // THE ONE CASE WHERE THE THREE GUARANTEES DO NOT HOLD, stated rather than
  // hidden: the whole viewport has no free cell for this plate, so the scale has
  // been handed more gizmos than its screen fits and something has to overlap.
  // Stack down the left edge — ugly and legible beats absent, and the gate
  // should see them all crammed rather than see three of eight and call it
  // clean. Never reached at the counts the four scales carry (7 at 320 px is the
  // worst, and it places).
  return {
    x: Math.min(MARGIN, Math.max(0, viewport.w - w)),
    y: Math.min(top + MARGIN + placed.length * (h + GAP), Math.max(top, viewport.h - h)),
    w,
    h,
  };
}

/**
 * The leader line: anchor to the point where the straight run to the plate's
 * centre crosses the plate's edge. Dropped when the plate already sits over its
 * anchor, because a line with nowhere to go draws as a dot.
 */
function leader([ax, ay], r) {
  if (holds(r, [ax, ay])) return null;

  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = cx - ax;
  const dy = cy - ay;

  // Slab intersection. The entry is the LAST plane entered, not the first one
  // crossed — taking the nearer of the two per-axis crossings lands on the
  // extension of an edge rather than on the edge, which is a line that stops
  // short of the plate and points past its corner.
  const near = (lo, hi, o, d) => (d === 0 ? -Infinity : Math.min((lo - o) / d, (hi - o) / d));
  const t = Math.min(1, Math.max(near(r.x, r.x + r.w, ax, dx), near(r.y, r.y + r.h, ay, dy)));

  return { x1: ax, y1: ay, x2: ax + dx * t, y2: ay + dy * t };
}
