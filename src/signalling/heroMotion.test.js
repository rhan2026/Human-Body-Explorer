import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import { FORM_R } from "./heroForms.js";
import { buildHeroLevel } from "./heroGeometry.js";
import { HERO_IDS, linksOf } from "./heroNetwork.js";

/**
 * THE SIGNALLING SCENE MOVES, AND WHAT MOVES IS THE THING THAT MAY.
 *
 * This scale shipped as a still: every number the archive carries landed on hue
 * and the frame changed 0.14 % of its pixels over nine seconds. What is gated
 * here is not "something moves" — a shake would pass that — but the two claims
 * the motion makes, one per §5 kind.
 *
 *   MEASURED. A form's turn RATE is that node's own activity, so a node the
 *   chosen bout never moves must be frozen for the whole visit and a node it
 *   moves harder must turn further. That is the property a decorative wobble
 *   does not have, and it is the reason the motion is allowed to exist at all.
 *
 *   AMBIENT. The background crowd's drift claims nothing and is there for one
 *   thing: parallax. A near dot must travel further than a far one, in world
 *   units, before the perspective divide has even been applied — a crowd that
 *   drifted by one amplitude would be a texture sliding across the glass, which
 *   is the flat reading the layer exists to break.
 *
 * Plus the seam: the run loops and the viewer can scrub, so a backward or huge
 * `t` step must move nothing rather than teleport the crowd.
 */

const ROUTES = { types: {}, names: {} };
const DUST = Array.from({ length: 108 }, (_, i) => `dust_${i}`);

function levelWith(dust = DUST) {
  return buildHeroLevel(ROUTES, null, dust);
}

/** The group `heroGeometry` tagged for one of the twelve. */
function formOf(model, id) {
  let found = null;
  model.group.traverse((o) => {
    if (o.userData.role === `node-${id}`) found = o;
  });
  assert.ok(found, `no form tagged node-${id}`);
  return found;
}

/** The one `InstancedMesh` the background crowd is. */
function crowdMesh(model) {
  let mesh = null;
  model.group.traverse((o) => {
    if (o.userData.role === "background-nodes") mesh = o;
  });
  assert.ok(mesh, "the background crowd is not in the scene");
  return mesh;
}

/** Every instance's world position out of the background crowd. */
function crowdAt(model) {
  const mesh = crowdMesh(model);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const out = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, m);
    out.push(p.setFromMatrixPosition(m).clone());
  }
  return out;
}

const reading = (activity, t) => ({ arm: "resistance", activity, t });

/** The two bars of one node's paired meter, or null if it has none. */
function barsOf(model, id) {
  let found = null;
  model.group.traverse((o) => {
    if (o.userData?.role === `meter-${id}`) found = o.userData.bars ?? null;
  });
  return found;
}

/*
 * THE ROCK IS GONE AND THIS IS WHAT REPLACED IT, 2026-09-05.
 *
 * The case here used to be "a node this bout never moves never turns; a node it
 * moves harder turns further", and it was a true statement about a mechanism the
 * SIGNALS brief removed: *"nodes should not continuously rock merely because
 * they have a value. Activity should create meaningful event-driven responses."*
 *
 * The replacement is not a weaker version of the old rule, it is the stronger
 * one the old mechanism could not make. A rock proportional to LEVEL says a node
 * on a plateau is as busy as a node still climbing — mitochondrial biogenesis
 * spends the whole run inside 0.357..0.387 and rocked steadily throughout. What
 * the scene draws now is the RISE, so the three claims below are all things a
 * viewer can act on: still means nothing is happening here, moving means
 * something just did, and bigger means it happened harder.
 */
test("a node only responds when its own activity is rising, and harder when it rises harder", () => {
  const model = levelWith();
  const [flat, gentle, sharp] = [HERO_IDS[3], HERO_IDS[5], HERO_IDS[7]];
  const ids = [flat, gentle, sharp];
  const restOf = Object.fromEntries(
    ids.map((id) => [id, formOf(model, id).scale.x]),
  );

  /* A PLATEAU FOR ONE, TWO DIFFERENT CLIMBS FOR THE OTHER TWO, over the same
     stretch of run — so the only thing separating them is the shape of their own
     series, which is exactly the claim. */
  const peak = Object.fromEntries(ids.map((id) => [id, 0]));
  /* TWO SETTLING FRAMES BEFORE ANYTHING IS MEASURED. The first reading of a
     visit is a baseline rather than an event — `heroGeometry.js` says why, and
     it is the defect this case found — so the peaks below are read from the
     third frame on, which is the first one that can carry a rise. */
  model.update({ arm: "resistance", activity: { [flat]: 0.5, [gentle]: 0, [sharp]: 0 }, t: 0 });
  model.update({ arm: "resistance", activity: { [flat]: 0.5, [gentle]: 0, [sharp]: 0 }, t: 5 });
  for (let t = 10; t <= 400; t += 10) {
    const u = t / 400;
    model.update({
      arm: "resistance",
      activity: { [flat]: 0.5, [gentle]: 0.2 * u, [sharp]: u },
      t,
    });
    for (const id of ids) {
      peak[id] = Math.max(peak[id], formOf(model, id).scale.x / restOf[id] - 1);
    }
  }

  assert.equal(peak[flat], 0, `${flat} held one value all run and the scene still moved it`);
  assert.ok(peak[sharp] > 0.01, `${sharp} climbed the whole way and barely responded (${peak[sharp]})`);
  assert.ok(
    peak[sharp] > peak[gentle] * 1.5,
    `${sharp} rose five times as far as ${gentle} and responded ${peak[sharp]} against ${peak[gentle]} — the response is not the rise`,
  );
  model.dispose();
});

/*
 * AND THE ABSENCE ITSELF, PINNED — CLAUDE.md §3, *"만들지 않기로 한 것은 부재
 * 테스트로 고정"*. Without this, the next person to want "a bit more life in the
 * scene" adds a continuous turn back and every other gate stays green.
 */
test("nothing in the network turns on its own while the run is held still", () => {
  const model = levelWith();
  const activity = Object.fromEntries(HERO_IDS.map((id, i) => [id, (i % 5) / 4]));
  model.update({ arm: "resistance", activity, t: 0 });
  model.update({ arm: "resistance", activity, t: 5 });
  const before = HERO_IDS.map((id) => {
    const f = formOf(model, id);
    return [f.rotation.x, f.rotation.y, f.rotation.z, f.scale.x];
  });
  // Six hundred run-seconds at one unchanging instant's worth of activity.
  for (let t = 10; t <= 600; t += 10) model.update({ arm: "resistance", activity, t });
  HERO_IDS.forEach((id, i) => {
    const f = formOf(model, id);
    const now = [f.rotation.x, f.rotation.y, f.rotation.z, f.scale.x];
    now.forEach((v, k) => {
      assert.ok(
        Math.abs(v - before[i][k]) < 1e-9,
        `${id} moved on channel ${k} with nothing about it changing: ${before[i][k]} -> ${v}`,
      );
    });
  });
  model.dispose();
});

/*
 * BOTH ARMS, ONE NETWORK — the brief's first non-negotiable, as a case.
 *
 * *"Both resistance and endurance must be visible together by default."* The
 * thing that can silently break it is not the default, it is the DRAWING: a
 * scene that reads one activity map and ignores the other looks completely
 * normal and is the defect the whole floor was rebuilt out of. So this asks the
 * picture, not the state: give the two arms different values on one node and the
 * two meters have to disagree.
 */
