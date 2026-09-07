/**
 * How far back a camera has to stand for the whole subject to be in the frame.
 *
 * WHY THIS EXISTS. Every deep scale declares one camera position, typed once,
 * and a typed position frames the subject at exactly one window shape. A
 * perspective camera's `fov` is VERTICAL, so the width it covers is
 * `fov * aspect` — the same camera shows a wide object on a wide window and
 * crops it on a narrow one, with no warning and no error.
 *
 * WHAT THAT COST, measured 2026-08-31 in a browser at 1280x900. The fibre's
 * sarcomere declared `camera: [0, 1.3, 3.0]` with `fov: 38`, which covers
 * x = ±1.60 at the origin plane. Its own anchors run from actin at x = -1.7 to
 * the terminal cisterna at x = 3.09. So a third of the subject was outside the
 * picture in the scale's resting state — including the mitochondria, and
 * therefore the ring that is the whole way down to the cell:
 * `[data-testid="way-in"]` measured **x = 1531 in a 1280-wide window**. The
 * descent had no visible door on the one scale that has one.
 *
 * The camera had been aimed at a window shape nobody wrote down, and every
 * other window shape was cropped. This makes the shape an input.
 *
 * WHAT THIS IS NOT. It is not a fit to the geometry's bounding box. That box
 * cannot be measured here: these levels are `InstancedMesh` and their instance
 * matrices are written by `update()` on a live reading, so at build time
 * `Box3.setFromObject` sees only the base geometry at the origin and answers
 * ±0.80 for an object that draws out to 3.09. A level states what has to be
 * visible; this puts the camera where that is true.
 */

import * as THREE from "three";

/** Room around the subject, as a fraction. Not a look — a subject that ends
    exactly at the frame edge reads as cropped even when every pixel is there,
    and the labels hang outside their anchors. */
const MARGIN = 1.12;

/**
 * The distance at which a `halfW` x `halfH` subject fits a `fov`/`aspect` frame.
 *
 * Both constraints, and the loser is the one that would crop: a wide flat
 * subject in a tall window is bounded by its width, the same subject in a wide
 * window by its height. Taking only one is how this class of bug starts.
 */
export function fitDistance(halfW, halfH, fovDeg, aspect, rolled = false) {
  const halfFov = (fovDeg * Math.PI) / 180 / 2;
  const t = Math.tan(halfFov);
  /* A degenerate frame is a real state — R3F renders one frame at 0x0 while a
     canvas is being laid out — and dividing by it would fly the camera to
     Infinity and leave it there for the ease to chase back. */
  const a = aspect > 0 ? aspect : 1;
  /* Rolled, the subject's width is measured against the screen's HEIGHT and its
     height against the screen's width — the two constraints swap places, which
     is the whole of what turning the camera buys. */
  const [across, up] = rolled ? [halfH, halfW] : [halfW, halfH];
  return Math.max(up / t, across / (t * a)) * MARGIN;
}

/**
 * Whether to turn the camera on its side for this window.
 *
 * WHY A PORTRAIT WINDOW NEEDS THIS. These subjects are long and thin — the
 * sarcomere row measures 6.9 by 1.2 world units, 5.6:1 — and a 320x640 phone is
 * 0.5:1. Fitting the length across the width is the only honest thing a
 * level-headed camera can do there, and it leaves the object 60 px tall in a
 * 640 px window: screenshotted 2026-08-31, a strip in an empty field with the
 * terminal cisterna's plate pushed off the top corner behind the app title.
 * There is no distance that makes a 5.6:1 object large in a 0.5:1 frame.
 *
 * SO THE FRAME TURNS, NOT THE SUBJECT. This is a `up` vector and nothing else:
 * the model keeps the orientation `FiberScene` gives it from the muscle's own
 * measured axis, which IS a claim, and the camera's roll is not — it is where a
 * photographer stands. Turning the model instead would put a fibre across the
 * screen that runs along the arm.
 *
 * THE THRESHOLD IS THE DEFINITION, NOT A BREAKPOINT: turn the camera exactly
 * when turning it lets the camera stand CLOSER, which is the only thing turning
 * it is for. That is `fitDistance` rolled against `fitDistance` level, and the
 * `tan(fov/2)` cancels out of both sides — so this holds at any field of view
 * and there is no second number to keep in step.
 *
 * The first version reasoned about it in algebra instead (`halfW / halfH >
 * 1 / aspect`) and had the comparison backwards: it rolled a 4.6:1 subject in a
 * 1.42:1 desktop window, where turning the camera moves it FURTHER away. Two
 * tests caught it. Comparing the two distances says what is meant, and cannot
 * be got backwards without saying something visibly absurd.
 */
export function shouldRoll(frame, aspect) {
  if (!(aspect > 0)) return false;
  const [halfW, halfH] = frame.half;
  if (!(halfW > 0) || !(halfH > 0)) return false;
  const level = Math.max(halfH, halfW / aspect);
  const rolled = Math.max(halfW, halfH / aspect);
  return rolled < level;
}

/**
 * Where to stand, and what to look at, for `frame` to be wholly in shot.
 *
 * THE AUTHORED ANGLE SURVIVES; ONLY THE DISTANCE AND THE AIM ARE COMPUTED.
 * `from` is the level's own camera constant and it carries a decision this
 * cannot make — `fiberGeometry.js`: everything here is a bundle of parallel
 * cylinders along X, and down the axis a bundle of cylinders is a circle, so
 * the banding only exists side-on and the small swing off the axis is what
 * stops it going flat. That direction is kept exactly. What changes is how far
 * along it the camera sits, and that it aims at the subject's centre rather
 * than at the origin the subject is not centred on.
 */
