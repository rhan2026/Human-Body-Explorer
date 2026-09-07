/**
 * Shared solving for the lower body, and the sign conventions everything here
 * depends on.
 *
 * ---------------------------------------------------------------------------
 * THE CONVENTION. Read this before writing a pose.
 *
 * The model is authored standing, Y-up, facing +Z, arms down, palms forward.
 * `applyPose` reads [x, y, z] Euler degrees, XYZ order, per segment.
 *
 * Rx(t) maps  +Y -> +Z  and  +Z -> -Y.
 *
 * The consequence that catches people is that the SAME axis means opposite
 * things for a limb and for the spine, because a limb points down and the spine
 * points up:
 *
 *   thigh, upperarm  point -Y   ->  -X is FLEXION (forward), +X is extension
 *   shank            points -Y  ->  +X is knee FLEXION (heel toward the seat)
 *   foot             points +Z  ->  +X is PLANTARflexion, -X is dorsiflexion
 *   lumbar, thorax,
 *   neck, head       point +Y   ->  +X is FLEXION (forward), -X is extension
 *
 * Elbow and knee therefore take opposite signs, which is correct: they bend
 * opposite ways. `pushup.js` gives the feet [6, 0, 0] — plantarflexed onto the
 * toe pads — and the neck [-14, 0, 0] — extended, lifting the face to look
 * forward — and both agree with the table above. Those two are the regression
 * test for this comment.
 *
 * Rz(t) maps +X -> +Y, so for a limb pointing -Y a positive Z rotation swings it
 * toward +X, which is the model's LEFT. Abduction is therefore +Z on the left
 * and -Z on the right: mirrored. `pushup.js` has girdle.L -6 against girdle.R +6
 * for the same reason.
 *
 * X is NOT mirrored. Both thighs flex forward with a negative X, both feet
 * plantarflex with a positive X. `pushup.js` has thigh.L [2,0,-1] against
 * thigh.R [2,0,+1] — X identical, Z mirrored — and that is the pattern.
 *
 * This project has shipped a sign bug twice, both times by reasoning about it
 * instead of testing it (`adding-an-exercise.md` defect 2). Anything derived
 * here that is not one of the cases above should be checked against the rig with
 * `__rigDebug()`, not argued about.
 * ---------------------------------------------------------------------------
 */

import * as THREE from "three";

import { solveArm, aimSegment, orientSegment } from "../rig.js";

export const DEG = Math.PI / 180;

const _hip = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * The plane a knee bends in.
 *
 * The X component drives the knee forward — the leg's equivalent of the
 * push-up's "X sends the elbow toward the feet" — and is NOT mirrored, because
 * both knees travel the same way in world space. The Z component tracks the knee
 * out over the foot and IS mirrored. `bendSign` is -1 because a positive
 * rotation about +X would send a downward-pointing thigh backward.
 */
export function kneeAxis(side, flare = 0.16) {
  return new THREE.Vector3(1, 0, side === "L" ? -flare : flare).normalize();
}

/** The plane an elbow bends in, for movements that plant or fix the hand. */
export function elbowAxis(side, flare = 0.75) {
  return new THREE.Vector3(1, 0, side === "L" ? flare : -flare).normalize();
}

/**
 * Solves one leg so the ankle lands exactly on `target`.
 *
 * Two-link IK, the same solver the push-up uses for the arm. A planted foot is
 * the leg version of a planted hand, and the reason it has to be solved rather
 * than posed is the reason stated in `adding-an-exercise.md` defect 1:
 * hand-authored Euler angles do not converge, and the visible symptom here would
 * be a foot that slides or sinks a few centimetres every rep.
 */
export function solveLeg({ groups, side, target, body, flare = 0.16, bendAxis, bendSign = -1 }) {
  const thighGroup = groups.get(`thigh.${side}`);
  const shankGroup = groups.get(`shank.${side}`);
  if (!thighGroup || !shankGroup) return null;

  thighGroup.getWorldPosition(_hip);

  const solved = solveArm({
    shoulder: _hip,
    target,
    upperLen: body.leg.thigh,
    foreLen: body.leg.shank,
    // The bend plane is WORLD space, so it belongs to the body's orientation
    // rather than to the leg. It is a parameter and not a constant because a
    // supine bench press bends the same knee about a different world axis than a
    // standing lunge does, and silently reusing the standing one is exactly how
    // this project shipped a knee bending backwards twice before.
    bendAxis: bendAxis ?? kneeAxis(side, flare),
    bendSign,
  });

  aimSegment(thighGroup, body.leg.rest[side].thigh, solved.upperDir);
  thighGroup.updateMatrixWorld(true);
  aimSegment(shankGroup, body.leg.rest[side].shank, solved.foreDir);
  shankGroup.updateMatrixWorld(true);

  return solved;
}

