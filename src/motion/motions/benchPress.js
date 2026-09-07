/**
 * Barbell bench press.
 *
 * The bar is the driver: its height over the chest is the one number keyframed,
 * and both arms are solved to it. Driving it that way rather than posing the
 * shoulders and hoping the hands meet means the grip cannot come off the bar at
 * any point in the rep, which is the bench-press version of the push-up's
 * "hands are planted and never move".
 *
 * The body is supine, rotated -90 degrees about X so the head lies toward -Z and
 * the chest faces up. That rotation is chosen over the other supine option
 * (+90 about X then 180 about Z) precisely because it does not mirror the X
 * axis: a mirrored body flips left and right in world space and every bend axis
 * with it, which is a trap this project has already fallen into twice.
 *
 * Tempo is 2-1-1-1 over 4.4 s, the same shape as the push-up because it is the
 * same movement pattern under an external load.
 */

import * as THREE from "three";

import { applyPose, placeRoot, groundOn, orientSegment } from "../../rig.js";
import { sampleTrack, cycle } from "../ease.js";
import { solveLeg, solveArmTo, plantFoot, DEG } from "../kinematics.js";
import { guardPose } from "../definition.js";

const DURATION = 4.4;

/** Bench top. A competition bench is 42–45 cm; this is measured against nothing
 *  in the mesh set, so it is stated as the round number it is. */
const BENCH_TOP = 0.45;

/** Grip 1.7x shoulder width — a standard bench grip, clearly outside the
 *  shoulders rather than a push-up hand position with a bar in it. */
const GRIP_WIDTH = 1.7;

/**
 * How far the feet are planted ahead of the hips, along the bench.
 *
 * Short, because the hip joint sits about 0.60 m above the floor once the body
 * is on a 0.45 m bench and the whole leg is only 0.82 m. Planting the feet far
 * out leaves the leg all but straight — measured 134 degrees at the knee — which
 * is the "legs up on the bench" look rather than a braced setup. At 0.30 m the
 * knee comes back to about 109 degrees and the foot tucks behind it, which is
 * what the leg-drive cue actually produces.
 */
const FOOT_REACH = 0.3;

/**
 * The grip, as world-space geometry rather than a wrist roll.
 *
 * Lying supine with the bar overhead, a closed pronated grip tilts the fingers
 * up and over the bar toward the head (-Z), and the palm plane — the surface
 * the bar actually rests on — faces up and toward the feet. The bar centre
 * therefore sits at wrist + FINGERS·GRIP_CHANNEL + PALM_N·BAR_IN_PALM, and that
 * sum is WRIST_DROP: each frame derives the wrist IK target from the bar by
 * subtracting it, so the bar lies in the palms by construction instead of
 * hovering at the wrist joints. Over a vertical forearm this frame reads as
 * roughly 35 degrees of wrist extension, which is a real bench wrist.
 */
const FINGERS = new THREE.Vector3(0, 0.82, -0.57).normalize();
const PALM_N = new THREE.Vector3(0, 0.57, 0.82).normalize();
/** Wrist joint to the thumb web along the curled fingers — the channel the
 *  bar threads between thumb and index. Well past the mid-palm: anything
 *  shallower rested the bar against the inside of the wrist or the heel of
 *  the hand instead of in the thumb-web gap of the curled fist. Sized
 *  against the live rig, not derived. */
const GRIP_CHANNEL = 0.0746;
/** The barbell prop's cylinder radius. */
const BAR_RADIUS = 0.0135;
/** Bar centre off the palm plane, along PALM_N. 0.0720 held the bar out in
 *  the thumb-web opening, clear of the palm mesh; the owner asked for the
 *  bar approximately in the CENTER of the fist (2026-08-31, side view:
 *  slightly down and head-ward), which is this — the bar's radius plus a
 *  skin's thickness off the palm plane, the fingers wrapping it. Sized by
 *  eye against zoomed side-view screenshots, not derived. */
const BAR_IN_PALM = 0.0285;
/* EXPORTED, AND THE KEYWORD WAS LOST IN A MERGE. `tests/motion.spec.js` imports
   this — it measures the GRIP rather than the hand that holds it, and the grip
   is the wrist plus this vector. The shell merge (`ac2c83d`) rewrote this file
   and dropped the word `export`, and from that commit the ENTIRE browser suite
   could not start: the import throws before any test runs, so `make
   check-browser` failed at load and no case in eighteen spec files executed.
   Found 2026-09-04 by running it. */
