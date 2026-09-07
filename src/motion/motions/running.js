/**
 * Running, as a treadmill.
 *
 * The body stays over the origin and the ground scrolls underneath. That is not
 * a shortcut — it is what makes the feet honest. A body running in place with
 * the floor still has its stance foot sliding backward under it every step,
 * which is on the list of things that must not happen; scrolling the ground at
 * exactly the speed the stance foot travels means the foot is stationary
 * relative to the floor it is standing on, which is what a real footfall is.
 *
 * The numbers are an easy jog rather than a sprint, chosen so the stance foot's
 * excursion stays inside a comfortable hip range:
 *
 *   cycle T   = 0.93 s for both legs        (~129 steps per minute)
 *   speed v   = 2.44 m/s                    (~8.8 km/h — tempo retuned by ear
 *                                             in review; T and v always move
 *                                             together so the excursion, and
 *                                             with it the stride shape, is
 *                                             pinned while the tempo changes)
 *   stance s  = 0.35 of the cycle per leg
 *   excursion = v*s*T = 0.79 m, split 0.29 m ahead / 0.50 m behind the hip
 *
 * With a 0.82 m leg that is about 25 degrees of hip travel each way, which is
 * the right order for a jog. Standard gait proportions, not a measured
 * trajectory — the same standing as the push-up's tempo.
 *
 * The excursion is not free: it and the hip height together decide whether the
 * leg can reach the ground without straightening onto the IK clamp. 0.76 m at
 * the first attempt put the strike position 0.83 m from a 0.824 m leg and the
 * knee locked. Changing either number means re-checking that.
 */

import * as THREE from "three";

import { applyPose, placeRoot, anchorRoot, orientSegment } from "../../rig.js";
import { smooth, swing, wrap } from "../ease.js";
import { solveLeg, plantFoot, swingFoot, kneeAxis, ankleOverBall } from "../kinematics.js";
import { guardPose } from "../definition.js";

/** One full cycle: right foot strike to the next right foot strike. */
const DURATION = 0.928;

/* Scratch for the per-frame fist orientation (see the block in frame()). */
const _elbowW = new THREE.Vector3();
const _wristW = new THREE.Vector3();
const _fingersW = new THREE.Vector3();
const _palmW = new THREE.Vector3();

const SPEED = 2.44;
const STANCE = 0.35;
const EXCURSION = SPEED * STANCE * DURATION;

/** Vertical travel of the hip centre. Twice per cycle — once per footfall. */
const BOB = 0.048;

/**
 * How much the hips sit below standing height while running.
 *
 * A runner is never at full standing height — the stance knee is always carrying
 * some flexion. It also has to be enough that the leg can reach the strike and
 * toe-off positions without straightening onto the IK clamp: at 2.9 m/s the
 * strike sits 0.33 m ahead, and 0.095 of sink keeps that solve a few degrees
 * off the clamp — the stretched-out landing the stride asks for, not a locked one.
 */
const HIP_SINK = 0.095;

/** Peak plantarflexion at toe-off, in degrees. */
const HEEL_LIFT = 46;

/** How high the swing foot lifts. */
const SWING_LIFT = 0.42;

/**
 * Where the stance sits relative to the hip: strike ahead by 0.37 of the
 * excursion, toe-off behind by 0.63 — the split leans behind the hip, which
 * is the leg backswing the movement is watched for. A runner's contact is not symmetric — the
 * push-off happens well behind the body, and centring it is what made the gait
 * read as a shuffle with no back kick. Total excursion is unchanged, so the
 * stance foot still travels at exactly the scroll speed.
 */
const STRIKE_SHARE = 0.37;

/**
 * Where in the swing the foot peaks. A real swing whips the heel up right
 * after toe-off — behind the body — not at the midpoint of the arc. 0.62 puts
 * the peak at about a third of the swing.
 */
const KICK_BIAS = 0.62;

/** The grid is 8 m over 40 divisions, so it repeats every 0.2 m. */
const GRID_CELL = 0.2;

const _hipTarget = new THREE.Vector3();
const _ankle = new THREE.Vector3();
const _from = new THREE.Vector3();
const _ball = new THREE.Vector3();
const _to = new THREE.Vector3();

/**
 * One leg's phase. `p` is the cycle position for this leg, 0 at foot strike.
 * Stance runs [0, STANCE); swing runs [STANCE, 1).
 */
