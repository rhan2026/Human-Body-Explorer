import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as THREE from "three";

import { LEVELS } from "./fiberGeometry.js";
import { advance, createFiberState, forcePeaks, storeCeilings } from "./fiberSimulation.js";
import { fiberParts, fiberTour } from "./fiberTour.js";

/**
 * A SHOT HAS TO AIM AT THE MODEL.
 *
 * `anchorsLand.test.js` asks whether a leader line lands on tissue. This asks
 * the same question one layer up, about the camera: a beat that says *"that
 * calcium waits in the store beside this tube"* has to be LOOKING at the tube.
 *
 * Measured 2026-09-05, before this gate: it was not. `fiberTour.js` typed
 * `const TRIAD_X = 1.4` and `const CISTERNA_X = 3 + TRIAD_GAP`, both of them the
 * three-sarcomere row's numbers. `SARC_COUNT` went to two on canon D1 and the
 * geometry recomputed its own anchors off `junctionX()` — the t-tubule to
 * x 0.300 and the terminal cisterna to x 1.990. `fiberGeometry.js` says so in
 * `LEVELS.sarcomere.frame`'s own comment, "the cisterna's anchor is x = 1.99".
 *
 * So four of the six beats that play aimed at coordinates the model does not
 * occupy: [1.40, 0.55, 0] sits in the middle of a sarcomere's A-band, and
 * [3.09, 0.57, 0] is 0.77 past the right edge of the level's own frame. The
 * beacon went with the camera, so the pulsing ring that exists to answer *"i
 * dont even know where the store is"* was pointing at empty paper.
 *
 * WHY NO EXISTING GATE SAW IT. `fiberTour.test.js` builds the pass with no
 * anchors, so `anchorAt()` returns [0,0,0] for every id and the typed constants
 * are the only coordinates in the storyboard it ever sees. This file builds the
 * real level and hands the pass its real anchors, which is the only arrangement
 * in which a copied constant can disagree with anything.
 *
 * THE RULE, and it is the one this file's own subject already states: an anchor
 * moved in the geometry moves the shot with it. A coordinate typed beside the
 * storyboard is how that stops being true.
 */

const RUN = JSON.parse(
  await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8"),
);
const T = RUN.series?.t ?? RUN.t;
const STORE = RUN.series?.Ca_SR_total ?? RUN.Ca_SR_total;
const PROTOCOL = RUN.protocol;

/** `storeCeilings`' own arithmetic, off the shipped bytes rather than the app. */
const firing = (t) => {
  const k = Math.floor(t / PROTOCOL.cycle_s);
  return k < PROTOCOL.repetitions && t - k * PROTOCOL.cycle_s < PROTOCOL.stim_s;
};
const CEILINGS = [];
for (let k = 1; k < PROTOCOL.repetitions; k += 1) {
  let bestI = null;
  for (let i = 0; i < T.length; i += 1) {
    const t = T[i];
    if (t < k * PROTOCOL.cycle_s || t >= (k + 1) * PROTOCOL.cycle_s || firing(t)) continue;
    if (bestI === null || STORE[i] > STORE[bestI]) bestI = i;
  }
  if (bestI !== null) CEILINGS.push({ rep: k + 1, at: T[bestI], value: STORE[bestI] });
}

/** `forcePeaks`' arithmetic off the shipped bytes — the ending's two frames. */
const FORCE = RUN.series?.force_relative ?? RUN.force_relative;
const PEAKS = [];
for (let k = 0; k < PROTOCOL.repetitions; k += 1) {
  let bi = null;
  for (let i = 0; i < T.length; i += 1) {
    if (T[i] < k * PROTOCOL.cycle_s || T[i] >= (k + 1) * PROTOCOL.cycle_s) continue;
    if (bi === null || FORCE[i] > FORCE[bi]) bi = i;
  }
  if (bi !== null) PEAKS.push({ rep: k + 1, at: T[bi], frameAt: T[bi], force: FORCE[bi] });
}
if (PEAKS.length) {
  const phase = PEAKS[0].at;
  for (const r of PEAKS) r.frameAt = (r.rep - 1) * PROTOCOL.cycle_s + phase;
}

/** The union of every drawn instance, the way `anchorsLand.test.js` measures it. */
function boxOf(group) {
  const box = new THREE.Box3();
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone();
    if (o.isInstancedMesh) {
      const m = new THREE.Matrix4();
      const inst = new THREE.Box3();
      for (let i = 0; i < o.count; i += 1) {
        o.getMatrixAt(i, m);
        inst.copy(o.geometry.boundingBox).applyMatrix4(m).applyMatrix4(o.matrixWorld);
        box.union(inst);
      }
      return;
    }
    box.union(b.applyMatrix4(o.matrixWorld));
  });
  return box;
}

