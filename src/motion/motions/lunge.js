/**
 * Forward lunge — step out, descend, drive up, step back.
 *
 * Both feet are targets in world space and both legs are solved to them, so
 * nothing slides: while a foot is planted its target simply does not change, and
 * that is a stronger guarantee than any amount of care with joint angles. The
 * rear foot is the interesting one. Its heel lifts, so the fixed point is the
 * BALL of the foot rather than the ankle, and the ankle target is derived by
 * swinging the measured ankle-to-ball offset through the plantarflexion angle.
 * Solving to a fixed ankle instead is what would drag the toe through the floor.
 *
 * The descent itself is driven by the hip centre, not by knee angles: the pose
 * says where the hips are and the legs are solved to reach the floor from there.
 * That is what keeps the two knee angles consistent with each other and with the
 * stance length, which hand-authored angles do not.
 *
 * 6 s round trip, which is slow for a lunge and deliberately so — it is a
 * demonstration, and the rear knee's travel is the part worth being able to see.
 */

import * as THREE from "three";

import { applyPose, placeRoot, anchorRoot, orientSegment } from "../../rig.js";
import { sampleTrack, smooth, cycle } from "../ease.js";
import { solveLeg, plantFoot, ankleOverBall, swingFoot, kneeAxis } from "../kinematics.js";
import { guardPose } from "../definition.js";

const DURATION = 6.0;

/* Scratch for the per-frame fist orientation (see the block in frame()). */
const _elbowW = new THREE.Vector3();
const _wristW = new THREE.Vector3();
const _fingersW = new THREE.Vector3();
const _palmW = new THREE.Vector3();

/** How far the front foot steps out. About 0.75x leg length is a normal lunge. */
const STEP = 0.62;

/**
 * How far the rear ball reaches back during the step-out. A lunge steps BOTH
 * directions apart: the front foot lands STEP ahead while the rear foot slides
 * onto its ball this far behind its rest spot, which is what stretches the
 * rear leg into the long hip-to-ankle line the movement reads by.
 */
const REAR_REACH = 0.14;

/** How far the hips drop at the bottom. */
const DROP = 0.27;

/** Rear heel lift at the bottom, as plantarflexion. */
const REAR_PLANTARFLEX = 42;

/**
 * The step: 0 while standing, 1 once the front foot is planted out.
 * The descent: 0 standing tall in the split stance, 1 at the bottom.
 */
const STEP_TRACK = [
  { t: 0.0, v: 0.0 },
  { t: 0.5, v: 0.0, ease: "smooth" }, // stand
  { t: 1.3, v: 1.0, ease: "smooth" }, // step out and plant
  { t: 4.6, v: 1.0, ease: "smooth" }, // stays planted through the rep
  { t: 5.5, v: 0.0, ease: "smooth" }, // push back to standing
  { t: 6.0, v: 0.0, ease: "smooth" },
];

const DESCENT_TRACK = [
  { t: 0.0, v: 0.0 },
  { t: 1.3, v: 0.0, ease: "smooth" }, // nothing until the foot is down
  { t: 2.9, v: 1.0, ease: "smooth" }, // controlled descent
  { t: 3.4, v: 1.0, ease: "smooth" }, // bottom
  { t: 4.6, v: 0.0, ease: "press" }, // drive up
  { t: 6.0, v: 0.0, ease: "smooth" },
];

const _hipTarget = new THREE.Vector3();
const _frontAnkle = new THREE.Vector3();
const _rearAnkle = new THREE.Vector3();
const _swing = new THREE.Vector3();

/** Left leg leads. Front and rear are fixed for the whole cycle. */
const FRONT = "L";
const REAR = "R";