export const WRIST_DROP = new THREE.Vector3()
  .addScaledVector(FINGERS, GRIP_CHANNEL)
  .addScaledVector(PALM_N, BAR_IN_PALM);

/**
 * Fraction of the lockout-to-chest distance the bar descends — stated as the
 * 3/5 the user asked for. The full-depth touch point stays the reference the
 * share is taken of, so the bottom rides a deliberate ~0.2 m above the chest
 * skin rather than touching it.
 */
const DESCENT_SHARE = 0.6;

/** 0 = bottom of the descent, 1 = lockout. */
const TRACK = [
  { t: 0.0, v: 1.0 },
  { t: 0.8, v: 1.0, ease: "smooth" }, // lockout, holding
  { t: 2.4, v: 0.0, ease: "smooth" }, // controlled descent
  { t: 3.2, v: 0.0, ease: "smooth" }, // bottom hold
  { t: 4.4, v: 1.0, ease: "press" }, // the press
];

const _wristL = new THREE.Vector3();
const _wristR = new THREE.Vector3();
const _shoulderW = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _axis = new THREE.Vector3();

/**
 * Where the elbow should sit off the shoulder-to-wrist line, per side.
 *
 * A fixed world bend axis was the T-flare: it pinned the elbows wide of the
 * hands for the whole rep. What a bench press actually holds is the stack —
 * wrist over elbow in the front view — with the elbow tucked toward the feet
 * and dipping just below the torso plane at the bottom. `solveArm` puts the
 * elbow's off-line offset along axis × dir, and axis = dir × ô makes that
 * offset ô projected perpendicular to dir, so the axis is derived from this
 * desired offset direction each frame rather than stated once. X mirrors
 * between sides; Y and Z do not.
 */
/* The outboard component is the flare. 0.28 held the strict wrist-over-elbow
   stack; the owner asked for "a bit" of flare (2026-08-31), so the elbows sit
   wider of the hands through the bend without going back to the T-flare the
   old fixed axis pinned. */
const O_HAT = {
  L: new THREE.Vector3(0.46, -0.72, 0.52).normalize(),
  R: new THREE.Vector3(-0.46, -0.72, 0.52).normalize(),
};

/** Knees stay bent and pointing up; same world bend plane as standing. */
const KNEE_AXIS = {
  L: new THREE.Vector3(1, 0, -0.1).normalize(),
  R: new THREE.Vector3(1, 0, 0.1).normalize(),
};