test("no paired meter stands in the scene — the comparison a click shows is the page's card", () => {
  /* Owner §4, 2026-09-06: the per-node red/blue bars were *"3D scene + dashboard
     UI가 어색하게 섞인 느낌"*; the paired comparison lives in `.sig-pick` now, and
     only for the node that was pressed. Absence, pinned. */
  const model = levelWith();
  model.update({ t: 0, r: { AMPK: 0.2 }, e: { AMPK: 0.8 }, focus: "AMPK" });
  const meters = [];
  model.group.traverse((o) => {
    if (typeof o.userData?.role === "string" && o.userData.role.startsWith("meter-")) meters.push(o.userData.role);
  });
  assert.deepEqual(meters, [], `meters are back in the scene: ${meters.join(", ")}`);
  assert.equal(barsOf(model, "AMPK"), null, "AMPK still carries a bar pair");
  model.dispose();
});

test("the crowd's near dots swing wider than its far ones, which is the parallax", () => {
  const model = levelWith();
  model.update(reading({}, 0));
  const start = crowdAt(model);

  /* HOW WIDE EACH ONE SWINGS, NOT HOW FAR IT GOT IN A WINDOW. The first cut of
     this gate measured travel between two instants and PASSED against a crowd
     given one amplitude at every depth — every dot carries its own period, so
     which of two dots is further along at some instant is a coin toss on
     periods and says nothing about their radii. Sampling past the longest
     period (420 run-seconds) and taking the widest separation from the first
     sample measures the orbit itself, which is the thing the claim is about. */
  const swing = start.map(() => 0);
  for (let t = 10; t <= 500; t += 10) {
    model.update(reading({}, t));
    const now = crowdAt(model);
    for (let i = 0; i < now.length; i += 1) swing[i] = Math.max(swing[i], start[i].distanceTo(now[i]));
  }

  let near = 0;
  let far = 0;
  for (let i = 0; i < start.length; i += 1) {
    if (start[i].z > start[near].z) near = i;
    if (start[i].z < start[far].z) far = i;
  }
  assert.ok(swing[near] > 0.05, `the nearest dot swings ${swing[near]} and the crowd is still a photograph`);
  assert.ok(
    swing[near] > swing[far] * 1.5,
    `near swings ${swing[near]} against far ${swing[far]} — one amplitude for every depth is a sliding texture, not a space`,
  );
  model.dispose();
});

test("the loop's seam is worth nothing and a 40-minute scrub is worth one frame", () => {
  const activity = Object.fromEntries(HERO_IDS.map((id) => [id, 0.8]));
  const spun = (m) => formOf(m, HERO_IDS[7]).rotation.y;

  /* BACKWARDS IS WORTH NOTHING. The run loops, and `t` dropping to 0 must not
     run the drift round the other way. */
  const seam = levelWith();
  seam.update(reading(activity, 0));
  seam.update(reading(activity, 10));
  const beforeSeam = crowdAt(seam);
  const turnedAtSeam = spun(seam);
  seam.update(reading(activity, 0));
  const afterSeam = crowdAt(seam);
  for (let i = 0; i < beforeSeam.length; i += 1) {
    assert.ok(
      beforeSeam[i].distanceTo(afterSeam[i]) < 1e-12,
      `dot ${i} drifted backwards over the loop's seam, moving ${beforeSeam[i].distanceTo(afterSeam[i])}`,
    );
  }
  assert.equal(spun(seam), turnedAtSeam, "the loop's seam spun a node");
  seam.dispose();

  /* AND A JUMP IS WORTH ONE FRAME. A viewer drops the scrubber at 40 minutes;
     the crowd carries on from where it was by the longest step an honest frame
     could have taken, which is what the second scene here takes on purpose. */
  const scrub = levelWith();
  scrub.update(reading(activity, 0));
  scrub.update(reading(activity, 2400));
  const oneFrame = levelWith();
  oneFrame.update(reading(activity, 0));
  oneFrame.update(reading(activity, 10));

  const jumped = crowdAt(scrub);
  const stepped = crowdAt(oneFrame);
  for (let i = 0; i < jumped.length; i += 1) {
    assert.ok(
      jumped[i].distanceTo(stepped[i]) < 1e-12,
      `dot ${i} was teleported by a scrub: it landed ${jumped[i].distanceTo(stepped[i])} from where one clamped frame puts it`,
    );
  }
  scrub.dispose();
  oneFrame.dispose();
});

/**
 * ── AND WHAT THE CROWD LOOKS LIKE STANDING STILL ────────────────────────────
 *
 * The two above are about motion. These two are about the bargain that let the
 * layer come forward, which is the other half of the same rebuild: the crowd is
 * allowed in FRONT of the thirteen — the one occlusion cue this scene had no
 * other source for — and what keeps a mote from being read as a fourteenth node
 * is that it is a quarter of the size, at every depth, always. Depth ordering
 * used to be the guard and it bought nothing size was not already buying; size
 * is the guard now, so size is what is held here.
 */

/** How much of a form a mote may ever be, in world units. */
const MOTE_MAX = 0.3;

test("the crowd stands behind the thirteen — one mesh, the archive's count, every mote smaller than a form", () => {
  const model = levelWith();
  model.update(reading({}, 0));

  /* ONE MESH, AND ITS COUNT IS THE ARCHIVE'S. Both halves matter and they are
     different claims. One `InstancedMesh` is the frame cost — a field that grew
     a second draw call per idea would not ship. And the count is a STATEMENT:
     the network the thirteen were cut from has this many more things in it,
     which is why the layer may not be padded out with extra motes to fill paper.
     Making them bigger is free; inventing more of them is not. */
  const meshes = [];
  model.group.traverse((o) => {
    if (o.isInstancedMesh) meshes.push(o);
  });
  assert.equal(meshes.length, 1, `the crowd is ${meshes.length} instanced meshes and it may be one`);
  assert.equal(meshes[0].count, DUST.length, "the crowd's count is not the archive's count");

  const mesh = crowdMesh(model);
  mesh.geometry.computeBoundingSphere();
  const unit = mesh.geometry.boundingSphere.radius;

  const forms = [];
  model.group.traverse((o) => {
    if (typeof o.userData.role === "string" && o.userData.role.startsWith("node-")) forms.push(o);
  });
  assert.equal(forms.length, HERO_IDS.length, "the thirteen are not all in the scene");
  const nearestForm = Math.max(...forms.map((f) => f.position.z));

  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let inFront = 0;
  let biggest = 0;
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    if (p.z > nearestForm) inFront += 1;
    biggest = Math.max(biggest, unit * s.x);
  }
  /* BEHIND, SINCE 2026-09-06 — the owner's §7: *"메인 hero path 뒤에 작은 dim
     nodes, hairline edges"*. The note at `DUST_NEAR` in heroGeometry.js argued
     the crowd in FRONT for occlusion; the owner watched it and read the near
     motes as grey spheres competing with the network. Context stands behind
     its subject. */
  assert.equal(
    inFront,
    0,
    `${inFront} motes stand in front of the nearest of the thirteen (z ${nearestForm}) — the background is context and belongs behind the network`,
  );
  assert.ok(
    biggest < FORM_R * MOTE_MAX,
    `the largest mote is ${(biggest / FORM_R).toFixed(3)} of a form and the crowd is allowed in front of them — at this size a mote crossing a node reads as a fourteenth node`,
  );
  model.dispose();
});

