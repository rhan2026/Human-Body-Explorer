import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import * as THREE from "three";

import { blob, trimerLobes } from "../signalling/heroForms.js";
import {
  AMPK_MORPH,
  ENERGY_CAMERA,
  ENERGY_VIEW_DIR,
  WAY_IN_AT,
  buildCellChainLevel,
  chainLift,
} from "./cellChainGeometry.js";

/* The anchor ids `energyBinding.PARTS` publishes, typed here on purpose: this
   gate is about the geometry keeping its side of the contract, and importing
   the list would let the two drift together unnoticed. `demand` is the eighth,
   added by the geometry contract for the pulse origin. */
const PART_IDS = ["atp", "pcr", "adp", "amp", "ca", "camkk2", "ampk", "demand"];

/** The binding's quantum — `ENERGY.md`: conserved nucleotide pool = 90 tokens. */
const QUANTUM_mM = 8.9205 / 90;

/** The Normal run's first sample, quantised the way `frameAt` does it. */
function frameAtT0() {
  const run = JSON.parse(
    readFileSync(new URL("../../public/scenarios/ampk_francis_soce_on.json", import.meta.url), "utf8"),
  );
  const first = (name) => run.series[name][0];
  const atp = Math.round(first("ATP") / QUANTUM_mM);
  const adp = Math.round(first("ADP") / QUANTUM_mM);
  const amp = Math.round(first("AMP") / QUANTUM_mM);
  return {
    t: first("t"),
    atp, adp, amp,
    pcr: Math.round(first("PCr") / QUANTUM_mM),
    freePi: 0,
    ca: 0,
    camkk: first("CaMKK_active_fraction"),
    ampkLevel: first("pAMPK_fraction"),
    response: 0,
    demand: 0,
    coupled: true,
    events: { hydrolysis: 0, recharge: 0, ak: 0 },
    dt: 0,
    dim: 0,
  };
}

const withCounts = (base, patch) => ({ ...base, ...patch, adp: 90 - (patch.atp ?? base.atp) - (patch.amp ?? base.amp) });

/** Run the level's own clock forward `seconds` in small wall steps. */
function settle(level, frame, seconds = 1.5) {
  for (let s = 0; s < seconds; s += 1 / 60) level.update({ ...frame, dt: 1 / 60 });
}

test("the contract exports: an oblique camera, its direction, the way-in beside AMPK", () => {
  /* The brief's shallow perspective (§6): 15–20° round, a little up, 4.7 out. */
  assert.deepEqual(ENERGY_CAMERA, [0.33, 0.42, 4.68]);
  const [x, y, z] = ENERGY_CAMERA;
  const azimuth = (Math.atan2(x, z) * 180) / Math.PI;
  const elevation = (Math.asin(y / Math.hypot(x, y, z)) * 180) / Math.PI;
  assert.ok(azimuth >= 2 && azimuth <= 8, `azimuth ${azimuth.toFixed(1)}° is outside 2–8° — owner 2026-09-07 (cell C1): the brief's 15–20° read as "tilted forward to the right"`);
  assert.ok(elevation > 3 && elevation < 12, `elevation ${elevation.toFixed(1)}°`);
  const dist = Math.hypot(x, y, z);
  assert.ok(Math.abs(dist - 4.7) < 0.05, `the wide framing's distance is ${dist}`);
  /* The direction is the camera's own, unit length — every tour shot dollies along it. */
  const l = Math.hypot(...ENERGY_VIEW_DIR);
  assert.ok(Math.abs(l - 1) < 1e-9, `ENERGY_VIEW_DIR has length ${l}`);
  ENERGY_CAMERA.forEach((v, i) => assert.ok(Math.abs(v / dist - ENERGY_VIEW_DIR[i]) < 0.01));
  assert.equal(WAY_IN_AT.length, 3);
  /* Beside AMPK, not on it — which side is the geometry's call (pass 3 moved
     it upper-left, off the route CaMKK2 now sends in from the lower right). */
  const ampk = buildCellChainLevel().anchors.find((a) => a.id === "ampk").at;
  assert.ok(Math.hypot(WAY_IN_AT[0] - ampk[0], WAY_IN_AT[1] - ampk[1]) > 0.4, "the way in stands on AMPK");
  const at = [1, 2, 3];
  assert.equal(chainLift(at), at);
});

