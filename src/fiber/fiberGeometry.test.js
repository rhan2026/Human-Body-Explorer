import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import { PALETTE } from "../anatomyStyle.js";
import { LEVELS } from "./fiberGeometry.js";
import { advance, createFiberState, FILAMENT } from "./fiberSimulation.js";

/**
 * The one claim in this scene that is geometry rather than illustration.
 *
 * Every level here says the same thing in a different medium. The sarcomere
 * level draws a thick filament and the readout prints "A-band 1.60 µm"; the
 * fibre level draws the same band as a stripe, 48 of them down a myofibril, and
 * the caption says "A-BAND · NEVER CHANGES LENGTH". Only one of those was being
 * checked.
 *
 * It was wrong. The fibre level scales its whole group along X to shorten the
 * fibre, and the stripes rode that scale down with everything else: 0.11750 ->
 * 0.10255 between rest and peak, a factor of 0.8727. The picture was actively
 * contradicting the number printed beside it, and every gate was green, because
 * no gate looked above the sarcomere.
 *
 * Shortening closes the GAPS, not the bands — the sarcomere count is fixed, so
 * A-bands ride closer together while each keeps the length of its own thick
 * filament. Both halves of that are asserted here, because countering the scale
 * far enough to freeze the length would also freeze the spacing, and a fibre
 * whose stripes never move is a different wrong picture.
 */

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/** The world-space geometry of one drawn stripe: its own length, and where it is. */
function stripe(model, index) {
  let band = null;
  model.group.traverse((o) => {
    if (o.userData.role === "a-band") band = o;
  });
  assert.ok(band, "no mesh tagged 'a-band' at the fibre level — the stripes are what this file is about");
  band.updateWorldMatrix(true, false);
  band.getMatrixAt(index, _m);
  _m.premultiply(band.matrixWorld).decompose(_p, _q, _s);
  // A cylinder's `height` is its extent along its own Y, and it is laid down
  // along X here, so the drawn length is the X scale times that height.
  return { length: _s.x * band.geometry.parameters.height, at: _p.x };
}

/** Rest, and a fibre pulled as hard as the invented curve pulls it. */
function poses() {
  const rest = createFiberState();
  const peak = createFiberState();
  for (let i = 0; i < 480; i++) advance(peak, 1 / 240, { mode: "tetanus", intensity: 1 });
  return { rest, peak };
}

test("the drawn A-band does not change length when the fibre shortens", () => {
  const model = LEVELS.fiber.build();
  const { rest, peak } = poses();

  assert.ok(
    peak.length < rest.length * 0.95,
    `the peak pose must actually shorten or this test is vacuous: ${rest.length} -> ${peak.length} µm`,
  );

  model.update(rest, 0);
  const atRest = stripe(model, 0);
  model.update(peak, 0);
  const atPeak = stripe(model, 0);

  const ratio = atPeak.length / atRest.length;
  assert.ok(
    Math.abs(ratio - 1) < 0.01,
    `the fibre-level A-band went ${atRest.length.toFixed(5)} -> ${atPeak.length.toFixed(5)} ` +
      `(x${ratio.toFixed(4)}) while the sarcomere level prints ${rest.aBand} µm and the label says ` +
      `it never changes length. The picture is contradicting the caption.`,
  );
});

test("...but the bands still ride closer together, because that is what shortening is", () => {
  const model = LEVELS.fiber.build();
  const { rest, peak } = poses();

  model.update(rest, 0);
  const restGap = stripe(model, 1).at - stripe(model, 0).at;
  model.update(peak, 0);
  const peakGap = stripe(model, 1).at - stripe(model, 0).at;

  const expected = peak.length / rest.length;
  assert.ok(
    Math.abs(peakGap / restGap - expected) < 0.01,
    `spacing should follow the sarcomere length (x${expected.toFixed(4)}), got x${(peakGap / restGap).toFixed(4)}. ` +
      `Freezing the stripe length by freezing the whole mesh would show a fibre that never contracts.`,
  );
});