test("a mote's own size never overturns the depth it stands at", () => {
  /* SAMPLED DENSELY ON PURPOSE. Both the depth and the size come off hashes of
     the index, so 108 motes sample neither near its bounds and the envelope this
     gate is about is invisible at that count — the first cut ran on the shipped
     108, passed, and would have passed against a mix twice as wide. Four
     thousand puts forty samples in each 1 % slice of depth, so the widest mote
     at the back and the narrowest at the front are the real ones rather than
     whichever two indices happened to land there. */
  const model = buildHeroLevel(ROUTES, null, Array.from({ length: 4000 }, (_, i) => `d${i}`));
  model.update(reading({}, 0));
  const mesh = crowdMesh(model);

  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const all = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    all.push({ z: p.z, size: s.x });
  }
  all.sort((a, b) => b.z - a.z);
  const slice = Math.round(all.length * 0.01);
  const smallestAtTheFront = Math.min(...all.slice(0, slice).map((r) => r.size));
  const largestAtTheBack = Math.max(...all.slice(-slice).map((r) => r.size));

  assert.ok(
    largestAtTheBack < smallestAtTheFront,
    `the biggest mote at the far wall is ${largestAtTheBack.toFixed(3)} and the smallest at the front is ${smallestAtTheFront.toFixed(3)} — size is carrying depth here, and a mix wide enough to invert it end to end spends the cue it was added to decorate`,
  );
  model.dispose();
});

/* ---- the 2026-09-06 brief ------------------------------------------------ */

import { readFile } from "node:fs/promises";
import { platesShown } from "./heroGeometry.js";
import { SCENARIOS } from "./signallingBinding.js";

const archive = async (id) =>
  JSON.parse(await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"));

/** The first body material under a form — every lobe shares it. */
function bodyColour(model, id) {
  let colour = null;
  formOf(model, id).traverse((o) => {
    if (!colour && o.isMesh && o.material?.color) colour = o.material.color;
  });
  assert.ok(colour, `${id} has no coloured mesh`);
  return colour.clone();
}
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const apart = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
/** Is colour `c` on the ray from `base` toward `end`, and how far along (0..1)? */
const onRay = (c, base, end) => {
  const d = [c.r - base.r, c.g - base.g, c.b - base.b], e = [end.r - base.r, end.g - base.g, end.b - base.b];
  const ee = e[0] ** 2 + e[1] ** 2 + e[2] ** 2;
  const a = (d[0] * e[0] + d[1] * e[1] + d[2] * e[2]) / ee;
  const res = Math.hypot(d[0] - a * e[0], d[1] - a * e[1], d[2] - a * e[2]);
  return { ok: res < 0.004 && a > -0.01 && a < 1.01, a };
};
const STONE = new THREE.Color("#766f67"), WARM = new THREE.Color("#b06a60"), COOL = new THREE.Color("#7099b3");
/** The first mesh under a link group. */
function linkTube(model, role) {
  const [link] = byRole(model, (r) => r === role);
  let tube = null; link.traverse((o) => { if (!tube && o.isMesh) tube = o; });
  assert.ok(tube, `${role} has no tube`);
  return tube;
}
/** A carrying path's base colour, solved from one arm alone: path = base lerped 0.3 toward that arm. */
function linkBase(tube, arm) {
  const c = tube.material.color;
  return new THREE.Color((c.r - 0.3 * arm.r) / 0.7, (c.g - 0.3 * arm.g) / 0.7, (c.b - 0.3 * arm.b) / 0.7);
}

function byRole(model, test) {
  const out = [];
  model.group.traverse((o) => {
    if (typeof o.userData?.role === "string" && test(o.userData.role)) out.push(o);
  });
  return out;
}


test("a node is a warm stone at rest and takes its workout's colour only when a signal reaches it", () => {
  const model = levelWith();
  model.update({ t: 0, r: {}, e: {} });
  model.update({ t: 1, r: {}, e: {} });
  const rest = bodyColour(model, "AMPK");
  /* Owner §2: the base network *"warm neutral charcoal / taupe … 현재 black보다
     약 25~35% 밝은 쪽"*. Measured against the rest stone it replaces. */
  const was = new THREE.Color("#55504a");
  assert.ok(lum(rest) >= lum(was) * 1.25, `rest luminance ${lum(rest).toFixed(4)} against ${lum(was).toFixed(4)} — not the 25 % lift the brief asked for`);
  /* 1.9 -> 2.0, pass 4 §5: *"neutral base를 아주 약간 밝게"* — one more step,
     and the ceiling moves one step with it. */
  assert.ok(lum(rest) <= lum(was) * 2.0, `rest luminance ${lum(rest).toFixed(4)} — that is washed out, not lifted`);
  assert.ok(rest.r >= rest.g && rest.g >= rest.b, `rest ${rest.getHexString()} is not warm`);

  /* *"signal이 들어올 때만 Resistance → warm, Endurance → cool"*. */
  model.update({ t: 2, r: {}, e: { AMPK: 1 } });
  const cool = bodyColour(model, "AMPK");
  model.update({ t: 3, r: { AMPK: 1 }, e: {} });
  const warm = bodyColour(model, "AMPK");
  assert.ok(cool.b > cool.r, `endurance drove AMPK and it went ${cool.getHexString()}, which is not cool`);
  assert.ok(warm.r > warm.b, `resistance drove AMPK and it went ${warm.getHexString()}, which is not warm`);
  assert.ok(apart(cool, rest) > 0.12 && apart(warm, rest) > 0.12, "an active node is not obviously different from a resting one");
  /* And a node neither drives stays the stone — the endurance doors under a
     resistance workout, which is the brief's own example of inactive = visible. */
  model.update({ t: 4, r: { integrin: 1 }, e: {} });
  assert.ok(apart(bodyColour(model, "B_AR"), rest) < 0.02, "an undriven door took a colour");
  model.dispose();
});

test("the node under the pointer says so itself, without a ring", () => {
  const model = levelWith();
  model.update({ t: 0, r: {}, e: {} });
  model.update({ t: 1, r: {}, e: {} });
  const plain = bodyColour(model, "JNK");
  model.update({ t: 2, r: {}, e: {}, hover: "JNK" });
  const under = bodyColour(model, "JNK");
  assert.ok(apart(under, plain) > 0.03, `hovering JNK changed its body by ${apart(under, plain).toFixed(4)} — nothing a viewer would see`);
  assert.ok(apart(bodyColour(model, "S6"), plain) < 1e-6, "hovering JNK changed S6");
  model.dispose();
});

test("a link is a thin curved path, and the packets travel along it — both colours on a shared one", async () => {
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, []);
  const links = byRole(model, (r) => r.startsWith("link-") && r !== "link-pulses");
  assert.ok(links.length >= 12, `${links.length} links drawn`);
  const paths = [];
  for (const link of links) {
    const tubes = [];
    link.traverse((o) => {
      if (o.isMesh && o.geometry?.type === "TubeGeometry") tubes.push(o);
    });
    /* Owner §3: *"Thick rods / large structural lines가 너무 강합니다 … Thin curved
       paths + travelling signal packets"*. A path is a tube along a curve, and
       the curve actually bends — a straight tube is a rod that learned a new
       constructor. Collapsed (multi-step) links stay beads and are not tubes. */
    if (!tubes.length) continue;
    for (const tube of tubes) {
      const { radius, path } = tube.geometry.parameters;
      assert.ok(radius <= 0.02, `${link.userData.role} is ${(radius * 2).toFixed(3)} across — a rod, not a path`);
      const a = path.getPoint(0);
      const b = path.getPoint(1);
      const mid = path.getPoint(0.5);
      const chordMid = a.clone().lerp(b, 0.5);
      assert.ok(mid.distanceTo(chordMid) > radius * 1.5, `${link.userData.role} does not bend`);
      paths.push(path);
    }
  }
  assert.ok(paths.length >= 8, `${paths.length} curved paths — most links are direct edges and should be drawn as one`);

  /* The packets ride the curve, not the chord. Drive everything at once so
     every stream is up, then every visible pulse must sit within a hair of some
     path — the stream offset plus its own radius. */
  const all = Object.fromEntries(HERO_IDS.map((id) => [id, 1]));
  model.update({ t: 0, r: all, e: all });
  model.update({ t: 37, r: all, e: all });
  const [pulses] = byRole(model, (r) => r === "link-pulses");
  assert.ok(pulses?.isInstancedMesh, "no pulse layer");
  const samples = paths.map((p) => p.getSpacedPoints(48));
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let checked = 0;
  for (let i = 0; i < pulses.count; i += 1) {
    pulses.getMatrixAt(i, m);
    m.decompose(p, q, s);
    if (s.x < 0.5) continue;
    let nearest = Infinity;
    for (const pts of samples) for (const pt of pts) nearest = Math.min(nearest, pt.distanceTo(p));
    if (nearest > 0.2) continue; // a bead-chain link's pulses have no tube path to be near
    assert.ok(nearest < 0.08, `pulse ${i} is ${nearest.toFixed(3)} off every curved path — it is riding the chord`);
    checked += 1;
  }
  assert.ok(checked > 20, `only ${checked} pulses were on curved paths`);

  /* A path both workouts share carries both colours at once — the hero
     animation. JNK → S6 is one: both arms reach JNK and both reach S6. */
  const [jnkS6] = byRole(model, (r) => r === "link-JNK-S6");
  assert.ok(jnkS6, "no JNK → S6 link");
  let tube = null;
  jnkS6.traverse((o) => { if (!tube && o.geometry?.type === "TubeGeometry") tube = o; });
  const pts = tube.geometry.parameters.path.getSpacedPoints(48);
  const colours = new Set();
  const c = new THREE.Color();
  for (let i = 0; i < pulses.count; i += 1) {
    pulses.getMatrixAt(i, m);
    m.decompose(p, q, s);
    if (s.x < 0.5) continue;
    if (Math.min(...pts.map((pt) => pt.distanceTo(p))) > 0.08) continue;
    pulses.getColorAt(i, c);
    colours.add(c.getHexString());
  }
  assert.equal(colours.size, 2, `JNK → S6 carries ${colours.size} packet colour(s); a shared path carries both`);
  model.dispose();
});