test("anchors cover every part, every anchor is a world position, and depth is the hierarchy", () => {
  const level = buildCellChainLevel();
  const ids = level.anchors.map((a) => a.id);
  for (const id of PART_IDS) assert.ok(ids.includes(id), `no anchor for ${id}`);
  for (const a of level.anchors) {
    assert.equal(typeof a.label, "string");
    assert.equal(a.at.length, 3);
    assert.ok(a.at.every(Number.isFinite));
  }
  const at = Object.fromEntries(level.anchors.map((a) => [a.id, a.at]));
  /* Brief §6: pools a little in front, AMPK in the middle, calcium and CaMKK2 behind. */
  assert.ok(at.atp[2] > at.ampk[2] && at.ampk[2] > at.camkk2[2], "front-to-back is not pools → AMPK → calcium");
  assert.ok(at.ca[2] <= at.camkk2[2]);
  /* Brief §8: the demand anchor is on the membrane's top edge, above the ATP pool. */
  assert.ok(at.demand[1] > 1.35, `demand anchor at y ${at.demand[1]} is not on the membrane`);
  assert.ok(Math.abs(at.demand[0] - at.atp[0]) < 0.6, "the pulse does not come in above the ATP pool");
  /* One Object3D, not an array: the page mounts it as a single <primitive>. */
  const HOVER_IDS = PART_IDS.concat("pi");
  assert.ok(level.hit?.isObject3D && level.hit.children.length === HOVER_IDS.length);
  for (const id of HOVER_IDS) assert.ok(level.hit.children.some((m) => m.userData.part === id), `no hit mesh for ${id}`);
  assert.equal(level.hit.parent, null, "hit group must not be a child of the drawn group");
  level.dispose();
});

test("update(null) is the resting picture, and t0 restates it exactly", () => {
  const level = buildCellChainLevel();
  level.update(null);
  let d = level.debug();
  assert.deepEqual(d.tokens, { 3: 76, 2: 13, 1: 1 });
  assert.equal(d.pcr, 13);
  assert.equal(d.flights, 0);
  assert.equal(d.ampkResponse, 0);
  assert.equal(d.hinge, 0);
  assert.equal(d.pulses, 0);

  level.update(frameAtT0());
  d = level.debug();
  assert.deepEqual(d.tokens, { 3: 76, 2: 13, 1: 1 });
  assert.equal(d.pcr, 13);
  assert.equal(d.flights, 0, "the same counts twice launch nothing");
  level.dispose();
});

/* THE TRIMER AND ITS COLLAR ARE THE RESPONSE — the ring went on 2026-09-06 and
   the 22 % balloon with it (brief §4). The assertion is the same one in the
   object's own units: a knockout-sized response is nearly nothing, a full one
   is the whole reading, and the collar goes from nearly invisible to lit. */
test("the trimer is the response: a KO-sized response is nearly nothing, a full one is all of it", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, response: 0.02 });
  let d = level.debug();
  assert.ok(d.ampkResponse < 0.05);
  const dimCollar = d.collarOpacity;
  level.update({ ...t0, response: 1 });
  d = level.debug();
  assert.ok(Math.abs(d.ampkResponse - 1) < 1e-6);
  assert.ok(d.collarOpacity > dimCollar + 0.5, `the collar barely lit: ${dimCollar} → ${d.collarOpacity}`);
  level.dispose();
});