/** The arm equivalent, for a hand fixed on a bar or the floor. */
export function solveArmTo({ groups, side, target, body, flare = 0.75, bendAxis, bendSign = 1 }) {
  const upperGroup = groups.get(`upperarm.${side}`);
  const foreGroup = groups.get(`ulna.${side}`);
  if (!upperGroup || !foreGroup) return null;

  upperGroup.getWorldPosition(_shoulder);

  const solved = solveArm({
    shoulder: _shoulder,
    target,
    upperLen: body.arm.upper,
    foreLen: body.arm.fore,
    bendAxis: bendAxis ?? elbowAxis(side, flare),
    bendSign,
  });

  aimSegment(upperGroup, body.arm.rest[side].upper, solved.upperDir);
  upperGroup.updateMatrixWorld(true);
  aimSegment(foreGroup, body.arm.rest[side].fore, solved.foreDir);
  foreGroup.updateMatrixWorld(true);

  return solved;
}

/**
 * Holds the sole flat, whatever the shank above it is doing.
 *
 * The foot inherits the whole leg's rotation, so a knee bent to 90 degrees tips
 * the sole 90 degrees with it unless the ankle takes it back. Orienting rather
 * than aiming, for the same reason the push-up orients the palm: a foot rolled
 * onto its edge is as wrong as a hand was, and aiming alone leaves that roll
 * free.
 *
 * `pitchDeg` is plantarflexion, positive toes-down — the rear foot of a lunge
 * rising onto its ball, or a stride at toe-off. `yawDeg` turns the foot about
 * vertical, positive toward the model's left.
 */
export function plantFoot({ groups, side, body, pitchDeg = 0, yawDeg = 0 }) {
  const footGroup = groups.get(`foot.${side}`);
  const frame = body.leg.foot[side];
  if (!footGroup || !frame) return;

  _fwd.copy(frame.forward);
  _up.set(0, 1, 0);

  if (yawDeg) {
    _q.setFromAxisAngle(_up, yawDeg * DEG);
    _fwd.applyQuaternion(_q);
  }
  if (pitchDeg) {
    // Positive about world +X takes a forward-pointing segment down: toes down,
    // which is plantarflexion. Both feet, same sign — X is not mirrored.
    _q.setFromAxisAngle(X_AXIS, pitchDeg * DEG);
    _fwd.applyQuaternion(_q);
    _up.applyQuaternion(_q);
  }

  orientSegment(footGroup, frame.forward, frame.up, _fwd, _up);
  footGroup.updateMatrixWorld(true);
}

/**
 * Where the ankle has to be for the ball of the foot to stay on a fixed point
 * while the heel lifts.
 *
 * A lunge's rear foot pivots on its ball and a stride pushes off the same way.
 * Solving the leg to a fixed *ankle* cannot express that — the ankle rises as
 * the heel does — so the fixed thing is the ball, and the ankle target is
 * derived from it by swinging the measured ankle-to-ball offset through the
 * plantarflexion angle.
 */
const _offset = new THREE.Vector3();
export function ankleOverBall({ body, side, ball, pitchDeg }) {
  const frame = body.leg.foot[side];
  // Ankle relative to the ball, in the rest pose.
  _offset.subVectors(frame.ankle, frame.toe);
  if (pitchDeg) {
    _q.setFromAxisAngle(X_AXIS, pitchDeg * DEG);
    _offset.applyQuaternion(_q);
  }
  return new THREE.Vector3().copy(ball).add(_offset);
}

/**
 * A swing foot's path through the air, shared by the stride and the lunge step.
 *
 * `u` runs 0 to 1 from leaving the ground to landing. The lift is a sine arch so
 * it starts and ends flat on the ground with no vertical velocity — a parabola
 * lands with the foot still moving downward, which reads as a stamp. The fore-aft
 * travel is smoothstepped for the same reason at both ends.
 */
export function swingFoot({ from, to, lift, u, out = new THREE.Vector3() }) {
  const s = u * u * (3 - 2 * u);
  out.lerpVectors(from, to, s);
  out.y += lift * Math.sin(Math.PI * u);
  return out;
}