test("the crowd is the rest of the network, standing behind it — dim, small, and wired", () => {
  const model = levelWith();
  model.update(reading({}, 0));
  const mesh = crowdMesh(model);
  const forms = byRole(model, (r) => r.startsWith("node-"));
  const deepest = Math.min(...forms.map((f) => f.position.z));
  const at = crowdAt(model);
  assert.ok(at.every((v) => v.z < deepest), "a mote stands level with or in front of the deepest of the thirteen");

  /* Owner §7: *"random gray sphere 대신 아주 faint한 network constellation … 작은
     dim nodes, hairline edges"*. Faint: every instance tint lighter than the
     resting stone. Wired: a line layer whose every endpoint IS one of the motes,
     at build and after the crowd has drifted. */
  const tint = new THREE.Color();
  const stone = new THREE.Color("#6e675e");
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getColorAt(i, tint);
    assert.ok(lum(tint) > lum(stone) * 1.3, `mote ${i} is ${tint.getHexString()}, darker than the network it is behind`);
  }
  const [wires] = byRole(model, (r) => r === "background-edges");
  assert.ok(wires?.isLineSegments, "the crowd has no hairline edges — it is dust, not a constellation");
  const endpointsOnMotes = () => {
    const pos = wires.geometry.getAttribute("position");
    const motes = crowdAt(model);
    let off = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const e = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (!motes.some((mv) => mv.distanceTo(e) < 1e-4)) off += 1;
    }
    return { segments: pos.count / 2, off };
  };
  const built = endpointsOnMotes();
  assert.ok(built.segments >= 60, `${built.segments} hairlines — too few to read as a network`);
  assert.equal(built.off, 0, `${built.off} hairline endpoints hang in space rather than on a mote`);
  model.update(reading({}, 240));
  const drifted = endpointsOnMotes();
  assert.equal(drifted.off, 0, `${drifted.off} hairline endpoints came loose once the crowd drifted`);
  model.dispose();
});

test("no shelf under the outcomes — a hairline divides the zone and the outcomes are driven", () => {
  const model = levelWith();
  const roles = new Set();
  model.group.traverse((o) => { if (o.userData?.role) roles.add(o.userData.role); });
  /* Owner §8: *"아래쪽 pink rectangle과 label은 임시 debug shelf처럼 보입니다 …
     큰 border rectangle을 그릴 필요는 없습니다"*. Absence, pinned. */
  assert.ok(!roles.has("outcome-floor") && !roles.has("outcome-lip"), "the pink shelf is still drawn");
  assert.ok(roles.has("outcome-line"), "nothing divides the outcome zone from the network");

  /* The outcomes' own drive reaches them through `update` — `progress` per arm,
     the SHOW switch respected. */
  const [strand] = (() => { const o = []; formOf(model, "Protein_Synthesis").traverse((c) => { if (c.userData?.part === "strand") o.push(c); }); return o; })();
  assert.ok(strand, "no strand to drive");
  const length = () => { strand.updateMatrixWorld(true); return new THREE.Box3().setFromObject(strand).getSize(new THREE.Vector3()).length(); };
  model.update({ t: 0, r: {}, e: {}, progress: { r: { Protein_Synthesis: 0 }, e: { Protein_Synthesis: 0 } } });
  const before = length();
  model.update({ t: 1, r: {}, e: {}, progress: { r: { Protein_Synthesis: 1 }, e: { Protein_Synthesis: 0 } } });
  const after = length();
  assert.ok(after > before * 1.8, `progress 0 → 1 took the strand ${before.toFixed(3)} → ${after.toFixed(3)}`);
  model.update({ t: 2, r: {}, e: {}, show: "endurance", progress: { r: { Protein_Synthesis: 1 }, e: { Protein_Synthesis: 0 } } });
  assert.ok(Math.abs(length() - before) < 1e-6, "hiding lifting left lifting's progress on the ribosome");
  model.dispose();
});

test("what stands labelled: the two workouts and AMPK by default, only the spoken part during the pass, and whatever is asked about", () => {
  const model = levelWith();
  const ids = (out) => out.map((a) => a.id).sort();
  /* Owner §9: default *"Resistance, Endurance, 필요하면 AMPK 정도만 항상"*;
     hover → name; click → name + …; guided tour → *"현재 말하는 object만"*. */
  /* Pass 3 §8: *"Persistent: Resistance exercise and Endurance exercise. That
     is enough. The AMPK label should appear during the tour, on hover, on
     selection — not always."* */
  /* NOTHING BY DEFAULT since 2026-09-07 — the cell's way (owner, SIGNALS 20/24). */
  assert.deepEqual(ids(platesShown(model.anchors, {})), []);
  assert.deepEqual(ids(platesShown(model.anchors, { hovered: "AMPK" })), ["AMPK"]);
  assert.deepEqual(ids(platesShown(model.anchors, { touring: true, tourFocus: "JNK" })), ["JNK"]);
  assert.deepEqual(ids(platesShown(model.anchors, { touring: true, tourFocus: null })), []);
  assert.deepEqual(
    ids(platesShown(model.anchors, { hovered: "ROS", selected: "S6", open: "S6" })),
    ["ROS", "S6"],
  );
  model.dispose();
});

import { SCENE } from "../anatomyStyle.js";