test("the hinge opens with camkk only once calcium has landed, and closes on a seek", () => {
  const level = buildCellChainLevel();
  level.update(null);
  const base = { ...frameAtT0(), camkk: 1, ca: 0, dt: 0.05 };
  /* The archive's fraction alone opens nothing: no calcium has crossed. */
  for (let i = 0; i < 10; i += 1) level.update({ ...base, t: 0.05 * (i + 1) });
  assert.equal(level.debug().hinge, 0, "open before any calcium landed");
  /* Calcium for 0.6 s: the first particles land after CA_TRAVEL_S (0.5 s), and
     only then does the hinge start toward camkk * HINGE_OPEN. */
  let opened = 0;
  for (let i = 0; i < 24; i += 1) {
    level.update({ ...base, ca: 25, t: 0.5 + 0.05 * (i + 1) });
    if (i === 8) opened = level.debug().hinge; // 0.45 s in: nothing has landed yet
  }
  assert.equal(opened, 0, "opened before the first landing");
  assert.ok(level.debug().hinge > 0.5, `after landings the hinge is ${level.debug().hinge}`);
  /* A seek forgets the landings: closed again until the next one. */
  level.reset();
  level.update({ ...base, t: 3 });
  assert.equal(level.debug().hinge, 0, "still open after a seek");
  level.dispose();
});

test("counts drive conversions: tokens are re-stated, flights launched, and never created or destroyed", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update(t0);

  /* A rep's worth of spending: ATP down, ADP up, PCr drawn down, a little AMP. */
  const spent = withCounts(t0, { atp: 70, amp: 3, pcr: 9 });
  level.update({ ...spent, dt: 1 / 60 });
  let d = level.debug();
  assert.deepEqual(d.tokens, { 3: 70, 2: 17, 1: 3 });
  assert.equal(d.pcr, 9);
  assert.ok(d.flights > 0, "a change in counts is drawn as beads in flight");

  settle(level, spent);
  d = level.debug();
  assert.equal(d.flights, 0, "flights land");
  assert.deepEqual(d.tokens, { 3: 70, 2: 17, 1: 3 });

  /* Rest: recovery back toward t0, including PCr refilling. */
  settle(level, t0);
  d = level.debug();
  assert.deepEqual(d.tokens, { 3: 76, 2: 13, 1: 1 });
  assert.equal(d.pcr, 13);
  assert.equal(d.flights, 0);
  level.dispose();
});

test("calcium and packets: particles appear with ca, packets travel only when coupled", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, ca: 29, dt: 1 / 60 });
  assert.ok(level.debug().ca > 0 && level.debug().ca <= 48);

  settle(level, { ...t0, camkk: 0.9, coupled: true }, 1);
  assert.ok(level.debug().packets > 0, "coupled and active: packets on the route");
  assert.equal(level.debug().routeCut, false);

  settle(level, { ...t0, camkk: 0.9, coupled: false }, 2);
  assert.equal(level.debug().packets, 0, "not coupled: nothing travels");
  assert.equal(level.debug().routeCut, true);
  level.dispose();
});

test("dim fades everything but AMPK", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, dim: 1 });
  const d = level.debug();
  assert.ok(d.dimmed > 0 && d.ampkOpacity === 1);
  assert.equal(d.weights.ampk, 1);
  assert.ok(d.weights.atp < 0.01 && d.weights.room < 0.01, `still visible under dim: ${JSON.stringify(d.weights)}`);
  level.dispose();
});

/* THE SELECTION MARK IS THE OBJECT (owner 12/13: no rings, no orange). The
   named part keeps its weight; every other part recedes into the paper, the
   room less than the parts; `null` brings everything back. */
test("spotlight: the named part stays, the rest recede, null restores", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.spotlight("atp");
  level.update({ ...t0 });
  let d = level.debug();
  assert.equal(d.spotlight, "atp");
  assert.equal(d.weights.atp, 1);
  assert.ok(d.weights.ampk < 0.5 && d.weights.camkk2 < 0.5 && d.weights.adp < 0.5, JSON.stringify(d.weights));
  assert.ok(d.weights.room > d.weights.ampk, "the room recedes less than the parts");
  assert.ok(d.ampkOpacity < 0.5, "AMPK's material did not follow its weight");
  /* Settling is eased under wall time — a frame in, nothing has snapped. */
  level.spotlight("ampk");
  level.update({ ...t0, dt: 1 / 60, wallDt: 1 / 60 });
  d = level.debug();
  assert.ok(d.weights.ampk > 0.26 && d.weights.ampk < 1, `eased, not snapped: ${d.weights.ampk}`);
  settle(level, { ...t0, wallDt: 1 / 60 }, 1);
  d = level.debug();
  assert.equal(d.weights.ampk, 1);
  assert.equal(d.ampkOpacity, 1);
  level.spotlight(null);
  level.update({ ...t0 });
  d = level.debug();
  assert.equal(d.spotlight, null);
  for (const w of Object.values(d.weights)) assert.equal(w, 1);
  /* An id that is not a part is no spotlight. */
  level.spotlight("nothing");
  assert.equal(level.debug().spotlight, null);
  level.dispose();
});

