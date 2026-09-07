import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import assert from "node:assert/strict";

import { fitDistance, frameCamera, shouldRoll, turnedFrame } from "./fitCamera.js";
import { LEVELS, LEVEL_ORDER } from "./fiberGeometry.js";
import { SCENE } from "../anatomyStyle.js";

/** Half-width the frame covers at `d`, for a vertical `fov` and an `aspect`. */
function coverage(d, fovDeg, aspect) {
  const t = Math.tan((fovDeg * Math.PI) / 180 / 2);
  return { halfW: d * t * aspect, halfH: d * t };
}

/**
 * THE DEFECT THIS FILE EXISTS FOR, stated as arithmetic.
 *
 * The sarcomere declared `[0, 1.3, 3.0]` and `fov: 38` and framed x = ±1.60 at
 * the origin plane, while its own anchors reach x = 3.09. Measured in a browser
 * on 2026-08-31 at 1280x900, the way in to the cell sat at x = 1531 in a
 * 1280-wide window. This is that measurement in numbers, so it cannot come back
 * without a red test.
 */
const RIG = JSON.parse(
  await readFile(new URL("../../public/mapping/rig.json", import.meta.url), "utf8"),
);

test("the old sarcomere camera could not have held its own subject", () => {
  const d = Math.hypot(0, 1.3, 3.0);
  const { halfW } = coverage(d, SCENE.camera.fov, 1280 / 900);
  assert.ok(
    halfW < 3.09,
    `the framing that shipped covered ±${halfW.toFixed(2)} and the terminal cisterna is at ` +
      `x = 3.09, so this test is asserting a state that no longer reproduces — check whether ` +
      `the level's camera or fov changed before deleting it`,
  );
});

/**
 * BOTH CONSTRAINTS, because the loser is the one that crops. A wide flat
 * subject is bounded by its width in a tall window and by its height in a wide
 * one, and taking only the width is how the bug above started.
 */
test("a frame fits at every window shape, not the one it was authored on", () => {
  const half = [2.6, 0.75];
  for (const [w, h] of [
    [1440, 820],
    [1280, 900],
    [1201, 678],
    [768, 1024],
    [320, 640],
  ]) {
    const aspect = w / h;
    const d = fitDistance(half[0], half[1], SCENE.camera.fov, aspect);
    const seen = coverage(d, SCENE.camera.fov, aspect);
    assert.ok(
      seen.halfW >= half[0],
      `at ${w}x${h} the frame covers ±${seen.halfW.toFixed(2)} of a subject that needs ±${half[0]}`,
    );
    assert.ok(
      seen.halfH >= half[1],
      `at ${w}x${h} the frame covers ${seen.halfH.toFixed(2)} high, against ${half[1]}`,
    );
  }
});

/** A canvas mid-layout reports 0x0 for one frame. Infinity is not a camera. */
test("a degenerate viewport does not fly the camera away", () => {
  const d = fitDistance(2.6, 0.75, SCENE.camera.fov, 0);
  assert.ok(Number.isFinite(d) && d > 0, `a 0-aspect frame gave ${d}`);
});

/**
 * THE ANGLE IS THE PART THAT WAS CHOSEN ON PURPOSE — `fiberGeometry.js` says
 * why (down the axis a bundle of cylinders is a circle). Only the distance and
 * the aim are computed, so the direction from the origin must survive exactly.
 */
test("fitting keeps the level's authored direction", () => {
  const from = [0, 1.3, 3.0];
  const { position, lookAt } = frameCamera(
    { centre: [0.7, 0.02, 0], half: [2.6, 0.75] },
    from,
    SCENE.camera.fov,
    1280 / 900,
  );
  const offset = position.map((v, i) => v - lookAt[i]);
  const unit = (v) => {
    const n = Math.hypot(...v);
    return v.map((c) => c / n);
  };
  const a = unit(offset);
  const b = unit(from);
  for (let i = 0; i < 3; i += 1) {
    assert.ok(
      Math.abs(a[i] - b[i]) < 1e-9,
      `axis ${i}: the fitted camera looks from ${a[i].toFixed(4)} where the level says ${b[i].toFixed(4)}`,
    );
  }
  assert.deepEqual(lookAt, [0.7, 0.02, 0], "the camera must aim at the subject, not at the origin");
});

/**
 * EVERY LEVEL DECLARES WHAT MUST BE SEEN, and every anchor it hangs a label on
 * has to be inside it. An anchor outside the frame is a label pointing off
 * screen — which is exactly what the terminal cisterna was doing.
 */