/** The sarcomere as it is actually drawn, a second into the run. */
function builtSarcomere() {
  const model = LEVELS.sarcomere.build();
  const s = createFiberState();
  for (let i = 0; i < 60; i += 1) advance(s, 1 / 60);
  model.update(s, s.time);
  return model;
}

test("every shot the pass takes is aimed at a point on the model", () => {
  const model = builtSarcomere();
  const box = boxOf(model.group);
  const size = box.getSize(new THREE.Vector3()).length();
  const beats = fiberTour(PROTOCOL, CEILINGS, PEAKS, [...model.anchors, ...(model.sites ?? [])]);

  assert.ok(beats.length > 0, "the pass built empty, so this gate graded nothing");

  const astray = [];
  for (const [i, beat] of beats.entries()) {
    if (!beat.lookAt) continue;
    const p = new THREE.Vector3(...beat.lookAt);
    if (box.containsPoint(p)) continue;
    astray.push(
      `beat ${i} ("${String(beat.line ?? "").slice(0, 44)}…") looks at ` +
        `[${beat.lookAt.map((n) => n.toFixed(2)).join(", ")}], ` +
        `${((box.distanceToPoint(p) / size) * 100).toFixed(1)}% of the model away`,
    );
  }

  model.dispose();
  assert.deepEqual(astray, [], `a beat aimed at empty paper:\n  ${astray.join("\n  ")}`);
});

test("the beats that name a triad are aimed at the triad the geometry built", () => {
  const model = builtSarcomere();
  const beats = fiberTour(PROTOCOL, CEILINGS, PEAKS, [...model.anchors, ...(model.sites ?? [])]);
  const at = (id) => model.anchors.find((a) => a.id === id)?.at ?? null;

  /* The two halves of the triad, by the ids `buildSarcomereLevel` gives them.
     If either disappears this gate has to be told, not silently pass. */
  for (const id of ["t-tubule", "sr"]) {
    assert.ok(at(id), `the sarcomere no longer has an anchor called "${id}"`);
  }

  /* A CLOSE BEAT THAT FOCUSES AN ANCHOR MUST LOOK AT IT. `focus` is the id the
     beacon lands on, so on a close-up a lookAt that disagrees with it puts the
     camera and the pulsing ring in two different places.

     A WIDE beat is exempt, and deliberately: `WIDE` is the framing that holds
     the whole model, and the beat that runs all ten repetitions carries
     `focus: "t-tubule"` precisely so the beacon can mark the command while the
     camera shows everything the command does. Aiming a wide shot at one anchor
     would throw away the reason it is wide. The exemption is the framing, not
     the beat — a beat that composes its own close shot gets no pass. */
  const isWide = (beat) =>
    Array.isArray(beat.camera) &&
    beat.camera.length === 3 &&
    beat.camera.every((n, k) => n === LEVELS.sarcomere.camera[k]);

  /* WHERE THE BEACON ACTUALLY GOES, which is `useTour`'s own expression:
       { id: beat.focus, at: beat.focusAt ?? beat.lookAt ?? null }
     The first version of this gate compared the lookAt against the FOCUS
     ANCHOR, and that is not what gets drawn. A part can be drawn more than once
     — there are four t-tubules on this model — so a beat may name the part with
     `focus` and point at the instance it is framing with `focusAt`. Grading the
     anchor demanded that the pass frame the LABELLED tubule, which sits a whole
     sarcomere from the labelled store, and the sentence the beat carries is
     "the store beside this tube". */
  const beaconOf = (beat) => beat.focusAt ?? beat.lookAt ?? null;

  const disagreeing = [];
  for (const [i, beat] of beats.entries()) {
    if (!beat.focus || !beat.lookAt || isWide(beat)) continue;
    const anchor = beaconOf(beat);
    if (!anchor) continue;
    const d = Math.hypot(
      beat.lookAt[0] - anchor[0],
      beat.lookAt[1] - anchor[1],
      beat.lookAt[2] - anchor[2],
    );
    if (d > 0.001) {
      disagreeing.push(
        `beat ${i} rings "${beat.focus}" at [${anchor.map((n) => n.toFixed(3)).join(", ")}] ` +
          `but looks at [${beat.lookAt.map((n) => n.toFixed(3)).join(", ")}] — ${d.toFixed(3)} away`,
      );
    }
  }

  /* AND WHEREVER IT RINGS, IT RINGS SOMETHING. This is the assertion the
     `focusAt` exemption above has to be paid for with: a beat may point the
     beacon away from the labelled anchor, and it may not point it at paper. */
  const box = boxOf(model.group);
  const size = box.getSize(new THREE.Vector3()).length();
  const nowhere = [];
  for (const [i, beat] of beats.entries()) {
    const p = beaconOf(beat);
    if (!beat.focus || !p) continue;
    const v = new THREE.Vector3(...p);
    if (box.containsPoint(v)) continue;
    nowhere.push(
      `beat ${i} rings "${beat.focus}" at [${p.map((n) => n.toFixed(2)).join(", ")}], ` +
        `${((box.distanceToPoint(v) / size) * 100).toFixed(1)}% of the model away`,
    );
  }

  model.dispose();
  assert.deepEqual(
    disagreeing,
    [],
    `the camera and the beacon are in two places:\n  ${disagreeing.join("\n  ")}`,
  );
  assert.deepEqual(nowhere, [], `a beacon pulsing on empty paper:\n  ${nowhere.join("\n  ")}`);
});