export function frameCamera(frame, from, fovDeg, aspect) {
  const [cx, cy, cz] = frame.centre;
  const [fx, fy, fz] = from;
  const rolled = shouldRoll(frame, aspect);
  /* The direction is taken from the ORIGIN, which is where these constants were
     authored to look. Measuring it from the centre instead would swing the
     angle whenever a subject's centre moved, and the angle is the part that was
     chosen on purpose. */
  const len = Math.hypot(fx, fy, fz) || 1;
  /* THE FRAME HAS DEPTH TOWARD THE CAMERA, AND FITTING IT FLAT IS WHY THE
     FASCICLE RAN OFF THE RIGHT EDGE.

     `fitDistance` answers "how far back does a rectangle of this size have to
     be", which is exact for a rectangle facing the camera and wrong for a long
     object seen at an angle: the near end is closer than the centre, and under
     perspective closer means bigger. The overhang is the frame's own support
     along the view direction — `halfW·|dirX| + halfH·|dirY|` — and it grows
     with the swing:

         swing 12.0 deg   fascicle overhang 0.59
         swing 26.2 deg   fascicle overhang 1.26

     Screenshotted 2026-09-05 at 1440x900 after the three level directions were
     re-authored into a descent path: the fascicle's near end ran past the right
     edge of the stage, and nothing was wrong with the frame — the frame is
     measured, from `window.__fiberBox()`, and had not changed. What changed was
     the angle, and the fit had never accounted for one.

     So the distance is pushed back by the overhang. At swing 0 the term is the
     elevation's alone and the sarcomere — whose framing nobody has complained
     about — moves by 0.26 of a unit against a fitted distance near 3, which is
     inside the margin it already carried. */
  const dirRaw = [fx / len, fy / len, fz / len];
  /* ALL THREE AXES, AND THE FIRST VERSION HAD TWO.
     `frame.half` publishes width and height because nothing ever rotated and a
     rod's depth is its own radius, which the height already stood for. Once
     `FiberScene` turns the model onto a muscle's fibre axis that stops being
     true: measured on pectoralis major (axis [0.75, 0.18, -0.63]) the
     sarcomere's box turns to half 2.28 x 1.12 with a DEPTH of 2.02, so the near
     end of the rod comes two units toward the camera and a two-axis overhang
     saw none of it. The model ran off the bottom-left corner with the frame
     already "corrected".
     `half[2] ?? half[1]` — the published frames carry two entries and a rod is
     as deep as it is tall, which is exact for these three levels and
     conservative for anything fatter. */
  const halfD = frame.half[2] ?? frame.half[1];
  const overhang =
    Math.abs(frame.half[0] * dirRaw[0]) +
    Math.abs(frame.half[1] * dirRaw[1]) +
    Math.abs(halfD * dirRaw[2]);
  const d = fitDistance(frame.half[0], frame.half[1], fovDeg, aspect, rolled) + overhang;
  /* THE UP VECTOR, AND IT IS PERPENDICULAR TO THE VIEW RATHER THAN TO THE WORLD.
     Rolled, "up on screen" is the direction that was across it, which is the
     view direction crossed with world up. Computed rather than typed as
     `[1,0,0]`, because these cameras sit off-axis on purpose (the swing that
     stops a bundle of parallel cylinders reading as a circle) and a typed axis
     would tilt the subject by however much that swing is. */
  const dir = dirRaw;
  // dir x (0,1,0) — the horizontal axis across the screen, whatever the swing is.
  const right = [-dir[2], 0, dir[0]];
  const rl = Math.hypot(...right) || 1;
  return {
    position: [cx + dir[0] * d, cy + dir[1] * d, cz + dir[2] * d],
    lookAt: [cx, cy, cz],
    up: rolled ? [right[0] / rl, right[1] / rl, right[2] / rl] : [0, 1, 0],
  };
}

/**
 * A level's frame, turned onto a muscle's grain.
 *
 * `frame.half` is `[halfWidth, halfHeight]` of a box centred on `frame.centre`,
 * measured for a model lying along +X. The third half-extent is not published
 * because it never mattered while nothing rotated — a rod is as deep as it is
 * tall, so the height stood in for it, which is exact for these levels and
 * conservative for anything fatter.
 *
 * The turned box is the axis-aligned bounds of the eight rotated corners. Taken
 * that way rather than from an angle because the same 41 degrees costs the
 * frame nothing as a yaw and doubles it as a pitch, and only the quaternion
 * knows which the muscle asked for.
 */
export function turnedFrame(frame, spin) {
  const [hw, hh] = frame.half;
  const hd = hh;
  const v = new THREE.Vector3();
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        v.set(sx * hw, sy * hh, sz * hd).applyQuaternion(spin);
        mx = Math.max(mx, Math.abs(v.x));
        my = Math.max(my, Math.abs(v.y));
        mz = Math.max(mz, Math.abs(v.z));
      }
    }
  }
  /* THE DEPTH RIDES ALONG. `fitDistance` frames width and height; the third
     entry is what `frameCamera` needs to know how far the near end of a turned
     rod comes toward the camera, which is the whole failure this is a
     correction of. */
  return { centre: frame.centre, half: [mx, my, mz] };
}