function legState(p) {
  if (p < STANCE) {
    return { stance: true, u: p / STANCE };
  }
  return { stance: false, u: (p - STANCE) / (1 - STANCE) };
}

export const running = {
  id: "running",
  label: "Running",
  duration: DURATION,
  loop: true,
  roles: "running",
  camera: "gait_side",
  props: ["ground"],
  note: "The ground scrolls at the speed the stance foot travels, so planted feet do not slide.",

  phases: [
    { at: 0.0, name: "strike", label: "Right foot strike" },
    { at: DURATION * STANCE * 0.5, name: "stance", label: "Right stance · midstance" },
    { at: DURATION * STANCE, name: "flight", label: "Toe-off · flight" },
    { at: DURATION * 0.5, name: "strike", label: "Left foot strike" },
    { at: DURATION * (0.5 + STANCE * 0.5), name: "stance", label: "Left stance · midstance" },
    { at: DURATION * (0.5 + STANCE), name: "flight", label: "Toe-off · flight" },
  ],

  /** Effort peaks through each stance, when a leg is carrying bodyweight. */
  effortAt(t) {
    const p = wrap(t, DURATION) / DURATION;
    const r = legState(p);
    const l = legState(wrap(p + 0.5, 1));
    const load = (s) => (s.stance ? Math.sin(Math.PI * s.u) : 0);
    return 0.3 + 0.68 * Math.max(load(r), load(l));
  },

  /**
   * The same reading, per side, which this movement already knew and threw away.
   *
   * `effortAt` above computes BOTH legs and then collapses them with `Math.max`,
   * so a stride lit the whole body evenly and the drawing said the two legs were
   * doing the same thing at the same time. They are exactly half a cycle apart —
   * that is what a stride IS — and the phase table has been naming the sides
   * out loud the whole time ("Right foot strike", "Left foot strike") beside a
   * picture that could not tell them apart.
   *
   * `effortAt` is deliberately unchanged: it is the movement's one number, read
   * by the guided walk's peak-seek and by anything that wants "how hard is this
   * body working". This is the extra half, and a scene that does not ask for it
   * behaves exactly as before.
   */
  effortSideAt(t) {
    const p = wrap(t, DURATION) / DURATION;
    const load = (s) => (s.stance ? Math.sin(Math.PI * s.u) : 0);
    // p = 0 is the RIGHT foot strike, per this file's own phase table.
    return {
      R: 0.3 + 0.68 * load(legState(p)),
      L: 0.3 + 0.68 * load(legState(wrap(p + 0.5, 1))),
    };
  },

  setup({ rig, body, markers }) {
    const j = rig.joints;
    return {
      body,
      standY: markers.standHipY,
      // Feet track slightly inside the hips, as they do at speed.
      trackX: { L: j["ankle.L"][0] * 0.72, R: j["ankle.R"][0] * 0.72 },
      ankleY: { L: body.leg.foot.L.ankleHeight, R: body.leg.foot.R.ankleHeight },
    };
  },

  frame(t, { rig, root, groups, markers }, state) {
    const body = state.body;
    const p = wrap(t, DURATION) / DURATION;

    // Right leg leads; left is half a cycle behind.
    const legs = { R: legState(p), L: legState(wrap(p + 0.5, 1)) };

    // Heel lift through the back half of stance, per leg — computed here
    // because the TOES need it in the pose map below: as the heel rises the
    // toes extend at the MTP hinge and stay flat on the ground, which is what
    // keeps them out of the floor at toe-off now that they are not frozen.
    const heelOf = (leg) => (leg.stance ? HEEL_LIFT * smooth(Math.max(0, (leg.u - 0.5) / 0.5)) : 0);
    const heel = { L: heelOf(legs.L), R: heelOf(legs.R) };
    // The toes leave stance fully extended (the pads were on the floor) and
    // relax over the first quarter of the swing — cut to zero at toe-off they
    // snapped 39 degrees in one frame.
    const toesOf = (leg) =>
      (leg.stance ? heelOf(leg) : HEEL_LIFT * (1 - smooth(leg.u / 0.25))) * 0.85;
    const toes = { L: toesOf(legs.L), R: toesOf(legs.R) };

    /**
     * Ground scroll. The stance foot travels backward at the body's speed, so
     * the grid must too. Taken modulo the cell size, which is invisible on a
     * regular grid and keeps the number from growing without bound over a long
     * session — accumulated float error is its own kind of drift.
     */
    state.groundZ = -wrap(SPEED * t, GRID_CELL);

    /**
     * Pelvis and trunk. The pelvis rotates about vertical toward the swinging
     * leg and the thorax counter-rotates against it, which is what the arms are
     * really balancing. Positive Y turns the front toward +X, the model's left,
     * so the sign follows whichever leg is forward.
     */
    const twist = swing(p) * 6.5;
    const drive = swing(p * 2);

    applyPose(
      groups,
      guardPose({
        // Lateral lean stays small: the pelvis leans half of what it used to —
        // measured against the eye, the old 3.5 degrees read as a side-to-side
        // wobble rather than a runner's level hips.
        pelvis: [4, twist, -swing(p) * 1.75],
        lumbar: [3.5, -twist * 0.45, 0],
        // Counter-rotation lives in the thorax: opposite sign to the pelvis.
        thorax: [3, -twist * 1.15, 0],
        // The head stays level and forward. The trunk leans about 7 degrees, so
        // the neck takes most of it back.
        neck: [-7, -twist * 0.2, 0],
        head: [-2, 0, 0],

        /**
         * Arms swing opposite the same-side leg — right arm forward with the
         * left leg. Everything on the arm is a phase-shifted sine of the same
         * cycle: the shoulder leads, the elbow answers a few hundredths later,
         * the wrist later still. That lag is what "fluid" is — the earlier
         * version drove the elbow with Math.max(0, swing), whose corner at the
         * zero crossing snapped the forearm once per stride.
         */
        "girdle.L": [-2, -twist * 0.3, -4 - 0.75 * swing(p)],
        "girdle.R": [-2, -twist * 0.3, 4 - 0.75 * swing(p)],
        // A touch of cross-body drift (y) as the arm comes forward, the way a
        // relaxed arm actually swings — nobody runs with sagittal-plane pistons.
        // The backswing goes further than the front swing reaches — a runner's
        // arm drives back and coasts forward, so the base sits nearer extension
        // and the amplitude grows rather than the whole arc shifting forward.
        // Each arm rotates inward as it comes to the front — the forearm angles
        // slightly across the body at the top of the upswing, zero at the back.
        "upperarm.L": [6 - 40 * swing(p - 0.02), -7 * (1 + swing(p - 0.02)), 9 + 2 * swing(p)],
        "upperarm.R": [6 + 40 * swing(p - 0.02), 7 * (1 - swing(p - 0.02)), -9 + 2 * swing(p)],
        // Elbow closes toward the front of the swing and opens at the back,
        // smoothly, trailing the shoulder by a beat.
        // The elbow holds the runner's ~90-degree carry through the whole
        // swing — a few degrees of give, lagging the shoulder, keep it alive
        // without ever opening up.
        "ulna.L": [-85 - 5 * (0.5 - 0.5 * swing(p - 0.06)), 0, 0],
        "ulna.R": [-85 - 5 * (0.5 + 0.5 * swing(p - 0.06)), 0, 0],
        /**
         * Forearm and hand: palms face each other. Pronation is SPLIT between
         * the radius and the wrist on purpose: the radius is one segment for
         * the whole forearm, so any twist it carries rotates every
         * radius-chained muscle as a block — at 72 degrees that swept the
         * flesh out across the ulna. The wrist's share blends across the
         * skinning band instead. The full fix is distributed twist along the
         * forearm, which is a mesh-set feature, not a pose. The fist itself
         * lives in the finger hinges below.
         */
        "radius.L": [0, -28, 0],
        "radius.R": [0, 28, 0],
        "hand.L": [-10 - 5 * swing(p - 0.1), -30, 4],
        "hand.R": [-10 + 5 * swing(p - 0.1), 30, -4],
        // Positive on the toe hinge lifts the toes on both feet (sign-tested at
        // build time). 0.85 of the heel angle keeps the pads planted without
        // hyperextending the joint.
        "toes.L": [toes.L, 0, 0],
        "toes.R": [toes.R, 0, 0],
        // A loose fist, barely softening as the arm swings forward — the same
        // lag that keeps the arm fluid, not a pump.
        "fingers.L": [64 + 4 * swing(p), 0, 0],
        "fingers.R": [64 + 4 * swing(p), 0, 0],
        "fingersMid.L": [84 + 4 * swing(p), 0, 0],
        "fingersMid.R": [84 + 4 * swing(p), 0, 0],
        "fingersTip.L": [38, 0, 0],
        "fingersTip.R": [38, 0, 0],
        "thumb.L": [42, 0, 0],
        "thumb.R": [42, 0, 0],
      }),
      rig,
    );

    /**
     * Vertical oscillation. Lowest at midstance, when the stance knee is most
     * flexed and the body is being carried over the foot; highest through
     * flight. Twice per cycle, because both legs do it.
     */
    placeRoot(root, { position: new THREE.Vector3(0, 0, 0) });
    _hipTarget.set(
      0,
      state.standY - HIP_SINK - BOB * 0.5 + (BOB * 0.5) * Math.cos(p * Math.PI * 4),
      // Small fore-aft sway with the drive leg.
      drive * 0.012,
    );
    anchorRoot(root, markers.hip, _hipTarget);

    for (const side of ["L", "R"]) {
      const leg = legs[side];
      const x = state.trackX[side];
      const y = state.ankleY[side];

      if (leg.stance) {
        /**
         * Planted. The foot travels backward at exactly the ground speed, from
         * the strike point ahead of the body to toe-off behind it, so relative to
         * the floor it does not move at all.
         *
         * Past midstance the heel comes up and the foot rolls onto its ball, so
         * the ankle stops being the contact and starts rising off it. That is not
         * decoration: with the ankle pinned to the floor the whole way, the hip
         * is 0.82 m from a 0.82 m leg at toe-off and the IK sits on its reach
         * clamp — the leg locks straight and the push-off disappears. Pivoting on
         * the ball buys back about 6 cm, which is the difference.
         */
        const contactZ = (STRIKE_SHARE - leg.u) * EXCURSION;
        const heelLift = heel[side];
        _ball.set(x, y * 0.2, contactZ);
        if (heelLift > 0.5) {
          _ankle.copy(ankleOverBall({ body, side, ball: _ball, pitchDeg: heelLift }));
        } else {
          _ankle.set(x, y, contactZ);
        }
      } else {
        /**
         * In the air, travelling forward. The lift peaks early — the heel whips
         * up behind the body right after toe-off, the back kick — and the arc
         * then falls away toward the strike. Biasing the phase inside the sine
         * keeps both ends at zero height and zero vertical velocity.
         */
        _from.set(x, y, (STRIKE_SHARE - 1) * EXCURSION);
        _to.set(x, y, STRIKE_SHARE * EXCURSION);
        swingFoot({ from: _from, to: _to, lift: 0, u: leg.u, out: _ankle });
        _ankle.y += SWING_LIFT * Math.sin(Math.PI * Math.pow(leg.u, KICK_BIAS));
      }

      solveLeg({
        groups,
        side,
        target: _ankle,
        body,
        bendAxis: kneeAxis(side, 0.1),
      });

      /**
       * The ankle. A relaxed ankle TRAILS: through the back kick the foot
       * carries on past its toe-off angle and points behind the body — a foot
       * held level while the heel whips up reads as an ankle cast in plaster.
       * It swings through to slight dorsiflexion before the strike. Positive
       * is plantarflexion.
       *
       * Both ends are continuous by construction: the swing starts exactly
       * where the stance's heel lift ends (-5 + HEEL_LIFT), and returns to the
       * -5 the next stance begins with.
       *
       * In stance this is the same number the ball pivot above used, so the
       * foot the eye sees and the contact the solve assumed cannot disagree.
       */
      const TOE_OFF_PITCH = -5 + HEEL_LIFT;
      const pitch = leg.stance
        ? -5 + heel[side]
        : leg.u < 0.3
          ? TOE_OFF_PITCH + 47 * smooth(leg.u / 0.3)
          : TOE_OFF_PITCH + 47 - (TOE_OFF_PITCH + 52) * smooth((leg.u - 0.3) / 0.65);

      plantFoot({ groups, side, body, pitchDeg: pitch, yawDeg: side === "L" ? 3 : -3 });
    }
  
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

export { DURATION as RUNNING_DURATION };