test("three weights on the paper: background under hero topology under a path that is carrying, and the packet on top", async () => {
  /* Owner, pass 3 §3, verbatim ladder: background network 10 %, hero topology
     35 %, currently carrying 100 %, signal packet strongest of all. Weight is
     read as contrast against the stage's paper times opacity — the only
     quantity a viewer's eye actually integrates. */
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, DUST);
  model.update({ t: 0, r: {}, e: {} });
  model.update({ t: 1, r: {}, e: {} });
  const paper = new THREE.Color(SCENE.background);
  /* Luminance contrast against the paper, times opacity — lightness is what
     the eye integrates for weight; a Euclidean distance in RGB would rank a
     dark grey above a saturated warm, which is not how a packet reads. */
  const weight = (colour, opacity = 1) => Math.abs(lum(colour) - lum(paper)) * opacity;
  const [wires] = byRole(model, (r) => r === "background-edges");
  const wireWeight = weight(wires.material.color, wires.material.opacity);
  const crowd = crowdMesh(model);
  const tint = new THREE.Color();
  let moteWeight = 0;
  for (let i = 0; i < crowd.count; i += 1) { crowd.getColorAt(i, tint); moteWeight = Math.max(moteWeight, weight(tint)); }
  const [link] = byRole(model, (r) => r === "link-RhoA-JNK");
  let tube = null;
  link.traverse((o) => { if (!tube && o.isMesh) tube = o; });
  const restWeight = weight(tube.material.color, tube.material.opacity);
  model.update({ t: 2, r: { RhoA: 1, JNK: 1 }, e: {} });
  const onWeight = weight(tube.material.color, tube.material.opacity);
  /* The packet as the scene draws it — the pulses mesh's own instance colour
     times its material's opacity — not a typed hex. */
  const [pulses] = byRole(model, (r) => r === "link-pulses");
  const packetColour = new THREE.Color();
  pulses.getColorAt(0, packetColour);
  const packetWeight = weight(packetColour, pulses.material.transparent ? pulses.material.opacity : 1);
  assert.ok(wireWeight < restWeight * 0.4, `background wires weigh ${wireWeight.toFixed(3)} against a resting path's ${restWeight.toFixed(3)} — not a field behind it`);
  assert.ok(moteWeight < restWeight * 0.5, `the heaviest mote weighs ${moteWeight.toFixed(3)} against a resting path's ${restWeight.toFixed(3)}`);
  assert.ok(onWeight >= restWeight * 2, `a carrying path weighs ${onWeight.toFixed(3)} against ${restWeight.toFixed(3)} at rest — the active route does not stand out`);
  assert.ok(packetWeight > onWeight, `a packet (${packetWeight.toFixed(3)}) is not the strongest mark on the path (${onWeight.toFixed(3)})`);
  model.dispose();
});

test("the background motes are small enough to be a field — under a twelfth of a form", () => {
  /* Owner, pass 3 §4: *"40–60 % smaller nodes, thinner edges, stronger depth
     fade. A field behind the main pathway, not an overlay on it."* The motes
     were 0.09 of a form (times a 1.25 size mix); half of that is the ceiling. */
  const model = levelWith();
  model.update(reading({}, 0));
  const mesh = crowdMesh(model);
  mesh.geometry.computeBoundingSphere();
  const unit = mesh.geometry.boundingSphere.radius;
  const m = new THREE.Matrix4(); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
  let biggest = 0;
  for (let i = 0; i < mesh.count; i += 1) { mesh.getMatrixAt(i, m); m.decompose(p, q, s); biggest = Math.max(biggest, unit * s.x); }
  assert.ok(biggest > 0 && biggest <= FORM_R * 0.0675, `the largest mote is ${(biggest / FORM_R).toFixed(3)} of a form; the owner asked for 40–60 % smaller than 0.1125, and 0.0675 is the 40 % line`);
  model.dispose();
});


/* ---- pass 4, P0 — one connection language ------------------------------ */

test("a path is a line and information is a moving bead — nothing draws a line out of beads, one to three packets on any edge", async () => {
  /* Owner, pass 4 §1 (P0): *"Path = line, quiet ──── / Information = moving
     bead, active ─────●──→. 한 edge에 이동 packet 1~3개 정도. 구슬 여러 개를 이어서
     line 자체를 만드는 건 제거."* The collapsed multi-step links used to be bead
     chains; they are lines now — thinner, so the approximation still shows —
     and the archive's "this is several steps" stays in the record and the
     caption, not in a chain of dots that reads as a stalled signal. */
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, []);
  const links = byRole(model, (r) => r.startsWith("link-") && r !== "link-pulses");
  let directR = 0, collapsedR = 0;
  for (const link of links) {
    const meshes = [];
    link.traverse((o) => { if (o.isMesh) meshes.push(o); });
    assert.equal(meshes.length, 1, `${link.userData.role} is drawn with ${meshes.length} meshes — a line is one tube and nothing else`);
    assert.equal(meshes[0].geometry?.type, "TubeGeometry", `${link.userData.role} is not a tube`);
    const r = meshes[0].geometry.parameters.radius;
    if (/link-B_AR-AMPK|link-PGC_1a-Mitochondrial_Biogenesis/.test(link.userData.role)) collapsedR = Math.max(collapsedR, r); else directR = Math.max(directR, r);
  }
  assert.ok(collapsedR > 0 && collapsedR <= directR * 0.8, `a collapsed (multi-step) path is ${collapsedR} against a direct edge's ${directR} — it should read thinner`);

  /* Packets: THE OWNER COUNTS PER EDGE, NOT PER ARM — *"한 edge에 이동 packet
     1~3개 정도"*. On every path both arms drive, the beads visible at once are
     one to three in total and each arm shows at least one. (Reviewed: two per
     arm on the long paths put FOUR on S6 → Protein under Both.) Each bead is
     assigned to the path it is nearest, so a bead rounding a shared node is
     not counted for two links. */
  const all = Object.fromEntries(HERO_IDS.map((id) => [id, 1]));
  model.update({ t: 0, r: all, e: all });
  model.update({ t: 23, r: all, e: all });
  const [pulses] = byRole(model, (r) => r === "link-pulses");
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
  const paths = links.map((link) => { let tube = null; link.traverse((o) => { if (!tube && o.geometry?.type === "TubeGeometry") tube = o; }); return { role: link.userData.role, pts: tube.geometry.parameters.path.getSpacedPoints(48), warm: 0, cool: 0 }; });
  for (let i = 0; i < pulses.count; i += 1) {
    pulses.getMatrixAt(i, m); m.decompose(p, q, s);
    if (s.x < 0.5) continue;
    let near = null, best = Infinity;
    for (const path of paths) { const d = Math.min(...path.pts.map((pt) => pt.distanceTo(p))); if (d < best) { best = d; near = path; } }
    assert.ok(best <= 0.08, `a visible bead is ${best.toFixed(3)} from every path`);
    pulses.getColorAt(i, c);
    near[c.r > c.b ? "warm" : "cool"] += 1;
  }
  for (const { role, warm, cool } of paths) {
    assert.ok(warm + cool >= 1 && warm + cool <= 3, `${role} carries ${warm + cool} beads at once (${warm} warm, ${cool} cool) — the owner asked for one to three per edge`);
    assert.ok(warm >= 1 && cool >= 1, `${role}: an arm that drives the path shows no bead on it (${warm} warm, ${cool} cool)`);
  }
  model.dispose();
});