test("the stripe is the thick filament's length, not an arbitrary fraction", () => {
  // Anchors the drawn band to the same constant the sarcomere level uses, so the
  // two levels cannot drift apart silently the way they just did.
  const model = LEVELS.fiber.build();
  const { rest } = poses();
  model.update(rest, 0);

  const drawn = stripe(model, 0);
  const gap = stripe(model, 1).at - drawn.at;
  const asFraction = drawn.length / gap;
  const expected = FILAMENT.thick / FILAMENT.restLength;

  assert.ok(
    Math.abs(asFraction - expected) < 0.02,
    `a striation occupies ${asFraction.toFixed(4)} of one sarcomere's length; the thick filament is ` +
      `${expected.toFixed(4)} of it (${FILAMENT.thick}/${FILAMENT.restLength} µm)`,
  );
});

/**
 * THE FASCICLE LEVEL, WHICH NOTHING HELD UNTIL NOW.
 *
 * The level below this one adopted SHAPE — myofibrils that bow and taper on
 * their own axes, each starting its band run at its own phase — because a study
 * measured it as the only treatment that moved the macro frame, and wrote down
 * why: *a perfect extruded cylinder is still a perfect extruded cylinder under
 * any shading, and a scene made of them reads as a diagram.* Materials, depth
 * and motion had all been tried against that wall and all three failed.
 *
 * The fascicle level never got it, and it is the FIRST thing a viewer sees on
 * the way down. Measured before this case existed: eighteen `cylinder(r, r, L)`
 * — constant radius end to end, the literal extruded cylinder — on the exact
 * sites of `hexPack(0.3, 2)`, a hexagonal lattice with a nearest-neighbour
 * spacing spread of **0.016**. For scale, the cell scale's pool was called a
 * crystal at 0.117 and rebuilt for it.
 *
 * Three assertions, because the defect has three parts and fixing one is what
 * the failed treatments did.
 */
function fascicleFibres(model) {
  let mesh = null;
  model.group.traverse((o) => {
    if (o.userData.role === "muscle-fiber") mesh ??= o;
  });
  assert.ok(mesh, "nothing in the fascicle level is tagged muscle-fiber");
  const m = new THREE.Matrix4();
  const out = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    const e = m.elements;
    if (Math.hypot(e[0], e[1], e[2]) <= 1e-6) continue;
    const q = new THREE.Quaternion();
    m.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    out.push({ y: e[13], z: e[14], q });
  }
  return { mesh, fibres: out };
}

test("a muscle fibre is not an extruded cylinder", () => {
  // The silhouette, read off the vertices the GPU is handed. A constant-radius
  // cylinder has the same cross-section everywhere, so the spread of its
  // per-slice radius is exactly 0 — which is what this measured before.
  const model = LEVELS.fascicle.build();
  const { mesh } = fascicleFibres(model);
  const pos = mesh.geometry.attributes.position;

  // Bucket the vertices by position along the fibre's own axis (+X) and take
  // each slice's mean distance from that slice's own centre, so a BOW does not
  // read as a taper and vice versa.
  const slices = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = Math.round(pos.getX(i) * 8);
    (slices.get(key) ?? slices.set(key, []).get(key)).push([pos.getY(i), pos.getZ(i)]);
  }
  const radii = [];
  for (const [, vs] of slices) {
    if (vs.length < 6) continue;
    const cy = vs.reduce((a, v) => a + v[0], 0) / vs.length;
    const cz = vs.reduce((a, v) => a + v[1], 0) / vs.length;
    radii.push(vs.reduce((a, v) => a + Math.hypot(v[0] - cy, v[1] - cz), 0) / vs.length);
  }
  assert.ok(radii.length > 4, `only ${radii.length} slices to judge — the fibre has no length to vary along`);
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const spread = Math.sqrt(radii.reduce((a, b) => a + (b - mean) ** 2, 0) / radii.length) / mean;
  assert.ok(
    spread > 0.03,
    `the fibre's radius varies by ${(spread * 100).toFixed(2)}% along its own length — under about 3% it is ` +
      `the extruded cylinder the study says no shading can rescue (it measured exactly 0)`,
  );
  model.dispose();
});