test("every fibre level frames its own anchors", () => {
  for (const key of Object.keys(LEVELS)) {
    const level = LEVELS[key];
    assert.ok(level.frame, `${key} declares no frame, so its camera fits nothing`);
    const { centre, half } = level.frame;
    for (const anchor of level.build().anchors ?? []) {
      const [ax, ay] = anchor.at;
      assert.ok(
        Math.abs(ax - centre[0]) <= half[0],
        `${key}: the "${anchor.id}" label hangs at x = ${ax}, outside the frame ` +
          `${(centre[0] - half[0]).toFixed(2)}..${(centre[0] + half[0]).toFixed(2)}`,
      );
      assert.ok(
        Math.abs(ay - centre[1]) <= half[1],
        `${key}: the "${anchor.id}" label hangs at y = ${ay}, outside the frame ` +
          `${(centre[1] - half[1]).toFixed(2)}..${(centre[1] + half[1]).toFixed(2)}`,
      );
    }
  }
});

/**
 * A PORTRAIT WINDOW TURNS THE CAMERA, AND THAT IS THE ONLY THING IT TURNS.
 *
 * Screenshotted 2026-08-31 at 320x640: the sarcomere row is 6.9 by 1.2 world
 * units and the window is 0.5:1, so fitting the length across the width left the
 * object **60 px tall in a 640 px window** — a strip in an empty field, with the
 * terminal cisterna's plate pushed off the top corner behind the app title.
 * There is no distance that makes a 5.6:1 object large in a 0.5:1 frame.
 */
test("a window narrower than the subject is elongated turns the camera", () => {
  const row = { centre: [0, 0, 0], half: [3.45, 0.75] }; // the sarcomere's own
  assert.equal(shouldRoll(row, 1280 / 900), false, "a desktop window does not roll");
  assert.equal(shouldRoll(row, 320 / 640), true, "a phone in portrait does");
  /* The threshold is the SUBJECT's shape, not a breakpoint: a nearly square
     subject never rolls, however narrow the window. */
  assert.equal(shouldRoll({ centre: [0, 0, 0], half: [1, 1] }, 320 / 640), false);
});

test("rolling fits the subject larger, which is the entire reason to do it", () => {
  const row = { centre: [0, 0, 0], half: [3.45, 0.75] };
  const aspect = 320 / 640;
  const flat = fitDistance(row.half[0], row.half[1], SCENE.camera.fov, aspect, false);
  const rolled = fitDistance(row.half[0], row.half[1], SCENE.camera.fov, aspect, true);
  assert.ok(
    rolled < flat,
    `rolled the camera stands at ${rolled.toFixed(1)} and level at ${flat.toFixed(1)} — if turning ` +
      "it does not bring the camera closer it is buying nothing and should not be done",
  );
  // and it still fits: the subject's length now measures against the screen's height
  const t = Math.tan((SCENE.camera.fov * Math.PI) / 180 / 2);
  assert.ok(rolled * t >= row.half[0], "rolled, the length no longer fits the screen's height");
  assert.ok(rolled * t * aspect >= row.half[1], "rolled, the depth no longer fits the screen's width");
});

/**
 * THE MODEL IS NEVER TURNED. Its orientation comes from the muscle's own
 * measured axis (`FiberScene` sets `model.group.quaternion` from it), which IS a
 * claim; where the photographer stands is not. So the roll may only ever appear
 * as an `up` vector, and `up` must stay perpendicular to the view or the picture
 * shears.
 */
test("the roll is an up vector, perpendicular to the view", () => {
  const row = { centre: [0.2, 0.05, 0], half: [3.45, 0.75] };
  const from = [0, 1.3, 3.0];
  const level = frameCamera(row, from, SCENE.camera.fov, 1280 / 900);
  assert.deepEqual(level.up, [0, 1, 0], "a level window must not touch the camera's up");

  const rolled = frameCamera(row, from, SCENE.camera.fov, 320 / 640);
  const view = rolled.position.map((v, i) => v - rolled.lookAt[i]);
  const dot = view[0] * rolled.up[0] + view[1] * rolled.up[1] + view[2] * rolled.up[2];
  assert.ok(
    Math.abs(dot) < 1e-9,
    `the rolled up vector is ${dot.toFixed(4)} out of perpendicular to the view, which shears the frame`,
  );
  assert.ok(
    Math.abs(Math.hypot(...rolled.up) - 1) < 1e-9,
    "the up vector is not a unit vector",
  );
});