test("a bead on a collapsed path takes as long as the steps it stands for", async () => {
  /* B_AR → AMPK is four edges of the model drawn as one line, and its label
     says so; a bead crossing it at single-edge speed said "one hop" with its
     motion while the label said four (owner's list, 2026-09-06). The bead moves
     at the edge speed divided by the steps, so a four-step line takes four
     crossings' time. The steps are read off the archive, not typed. */
  const { edges } = await archive(SCENARIOS.resistance);
  const steps = Object.fromEntries(linksOf(edges).filter(Boolean).map((l) => [`link-${l.from}-${l.to}`, l.steps]));
  assert.ok(steps["link-B_AR-AMPK"] > 1, "B_AR → AMPK is a single edge in this archive — the test needs a collapsed path");
  const model = buildHeroLevel(ROUTES, edges, []);
  const all = Object.fromEntries(HERO_IDS.map((id) => [id, 1]));
  const [pulses] = byRole(model, (r) => r === "link-pulses");
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const pathOf = (role) => { const [link] = byRole(model, (r) => r === role); let tube = null; link.traverse((o) => { if (!tube && o.geometry?.type === "TubeGeometry") tube = o; }); return tube.geometry.parameters.path.getSpacedPoints(64); };
  let t = 0;
  const step = () => { t += 1; model.update({ t, r: all, e: all }); };
  /* One bead's crossing period: the run-seconds between two wraps of its
     nearest point on the path, followed frame by frame. The bead is picked
     while it is in the MIDDLE third of its path, where no other link's bead
     can be. */
  const period = (role) => {
    const pts = pathOf(role);
    const mid = pts.slice(21, 43);
    let bead = -1;
    for (let tries = 0; tries < 400 && bead < 0; tries += 1) {
      step();
      for (let i = 0; i < pulses.count && bead < 0; i += 1) { pulses.getMatrixAt(i, m); m.decompose(p, q, s); if (s.x >= 0.5 && Math.min(...mid.map((pt) => pt.distanceTo(p))) < 0.05) bead = i; }
    }
    assert.ok(bead >= 0, `${role}: no bead ever crossed the middle of the path`);
    const at = () => { pulses.getMatrixAt(bead, m); m.decompose(p, q, s); let k = 0, dk = Infinity; pts.forEach((pt, j) => { const d = pt.distanceTo(p); if (d < dk) { dk = d; k = j; } }); return k; };
    const wraps = [];
    let prev = at();
    for (let n = 0; n < 1200; n += 1) { step(); const k = at(); if (k < prev - 32) wraps.push(t); prev = k; }
    assert.ok(wraps.length >= 2, `${role}: the bead wrapped ${wraps.length} times in 1200 run-seconds`);
    return (wraps.at(-1) - wraps[0]) / (wraps.length - 1);
  };
  const direct = period("link-integrin-RhoA");
  const collapsed = period("link-B_AR-AMPK");
  const ratio = collapsed / direct;
  assert.ok(Math.abs(ratio - steps["link-B_AR-AMPK"]) < 0.4, `a ${steps["link-B_AR-AMPK"]}-step path is crossed in ${ratio.toFixed(2)}x the time of a single edge (${collapsed.toFixed(0)} against ${direct.toFixed(0)} run-seconds)`);
  model.dispose();
});

/* ---- pass 4, P1 · P2 ---------------------------------------------------- */

test("a shared node changes colour when a packet lands, not on a timer — a frozen clock freezes the colour", async () => {
  /* Owner §3: *"일정 간격으로 warm/cool/warm/cool 하면 decorative animation처럼
     보여. warm packet arrives → warm pulse, cool packet arrives → cool pulse
     처럼 실제 arrival timing에 맞춰 교대하게 해."* So with no packets moving
     (the clock held) the colour cannot move either; with the clock running it
     still takes turns. */
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, []);
  const both = { r: { RhoA: 1, ROS: 1, JNK: 1 }, e: { RhoA: 1, ROS: 1, JNK: 1 }, progress: { r: { JNK: 0.8, RhoA: 0.8 }, e: { JNK: 0.8, ROS: 0.8 } } };
  for (let t = 0; t <= 300; t += 3) model.update({ ...both, t });
  const held = bodyColour(model, "JNK");
  for (let i = 0; i < 120; i += 1) model.update({ ...both, t: 300 });
  assert.ok(apart(bodyColour(model, "JNK"), held) < 1e-6, "the colour moved while the clock stood still — that is a timer, not an arrival");
  /* THE CASE A TIMER CANNOT PASS (reviewed — the held-clock case alone did
     not tell the two apart): both arms colour the node, the clock runs, but
     no bead runs on any link into it — then nothing lands and the colour must
     never turn. */
  const idle = buildHeroLevel(ROUTES, edges, []);
  const quiet = { r: {}, e: {}, progress: { r: { JNK: 0.8, RhoA: 0.8 }, e: { JNK: 0.8, ROS: 0.8 } } };
  idle.update({ ...quiet, t: 0 });
  idle.update({ ...quiet, t: 3 });
  const c0 = bodyColour(idle, "JNK");
  for (let t = 6; t <= 1500; t += 3) idle.update({ ...quiet, t });
  assert.ok(apart(bodyColour(idle, "JNK"), c0) < 1e-6, "with no bead running into it the node still turned — a timer");
  idle.dispose();
  const stone = new THREE.Color("#766f67");
  const pureWarm = stone.clone().lerp(new THREE.Color("#b06a60"), 0.8);
  const pureCool = stone.clone().lerp(new THREE.Color("#7099b3"), 0.8);
  let warm = 0, cool = 0, blend = 0;
  for (let t = 303; t <= 1500; t += 3) {
    model.update({ ...both, t });
    const c = bodyColour(model, "JNK");
    if (apart(c, pureWarm) < 0.03) warm += 1; else if (apart(c, pureCool) < 0.03) cool += 1; else blend += 1;
  }
  /* THE TURNS ARE EVEN ON THE MEETING NODE. Both arms' beads run the same
     links into JNK, the cool stream half a cycle behind the warm, so each arm
     holds the node for half of every crossing — measured 2026-09-06 at 12/88
     before that, when the cool offset was an eighth of the path and JNK read
     as endurance's. A frame between the two colours is a frame of the ease;
     at three run-seconds a frame the ease is complete within it. */
  assert.ok(warm >= 140 && cool >= 140, `warm ${warm} / cool ${cool} of 400 frames — the two are not taking even turns on arrival`);
  assert.ok(blend < 20, `${blend} of 400 frames sit between the two`);
  model.dispose();
});

test("a hand-over never passes through the mix — mid-ease the node is a paler stone, and so is the path into it", async () => {
  /* Owner on Both: *"purple element들이 ㅈㄴ purple이 별로야"*. The turn-taking
     test above samples whole turns; the ease BETWEEN turns went through
     warm+cool, and a still caught JNK and S6 mauve (p4-07, 2026-09-06). So on
     every frame, at any point of the ease, a shared node's colour lies on the
     stone→warm ray or the stone→cool ray and never between them — and the
     path that reads the node's side does the same. The hand-over is still
     visible: the colour dips toward the stone and rises in the other hue. */
  const { edges } = await archive(SCENARIOS.resistance);
  const stone = STONE, warm = WARM, cool = COOL;
  const both = { r: { RhoA: 1, ROS: 1, JNK: 1, S6: 1 }, e: { RhoA: 1, ROS: 1, JNK: 1, S6: 1 }, progress: { r: { JNK: 0.8, RhoA: 0.8, S6: 0.8 }, e: { JNK: 0.8, ROS: 0.8, S6: 0.8 } } };
  const model = buildHeroLevel(ROUTES, edges, []);
  /* The path's own base colour, read under one arm alone (side fixed, lean
     full): path = base lerped 0.3 toward that arm — solved for base from
     either arm, and the two solutions have to agree. */
  const tube = linkTube(model, "link-JNK-S6");
  const solve = (show, arm) => { model.update({ ...both, show, t: 0 }); model.update({ ...both, show, t: 3 }); return linkBase(tube, arm); };
  const baseW = solve("resistance", warm), baseC = solve("endurance", cool);
  assert.ok(apart(baseW, baseC) < 0.004, `the path's base differs by arm (${baseW.getHexString()} / ${baseC.getHexString()}) — the 0.3 lean is not what this test assumes`);
  let dips = 0, frames = 0;
  for (let t = 6; t <= 1500; t += 0.5) {
    model.update({ ...both, show: "both", t });
    frames += 1;
    for (const id of ["JNK", "S6"]) {
      const c = bodyColour(model, id);
      const w = onRay(c, stone, warm), k = onRay(c, stone, cool);
      assert.ok(w.ok || k.ok, `${id} at t ${t} is off both rays (#${c.getHexString()}) — a third colour`);
      if (Math.max(w.ok ? w.a : 0, k.ok ? k.a : 0) < 0.4) dips += 1;
    }
    const lc = tube.material.color;
    assert.ok(onRay(lc, baseW, warm).ok || onRay(lc, baseW, cool).ok, `the path into S6 at t ${t} is off both rays (#${lc.getHexString()})`);
  }
  assert.ok(dips > 0, `no frame of ${frames} showed the hand-over passing through the stone`);
  model.dispose();
});