/* THE CONTRACTION ARRIVES THROUGH THE MEMBRANE (brief §8): a ripple sized by
   `demand` itself and one front per onset, launched when demand rises from
   between-reps zero; a seek clears what is in flight. */
test("demand: one front per onset, and a seek clears it", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, demand: 0, dt: 1 / 60 });
  assert.equal(level.debug().pulses, 0);
  level.update({ ...t0, demand: 0.9, dt: 1 / 60 });
  let d = level.debug();
  assert.equal(d.pulses, 1, "the onset launched no front");
  /* Still high: no second front. Back to zero and up again: the next rep's. */
  level.update({ ...t0, demand: 1, dt: 1 / 60 });
  assert.equal(level.debug().pulses, 1);
  level.update({ ...t0, demand: 0, dt: 1 / 60 });
  level.update({ ...t0, demand: 0.8, dt: 1 / 60 });
  assert.equal(level.debug().pulses, 2);
  level.reset();
  assert.equal(level.debug().pulses, 0);
  level.dispose();
});

test("the viewer's clock breathes while the run's stands still", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  const before = level.debug().phase;
  level.update({ ...t0, dt: 0, wallDt: 0.05 });
  assert.ok(level.debug().phase > before, "a held beat froze the idle drift");
  const held = level.debug().phase;
  level.update({ ...t0, dt: 0, wallDt: 0 });
  assert.equal(level.debug().phase, held, "Pause must stop everything");
  level.dispose();
});

test("the dust is cut to what the brief asked (§3: 50–70 % fewer than 132), and none stands in front of the pools", () => {
  const level = buildCellChainLevel();
  const d = level.debug();
  assert.ok(d.motes >= 40 && d.motes <= 66, `${d.motes} motes`);
  assert.ok(d.moteMaxZ < d.poolMinZ, `a mote can reach z ${d.moteMaxZ}, in front of a pool at ${d.poolMinZ}`);
  level.dispose();
});

/* A SEEK OR A CUT IS A STILL PICTURE, NOT A RECOVERY (runLoop.js). After
   reset() the first frame re-states the tokens in place; only a genuine
   conversion on a later frame flies. The review of 2026-09-06 measured 33
   flights on a seek back to t0 before this was pinned. */
test("after reset() the next frame snaps the counts into place and flies nothing", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  const spent = withCounts(t0, { atp: 61, amp: 4, pcr: 6 });
  level.update({ ...spent, dt: 1 / 60 });
  settle(level, spent);
  level.reset();
  level.update({ ...t0, dt: 1 / 60 });
  const d = level.debug();
  assert.deepEqual(d.tokens, { 3: 76, 2: 13, 1: 1 });
  assert.equal(d.pcr, 13);
  assert.equal(d.flights, 0, `a seek flew ${d.flights} beads`);
  level.dispose();
});

/* THE PULSE SPENDS THE ATP (brief §8): while the front is crossing, a count
   change waits; when it lands, the beads leave. Before this the beads led the
   front by 0.2–0.3 s in every rep (review, 2026-09-06). */
test("a count change that arrives while the front is in flight waits for it to land", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, dt: 1 / 60 });
  /* Onset: demand rises, the front leaves. Two frames later the archive drops a token. */
  level.update({ ...t0, demand: 0.9, dt: 1 / 60 });
  assert.equal(level.debug().pulses, 1);
  const spent = withCounts(t0, { atp: 75, pcr: 12 });
  level.update({ ...spent, demand: 1, dt: 1 / 60 });
  let d = level.debug();
  assert.deepEqual(d.tokens, { 3: 76, 2: 13, 1: 1 }, "the pool was spent before the front landed");
  assert.equal(d.flights, 0);
  /* The front lands (PULSE_S of run time); the held change is drawn then. */
  for (let i = 0; i < 24; i += 1) level.update({ ...spent, demand: 1, dt: 1 / 60 });
  d = level.debug();
  assert.equal(d.pulses, 0, "the front never landed");
  assert.deepEqual(d.tokens, { 3: 75, 2: 14, 1: 1 });
  assert.equal(d.pcr, 12);
  level.dispose();
});