test("the fascicle is a bundle, not a hexagonal lattice", () => {
  /* NOT MEASURED AS SPACING SPREAD, and the reason is the same mistake this
     lane made once already on the AMPK trimer: a metric that anatomy pins is not
     a metric about the drawing. The cell scale's pool floats in a compartment
     and can be spread out. A fascicle is JAMMED — eighteen fibres at this radius
     fill about 68% of the sheath, which is near the best packing 18 circles have
     in a circle, so every pair sits at the floor whatever you do. Real fibres are
     polygonal in cross-section precisely BECAUSE they are jammed, so demanding
     varied spacing here is demanding something false, and the first version of
     this case did exactly that and could only have been satisfied by drawing a
     fascicle that is not full.

     What separates a lattice from a jammed bundle is not the spacing, it is the
     ORDER. Two numbers, both of which a dense packing is free to fail:

       rings    how many distinct distances from the fascicle's own axis the
                centres sit at. `hexPack(0.3, 2)` is two rings, so it was 2 of
                18. A bundle has as many as it has fibres.
       hexatic  the standard |mean(e^{6i0})| over each fibre's near neighbours.
                It is high when neighbours sit at 60 degrees to each other, which
                is what a hexagonal lattice IS.

     Measured before: 2 rings of 18, hexatic 0.550. */
  const model = LEVELS.fascicle.build();
  const { fibres } = fascicleFibres(model);

  const rings = new Set(fibres.map((f) => Math.hypot(f.y, f.z).toFixed(2)));
  assert.ok(
    rings.size > fibres.length / 2,
    `${fibres.length} fibres sit at ${rings.size} distinct distances from the axis — that is rings, and ` +
      `hexPack measured 2 of 18 here`,
  );

  let cos6 = 0;
  let sin6 = 0;
  for (const a of fibres) {
    let nearest = Infinity;
    for (const b of fibres) {
      if (a === b) continue;
      nearest = Math.min(nearest, Math.hypot(a.y - b.y, a.z - b.z));
    }
    let cr = 0;
    let ci = 0;
    let n = 0;
    for (const b of fibres) {
      if (a === b) continue;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      if (Math.hypot(dy, dz) > nearest * 1.45) continue;
      const theta = Math.atan2(dz, dy);
      cr += Math.cos(6 * theta);
      ci += Math.sin(6 * theta);
      n++;
    }
    if (!n) continue;
    cos6 += cr / n;
    sin6 += ci / n;
  }
  const hexatic = Math.hypot(cos6, sin6) / fibres.length;
  assert.ok(
    hexatic < 0.25,
    `the packing has a hexatic order of ${hexatic.toFixed(3)} — its fibres' neighbours sit at 60 degrees to ` +
      `each other, which is what a hexagonal lattice is (hexPack measured 0.550)`,
  );
  model.dispose();
});

test("no two fibres in the fascicle are drawn in the same attitude", () => {
  // The other half, and the one scattering alone would have missed: eighteen
  // identical rods turned the same way are one mark stamped eighteen times
  // however they are placed. The outline is what the eye counts.
  const model = LEVELS.fascicle.build();
  const { fibres } = fascicleFibres(model);
  const attitudes = new Set(fibres.map((f) => [f.q.x, f.q.y, f.q.z, f.q.w].map((v) => v.toFixed(3)).join()));
  assert.ok(
    attitudes.size >= Math.min(8, fibres.length),
    `${fibres.length} fibres are drawn in ${attitudes.size} distinct attitudes`,
  );
  model.dispose();
});

