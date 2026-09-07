/**
 * Slots for the ENERGY floor's molecule pools. Pure; no Three.js.
 *
 * The owner's item 1 (docs/20260906-fix/energy.md §1): a pool of tokens must
 * read as ONE coherent cloud, not a random pile — hexagonal rows, a lens, the
 * same grammar for ATP / ADP / AMP at their different sizes. So a pool of 13 is
 * the tight knot at the middle of the same lattice a pool of 76 fills.
 *
 * HOW THE LATTICE IS BUILT
 *   · Hexagonal rows in x/y: columns `pitch` apart, rows `pitch·0.866` apart,
 *     odd rows shifted by `pitch/2`. `layers` such planes along z, `pitch·0.9`
 *     apart, centred on z = 0; planes an odd count away from the middle one
 *     are shifted by `pitch/2` in x so the stack packs. The middle plane's row
 *     0 / column 0 is the origin, so the lattice holds its own centre and a
 *     pool of 1 sits ON `at`.
 *   · Clipped to a lens: the ellipsoid whose semi-axes are `aspect × R`, where
 *     R is the smallest reach that holds the points — computed, not typed: the
 *     reach is grown by `pitch/4` until enough unjittered points fit, then the
 *     exact reach is the n-th smallest normalised distance (`latticeReach`).
 *   · Seeded jitter from `rnd` per point, drawn ±jitter·pitch per axis and then
 *     CLAMPED to that magnitude. Per-axis alone lets a diagonal neighbour pair
 *     close to 0.678·pitch in the worst case (both extremes toward each other
 *     along a (0.5, 0.866) row step); a magnitude bound makes every pair at
 *     least pitch·(1 − 2·jitter) apart — the invariant the test pins — instead
 *     of leaving it to the draw. MEASURED 2026-09-06, 96 slots, seeds 1–8:
 *     unclamped bottoms out at 0.742·pitch (above the 0.722 floor by luck),
 *     clamped at 0.776·pitch (by construction).
 *   · Sorted centre-out by normalised distance of the FINAL (jittered)
 *     position, ((dx/ax)² + (dy/ay)² + (dz/az)²)^½, so the output order is the
 *     order a reader sees.
 *
 * PREFIX STABILITY — the hard requirement. The first k slots for n must equal
 * the first k slots for any m > n, so a pool that grows from 13 to 76 tokens
 * (ADP through a set) adds tokens on the outside and moves none. It holds
 * because nothing about candidate generation depends on n: the lattice is
 * generated once for MAX_SLOTS, the reach grown for MAX_SLOTS, sorted once,
 * and `n` only slices. `rnd` keys on the point's (layer, row, column) id, not
 * its enumeration index, so the same lattice point always jitters the same way.
 *
 * MEASURED 2026-09-06 at pitch 0.075, default aspect/layers/jitter, seed 1:
 *   n    reach/pitch   x × y × z spread (world)   x/y   z planes used
 *   4    1.65          0.147 × 0.069 × 0.006      2.13  1
 *   13   2.18          0.302 × 0.137 × 0.014      2.21  1
 *   76   4.25          0.597 × 0.273 × 0.148      2.19  3
 *   96   4.35          0.597 × 0.273 × 0.149      2.19  3
 * Pools of 13 and under are a single plane: an outer plane sits at z = 0.9·pitch,
 * which is 2.57·pitch in normalised distance (0.9 / 0.35), beyond their reach.
 *
 * `rnd` lived in cellChainGeometry.js until 2026-09-06; it moved here
 * byte-for-byte and the geometry imports it. A different hash would reshuffle
 * every seeded position on the floor (motes, bead orientations, PCr scatter).
 */

/** The largest pool this lattice serves: the conserved nucleotide POOL (90) with
    room to spare. Every `latticeSlots` call slices a lattice built for this. */
export const MAX_SLOTS = 96;

/**
 * A deterministic 0..1 from an index and a salt. `Math.random` is the one
 * thing this must not be: two screenshots of the same frame must not differ.
 */