test("a packet landing gives the node a short response even when its level is flat", async () => {
  /* Owner §2: *"두 signal이 도착할 때 짧은 response"*. Flat activity means no
     rise, so the swell has to come from the arrival itself. */
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, []);
  const flat = { r: { RhoA: 1, JNK: 1 }, e: {}, progress: { r: { JNK: 0.8, RhoA: 0.8 }, e: {} } };
  model.update({ ...flat, t: 0 });
  model.update({ ...flat, t: 3 });
  const rest = formOf(model, "JNK").scale.x;
  let peak = rest;
  for (let t = 6; t <= 600; t += 3) { model.update({ ...flat, t }); peak = Math.max(peak, formOf(model, "JNK").scale.x); }
  assert.ok(peak > rest * 1.02, `JNK never responded to an arrival (peak ${peak.toFixed(4)} against rest ${rest.toFixed(4)})`);
  model.dispose();
});

test("the constellation stands further back, smaller, and clear of the hero column", () => {
  /* Owner §6: *"z를 더 뒤로, node size 15~25% 감소, hero path 주변 density 약간
     감소, depth fade 강화. 없애면 안 됨."* Both layouts — the narrow grid is
     where one push used to land motes on a neighbour. */
  for (const narrow of [false, true]) {
  const model = buildHeroLevel(ROUTES, null, DUST, { narrow });
  model.update(reading({}, 0));
  const mesh = crowdMesh(model);
  mesh.geometry.computeBoundingSphere();
  const unit = mesh.geometry.boundingSphere.radius;
  const forms = byRole(model, (r) => r.startsWith("node-"));
  const deepest = Math.min(...forms.map((f) => f.position.z));
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let biggest = 0, tooClose = 0;
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, m); m.decompose(p, q, s);
    biggest = Math.max(biggest, unit * s.x);
    assert.ok(p.z < deepest - 0.5, `mote ${i} stands at z ${p.z.toFixed(2)}, within half a unit of the deepest node`);
    for (const f of forms) if (Math.hypot(p.x - f.position.x, p.y - f.position.y) < 0.2) tooClose += 1;
  }
  assert.ok(biggest <= FORM_R * 0.054, `the largest mote is ${(biggest / FORM_R).toFixed(3)} of a form; 15–25 % under 0.0675 is 0.054`);
  assert.ok(tooClose <= 1, `${tooClose} motes sit right behind a hero node (${narrow ? "narrow" : "wide"}) — the field should thin out around the path`);
  assert.equal(mesh.count, DUST.length, "the count is still the archive's");
  model.dispose();
  }
});

test("the membrane is quieter than a resting path", async () => {
  /* Owner §4: *"membrane이 약간 강함 … 10~20%만 더 quiet하게 … Network path보다
     강하면 안 돼."* Weight as the three-weights test measures it. */
  const model = levelWith();
  model.update({ t: 0, r: {}, e: {} });
  model.update({ t: 1, r: {}, e: {} });
  const paper = new THREE.Color(SCENE.background);
  const weight = (colour, opacity = 1) => Math.abs(lum(colour) - lum(paper)) * opacity;
  const [outer] = byRole(model, (r) => r === "membrane-outer");
  const leaflet = weight(outer.material.color, outer.material.opacity);
  /* A resting path AS THE SCENE DRAWS IT (reviewed: a typed hex would detach
     the moment LINK_REST moved). */
  const withEdges = buildHeroLevel(ROUTES, await (async () => (await archive(SCENARIOS.resistance)).edges)(), []);
  withEdges.update({ t: 0, r: {}, e: {} });
  withEdges.update({ t: 1, r: {}, e: {} });
  const [link] = byRole(withEdges, (r) => r.startsWith("link-") && r !== "link-pulses");
  let tube = null; link.traverse((o) => { if (!tube && o.geometry?.type === "TubeGeometry") tube = o; });
  const stoneRest = weight(tube.material.color, tube.material.opacity);
  withEdges.dispose();
  assert.ok(leaflet <= stoneRest, `a membrane leaflet weighs ${leaflet.toFixed(3)} against a resting path's ${stoneRest.toFixed(3)}`);
  model.dispose();
});


/* ---- pass 5 (owner, 2026-09-06) -------------------------------------------- */

const arcOf = (model, id, arm) => { const [arc] = byRole(model, (r) => r === `arc-${arm}-${id}`); assert.ok(arc, `${id} has no ${arm} arc`); return arc; };

