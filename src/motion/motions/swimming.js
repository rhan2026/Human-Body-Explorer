/**
 * Freestyle — front crawl.
 *
 * The only movement in the set with no ground contact, which changes what has to
 * be solved: nothing is planted, so nothing is bisected. The body floats at a
 * fixed height and everything is posed or aimed.
 *
 * The arm is the reason this file exists. A stroke is a full 360 degrees of
 * circumduction at the shoulder, and there is no way to keyframe that in Euler
 * angles without it either taking the short way round or gimballing somewhere in
 * the middle. So the arm is not keyframed: the upper arm is ORIENTED along a
 * direction traced round a tilted circle — long axis on the circle, twist
 * following the circle's tangent — swept at a non-uniform rate, slow through
 * the pull, quick through the recovery, with the elbow flexed on its own
 * schedule over the top. A circle has no seam, which is the property that
 * matters for something that loops.
 *
 * Body roll is coupled to the stroke rather than authored separately. A swimmer
 * rolls toward the arm that is pulling; getting that backwards is the single
 * most obvious error available here, so it is derived from the same phase
 * variable as the arms rather than given its own number.
 */

import * as THREE from "three";

import { applyPose, placeRoot, aimSegment, orientSegment } from "../../rig.js";
import { smooth, swing, cycle, wrap } from "../ease.js";
import { DEG } from "../kinematics.js";
import { guardPose } from "../definition.js";

/** One full stroke cycle: both arms. A moderate distance pace. */
const DURATION = 2.6;

/** Height the body floats at, roughly at the surface. */
const FLOAT_Y = 0.86;

/** Peak body roll, each way. */
const ROLL = 34;

/** Kicks per full arm cycle — six-beat, the standard distance rhythm. */
const KICK_BEATS = 6;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const _q = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _upperDir = new THREE.Vector3();
const _foreDir = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bendS = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _fingers = new THREE.Vector3();
// Scratch for the wrist-velocity estimate, separate from the pose vectors so
// sampling P(u ± h) cannot clobber the directions the pose was built from.
const _vUpper = new THREE.Vector3();
const _vFore = new THREE.Vector3();
const _vTan = new THREE.Vector3();
const _vAxis = new THREE.Vector3();
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _relax = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _fallback = new THREE.Vector3();

/**
 * How far round the stroke circle the arm is, given its cycle position.
 *
 * The pull is the slow part and the recovery the fast part — under water the arm
 * is moving the swimmer, over water it is only repositioning — so the angle does
 * not advance uniformly. `PULL_SHARE` of the time covers `PULL_ARC` of the
 * circle. Both halves are smoothstepped into each other so the rate has no step
 * at the handover, which is what a seam would look like.
 */
const PULL_SHARE = 0.62;
const PULL_ARC = 0.58;

function strokeAngle(u) {
  const p = wrap(u, 1);
  if (p < PULL_SHARE) {
    return smooth(p / PULL_SHARE) * PULL_ARC * Math.PI * 2;
  }
  const q = (p - PULL_SHARE) / (1 - PULL_SHARE);
  return (PULL_ARC + smooth(q) * (1 - PULL_ARC)) * Math.PI * 2;
}

/**
 * Elbow flexion through the stroke, 0 straight to 1 fully bent.
 *
 * Straight at entry, folding into the high-elbow catch, extending through the
 * push to leave the water almost straight at the hip, then folding again for the
 * recovery. Two humps per cycle, which is why it is written as an explicit
 * function of the phase rather than as a track.
 */
function elbowFlex(u) {
  const p = wrap(u, 1);
  if (p < 0.12) return 0.06 + 0.34 * smooth(p / 0.12); // entry to catch
  if (p < 0.36) return 0.40 + 0.35 * smooth((p - 0.12) / 0.24); // high-elbow catch
  if (p < PULL_SHARE) return 0.75 - 0.68 * smooth((p - 0.36) / (PULL_SHARE - 0.36)); // push to exit
  if (p < 0.82) return 0.07 + 0.62 * smooth((p - PULL_SHARE) / (0.82 - PULL_SHARE)); // recovery fold
  return 0.69 - 0.63 * smooth((p - 0.82) / 0.18); // reaching to entry
}