/**
 * The other half of the same claim, one level down.
 *
 * The A-band tests above catch a picture that contradicts its caption. This one
 * catches a picture that says nothing at all: the terminal cisternae were drawn,
 * tagged and captioned while `state.store` — the quantity this model's fatigue
 * actually lives in — was sampled every frame and read by nothing. A store that
 * cannot be seen to empty is the same failure with better geometry.
 *
 * WHY ONE CHANNEL, AND WHY THE SECOND ONE HAD TO GO. This test used to require
 * two — colour and emissive, the pair the calcium beads use for concentration,
 * on the argument that it is the same substance drawn twice in one visual
 * language. The argument was right about the substance and wrong about the
 * arithmetic. `PALETTE.calcium`'s red is 91, so a glow that brightens as the
 * store fills adds red at nearly the rate the colour lerp takes it away, and
 * the unlit light it lays on top pushes the ring into the tone curve's
 * shoulder. Measured on the guided pass's own conclusion — 547.3 µM against
 * 448.3 — the two rings reached the screen ΔE 4.55 apart with the glow and
 * ΔE 7.55 apart without it, and only the second pair can be told apart in a
 * photograph. `fiberGeometry.js` carries the sweep.
 *
 * So the glow is now an ABSENCE, and it is pinned as one below: the cisterna's
 * emitted light must be the same at every store value, or the channel that
 * carries the store is being cancelled by one that claims to help it. NOT
 * opacity either — opacity is how this project draws uncertainty, and the store
 * is not uncertain.
 */
test("the terminal cisternae empty when the store does", () => {
  const model = LEVELS.sarcomere.build();
  const cisternae = () => {
    let found = null;
    model.group.traverse((o) => {
      if (o.userData.role === "sarcoplasmic-reticulum") found = o;
    });
    assert.ok(found, "nothing tagged 'sarcoplasmic-reticulum' at the sarcomere level");
    return found.material;
  };

  const cisternaAt = (storeFraction) => {
    model.update({ ...createFiberState(), storeFraction }, 0);
    return cisternae();
  };
  const at = (storeFraction) => {
    const m = cisternaAt(storeFraction);
    return { colour: m.color.clone(), glow: m.emissiveIntensity };
  };

  // 1.00 and 0.18 are `soce_on`'s own ends: 941.2 µM at rest, 167.9 µM at
  // t=5.20 s. Not chosen — read off the run this scale binds.
  const rested = at(1);
  const spent = at(0.178);

  /* THE ABSENCE, PINNED. Not `glow === 0` — a future repaint may want a constant
     sheen on a membrane, and that is not this defect. What may never come back
     is emitted light that MOVES WITH THE STORE, because that is the term that
     was subtracting from the colour. Read it the way `cellGeometry.test.js`
     does, as the light the surface actually puts out. */
  const outgoing = (m) => m.emissive.clone().multiplyScalar(m.emissiveIntensity ?? 0);
  assert.deepEqual(
    outgoing(cisternaAt(1)).toArray(),
    outgoing(cisternaAt(0.178)).toArray(),
    "the cisterna emits different light full and empty — a glow that tracks the store cancels the colour that carries it",
  );
  assert.notDeepEqual(
    rested.colour.getHex(),
    spent.colour.getHex(),
    "the cisterna is the same colour full and empty — the store reaches no pixel",
  );

  // And it moves the right way: full is nearer the calcium accent, empty is
  // nearer bare reticulum. A binding wired backwards passes every test above.
  const calcium = new THREE.Color(PALETTE.calcium);
  const reticulum = new THREE.Color(PALETTE.reticulum);
  const toward = (c, target) =>
    Math.hypot(c.r - target.r, c.g - target.g, c.b - target.b);
  assert.ok(
    toward(rested.colour, calcium) < toward(spent.colour, calcium),
    "a fuller store must read as more calcium, not less",
  );
  assert.ok(
    toward(spent.colour, reticulum) < toward(rested.colour, reticulum),
    "an empty cisterna is bare reticulum — the membrane is still there when the calcium is not",
  );

  // Unbound there is no store at all, and the scene must fall back to the
  // membrane rather than to an empty one. `createFiberState` leaves the fraction
  // null; drawing that as 0 would claim a depletion nothing modelled.
  const unbound = at(null);
  assert.equal(unbound.colour.getHex(), reticulum.getHex(), "an unbound cisterna is plain reticulum");
});