export const lunge = {
  id: "lunge",
  label: "Lunge",
  duration: DURATION,
  loop: true,
  roles: "lunge",
  camera: "stance_three_quarter",
  props: ["floor"],
  note: "Hip height drives the descent and both legs are solved to fixed floor contacts, so neither foot slides.",

  phases: [
    { at: 0.0, name: "stand", label: "Standing" },
    { at: 0.5, name: "step", label: "Step out" },
    { at: 1.3, name: "eccentric", label: "Descending · eccentric" },
    { at: 2.9, name: "bottom", label: "Bottom" },
    { at: 3.4, name: "concentric", label: "Driving up · concentric" },
    { at: 4.6, name: "recover", label: "Step back" },
  ],

  effortAt(t) {
    const d = sampleTrack(DESCENT_TRACK, t, DURATION);
    const p = t % DURATION;
    const driving = p >= 3.4 && p < 4.6;
    // Deepest is hardest, and the drive out of it more so than the descent into it.
    return 0.12 + d * (driving ? 0.88 : 0.6);
  },

  setup({ rig, body, markers }) {
    const j = rig.joints;
    const standY = markers.standHipY;

    /**
     * Foot placements, measured off the rest stance rather than invented: the
     * feet start where the model already has them, the front one steps to STEP
     * ahead of that, and the rear one stays.
     */
    const frontHome = new THREE.Vector3(
      j[`ankle.${FRONT}`][0],
      body.leg.foot[FRONT].ankleHeight,
      j[`ankle.${FRONT}`][2],
    );
    const rearHome = new THREE.Vector3(
      j[`ankle.${REAR}`][0],
      body.leg.foot[REAR].ankleHeight,
      j[`ankle.${REAR}`][2],
    );

    return {
      body,
      standY,
      // Held a few per cent short of the true leg length so a solved leg never
      // sits on the IK reach clamp, where it locks straight and stops responding.
      legReach: (body.leg.thigh + body.leg.shank) * 0.965,
      frontHome,
      rearHome,
      // Where the front foot lands. Stance widens a little as well as lengthens,
      // because a lunge tracked down a single line is unstable and nobody does it.
      frontOut: new THREE.Vector3(frontHome.x + 0.04, frontHome.y, frontHome.z + STEP),
      // The ball of the rear foot: the point it pivots on once the heel lifts.
      // Its z is rewritten every frame from rearBallHomeZ and the step.
      rearBall: new THREE.Vector3(
        j[`toes.${REAR}`][0],
        body.leg.foot[REAR].ankleHeight * 0.18,
        j[`toes.${REAR}`][2],
      ),
      rearBallHomeZ: j[`toes.${REAR}`][2],
      hipTarget: new THREE.Vector3(),
    };
  },

  frame(t, { rig, root, groups, markers }, state) {
    const body = state.body;
    const step = sampleTrack(STEP_TRACK, t, DURATION);
    const descent = sampleTrack(DESCENT_TRACK, t, DURATION);
    const breathe = cycle((t / DURATION) * 3);

    // The rear heel's lift, needed up here because the rear TOES extend with
    // it in the pose map: the ball stays planted and the toes stay flat while
    // the heel rises, now that the toe hinge is live.
    const rearPitch = REAR_PLANTARFLEX * descent * step;

    /**
     * Torso. Near vertical with a small forward inclination that grows as the
     * hips drop — the shin angle changes, the torso follows it to keep the centre
     * of mass over the base. Spine points up, so positive X is flexion forward.
     */
    applyPose(
      groups,
      guardPose({
        // Pelvis drops level and rotates a few degrees toward the rear leg, which
        // is what the hip flexor on that side actually does at depth.
        pelvis: [2 + 3 * descent, -4 * descent, 1.5 * descent],
        lumbar: [3 + 4 * descent, 1.5 * descent, 0],
        thorax: [2 + 3 * descent, 2 * descent, 0],
        // Head stays level and looking ahead: the neck takes back what the trunk
        // added, so the gaze does not travel down with the body.
        neck: [-4 - 6 * descent, 0, 0],
        head: [-1 - 2 * descent, 0, 0],

        // Arms hang, counterbalancing slightly forward as the body descends.
        "girdle.L": [0, 0, -2],
        "girdle.R": [0, 0, 2],
        "upperarm.L": [-6 - 16 * descent, 0, 4 + 2 * step],
        "upperarm.R": [-6 - 16 * descent, 0, -4 - 2 * step],
        "ulna.L": [-14 - 20 * descent, 0, 0],
        "ulna.R": [-14 - 20 * descent, 0, 0],
        // Palms face the body — a hanging arm's neutral grip, not the mannequin
        // palms-forward of the rest pose. Pronation is SPLIT between the radius and
        // the wrist on purpose: the radius is one segment for the whole forearm,
        // so twist it carries rotates every radius-chained muscle as a block —
        // at 72 degrees that swept the flesh out over the ulna. The wrist's share
        // blends across the skinning band instead. The full fix is distributed
        // twist along the forearm, which is a mesh-set feature, not a pose.
        "radius.L": [0, -28, 0],
        "radius.R": [0, 28, 0],
        "hand.L": [-4, -30, 2],
        "hand.R": [-4, 30, -2],
        // A hanging hand is never flat: a relaxed curl, deepening a touch as
        // the body descends.
        "fingers.L": [18 + 6 * descent, 0, 0],
        "fingers.R": [18 + 6 * descent, 0, 0],
        "fingersMid.L": [24 + 6 * descent, 0, 0],
        "fingersMid.R": [24 + 6 * descent, 0, 0],
        "fingersTip.L": [10, 0, 0],
        "fingersTip.R": [10, 0, 0],
        "thumb.L": [20, 0, 0],
        "thumb.R": [20, 0, 0],
        // Positive lifts the toes (sign-tested); the rear foot pivots on its
        // ball, so its toes extend by most of the heel angle and keep their
        // pads on the floor.
        [`toes.${REAR}`]: [rearPitch * 0.9, 0, 0],
      }),
      rig,
    );

    /**
     * Where the hips are. The pelvis group's pivot is the world origin — down at
     * the feet — so a pelvis rotation would swing the whole body about a point on
     * the floor. Anchoring the measured hip-centre marker cancels that and is
     * also how the body lowers: the pose folds the joints, this says where the
     * hips end up.
     */
    placeRoot(root, { position: new THREE.Vector3(0, 0, 0) });

    /**
     * Both foot targets are worked out FIRST, because the hip height depends on
     * where the feet actually are this frame.
     *
     * Deriving the ceiling from the fully-stepped-out stance while the feet were
     * still together is what left the body crouched at 0.56 m for the standing
     * phase — it was making room for a split it had not taken yet.
     */
    const planted = step > 0.999;
    if (planted) {
      _frontAnkle.copy(state.frontOut);
    } else {
      swingFoot({
        from: state.frontHome,
        to: state.frontOut,
        lift: 0.11,
        u: step,
        out: _frontAnkle,
      });
    }

    /**
     * The rear ball's fixed point, this frame. Its z rides `step`, NOT
     * `descent`: the ball slides back only while the foot is unweighted and
     * stepping — the mirror image of the front foot swinging forward — and
     * STEP_TRACK saturates at 1 from the plant (t=1.3) straight through to
     * t=4.6, which brackets everything DESCENT_TRACK does (it is zero outside
     * 1.3–4.6). So whenever the foot bears weight the ball is welded to one
     * world position, keeping the file's no-sliding invariant; while the front
     * foot returns, `step` falls and the ball slides home the way it came.
     */
    state.rearBall.z = state.rearBallHomeZ - REAR_REACH * step;

    if (step > 0.001) {
      _rearAnkle.copy(
        ankleOverBall({ body, side: REAR, ball: state.rearBall, pitchDeg: rearPitch }),
      );
    } else {
      _rearAnkle.copy(state.rearHome);
    }

    // The hips slide forward with the step, a little under halfway, which is the
    // weight transfer onto the front leg.
    const hipZ = state.rearHome.z + (state.frontOut.z - state.rearHome.z) * 0.45 * step;

    /**
     * How tall the hips can stand, given how far apart the feet are right now.
     *
     * A split stance is a triangle: once the feet are 0.62 m apart, a 0.82 m leg
     * cannot reach the floor from full standing height, and asking it to hands
     * the IK a target outside its reach. The clamp then does the only thing it
     * can — straightens the leg and leaves the foot short — and the front foot
     * hovered four centimetres off the floor for the whole descent.
     *
     * So the ceiling is derived: for each foot, the highest the hip can be and
     * still reach it, with a few per cent held back so the leg never solves dead
     * straight. The commanded drop comes off that. A foot still in the air does
     * not constrain anything, so only planted feet count.
     */
    const reachCeiling = (target) => {
      const dz = target.z - hipZ;
      const dx = target.x;
      const flat = dz * dz + dx * dx;
      return target.y + Math.sqrt(Math.max(0, state.legReach ** 2 - flat));
    };
    const topY = Math.min(
      state.standY,
      planted ? reachCeiling(_frontAnkle) : Infinity,
      reachCeiling(_rearAnkle),
    );

    _hipTarget.set(0, topY - DROP * descent, hipZ);
    anchorRoot(root, markers.hip, _hipTarget);

    solveLeg({
      groups,
      side: FRONT,
      target: _frontAnkle,
      body,
      bendAxis: kneeAxis(FRONT, 0.2),
    });
    // In the air the toe points down; planted, the sole is flat on the floor.
    plantFoot({
      groups,
      side: FRONT,
      body,
      pitchDeg: planted ? 0 : 16 * (1 - smooth(step)),
      yawDeg: 4,
    });

    // The rear leg. The ball stays welded to one spot on the floor and the heel
    // lifts, so its ankle target was derived from the ball above rather than
    // fixed — solving to a fixed ankle would drag the toe through the floor.
    solveLeg({
      groups,
      side: REAR,
      target: _rearAnkle,
      body,
      bendAxis: kneeAxis(REAR, 0.12),
    });
    plantFoot({ groups, side: REAR, body, pitchDeg: rearPitch, yawDeg: -3 });
  
    /**
     * Fists vertical, palms facing each other (owner, 2026-08-31). The pose
     * table's split pronation left the palms ~30 degrees rotated up
     * (measured palm normals: X share 0.78-0.82 on the lunge, down to 0.62
     * through the running swing), because a fixed Euler cannot hold a palm
     * inward under a swinging forearm. The hand is oriented per frame
     * instead, the bench press's mechanism: palm normal pinned across the
     * body, fingers along the forearm's own direction projected sagittal,
     * so the wrist carries only the tilt it already had.
     */
    for (const side of ["L", "R"]) {
      const handGroup = groups.get(`hand.${side}`);
      const foreGroup = groups.get(`ulna.${side}`);
      const restFrame = state.body.arm.frame[side];
      if (!handGroup || !foreGroup || !restFrame) continue;
      foreGroup.getWorldPosition(_elbowW);
      handGroup.getWorldPosition(_wristW);
      _fingersW.subVectors(_wristW, _elbowW);
      _fingersW.x = 0;
      if (_fingersW.lengthSq() < 1e-6) continue;
      _fingersW.normalize();
      _palmW.set(side === "L" ? -1 : 1, 0, 0);
      orientSegment(handGroup, restFrame.fingerDir, restFrame.palmNormal, _fingersW, _palmW);
      handGroup.updateMatrixWorld(true);
    }
  },
};

export { DURATION as LUNGE_DURATION };