/**
 * The elbow's bend-plane secondary is blended round the cycle rather than
 * fixed. Under water the forearm folds INBOARD, toward the body's midline —
 * that keeps the forearm square to the direction the hand travels, which is
 * what makes it a paddle and what lets the palm face its own velocity. Over
 * water it folds along the circle's TANGENT, so the recovering forearm trails
 * its own travel and the hand dangles forward instead of sweeping over the
 * spine. The handovers are placed where the elbow is closest to straight
 * (the push into the exit, and the reach into entry), because swinging the
 * bend plane barely moves the hand when there is almost no bend to swing;
 * the fall completes exactly at u = 1 so the loop has no seam.
 */
const PLANE_RISE = 0.50; // inboard -> tangent over u = 0.50..0.74
const PLANE_FALL = 0.80; // tangent -> inboard over u = 0.80..1.00

/** Half-width of the central difference behind the wrist-velocity estimate. */
const VEL_H = 0.02;

/**
 * The arm's directions in the UNROLLED body frame — prone, before body roll —
 * as a pure function of cycle position. One function serves both the posing
 * path and the hand's velocity estimate, so the two cannot drift apart.
 *
 * Body-local frame here is the WORLD frame after the prone rotation: the body
 * runs along Z with the head at +Z, its back faces +Y and its front faces -Y.
 * "Forward" is +Z, "down through the water" is -Y.
 *
 * `outUpper` is the upper arm on the stroke circle; theta = 0 is the arm
 * extended forward at entry, sweeping down and back under the body through the
 * pull, then up and over through the recovery. `outTangent` is d/dtheta of the
 * circle direction — the direction the shoulder is carrying the hand. The
 * lateral x term of the circle is constant, so the tangent has none; it stays
 * near-orthogonal to the upper arm the whole way round, which is why the frame
 * they span has no antipode to snap across. `outAxis` is the elbow's bend
 * axis, `outFore` the forearm after the fold.
 *
 * THE FOLD SIGN. Rotating `upper` about `upper x s` by a POSITIVE angle takes
 * it toward `s`, because (u x s) x u = s for orthogonal unit vectors. During
 * the pull s is the inboard lateral, so a positive bend folds the forearm
 * under the chest with its direction on the world -Z (FEET) side — the
 * high-elbow paddle. At mid-pull (u ~ 0.31) that puts the forearm at roughly
 * (inboard 0.40, down -0.90, feet -0.15): under the body, pointing at the
 * water floor and the feet, never the head. A negative angle would sweep it
 * outboard and toward the head, which is the class of sign error the
 * convention table in kinematics.js exists to prevent.
 */
function armDirs(u, side, outUpper, outFore, outTangent, outAxis) {
  const p = wrap(u, 1);
  const theta = strokeAngle(p);
  const lateral = side === "L" ? 1 : -1;

  outUpper.set(
    lateral * 0.34,
    -Math.sin(theta) * 0.94,
    Math.cos(theta),
  ).normalize();
  // d/dtheta of (0, -0.94 sin, cos): rotates smoothly with theta, no seam.
  outTangent.set(0, -Math.cos(theta) * 0.94, -Math.sin(theta)).normalize();

  const g =
    smooth((p - PLANE_RISE) / 0.24) * (1 - smooth((p - PLANE_FALL) / 0.20));
  // Inboard is -lateral: the left arm hangs at +X, so its midline is -X, and
  // mirrored for the right. The two secondaries are orthogonal (the tangent
  // has no x), so the blend never passes near zero, and neither is ever within
  // ~60 degrees of the upper arm, so the cross below never collapses.
  _bendS.set(-lateral * (1 - g), outTangent.y * g, outTangent.z * g);
  outAxis.crossVectors(outUpper, _bendS).normalize();

  const bend = elbowFlex(p) * 105 * DEG;
  outFore.copy(outUpper).applyAxisAngle(outAxis, bend).normalize();
}

/**
 * Where the wrist sits relative to the shoulder in the unrolled body frame:
 * P(u) = upper·upperDir + fore·foreDir. The hand's direction of travel is the
 * central difference of this, which is what makes the palm's target a pure
 * function of u rather than of the previous frame.
 */