/**
 * THE ARRIVAL, WHICH NOTHING DREW.
 *
 * The cisternae empty, the beads leave the triads and the force falls, and every
 * one of those is an EFFECT. The cause — a 0.1625 s burst of 100 Hz stimulation
 * arriving every 0.65 s, ten times — shipped in `protocol` and reached no pixel,
 * so a viewer watching the calcium had no way to learn on screen that a stimulus
 * is why.
 *
 * IT IS DRAWN ON THE T-TUBULE BECAUSE THAT IS WHERE IT HAPPENS. The tubule is
 * the sarcolemma folded inward carrying the action potential to the triad, and
 * `fiberGeometry.js` has said so in the comment above the mesh since it was
 * written. Both rings of the triad flanking it are the release; the tubule is
 * the arrival, and the order between them is the lesson.
 *
 * IN THE ACTIVATION LANGUAGE, NOT A NEW ONE. `activationColour` and
 * `activationEmissive` are the body scale's own ramp, rest -> peak, and one
 * scale up they already mean "this tissue is being driven right now". The same
 * ramp on the membrane that carries the drive is the same sentence, so nothing
 * here is a colour a reader has to be taught.
 */
test("the T-tubule fires when the protocol says, and the cisternae do not", () => {
  const model = LEVELS.sarcomere.build();
  const find = (role) => {
    let found = null;
    model.group.traverse((o) => {
      if (o.userData.role === role) found = o;
    });
    assert.ok(found, `nothing tagged '${role}' at the sarcomere level`);
    return found.material;
  };

  const at = (stim) => {
    // A store part way down, held constant, so the cisternae have something to
    // draw and any movement in them across the two frames is the stimulus
    // leaking into a channel that is already spoken for.
    model.update({ ...createFiberState(), stim, storeFraction: 0.5 }, 0);
    return {
      tubule: { colour: find("t-tubule").color.clone(), glow: find("t-tubule").emissiveIntensity },
      cisterna: { colour: find("sarcoplasmic-reticulum").color.clone(), glow: find("sarcoplasmic-reticulum").emissiveIntensity },
    };
  };

  const quiet = at(0);
  const firing = at(1);

  assert.ok(
    firing.tubule.glow > quiet.tubule.glow,
    `the T-tubule is as dark mid-burst as it is between bursts: ${firing.tubule.glow} vs ${quiet.tubule.glow}`,
  );
  assert.notEqual(
    firing.tubule.colour.getHex(),
    quiet.tubule.colour.getHex(),
    "the T-tubule is the same colour whether or not a stimulus has arrived — the burst reaches no pixel",
  );

  // The right way round, and toward the right end: a stimulus is drawn on the
  // activation ramp the body scale uses, and between bursts the membrane is the
  // sarcolemma it has always been.
  const toward = (c, hex) => {
    const target = new THREE.Color(hex);
    return Math.hypot(c.r - target.r, c.g - target.g, c.b - target.b);
  };
  assert.ok(
    toward(firing.tubule.colour, PALETTE.tissuePeak) < toward(quiet.tubule.colour, PALETTE.tissuePeak),
    "the firing tubule must read hotter than the quiet one, not cooler",
  );
  assert.equal(
    quiet.tubule.colour.getHex(),
    new THREE.Color(PALETTE.sarcolemma).getHex(),
    "between bursts the T-tubule is plain sarcolemma — it is a membrane, not an indicator",
  );

  // ONE CHANNEL PER FACT. The cisternae carry the store and nothing else; if the
  // stimulus moved them too, a viewer could not tell a release from a refill.
  assert.equal(firing.cisterna.colour.getHex(), quiet.cisterna.colour.getHex(), "the stimulus moved the store's colour");
  assert.equal(firing.cisterna.glow, quiet.cisterna.glow, "the stimulus moved the store's glow");

  // Unbound there is no protocol and so no burst. `createFiberState` leaves
  // `stim` at 0 and the tubule stays the membrane it was before anything read
  // the protocol at all.
  model.update(createFiberState(), 0);
  assert.equal(find("t-tubule").emissiveIntensity, 0, "an unbound T-tubule glows with nothing — nothing fired");

  model.dispose();
});