test("AMPK's reading is colour, light and a swell inside the brief's 5–8 %", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, response: 0 });
  let d = level.debug();
  assert.ok(d.ampkEmissive < 0.01 && Math.abs(d.ampkScale - 1) < 1e-6);
  level.update({ ...t0, response: 1 });
  d = level.debug();
  assert.ok(d.ampkEmissive > 0.4, `emissive ${d.ampkEmissive}`);
  assert.ok(d.ampkScale > 1.05 && d.ampkScale <= 1.08 + 1e-9, `swell ${d.ampkScale} — the 22 % balloon is not allowed back`);
  level.dispose();
});

test("Pause freezes the hinge where it is instead of snapping it open", () => {
  const level = buildCellChainLevel();
  const base = { ...frameAtT0(), camkk: 1, ca: 25, dt: 0.05 };
  /* Spawned on the first frame, the particles land on the eleventh (0.5 s of
     travel) and the hinge starts on the twelfth; two eased steps later it is
     halfway. */
  for (let i = 0; i < 14; i += 1) level.update({ ...base, t: 0.05 * (i + 1) });
  const mid = level.debug().hinge;
  assert.ok(mid > 0 && mid < 1, `expected a hinge mid-swing, got ${mid}`);
  level.update({ ...base, dt: 0, wallDt: 0 });
  assert.equal(level.debug().hinge, mid, "Pause moved the hinge");
  level.dispose();
});

/* WHAT WAS DECIDED AGAINST, PINNED BY ABSENCE (CLAUDE.md §3): no ring
   geometry of any kind on this floor (owner item 13, the dial, Saturn's
   hoop), no additive glow (invisible on paper), and none of the two oranges
   that were the press-ring and the open-handle accents. */
test("the geometry draws no ring, no additive glow, no accent orange", () => {
  const src = readFileSync(new URL("./cellChainGeometry.js", import.meta.url), "utf8");
  for (const needle of ["RingGeometry", "AdditiveBlending", "#ff8a5c", "#b4530a"]) {
    assert.ok(!src.includes(needle), `${needle} is back in cellChainGeometry.js`);
  }
});


/* PASS 2 (2026-09-06, the six deviations): the room is furnished and the
   furniture is context — not hit-testable; AMPK's cleft actually opens; the
   ions stay bound and the sensor lets go when they leave; the lobe spec is
   imported, not copied. */
test("the room is the inside of the fibre: rods, mitochondria, a nucleus — none of them a part", () => {
  const level = buildCellChainLevel();
  const d = level.debug();
  /* Three rods, three mitochondria, one nucleus — the owner's pass 3 asked
     for "2 to 3 readable silhouettes, not a whole field" (it was 4 + 5 + 1). */
  assert.equal(d.furniture, 7, `${d.furniture} pieces of furniture — 3 rods, 3 mitochondria, 1 nucleus`);
  const parts = new Set(level.hit.children.map((m) => m.userData.part));
  for (const p of parts) assert.ok(!/myofibril|mitochondrion|nucleus/.test(p), `${p} is hit-testable`);
  level.dispose();
});

test("AMPK's cleft hinges open with the response, on the shared lobe spec", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, response: 0 });
  assert.equal(level.debug().ampkOpen, 0);
  level.update({ ...t0, response: 0.7 });
  assert.ok(Math.abs(level.debug().ampkOpen - 0.7) < 1e-9, "the morph does not follow the response");
  const src = readFileSync(new URL("./cellChainGeometry.js", import.meta.url), "utf8");
  assert.ok(!src.includes("AMPK_LOBES"), "the trimer's lobes are copied again instead of imported");
  assert.ok(/trimerLobes\(R, \{ weld: WELD(, open: OPEN)? \}\)/.test(src), "the trimer is not built from heroForms.trimerLobes");
  level.dispose();
});