function wristPoint(u, side, body, out) {
  armDirs(u, side, _vUpper, _vFore, _vTan, _vAxis);
  return out
    .copy(_vUpper)
    .multiplyScalar(body.arm.upper)
    .addScaledVector(_vFore, body.arm.fore);
}

export const swimming = {
  id: "swimming_freestyle",
  label: "Freestyle swimming",
  duration: DURATION,
  loop: true,
  roles: "swimming_freestyle",
  camera: "swim_three_quarter",
  // The standard grid floor, not the translucent water plane: the user reads
  // the six movements as one exhibit, and five stages of grid plus one grey
  // sheet made the swimmer the odd one out.
  props: ["floor"],
  note: "The arm sweeps a tilted circle rather than a keyframed path, so the stroke has no seam; body roll is derived from the same phase.",

  /* ONE POINTER, TWO ARMS, AND THE TABLE USED TO TRY TO NARRATE BOTH.
     `phaseAt` walks this in ARRAY order and breaks at the first entry past the
     clock, so an entry followed by an earlier one is never the answer. This had
     `recovery` at `DURATION * PULL_SHARE` — 1.612 s, where the right arm's hand
     leaves the water — immediately followed by the left arm's entry at 0.5 of
     the cycle, 1.300. Both numbers are right about the swimmer and the two arms
     genuinely overlap; the chip is one string. So "Exit · recovery" was declared
     and returned for no instant of the rep at all, which
     `phaseTables.test.js` now refuses. Found by measuring phase spans and
     getting **-0.31 s**.
     THE TABLE NARRATES WHICHEVER ARM IS PULLING, which is also what `effortAt`
     below is about, and the left half is now the right half offset by exactly
     half a cycle. That gains the left arm a `catch` it never had and moves its
     pull from `0.5 + PULL_SHARE * 0.5` (0.81) to 0.86 — the mirror of the right
     arm's 0.36, which is where a pull actually starts. Recovery is the phase a
     single pointer cannot place, because it is always the OTHER arm's, and it
     is gone rather than put somewhere it would be false. */
  phases: [
    { at: 0.0, name: "entry", label: "Right entry · extension" },
    { at: DURATION * 0.14, name: "catch", label: "Catch · high elbow" },
    { at: DURATION * 0.36, name: "pull", label: "Pull · propulsive" },
    { at: DURATION * 0.5, name: "entry", label: "Left entry · extension" },
    { at: DURATION * 0.64, name: "catch", label: "Catch · high elbow" },
    { at: DURATION * 0.86, name: "pull", label: "Left pull · propulsive" },
  ],

  /** Propulsion comes from the pulling arm; two peaks per cycle, one per arm. */
  effortAt(t) {
    const p = wrap(t, DURATION) / DURATION;
    const pull = (u) => {
      const q = wrap(u, 1);
      if (q > PULL_SHARE) return 0;
      // Strongest mid-pull, under the shoulder.
      return Math.sin((q / PULL_SHARE) * Math.PI);
    };
    return 0.28 + 0.66 * Math.max(pull(p), pull(p + 0.5));
  },

  /**
   * Per arm. Freestyle is an alternating stroke and the collapse above drew it
   * as a symmetrical one — both lats bright together, which is not a thing a
   * swimmer's body ever does. `p` is the RIGHT arm, per this file's phase table
   * ("Right entry · extension" at 0.0, "Left entry" at half a cycle).
   */
  effortSideAt(t) {
    const p = wrap(t, DURATION) / DURATION;
    const pull = (u) => {
      const q = wrap(u, 1);
      if (q > PULL_SHARE) return 0;
      return Math.sin((q / PULL_SHARE) * Math.PI);
    };
    return { R: 0.28 + 0.66 * pull(p), L: 0.28 + 0.66 * pull(p + 0.5) };
  },

  setup({ rig, body }) {
    const j = rig.joints;
    return {
      body,
      // Prone, head toward +Z: the same orientation the push-up uses, so the
      // body reads the same way round in both.
      prone: new THREE.Quaternion().setFromAxisAngle(X_AXIS, Math.PI / 2),
      position: new THREE.Vector3(0, FLOAT_Y, 0),
      shoulderHalf: (j["shoulder.L"][0] - j["shoulder.R"][0]) / 2,
      quaternion: new THREE.Quaternion(),
    };
  },

  frame(t, { rig, root, groups }, state) {
    const body = state.body;
    const p = wrap(t, DURATION) / DURATION;

    // Right arm leads; the left is half a cycle behind.
    const phase = { R: p, L: wrap(p + 0.5, 1) };

    /**
     * Body roll, coupled to the stroke.
     *
     * A swimmer rolls TOWARD the arm that is pulling, which lengthens that side
     * and lets the shoulder clear the water on the other. The right arm pulls
     * over the first PULL_SHARE of the cycle, so the roll is to the right then.
     * Deriving it from the same phase variable is what stops it drifting out of
     * step with the arms — a roll authored on its own number is one edit away
     * from being backwards.
     */
    const rollDeg = -ROLL * Math.sin(p * Math.PI * 2);

    /**
     * Kick. Six beats to the cycle, each leg opposite the other, driven from the
     * hip with the knee whipping a beat behind it — a freestyle kick is a whip,
     * not a bicycle.
     */
    const kick = (side) => {
      const beat = p * KICK_BEATS + (side === "L" ? 0.5 : 0);
      return {
        hip: swing(beat) * 13,
        knee: Math.max(0, swing(beat - 0.16)) * 34,
      };
    };
    const kickL = kick("L");
    const kickR = kick("R");

    // Breathing: the head turns to the right once per cycle, timed with that
    // side's recovery so the mouth clears the water where the trough is.
    const breath = Math.max(0, Math.sin((p - 0.62) * Math.PI * 2)) ** 2;

    applyPose(
      groups,
      guardPose({
        /**
         * The trunk holds a long line — a swimmer who bends at the hips drops
         * their legs and stops. What it does have is a small lateral wave, the
         * body snaking a few degrees out of phase down its length, which is what
         * a good stroke actually looks like from above.
         */
        pelvis: [0, swing(p) * 4.5, 0],
        lumbar: [-1.5, swing(p - 0.06) * 3.5, 0],
        thorax: [-2.5, swing(p - 0.12) * 3.0, 0],
        // Head neutral and face down, rotating to breathe. Positive Y turns the
        // face toward the model's left, so breathing to the right is negative.
        neck: [-6 - 4 * breath, -52 * breath, 0],
        head: [-3, -14 * breath, 0],

        // Legs stay long. Hip drives the kick, knee follows it. Thigh points
        // down, so negative X is flexion; the kick swings either side of neutral.
        "thigh.L": [kickL.hip, 0, -2],
        "thigh.R": [kickR.hip, 0, 2],
        // Positive X is knee flexion.
        "shank.L": [kickL.knee, 0, 0],
        "shank.R": [kickR.knee, 0, 0],
        // Ankles plantarflexed and loose, which is what a swimmer's feet do.
        "foot.L": [26 + 8 * swing(p * KICK_BEATS), 0, 0],
        "foot.R": [26 + 8 * swing(p * KICK_BEATS + 0.5), 0, 0],

        // Scapulae. The recovering side reaches and its shoulder girdle rolls up
        // with the body; the pulling side is depressed and drawn back.
        "girdle.L": [-6 + 10 * Math.cos(phase.L * Math.PI * 2), 0, -6],
        "girdle.R": [-6 + 10 * Math.cos(phase.R * Math.PI * 2), 0, 6],

        // The paddle stays open — only a whisper of curl, so the hand pushes
        // water without reading as a plank.
        "fingers.L": [8, 0, 0],
        "fingers.R": [8, 0, 0],
        "fingersMid.L": [10, 0, 0],
        "fingersMid.R": [10, 0, 0],
        "fingersTip.L": [4, 0, 0],
        "fingersTip.R": [4, 0, 0],
        "thumb.L": [8, 0, 0],
        "thumb.R": [8, 0, 0],
      }),
      rig,
    );

    // Prone, then rolled about the body's long axis. The long axis after the
    // prone rotation is world Z, so the roll is applied about Z in world space
    // and composed on the outside.
    _roll.setFromAxisAngle(Z_AXIS, rollDeg * DEG);
    state.quaternion.copy(_roll).multiply(state.prone);
    placeRoot(root, { quaternion: state.quaternion, position: state.position });

    /**
     * The arms. Each upper arm is aimed along a direction swept round a circle
     * whose plane is roughly sagittal, tilted outboard so the hand tracks just
     * outside the shoulder line rather than through the body's centre.
     */
    for (const side of ["L", "R"]) {
      const u = phase[side];
      const lateral = side === "L" ? 1 : -1;

      armDirs(u, side, _upperDir, _foreDir, _tangent, _elbow);
      // Carry the body roll, so the arms stay attached to the shoulders rather
      // than swimming in a frame of their own. All four directions ride it,
      // which is what keeps them one frame instead of four opinions.
      _upperDir.applyQuaternion(_roll);
      _foreDir.applyQuaternion(_roll);
      _tangent.applyQuaternion(_roll);
      _elbow.applyQuaternion(_roll);

      const upperGroup = groups.get(`upperarm.${side}`);
      const foreGroup = groups.get(`ulna.${side}`);
      if (!upperGroup || !foreGroup) continue;

      /**
       * Orient, not aim. Aiming leaves the humeral twist to setFromUnitVectors'
       * shortest arc, which re-seats the whole frame near entry and exit — the
       * shoulder snap this replaces. The rest secondary is +Z: at rest every
       * group is identity, so rest space IS world space, and the rest pose
       * faces world front. The target secondary is the circle's tangent, which
       * rotates smoothly with theta and is never parallel to the upper arm, so
       * the twist follows the stroke continuously the whole way round.
       */
      orientSegment(upperGroup, body.arm.rest[side].upper, Z_AXIS, _upperDir, _tangent);
      upperGroup.updateMatrixWorld(true);

      // The forearm was already folded about the bend axis in armDirs; only
      // its long axis needs placing here.
      aimSegment(foreGroup, body.arm.rest[side].fore, _foreDir);
      foreGroup.updateMatrixWorld(true);

      /**
       * The hand. Through the pull the palm faces the way the wrist is
       * travelling — pushing water straight back along its own path is the
       * whole job — and everywhere else it relaxes square to the elbow's bend
       * plane, the frame the arm itself supplies. That relaxed direction is
       * exactly world-down at entry (palm toward the water) and rides the arm
       * continuously through the recovery, where a fixed world target would
       * have to snap once the fingers sweep past vertical. Orienting rather
       * than aiming, for the reason the push-up gives.
       */
      const handGroup = groups.get(`hand.${side}`);
      const frame = body.arm.frame[side];
      if (handGroup && frame) {
        _fingers.copy(_foreDir);

        // Direction of travel, from the same armDirs the pose used.
        wristPoint(u + VEL_H, side, body, _pA);
        wristPoint(u - VEL_H, side, body, _pB);
        _vel.subVectors(_pA, _pB).normalize().applyQuaternion(_roll);

        // Propulsive weight: zero outside the pull, ramping in over the catch
        // and out into the exit. Every term is smooth, so no switch anywhere.
        const w = smooth((u - 0.06) / 0.10) * (1 - smooth((u - 0.52) / 0.10));

        // The bend axis is a rotation axis, so it anti-mirrors between sides;
        // the palm normal is a true direction and must mirror. `lateral`
        // restores that: both entry palms face the water, not one the sky.
        _relax.copy(_elbow).multiplyScalar(lateral);
        _palm.copy(_relax).multiplyScalar(1 - w).addScaledVector(_vel, w).normalize();

        // Orthogonalise against the fingers continuously. The k-blend toward
        // the in-plane fallback is ALWAYS applied — k is ~0 whenever the raw
        // normal is clear of the finger axis, which is the entire normal case,
        // and there is no threshold swap anywhere for it to snap across.
        const along = _palm.dot(_fingers);
        _perp.copy(_palm).addScaledVector(_fingers, -along);
        _fallback.crossVectors(_relax, _fingers).normalize();
        const k = smooth((Math.abs(along) - 0.85) / 0.13);
        _palm.copy(_perp).multiplyScalar(1 - k).addScaledVector(_fallback, k).normalize();

        orientSegment(handGroup, frame.fingerDir, frame.palmNormal, _fingers, _palm);
        handGroup.updateMatrixWorld(true);
      }
    }
  },
};

export { DURATION as SWIM_DURATION };