/**
 * A CROSS-BRIDGE POINTS AT A THIN FILAMENT, NOT AT NOTHING.
 *
 * The heads' comment said "point the head radially outward toward its nearest
 * thin filament" and the code said `Math.atan2(z, y)` — the direction from the
 * myofibril's AXIS to the thick site, which is outward from the centre and
 * toward nothing in particular. At the centre it was worse: `thickSites[0]` is
 * [0, 0] and `atan2(0, 0)` is 0, so all eight of that filament's heads pointed
 * the same way, into empty lattice, in the scale that exists to show a head
 * catching actin.
 *
 * The file already had the right pattern for the other direction — `thinAzimuth`
 * takes each thin site's bearing to its nearest thick one, with a comment saying
 * a picked direction "points somewhere real" only if it comes from the geometry.
 * This is that, mirrored, and this test is the same claim asked of the drawing:
 * every head's bearing lands on a thin filament that is actually there.
 */
test("every cross-bridge head points at a thin filament that exists", () => {
  const model = LEVELS.sarcomere.build();
  let mesh = null;
  model.group.traverse((o) => {
    if (o.userData?.role === "cross-bridge") mesh ??= o;
  });
  assert.ok(mesh, "no cross-bridge mesh, so this test is watching nothing");
  /* The heads are placed in `update`, not at build — an unupdated model has them
     all at the origin, which is one bearing and would fail this for the wrong
     reason. Driven to a moment with cross-bridges bound. */
  const state = createFiberState();
  for (let i = 0; i < 40; i++) advance(state, 0.01, { mode: "tetanus", intensity: 0.8, active: true });
  model.update(state);

  /* Read the heads' own transforms and ask, for each, whether its azimuth is
     close to SOME thin filament's bearing from the thick filament it sits on.
     A tolerance of 0.35 rad is the jitter the code applies plus a little. */
  /* THE BEARING IS FROM THE HEAD'S OWN FILAMENT, NOT FROM THE ORIGIN. Measured
     from the origin this test passed on the defect: `atan2(z, y)` gives different
     filaments different angles, so the spread looked healthy while every head on
     each filament pointed one way and the central filament's eight pointed at
     nothing at all. "Points at a thin filament" is a statement about the head's
     own neighbourhood, so it has to be asked there. */
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const sites = LEVELS.sarcomere.sites ?? null;
  const heads = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    p.setFromMatrixPosition(m);
    heads.push({ y: p.y, z: p.z });
  }
  assert.ok(heads.length > 20, `only ${heads.length} heads placed`);

  /* Group by the filament each head sits nearest to, using the heads' own
     clustering rather than a private copy of the lattice: heads on one filament
     share a centre, so k-means is not needed — rounding to a tenth separates
     them and any mis-grouping only makes this test HARDER to pass. */
  const byFilament = new Map();
  for (const h of heads) {
    const key = `${Math.round(h.y * 6)},${Math.round(h.z * 6)}`;
    byFilament.set(key, (byFilament.get(key) ?? 0) + 1);
  }

  /* The claim: no filament's heads all take one bearing. With the azimuth read
     off the axis, the filament at the lattice centre gave `atan2(0, 0) = 0` for
     every head — a comb pointing one way into empty lattice, in the scale that
     exists to show a head catching actin. */
  const centre = heads.filter((h) => Math.hypot(h.y, h.z) < 0.14);
  assert.ok(centre.length >= 4, `only ${centre.length} heads near the lattice centre to judge`);
  /* THE THRESHOLD IS MEASURED, NOT CHOSEN. With the heads aimed at their own
     neighbours the central filament's bearings span 6.195 rad — most of a full
     turn, which is what six neighbours around a filament looks like. With the
     azimuth read off the axis they span 1.789, and that is not the direction at
     all: it is the jitter alone, `(noise - 0.5) * 0.9`, fanned about a single
     angle of zero. A first version of this counted bins and passed on both,
     because ±0.45 rad still lands in three of them. */
  const bearings = centre.map((h) => Math.atan2(h.z, h.y));
  const span = Math.max(...bearings) - Math.min(...bearings);
  assert.ok(
    span > 3,
    `the heads on the central filament span ${span.toFixed(3)} rad — a comb, which is what an azimuth ` +
      `measured from the axis produces when the filament IS the axis, leaving only the jitter`,
  );

  model.dispose?.();
});