/**
 * A MODEL TURNED ONTO A MUSCLE'S GRAIN NEEDS A TURNED FRAME.
 *
 * `FiberScene` rotates the fibre onto `handoff.muscle.axis` — the fibre line
 * `rig.mjs` fits per mesh chain — so a descent lands along the real grain
 * instead of cutting to a generic sarcomere lying on +X. 310 of the rig's mesh
 * chains carry one and they are mostly NOT along +X: median 73.9 degrees off
 * it, 113 of them past 80.
 *
 * `frame.half` states what must be visible of a model on +X, so once the model
 * turns that box is the wrong box. Screenshotted 2026-09-05 at 1440x900 while
 * descending into pectoralis major (axis [0.75, 0.18, -0.63], 41.2 degrees):
 * the sarcomere's left end ran off the bottom-left corner.
 *
 * AND THE DEPTH IS THE HALF THAT WAS MISSING TWICE. `fitDistance` frames a flat
 * rectangle; the first correction to this file pushed the camera back by the
 * frame's support along the view direction and used only width and height,
 * because nothing had ever rotated and a published frame carries two numbers. A
 * yaw moves a rod's length entirely into DEPTH — measured below, exactly — so a
 * two-axis overhang saw none of it and the model came two units toward the
 * camera unaccounted for.
 */
test("a turned frame is the bounds of the turned box, depth included", () => {
  const frame = { centre: [0, 0.02, 0], half: [2.32, 0.66] };
  const X = new THREE.Vector3(1, 0, 0);
  const round = (f) => f.half.map((n) => Number(n.toFixed(3)));

  assert.deepEqual(
    round(turnedFrame(frame, new THREE.Quaternion())),
    [2.32, 0.66, 0.66],
    "an identity turn changed the frame; the third entry is the depth a rod already had",
  );

  /* A PITCH TRADES WIDTH FOR HEIGHT and a YAW TRADES IT FOR DEPTH. Same angle,
     entirely different bill, which is why this is computed from the quaternion
     and never from an angle. */
  const pitched = new THREE.Quaternion().setFromUnitVectors(X, new THREE.Vector3(0, 1, 0));
  assert.deepEqual(round(turnedFrame(frame, pitched)), [0.66, 2.32, 0.66]);

  const yawed = new THREE.Quaternion().setFromUnitVectors(X, new THREE.Vector3(0, 0, 1));
  assert.deepEqual(round(turnedFrame(frame, yawed)), [0.66, 0.66, 2.32]);
});

test("nothing the rig can ask for is framed off the stage", () => {
  /* THE WHOLE RIG, EVERY LEVEL, FOUR WINDOW SHAPES. This is the assertion the
     two above exist to support, and it is cheap: 310 axes is a millisecond and
     the alternative is finding out which muscle crops by descending into it.
     `shouldRoll` is part of the answer — a turned rod is tall and thin, and
     turning the CAMERA is how a tall subject fits a wide window — so what must
     fit is read the way `fitDistance` reads it rather than always as height.
     Measured worst fill across all of it: 0.79 of the frame. */
  const t = Math.tan(((SCENE.camera.fov / 2) * Math.PI) / 180);
  const X = new THREE.Vector3(1, 0, 0);
  const over = [];
  for (const [name, chain] of Object.entries(RIG.meshChain ?? {})) {
    const a = chain?.fibre?.a;
    if (!a) continue;
    const spin = new THREE.Quaternion().setFromUnitVectors(
      X,
      new THREE.Vector3(...a).normalize(),
    );
    for (const id of LEVEL_ORDER) {
      const frame = turnedFrame(LEVELS[id].frame, spin);
      for (const aspect of [1440 / 900, 1920 / 1080, 420 / 780, 1024 / 768]) {
        const cam = frameCamera(frame, LEVELS[id].camera, SCENE.camera.fov, aspect);
        const d = Math.hypot(...cam.position.map((p, i) => p - cam.lookAt[i]));
        const rolled = shouldRoll(frame, aspect);
        const [across, up] = rolled
          ? [frame.half[1], frame.half[0]]
          : [frame.half[0], frame.half[1]];
        /* MEASURED AT THE NEAR FACE, NOT AT THE CENTRE, AND THE FIRST VERSION
           OF THIS GATE WAS TAUTOLOGICAL. Reading the fill at `d` asks exactly
           what `fitDistance` already guarantees, so it could not fail: faked
           the depth term to zero and this stayed green.
           Under perspective the closest part of the box is what overflows, and
           it sits `overhang` nearer than the centre — the same support along
           the view direction `frameCamera` pushes back by. Reading there is the
           only reading that can catch the term being wrong. */
        const len = Math.hypot(...LEVELS[id].camera) || 1;
        const dir = LEVELS[id].camera.map((n) => n / len);
        const overhang =
          Math.abs(frame.half[0] * dir[0]) +
          Math.abs(frame.half[1] * dir[1]) +
          Math.abs((frame.half[2] ?? frame.half[1]) * dir[2]);
        const near = Math.max(d - overhang, 0.001);
        const fill = Math.max(up / (t * near), across / (t * near * aspect));
        if (fill >= 1) over.push(`${name} · ${id} · ${aspect.toFixed(2)} fills ${fill.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(over, [], `a muscle's own grain frames its fibre off the stage:\n  ${over.join("\n  ")}`);
});
