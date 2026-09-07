import test from "node:test";
import assert from "node:assert/strict";

import { MAX_SLOTS, latticeReach, latticeSlots, rnd } from "./energyLattice.js";

/* The hash as it stood in cellChainGeometry.js on 2026-09-06, copied here and
   NOT imported: that file is being rewritten in another lane and will import
   ours. If these two ever differ, every seeded position on the floor
   reshuffles — that is the failure this test exists to catch. */
function referenceRnd(i, salt) {
  let h = Math.imul(i ^ salt, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

test("rnd is the geometry's hash, byte for byte", () => {
  const pairs = [
    [0, 0], [1, 0], [0, 1], [7, 0x9e37], [13, 0x85eb], [76, 0xc2b2], [90, 0x1b7f],
    [96, 0x51ed], [1000, 0x71], [4097, 0x72], [-1, 0x73], [2 ** 31 - 1, 0x81],
    [123456789, 0x82], [42, 0x91], [42, 0x92], [42, 0x93], [5, 1], [5, 2], [5, 3], [999999, 12345],
  ];
  assert.equal(pairs.length, 20);
  for (const [i, salt] of pairs) assert.equal(rnd(i, salt), referenceRnd(i, salt), `rnd(${i}, ${salt})`);
});

/* The ATP pool's real call: 76 tokens at the geometry's token pitch. */
const AT = [-1.2, 0.55, 0.25];
const PITCH = 0.075;
const ASPECT = [1, 0.55, 0.35];
const JITTER = 0.12;
const slots = (n, extra = {}) => latticeSlots({ at: AT, n, pitch: PITCH, ...extra });

/** Normalised distance from AT — the lens's own coordinate. */
const rho = ([x, y, z]) => Math.hypot((x - AT[0]) / ASPECT[0], (y - AT[1]) / ASPECT[1], (z - AT[2]) / ASPECT[2]);

test("length n, and n = 0 is empty", () => {
  for (const n of [0, 1, 4, 13, 76, 90, MAX_SLOTS]) assert.equal(slots(n).length, n);
});

test("deterministic: two calls are equal, another seed is not", () => {
  assert.deepEqual(slots(76), slots(76));
  assert.notDeepEqual(slots(76), slots(76, { seed: 2 }));
});

test("n = 1 sits on `at` (the lattice holds its own centre), within the jitter", () => {
  const [s] = slots(1);
  for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(s[k] - AT[k]) <= JITTER * PITCH + 1e-12, `axis ${k}`);
});

test("every slot is inside the lens n needs, allowing the jitter", () => {
  // A jitter of magnitude ≤ jitter·pitch moves a point by at most that over the
  // smallest semi-axis in normalised distance.
  const margin = (JITTER * PITCH) / Math.min(...ASPECT) + 1e-12;
  for (const n of [1, 4, 13, 76, MAX_SLOTS]) {
    const reach = latticeReach({ n, pitch: PITCH });
    for (const s of slots(n)) assert.ok(rho(s) <= reach + margin, `n=${n}: ${rho(s)} > ${reach} + ${margin}`);
  }
});

test("no two slots closer than pitch·(1 − 2·jitter)·0.95", () => {
  const pts = slots(MAX_SLOTS);
  const floor = PITCH * (1 - 2 * JITTER) * 0.95;
  let min = Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    for (let k = i + 1; k < pts.length; k += 1) {
      const d = Math.hypot(pts[i][0] - pts[k][0], pts[i][1] - pts[k][1], pts[i][2] - pts[k][2]);
      if (d < min) min = d;
    }
  }
  assert.ok(min >= floor, `min pairwise ${min} < ${floor}`);
});

test("sorted centre-out: normalised distance never decreases", () => {
  const pts = slots(MAX_SLOTS);
  for (let i = 1; i < pts.length; i += 1) assert.ok(rho(pts[i]) >= rho(pts[i - 1]) - 1e-12, `slot ${i}`);
});

test("prefix-stable: the first k of n are the first k of any m > n", () => {
  const s13 = slots(13);
  const s76 = slots(76);
  const s90 = slots(90);
  assert.deepEqual(s76.slice(0, 13), s13);
  assert.deepEqual(s90.slice(0, 13), s13);
  assert.deepEqual(s90.slice(0, 76), s76);
});

test("76 at pitch 0.075 is a lens, not a ball: x spread 1.5–3× the y spread", () => {
  const pts = slots(76);
  const spread = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]));
  const ratio = spread(0) / spread(1);
  assert.ok(ratio >= 1.5 && ratio <= 3, `x/y = ${ratio}`);
  assert.ok(spread(2) < spread(1), `z spread ${spread(2)} should be the thinnest`);
});

test("more than MAX_SLOTS is a caller error, not a silent short pool", () => {
  assert.throws(() => slots(MAX_SLOTS + 1), RangeError);
});


/* THE CONFIGS THE FLOOR ACTUALLY DRAWS. The tests above pin the invariants on
   a default lattice; the geometry draws three others (review, 2026-09-06: a
   change to POOL_LATTICE's aspect or layers left every test green). Same
   invariants, on the shipped specs, at the counts the floor reaches. */
import { POOL_LATTICE, PCR_LATTICE, PI_LATTICE } from "./cellChainGeometry.js";

for (const [name, spec, n] of [["POOL", POOL_LATTICE, 90], ["PCR", PCR_LATTICE, 20], ["PI", PI_LATTICE, 40]]) {
  test(`the floor's ${name} lattice keeps the invariants at n=${n}`, () => {
    const at = [0.3, -0.2, 0.1];
    const jitter = spec.jitter ?? 0.12;
    const slots = latticeSlots({ at, n, seed: 7, ...spec });
    assert.equal(slots.length, n);
    assert.deepEqual(latticeSlots({ at, n, seed: 7, ...spec }), slots, "not deterministic");
    const floor = spec.pitch * (1 - 2 * jitter) * 0.95;
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      const d = Math.hypot(slots[i][0] - slots[j][0], slots[i][1] - slots[j][1], slots[i][2] - slots[j][2]);
      assert.ok(d >= floor, `${name}: slots ${i},${j} are ${d.toFixed(4)} apart, under ${floor.toFixed(4)}`);
    }
    const rho = (p) => Math.hypot((p[0] - at[0]) / spec.aspect[0], (p[1] - at[1]) / spec.aspect[1], (p[2] - at[2]) / spec.aspect[2]);
    for (let i = 1; i < n; i += 1) assert.ok(rho(slots[i]) >= rho(slots[i - 1]) - 1e-9, `${name}: not sorted centre-out at ${i}`);
    const few = latticeSlots({ at, n: Math.min(13, n), seed: 7, ...spec });
    assert.deepEqual(slots.slice(0, few.length), few, `${name}: not prefix-stable`);
  });
}