test("on the last sample the three outcomes go stone and wear two thin arcs, warm and cool, sized by each arm's own ending", async () => {
  /* Owner, fifth brief §1 — *"가장 중요한 것"*: the three outcomes ended warm
     because a shared node takes the last arm to arrive, and at the final
     payoff that read as "Resistance made these" under a sentence that says two
     routes reached almost the same endpoint. His fix, verbatim: JNK and S6 keep
     arrival colour; the three outcomes, ON THE LAST SAMPLE, go *"stone-colored
     outcome + thin warm arc + thin cool arc"*, near-equal, no number bars. The
     arcs are sized by each arm's own ending relative to the other's, so
     "almost the same" is the picture only because the archive says so. */
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, []);
  const ids = ["Protein_Synthesis", "Cell_Growth", "Mitochondrial_Biogenesis"];
  const r = { RhoA: 1, JNK: 1, S6: 1, PGC_1a: 1, Protein_Synthesis: 0.545, Cell_Growth: 0.5, Mitochondrial_Biogenesis: 0.387 };
  const e = { RhoA: 1, JNK: 1, S6: 1, PGC_1a: 1, Protein_Synthesis: 0.531, Cell_Growth: 0.45, Mitochondrial_Biogenesis: 0.385 };
  const progress = { r: { JNK: 1, ...Object.fromEntries(ids.map((id) => [id, 1])) }, e: { JNK: 1, ...Object.fromEntries(ids.map((id) => [id, 1])) } };
  for (let t = 0; t <= 300; t += 3) model.update({ t, r, e, progress, wall: 0.05 });
  assert.ok(apart(bodyColour(model, "Protein_Synthesis"), STONE) > 0.03, "before the ending an outcome should carry an arm's colour — the case the owner photographed");
  const pathR = linkTube(model, "link-S6-Protein_Synthesis").geometry.parameters.radius;
  /* The last sample, held (the clock stands still there, so the fade runs on wall time). */
  for (let i = 0; i < 40; i += 1) model.update({ t: 300, r, e, progress, ended: true, wall: 0.05 });
  for (const id of ids) {
    assert.ok(apart(bodyColour(model, id), STONE) < 0.01, `${id} is not the stone at the ending (#${bodyColour(model, id).getHexString()})`);
    const warm = arcOf(model, id, "warm"), cool = arcOf(model, id, "cool");
    assert.ok(warm.material.opacity > 0.6 && cool.material.opacity > 0.6, `${id}'s arcs are not shown (${warm.material.opacity}, ${cool.material.opacity})`);
    assert.ok(warm.material.color.getHex() === WARM.getHex() && cool.material.color.getHex() === COOL.getHex(), `${id}'s arcs are not the two arms' colours`);
    assert.ok(warm.geometry.parameters.tube <= pathR && cool.geometry.parameters.tube <= pathR, `${id}'s arcs are thicker than a path`);
    const ratio = cool.geometry.parameters.arc / warm.geometry.parameters.arc;
    assert.ok(Math.abs(ratio - e[id] / r[id]) < 0.02, `${id}: the cool arc is ${ratio.toFixed(3)} of the warm one; the endings are ${(e[id] / r[id]).toFixed(3)}`);
    /* Warm above, cool below — the owner's sketch. */
    const centreY = (mesh) => { mesh.updateWorldMatrix(true, false); return new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()).y; };
    const formY = formOf(model, id).position.y;
    assert.ok(centreY(warm) > formY && centreY(cool) < formY, `${id}: the warm arc should sit above the form and the cool one below`);
    /* Around it, not on it: the arcs clear the form's own radius. */
    assert.ok(warm.geometry.parameters.radius >= FORM_R * 1.4, `${id}'s arcs sit on the form`);
  }
  /* The rule is for the three outcomes ONLY — the meeting relay keeps the last arm. */
  assert.ok(apart(bodyColour(model, "JNK"), STONE) > 0.03, "JNK went stone at the ending — the exception is the three outcomes only");
  /* Off the last sample the arcs go — and they go BEFORE THE VEIL LIFTS. The
     run leaves the last sample on the cut frame, under the paper sheet, which
     is up for 250 ms after it (runVeil.js); an arc still at a tenth of its
     opacity when the sheet comes off would stand over the 0-minute picture
     (reviewed 2026-09-06: at the fade-in constant it did, ≈0.13 for 0.3 s). */
  for (let i = 0; i < 4; i += 1) model.update({ t: 303 + i * 3, r, e, progress, ended: false, wall: 0.05 });
  assert.ok(arcOf(model, "Protein_Synthesis", "warm").material.opacity < 0.05, `the arcs are still at ${arcOf(model, "Protein_Synthesis", "warm").material.opacity.toFixed(3)} 200 ms after the cut — the veil lifts at 250`);
  for (let i = 4; i < 40; i += 1) model.update({ t: 303 + i * 3, r, e, progress, ended: false, wall: 0.05 });
  assert.ok(apart(bodyColour(model, "Protein_Synthesis"), STONE) > 0.03, "off the last sample the outcome should colour again");
  /* One arm shown: only that arm's arc has any length. */
  for (let i = 0; i < 40; i += 1) model.update({ t: 500, r, e, progress, ended: true, wall: 0.05, show: "resistance" });
  assert.ok(arcOf(model, "Cell_Growth", "cool").geometry.parameters.arc < 1e-3 || !arcOf(model, "Cell_Growth", "cool").visible, "under Resistance alone the cool arc should be gone");
  model.dispose();
});

test("a path one arm alone travels keeps that arm's lean through the far node's turns", async () => {
  /* Owner, fifth brief §2: at the meeting *"spotlight 때문에 오른쪽 incoming
     route가 너무 희미해지는 순간이 있어 … RhoA → JNK, ROS → JNK 두 path를 둘 다
     충분히 visible하게"*. Measured: the two are lit (one hop from the focus),
     but ROS → JNK carries cool beads only and leaned toward the arm JNK was
     SHOWING — so on every warm turn its lean went to nothing and the path fell
     back to bare stone. A path only one arm travels leans toward that arm,
     always; only a path both arms travel follows the far node's turn. */
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, []);
  const both = { r: { RhoA: 1, ROS: 0, JNK: 1 }, e: { RhoA: 1, ROS: 1, JNK: 1 }, progress: { r: { JNK: 0.8, RhoA: 0.8 }, e: { JNK: 0.8, ROS: 0.8, RhoA: 0.6 } } };
  const tube = linkTube(model, "link-ROS-JNK");
  model.update({ ...both, show: "endurance", t: 0 }); model.update({ ...both, show: "endurance", t: 3 });
  const base = linkBase(tube, COOL);
  let low = Infinity;
  for (let t = 6; t <= 1500; t += 3) {
    model.update({ ...both, show: "both", t, focus: "JNK" });
    const ray = onRay(tube.material.color, base, COOL);
    assert.ok(ray.ok, `ROS → JNK at t ${t} is off the cool ray (#${tube.material.color.getHexString()})`);
    low = Math.min(low, ray.a);
  }
  assert.ok(low >= 0.25, `ROS → JNK lost its lean (down to ${low.toFixed(3)} of 0.3) while JNK took a warm turn`);
  /* And the shared path still takes turns: RhoA → JNK carries both arms here. */
  const shared = linkTube(model, "link-RhoA-JNK");
  let warmFrames = 0, coolFrames = 0;
  for (let t = 1503; t <= 2400; t += 3) {
    model.update({ ...both, show: "both", t, focus: "JNK" });
    const c = shared.material.color;
    if (onRay(c, base, WARM).a > 0.15) warmFrames += 1; else if (onRay(c, base, COOL).a > 0.15) coolFrames += 1;
  }
  assert.ok(warmFrames > 60 && coolFrames > 60, `RhoA → JNK leaned warm ${warmFrames} / cool ${coolFrames} of 300 frames — a path both arms travel should take turns`);
  model.dispose();
});

test("AMPK arrives in the colour it was handed and eases to the network's stone", async () => {
  /* Owner, fifth brief §3: *"ENERGY purple AMPK ↓ camera pullback → same purple
     AMPK ↓ 500–800ms → neutral SIGNALS stone material"*. The scene takes a
     `seam` — the colour the floor above drew AMPK in and how much of it is
     still held — and paints AMPK, and only AMPK, that far toward it. What
     eases is the page's business (wall time, after the pull-back). */
  const { edges } = await archive(SCENARIOS.resistance);
  const model = buildHeroLevel(ROUTES, edges, []);
  const tint = new THREE.Color("#7a5c9e");
  const quiet = { t: 0, r: {}, e: {} };
  model.update(quiet);
  const before = { AMPK: bodyColour(model, "AMPK"), RhoA: bodyColour(model, "RhoA") };
  model.update({ ...quiet, t: 1, seam: { tint: "#7a5c9e", k: 1 } });
  assert.ok(apart(bodyColour(model, "AMPK"), tint) < 0.01, `held at 1, AMPK is #${bodyColour(model, "AMPK").getHexString()}, not the colour it was handed`);
  assert.ok(apart(bodyColour(model, "RhoA"), before.RhoA) < 1e-6, "the seam colour reached a node other than AMPK");
  model.update({ ...quiet, t: 2, seam: { tint: "#7a5c9e", k: 0.5 } });
  const mid = bodyColour(model, "AMPK");
  assert.ok(apart(mid, tint) > 0.02 && apart(mid, before.AMPK) > 0.02, "half held, AMPK should stand between the two");
  model.update({ ...quiet, t: 3, seam: { tint: "#7a5c9e", k: 0 } });
  assert.ok(apart(bodyColour(model, "AMPK"), before.AMPK) < 1e-6, "released, AMPK is not the stone again");
  model.dispose();
});