/* THE SEATS ARE THE LANDINGS; THE OPENING IS THE ARCHIVE'S. Ions that land
   stay in the pocket for a while and let go; the hinge follows the CaMKK
   fraction from the first landing on. On the shipped run that fraction is 1.0
   through the set and 0.79 at the end of rest while no particle is drawn, so
   a sensor that shut when its last ion left would contradict the data. */
test("calcium stays bound in the pocket and lets go; the hinge keeps the archive's opening", () => {
  const level = buildCellChainLevel();
  const base = { ...frameAtT0(), camkk: 1, dt: 0.05 };
  for (let i = 0; i < 14; i += 1) level.update({ ...base, ca: 25, t: 0.05 * (i + 1) });
  let d = level.debug();
  assert.ok(d.caBound > 0 && d.caBound <= 4, `${d.caBound} bound`);
  assert.ok(d.hinge > 0, "landed and bound, but closed");
  /* No more calcium: the held ions let go after BOUND_S; the hinge stays at
     the fraction's opening (camkk 1 → fully open), as the archive says. */
  for (let i = 0; i < 60; i += 1) level.update({ ...base, ca: 0, t: 1 + 0.05 * i });
  d = level.debug();
  assert.equal(d.caBound, 0, "ions never let go");
  assert.ok(d.hinge > 1.0, `hinge ${d.hinge}: closed while the archive's fraction is 1`);
  /* And with the fraction low, the hinge eases toward shut regardless of seats. */
  for (let i = 0; i < 40; i += 1) level.update({ ...base, ca: 0, camkk: 0.1, t: 4 + 0.05 * i });
  assert.ok(level.debug().hinge < 0.2, "did not follow the fraction down");
  level.dispose();
});

/* THE OPENING IS A HINGE, NOT A NOTCH. `blob` samples along rays; past a
   certain `open` the α–β neck opens into a gap one sample column wide and one
   vertex drops 0.05 while its neighbours stay (review probe, 2026-09-06). The
   file's own AMPK_MORPH is rebuilt here and every ring/row neighbour pair
   must move together. */
test("the trimer's morph target moves smoothly — no single-column slit", () => {
  const { R, weld, open } = AMPK_MORPH;
  const radial = 40;
  const rings = 30;
  const opts = { seed: 1.9, dents: 0.06, radial, rings };
  const closed = blob(new THREE.MeshBasicMaterial(), trimerLobes(R, { weld }), opts).geometry.attributes.position;
  const opened = blob(new THREE.MeshBasicMaterial(), trimerLobes(R, { weld, open }), opts).geometry.attributes.position;
  assert.equal(opened.count, closed.count, "the two targets do not share a vertex order");
  const cols = radial + 1;
  const rad = (a, i) => Math.hypot(a.getX(i), a.getY(i), a.getZ(i));
  let worst = 0;
  let moved = 0;
  for (let i = 0; i < closed.count; i += 1) {
    const d = rad(opened, i) - rad(closed, i);
    moved = Math.max(moved, Math.abs(d));
    const row = Math.floor(i / cols);
    const col = i % cols;
    for (const j of [col + 1 < cols ? i + 1 : -1, row + 1 <= rings ? i + cols : -1]) {
      if (j < 0) continue;
      worst = Math.max(worst, Math.abs(d - (rad(opened, j) - rad(closed, j))));
    }
  }
  assert.ok(moved > 0.008, `the opening moves nothing (${moved.toFixed(4)})`);
  assert.ok(worst < 0.03, `a neighbour pair jumps ${worst.toFixed(4)} — the neck has torn into a slit`);
});

/* EVERY BEAD IS DRAWN AT ITS OWN SIZE. From pass 2 to the pass-3 review the
   second and third phosphates of every token were composed with the previous
   link's scale (0.0055 wide) and were invisible: ATP, ADP and AMP all showed
   one bead, and the 3/2/1 chemistry was not on screen. Read back off the
   instance matrices, not off the count. */
