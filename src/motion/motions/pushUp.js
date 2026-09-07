/**
 * The push-up, as a motion definition.
 *
 * The movement itself is untouched in `../../pushup.js` — this file is only the
 * frame solve lifted out of `PushUpScene.jsx` so the scene stops knowing which
 * exercise it is showing. Every number, axis and constant below came across
 * verbatim, and the rendered result is meant to be identical to what it was
 * before the generalisation. It is the reference implementation; if it changes
 * appearance, that is a regression, not a refactor.
 */

import * as THREE from "three";

import {
  applyPose,
  aimSegment,
  orientSegment,
  solveArm,
  setRootTransform,
  groundOn,
  solvePlank,
} from "../../rig.js";
import {
  PUSHUP_DURATION,
  flexAt,
  elbowAngleDeg,
  supportPose,
  effortAt,
} from "../../pushup.js";
import { guardPose } from "../definition.js";

const _shoulder = new THREE.Vector3();
// Fingers point along the body toward the head; the palm faces the floor.
const _fingersFwd = new THREE.Vector3(0, 0, 1);
const _palmDown = new THREE.Vector3(0, -1, 0);

/**
 * Standard push-up form: hands a little wider than the shoulders, elbows driving
 * back and out at roughly 45 degrees rather than flaring to the sides or pinned
 * to the ribs.
 */
const HAND_WIDTH = 1.7;

const ELBOW_FLARE = 0.75;

/**
 * The plane each elbow bends in.
 *
 * The X component sends the elbow toward the feet, the Z component sends it away
 * from the midline — so Z is mirrored per side but X is NOT, because the axis is
 * in world space and both elbows travel the same way down the body. Mirroring
 * the rotation sign instead of the axis is what made one elbow bend forward.
 */
const BEND_AXIS = {
  L: new THREE.Vector3(1, 0, ELBOW_FLARE).normalize(),
  R: new THREE.Vector3(1, 0, -ELBOW_FLARE).normalize(),
};

export const pushUp = {
  id: "push_up",
  label: "Push-up",
  duration: PUSHUP_DURATION,
  loop: true,
  // The push-up entry in muscle-map.json is the bench press roles — a push-up is
  // a bench press against bodyweight, and bench press is the only exercise in
  // the set following a cited source (PRD 8.2) — plus the plank stabilisers that
  // hold the body rigid, which the bench press does not need.
  roles: "push_up",
  camera: "press_side",
  props: ["floor"],
  markers: ["toetip"],
  note: "Elbow flexion is the only thing keyframed. Body pitch, arm angles and floor contact are all solved from it.",

  phases: [
    { at: 0.0, name: "top", label: "Lockout" },
    { at: 0.8, name: "eccentric", label: "Lowering · eccentric" },
    { at: 2.4, name: "bottom", label: "Bottom" },
    { at: 3.2, name: "concentric", label: "Pressing · concentric" },
  ],

  effortAt,

  setup({ rig, body }) {
    const j = rig.joints;
    const shoulder = new THREE.Vector3(...j["shoulder.L"]);
    const toe = new THREE.Vector3(...j["toes.L"]);
    return {
      upper: body.arm.upper,
      fore: body.arm.fore,
      // Distance from shoulder to the toe pivot, along the body. This is the
      // lever the plank rotates on, so it sets the body angle for a given
      // shoulder height.
      toeSpan: shoulder.distanceTo(toe),
      rest: body.arm.rest,
      frame: body.arm.frame,
      // Filled in on the first frame, once the body has been rotated prone —
      // the targets depend on where the shoulder actually lands in world space.
      hand: {},
    };
  },

  frame(t, { rig, root, groups, markers }, state) {
    const contacts = markers.contacts;
    const flex = flexAt(t);

    // The elbow angle sets how far the shoulder sits above its hand, and that
    // height pitches the whole body about the toes.
    const elbow = elbowAngleDeg(flex) * (Math.PI / 180);
    const reach = Math.sqrt(
      state.upper ** 2 + state.fore ** 2 - 2 * state.upper * state.fore * Math.cos(elbow),
    );
    applyPose(groups, guardPose(supportPose(flex)), rig);

    // Plant the hands once, directly under the shoulders at lockout. After this
    // they never move — the body travels around them, which is what a push-up is.
    if (!state.hand.L) {
      const pitch = (Math.asin(THREE.MathUtils.clamp((reach - 0.02) / state.toeSpan, -1, 1)) * 180) / Math.PI;
      setRootTransform(root, { pitchDeg: pitch, lift: 0, rig });
      groundOn(root, contacts);
      for (const side of ["L", "R"]) {
        groups.get(`upperarm.${side}`).getWorldPosition(_shoulder);
        state.hand[side] = new THREE.Vector3(_shoulder.x * HAND_WIDTH, 0.035, _shoulder.z);
      }
    }

    // Solve the body angle that puts the shoulder exactly an arm's length from
    // its hand, so hands and toes both stay welded to the floor all rep.
    solvePlank({
      root,
      rig,
      contacts,
      shoulderBone: groups.get("upperarm.L"),
      handTarget: state.hand.L,
      reach,
    });
    root.updateMatrixWorld(true);

    // Hands stay planted; the arms are solved to reach them.
    for (const side of ["L", "R"]) {
      const upperGroup = groups.get(`upperarm.${side}`);
      const foreGroup = groups.get(`ulna.${side}`);
      if (!upperGroup || !foreGroup) continue;

      upperGroup.getWorldPosition(_shoulder);
      const { upperDir, foreDir } = solveArm({
        shoulder: _shoulder,
        target: state.hand[side],
        upperLen: state.upper,
        foreLen: state.fore,
        bendAxis: BEND_AXIS[side],
      });

      aimSegment(upperGroup, state.rest[side].upper, upperDir);
      upperGroup.updateMatrixWorld(true);

      aimSegment(foreGroup, state.rest[side].fore, foreDir);
      foreGroup.updateMatrixWorld(true);

      // Plant the palm: fingers forward along the floor, palm facing down. The
      // roll is taken entirely at the wrist rather than split with the radioulnar
      // joint, so the forearm itself does not visibly pronate.
      const handGroup = groups.get(`hand.${side}`);
      const frame = state.frame[side];
      if (handGroup && frame) {
        orientSegment(handGroup, frame.fingerDir, frame.palmNormal, _fingersFwd, _palmDown);
        handGroup.updateMatrixWorld(true);
      }
    }
  },
};
