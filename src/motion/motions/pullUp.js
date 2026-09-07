/**
 * A pull-up.
 *
 * Structurally the push-up upside down, and deliberately built that way: one
 * number varies — elbow flexion — and everything else is solved from it. The
 * hands are fixed on the bar, so a flexed elbow raises the BODY rather than
 * lowering the shoulder, and the height it rises to is found by the same
 * bisection the push-up uses for its pitch. Hands and bar therefore stay welded
 * together for the whole rep instead of the body drifting through the bar.
 *
 * TODO.md asked for this one before running, because it takes the shoulder
 * through a far larger range than a push-up does — around 140 degrees against
 * 70 — and that is the only way to find out whether the rotator cuff, the biceps
 * long head's proximal chain, dual quaternion skinning and volume preservation
 * actually hold up. All four were fixed for the push-up and barely show in it.
 *
 * Tempo is 2-0-1-1 over 4.4 s: a controlled 1.8 s lower, no bounce off the dead
 * hang, a 1.2 s pull, and a hold at the top. Standard coaching form; this is
 * hand-authored movement, not motion capture.
 */

import * as THREE from "three";

import { applyPose, orientSegment, solveScalar, placeRoot } from "../../rig.js";
import { sampleTrack, smooth, press, cycle } from "../ease.js";
import { solveArmTo, DEG } from "../kinematics.js";
import { guardPose } from "../definition.js";

const DURATION = 4.4;

/** Bar height. High enough that a 1.75 m body hangs clear of the floor. */
const BAR_Y = 2.28;

/** Hands 1.5x shoulder width — a standard pronated pull-up grip. */
const GRIP_WIDTH = 1.5;

/**
 * Elbow interior angle. Nearly straight at the dead hang, 50 degrees at the
 * top. Not tighter: the body height is solved FROM this angle, and each extra
 * degree of fold pushes the elbows further off the shoulder-to-hand line —
 * 44 degrees was what folded them across the face.
 */
const elbowAngleDeg = (flex) => 172 - 122 * flex;

/**
 * The hand on the bar, as one fixed world frame: the metacarpals arc over the
 * top toward the far side and the palm faces up at the bar it hangs from.
 * Constant on purpose — a grip that reorients during the rep is a grip the eye
 * reads as slipping. The wrist IK targets are DERIVED from this frame and the
 * bar, so palm contact is geometry, not tuning.
 */
const FINGERS = new THREE.Vector3(0, -0.15, -0.99).normalize();
const PALM_N = new THREE.Vector3(0, 0.99, -0.15).normalize();
/** Bar radius (matches the PullUpBar prop) plus the palm's skin offset. */
const BAR_IN_PALM = 0.016 + 0.013;
/** Wrist joint to mid-palm, where the bar actually rests. */
const PALM_LEN = 0.05;

/**
 * Where each elbow's off-line offset points as the pull deepens: nearly pure
 * lateral early — the elbows flare OUT as they flex, never forward across the
 * face — easing toward out-and-forward at the top, which is what a chest-to-bar
 * finish does. X mirrors between sides.
 */
const ELBOW_OUT_EARLY = new THREE.Vector3(0.97, 0.0, 0.24).normalize();
const ELBOW_OUT_TOP = new THREE.Vector3(0.68, 0.08, 0.73).normalize();

/**
 * How far the root sets back (−Z) as the pull deepens. The head must clear the
 * bar it rises past: with the root held at z = 0 the crown swept straight
 * through the bar at the top of the rep. Scaled by flex so the dead hang is
 * untouched, and applied wherever the root is placed for the frame — here that
 * is only the height bisection's closure. The arms still reach: the bisection
 * absorbs the extra horizontal offset by settling the body on the same arm
 * length, slightly higher up.
 */
const HEAD_SETBACK = 0.13;

const TRACK = [
  { t: 0.0, v: 0.0 },
  { t: 0.5, v: 0.0, ease: "smooth" }, // dead hang, fully extended
  { t: 1.7, v: 1.0, ease: "press" }, // the pull
  { t: 2.5, v: 1.0, ease: "smooth" }, // chin over the bar
  { t: 4.4, v: 0.0, ease: "smooth" }, // controlled descent
];

const _shoulder = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _out = new THREE.Vector3();
const _axis = new THREE.Vector3();