export const benchPress = {
  id: "bench_press",
  label: "Bench press",
  duration: DURATION,
  loop: true,
  roles: "bench_press",
  camera: "bench_side",
  props: ["floor", "bench", "barbell"],
  benchTop: BENCH_TOP,
  // The body is placed with its shoulder joint at z = 0 and the head toward -Z,
  // so the torso occupies roughly z -0.20 to 0.55 whatever the mesh set does.
  // The bench is stated here rather than solved because it is furniture: it has
  // to be in the scene graph before the first frame runs.
  benchCentre: 0.12,
  benchLength: 1.06,
  note: "The bar height is keyframed and both arms are solved to it, so the grip cannot leave the bar.",

  phases: [
    { at: 0.0, name: "top", label: "Lockout" },
    { at: 0.8, name: "eccentric", label: "Lowering · eccentric" },
    { at: 2.4, name: "bottom", label: "Chest" },
    { at: 3.2, name: "concentric", label: "Pressing · concentric" },
  ],

  /** Hardest just off the chest, where the pectoral is longest and the moment
   *  arm at the shoulder is greatest. Illustrative, not a force model. */
  effortAt(t) {
    const p = t % DURATION;
    if (p < 0.8) return 0.24;
    if (p < 2.4) return 0.24 + 0.56 * ((p - 0.8) / 1.6);
    if (p < 3.2) return 0.86;
    return 1.0 - 0.72 * ((p - 3.2) / 1.2);
  },

  setup({ rig, root, groups, body, markers }) {
    const j = rig.joints;
    const shoulderHalf = (j["shoulder.L"][0] - j["shoulder.R"][0]) / 2;

    // Supine: -90 about X takes the head to -Z and the chest to +Y, without
    // mirroring left and right.
    const quaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2,
    );

    /**
     * Settle the back onto the bench by measurement rather than arithmetic.
     *
     * Put the body in the supine orientation with the pose it will hold, then
     * read where its underside actually is and lift by that — the same
     * argument `groundOn` makes for the floor. The alternative is deriving the
     * torso's thickness from the joint centres, and the joint centres are inside
     * the bone, not on the skin.
     *
     * The back is measured as a vertex minimum rather than a Box3 because a
     * bounding box lies twice: `bindMeshes` dumps every unmapped stray mesh
     * into the thorax group, and a box around a segment rotated off the world
     * axes reads centimetres below the mesh it wraps — enough to sink the
     * measured contact into the bench when the tolerance is "light contact".
     * The minimum over the direct-child meshes' vertices is the underside
     * skin itself: strays are nested groups and excluded, and no internal
     * mesh can undercut the surface that wraps it.
     */
    applyPose(groups, guardPose(supportPose(1)), rig);
    placeRoot(root, {
      quaternion,
      position: new THREE.Vector3(0, 0, 0),
    });

    // DIRECT children only: segment groups nest (pelvis > thigh > ... > toes,
    // thorax > neck > head), so a traverse would also collect the rest-pose
    // legs and the back of the skull, and an off-midline ray below could rest
    // the bench on a hamstring instead of the torso underside.
    const torsoMeshes = [];
    const box = new THREE.Box3();
    for (const name of ["pelvis", "lumbar", "thorax"]) {
      const group = groups.get(name);
      if (!group) continue;
      for (const o of group.children) {
        if (o.isMesh) {
          torsoMeshes.push(o);
          box.expandByObject(o);
        }
      }
    }

    // The lowest vertex of the torso meshes, exactly — not ray stations.
    // Station rays measured the arch wrong twice over: the arched body's real
    // contact points sit OUTSIDE the shoulder-to-hip band the stations spanned
    // (measured: the upper contact at z head-ward of the shoulder joint, the
    // lower one at the glutes past the hip joint), and any finite station
    // spacing still misses the true minimum by millimetres the light-contact
    // tolerance does not have. Internal meshes cannot contaminate a MINIMUM —
    // they lie above the underside by definition — and strays cannot either,
    // because torsoMeshes holds direct children only. One-time cost in setup.
    let backY = Infinity;
    for (const o of torsoMeshes) {
      const pos = o.geometry.attributes.position;
      const e = o.matrixWorld.elements;
      for (let i = 0; i < pos.count; i++) {
        const wy =
          e[1] * pos.getX(i) + e[5] * pos.getY(i) + e[9] * pos.getZ(i) + e[13];
        if (wy < backY) backY = wy;
      }
    }
    // A mesh set with no torso geometry at all: the box measure, as before.
    if (!Number.isFinite(backY)) backY = box.isEmpty() ? -0.1 : box.min.y;

    // Along the bench: put the shoulders at z = 0 so the framing does not depend
    // on how long the body happens to be.
    const shoulderZ = -j["shoulder.L"][1];

    const lift = BENCH_TOP - backY;
    const position = new THREE.Vector3(0, lift, -shoulderZ);

    // With the body placed, read the joints the movement is built around.
    placeRoot(root, { quaternion, position });
    const shoulder = new THREE.Vector3();
    groups.get("upperarm.L").getWorldPosition(shoulder);
    const hip = new THREE.Vector3();
    groups.get("thigh.L").getWorldPosition(hip);

    /**
     * The bar path leans down the body (owner, 2026-08-31: "the bar lower
     * down closer to the lower body so the forearms are near 90 degrees with
     * the floor"). At lockout the bar balances over the shoulder joint; at
     * the bottom it sits over the mid-to-lower chest. 0.26 m feet-ward was
     * the fully stacked geometry — elbow under wrist, forearm 0.5 degrees
     * from vertical (measured) — and the owner called it the right
     * direction but too much travel, so the bottom rides at 0.17 m: most of
     * the stack (a fixed bar-over-the-shoulders z leaned the forearm 35
     * degrees; this reads near-vertical) without the bar walking visibly
     * far down the torso.
     */
    const barZTop = shoulder.z + 0.02;
    const barZBottom = shoulder.z + 0.17;

    /**
     * The chest, measured by raycast rather than bounding box.
     *
     * `bindMeshes` dumps every unmapped stray mesh into the thorax group as its
     * fallback, so a Box3 over the torso groups tops out at whatever landed
     * there — measured ~0.93 against a real chest skin of ~0.75 — which parked
     * the bar's bottom position in mid-air. A ray dropped straight down the
     * bar's own line hits the actual chest surface, and nothing a stray mesh
     * does off that line can contaminate it.
     */
    const chestMeshes = [];
    for (const name of ["thorax", "lumbar"]) {
      const group = groups.get(name);
      if (!group) continue;
      group.traverse((o) => { if (o.isMesh) chestMeshes.push(o); });
    }
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 2.0, barZBottom),
      new THREE.Vector3(0, -1, 0),
    );
    const hits = raycaster.intersectObjects(chestMeshes, false);
    // Fallback for a mesh set the ray misses entirely: the box measure. It was
    // taken with the root at the origin, so the lift has to go back on — the
    // lift is a pure translation in y, so adding it back is exact.
    const chestY = hits.length
      ? hits[0].point.y
      : (box.isEmpty() ? 0.24 : box.max.y) + lift;

    const armLen = body.arm.upper + body.arm.fore;

    // Both endpoints are BAR-centre heights; the wrists ride WRIST_DROP
    // below them. At lockout it is the WRIST that stops 2 cm short of full
    // reach — the same trick the push-up uses to keep the IK off its clamp —
    // and the bar sits the drop's height above that wrist.
    const barTopY = shoulder.y + armLen - 0.02 + WRIST_DROP.y;
    // Full depth — bar radius plus a little clearance over the measured skin.
    // The reference DESCENT_SHARE is taken of, not the bottom itself.
    const touchY = chestY + BAR_RADIUS + 0.009;

    return {
      body,
      quaternion,
      position,
      halfGrip: shoulderHalf * GRIP_WIDTH,
      shoulderY: shoulder.y,
      barZTop,
      barZBottom,
      chestY,
      barTopY,
      barBottomY: barTopY - DESCENT_SHARE * (barTopY - touchY),
      benchCentre: (hip.z + shoulder.z) / 2 - 0.05,
      footTarget: {
        L: new THREE.Vector3(hip.x + 0.07, body.leg.foot.L.ankleHeight, hip.z + FOOT_REACH),
        R: new THREE.Vector3(-hip.x - 0.07, body.leg.foot.R.ankleHeight, hip.z + FOOT_REACH),
      },
      barCentre: new THREE.Vector3(),
    };
  },

  frame(t, { rig, root, groups, markers }, state) {
    const lift = sampleTrack(TRACK, t, DURATION);
    const body = state.body;

    // Breath, so the ribcage is not frozen between reps.
    const breathe = cycle((t / DURATION) * 2);

    applyPose(groups, guardPose(supportPose(lift, breathe)), rig);
    placeRoot(root, { quaternion: state.quaternion, position: state.position });

    // Feet are planted on the floor and never move; the legs are solved to them.
    for (const side of ["L", "R"]) {
      solveLeg({
        groups,
        side,
        target: state.footTarget[side],
        body,
        bendAxis: KNEE_AXIS[side],
        bendSign: -1,
      });
      // The foot stays flat on the floor whatever the knee above it is doing.
      plantFoot({ groups, side, body, pitchDeg: 0, yawDeg: side === "L" ? 7 : -7 });
    }

    // The bar. One path over the chest, leaning down the body as it descends
    // (z rides the same eased lift as y, so the bar travels a straight slanted
    // line); each wrist IK target is the grip point minus WRIST_DROP, so the
    // grip geometry — the bar resting on the palm plane — is what places the
    // wrist. Both hands shift identically, so the bar stays level and the
    // grip stays put along it.
    const barY = state.barBottomY + (state.barTopY - state.barBottomY) * lift;
    const barZ = state.barZBottom + (state.barZTop - state.barZBottom) * lift;
    state.barCentre.set(0, barY, barZ);

    _wristL.set(state.halfGrip, barY, barZ).sub(WRIST_DROP);
    _wristR.set(-state.halfGrip, barY, barZ).sub(WRIST_DROP);

    for (const side of ["L", "R"]) {
      const target = side === "L" ? _wristL : _wristR;
      const upperGroup = groups.get(`upperarm.${side}`);
      if (!upperGroup) continue;

      // The bend axis is derived from where the elbow should sit, not stated:
      // axis = dir × ô puts the elbow's off-line offset along ô projected
      // perpendicular to the shoulder-to-wrist line (see O_HAT).
      upperGroup.getWorldPosition(_shoulderW);
      _dir.copy(target).sub(_shoulderW).normalize();
      _axis.crossVectors(_dir, O_HAT[side]).normalize();

      const solved = solveArmTo({
        groups,
        side,
        target,
        body,
        bendSign: 1,
        bendAxis: _axis,
      });

      /**
       * The hand holds one fixed world orientation for the whole rep: fingers
       * tilted over the top of the bar toward the head, palm plane facing the
       * bar. A closed grip on a level bar does not rotate however the arm
       * above it moves — following the forearm instead is what swung the
       * knuckles around the bar as the elbow angle changed. The wrist carries
       * whatever extension the forearm's current angle leaves it, which over a
       * vertical forearm is the ~35 degrees a real bench wrist holds. Same
       * constants both sides; the per-side rest frames already mirror.
       */
      const handGroup = groups.get(`hand.${side}`);
      const frame = body.arm.frame[side];
      if (handGroup && frame && solved) {
        orientSegment(handGroup, frame.fingerDir, frame.palmNormal, FINGERS, PALM_N);
        handGroup.updateMatrixWorld(true);
      }
    }
  },
};