export function rnd(i, salt) {
  let h = Math.imul(i ^ salt, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const ROW_GAP = 0.866;
const LAYER_GAP = 0.9;

/** Normalised distance from the origin: the lens's own radial coordinate. */
const normed = ([x, y, z], [ax, ay, az]) => Math.hypot(x / ax, y / ay, z / az);

/**
 * Every unjittered lattice point with normalised distance ≤ reach, as
 * `{ p, rho, k }` — `k` the point's (layer, row, column) id, stable whatever the
 * reach, so the jitter salted from it is too.
 */
function candidates({ pitch, aspect, layers, reach }) {
  const [ax, ay] = aspect;
  const rowGap = pitch * ROW_GAP;
  const mid = (layers - 1) / 2;
  const rows = Math.ceil((ay * reach) / rowGap);
  const cols = Math.ceil((ax * reach) / pitch) + 1;
  const out = [];
  for (let l = 0; l < layers; l += 1) {
    const z = (l - mid) * pitch * LAYER_GAP;
    const layerShift = (l - Math.floor(mid)) & 1 ? pitch / 2 : 0;
    for (let r = -rows; r <= rows; r += 1) {
      const y = r * rowGap;
      const rowShift = r & 1 ? pitch / 2 : 0;
      for (let c = -cols; c <= cols; c += 1) {
        const p = [c * pitch + rowShift + layerShift, y, z];
        const rho = normed(p, aspect);
        if (rho <= reach) out.push({ p, rho, k: (l * 4096 + (r + 2048)) * 4096 + (c + 2048) });
      }
    }
  }
  return out;
}

/** The smallest reach with at least n unjittered points inside, grown by pitch/4. */
function grownReach(n, opts) {
  let reach = opts.pitch;
  while (candidates({ ...opts, reach }).length < n) reach += opts.pitch / 4;
  return reach;
}

/**
 * The reach n points need at this pitch: the semi-axes of the lens that holds
 * them are `aspect × this`. Exact — the n-th smallest normalised distance of
 * the unjittered lattice — and seed-free, so it is the same lens whatever the
 * jitter draws.
 */
export function latticeReach({ n, pitch, aspect = [1, 0.55, 0.35], layers = 3 }) {
  const opts = { pitch, aspect, layers };
  const rhos = candidates({ ...opts, reach: grownReach(n, opts) })
    .map((q) => q.rho)
    .sort((a, b) => a - b);
  return rhos[n - 1];
}

/**
 * Slots for a coherent cloud of n items: hexagonal rows in a lens, layered in
 * z, sorted centre-out — so a pool of 13 is the tight knot at the middle of the
 * same lattice a pool of 76 fills. Deterministic by seed. Returns n [x,y,z].
 */
export function latticeSlots({ at, n, pitch, aspect = [1, 0.55, 0.35], layers = 3, seed = 1, jitter = 0.12 }) {
  if (n > MAX_SLOTS) throw new RangeError(`latticeSlots: n=${n} exceeds MAX_SLOTS=${MAX_SLOTS}`);
  const opts = { pitch, aspect, layers };
  const j = jitter * pitch;
  // A jitter can move a point's normalised distance by at most j over the
  // smallest semi-axis. Enumerating 2× that beyond the grown reach guarantees
  // the MAX_SLOTS nearest JITTERED points are all among the candidates, so the
  // result does not depend on the growth step.
  const slack = 2 * (j / Math.min(...aspect));
  const pts = candidates({ ...opts, reach: grownReach(MAX_SLOTS, opts) + slack });
  const salt = Math.imul(seed, 0x9e3779b1);
  for (const q of pts) {
    let dx = (rnd(q.k, salt) * 2 - 1) * j;
    let dy = (rnd(q.k, salt + 1) * 2 - 1) * j;
    let dz = (rnd(q.k, salt + 2) * 2 - 1) * j;
    const m = Math.hypot(dx, dy, dz);
    if (m > j) {
      dx *= j / m;
      dy *= j / m;
      dz *= j / m;
    }
    q.p = [q.p[0] + dx, q.p[1] + dy, q.p[2] + dz];
    q.rho = normed(q.p, aspect);
  }
  pts.sort((a, b) => a.rho - b.rho);
  return pts.slice(0, n).map((q) => [at[0] + q.p[0], at[1] + q.p[1], at[2] + q.p[2]]);
}