test("no coordinate in the storyboard is typed where the geometry already knows it", async () => {
  /* THE CAUSE, NOT THE SYMPTOM. The two tests above catch a stale constant once
     it has drifted. This one refuses the shape of mistake that produces it: a
     bare number multiplied against the model's own layout, sitting next to a
     storyboard that has `anchorAt` right there. `TRIAD_GAP` is imported and
     used for real spacing, so the ban is on the sarcomere ROW arithmetic — a
     literal standing in for where a triad is. */
  const raw = await readFile(new URL("./fiberTour.js", import.meta.url), "utf8");
  /* COMMENTS OUT FIRST, and the reason is that this gate caught itself. The
     note `fiberTour.js` now carries about the deleted constants quotes their
     names, because a scar that cannot say what it is a scar of teaches nobody.
     A ban that reads prose bans writing the history down. */
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const banned = [/\bconst\s+TRIAD_X\b/, /\bconst\s+CISTERNA_X\b/];
  const found = banned.filter((re) => re.test(source)).map((re) => String(re));
  assert.deepEqual(
    found,
    [],
    `fiberTour.js is typing a triad coordinate again instead of reading the anchor:\n  ${found.join("\n  ")}`,
  );
});

test("no shot is composed inside the orbit clamp it will be handed back to", () => {
  /* A SHOT THE CONTROLS WILL MOVE IS A SHOT NOBODY COMPOSED.
     `FiberScene` gives `OrbitControls` `minDistance: 1.4` and `maxDistance: 16`.
     A beat framed outside that range is framed at a distance the scene cannot
     hold: the pass ends, a hand touches anything, and the camera slides to the
     clamp — the composition changing for a reason nothing on screen explains.

     Measured 2026-09-05: the two ATP beats stood 0.844 back, because the
     molecule they are about is 0.17 long against a 4.4-unit row and the shot
     was sized to the subject with nothing asked about the controls. It was the
     fourth thing wrong with that molecule and the first that only a gate could
     see — a wrong sarcomere, a burial inside the lattice and a shot aimed at
     the anchor instead of the head were all caught by looking at it. */
  const model = builtSarcomere();
  const points = [...model.anchors, ...(model.sites ?? [])];
  const MIN = 1.4;
  const MAX = 16;

  const outside = [];
  const check = (label, beats) => {
    for (const [i, beat] of beats.entries()) {
      if (!Array.isArray(beat.camera) || !Array.isArray(beat.lookAt)) continue;
      const d = Math.hypot(
        beat.camera[0] - beat.lookAt[0],
        beat.camera[1] - beat.lookAt[1],
        beat.camera[2] - beat.lookAt[2],
      );
      /* The wide framing is fitted at runtime against the live window, so its
         distance is not this array's to state — `frameCamera` owns it, and
         `fitCamera.test.js` grades that it fits. What is graded here is every
         shot this file composes itself. */
      if (beat.camera === LEVELS.sarcomere.camera) continue;
      if (d < MIN || d > MAX) outside.push(`${label} ${i}: ${d.toFixed(3)} back`);
    }
  };
  check("pass beat", fiberTour(PROTOCOL, CEILINGS, PEAKS, points));
  for (const part of fiberParts(PROTOCOL, points)) check(`part ${part.id} beat`, part.beats);

  model.dispose();
  assert.deepEqual(
    outside,
    [],
    `a shot the orbit controls will move as soon as the pass hands them back:\n  ${outside.join("\n  ")}`,
  );
});