export const pullUp = {
  id: "pull_up",
  label: "Pull-up",
  duration: DURATION,
  loop: true,
  roles: "pull_up",
  camera: "hang_front",
  props: ["floor", "bar"],
  barHeight: BAR_Y,
  note: "Elbow flexion is the only keyframed value; body height, arm angles and the grip are solved from it.",

  phases: [
    { at: 0.0, name: "hang", label: "Dead hang" },
    { at: 0.5, name: "concentric", label: "Pulling · concentric" },
    { at: 1.7, name: "top", label: "Chin over bar" },
    { at: 2.5, name: "eccentric", label: "Lowering · eccentric" },
  ],

  /**
   * Hardest coming out of the dead hang, where the lat is at full length and its
   * moment arm at the shoulder is shortest. Illustrative, not a force model.
   */
  effortAt(t) {
    const flex = sampleTrack(TRACK, t, DURATION);
    const phase = t % DURATION;
    const pulling = phase >= 0.5 && phase < 1.7;
    // The lower is loaded too, just less: an eccentric holds maybe 70% of the
    // concentric at the same joint angle.
    return (0.22 + 0.78 * (1 - 0.55 * flex)) * (pulling ? 1 : 0.72) * (flex > 0.02 || pulling ? 1 : 0.42);
  },

  setup({ rig, body }) {
    const shoulderL = new THREE.Vector3(...rig.joints["shoulder.L"]);
    const shoulderR = new THREE.Vector3(...rig.joints["shoulder.R"]);

    // Grip is derived from the measured shoulders, so it stays a real grip width
    // if the mesh set is rebuilt.
    const halfGrip = ((shoulderL.x - shoulderR.x) / 2) * GRIP_WIDTH;

    // The wrist is placed so the bar rests exactly in the palm: mid-palm sits
    // one bar-radius-plus-skin below the bar centre along the palm normal, and
    // the wrist is one palm-length back down the fingers from there.
    const wristTarget = (x) =>
      new THREE.Vector3(x, BAR_Y, 0)
        .addScaledVector(PALM_N, -BAR_IN_PALM)
        .addScaledVector(FINGERS, -PALM_LEN);

    return {
      body,
      hand: { L: wristTarget(halfGrip), R: wristTarget(-halfGrip) },
      // The bar the hands are welded to, exposed so the pose tests can measure
      // the grip against it rather than against a copied constant.
      barCentre: new THREE.Vector3(0, BAR_Y, 0),
      shoulderRestY: (shoulderL.y + shoulderR.y) / 2,
      // Reused each frame by the bisection so it allocates nothing per frame.
      probe: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      position: new THREE.Vector3(),
    };
  },

  frame(t, { rig, root, groups }, state) {
    const flex = sampleTrack(TRACK, t, DURATION);
    const body = state.body;

    const elbow = elbowAngleDeg(flex) * DEG;
    const reach = Math.sqrt(
      body.arm.upper ** 2 + body.arm.fore ** 2 - 2 * body.arm.upper * body.arm.fore * Math.cos(elbow),
    );

    /**
     * A hanging body is not still. The legs swing a little, the pelvis tilts as
     * the lats fire, and the whole thing rotates a few degrees about the bar.
     * Without some of that it reads as a mannequin on a hook.
     */
    const sway = Math.sin((t / DURATION) * Math.PI * 2) * (1 - 0.55 * flex);
    const breathe = cycle((t / DURATION) * 2);

    applyPose(
      groups,
      guardPose({
        // Scapulae depress and retract as the pull starts — the cue every coach
        // gives, and the reason a pull-up is not just an elbow curl. Positive Z
        // is toward the model's left, so the sides mirror.
        "girdle.L": [-4 - 9 * flex, 0, -3 + 13 * flex],
        "girdle.R": [-4 - 9 * flex, 0, 3 - 13 * flex],

        // Trunk stays close to vertical with a slight extension at the top, which
        // is what gets the chin past the bar. Spine points up, so negative X is
        // extension.
        lumbar: [1.5 - 6 * flex, 0.8 * sway, 0.6 * sway],
        thorax: [1.0 - 8 * flex, 1.2 * sway, 0.5 * sway],
        // The chin rises to the bar with the neck as much as with the body,
        // but only a little: a chin-over-bar finish keeps the chin close to
        // neutral. The strong extension this used to command tipped the face
        // up into the bar itself.
        neck: [-2 - 7 * flex, 0, 0],
        head: [-1 - 5 * flex, 0, 0],

        // Legs hang, knees a little flexed, drifting slightly forward as the body
        // rises. Thigh points down, so negative X is hip flexion.
        "thigh.L": [-6 - 13 * flex, 0, -2.5 + 1.5 * sway],
        "thigh.R": [-6 - 13 * flex, 0, 2.5 + 1.5 * sway],
        "shank.L": [26 + 16 * flex, 0, 0],
        "shank.R": [26 + 16 * flex, 0, 0],
        // Positive X is plantarflexion: the ankles hang, as they do unweighted.
        "foot.L": [16 + 3 * breathe, 0, 0],
        "foot.R": [16 + 3 * breathe, 0, 0],

        // Closed overhand grip round the bar, constant — a grip that pumps as
        // the elbow flexes is a grip the eye reads as slipping.
        "fingers.L": [56, 0, 0],
        "fingers.R": [56, 0, 0],
        "fingersMid.L": [76, 0, 0],
        "fingersMid.R": [76, 0, 0],
        "fingersTip.L": [42, 0, 0],
        "fingersTip.R": [42, 0, 0],
        "thumb.L": [42, 0, 0],
        "thumb.R": [42, 0, 0],
      }),
      rig,
    );

    /**
     * Find the body height that puts the shoulder exactly an arm's length from
     * its fixed hand.
     *
     * Same argument as the push-up's plank bisection: computing the height from
     * trigonometry leaves a residual that the IK reach clamp absorbs, and the
     * visible result is a body that creeps up and down through the bar instead
     * of hanging from it.
     *
     * The bracket is the part that matters, and getting it wrong is not subtle.
     * Shoulder-to-hand distance is NOT monotonic in body height: it falls as the
     * body rises, reaches a minimum when the shoulder is directly under its hand,
     * and climbs again past that. A bracket whose top is above that minimum has
     * the same error sign at both ends, no root between them, and the search
     * settles on the far end — which put the body a clear half metre above the
     * bar, hanging from nothing. So the top of the range is pinned just below
     * the hand, where the shoulder can never overshoot.
     */
    const shoulderBone = groups.get("upperarm.L");
    const err = (y) => {
      // x stays 0; z is the head's setback past the bar, growing with the pull.
      state.position.set(0, y, -HEAD_SETBACK * flex);
      placeRoot(root, { quaternion: state.quaternion, position: state.position, deep: false });
      shoulderBone.updateWorldMatrix(true, false);
      shoulderBone.getWorldPosition(state.probe);
      // Positive when the shoulder is too far from the hand, i.e. hanging too low.
      return state.probe.distanceTo(state.hand.L) - reach;
    };
    const base = state.hand.L.y - state.shoulderRestY;
    solveScalar(err, base - 0.62, base - 0.06);
    root.updateMatrixWorld(true);

    /**
     * Hands are fixed on the bar; the arms are solved to reach them. The bend
     * axis is derived per frame from where the elbow's off-line offset should
     * point (in solveArm that offset lies along axis-cross-dir, so an axis of
     * dir-cross-offset puts the elbow exactly where asked): flaring OUT as the
     * elbows flex, easing toward out-and-forward at the top. What it must never
     * do is fold in-and-forward across the face, which is what a constant
     * flare axis did.
     */
    const outBlend = flex * flex * (3 - 2 * flex);
    for (const side of ["L", "R"]) {
      const mirror = side === "L" ? 1 : -1;
      const upperGroup = groups.get(`upperarm.${side}`);
      if (!upperGroup) continue;
      upperGroup.getWorldPosition(_shoulder);

      _out.lerpVectors(ELBOW_OUT_EARLY, ELBOW_OUT_TOP, outBlend);
      _out.x *= mirror;
      _dir.subVectors(state.hand[side], _shoulder).normalize();
      _axis.crossVectors(_dir, _out).normalize();

      solveArmTo({
        groups,
        side,
        target: state.hand[side],
        body,
        bendAxis: _axis,
        bendSign: 1,
      });

      /**
       * The hand holds the bar-frame orientation the wrist targets were derived
       * from. Orienting rather than aiming, for the reason the push-up gives —
       * a hand left to its free roll grips the bar edge-on.
       */
      const handGroup = groups.get(`hand.${side}`);
      const frame = body.arm.frame[side];
      if (handGroup && frame) {
        orientSegment(handGroup, frame.fingerDir, frame.palmNormal, FINGERS, PALM_N);
        handGroup.updateMatrixWorld(true);
      }
    }
  },
};

export { DURATION as PULLUP_DURATION };