test("the second and third phosphates are drawn full size, not at the backbone's width", () => {
  const level = buildCellChainLevel();
  level.update(null);
  const beads = level.group.children.find((o) => o.userData.role === "phosphate");
  assert.ok(beads?.isInstancedMesh, "no phosphate population");
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  /* Token 0 is ATP (three beads): instances 0, 1, 2. */
  for (const inst of [0, 1, 2]) {
    beads.getMatrixAt(inst, m);
    m.decompose(p, q, sc);
    assert.ok(sc.x > 0.9 && sc.y > 0.9 && sc.z > 0.9, `bead ${inst} drawn at scale ${sc.x.toFixed(4)}, ${sc.y.toFixed(4)}, ${sc.z.toFixed(4)}`);
  }
  level.dispose();
});

/* PASS 4 (the owner's polish list, 2026-09-06 night). */
test("the ghost sits on the live trimer's own axis and carries an outline that sharpens with the Normal response", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...t0, coupled: false, response: 0.02, responseNormal: 0.9 });
  const d = level.debug();
  assert.deepEqual(d.ghostAt, [0, 0, 0], "the ghost is offset — it reads as a second molecule");
  assert.ok(d.ghostRimOpacity > 0.5, `rim at ${d.ghostRimOpacity} — the counterfactual has no outline`);
  level.dispose();
});

test("a calcium landing is a contact event: a snap past the fraction's opening that settles back", () => {
  const level = buildCellChainLevel();
  const base = { ...frameAtT0(), camkk: 1, dt: 0.05 };
  for (let i = 0; i < 11; i += 1) level.update({ ...base, ca: 25, t: 0.05 * (i + 1) });
  assert.equal(level.debug().snap, 0, "snapped before any landing");
  /* Spawned on frame 1 and aged from frame 2, the particles reach 0.5 s on
     frame 12 (ten additions of 0.05 come to 0.4999…, so not on 11); the
     sensor reads the seating on the frame after — a window of one, so the
     assertion accepts either frame. */
  level.update({ ...base, ca: 25, t: 0.6 });
  level.update({ ...base, ca: 25, t: 0.65 });
  const d = level.debug();
  assert.ok(d.snap > 0.5, `the first seating did not snap (${d.snap})`);
  for (let i = 0; i < 20; i += 1) level.update({ ...base, ca: 0, t: 0.6 + 0.05 * i });
  assert.ok(level.debug().snap < 0.02, "the snap did not settle");
  level.dispose();
});

test("the three rods stand at three depths — front, middle, back", () => {
  const level = buildCellChainLevel();
  const z = [...level.debug().rodDepths].sort((a, b) => b - a);
  assert.equal(z.length, 3);
  assert.ok(z[0] - z[1] >= 0.15 && z[1] - z[2] >= 0.15, `rod depths ${z.join(", ")} are not three tiers`);
  level.dispose();
});

test("a seek forgets the landing it was mid-way through: no snap or flash on the frame after reset()", () => {
  const level = buildCellChainLevel();
  const base = { ...frameAtT0(), camkk: 1, dt: 0.05 };
  for (let i = 0; i < 12; i += 1) level.update({ ...base, ca: 25, t: 0.05 * (i + 1) });
  level.reset();
  level.update({ ...base, ca: 0, t: 3 });
  const d = level.debug();
  assert.equal(d.snap, 0, "the cut frame kicked the sensor open");
  assert.equal(d.hinge, 0);
  level.dispose();
});

test("the ghost's outline follows AMPK's weight: never brighter than the molecule on the way back from a spotlight", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.spotlight("atp");
  settle(level, { ...t0, coupled: false, responseNormal: 0.9, wallDt: 1 / 60 }, 0.5);
  level.spotlight(null);
  level.update({ ...t0, coupled: false, responseNormal: 0.9, dt: 1 / 60, wallDt: 1 / 60 });
  level.update({ ...t0, coupled: false, responseNormal: 0.9, dt: 1 / 60, wallDt: 1 / 60 });
  const d = level.debug();
  assert.ok(d.ampkOpacity < 1, "the test needs AMPK mid-return");
  assert.ok(d.ghostRimOpacity <= 0.65 * d.ampkOpacity + 1e-9, `rim ${d.ghostRimOpacity} over a molecule at ${d.ampkOpacity}`);
  level.dispose();
});