/**
 * Trunk and shoulder-girdle pose. Nearly static, because a bench press holds an
 * arch and a set of retracted scapulae for the whole set — the give is at the
 * scapulae and the neck, not in the spine changing shape mid-rep.
 */
function supportPose(lift, breathe = 0) {
  return {
    // Scapulae retracted and depressed and held there. Retraction is the mirror
    // pair; the small X term is the depression. They give a few degrees as the
    // bar comes down, which is real — nobody holds them perfectly still.
    "girdle.L": [-7, 0, -8 - 4 * (1 - lift)],
    "girdle.R": [-7, 0, 8 + 4 * (1 - lift)],
    // The arch, and the counter-tilt that keeps the glutes on the bench.
    //
    // Spine points up, so NEGATIVE X is extension (kinematics.js header). The
    // arch is 21 degrees of extension across the two spine joints — -13 at
    // the lumbar, -8 at the thorax — against the old pose's 12, and its shape
    // comes from the pelvis: extension alone is a wedge that drops the
    // shoulder end, lets the settle rest that end on the bench, and leaves
    // the glutes riding 8 cm in the air (measured). So the pelvis — the
    // ROOT-most segment — counter-tilts +13 against the arch: relative to the
    // lumbar extending above it that is the posterior-tilt direction, and in
    // the supine frame (Rx maps feet-ward +Z to -Y) it noses the glute
    // underside down onto the bench. It runs as large as the lumbar's own
    // bend because its lever is short — the glutes sit barely feet-ward of
    // the arch's peak, where the shoulder end works a whole torso away.
    //
    // THE BALANCE: the pelvis carries everything above it, so its +13 would
    // pitch the shoulders with it. The same 13 is therefore subtracted from
    // the lumbar/thorax pair — they total -21 where the shoulders alone call
    // for -8 — and the net rotation reaching the shoulders is -8 with or
    // without the pelvis entry: the pelvis line moves the pelvis, nothing
    // else. The shoulder end stays at a deliberately shallow -8 because it is
    // the other CONTACT: tilting it further rolls the upper back's contact
    // away from the bench faster than any arch it buys. Measured against the
    // 0.45 bench top, this rests the upper back and holds the glutes in light
    // contact ~1 cm off their own rest — the two-point arch a bench press
    // actually sets, not a torso lying flat through the lumbar.
    pelvis: [13, 0, 0],
    lumbar: [-13, 0, 0],
    thorax: [-8 - 1.5 * breathe, 0, 0],
    // Chin tucked: the spine points up, so positive X is flexion — supine,
    // that curls the skull up off the bench so the shoulders and back take
    // the contact rather than the head propping the body.
    neck: [11, 0, 0],
    head: [7, 0, 0],

    // Closed pronated bench grip, constant — the bar never leaves the palm, so
    // the fingers have nothing to change shape for.
    "fingers.L": [52, 0, 0],
    "fingers.R": [52, 0, 0],
    "fingersMid.L": [56, 0, 0],
    "fingersMid.R": [56, 0, 0],
    "fingersTip.L": [24, 0, 0],
    "fingersTip.R": [24, 0, 0],
    "thumb.L": [30, 0, 0],
    "thumb.R": [30, 0, 0],
  };
}

export { DURATION as BENCH_DURATION };