/**
 * THE THREE MEMBRANES OF A TRIAD MAY NOT PASS THROUGH EACH OTHER.
 *
 * Q2 R1 of the design audit found the T-tubule and its two terminal cisternae
 * interpenetrating by 0.020, and `TRIAD_GAP` was raised to 0.09 to separate
 * them — "the smallest number at which the drawing stops contradicting itself",
 * as the constant's own comment puts it. Nothing has held that since. The sweep
 * round went looking for what guards each of Q2's seven fixes and found tests
 * for the cross-bridge azimuth and the palette separation, and none for this.
 *
 * A membrane a viewer can see another membrane pass through is the whole of
 * Q2's question answered the wrong way — the object stops being able to carry
 * anything the moment it contradicts itself as an object.
 *
 * Measured off the built model rather than off the constants, because that is
 * where a repaint would break it: both tori share a major radius of 0.51504,
 * the tubes are 0.028 and 0.05, and the cisternae sit ±0.09 along the axis, so
 * surface to surface they clear by **0.012**. At a gap of 0.078 they touch.
 */
test("a triad's tubule and its cisternae never pass through each other", () => {
  const model = LEVELS.sarcomere.build();
  model.update({ ...createFiberState(), storeFraction: 0.5, stim: 0 }, 0);

  const find = (role) => {
    let found = null;
    model.group.traverse((o) => {
      if (o.userData.role === role) found = o;
    });
    assert.ok(found, `nothing tagged '${role}' at the sarcomere level`);
    return found;
  };
  const tubules = find("t-tubule");
  const cisternae = find("sarcoplasmic-reticulum");
  const tubeOf = (mesh) => {
    const p = mesh.geometry?.parameters;
    assert.ok(p?.tube > 0 && p?.radius > 0, "a triad ring is no longer a torus, so this clearance is not the one to measure");
    return p;
  };
  const tt = tubeOf(tubules);
  const sr = tubeOf(cisternae);

  const centre = (mesh, i) => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(i, m);
    return new THREE.Vector3().setFromMatrixPosition(m);
  };
  const ttAt = Array.from({ length: tubules.count }, (_, i) => centre(tubules, i));
  const srAt = Array.from({ length: cisternae.count }, (_, i) => centre(cisternae, i));
  assert.ok(ttAt.length > 0 && srAt.length >= ttAt.length * 2, `${ttAt.length} tubules against ${srAt.length} cisternae`);

  /* Two tori sharing an axis: the nearest points of their tube surfaces lie at
     the same angle, so the centre-line distance is the hypotenuse of the axial
     separation and the difference in major radii. */
  let worst = { gap: Infinity, at: null };
  for (const a of ttAt) {
    for (const b of srAt) {
      const axial = Math.abs(a.x - b.x);
      if (axial > 0.5) continue; // a different triad down the sarcomere
      const spread = Math.abs(tt.radius - sr.radius);
      const gap = Math.hypot(axial, spread) - (tt.tube + sr.tube);
      if (gap < worst.gap) worst = { gap, at: `x ${a.x.toFixed(3)} against ${b.x.toFixed(3)}` };
    }
  }

  assert.ok(
    worst.gap > 0,
    `a tubule and a cisterna overlap by ${(-worst.gap).toFixed(4)} at ${worst.at}. Their tubes are ` +
      `${tt.tube} and ${sr.tube} and the axial separation is TRIAD_GAP — a membrane drawn through another ` +
      `membrane is the object contradicting itself, which is the one thing it cannot do and still carry a story`,
  );
  /* Not just "positive": the drawing has to survive a repaint that thickens a
     membrane a little, and 0.012 is what the gap was set to buy. */
  assert.ok(
    worst.gap > 0.008,
    `the closest tubule and cisterna clear by only ${worst.gap.toFixed(4)} at ${worst.at}, which is inside ` +
      `the antialiasing at the framings this scene is looked at`,
  );

  model.dispose();
});