/* PASS 6 (owner's sixth brief). */
test("the spotlight has three bands: the target, what stands next to it, and the far things", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.spotlight("atp");
  level.update({ ...t0 });
  const w = level.debug().weights;
  assert.equal(w.atp, 1);
  assert.ok(w.adp > 0.2 && w.adp < 0.5, `ADP is related and keeps some colour: ${w.adp}`);
  assert.ok(w.pcr > 0.2 && w.pcr < 0.5, `PCr is related: ${w.pcr}`);
  assert.ok(w.camkk2 < 0.2 && w.ca < 0.2, `the calcium side is far: ${w.camkk2}, ${w.ca}`);
  assert.ok(w.adp > w.camkk2, "related and unrelated recede the same");
  level.spotlight("ampk");
  level.update({ ...t0 });
  const v = level.debug().weights;
  /* AMPK's story neighbours are both of its inputs — the whole energy side
     and the calcium sensor — because the result pass spotlights AMPK while
     talking about the energy side. Far: the calcium entry itself. */
  assert.ok(v.amp > 0.2 && v.camkk2 > 0.2 && v.atp > 0.2 && v.adp > 0.2, `AMPK's neighbours: ${JSON.stringify(v)}`);
  assert.ok(v.ca < 0.2, `the calcium entry is far from AMPK: ${v.ca}`);
  level.dispose();
});

test("the opener's echo runs on the viewer's clock and spends nothing", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.echo();
  level.echo();
  level.update({ ...t0, dt: 0, wallDt: 0.1 });
  let d = level.debug();
  assert.equal(d.echoes, 1, "two calls made two echoes");
  assert.equal(d.pulses, 0, "the echo is not a demand front");
  assert.deepEqual(d.tokens, { 3: 76, 2: 13, 1: 1 }, "the echo spent something");
  for (let i = 0; i < 14; i += 1) level.update({ ...t0, dt: 0, wallDt: 0.1 });
  assert.equal(level.debug().echoes, 0, "the echo never faded on wall time");
  level.dispose();
});

/* AMP IS LOOSE BY PITCH, NOT BY JITTER: the first cut of pass 6 (pitch 0.1,
   jitter 0.42) put two of four AMP tokens 0.053 apart on one axis — bodies
   touching, the r3 string-of-beads defect — reproduced on seed 0x3333. */
test("the first four AMP slots never put two tokens through each other", () => {
  const level = buildCellChainLevel();
  const t0 = frameAtT0();
  level.update({ ...withCounts(t0, { atp: 60, amp: 4 }), dt: 1 / 60 });
  settle(level, withCounts(t0, { atp: 60, amp: 4 }));
  const bodies = level.group.children.find((o) => o.userData.role === "nucleotide");
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  /* The AMP tokens are the ones whose slot lattice is AMP's: read every body
     position and take the four nearest the AMP anchor. */
  const amp = level.anchors.find((a) => a.id === "amp").at;
  const pts = [];
  for (let i = 0; i < 90; i += 1) {
    bodies.getMatrixAt(i, m);
    m.decompose(p, q, sc);
    pts.push({ d: Math.hypot(p.x - amp[0], p.y - amp[1]), x: p.x, y: p.y, z: p.z });
  }
  pts.sort((a, b) => a.d - b.d);
  const four = pts.slice(0, 4);
  for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) {
    const dx = Math.abs(four[i].x - four[j].x);
    const dy = Math.abs(four[i].y - four[j].y);
    const dz = Math.abs(four[i].z - four[j].z);
    const d = Math.hypot(dx, dy, dz);
    assert.ok(d >= 0.1, `AMP tokens ${i},${j} are ${d.toFixed(3)} apart`);
    /* Side by side along the chain's axis they must clear a token's length (0.155). */
    assert.ok(!(dx < 0.16 && dy < 0.07 && dz < 0.05), `AMP tokens ${i},${j} lie along one axis ${dx.toFixed(3)} × ${dy.toFixed(3)}`);
  }
  level.dispose();
});
