import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewcube, Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";

import {
  buildSegments,
  bindMeshes,
  skinSpanningMeshes,
  updateGirth,
  measureBody,
  resetRig,
  attachMarker,
  segmentBounds,
} from "./rig.js";
import { getMotion, allMotions, canonicalExerciseId } from "./motion/registry.js";
import { serializeHash, go } from "./scaleRoute.js";
import { fibreGeometry } from "./fibreGeometry.js";
import { beginCinematic } from "./cinematic.js";
import { RIDE_MS } from "./Descent.jsx";
import { cameraFor } from "./motion/cameras.js";
import { phaseAt as phaseOf, wrap } from "./motion/ease.js";
import { Floor, ScrollingFloor, PullUpBar, Barbell, Bench, Water } from "./motion/props.jsx";
import { useCameraTransition } from "./fiber/useCameraTransition.js";
import AppShell from "./shell/AppShell.jsx";
import { ROLE_STYLE } from "./App.jsx";
import { setPanelOpen, usePanelOpen } from "./shell/uiState.js";
import { describeRoles, readableSlug, setSceneContext, VIEW } from "./shell/assistantContext.js";
import MotionList from "./shell/MotionList.jsx";
/* `centreOf` LIVES IN `PickTrack.jsx` AND THIS FILE HAD NEVER IMPORTED IT.
   `nameAnchor` below calls it on every muscle-name re-aim — 20 Hz, the whole
   time the body scale is on screen — so the scene was throwing
   `ReferenceError: centreOf is not defined` continuously. Caught 2026-09-03 by
   clicking through the app with `pageerror` wired up; every build was green,
   because `vite build` bundles modules and does not resolve names. This is the
   fourth time that exact gap has shipped a live crash under a green build. */
import { centreOf } from "./PickTrack.jsx";
import MuscleLens from "./wayin/MuscleLens.jsx";
import Guide from "./guide/Guide.jsx";
import { useWalk } from "./guide/useWalk.js";
import GroupChips from "./shell/GroupChips.jsx";
import { SHOW_MUSCLE } from "./shell/showGroups.js";
import OpacityDock from "./shell/OpacityDock.jsx";
import Ways from "./shell/Ways.jsx";
import AnatomyEnvironment from "./anatomyEnvironment.jsx";
import { SHADOW } from "./anatomyStyle.js";
import "./press.css";

const MODELS = {
  muscles: "/models/muscles-individual.glb",
  skeleton: "/models/skeleton.glb",
};

/**
 * How hard each role is driven.
 *
 * The paint is the explorer's: every muscle wears its anatomical GROUP colour
 * (owner, 2026-08-30 — "the muscles in show motion match the main model"), so
 * the two pages share one palette. What moves through the rep is BRIGHTNESS —
 * the effort curve drives each working muscle's emissive glow on its own hue,
 * uninvolved muscle sits translucent in the same group colour, and the warm
 * rest→peak hue sweep this replaces is gone with the second colour language.
 */
const ROLE_DRIVE = { primary: 1, secondary: 0.55, stabilizer: 0.3 };
const GROUP_FALLBACK = new THREE.Color("#cccccc");

/**
 * HOW SOLID EACH ROLE SITS, which is the other half of the same channel.
 *
 * `ROLE_DRIVE` above moves brightness through the rep; this moves presence.
 * Both are keyed on role and neither touches hue, so the two questions stay
 * separable at a glance: the COLOUR says which anatomical group a muscle
 * belongs to, the WEIGHT says what job it is doing in this exercise.
 *
 * The flat 0.55 these replace gave a primary mover and a stabiliser the same
 * body, and left the whole role distinction resting on a glow that peaks for a
 * fraction of each rep — so for most of the cycle the three roles were one
 * picture. Separated here they are three at every instant, including a paused
 * one. `none` keeps the hard recede uninvolved muscle has had since
 * 2026-08-30 ("emphasize the dimming in unused muscles"); it is quiet, not
 * gone, because the anatomy still has to read as a body.
 */
const ROLE_OPACITY = { primary: 0.85, secondary: 0.7, stabilizer: 0.58, none: 0.72 };

/**
 * AND HOW FAR EACH ROLE IS WASHED TOWARD THE PAGE — because opacity alone does
 * not survive the palette.
 *
 * The sixteen group hues are an anatomical identity palette and carry no
 * lightness discipline: `core` is #dcc75a and `chest` is #e8776b, so on a
 * #faf8f5 page a yellow STABILISER at 0.40 lands with more contrast than a
 * coral PRIMARY at 0.75. Measured on the bench press exactly that way — the
 * abdominal wall was the loudest thing on screen while the pectoralis was the
 * muscle doing the pressing, which inverts the one rule this floor teaches.
 *
 * Washing toward the paper fixes the ordering without touching hue: a muscle
 * keeps its group's colour and simply holds less contrast against the page, so
 * "which group is this" survives intact while "how big a part is it playing"
 * becomes monotonic across all sixteen hues instead of only within one.
 * `none` is the 0.65 uninvolved muscle has had since 2026-08-30, unchanged.
 */
/* Tuned against the drawing, twice. The first pass put the whole ordering in
   opacity (0.75/0.58/0.40) and the yellow abdominal wall still out-shouted the
   coral pectoralis; the second added this wash and over-corrected, leaving
   stabilisers so faint that the floor's own discovery — a muscle that is plainly
   WORKING while plainly not moving — had nothing left to be seen in. So the
   wash carries the ordering and the opacities came back up underneath it. */
const ROLE_WASH = { primary: 0, secondary: 0.16, stabilizer: 0.3, none: 1 };

/**
 * What a selected muscle's card says, and why it is a template rather than prose.
 *
 * The role map is CURATED — `muscle-map.json`'s own evidenceNote: "Exercise-to-
 * muscle role assignments are Curated (PRD section 14), not measured", with
 * bench press alone following PRD 8.2. So the honest sentence is one that
 * reports the part this project assigned, in this movement, and stops. Writing
 * per-muscle anatomy prose here would be inventing content nobody curated and
 * dressing it as a finding; the templates say exactly as much as the data
 * behind them supports, and read contextually because the movement's own noun
 * is substituted in. Per-muscle lines can be layered on top the moment somebody
 * actually writes them — the card renders whatever it is handed.
 */
const MOVEMENT_NOUN = {
  bench_press: "press",
  push_up: "push-up",
  pull_up: "pull-up",
  lunge: "lunge",
  running: "stride",
  swimming_freestyle: "stroke",
};
const ROLE_WORD = { primary: "Primary", secondary: "Secondary", stabilizer: "Stabilizer" };
/* What the eye is being asked to compare. §13 names the ladder in words as well
   as showing it, because "bright" is the thing a visitor can check against the
   body and "primary" is the thing they cannot. */
const WEIGHT_WORD = { primary: "Bright", secondary: "Medium", stabilizer: "Faint" };

/** One key for the whole floor — see the walk's own note at its call site. */
const BODY_WALK_KEY = "hpe.guide.bodyWalk";

/**
 * HOW FAST EACH MOVEMENT IS WORTH WATCHING — owner, 2026-09-06: the four
 * resistance movements are fine and *"러닝·수영만 국면을 눈으로 못 따라간다."*
 *
 * A gait cycle is 0.93 s and a stroke is 2.6 s, and both pack three named
 * phases into that — so contact, push and flight go by in a third of a second
 * each at life speed. The lifts are four seconds for four phases and read fine.
 * This is a WATCHING rate, not a claim about the movement: nothing downstream
 * reads it, the clock is still the movement's own, and the phase readout still
 * names the real instant. It just gives the eye time to land on one.
 */
/* OWNER'S NUMBER, 2026-09-06: *"running은 원래의 0.75x … swimming도 0.75x"*.
   0.5 and 0.6 were mine, picked so three phases fit a third of a second each;
   the owner watched them and asked for less slowing, not more. */
const WATCH_SPEED = { running: 0.75, swimming_freestyle: 0.75 };

/**
 * What a particular muscle is doing in a particular movement.
 *
 * The templates below are the floor a curated role map supports for all six
 * movements. THIS is the layer the spec asks for on top — *"Brings the upper arm
 * across the chest as you press"* — and it is a different kind of claim, so it
 * is worth being clear about which.
 *
 * A template reports OUR MAPPING: that this project filed the pectoralis as a
 * prime mover of the bench press. These sentences report the muscle's ACTION,
 * which is anatomy and is not ours — the pectoralis major adducts and flexes the
 * humerus whatever anyone has filed it as. So they are safe to write where the
 * role assignment would not be: they describe the thing on screen rather than
 * asserting a finding, which is §9's test for whether a sentence belongs at all.
 * What they must never become is a claim about HOW MUCH — no contribution, no
 * share, no newtons. The archive behind this screen carries three weights of
 * brightness and nothing that could support a number.
 *
 * ALL SIX MOVEMENTS' PRIME MOVERS, thirty-three lines. It started as bench
 * press alone on the reasoning that a half-filled table reads as a bug — which
 * was true of a half-filled table and is not a reason to leave it half filled.
 * The same muscle gets a different sentence per movement, which is the whole
 * point of keying on the pair: the pectoralis brings the arm across the chest
 * in a bench press, in under the body in a push-up, and sweeps it under you in
 * a freestyle pull. Secondaries and stabilisers still take the templates —
 * their part is the same wherever they appear, which is what makes a template
 * honest there and a per-muscle line honest here.
 */
const MUSCLE_SAYS = {
  bench_press: {
    pectoralis_major: "Brings the upper arm in across the chest as you press.",
    triceps_brachii: "Straightens the elbow — the half of the press that finishes it.",
    deltoid_anterior: "Drives the upper arm forward, up off the chest.",
  },
  push_up: {
    pectoralis_major: "Brings the upper arm in under the chest as you push.",
    triceps_brachii: "Straightens the elbow — the half of the push that finishes it.",
    deltoid_anterior: "Drives the upper arm forward, lifting you off the floor.",
  },
  pull_up: {
    latissimus_dorsi: "Pulls the upper arm down and back — what lifts you to the bar.",
    biceps_brachii: "Bends the elbow, closing the last of the gap.",
    brachialis: "Bends the elbow underneath the biceps, whatever the forearm is doing.",
    teres_major: "Works with the lat to draw the upper arm down toward the ribs.",
  },
  lunge: {
    gluteus_maximus: "Straightens the hip to drive you back up out of the lunge.",
    rectus_femoris: "Straightens the knee, and lifts the thigh on the way back.",
    vastus_lateralis: "Straightens the knee from the outside of the thigh.",
    vastus_medialis: "Straightens the knee from the inside of the thigh.",
    vastus_intermedius: "Straightens the knee from deep under the other three.",
    biceps_femoris: "Slows the knee on the way down, then helps the hip come back up.",
    semitendinosus: "Bends the knee and extends the hip as you rise.",
    semimembranosus: "Bends the knee and extends the hip, alongside the other hamstrings.",
  },
  running: {
    gluteus_maximus: "Drives the hip back at push-off — the stride's main engine.",
    rectus_femoris: "Swings the thigh forward and straightens the knee.",
    vastus_lateralis: "Straightens the knee from the outside of the thigh.",
    vastus_medialis: "Straightens the knee from the inside of the thigh.",
    vastus_intermedius: "Straightens the knee from deep under the other three.",
    biceps_femoris: "Pulls the leg back under you and slows the swinging shin.",
    semitendinosus: "Extends the hip and bends the knee through the swing.",
    semimembranosus: "Extends the hip and bends the knee, alongside the other hamstrings.",
    gastrocnemius: "Points the foot down at push-off, and crosses the knee as well.",
    soleus: "Points the foot down from beneath the calf, on every step.",
  },
  swimming_freestyle: {
    latissimus_dorsi: "Pulls the arm down through the water — the stroke's main engine.",
    pectoralis_major: "Sweeps the arm in under the body during the pull.",
    deltoid_anterior: "Lifts the arm forward into the catch.",
    deltoid_lateral: "Carries the arm out to the side through the recovery.",
    deltoid_posterior: "Draws the arm back at the end of the pull.",
    triceps_brachii: "Straightens the elbow to finish the push past the hip.",
    teres_major: "Works with the lat to pull the upper arm down and back.",
  },
};

function roleSentence(role, motionId) {
  const it = MOVEMENT_NOUN[motionId] ?? "movement";
  if (role === "primary") return `One of the main muscles producing the ${it}.`;
  if (role === "secondary") return `Helps the main movers complete the ${it}.`;
  if (role === "stabilizer") return `Holds the rest of the body steady so the ${it} can happen.`;
  // Not a gap to apologise for — it is the answer to "why is this one quiet",
  // which is the question a visitor who pressed it is actually asking.
  return "Not one of the muscles this movement uses.";
}
const PAPER = new THREE.Color("#e9e4de");
/**
 * WHAT A MUSCLE WITH NO PART IN THIS MOVEMENT IS MADE OF — owner, 2026-09-06:
 * *"일부러 숨기면 너무 해골같아서 차라리 그냥 흰색으로 그리자."*
 *
 * It used to recede to almost nothing (0.10 opacity, washed two thirds toward
 * the paper), and the effect on a body where two thirds of the muscles are
 * uninvolved was that the visitor was looking at a SKELETON with a few coloured
 * straps on it. That is not what a body doing a bench press looks like.
 *
 * THE OLD ARGUMENT WAS THAT A DIM MUSCLE READS AS "SLIGHTLY ACTIVE", and it is
 * a real trap — a faded version of the working colour is on the same axis as
 * the working colour, so the eye puts it on the scale. White is not on that
 * scale. It is a different MATERIAL, not a lower setting of the same one, so it
 * says "this one is not in this" without ever being mistaken for a little bit
 * of anything. The owner knew the old reasoning and overruled it on that basis.
 * `ROLE_WASH.none` is 1 for this: the group hue is spent entirely, which is the
 * point — hue means "in this movement" now, and white means "not".
 *
 * THE COLOUR IS THE SKELETON'S, NOT THE PAGE'S. First attempt was #efe9e1 at
 * half opacity, which on #faf8f5 paper is very nearly nothing — the legs of a
 * bench press still read as bare bone, which is the exact complaint. This is the
 * GLB's own bone tone, and at 0.72 it has enough body to be a surface. A muscle
 * that is not involved should look like a muscle nobody is using, not like a
 * muscle nobody drew.
 */
const UNINVOLVED = new THREE.Color("#e4ddcf");

/**
 * HOW MUCH ROOM A MUSCLE SEES, and why it is a small number.
 *
 * This floor drew with no environment at all: `metalness 0`, no `scene.environment`,
 * so every highlight came from two directional lobes at F0 0.04 — the exact
 * condition `anatomyStyle.js` names "matte clay" and then fixes for the deep
 * scales only. Same file knew, and skipped this one. That is an unapplied fix
 * rather than a taste, which is why it is being applied.
 *
 * BUT THE ROOM IS A RISK HERE IN A WAY IT IS NOT DOWNSTAIRS. On the deep scales
 * a highlight is free decoration. Here BRIGHTNESS IS THE ROLE — it is half of
 * the one rule this floor teaches — and image-based lighting raises diffuse as
 * well as specular, so a room turned up lifts an uninvolved muscle toward a
 * working one and quietly spends the channel the whole floor is built on.
 * So this buys silhouette and surface, not light: enough that a muscle reads as
 * a rounded thing rather than a flat shape, well under the point where the wash
 * between roles starts closing. Judged against the role ladder in the before
 * and after frames, not against how good one muscle looks alone.
 */
const ENV_ON_MUSCLE = 0.32;
const ENV_ON_BONE = 0.18;

/**
 * What a SELECTED muscle looks like — and what it deliberately does not.
 *
 * It does not change colour. A pick used to overwrite emissive with a cold
 * blue, which read as a second colour language landing on top of the first:
 * the one muscle a visitor had just asked about was the one muscle no longer
 * wearing its group's hue, so "what is this" and "which did I pick" answered
 * over each other. Selection is now made of weight and hierarchy instead —
 * the pick goes fully opaque in ITS OWN colour, everything else steps back —
 * which is legible without spending the channel that says where a muscle lives.
 *
 * `SELECT_GLOW` is a floor under the effort ramp, not a replacement for it:
 * a selected muscle keeps pulsing with the rep (the movement must stay
 * readable while you inspect) and simply never falls dark between peaks.
 */
const SELECT_OPACITY = 1;
const SELECT_GLOW = 0.34;
/**
 * The contour on a chosen muscle.
 *
 * INFLATED IN THE VERTEX SHADER, NOT BY SCALING THE OBJECT. 310 of these meshes
 * are skinned, and scaling a bound SkinnedMesh moves it out of the body rather
 * than thickening it. Pushing `position` along `normal` inside `<begin_vertex>`
 * happens BEFORE the skinning chunk, so the swollen shell is skinned by the same
 * bones as the muscle and stays welded to it through the whole repetition.
 *
 * BackSide, so only the far wall of the shell survives the depth test and what
 * is left is a rim. Ink rather than white: the stage is paper (#faf8f5) and a
 * white contour on it is not a contour. Thin enough to read as a drawn edge and
 * not as a second muscle — the selection is already carried by weight and by
 * everything else stepping back; this is the line that says "this one" at a
 * glance without spending hue, which is the channel the floor cannot spare.
 */
const OUTLINE_INK = "#3a352e";
const OUTLINE_M = 0.004;
/* Hover gets one too (§6), thinner and fainter — the same rule the glow follows:
   pointing at a muscle and choosing one must never look like the same event. */
const OUTLINE_HOVER_M = 0.0022;

function outlineMaterial(width = OUTLINE_M, opacity = 0.55) {
  const m = new THREE.MeshBasicMaterial({
    color: new THREE.Color(OUTLINE_INK),
    side: THREE.BackSide,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float outlineWidth;")
      .replace(
        "#include <begin_vertex>",
        "vec3 transformed = vec3( position + normal * outlineWidth );",
      );
  };
  return m;
}
/** What a hover adds. Deliberately well under `SELECT_GLOW`: pointing at a
    muscle and choosing one must never look like the same thing. */
const HOVER_GLOW = 0.13;
/** How far everything that is not the pick steps back, by whether it is working. */
/* 0.45, which is the spec's own figure. I had it at 0.30 — a guess made while
   the selection still had no outline and needed the contrast to carry it alone.
   With a contour on the chosen muscle the neighbours can stand further forward,
   and they should: they are the crew the floor just spent a walk teaching, and
   dropping them to a third makes a selection look like the rest of the body
   switched off. */
const DIM_WORKING = 0.45;
const DIM_IDLE = 0.16;

/**
 * A mesh's muscle fields, from wherever the rebuild left them.
 *
 * 310 of the 467 muscle meshes are rebuilt as SkinnedMesh into one group, which
 * moves the GLB's `muscleKey`/`muscleLabel`/`group` extras onto the parent for
 * those and leaves them on the mesh for the other 157. Every consumer needs the
 * same fallback and five of them had written it out inline; a sixth that forgot
 * would silently read `{}` and answer "no muscle here" for two thirds of the body.
 */
const dataOf = (mesh) => (mesh?.userData?.muscleKey ? mesh.userData : mesh?.parent?.userData ?? {});

function useJson(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    fetch(url).then((r) => r.json()).then((d) => live && setData(d)).catch(() => live && setData(false));
    return () => { live = false; };
  }, [url]);
  return data;
}

/**
 * Ground contacts, measured rather than assumed.
 *
 * The push-up rides on the toe pads, so it gets probes at the measured toe tips.
 * Anything standing rests on the sole, and the sole is not a joint — it is the
 * underside of the foot geometry, so it is read off the bound meshes in the rest
 * pose. Guessing "the floor is 60 mm below the ankle" is the same class of error
 * as guessing a joint centre, and it would drift the moment the mesh set is
 * rebuilt.
 */
function buildMarkers(rig, groups) {
  const toetip = {};
  const heel = {};
  const ball = {};

  for (const side of ["L", "R"]) {
    const tip = rig.joints[`toetip.${side}`];
    const toes = groups.get(`toes.${side}`);
    if (tip && toes) toetip[side] = attachMarker(toes, tip);

    const foot = groups.get(`foot.${side}`);
    const bounds = foot ? segmentBounds(foot) : null;
    if (foot && bounds) {
      const x = (bounds.min.x + bounds.max.x) / 2;
      // Inset from the extremes so the probes sit on the pads that actually
      // carry load rather than on the single furthest vertex of the calcaneus.
      const inset = (bounds.max.z - bounds.min.z) * 0.12;
      heel[side] = attachMarker(foot, [x, bounds.min.y, bounds.min.z + inset]);
      ball[side] = attachMarker(foot, [x, bounds.min.y, bounds.max.z - inset]);
    }
  }

  // Rides the pelvis at the midpoint of the two hips: the point a squat, a lunge
  // or a stride is really moving up and down, and the handle `anchorRoot` uses.
  const hipL = rig.joints["hip.L"];
  const hipR = rig.joints["hip.R"];
  const pelvis = groups.get("pelvis");
  const hip =
    hipL && hipR && pelvis
      ? attachMarker(pelvis, [
          (hipL[0] + hipR[0]) / 2,
          (hipL[1] + hipR[1]) / 2,
          (hipL[2] + hipR[2]) / 2,
        ])
      : null;

  const soles = [heel.L, ball.L, heel.R, ball.R].filter(Boolean);

  return {
    toetip,
    heel,
    ball,
    hip,
    soles,
    // What the push-up calls its ground probes.
    contacts: [toetip.L, toetip.R].filter(Boolean),
    // Measured standing height of the hip centre, so a motion can lower by a
    // real distance instead of a fraction of a guess.
    standHipY: hipL && hipR ? (hipL[1] + hipR[1]) / 2 : 0.885,
  };
}

function Body({
  rig,
  solo,
  motion,
  exerciseRoles,
  groupColors,
  playing,
  speed,
  skeletonOpacity,
  muscleOpacity,
  groupSel,
  query,
  onPhase,
  onPick,
  propRefs,
  resetNonce,
  seekTo,
  onPickable,
  onSpots,
  pickedKey,
  emphasis,
  seekAt,
  onHover,
  hoveredKey,
}) {
  const muscles = useGLTF(MODELS.muscles, true, true);
  const skeleton = useGLTF(MODELS.skeleton, true, true);
  const { scene: threeScene, camera, controls, gl } = useThree();
  const clock = useRef(0);
  const active = useRef(null);
  const state = useRef(null);

  /**
   * The body. Built exactly once.
   *
   * None of these dependencies change when the exercise changes, which is the
   * point: switching movements re-poses this rig, it does not build a second
   * one. There is only ever one skeleton and one set of muscle meshes in the
   * scene, and every motion drives those same bones.
   */
  const built = useMemo(() => {
    const { root, groups, skeleton: rigSkeleton, boneIndex } = buildSegments(rig);

    const mScene = muscles.scene.clone(true);
    const sScene = skeleton.scene.clone(true);
    /* The skin shell came and went on 2026-08-31: added at the owner's ask
       with a slider, pinned to the hips when it sat beside the body, and
       removed the same day ("lets just remove skins") once it was clear
       that following the pose means skinning it to the rig — mesh-set
       work, not a transform. The explorer keeps its shell; these scenes
       show muscle and bone. */

    // Pull each mesh's anatomy onto the mesh itself, before anything moves it.
    //
    // glTF puts the extras on the node, and for a node whose mesh has its own
    // child the loader leaves them on the parent. Both bindMeshes and the skinning
    // re-parent meshes onto bones, so by the time the material pass runs the
    // parent is a Bone with empty userData and every muscle reads as uninvolved.
    mScene.traverse((o) => {
      if (!o.isMesh || o.userData?.muscleKey) return;
      const src = o.parent?.userData;
      if (src?.muscleKey) o.userData = { ...src, ...o.userData };
    });

    const { container: skinnedContainer, fibres } = skinSpanningMeshes({
      scene: mScene, rig, groups, boneIndex, skeleton: rigSkeleton,
    });

    // Collect before binding. bindMeshes *moves* every mesh out of the GLB scene
    // and onto a bone, so traversing mScene afterwards finds nothing and the
    // material pass silently covers only the handful of skinned meshes.
    const collected = [];
    mScene.traverse((o) => { if (o.isMesh) collected.push(o); });
    skinnedContainer.traverse((o) => { if (o.isMesh) collected.push(o); });

    bindMeshes(mScene, rig, groups, "thorax");
    bindMeshes(sScene, rig, groups, "thorax");

    // Contacts have to be built after binding, because the sole is measured off
    // the foot meshes and they are not in the foot group until then.
    root.updateMatrixWorld(true);
    const markers = buildMarkers(rig, groups);

    return {
      root,
      groups,
      skinnedContainer,
      markers,
      fibres,
      muscleMeshes: collected,
      body: measureBody(rig),
    };
  }, [rig, muscles.scene, skeleton.scene]);

  const { root, groups, skinnedContainer, markers, fibres, muscleMeshes, body } = built;

  const ctx = useMemo(
    () => ({ rig, root, groups, body, markers, fibres }),
    [rig, root, groups, body, markers, fibres],
  );

  // Material pass: give every mesh its role in this exercise, and a material it
  // owns so the frame loop can drive colour per muscle.
  useEffect(() => {
    const roles = new Map();
    if (exerciseRoles) {
      for (const role of ["primary", "secondary", "stabilizer"]) {
        for (const key of exerciseRoles[role] ?? []) roles.set(key, role);
      }
    }

    for (const mesh of muscleMeshes) {
      const data = mesh.userData?.muscleKey ? mesh.userData : mesh.parent?.userData ?? {};
      const role = roles.get(data.muscleKey) ?? null;
      const drive = role ? ROLE_DRIVE[role] : 0;
      // The explorer's group colour, held for the frame loop's glow: keyed on
      // `group`, which every mesh has (findMuscleNode's lesson in App.jsx).
      const base = groupColors?.[data.group]?.color
        ? new THREE.Color(groupColors[data.group].color)
        : GROUP_FALLBACK.clone();

      const mat = mesh.material.clone();
      // Uninvolved muscle recedes hard — washed toward the paper and nearly
      // transparent — so the working set is what the eye lands on (owner,
      // 2026-08-30: "emphasize the dimming in unused muscles"). The group hue
      // survives as a tint, not a presence.
      mat.color.copy(base);
      // Graded by role rather than a single cliff at "has a role at all", so the
      // three working weights are separated by contrast as well as by presence.
      // The hue is untouched — this only moves how far it stands off the page.
      mat.emissive = new THREE.Color(0x000000);
      mat.emissiveIntensity = 0;
      mat.roughness = 0.62;
      mat.metalness = 0;
      mat.envMapIntensity = ENV_ON_MUSCLE;
      // A group the chips turned off recedes almost entirely — the chips
      // and the search are the highlighting controls (owner, 2026-08-31) —
      // and the frame loop's glow skips what they turned off
      // (userData.groupOff). The search dims rather than hides here: a
      // moving body with holes in it reads as broken, not as filtered.
      const needle = (query ?? "").trim().toLowerCase();
      const groupOff =
        (groupSel ? !groupSel.has(data.group) : false) ||
        (needle.length > 0 && !(data.muscleLabel ?? "").toLowerCase().includes(needle));
      // THREE WEIGHTS, NOT ONE. The working set used to share a single 0.55,
      // so at any instant the rep was not peaking — most of it — a stabiliser
      // and a prime mover were the same picture and the role distinction lived
      // entirely in a glow that had already faded. `ROLE_OPACITY` spends
      // presence on the same question the glow answers, so the three roles are
      // three at every frame, paused included. Uninvolved keeps its hard
      // recede (owner, 2026-08-30: "emphasize the dimming in unused muscles").
      /* NOTHING IS HIDDEN ANY MORE, and this is where the skeleton came from.
         `groupOff` used to mean 0.05 — invisible — and the DEFAULT selection is
         every group holding a role-mapped muscle, so on a bench press the whole
         lower body was switched off before a visitor touched anything. What was
         left was a ribcage with some coloured straps and two bare legs, which is
         the owner's *"너무 해골같아서"* exactly.
         A group that is off now draws the same way an uninvolved muscle does —
         bone-white, present, no hue — so the filter still means something (hue
         is spent or it is not) without ever removing the body. There is no
         hiding tier left on this floor. */
      const involved = !groupOff && !!role;
      const wash = involved ? ROLE_WASH[role] : ROLE_WASH.none;
      // A full wash lands on bone-white rather than on the paper: at wash 1 the
      // muscle would otherwise BE the background and disappear, which is the
      // thing being fixed.
      if (wash > 0) mat.color.lerp(involved ? PAPER : UNINVOLVED, wash);
      const baseOpacity = involved ? ROLE_OPACITY[role] : ROLE_OPACITY.none;
      mat.transparent = true;
      mat.opacity = baseOpacity;
      mat.depthWrite = baseOpacity > 0.6;
      mesh.material = mat;

      mesh.userData.role = role;
      mesh.userData.drive = drive;
      /* WHICH SIDE OF THE BODY, for the movements that are not symmetrical.
         Read off the mesh's own name because that is where BodyParts3D puts it
         ("…of_left_pectoralis_major"), and decided once here rather than parsed
         per frame for 467 meshes. Midline muscles answer null and simply take
         the movement's whole-body reading, which is the honest answer for them. */
      /* ONLY WHAT IS SOLID ENOUGH TO THROW ONE. `anatomyStyle.js` fixed this
         number at 0.8 for the deep scales and the fibre uses it: a translucent
         surface casting a hard silhouette is a lie about a thing you can see
         through. On this floor that means the prime movers cast (0.85) and
         nothing else does. */
      /* Nothing casts and nothing receives on this floor — see the Canvas. */
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.side = /(^|_)left(_|$)/.test(mesh.name)
        ? "L"
        : /(^|_)right(_|$)/.test(mesh.name)
          ? "R"
          : null;
      mesh.userData.baseColour = base;
      mesh.userData.baseOpacity = baseOpacity;
      mesh.userData.groupOff = groupOff;
    }
  }, [muscleMeshes, exerciseRoles, groupColors, groupSel, query]);

  // Bones and muscles end up interleaved in the same segment groups, so tag each
  // mesh once rather than re-deriving it on every visibility toggle.
  //
  // Both trees have to be walked. The skinned muscles hang off their own container
  // at the scene root rather than under the rig — the bones already carry the body
  // transform — so a traverse of `root` alone silently skips them.
  useEffect(() => {
    for (const tree of [root, skinnedContainer]) {
      tree.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.isBone =
          o.userData?.structure === "bone" || o.parent?.userData?.structure === "bone";
        // Bones share loader materials; opacity needs each mesh to own one.
        if (o.userData.isBone && !o.userData.ownMaterial) {
          o.material = o.material.clone();
          /* Less room than the muscle sees. The skeleton is the frame, not the
             subject — giving it the same sheen brings it forward, and it is
             already the thing that out-drew the muscle at 0.55 opacity. */
          o.material.envMapIntensity = ENV_ON_BONE;
          o.userData.ownMaterial = true;
        }
      });
    }
  }, [root, skinnedContainer]);

  // The dock's sliders (owner, 2026-08-31, settled form): bones take theirs
  // directly, muscles multiply theirs onto whatever the role/group pass
  // assigned. Depends on the pass's inputs so the multiply always sees
  // fresh bases.
  useEffect(() => {
    for (const tree of [root, skinnedContainer]) {
      tree.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        /* THE DESCENT LEAVES THE MUSCLE YOU CHOSE, AND IT WAS LEAVING NOTHING —
           2026-09-05. Owner's sentence for this shot is *"except the muscle you
           chose"*; `descent.spec.js` has graded it since 2026-08-26 and measured
           today `diving` reached `MotionCamera` and nothing else, so the camera
           flew at a body that stayed whole. The hole-in-a-gradient version that
           case's header describes was removed and nothing replaced it — a claim
           with a gate over it and no code under it.
           AT THE MESH, NOT AT A GRADIENT, which is the correction that header
           asks for: "a muscle is not a circle and its centroid is not where the
           pointer landed". So the survivor is picked by name and everything else
           goes, bones included — they were named in the list of things that used
           to survive inside the hole.
           AND THE SURVIVOR IS DRAWN AT FULL. An uninvolved muscle sits at 0.3 so
           the working ones read at a glance; once it is the only thing on screen
           there is nothing left for it to be quiet against. */
        if (solo) {
          /* THE WHOLE MUSCLE SURVIVES THE DIVE, not one of its primitives.
             `solo` is a muscle KEY now: keeping only the mesh under the pointer
             left five sixths of a pectoralis behind, so the thing the camera
             flew at was a fragment of the muscle the visitor chose.
             SETS THE START OF THE RAMP, NOT THE END. The frame loop takes the
             fade and the opening from here; this only puts the chosen muscle at
             full so it has somewhere to come down from. */
          if (dataOf(o).muscleKey === solo) {
            o.visible = true;
            o.material.transparent = false;
            o.material.opacity = 1;
          }
          return;
        }
        /* THE SELECTION IS MADE HERE, out of hierarchy rather than out of a new
           colour. A pick pushes one muscle to full and steps everything else
           back — working muscle part-way, uninvolved muscle and bone further —
           so the thing you asked about is unmistakable while the rest of the
           body stays a body. Nothing here touches hue: the anatomy keeps saying
           which group each muscle belongs to the whole time. */
        const chosen = pickedKey && dataOf(o).muscleKey === pickedKey;
        if (o.userData.isBone) {
          const dim = pickedKey ? DIM_WORKING : 1;
          o.visible = skeletonOpacity * dim > 0.02;
          o.material.transparent = skeletonOpacity * dim < 0.999;
          o.material.opacity = skeletonOpacity * dim;
        } else {
          const base = o.userData.baseOpacity ?? 1;
          /* THE WALK RE-WEIGHTS, IT DOES NOT REPAINT. `emphasis` is a multiplier
             per role on top of the shipped weights, so a beat can lift the prime
             movers and drop the rest without ever touching hue — the floor's own
             rule survives every beat that is explaining it. Clamped because a
             beat that lifts is allowed to ask for more than the material has. */
          const em = emphasis ? emphasis[o.userData.role ?? "none"] ?? 1 : 1;
          const level = chosen
            ? SELECT_OPACITY
            : pickedKey
              ? base * (o.userData.role ? DIM_WORKING : DIM_IDLE)
              : Math.min(1, base * em);
          o.visible = level * muscleOpacity > 0.02;
          o.material.transparent = level * muscleOpacity < 0.999;
          o.material.opacity = level * muscleOpacity;
        }
      });
    }
    /* `query` AND `muscleMeshes` ARE IN HERE because this pass READS what the
       material pass WRITES (`baseOpacity`, `role`), and that one keys on both.
       Typing in the search box re-ran the material pass and not this one, so the
       body kept the previous search's weights until something else moved. */
  }, [root, skinnedContainer, skeletonOpacity, muscleOpacity, solo, exerciseRoles, groupColors, groupSel, query, muscleMeshes, pickedKey, emphasis]);

  /* AND THE REST OF THE SCENE, WHICH IS NOT THE RIG. The effect above owns
     `root` and `skinnedContainer`; the bench, the floor and the props hang off
     the scene beside them, so with the muscles soloed they were still standing —
     measured 2026-09-05, "7 meshes reached a pixel but only 1 belong to the
     muscle". `descent.spec.js`'s header names exactly those as the things that
     used to survive inside the old hole: "neighbouring muscles, bones, skin".
     RESTORED BY NAME ON THE WAY OUT. The scene usually unmounts a breath later,
     but the reduced-motion path never sets `diving` at all and a cancelled ride
     would leave a body with one muscle in it — so what was hidden is remembered
     and put back rather than assumed gone. */
  useEffect(() => {
    if (!solo) {
      leaving.current = null;
      return undefined;
    }
    /* THE SURROUNDINGS GO OUT, THEY DO NOT VANISH.
       This used to set `visible = false` on everything but the chosen muscle in
       one frame, which is a cut: the body was there, and then it was not, and
       the camera then flew at what was left. §11 asks for the opposite reading —
       the context receding AROUND the muscle, then the approach, then the
       surface opening — so that arriving in the fibre feels like having gone
       inside something rather than like a page having loaded.
       The list is gathered once here and the ramp runs in the frame loop; a
       per-frame `traverse` of 668 meshes for a second and a half is a cost with
       nothing to buy it. What was hidden is still restored by name on the way
       out, because the reduced-motion path never sets `solo` at all and a
       cancelled ride must not leave a body with one muscle in it. */
    const others = [];
    threeScene.traverse((o) => {
      if (!o.isMesh || !o.material || dataOf(o).muscleKey === solo || !o.visible) return;
      others.push({ mesh: o, opacity: o.material.opacity, transparent: o.material.transparent });
    });
    const mine = [];
    threeScene.traverse((o) => {
      if (o.isMesh && o.material && dataOf(o).muscleKey === solo) mine.push(o);
    });
    leaving.current = { others, mine, from: performance.now() };
    return () => {
      leaving.current = null;
      for (const { mesh, opacity, transparent } of others) {
        mesh.visible = true;
        mesh.material.opacity = opacity;
        mesh.material.transparent = transparent;
      }
    };
  }, [solo, threeScene]);

  /**
   * Reset requested from the controls. Same path a motion switch takes, so there
   * is one way to get back to a known pose rather than two that can disagree.
   */
  useEffect(() => {
    if (resetNonce === 0) return;
    active.current = null;
    clock.current = 0;
  }, [resetNonce]);

  /**
   * The instant the hash names, applied to the clock.
   *
   * The body scale is the only one of the four that never read `t` — the fibre,
   * cell and signalling scenes have seeded from it since they landed, and this
   * one free-ran from zero however the URL was spelled. So `#…/body@6.1s` was a
   * legal hash that scaleRoute round-tripped and nothing on screen honoured,
   * which is this project's recurring defect in the one place it had not been
   * caught yet.
   *
   * Null means "no instant named", not "second zero": a plain `#motion/bench_press`
   * must keep playing from wherever it is rather than being yanked to the start
   * on every unrelated re-render.
   */
  useEffect(() => {
    if (Number.isFinite(seekTo)) clock.current = seekTo;
  }, [seekTo]);

  /* THE WALK'S OWN SEEK, which the hash's cannot do. `seekTo` is a value and
     fires only when the value changes, so a beat asking to go back to the start
     twice — the silent arrival and then "watch one rep" — would move the clock
     once. This carries a stamp with it, so asking again is a new request. */
  useEffect(() => {
    if (seekAt && Number.isFinite(seekAt.t)) clock.current = seekAt.t;
  }, [seekAt]);

  /**
   * The picked mesh, held so the frame loop does not search 668 of them.
   *
   * The previous pick is cleared HERE rather than in the loop, because the loop
   * only rewrites the muscles this exercise drives: a stabiliser or an
   * uninvolved mesh keeps whatever emissive it was last given for ever, so
   * without this line every muscle a viewer had ever clicked stayed lit and
   * "which one is selected" stopped having an answer.
   */
  /**
   * A MUSCLE, NOT A MESH — and that difference is most of what a pick got wrong.
   *
   * BodyParts3D splits one anatomical muscle across several primitives:
   * pectoralis major is SIX meshes, wrist flexors twelve, erector spinae eight,
   * and left and right sit under the same key. Selecting `mesh.name` therefore
   * lit one sixth of the chest and left the rest of the same muscle unlit,
   * which reads as a mis-aim rather than a selection — and the muscle roster,
   * the role lists and the drawer all speak in muscle KEYS, so the mesh id was
   * the one vocabulary nothing else shared. Everything with this key is now the
   * selection, and the visitor never meets the fragmentation.
   */
  /** The muscle the pointer is currently over, so a move that stays inside one
      muscle does not re-render the scene. */
  /** The descent in flight: what is receding, what is being entered, and when it
      started. Null whenever no ride is running. */
  /** The descent in flight: what is receding, what is being entered, and when
      it started. Null whenever no ride is running. */
  const leaving = useRef(null);
  /** The muscle the pointer is currently over, so a move that stays inside one
      muscle does not re-render the scene. */
  const hoverKey = useRef(null);
  /** Every mesh of the muscle under the pointer, and every mesh of the one that
      is selected — held so the frame loop does not search 467 to find them. */
  const hovered = useRef([]);
  const picked = useRef([]);
  /** The contour shells standing beside the chosen muscle's meshes. */
  const outlines = useRef([]);
  /** The same, one weight down, for whatever the pointer is over. */
  const hoverLines = useRef([]);
  useEffect(() => {
    for (const mesh of picked.current) {
      if (!mesh.material) continue;
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
    picked.current = pickedKey ? muscleMeshes.filter((m) => dataOf(m).muscleKey === pickedKey) : [];

    /* THE CONTOUR, built and torn down with the selection rather than per frame.
       A shell per mesh of the chosen muscle, parented beside it so it inherits
       the same transform, and bound to the same skeleton where there is one —
       otherwise a skinned shell hangs in the bind pose while its muscle runs the
       repetition. Six meshes for a pectoralis, twelve for the wrist flexors:
       built once on a press, disposed on the next one. */
    for (const o of outlines.current) {
      o.parent?.remove(o);
      o.material.dispose();
    }
    outlines.current = picked.current.map((mesh) => {
      const mat = outlineMaterial();
      let shell;
      if (mesh.isSkinnedMesh) {
        shell = new THREE.SkinnedMesh(mesh.geometry, mat);
        shell.bind(mesh.skeleton, mesh.bindMatrix);
      } else {
        shell = new THREE.Mesh(mesh.geometry, mat);
      }
      shell.name = `outline:${mesh.name}`;
      shell.position.copy(mesh.position);
      shell.quaternion.copy(mesh.quaternion);
      shell.scale.copy(mesh.scale);
      shell.renderOrder = -1;
      shell.raycast = () => null;
      shell.castShadow = false;
      shell.receiveShadow = false;
      mesh.parent?.add(shell);
      return shell;
    });
  }, [pickedKey, muscleMeshes]);

  useEffect(() => {
    for (const mesh of hovered.current) {
      if (!mesh.material || dataOf(mesh).muscleKey === pickedKey) continue;
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
    hovered.current =
      hoveredKey && hoveredKey !== pickedKey
        ? muscleMeshes.filter((m) => dataOf(m).muscleKey === hoveredKey)
        : [];

    /* §6's contour, built the same way as the pick's and torn down with it.
       Rebuilt only when the pointer crosses into a DIFFERENT muscle — the
       effect keys on `hoveredKey`, not on pointer position — so sliding along
       one pectoralis is no work at all. */
    for (const o of hoverLines.current) {
      o.parent?.remove(o);
      o.material.dispose();
    }
    hoverLines.current = hovered.current.map((mesh) => {
      const mat = outlineMaterial(OUTLINE_HOVER_M, 0.3);
      let shell;
      if (mesh.isSkinnedMesh) {
        shell = new THREE.SkinnedMesh(mesh.geometry, mat);
        shell.bind(mesh.skeleton, mesh.bindMatrix);
      } else {
        shell = new THREE.Mesh(mesh.geometry, mat);
      }
      shell.name = `hoverline:${mesh.name}`;
      shell.position.copy(mesh.position);
      shell.quaternion.copy(mesh.quaternion);
      shell.scale.copy(mesh.scale);
      shell.renderOrder = -1;
      shell.raycast = () => null;
      shell.castShadow = false;
      shell.receiveShadow = false;
      mesh.parent?.add(shell);
      return shell;
    });
  }, [hoveredKey, pickedKey, muscleMeshes]);

  useFrame((_, delta) => {
    /**
     * Switching exercises happens here rather than in an effect, so it cannot
     * land a frame late and render one frame of the new movement driven by the
     * old motion's state.
     *
     * The order matters and is the contract: stop, restore the skeleton to its
     * bind pose, clear the root transform the previous movement left on it, and
     * only then let the new motion measure itself.
     */
    if (active.current !== motion) {
      resetRig(root, groups);
      state.current = motion.setup?.(ctx) ?? {};
      clock.current = 0;
      active.current = motion;
    }

    if (playing) clock.current += delta * speed;
    const t = clock.current;

    motion.frame(t, ctx, state.current);

    // Muscles keep their volume: whatever skinning did to their length, put the
    // matching change back into their girth. It is the difference between a
    // biceps that bulges when it shortens and one that just gets thinner.
    updateGirth(fibres);

    // Furniture the movement places itself. The barbell rides the solved wrists
    // and the ground scrolls under a stride, so neither can drift out of
    // agreement with the body.
    if (propRefs.barbell.current && state.current?.barCentre) {
      propRefs.barbell.current.position.copy(state.current.barCentre);
    }
    if (propRefs.ground.current && state.current?.groundZ !== undefined) {
      propRefs.ground.current.position.z = state.current.groundZ;
    }

    // Activation glow tracks effort, so the loaded muscles brighten through the
    // hardest part of the rep. Illustrative only — it is not a force model.
    // The glow is each muscle's own group colour turned up, never a second
    // hue: the paint is the explorer's, the brightness is the channel.
    const e = motion.effortAt(t);
    /* A STRIDE IS TWO LEGS HALF A CYCLE APART, and until now the drawing said
       they were doing the same thing at the same time. `running` and `swimming`
       both computed each side and then collapsed them with `Math.max` before
       anything could see it — so a runner's legs lit together, which is not a
       thing a running body does, while the phase readout said "Right foot
       strike" beside it. The four resistance movements are symmetrical and
       define no such reading; they keep the single number, which is correct for
       them, and this whole branch costs them one `??`. */
    const sides = motion.effortSideAt?.(t) ?? null;
    for (const mesh of muscleMeshes) {
      const drive = mesh.userData.drive;
      if (!drive || !mesh.material) continue;
      if (mesh.userData.groupOff) {
        mesh.material.emissiveIntensity = 0;
        continue;
      }
      const side = mesh.userData.side;
      const load = (sides && side ? sides[side] : e) * drive;
      mesh.material.emissive.copy(mesh.userData.baseColour ?? GROUP_FALLBACK);
      mesh.material.emissiveIntensity = load * load * 0.9;
    }

    /**
     * The pick, applied LAST so it wins over the effort ramp above.
     *
     * Panel 7 of the front-door walk: "aimed at the chest, picked
     * left_external_oblique, no highlight." Every field of the pick reached the
     * inspect panel as text and nothing on the body changed, so a viewer could
     * not see that the raycast had gone through the muscle they meant — which
     * is the information they needed to aim again.
     */
    /* HOVER IS A LIFT, NOT A STATE. A tenth or so above whatever the muscle was
       already doing — enough that the thing under the pointer answers back, far
       too little to be mistaken for the selection, which is the loop below and
       always wins. An uninvolved muscle has no drive and gets the floor, so
       hovering the quiet parts of the body still says "this is a thing".
       IN THE FRAME LOOP, and the first version was not — it landed in the pick
       effect, where `e` does not exist. Two failures for the price of one: a
       ReferenceError thrown out of a passive effect on the first hover-then-
       press, which SceneBoundary turned into "Could not load this scene"; and,
       had it resolved, a lift written once per pick that the effort pass below
       overwrites sixty times a second. */
    for (const mesh of hovered.current) {
      if (!mesh.material) continue;
      mesh.material.emissive.copy(mesh.userData.baseColour ?? GROUP_FALLBACK);
      const load = e * (mesh.userData.drive ?? 0);
      mesh.material.emissiveIntensity = Math.max(HOVER_GLOW, load * load * 0.9 * 1.15);
    }

    for (const mesh of picked.current) {
      if (!mesh.material) continue;
      /* ITS OWN COLOUR, TURNED UP — not a new one. The blue this replaces made
         the selected muscle the only one on screen not wearing its group's hue,
         so the moment a visitor asked "which muscle is this" the answer to
         "where does it live" was painted over. Weight and hierarchy carry the
         selection instead (see the opacity pass); this is only its glow. */
      mesh.material.emissive.copy(mesh.userData.baseColour ?? GROUP_FALLBACK);
      /* A FLOOR UNDER THE REP, NOT A REPLACEMENT FOR IT. The exercise keeps
         playing while you inspect, so the pick has to keep pulsing with it —
         but it must never fall dark between peaks, or the selection blinks out
         twice a second. An uninvolved pick has no drive and simply sits at the
         floor, which says "this is the one you chose" without claiming it is
         working. */
      const load = e * (mesh.userData.drive ?? 0);
      mesh.material.emissiveIntensity = Math.max(SELECT_GLOW, load * load * 0.9);
    }

    /* ── THE WAY IN, IN THREE STAGES ─────────────────────────────────────────
       §11's choreography, and the reason it is here rather than in an effect is
       that it is an animation: it has to be sampled, not scheduled.
         0-200 ms   the context recedes — every other muscle, the bones, the
                    bench, the bar, the floor — so the muscle is left standing
                    rather than revealed by everything else being deleted.
         200 ms +   the camera closes in (owned by `MotionCamera`; it is already
                    easing by the time the surroundings have gone).
         240-480    the surface opens. The muscle goes part-way translucent, so
                    the last thing the visitor sees on this floor is the inside
                    of the thing they chose starting to show through — which is
                    the frame the fibre scale then takes over.
       THE BUDGET IS 620 ms AND IT IS NOT MINE. `Descent.jsx` sets `MOVING.out`
       — "how long the body has before it is covered" — and the scene is swapped
       out around 450 ms, measured. The first version of this ran to 1240 and
       the last two stages therefore played to nobody: the wash was already over
       them. Written down because the failure was invisible in the code and
       obvious the moment the frames were sampled.
       The muscle keeps its own group hue throughout. Following a coral
       pectoralis down and arriving inside a blue one was what the old pick
       colour did, and the whole point of this seam is that it is the SAME
       object at a different size. */
    const ride = leaving.current;
    if (ride) {
      const age = performance.now() - ride.from;
      const away = Math.min(1, age / 200);
      for (const { mesh, opacity } of ride.others) {
        mesh.material.transparent = true;
        mesh.material.opacity = opacity * (1 - away);
        mesh.visible = away < 1;
      }
      const open = Math.max(0, Math.min(1, (age - 240) / 240));
      for (const mesh of ride.mine) {
        mesh.visible = true;
        mesh.material.transparent = open > 0;
        mesh.material.opacity = 1 - open * 0.42;
      }
    }

    const phase = phaseOf(motion.phases, t, motion.duration);
    /* THE LAP AS WELL AS THE INSTANT. The timeline counts reps, and `wrap`
       throws away exactly the number it needs. */
    onPhase?.(phase, wrap(t, motion.duration), e, Math.floor(t / motion.duration));
  });

  /**
   * Poses the rig at `t` right now, outside the render loop, and returns the
   * result. Returns null before the motion has been set up.
   *
   * The reason this exists rather than "set the clock and wait": setting the
   * clock only queues the change, so a harness that reads back immediately gets
   * the *previous* frame, and one that samples several times in a tight loop can
   * get the same frame repeatedly and pass every assertion against a single
   * pose. Waiting on animation frames fixes the correctness but costs about
   * 2.6 s per sample in headless software WebGL, because the wait is really on
   * 668 draw calls rather than on the solve.
   *
   * Stepping the solve directly is both correct and immediate. It is sound
   * precisely because `frame` is required to be a pure function of t — see
   * definition.js — so calling it out of band cannot desynchronise anything.
   */
  const stepTo = (v) => {
    if (active.current !== motion) {
      resetRig(root, groups);
      state.current = motion.setup?.(ctx) ?? {};
      active.current = motion;
    }
    clock.current = v;
    motion.frame(v, ctx, state.current);
    updateGirth(fibres);
    return v;
  };

  // Lets a test harness step to an exact point in the rep and read the solve.
  useEffect(() => {
    const setTime = (v) => { clock.current = v; };
    window.__setMotionTime = setTime;
    // The push-up's original hook, kept so the existing harness still works.
    window.__setPushUpTime = setTime;

    const worldOf = (o) => {
      if (!o) return null;
      const v = new THREE.Vector3();
      o.getWorldPosition(v);
      return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
    };

    /**
     * Where the drawn body actually lands on screen, in normalised device
     * coordinates. The viewport is exactly [-1, 1] on both axes, so "is the
     * figure in frame?" becomes an inequality instead of a judgement call.
     *
     * This is the one question rig.json can never answer: framing is a camera
     * preset, and the pull-up shipped with the body off-screen precisely
     * because every gate this project had looked at the rig, not the picture.
     *
     * Per visible mesh, not one bounding box round the whole body. A single
     * world-space AABB projects far wider than the silhouette — its corners are
     * empty space out at the extremes of a body that is neither box-shaped nor
     * axis-aligned. Measured at 1280x800: the push-up at the bottom reads
     * y_min -1.02 that way and -0.76 this way, and the screenshot shows it
     * comfortably inside the frame. A gate that fires on correct framing gets
     * switched off, so the loose measurement is worse than none.
     *
     * The skinned muscles are not walked: their bind-pose geometry box says
     * nothing about where the GPU puts them. The bones they follow are here and
     * every extremity that can leave the frame — skull, fingers, toes — is bone.
     */
    const projectDrawn = () => {
      const p = new THREE.Vector3();
      const min = [Infinity, Infinity];
      const max = [-Infinity, -Infinity];
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        for (const x of [b.min.x, b.max.x])
          for (const y of [b.min.y, b.max.y])
            for (const z of [b.min.z, b.max.z]) {
              p.set(x, y, z).applyMatrix4(o.matrixWorld).project(camera);
              min[0] = Math.min(min[0], p.x); max[0] = Math.max(max[0], p.x);
              min[1] = Math.min(min[1], p.y); max[1] = Math.max(max[1], p.y);
            }
      });
      return { min: min.map((v) => +v.toFixed(4)), max: max.map((v) => +v.toFixed(4)) };
    };

    // Pose and read in one synchronous call. The fast, race-free way to sample.
    window.__poseAt = (v) => {
      stepTo(v);
      return window.__rigDebug();
    };

    // Direct access to one segment bone, for experiments that need to poke the
    // live rig from a harness — the fibre tree is not reachable from outside.
    window.__segment = (name) => groups.get(name);

    // And to one skinned muscle, for weight-level diagnosis of a vertex that
    // leaves the body: which bones own it, and where it sat at rest.
    window.__skinned = (name) => {
      let found = null;
      threeScene.traverse((o) => { if (o.isSkinnedMesh && o.name === name) found = o; });
      return found;
    };

    // A rest-pose direction carried to world space by a segment's current
    // rotation. At rest every group is identity, so rig.json's rest-space hand
    // frame is already in the segment's own frame and one world quaternion
    // moves it. This is how the arm work reads a palm without a finger bone.
    const dirOf = (name, local) => {
      const g = groups.get(name);
      if (!g || !local) return null;
      const q = new THREE.Quaternion();
      g.getWorldQuaternion(q);
      const v = new THREE.Vector3(local[0], local[1], local[2]).applyQuaternion(q);
      return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
    };
    const palmOf = (side) => {
      const f = rig.handFrames?.[`hand.${side}`];
      if (!f) return null;
      return {
        normal: dirOf(`hand.${side}`, f.palmNormal),
        fingers: dirOf(`hand.${side}`, f.fingerDir),
      };
    };

    /* WHERE THE CAMERA ACTUALLY IS — added 2026-09-06 because six framings had
       to be re-fitted against the front door's and there was no way to read one
       back. `__explorerState` has done this for the explorer since it was
       written; the motion window, which has six framings to get right rather
       than one, had none. */
    window.__pressCamera = () => ({
      position: camera.position.toArray().map((v) => +v.toFixed(3)),
      target: controls?.target?.toArray().map((v) => +v.toFixed(3)) ?? null,
      fov: camera.fov,
      distance: controls?.target ? +camera.position.distanceTo(controls.target).toFixed(3) : null,
    });
    window.__rigDebug = () => {
      const box = new THREE.Box3().setFromObject(root);
      return {
        exercise: motion.id,
        t: +clock.current.toFixed(2),
        phase: phaseOf(motion.phases, clock.current, motion.duration).name,
        effort: +motion.effortAt(clock.current).toFixed(3),
        shoulderL: worldOf(groups.get("upperarm.L")),
        elbowL: worldOf(groups.get("ulna.L")),
        wristL: worldOf(groups.get("hand.L")),
        // Both wrists, not just the left. A mirrored body — the trap
        // benchPress.js:11-14 names — is correct on one side and wrong on the
        // other, so a one-sided read cannot see it.
        wristR: worldOf(groups.get("hand.R")),
        shoulderR: worldOf(groups.get("upperarm.R")),
        elbowR: worldOf(groups.get("ulna.R")),
        wristR: worldOf(groups.get("hand.R")),
        palmL: palmOf("L"),
        palmR: palmOf("R"),
        // The humerus's long axis in world space, for continuity checks: a
        // shortest-arc flip shows up as this direction's frame-to-frame twin,
        // the world matrix, snapping while the direction itself barely moves.
        upperAxisL: dirOf("upperarm.L", [1, 0, 0]),
        upperAxisR: dirOf("upperarm.R", [1, 0, 0]),
        hipL: worldOf(groups.get("thigh.L")),
        kneeL: worldOf(groups.get("shank.L")),
        ankleL: worldOf(groups.get("foot.L")),
        toeL: worldOf(groups.get("toes.L")),
        toeR: worldOf(groups.get("toes.R")),
        headTop: worldOf(groups.get("head")),
        // How far the finger group hinges are curled, in degrees. Null until the
        // mesh set ships finger segments, so the suite can assert "a fist is a
        // fist" only once there are fingers to close.
        fingerFlexL: groups.has("fingers.L")
          ? +((2 * Math.acos(Math.min(1, Math.abs(groups.get("fingers.L").quaternion.w))) * 180) / Math.PI).toFixed(1)
          : null,
        fingerFlexR: groups.has("fingers.R")
          ? +((2 * Math.acos(Math.min(1, Math.abs(groups.get("fingers.R").quaternion.w))) * 180) / Math.PI).toFixed(1)
          : null,
        barCentre: state.current?.barCentre
          ? state.current.barCentre.toArray().map((v) => +v.toFixed(3))
          : null,
        // Where the motion measured the chest surface, if it did (bench press).
        chestY: state.current?.chestY ?? null,
        contacts: markers.contacts.map(worldOf),
        soles: markers.soles.map(worldOf),
        bounds: { min: box.min.toArray().map((v) => +v.toFixed(3)), max: box.max.toArray().map((v) => +v.toFixed(3)) },
        screen: projectDrawn(),
        // Where the motion put the bar this frame, for the movements that drive
        // one. Null everywhere else rather than absent, so a test asking for it
        // on the wrong motion fails loudly instead of comparing to undefined.
        bar: state.current?.barCentre ? state.current.barCentre.toArray().map((v) => +v.toFixed(4)) : null,
        root: root.position.toArray().map((v) => +v.toFixed(4)),
      };
    };

    /**
     * What the tests assert on. `bodies` is the one that matters: it counts the
     * rig roots actually present in the scene graph, so "the original model is
     * animating and nothing was cloned" is a measurement rather than a claim.
     */
    window.__motionState = () => {
      let bodies = 0;
      let skinnedContainers = 0;
      let meshes = 0;
      threeScene.traverse((o) => {
        if (o.name === "seg:root") bodies++;
        if (o.name === "skinned") skinnedContainers++;
        if (o.isMesh) meshes++;
      });
      const highlighted = muscleMeshes.filter((m) => m.userData.role).length;
      /* WHAT ACTUALLY REACHES A PIXEL, which is the only honest way to grade
         "and nothing else". `descent.spec.js` records why the count has to walk
         the WHOLE ancestry rather than one parent: meshes hidden by a group two
         levels up were counted as drawn, and it "reported 7 where 1 was drawn,
         and the assertion passed anyway because 7 and 1 are both under 67 — a
         measurement that is wrong in the safe direction is still wrong."
         These three exist because the claim they grade had no seam at all: the
         gate read `drawn`, `solo` and `soloOpacity` off this object and got
         `undefined` for each, so the case failed on a matcher error instead of
         on the drawing. Same reason `picked` is here — this reports the app's
         own state rather than a detail of how it is drawn. */
      let drawn = 0;
      let soloDrawn = 0;
      let soloOpacity = null;
      threeScene.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        for (let n = o; n; n = n.parent) if (!n.visible) return;
        if (!(o.material.opacity > 0.02)) return;
        drawn += 1;
        if (solo && dataOf(o).muscleKey === solo) {
          soloDrawn += 1;
          soloOpacity = o.material.opacity;
        }
      });
      /* HOW BRIGHT EACH SIDE IS, because the claim it grades cannot be settled by
         looking: the running camera is a side view and the two legs overlap on
         the glass for most of a stride. A screenshot can show that SOMETHING is
         lit; only a number can show that the left and the right are half a cycle
         apart. Mean over the meshes that actually have a role, so an idle side
         reads as low rather than as absent. */
      const glow = { L: [0, 0], R: [0, 0] };
      for (const mesh of muscleMeshes) {
        const side = mesh.userData.side;
        if (!side || !mesh.userData.role || !mesh.material) continue;
        glow[side][0] += mesh.material.emissiveIntensity ?? 0;
        glow[side][1] += 1;
      }
      const mean = ([sum, n]) => (n ? +(sum / n).toFixed(4) : null);

      return {
        exercise: motion.id,
        label: motion.label,
        sideGlow: { L: mean(glow.L), R: mean(glow.R) },
        /* WHICH MESH IS PICKED, BECAUSE THE ONLY OTHER PLACE THAT SAYS SO IS THE
           `⌘D` INSPECTOR. Canon B8 moved the picked muscle's NAME onto the
           picture (`HoverName`), which is right for a viewer and gives a test
           the label rather than the mesh id — and `picked-mesh` is behind a
           developer keystroke, so a case that reads it is pressing a key its own
           subject would not. `__rigDebug`, `__poseAt` and `__setMotionTime` are
           this file's existing seams; this is one more, and it reports the app's
           own state rather than a detail of how that state is drawn. */
        /* READ THROUGH THE REF, NOT THE PROP. This effect's dependency list does
           not include `pickedName` — it is [root, groups, markers, motion,
           playing, speed, muscleMeshes, threeScene, camera, ctx, fibres, rig] —
           so `window.__motionState` closes over whatever `pickedName` was when
           the effect last ran and never sees a pick. Written as the prop it
           reported `null` forever and eight browser cases failed saying no muscle
           had been picked when one had. `picked` is the ref this file already
           keeps in step with the prop, one effect above. */
        picked: picked.current[0]?.name ?? null,
        /* THE CANONICAL MUSCLE BESIDE THE MESH. A selection is a muscle now and
           can cover several primitives, so `picked` alone under-reports it. */
        pickedKey: picked.current[0] ? dataOf(picked.current[0]).muscleKey ?? null : null,
        pickedMeshes: picked.current.length,
        duration: motion.duration,
        playing,
        speed,
        t: +clock.current.toFixed(3),
        phase: phaseOf(motion.phases, clock.current, motion.duration).name,
        bodies,
        skinnedContainers,
        meshes,
        highlighted,
        drawn,
        solo: soloDrawn,
        soloKey: solo ?? null,
        soloOpacity,
        roles: motion.roles,
      };
    };

    return () => {
      delete window.__setMotionTime;
      delete window.__setPushUpTime;
      delete window.__poseAt;
      delete window.__segment;
      delete window.__rigDebug;
      delete window.__motionState;
    };
  // Dependencies are the UNION of the two lists this merge joined: `camera` from
  // the screen-projection hook, `ctx`/`fibres`/`rig` from the motion pass. Either
  // alone leaves a hook that does not re-run when half its inputs change.
  // `solo` joins the list because `__motionState` closes over it — the same trap
  // `picked` is documented above for, one field up.
  }, [root, groups, markers, motion, playing, speed, muscleMeshes, threeScene, camera, ctx, fibres, rig, solo]);

  /**
   * The muscle the ride goes into when nobody has picked one.
   *
   * THE LARGEST PRIMARY MOVER, and the superlative is the point: "first primary
   * mesh" would have been one line shorter and it is whatever order the GLB
   * happens to be in, which is not a fact about the exercise. The biggest mesh
   * the manifest calls primary for a bench press is the pectoralis major, which
   * is also the muscle objective.md names in its worked example. Bounding-box
   * volume in world scale, so a mesh that skinning has stretched is measured as
   * it is drawn.
   *
   * It must also be a mesh the rig MEASURED — 170 of the 467 have no span, and
   * the wash's card would then be the "no measured span" branch on a film that
   * chose the muscle itself. A viewer picking that muscle by hand is told the
   * truth; the ride picking it for them is just a worse shot.
   *
   * Shaped exactly like `onPick`'s payload, so `descend` cannot tell the two
   * apart and there is one way down rather than an automatic one and a manual
   * one that drift.
   */
  const bestPick = () => {
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    let best = null;
    for (const mesh of muscleMeshes) {
      if (mesh.userData.role !== "primary" || !mesh.visible) continue;
      if (!fibreGeometry(rig, mesh.name)) continue;
      box.setFromObject(mesh);
      if (box.isEmpty()) continue;
      box.getSize(size);
      const volume = size.x * size.y * size.z;
      if (best && volume <= best.volume) continue;
      box.getCenter(centre);
      const data = mesh.userData?.muscleKey ? mesh.userData : mesh.parent?.userData ?? {};
      best = { volume, mesh, label: data.muscleLabel ?? null, point: centre.clone() };
    }
    if (!best) return null;
    // Where it is on the glass, for the wash to close around — the same number
    // a pointer event would have carried, projected instead of read.
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = best.point.clone().project(camera);
    return {
      name: best.mesh.name,
      label: best.label,
      point: best.point.toArray().map((v) => +v.toFixed(3)),
      screen: [
        rect.left + ((ndc.x + 1) / 2) * rect.width,
        rect.top + ((1 - ndc.y) / 2) * rect.height,
      ],
    };
  };

  /* EVERY MUSCLE THE MOVEMENT USES, for the magnifiers. `bestPick` above answers
     "which one would the app choose"; this answers "which ones are in play", and
     the owner asked for a lens on each — *"어느 primary secondary tertiary
     그니까 사용되는 muscle이면 동일하게 뜨게"*.
     THE SAME TWO FILTERS `bestPick` USES, and they are not decoration: a mesh
     with no `role` is not in this movement, and one with no `fibreGeometry` has
     no fibre to descend into, so a lens on it would be a door to nowhere.
     Deduplicated by muscle, because a muscle is several meshes — left and right,
     and heads within a head — and fourteen muscles must not become forty
     magnifiers. The biggest mesh wins the lens, so it lands on the part of the
     muscle a viewer is actually looking at. */
  const usedSpots = () => {
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    const best = new Map();
    for (const mesh of muscleMeshes) {
      if (!mesh.userData.role || !mesh.visible) continue;
      if (!fibreGeometry(rig, mesh.name)) continue;
      box.setFromObject(mesh);
      if (box.isEmpty()) continue;
      box.getSize(size);
      const volume = size.x * size.y * size.z;
      const data = dataOf(mesh);
      const key = data.muscleKey ?? mesh.name;
      if (best.has(key) && volume <= best.get(key).volume) continue;
      /* THE LIVE CENTRE, NOT THE BIND POSE. `Box3.setFromObject` on a
         SkinnedMesh transforms the geometry's bounding box by the object's
         matrix, and a skinned mesh's matrix IS the bind pose — so for 310 of
         these the box is where the muscle would be if the body were standing
         still in its T-pose. That is what pinned the magnifier away from its
         muscle, and it is also the point the descent dives at. `centreOf`
         samples bone-transformed vertices, which is the only honest answer for
         a skinned mesh; the box above is still fine for RANKING by volume,
         which is all it is used for now. */
      if (!centreOf(mesh, centre)) box.getCenter(centre);
      best.set(key, {
        volume,
        primary: mesh.userData.role === "primary" ? 1 : 0,
        /* THE SPOT IS THE MUSCLE'S, and it has to say so in the muscle's own
           vocabulary. It used to carry only the winning MESH's name, while a
           pick reported whichever mesh the pointer hit — so on a six-mesh
           pectoralis the two matched one time in six and the way down failed to
           appear on the muscle the visitor had just chosen. */
        key,
        role: mesh.userData.role ?? null,
        group: data.groupLabel ?? null,
        name: mesh.name,
        label: data.muscleLabel ?? null,
        /* THE MESH ITSELF, so the magnifier can follow the muscle instead of
           standing where it was once. `at` below is a snapshot of this instant
           and the body does not stay in this instant. */
        mesh,
        at: centre.toArray(),
        point: centre.toArray().map((v) => +v.toFixed(3)),
      });
    }
    /* BIGGEST FIRST, and primaries ahead of the rest — `lensSpots` takes the
       head of this list as the one that stands, and it has to be the muscle a
       viewer would point at rather than whichever the traversal reached first. */
    return [...best.values()]
      .sort((a, z) => (z.primary - a.primary) || (z.volume - a.volume))
      .map(({ volume, primary, ...spot }) => spot);
  };

  // Handed up once the meshes have their roles, which is what makes the pick
  // possible at all — before that pass every `userData.role` is undefined and
  // this would answer null for the whole of the ride's first beat.
  /* AND ONCE THE RIG HAS ARRIVED, WHICH THIS LIST WAS MISSING — 2026-09-05.
     `usedSpots` drops any mesh `fibreGeometry(rig, …)` has no span for, and with
     `rig` still null that is EVERY mesh: the list comes back empty, `MuscleLens`
     returns null for an empty list, and the body scale draws no way down at all.
     `rig` is a `useJson` fetch, so whether it lands before or after the roles
     pass is a race — which is exactly the shape of the failure it produced.
     Measured 2026-09-05: `gate-legibility`'s descent-card case reported "nothing
     on the body offered a way down — no magnifier and no rail chip" while four
     cases in `descent.spec.js` pressed that same magnifier without trouble, and
     the difference between them is how warm the server was. A door that appears
     or not depending on a fetch order is the worst kind of missing: it is fine
     every time anybody checks. */
  useEffect(() => {
    onPickable?.(bestPick);
    onSpots?.(usedSpots());
  }, [muscleMeshes, exerciseRoles, camera, gl, rig]);

  /* CLICK TO IDENTIFY, AND NOT ONLY IN INSPECT MODE — 2026-08-31.
   *
   * Rex's note said this was inspect-only "so the raycaster is not walking 668
   * meshes on every stray pointer move during normal playback", and the concern
   * is real. But the handler it guards is `onPointerDown`, which fires on a
   * press and not on a move: the cost it was avoiding belongs to the hover
   * handler this scene used to have, and that one is gone.
   *
   * WHAT IT COSTS TO LEAVE IT OFF is that a visitor can light a muscle and never
   * learn its name — the picked label reaches the assistant's context and no
   * pixel. The scale's whole first step is "which muscle is this", so that is
   * not a small gap.
   *
   * NOT MEASURED IN A BROWSER. Playwright is off at the owner's instruction, so
   * this is reasoned from which event is bound, not from a frame graph. If a
   * press ever measures expensive, the fix is a cheaper raycast layer and not
   * putting the name back behind a mode. */
  const pick = (e) => {
        e.stopPropagation();
        const mesh = e.object;
        const data = dataOf(mesh);
        const chain = rig.meshChain?.[mesh.name?.replace(/_/g, " ")];
        onPick?.({
          name: mesh.name,
          /* THE MUSCLE THE VISITOR MEANT, which is not the primitive they hit.
             `key` is the canonical muscle — the vocabulary the roster, the role
             lists and the drawer already speak — and it is what the selection,
             the card and the descent are all keyed on. `name` stays because the
             mesh is still what was under the pointer and the rig chain needs it. */
          key: data.muscleKey ?? null,
          role: mesh.userData.role ?? null,
          groupKey: data.group ?? null,
          label: data.muscleLabel ?? null,
          group: data.groupLabel ?? null,
          skinned: !!mesh.isSkinnedMesh,
          segment: mesh.parent?.name?.replace(/^seg:/, "") ?? null,
          chain: chain?.segments ?? null,
          point: e.point.toArray().map((v) => +v.toFixed(3)),
          // Where on the glass the muscle was, so the ride can close in around
          // the place the viewer was already looking rather than the middle of
          // the window.
          screen: [e.nativeEvent?.clientX ?? e.clientX, e.nativeEvent?.clientY ?? e.clientY],
        });
  };

  /**
   * Hover: the muscle's name, and nothing else.
   *
   * The floor asks the visitor to press the body and, until now, gave no sign
   * the body could be pressed — the cursor changed and that was the whole
   * affordance. A name that appears under the pointer is the cheapest possible
   * answer to "is this thing interactive", and it is also all a hover should
   * ever say: the role, the sentence and the way down belong to the card, at the
   * moment somebody has committed to a muscle. A paragraph on hover would make
   * the anatomy something you read past rather than look at.
   *
   * KEYED ON THE MUSCLE, so moving the pointer between the six primitives of one
   * pectoralis is not six state changes and six renders. R3F fires this per
   * intersected object; comparing the canonical key first is what keeps a
   * pointer-move handler on a 467-mesh body affordable.
   */
  const hover = (e) => {
    /* NOT WHILE A BUTTON IS DOWN. `pressChrome.test.js` has guarded this since
       before there was a hover to guard — "an unguarded drag walks the name
       through six muscles" — and it was right: orbiting the body is a press and
       a move, so without this the name plate rides the pointer across every
       muscle the drag crosses while the visitor is only trying to turn the
       model round. A hover is a question; a drag is not asking one. */
    if (e.buttons) return;
    e.stopPropagation();
    const data = dataOf(e.object);
    const key = data.muscleKey ?? null;
    if (!key || key === hoverKey.current) return;
    hoverKey.current = key;
    onHover?.({
      key,
      name: e.object.name,
      label: data.muscleLabel ?? null,
      group: data.groupLabel ?? null,
      role: e.object.userData.role ?? null,
      point: e.point.toArray().map((v) => +v.toFixed(3)),
    });
  };
  const unhover = () => {
    if (hoverKey.current === null) return;
    hoverKey.current = null;
    onHover?.(null);
  };

  return (
    <>
      <primitive object={root} onPointerDown={pick} onPointerMove={hover} onPointerOut={unhover} />
      <primitive object={skinnedContainer} onPointerDown={pick} onPointerMove={hover} onPointerOut={unhover} />
    </>
  );
}

/* ── THE MUSCLE'S NAME, BROUGHT BACK ONTO REX'S SCENE — 2026-08-31 ───────────
   Canon B8, the owner's word: *"didnt i say that this is a canvas not a table."*
   This tree took Rex's MotionScene wholesale because his exercise animations are
   the owner's own corrections from today and are plainly better. His branch was
   cut before B8 and carries no muscle name at all: `pick` is wired only in
   inspect mode — for a real reason, a raycaster walking 668 meshes on every
   pointer move is not free — and the picked label reaches only the assistant's
   context, never a pixel. So a visitor could light a muscle and never learn what
   it was.

   AND IT IS ON THE PICK NOW, NOT ON HOVER. B8 drove this from a hover, and its
   own report closed with the gap that leaves: "a finger still has no hover, so
   on a phone muscles light and go unnamed". Rex's input is a pick, which a
   finger has. Taking his input and B8's output closes that gap rather than
   carrying it across — and it keeps his reason for not raycasting on every move.

   What B8's rendering is worth keeping for is the one thing a pointer tooltip
   could not have: the plate is lifted by the MUSCLE'S OWN half-height, boxed
   this frame, so a pectoralis pushes it as far as a pectoralis is tall. That is
   why it is not a fixed offset and why it does not sit inside the muscle. */
const _nameAt = new THREE.Vector3();
const _nameBox = new THREE.Box3();
const _nameSize = new THREE.Vector3();
const _nameTo = new THREE.Vector3();
const _nameGap = new THREE.Vector3();
/* Critically damped: ζ = 1, ω = 20 rad/s. 4.7/ω ≈ 235 ms to settle, and the
   lag while the muscle is travelling is 2ζv/ω — a tenth of a second of the
   muscle's own speed, which is single-digit pixels at these framings. Under
   damped and it overshoots the muscle it names; over damped and it is a plate
   being dragged. */
const NAME_W = 20;
/* 20 Hz, the rate `PickTrack` already chose for the same job and for the same
   reason: `centreOf` skins eight vertices, and a plate that re-aims 60 times a
   second is 40 aimings nobody can see. drei re-projects every frame regardless,
   so the DRAWING is smooth at 20 Hz — only the anchor is stepped. */
const NAME_TICK_MS = 50;
/* THE GAP BETWEEN THE WORDS AND THE MUSCLE, in metres, and the only tuned
   number in the placement. 0.02 m is about 7 px at these framings — enough that
   the plate is not touching the mesh, small enough that it still reads as
   belonging to it. */
const NAME_CLEAR = 0.02;

/**
 * WHERE THE NAME GOES. THIS FUNCTION IS THE SEAM — canon B8, and the owner is
 * not yet sure the answer is right: *"body에 muscle hover하면 뜨는 tool tip도
 * 저기에 놓는게 맞나."* So the decision is one function with one input and one
 * output, and every variant of "beside the muscle" is an edit to these four
 * lines and to nothing else.
 *
 * ABOVE, AND BY THE MUSCLE'S OWN HALF-HEIGHT. That quantity is the whole reason
 * this is not the pointer tooltip that was rejected in round one: an offset
 * typed in pixels is the same for a pectoralis and a wrist extensor, and a
 * pectoralis at this framing is hundreds of pixels across, so any offset small
 * enough to read as "this one" lands back inside the muscle it just named. The
 * box knows how tall THIS muscle is; a cursor never can.
 *
 * THE CENTRE IS SKINNED AND THE BOX IS NOT, and the mismatch is deliberate.
 * `centreOf` walks bone transforms, so the centre is where the GPU is drawing
 * the muscle this frame; `Box3.setFromObject` on a `SkinnedMesh` returns the
 * BIND POSE (`PickTrack.jsx` carries the measurement that found this the hard
 * way). Which is correct here: the plate has to sit where the muscle IS, and it
 * has to clear how tall the muscle IS — and how tall a muscle is does not
 * change with the pose.
 *
 * WHAT AN ALTERNATIVE WOULD COST, since it may be asked for:
 *   - above/below/beside, or a different clearance: this function, or
 *     `NAME_CLEAR`. One line.
 *   - anchored to the pointer again: refused, and `pressChrome.test.js` holds
 *     it refused. It is round one and it is the defect.
 *   - back in a DOM corner (the top-left column, or a plate opposite the phase):
 *     NOT this function. Delete `<HoverName>` from the canvas and restore the
 *     plate to a DOM parent — the tombstone in the JSX below says where it
 *     stood and what it cost there. About ten lines, plus the two cases in
 *     `pressChrome.test.js` that would go back to their previous aim.
 */
function nameAnchor(mesh, out) {
  if (!centreOf(mesh, out)) return false;
  _nameBox.setFromObject(mesh);
  out.y += _nameBox.isEmpty() ? NAME_CLEAR : _nameBox.getSize(_nameSize).y / 2 + NAME_CLEAR;
  return true;
}

/**
 * THE MUSCLE'S NAME, STANDING ON THE MUSCLE — canon B8, the owner's word:
 * *"didnt i say that this is a canvas not a table."*
 *
 * It was the fourth row of the top-left column, which was the answer to a real
 * defect and not a whim: before that it rode the pointer, and the pointer is
 * INSIDE the muscle, so no fixed pixel offset gets the plate off a pectoralis
 * that is hundreds of pixels across (`pressChrome.test.js` records that round).
 * The column was safe and it was also a table of contents down the left edge —
 * a fact about the picture, filed away from the picture.
 *
 * WHAT MAKES THIS DIFFERENT FROM THE POINTER TOOLTIP is that the offset is not
 * a number. The plate is lifted by the MUSCLE'S OWN half-height, boxed this
 * frame, so a pectoralis pushes it as far as a pectoralis is tall and a wrist
 * extensor pushes it as far as a wrist extensor is tall. That is the quantity
 * the tooltip could not have, because a pointer knows where the cursor is and
 * not what is under it.
 *
 * WELDED WHILE A POINTER IS DOWN. An orbit is a pointer moving across the body,
 * so without this a drag re-raycasts through six muscles and the name flickers
 * through six answers on the way. Welded, the anchor stays the 3D point it was
 * and drei keeps re-projecting it, so the plate rides the orbit stuck to its
 * muscle — which is the behaviour a viewer would describe as "it stayed". The
 * raycast is stopped at the same edge, in `Body`'s move handler.
 *
 * `aria-hidden` for the reason the column version carried: this cannot be
 * reached without a pointer, the canvas already names the movement, and a live
 * region firing on every hover would read the body aloud like a ticker. The
 * touch gap is recorded on the raycast effect inside `Body` and is not closed
 * by moving the plate.
 */
function HoverName({ hover, role }) {
  const { scene, gl } = useThree();
  const group = useRef(null);
  const pos = useRef(new THREE.Vector3());
  const vel = useRef(new THREE.Vector3());
  const of = useRef(null);
  const tick = useRef(0);
  const down = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    const press = () => { down.current = true; };
    const release = () => { down.current = false; };
    el.addEventListener("pointerdown", press);
    /* `pointerup` on the WINDOW: a drag that started on the canvas routinely
       ends with the button released off it, and a weld that never lifts is a
       plate that stops following its muscle for the rest of the visit. */
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      el.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g || !hover || down.current) return;
    const now = performance.now();
    if (now - tick.current >= NAME_TICK_MS) {
      tick.current = now;
      // The placement is `nameAnchor`'s and nothing here second-guesses it.
      const mesh = scene.getObjectByName(hover.name);
      if (mesh && nameAnchor(mesh, _nameAt)) _nameTo.copy(_nameAt);
    }
    if (of.current !== hover.name) {
      /* A DIFFERENT MUSCLE IS A CUT, NOT A GLIDE. Springing across the body
         from a pectoralis to a wrist extensor drags the plate over every
         muscle between them, naming none of them, for a quarter of a second. */
      of.current = hover.name;
      pos.current.copy(_nameTo);
      vel.current.set(0, 0, 0);
    } else {
      // Semi-implicit Euler. dt clamped because `1 - 2ωdt` turns negative past
      // 25 ms and a spring that oscillates on a slow frame is worse than one
      // that arrives late.
      const dt = Math.min(delta, 0.02);
      vel.current
        .multiplyScalar(1 - 2 * NAME_W * dt)
        .addScaledVector(_nameGap.subVectors(_nameTo, pos.current), NAME_W * NAME_W * dt);
      pos.current.addScaledVector(vel.current, dt);
    }
    g.position.copy(pos.current);
  });

  if (!hover) return null;
  return (
    <group ref={group}>
      {/* UNDER THE WAY IN, WHICH IS `[30, 20]`. A name and an entrance can be
          on the same muscle — the ring stands beside the exercise's primary
          mover, which is also the muscle a viewer points at first. */}
      <Html center zIndexRange={[24, 14]} style={{ pointerEvents: "none" }}>
        <div className="press__name" data-testid="hover-name" aria-hidden="true">
          <strong>{hover.label ?? hover.name.replace(/_/g, " ")}</strong>
          {/* The manifest's own sentence for this mesh in THIS exercise —
              "Primary in Bench press", "Not involved in Lunge". Read, never
              typed, so an exercise whose roles change moves this line by
              changing the data. */}
          {/* THE ROLE, IN THE TAG — 2026-09-06. The corner legend that used to
              carry `Bright/Medium/Faint` is gone at the owner's word, so this is
              now the ONLY place a visitor is told what part a muscle is playing,
              and it belongs here: read off the muscle itself rather than off a
              card they have to hold in their head while looking somewhere else.
              Absent for a muscle with no part in this movement — the plate says
              what it is and stops, which is also what the missing card says. */}
          {role && <span className="press__name-role">{role}</span>}
        </div>
      </Html>
    </group>
  );
}

/**
 * Eases to the movement's framing, then hands the orbit controls back.
 *
 * `dive` is the descent: a world-space point on the muscle that was picked, and
 * while it is set the framing is not the movement's but that point, close. It
 * moves along the line the camera is already on rather than to a computed
 * vantage, so the picture the viewer is reading does not swing before it closes.
 */
function MotionCamera({ preset, nonce, dive, focus }) {
  const { camera } = useThree();
  useEffect(() => {
    if (camera.fov === preset.fov) return;
    camera.fov = preset.fov;
    camera.updateProjectionMatrix();
  }, [camera, preset.fov]);

  const to = useMemo(() => {
    /* A SELECTION LEANS IN; A DESCENT GOES IN. Same machinery, different
       distances and different reversibility. `focus` is measured from the
       PRESET rather than from wherever the camera currently is, so picking a
       second muscle does not compound the move and clearing the pick eases
       straight back to the movement's own framing — the hook re-arms on any
       change of destination, and a viewer's own drag disarms it, which is the
       right precedence for a nudge nobody asked for out loud. */
    if (!dive && focus) {
      const point = new THREE.Vector3(...focus);
      const from = new THREE.Vector3(...preset.position);
      const gap = from.distanceTo(point);
      /* SMALL. The first version took a quarter of the distance and aimed
         straight at the muscle, and on the running preset — which frames a
         whole standing stride from 3.3 units out — that threw the runner half
         off the right edge to centre a quadriceps. A selection is meant to
         commit the frame to a muscle, not to lose the movement the muscle is
         part of; the movement is still what the visitor is watching. So it
         leans about a tenth of the way and the aim only drifts partway (see
         `aim` below), which reads as attention rather than as a cut. */
      const stopAt = Math.max(0.95, gap * 0.88);
      if (gap <= stopAt) return preset.position;
      return from.lerp(point, 1 - stopAt / gap).toArray();
    }
    if (!dive) return preset.position;
    const point = new THREE.Vector3(...dive);
    // Stop outside OrbitControls' own minDistance. Inside it, `controls.update`
    // pushes the camera back out every frame and the ease never settles, so the
    // viewer never gets the controls back.
    const gap = camera.position.distanceTo(point);
    /* 0.52 / 0.22 -> 0.22 / 0.08 ON 2026-09-07 — owner, 4.3: *"카메라가 그냥 겁나
       줌인되다가 화면 전환"*. The old stop sat outside OrbitControls' minDistance
       of 0.5 and a CSS scale of 2.1 on the whole picture faked the rest; the
       controls' floor now drops to 0.05 while a dive is armed (see the
       `minDistance` prop), and the picture's scale is 1.3. 0.22 is about the
       muscle's own surface from its centroid on the big ones — the camera stops
       ON the muscle and the wash closes over it; inside the shell is fiction
       (`Descent.jsx`'s own note) and is never shown. */
    const stopAt = Math.max(0.22, gap * 0.08);
    if (gap <= stopAt) return camera.position.toArray(); // already closer than the dive would get
    return camera.position.clone().lerp(point, 1 - stopAt / gap).toArray();
  }, [dive, focus, preset.position]);

  /* WHERE IT LOOKS, which is the half that actually broke the running frame.
     A dive is going INTO one muscle, so it aims at it outright. A selection is
     still watching a movement, so the aim drifts a third of the way from the
     movement's own target toward the muscle — enough to say "this one", not so
     much that the body leaves the frame. */
  const aim = useMemo(() => {
    if (dive) return dive;
    if (!focus) return preset.target;
    return new THREE.Vector3(...preset.target).lerp(new THREE.Vector3(...focus), 0.33).toArray();
  }, [dive, focus, preset.target]);

  /* FIRM WHEN THE DESTINATION IS THE PRESET ITSELF — the arrival, a switch, the
     return from a lean. `to` is the preset's own array exactly then (see the
     memo above), so identity is the test. A lean or a dive yields to a hand. */
  useCameraTransition(to, aim, true, nonce, { firm: to === preset.position });
  /* READ-ONLY, FOR A PROBE: where the body camera actually is, so the three
     arrival paths the owner keeps naming (reload, switch, back) can be measured
     in numbers instead of argued about. Nothing in the app reads it. */
  const { controls } = useThree();
  useEffect(() => {
    window.__bodyCamera = () => ({
      position: camera.position.toArray().map((v) => +v.toFixed(3)),
      target: controls?.target ? controls.target.toArray().map((v) => +v.toFixed(3)) : null,
      goal: to.map((v) => +v.toFixed(3)),
      aim: aim.map((v) => +v.toFixed(3)),
      fov: camera.fov,
    });
    return () => {
      delete window.__bodyCamera;
    };
  }, [camera, controls, to, aim]);
  return null;
}

function Loader() {
  const { progress } = useProgress();
  return <Html center><div className="loader">Loading anatomy · {Math.round(progress)}%</div></Html>;
}

/* 0.25× left the pill at the owner's ask (2026-08-31), with reset. */
const SPEEDS = [0.5, 1];

/**
 * ONE CYCLE'S PHASES, STRETCHED OVER THE WHOLE RUN.
 *
 * Owner, 2026-09-06: *"bar가 6개가 아니고 3개를 더 extend 해서"*. A gait cycle
 * contains two strides and the phase table names both, so running and swimming
 * drew six marks for movements that have three named phases. Naming only the
 * first of each was the first fix and it was half of one — the words stopped
 * repeating and the MARKS did not, so a visitor still counted six.
 *
 * SO THE STRIP DRAWS THE FIRST CYCLE AND WIDENS IT, rather than dropping the
 * repeats. Same three phases, each twice the width, spanning the same run: the
 * playhead still crosses the whole bar and nothing about the clock changes. The
 * left/right distinction lives in the glow, which is §3 and measurably works.
 *
 * A MOVEMENT THAT DOES NOT REPEAT IS RETURNED UNTOUCHED. The four resistance
 * movements name each phase once, so there is no cycle to find and this is the
 * identity — which is why it is safe to run for all six rather than for a list
 * of two that would go stale the first time a movement is added.
 */
function stripPhases(motion) {
  const all = motion?.phases ?? [];
  if (all.length < 2) return all;
  const repeatAt = all.findIndex((p, i) => i > 0 && p.name === all[0].name);
  if (repeatAt < 1) return all;
  const repeats = all.length / repeatAt;
  if (!Number.isInteger(repeats) || repeats < 2) return all;
  return all.slice(0, repeatAt).map((p) => ({ ...p, at: p.at * repeats }));
}

export default function MotionScene({ exercise = "push_up", state = null, onDescend }) {
  const rig = useJson("/mapping/rig.json");
  const muscleMap = useJson("/mapping/muscle-map.json");

  const [exerciseId, setExerciseId] = useState(() => canonicalExerciseId(exercise));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(() => 1);
  // Idle's own default (SKELETON_OPACITY in App.jsx; owner, 2026-08-31:
  // "match base skeleton opacity for show motions with idle").
  /* 0.30, not 0.55 — §14. The skeleton is orientation, not the subject: at 0.55
     it competes with the muscle it is supposed to be giving a frame to, and on
     the bench press it was the brightest thing left once the uninvolved muscle
     receded. Still a slider, so anyone who wants the old reading has it. */
  const [skeletonOpacity, setSkeletonOpacity] = useState(0.3);
  // The dock drives muscles and skeleton (owner, 2026-08-31, settled form —
  // the skin slider and then the shell itself left these scenes).
  const [muscleOpacity, setMuscleOpacity] = useState(1);
  /* §14 and §15 together: the layer sliders and the orientation cube are useful
     and are not the exhibit. Both were permanently on the stage — the sliders
     in the bottom-left corner the role key now needs, the cube in the top-right
     of every screenshot — and between them they made the first impression of a
     teaching screen read as CAD tooling. Nothing is deleted; both live behind
     one control, which is also where "put the camera back" belongs. */
  /* What the pointer is over. Separate from `picked` because they answer
     different questions — "what is this" against "which one am I studying" —
     and because a hover must never survive the pointer leaving. */
  const [hovered, setHovered] = useState(null);
  // null = not touched: the groups with active muscles, per movement.
  const [groupSel, setGroupSel] = useState(null);
  // The explorer's muscle search, on every window (owner, 2026-08-31:
  // "the side bar to be identical for all windows").
  const [query, setQuery] = useState("");

  /* BELL CAN SINGLE ONE MUSCLE OUT HERE TOO — 2026-09-07. Owner: *"when a user
     requests highlight just 'this' muscle on motion or idle, unselect every
     other muscle"*. It drives the search, which on this floor DIMS rather than
     hides (see the note where `needle` is read: "a moving body with holes in it
     reads as broken, not as filtered") — that is this floor's own word for
     unselected, and it is the right one while the body is moving.
     The chips go back to All with it, for the reason the front door gives: a
     muscle in a switched-off group would be singled out and then dimmed by the
     group it belongs to. */
  useEffect(() => {
    const single = (event) => {
      const label = typeof event.detail?.label === "string" ? event.detail.label.trim() : "";
      if (!label) return;
      setGroupSel(null);
      setQuery(label);
    };
    window.addEventListener(SHOW_MUSCLE, single);
    return () => window.removeEventListener(SHOW_MUSCLE, single);
  }, []);
  const [hud, setHud] = useState({ phase: { name: "start", label: "Start" }, t: 0, effort: 0, lap: 0 });
  const [picked, setPicked] = useState(null);

  const [resetNonce, setResetNonce] = useState(0);
  // Shared drawer state (shell/uiState.js): read here only to flip the orbit
  // controls off while the page is locked. The animation keeps playing.
  const panelOpen = usePanelOpen();
  // ponytail: the dive stays armed after the ride ends. It settles, so the orbit
  // controls do come back; a viewer who goes Back mid-ride lands close in on the
  // muscle they chose rather than at the movement's framing. Restore it if that
  // ever reads as lost rather than as where they were.
  const [diving, setDiving] = useState(null);
  /* THE CAMERA COMES SECOND. `diving` starts the recede the instant the visitor
     commits; the approach waits for the context to be most of the way gone, so
     the two read as one gesture — the room empties, THEN you move in — rather
     than as a camera flying at a body that is still dissolving around it. */
  const [camDive, setCamDive] = useState(null);
  useEffect(() => {
    if (!diving) {
      setCamDive(null);
      return undefined;
    }
    /* 200 -> 0 ON 2026-09-07. The delay kept the camera from flying at a body
       still dissolving around it; 4.2 stops the body on the press now, so the
       dive leaves from a still figure and has the whole `out` beat (620 ms) to
       arrive — the ease's tau is 0.12 s. */
    /* NO CAMERA MOVE AT ALL — 2026-09-07, owner: *"그대로 제발 그대로 그대로 x 100
       … 지금 화면 그대로 멈추고 들어가는거야"*. The dive is not armed; `Descent`
       enlarges the frozen picture instead. The machinery stays for the day a
       floor wants a real dive again. */
    const id = setTimeout(() => setCamDive(null), 0);
    return () => clearTimeout(id);
  }, [diving]);
  const hudRef = useRef(hud);
  // What the ride needs from this scene, and when it may have it.
  const pickable = useRef(null);
  const [spots, setSpots] = useState([]);

  /* ONE STANDING, PLUS THE ONE YOU PICKED. Owner: *"돋보기 아이콘이 그냥 제일
     중심적인 곳에만 떠 있고 + 어느 primary secondary tertiary 그니까 사용되는
     muscle이면 동일하게 뜨게"* — 만, only.
     ALL FOURTEEN WAS THE FIRST CUT AND THE SCREEN SAID NO. A bench press works
     the chest and shoulders, so fourteen muscle centres are fourteen points in
     one corner: shot at 1280x800, six were legible, two overlapped each other,
     and the rest sat behind the body. A magnifier that lands on a pile is not an
     invitation, it is noise.
     THE BIGGEST PRIMARY IS THE STANDING ONE — the same muscle `bestPick` hands
     the descent when nobody has chosen, so the lens sits where the app itself
     would go. Picking any other used muscle puts a second lens on it, which is
     the "동일하게" half: the offer is the same wherever you are. */
  /* THE STANDING PICK IS CHOSEN ONCE PER MOVEMENT AND KEPT IN STATE.
     TWO THINGS WENT WRONG HERE AND BOTH ARE WORTH THE LINES.
     FIRST, `usedSpots` orders by VOLUME, and a muscle's volume changes as it
     contracts — so the biggest primary swapped identity mid-animation, the `key`
     on its group changed, and the open view vanished because `open === spot.name`
     stopped matching.
     SECOND, THE FIX FOR THAT WAS ALSO WRONG: I held the name in a ref written
     inside `useMemo`, which is a side effect during render. React may discard a
     render — StrictMode double-invokes deliberately — so the write is not
     reliable, and the symptom barely moved: the coin still opened and shut on its
     own, measured shut at 1 s, open at 3 s, shut at 5 s of one ten-second hold.
     I read that as the playback change I had just made and reverted it; reverting
     did not help, which is how the ref came into view.
     CHOSEN IN AN EFFECT, HELD IN STATE, CLEARED WHEN THE MOVEMENT CHANGES —
     which is the only moment the answer is genuinely allowed to differ. */
  const [standing, setStanding] = useState(null);
  useEffect(() => {
    if (!spots.length) return;
    setStanding((held) => (held && spots.some((sp) => sp.key === held) ? held : spots[0].key));
  }, [spots]);

  /**
   * Select a muscle by its canonical key, from outside.
   *
   * The floor's whole subject is selection, and the only way to reach a
   * selection from a harness was to guess a pixel on a moving body and hope the
   * raycast landed on the muscle you meant — which is the same aiming problem
   * the visitor has, so a miss looked identical to a bug. This names the muscle
   * instead. It reports what it did rather than assuming: an unknown key, or one
   * this movement never lights, answers false rather than leaving a stale pick.
   *
   * Same family as `__setMotionTime`, `__poseAt` and `__motionState`, and like
   * them it ships — a seam that only exists in a dev build is a seam that has
   * never been run against the thing it is supposed to grade.
   */
  useEffect(() => {
    window.__pickMuscle = (key) => {
      const spot = spots.find((sp) => sp.key === key);
      if (!spot) return false;
      setPicked({
        name: spot.name,
        key: spot.key,
        role: spot.role,
        group: spot.group,
        label: spot.label,
        point: spot.point,
        screen: null,
      });
      return true;
    };
    window.__muscleKeys = () => spots.map((sp) => ({ key: sp.key, label: sp.label, role: sp.role }));
    return () => {
      delete window.__pickMuscle;
      delete window.__muscleKeys;
    };
  }, [spots]);

  const lensSpots = useMemo(() => {
    if (!spots.length) return [];
    const first = spots.find((sp) => sp.key === standing) ?? spots[0];
    /* MATCHED ON THE MUSCLE, NOT THE MESH. Both sides key on `muscleKey` now:
       before, the spot carried the largest mesh of a muscle and the pick
       carried whichever mesh was under the pointer, so five presses out of six
       on a pectoralis produced a name plate and no way down. */
    const chosen = picked?.key ? spots.find((sp) => sp.key === picked.key) : null;
    /* ONE DOOR AT A TIME. Showing the standing spot AND the pick put two
       magnifiers on the body, and on the bench press they land within a few
       pixels of each other — two identical controls side by side, neither
       saying which muscle it belongs to. The standing one exists to say "you
       can go in" before anything is chosen; once something IS chosen the card
       carries that offer with the muscle's name on it, so the second glyph is
       clutter with an ambiguity in it. §18: not a ring on every muscle. */
    return chosen ? [chosen] : [first];
  }, [spots, standing, picked?.key]);
  const [pickReady, setPickReady] = useState(false);
  const descendRef = useRef(null);

  const propRefs = {
    barbell: useRef(null),
    ground: useRef(null),
  };

  // A hash change from outside (the explorer's buttons) selects the exercise
  // without remounting the scene, so the rig and both GLBs survive the switch.
  useEffect(() => {
    setExerciseId(canonicalExerciseId(exercise));
  }, [exercise]);

  const motion = useMemo(() => getMotion(exerciseId) ?? getMotion("push_up"), [exerciseId]);

  /* BELOW `motion`, AND THAT IS NOT TIDINESS. Placed above it this read
     `motion.id` in a dependency array — `const` is in its temporal dead zone
     until its line runs, so the page threw `Cannot access 'motion' before
     initialization` and the body scale went blank. `vite build` was green: it
     bundles modules and does not resolve names.
     THIS IS THE FOURTH TIME THIS SHAPE HAS SHIPPED IN THIS REPO — `motion` in
     this same file, `beaconId` in `SignallingScale`, `turned` across a scene
     boundary. `namesResolve.test.js` catches a name that is never imported; it
     cannot catch a name that exists but is read too early. Only running the page
     does. */
  useEffect(() => setStanding(null), [motion.id]);

  /* ── THE GUIDE'S FIRST WALK ───────────────────────────────────────────────
     The owner, 2026-09-01: *"쟤가 다니면서 대부분 모든 설명은 쟤가 하는거야"*.
     `guide/firstWalk.js` carries what it says and, more to the point, WHY those
     three beats and not a tour of the app: they are the three places a
     first-timer stops, read off this file. The exercise rail is behind the
     hamburger and nothing on the page says so; nothing says the body is
     pressable; and the way down does not exist until a muscle is picked, which
     means the door to the entire lower half of this app is invisible until the
     visitor has done something no one told them to do.

     THE STAGE IS THE FRAME OF REFERENCE, not the window. `resolveAnchor` returns
     stage-relative pixels because that is what `Guide` positions in, and the
     stage is not the page — the drawer, the rail and the shell chrome all sit
     outside it. */
  const stageRef = useRef(null);
  const resolveAnchor = useCallback(
    (anchor) => {
      const stage = stageRef.current;
      if (!stage) return null;
      const box = stage.getBoundingClientRect();
      /* `r` IS HOW BIG THE SUBJECT IS, and it is not decoration. The guide keeps
         a fixed gap from whatever it is describing, and a fixed gap from a
         POINT put it standing on top of the body — a screenshot on 2026-09-01
         caught it straddling the ribcage while saying "this is a human body".
         So each anchor states its own half-width and the character clears it. */
      const rel = (r) => ({
        x: r.x + r.width / 2 - box.x,
        y: r.y + r.height / 2 - box.y,
        r: r.width / 2,
      });

      /* The body plus its equipment covers most of the middle of the stage; the
         fraction is read off a bench-press frame, which is among the widest
         things any of these movements draws. */
      if (anchor === "body") return { x: box.width / 2, y: box.height * 0.42, r: box.width * 0.22 };
      /* `menu` AND `descend` WERE DELETED HERE, 2026-09-05, with the beats that
         used them. The walk no longer tells anybody to open the drawer — this
         screen only mounts once a movement is chosen, so that beat could never
         play — and it no longer points at a way down, because the way down is a
         control standing on the muscle rather than a sentence. `descend` was
         worse than unused: it resolved `[data-testid="to-fiber"]`, which lives
         only inside the ⌘D inspector, so its beat was skipped after twelve
         missed frames on every visit and the one line that said there was
         anything below this floor never spoke. */
      if (anchor === "lit") {
        /* THE LOUDEST MUSCLE THIS MOVEMENT HAS, in screen space — the same
           `bestPick` the descent uses when nobody has chosen one, so the guide
           points at the thing the app itself would pick. Its payload carries
           `screen`, which is where on the glass it was. */
        const best = pickable.current?.();
        if (!best?.screen) return null;
        /* One muscle, and the pick reports a point rather than an extent, so
           this is the only anchor whose clearance is a guess. Kept small: the
           cost of standing a little close to a pectoral is much lower than the
           cost of standing far enough away to look like it means something else. */
        return { x: best.screen[0] - box.x, y: best.screen[1] - box.y, r: 26 };
      }
      return null;
    },
    [],
  );

  const roles = muscleMap ? muscleMap.exercises?.[motion.roles] ?? null : null;

  /* THE WALK COUNTS THE SAME LISTS THIS SCENE PAINTS FROM. `firstWalk.js` grew
     beats that say how many muscles are lit and at how many weights, and they
     are counted rather than typed — so it is handed the very object the material
     pass above reads (`roles`) and the mesh set's own muscle roster, instead of
     loading the manifest a second time and being free to disagree with the body
     it is standing next to. `named` is the array's length rather than
     `counts.namedMuscles`: one is a count, the other is a claim about one. */
  /* The movement sets its own watching rate when it arrives, not only when a
     visitor switches to it — a shared link opens straight into a stride. */
  useEffect(() => {
    setSpeed(WATCH_SPEED[motion.id] ?? 1);
    /* AND THE SELECTION GOES WITH THE MOVEMENT. It never did, and that one
       omission is two of the bugs the owner walked into: the muscle picked on
       the old exercise stayed selected on the new one — full opacity, contour,
       everything else dimmed around it — and because the camera leans toward
       `picked.point`, the new movement opened with the frame pushed in at a
       muscle from the movement before it. That is "all six are too zoomed in"
       and "the pressed muscle is still there", and they are one cause.
       ON `motion.id`, NOT IN `selectExercise`. The first version cleared it in
       the click handler and the pick survived anyway, because the exercise also
       changes by hash — a shared link, the back button, the selector's own
       route write. Every one of those lands here; only one of them goes through
       that function. A pick is a question about THIS movement, however the
       movement arrived. */
    setPicked(null);
    setHovered(null);
  }, [motion.id]);

  const walkState = useMemo(
    () => ({
      picked: !!picked,
      roles,
      /* The movement, for the opening line and for how long one clean cycle
         lasts. The walk no longer counts anything off the roster, so `named`
         went with the sentences that used it. */
      movement: { id: motion.id, category: roles?.category ?? null, duration: motion.duration },
    }),
    [motion.id, motion.duration, picked, roles],
  );
  /* ONE WALK PER FLOOR, NOT ONE PER WORKOUT — and this reverses a decision from
     three days ago on purpose.
     The per-movement key was right for the walk that existed then: its beats
     counted THAT movement's muscles and weights, so a visitor who had heard
     about the bench press genuinely had not heard about the swim. This walk
     counts nothing. It teaches one rule — hue is the group, brightness is the
     job — and one discovery, and both are true of all six movements; only the
     opening line differs, and it differs by a word. Replaying twenty-nine
     seconds of it every time somebody tries a different exercise is the app
     explaining itself to a person who has already understood, which is how a
     guide stops being read at all.
     So: taught once, then the six movements are for exploring. */
  const seenKey = BODY_WALK_KEY;
  /* READ ONCE, AT MOUNT. This was `!walkAlreadyDone(seenKey)` evaluated inline on
     every render, which was fine while only the END of a walk filed it — and
     stopped being fine the moment a PAUSE did too. Marking it seen then flipped
     `enabled` false on the very next render, which emptied `beats`, which made
     `beat` null, which made `paused && !!beat` false: the pause killed the walk
     it was supposed to hold, and the Resume control it was supposed to offer
     never rendered. Measured that way — a wheel tick mid-beat left speed
     restored, the guide hushed and no button. Held in state instead, so filing
     the walk as seen is a note for the NEXT visit rather than an instruction to
     this one; a descent and a return remounts the scene and reads it fresh. */
  /* EVERY ARRIVAL, NOT ONCE PER TAB — 2026-09-06. Owner: *"여기서 local storage
     이딴거 쓰지 말고 … body(exercise), fiber, energy, signalling들어오면 guided
     tour시작해"*.
     `walkAlreadyDone` read a `sessionStorage` mark, so the walk played on a
     visitor's first exercise and never again — the note above argues for that,
     and it is the note that loses: the owner is building a thing people arrive
     at repeatedly and each arrival is meant to open with the pass. The escape is
     Pause, which is now always on screen and which stops the walk as well as the
     scene, so a visitor who does not want it is one press from out rather than
     one session from out.
     `walkAlreadyDone` and `markWalkDone` still exist and are still called at the
     end of a walk — what changed is that nothing READS the mark to decide
     whether to run. Left in place deliberately: it is one line to restore if the
     owner wants a per-tab gate back, and deleting a working record to express a
     preference is how the other direction becomes expensive. */
  const [mayWalk] = useState(true);
  const walk = useWalk(mayWalk && pickReady, walkState, resolveAnchor, seenKey, {
    /* §19 — a hand on the scene pauses the walk instead of ending it. On a floor
       whose invitation is "turn this around and press it", a drag must not cost
       the visitor the rest of the explanation. */
    pauseOnInterrupt: true,
  });

  /* ── WHAT A BEAT DOES TO THE PICTURE ──────────────────────────────────────
     `firstWalk.js` says what each beat wants; this is the only place that knows
     how to do it. Kept here rather than in the walk because the walk must stay
     a script — it should be readable as "what the visitor sees and hears", not
     as scene plumbing — and because the two things that resolve at runtime
     (where the effort peaks, which muscle is the biggest prime mover) are the
     scene's to answer.

     Every value is a MULTIPLIER on the shipped role weights, never a
     replacement: the emphasis re-weights the same picture, so hue is never
     touched and a beat can never leave the body drawn in a way the floor's own
     rule does not explain. */
  const [emphasis, setEmphasis] = useState(null);
  /* ON ALREADY, FOR ANYONE WHO HAS BEEN HERE. Revealing the key on the beat
     that states the rule is right for a first visit and wrong for every one
     after it: a returning visitor never sees that beat, so gating the key on it
     meant the three weights went back to being something to infer. Measured
     across five widths with the walk marked seen — the legend was absent at all
     of them. First-timers still meet it on Beat 3, which is the moment it is
     worth reading. */
  /* AND THE KEY OPENS FOLDED FOR EVERYONE, because everyone now meets the beat
     that states the rule. This read the same seen-mark to decide that a
     returning visitor should get the legend already on; with the walk running on
     every arrival there is no returning visitor in that sense. */
  const [legendOn, setLegendOn] = useState(false);
  /* §13: BIG WHILE IT IS BEING TAUGHT, SMALL AFTERWARDS. The key earns the room
     it takes on the beat that states the rule and never again — a permanent
     three-row block in the corner is a reference card on a screen whose subject
     is the body. So it folds to `Muscle role` once the walk is done, and opens
     on a press for anyone who wants it back. A returning visitor gets the folded
     one, because they have already been told. */
  const [legendOpen, setLegendOpen] = useState(false);
  const [walkFocus, setWalkFocus] = useState(null);
  const [seekAt, setSeekAt] = useState(null);

  /** Where in the cycle this movement is working hardest, sampled rather than
      typed. The six `effortAt` curves are hand-drawn and have been retuned more
      than once; a literal here would drift off the peak silently, and Beat 4's
      whole job is to be standing on it. */
  const peakAt = useCallback(() => {
    const steps = 120;
    let best = 0;
    let top = -Infinity;
    for (let i = 0; i < steps; i += 1) {
      const t = (i / steps) * motion.duration;
      const e = motion.effortAt(t);
      if (e > top) {
        top = e;
        best = t;
      }
    }
    return best;
  }, [motion]);

  useEffect(() => {
    const show = walk.show;
    /* NOT WHILE PAUSED, and this cost a real bug. A pick both pauses the walk
       AND changes `walkState`, which rebuilds the beat objects and hands this
       effect a new `show` identity for the SAME beat — so it re-applied the
       stabiliser beat's 0.35x a frame after the pause had just restored it, and
       the visitor kept a slow-motion body with the transport chips reading 1x.
       Resuming re-runs this deliberately: the pause neutralised what the beat
       had set up, so continuing it means setting it up again. */
    if (!show || walk.paused) return undefined;
    /* RELATIVE, so a beat asking for "normal" does not undo the movement's own
       watching rate and a beat asking for slow is slow relative to it. */
    if (show.speed) setSpeed(show.speed * (WATCH_SPEED[motion.id] ?? 1));
    if (show.speed) setPlaying(true);
    if (show.seek === "start") setSeekAt({ t: 0, n: performance.now() });
    if (show.seek === "peak") setSeekAt({ t: peakAt(), n: performance.now() });
    if (show.legend !== undefined) {
      setLegendOn(!!show.legend);
      // Open while the beat that explains it is up — the rule and the key are
      // the same event, and a folded key during that sentence explains nothing.
      if (show.legend) setLegendOpen(true);
    }
    if (show.focus === "primary") setWalkFocus(pickable.current?.()?.point ?? null);
    else if (show.focus === null || show.focus === undefined) setWalkFocus(null);

    if (show.pulse) {
      /* THE RULE, DEMONSTRATED WHILE IT IS READ. Three steps under one sentence:
         each weight in turn comes up while the other two drop, so "brightness
         tells you the job" happens on screen in the seconds it takes to read it.
         Nothing recolours — that would contradict the half of the sentence
         about hue. */
      const steps = [
        { primary: 1.4, secondary: 0.3, stabilizer: 0.22, none: 0.07 },
        { primary: 0.32, secondary: 1.4, stabilizer: 0.22, none: 0.07 },
        { primary: 0.3, secondary: 0.3, stabilizer: 1.45, none: 0.07 },
      ];
      const ids = steps.map((step, i) => setTimeout(() => setEmphasis(step), 1100 + i * 1500));
      ids.push(setTimeout(() => setEmphasis(null), 1100 + steps.length * 1500));
      return () => ids.forEach(clearTimeout);
    }
    if (show.emphasis !== undefined) setEmphasis(show.emphasis);
    return undefined;
  /* THE BEAT, NOT THE OBJECT. `walkState` rebuilds the beat objects whenever it
     changes, so keying this on `walk.show` re-ran the whole set-up for a beat
     that was already up. On the body's first two beats that means `seek:
     "start"` firing again — three times inside the first two seconds of a load
     — and each one yanks the clock back to zero, which snaps a running body
     from mid-stride up to the top of its bounce. That is the "몸이 살짝
     올라간다" on refresh: not the camera, not the rig, not the shadow. The id
     changes exactly when the beat does, which is when this should re-run. */
  }, [walk.id, walk.paused, peakAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The walk ending hands the floor back exactly as it found it. Without this a
     visitor who interrupted on Beat 5 kept the stabiliser emphasis for the rest
     of the visit, and would have been exploring a body that was still making a
     point at them. */
  useEffect(() => {
    if (walk.running && !walk.paused) return;
    setEmphasis(null);
    setWalkFocus(null);
    setLegendOpen(false);
    /* SPEED TOO, and leaving it out was the worst of the three. The discovery
       beat runs the movement at 0.35x to show a muscle lit and not travelling;
       a visitor who picks during that beat ends the walk and keeps the slow
       motion for the rest of the visit, with the transport pill's chips showing
       1x — so the one control that could undo it is lying about the state it is
       in. Handing back what a beat borrowed is the walk's job, not the
       visitor's.
       AND `paused` COUNTS. `walk.running` stays true while a beat is merely
       held, so gating on it alone meant a hand on the scene during the
       stabiliser beat froze the emphasis AND the speed with no way back short
       of resuming. */
    setSpeed(WATCH_SPEED[motion.id] ?? 1);
  }, [walk.running, walk.paused, motion.id]);


  /* The chips arrive showing the movement's own groups (owner, 2026-08-31:
     "the active muscle groups will be highlighted by the selection of the
     muscle groups"): every group holding a role-mapped muscle starts on,
     the rest start dimmed. The viewer's chip presses take over from there
     until the movement changes. */
  const activeGroups = useMemo(() => {
    if (!muscleMap || !roles) return null;
    const groupOf = new Map((muscleMap.muscles ?? []).map((m) => [m.key, m.group]));
    const set = new Set();
    for (const role of ["primary", "secondary", "stabilizer"]) {
      for (const key of roles[role] ?? []) {
        const g = groupOf.get(key);
        if (g) set.add(g);
      }
    }
    return set;
  }, [muscleMap, roles]);
  useEffect(() => {
    setGroupSel(null);
  }, [motion.id]);
  const effectiveGroupSel = groupSel ?? activeGroups;

  const selectExercise = (id) => {
    // The press that asked for a movement wants to watch it — the drawer the
    // rail lives in closes so the stage is clear when the new motion starts.
    setPanelOpen(false);
    const next = canonicalExerciseId(id);
    if (next === exerciseId) {
      setPlaying((p) => !p);
      return;
    }
    // Switching always starts the new movement from its own beginning, playing.
    // The rig reset itself happens in the frame loop, which is the only place
    // that can guarantee it lands before the new motion's first pose.
    setExerciseId(next);
    setSpeed(WATCH_SPEED[next] ?? 1);
    setPlaying(true);
    setResetNonce((n) => n + 1);
    go(`#motion/${next}`, { replace: true });
  };

  /* The reset control left the pill at the owner's ask (2026-08-31); the
     loop wraps on its own, and resetNonce stays wired for a future way in. */

  /**
   * Down one scale, into the muscle that was just picked.
   *
   * Assigning the hash rather than replacing it, so the browser's own Back is
   * the way up: one history entry per scale, and no second implementation of
   * "where was I". The state goes out through serializeHash — the descent is a
   * link someone can send, not a mode this component is now in.
   *
   * `t` is the instant on screen, rounded to the tenth the readout shows, so
   * the URL cannot claim a precision the viewer never saw.
   *
   * The controls stand aside for the length of the cut (cinematic.js). It is
   * begun here and not inside the fibre scene because the beat belongs to the
   * move, not to either end of it — whatever plays the ride starts it, and the
   * chrome is already gone by the time the destination mounts.
   *
   * The ride itself is handed up to the shell (Descent.jsx), because it outlives
   * this component: the scene swap happens in the middle of it. What goes up is
   * everything the wash cannot look up for itself — the name, the span rig.json
   * measured on that mesh, and where on the glass the muscle was.
   */
  /**
   * Every primitive one canonical muscle is drawn from, in the GLB's own names.
   *
   * The roster stores them anatomically — "sternocostal part of left pectoralis
   * major" — and the GLB nodes carry the same string with underscores, which is
   * the conversion this file already makes in the other direction when it looks
   * up a rig chain. Read from the roster rather than by walking the scene so it
   * answers the same way before the meshes have loaded.
   */
  /**
   * Where on the glass a muscle's way-down control is standing.
   *
   * Shared by the magnifier and the selection card so the wash closes around
   * the same place whichever one committed. Falls back to the stage centre,
   * which is honest for the card (it is not standing on the muscle) and was the
   * bug for the magnifier (measured 2026-09-04: the magnifier stood at 401,398
   * and this returned 640,430, so the ride grew from the middle of the window).
   */
  const screenFor = (spot) => {
    const el = spot?.name && document.querySelector(`[data-testid="muscle-lens-${spot.name}"]`);
    const r = el?.getBoundingClientRect();
    if (r) return [r.left + r.width / 2, r.top + r.height / 2];
    const stage = document.querySelector(".press__stage canvas")?.getBoundingClientRect();
    return stage ? [stage.left + stage.width / 2, stage.top + stage.height / 2] : [0, 0];
  };

  const meshIdsOf = (key) =>
    muscleMap?.muscles?.find((m) => m.key === key)?.meshes?.map((n) => n.replace(/ /g, "_")) ?? [];

  const descend = (picked) => {
    /* 4.2 — owner, 2026-09-07: *"누르자마자 모션은 멈춤"*. The body stops on the
       press, so the dive that follows leaves from a still figure and the muscle
       the camera aims at is where it was when it was chosen. */
    setPlaying(false);
    // Read once, at the moment of the choice, and carried: the camera dive and
    // the wash are one shot and must not disagree about whether it is playing.
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Read once: the span, the centroid and the axis all come off the same
    // chain, and three lookups of the same thing can disagree if the rig swaps.
    const fibre = fibreGeometry(rig, picked.name);
    /* AS LONG AS THE RIDE, NOT AS LONG AS A CONSTANT. `SETTLE_MS` is 1800 and
       the ride is longer than that on both variants, so the default brought the
       chrome back on top of a wash that was still running. `Descent.jsx` owns
       the beat lengths and now says how long they add up to. */
    beginCinematic(RIDE_MS(reduced));
    onDescend?.({
      startedAt: performance.now(),
      /* Where the ride LEAVES from, so `main.jsx` keeps the right scene under
         the wash. It was implicit while the body was the only scale that could
         start one. */
      from: "body",
      name: picked.label ?? picked.name.replace(/_/g, " "),
      /* THE SLUG AS WELL AS THE LABEL — decision #24, 2026-09-04. `name` is for
         the card, which is prose; `muscle` is the mesh's own id, which is what a
         destination needs to say which muscle it is inside. They were the same
         field and the destination got the one it could not use. */
      spanM: fibre?.fascicleLengthM ?? null,
      at: picked.screen,
      reduced,
      /* ── BODY → FIBER HANDOFF ────────────────────────────────────────────
         What the floor below needs in order to arrive INSIDE the muscle that
         was chosen, rather than at a generic sarcomere. Every field here is
         read from something that already exists; nothing is invented to round
         the contract out, which is why `axis` and `centroid` can be null.
           muscleKey  the canonical muscle — the vocabulary the roster, the
                      role lists and the drawer all speak. `muscle` above stays
                      the mesh id because that is what the hash already carries
                      and what `fibreGeometry` is keyed by.
           meshes     every primitive this one muscle is drawn from, so the
                      destination can match the shape it is continuing from.
           axis       the muscle's own fibre direction, straight out of
                      `rig.json`'s per-chain fibre line. `FiberScene` can
                      already rotate its model onto a supplied axis and no
                      caller has ever passed one, so this is the value that
                      makes the descent land along the real grain instead of
                      cutting to a fresh scene. NULL when rig.mjs dropped the
                      line (the two end centroids under 10 mm apart) — absent,
                      not zero.
           at/point   where on the glass and where in the world, so the wash
                      closes around the thing that was pressed.
         ORCHESTRATOR HANDOFF: consuming `muscleKey`/`axis`/`role` belongs to
         FIBER and to the shared descent route, which this floor does not own.
         Emitting them is the BODY half and is done here. */
      /* ── BODY → FIBER HANDOFF ────────────────────────────────────────────
         `muscle` STAYS A STRING. It was briefly an object here, shaped to
         `src/handoff.js` — a contract the integration session described, which
         lives in the main checkout and is NOT on this branch. Nothing was
         wrapping the string, so the live consumer took the object straight:
         `main.jsx:251` puts `ride.muscle` into `cameFrom`, `main.jsx:176`
         spreads it back as `state.muscle`, and `DevFiberScene.jsx:138` and :250
         call `.replace()` on it. Every descent from a picked muscle landed on
         "Could not load this scene" — the exact seam the dissolve above was
         built to improve. Taking a peer's description of another branch as the
         state of this one is what did it.
         So the richer fields ride ALONGSIDE rather than inside — and that is
         now the SETTLED shape, not a stopgap. `main.jsx` accepts all three
         spellings (string, siblings, object) and folds these into one
         `state.handoff.muscle` itself, precisely so four floors can merge on
         four different days without a flag day. DO NOT "finish" this by calling
         `makeHandoff` here: flat-and-additive is the only shape that is safe
         while this lane is unmerged, which is exactly the mistake that broke
         the seam the first time. Integration owns the folding.
           muscleKey  the canonical muscle — the vocabulary the roster, the role
                      lists and the drawer all speak. `muscle` above stays the
                      MESH id because that is what the route already carries and
                      what `fibreGeometry` is indexed by.
           meshNames  every primitive this one muscle is drawn from.
           axis       REAL, not null. rig.mjs fits a fibre line per mesh chain
                      and `fibreGeometry` returns its direction; `FiberScene`
                      can already rotate its model onto a supplied axis and no
                      caller has ever passed one. Null where rig.mjs dropped the
                      line (end centroids under 10 mm apart) — absent, not zero.
           phaseName  clock-free on purpose: BODY's clock is one hand-authored
                      movement loop and FIBER's is the Francis protocol, so `t`
                      does not survive the seam and is deliberately not sent.
                      A POSITION does not travel; a NAME does — "arrived during
                      the pressing phase" is true anywhere, where "3.9 seconds"
                      means nothing to a protocol that has never heard of a
                      bench press. But it is BODY'S phase and stays BODY's: the
                      floors below have their own (contraction, recovery), and
                      drawing this one beside a protocol timeline would be two
                      clocks claiming to agree. Whoever draws it says whose it
                      is, or does not draw it.
         ORCHESTRATOR HANDOFF: consuming these belongs to FIBER and to the
         shared descent route, neither of which this floor owns. Emitting them
         is the BODY half and is done here. */
      muscle: picked.name,
      muscleKey: picked.key ?? null,
      muscleLabel: picked.label ?? null,
      muscleGroup: picked.group ?? null,
      role: picked.role ?? null,
      meshNames: picked.key ? meshIdsOf(picked.key) : [picked.name],
      centroid: fibre?.centroid ?? null,
      axis: fibre?.axis ?? null,
      phaseName: hud.phase?.name ?? null,
    });
    /* THE NAME RIDES WITH THE POINT. `descend` is called from two places — the
       canvas pick and `MuscleLens`'s magnifier — and the magnifier's spot is
       often NOT the mesh the `picked` state holds (measured 2026-09-05: picked
       `left_external_oblique`, pressed the pectoralis major's door). So the solo
       has to be told which muscle this ride is for rather than reading a state
       that answers a different question. */
    if (!reduced) setDiving({ point: picked.point, key: picked.key ?? null, name: picked.name });
    go(serializeHash({
      exercise: exerciseId,
      muscle: picked.name,
      scale: "fiber",
      t: +hud.t.toFixed(1),
    }));
  };

  /**
   * How the ride leaves this scale, registered only once the body can actually
   * be descended from.
   *
   * NOT ON MOUNT. `descend` needs a mesh, and the meshes do not exist until two
   * GLBs have loaded, been skinned and been given their roles. Registering
   * before that starts the film's first beat against a scene that cannot answer
   * it, and nine seconds later the ride descends into no muscle and carries an
   * exercise with no selection down three more scales. ride.js starts the beat
   * when this lands, which is why the first shot is exactly as long as it says
   * it is however cold the cache was.
   *
   * `descend` is reached through a ref because it closes over the rig, the
   * exercise and the instant on the HUD, and all three change after mount — an
   * effect that captured it once would descend with `rig` still null.
   */
  descendRef.current = descend;
  /* NO RIDE HOOK. `setLeaveBody` let `director/ride.js` drive the body scene's
     own way down while the film played; the film, the director and the ride all
     went on 2026-08-30 when the owner deleted them. Rex's branch was cut before
     that and still registers the hook. What it wrapped is gone with it — the
     descent a visitor drives is `<Descent>`, mounted by `main.jsx`, and it never
     needed this. */

  /**
   * The way down, opened: pause, click any muscle, and it says what it is.
   *
   * ONE function, two triggers, because for a long time there was only one
   * trigger and it was a keyboard shortcut nothing on the page announced.
   * Measured on a fresh load of `#motion/bench_press` on 2026-08-17: `/inspect/i`,
   * `/ctrl.?d/i` and `/fiber/i` were all false against the rendered text, and
   * the fourteen buttons were playback and layer controls. The scale descent is
   * what objective.md calls this project's most distinctive educational
   * advantage, and a first-time viewer could not reach it at all.
   *
   * The chip in the top bar is that trigger, and it is deliberately the same
   * `↓ <scale>` control the fibre scale already uses to offer the cell — one
   * grammar for "down one level" at every scale rather than a third idea here.
   * It stops one step short of the fibre scale because the body scale is the one
   * that needs a target: descending into no muscle in particular is not a thing
   * this app can honestly draw, so the chip opens the pick and the pick offers
   * the descent.
   */

  // Throttle HUD writes; useFrame runs at 60fps and React does not need that.
  useEffect(() => {
    const id = setInterval(() => setHud({ ...hudRef.current }), 100);
    return () => clearInterval(id);
  }, []);

  // What this scene tells the Anatomy Assistant (shell/assistantContext.js),
  // at the HUD's own 10 Hz: the movement by name, its phase and clock, the
  // muscles the role map lights, and the pick — none of which the hash holds
  // while the scene plays. Effort stays out: it is the illustrative curve,
  // not a number this app stands behind. Cleared on unmount.
  useEffect(() => {
    setSceneContext({
      currentView: VIEW.motion,
      selectedExercise: motion.label,
      selectedMuscle: picked ? [picked.label, picked.group].filter(Boolean).join(" · ") : readableSlug(state?.muscle),
      activeMuscles: describeRoles(roles, muscleMap),
      motionState: `${playing ? "playing" : "paused"} at ${speed}× · phase: ${hud.phase.label} · t = ${hud.t.toFixed(1)} s of ${motion.duration} s per repetition`,
      exerciseMode: roles?.category ?? null,
    });
  }, [motion, roles, muscleMap, picked, state?.muscle, playing, speed, hud]);
  useEffect(() => () => setSceneContext(null), []);

  if (rig === false) {
    return <div className="fatal">Could not load /mapping/rig.json — run `node build/rig.mjs` in ../anatomy-mesh-set.</div>;
  }
  if (!rig) return <div className="fatal">Loading rig…</div>;

  const camera = cameraFor(motion.camera);
  const props = new Set(motion.props ?? []);
  const exercises = muscleMap?.exercises ?? {};

  return (
    <main className="press">
      <AppShell
        scale="body"
        /* THE MOVEMENT IS THE HEADING HERE, under a small BODY —
           `docs/20260905-fix/body.md` §4: "Human Body Explorer처럼 기능명을 큰
           제목으로 넣기보다는 현재 보고 있는 운동을 title로 하는 게 좋아." Read
           off the registry, never typed, so a movement added later names itself. */
        title={motion.label}
        /* AND THE HEADING PICKS THE MOVEMENT — `docs/20260905-fix/body.md` §12.
           Same `exercises`, same `activeId`, same handler as the drawer's rail
           three hundred lines below, so the two doors into this choice cannot
           disagree about what is selected or where Idle goes. The tour is NOT
           re-armed on a change: `hpe.guide.bodyWalk` is one key for the floor,
           not one per movement, which is the lane's own decision and this
           control must not quietly undo it. */
        titleMenu={{
          exercises,
          activeId: motion.id,
          onPick: (key) => {
            if (key === "idle") go("#");
            else selectExercise(key);
          },
        }}
        drawer={<>
          {/* The ← Back to Anatomy button left at the owner's ask (2026-08-31):
              the unified rail's Idle row is that same door, one list up. */}
          <section>
            {/* The unified rail (owner, 2026-08-31): Idle is the front door,
                the movements are these windows. Selecting one closes the
                drawer — the press that asked for a movement wants to WATCH
                it, not admire it through a blur. */}
            <MotionList
              exercises={exercises}
              activeId={motion.id}
              onPick={(key) => {
                setPanelOpen(false);
                if (key === "idle") go("#");
                else selectExercise(key);
              }}
            />
          </section>

          <section>
            <p className="label">Search</p>
            <input
              className="input"
              placeholder="Biceps, deltoid…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </section>

          <section>
            <p className="label">Muscle group</p>
            {/* The explorer's chips, doing here what they do there: dim and
                highlight. They arrive set to this movement's active groups. */}
            <GroupChips
              groups={muscleMap?.groups ?? {}}
              selected={effectiveGroupSel ?? new Set(Object.keys(muscleMap?.groups ?? {}))}
              onChange={setGroupSel}
            />
          </section>

          {/* THE `Activation` KEY LEFT THIS DRAWER, 2026-09-05.
              It was a second role key on a screen that now has one, and the two
              did not agree. `roleLegend.test.js` says in as many words which
              screen this one mirrors: App.jsx's `ROLE_STYLE`, the EXPLORER's
              encoding, at opacity 1 / 0.55 / 0.25 — and its header notes that
              the motion route "has no legend", which was true when it was
              written. The motion route has one now, on the stage, and it draws
              from this floor's own `ROLE_OPACITY` (0.85 / 0.7 / 0.58). So the
              drawer was explaining another screen's ladder using this screen's
              three words, behind a hamburger, while the stage explained the
              real one in the open.
              Nothing is lost: `roleLegend.test.js` still guards the explorer's
              legend where it lives, and the stage key's dots take their alpha
              from the same constant the meshes do, so it cannot drift from the
              picture it explains. */}

          {/* The Explore and About-this-data sections left this drawer at the
              owner's ask (2026-08-31): both will live behind a button in this
              window, designed later. What left is not gone from the app — the
              descent door stays in the control pill (the 320px scar), and the
              honesty claims and the CC BY-SA credit still stand on the fiber,
              cell and signalling drawers; the future button must carry them
              back here (TODO.md pins it). */}
        </>}
      />

      {/* No transport bar here any more (owner, 2026-08-30: "delete this bar
          for all motions"). The name, state and phase live in the drawer's
          header; play/pause stays in the control pill below, which also
          carries the descent's door — the one control that must never lose
          its visible entrance (the 320px scar in the old press.css). Scrubbing
          the body clock left with the bar; the deeper scales keep theirs. */}

      <div className="press__stage" ref={stageRef}>
        {/* THE SCENE SAYS WHAT IT IS, restored with the merge — Rex's branch is
            cut from before it and his canvas carries no name at all. Measured on
            all four scales when this was written: a bare <canvas> is announced
            as nothing and is not skipped either, so a reader meets a hole.
            Labelled rather than hidden, because a 3D scene existing is
            orientation a reader should have.

            ON THE CANVAS, NOT ON ITS CONTAINER, and that difference was found
            the hard way: R3F does not forward `role`/`aria-label` props to the
            canvas element, it puts them on the wrapper — and `role="img"` makes
            every descendant presentational, which took 6 of 6 plates and 4 of 5
            badges out of the tree on the cell scale. `onCreated` reaches
            `gl.domElement`, which is the canvas and nothing else.

            THE MOVEMENT'S OWN NAME, not "the repetition": running and freestyle
            are a gait and a stroke cycle, and the label is read off `motion` so
            a seventh movement names itself. This is the only sentence a screen
            reader gets here, since the muscle name plate is `aria-hidden`. */}
        <Canvas
          onCreated={({ gl }) => {
            gl.domElement.setAttribute("role", "img");
            gl.domElement.setAttribute(
              "aria-label",
              `Three-dimensional scene of the body performing ${motion.label.toLowerCase()}. The phase and the controls beside it are the text of what it is doing.`,
            );
          }}
          /* NO `shadows` — 2026-09-06. Owner, walking it: *"몇몇 운동들은 상체만
             약간 밑에 shadow가 있거든 shadow 필요없어 다 지워"*, and then
             *"그림자는 필요없어 아예 평평한 씬에 깊이 추가 안해도 돼 일단은 body만"*.
             It was added the day before at the owner's own word, from the same
             audit that measured this floor as the only one with neither shadows
             nor an environment. Both were true and only one of them was wanted:
             the environment stays, the shadow map goes. A partial shadow under a
             trunk — which is what it drew, since only opaque meshes cast and
             those are the roled ones — reads as a smudge under the chest rather
             than as ground contact, and that is what the owner saw.
             FIBER KEEPS ITS OWN. *"일단은 body만"* is explicit, and that floor's
             shadows solve a different problem with its own measurement behind
             it. */
          camera={{ position: camera.position, fov: camera.fov, near: 0.01, far: 100 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true }}
        >
          {/* THE ROOM. `anatomyStyle.js` generates it and the deep scales have had
              it since they were built; this floor never did, so its surfaces
              reflected nothing and every muscle was lit by two directional lobes
              alone. Mounted here rather than reasoned about: the same file that
              describes the problem calls the fix "matte clay" and applies it
              downstairs only. */}
          <AnatomyEnvironment />
          <ambientLight intensity={1.15} />
          <directionalLight position={[3, 5, 4]} intensity={2.5} />
          <directionalLight position={[-4, 2, -2]} intensity={1.0} />

          {/* THE CATCHER PLANE WENT WITH THE SHADOWS — 2026-09-06. It was a
              `shadowMaterial` mesh, invisible except where a shadow fell, put
              there because the floor is a `gridHelper` and lines cannot receive.
              With nothing casting it draws nothing, so it is a mesh and a
              draw call for an effect that is gone. Removed rather than left
              armed-but-empty, which is the state the two deep floors were found
              in and which cost an afternoon to establish. */}
          {props.has("floor") && <Floor />}
          {props.has("ground") && <ScrollingFloor ref={propRefs.ground} />}
          {props.has("bar") && <PullUpBar height={motion.barHeight ?? 2.28} />}
          {props.has("bench") && (
            <Bench
              top={motion.benchTop ?? 0.45}
              centre={motion.benchCentre ?? 0.2}
              length={motion.benchLength ?? 1.05}
            />
          )}
          {props.has("barbell") && (
            <group ref={propRefs.barbell}>
              <Barbell />
            </group>
          )}
          {props.has("water") && <Water level={motion.waterLevel ?? 0.92} />}

          <Suspense fallback={<Loader />}>
            <Body
              rig={rig}
              /* Only while the ride is running, and named by the ride itself —
                 see `descend`, which is the one place that knows which muscle
                 this dive is for. */
              /* NO SOLO ON THE RIDE — 2026-09-07. `diving?.key` dissolved every
                 muscle but the chosen one the instant the press landed, so by
                 385 ms (measured) the bench, the bar and the body were paper and
                 one small muscle floated on it while the "zoom" enlarged nothing.
                 The owner: *"지금 화면 그대로 멈추고 들어가는거야"* — the frame the
                 visitor is looking at, unchanged, enlarged. The wash closing on
                 the muscle is `Descent`'s job and comes last. */
              solo={null}
              motion={motion}
              exerciseRoles={roles}
              groupColors={muscleMap?.groups ?? null}
              playing={playing}
              speed={speed}
              skeletonOpacity={skeletonOpacity}
              muscleOpacity={muscleOpacity}
              groupSel={effectiveGroupSel}
              query={query}
              onPhase={(phase, t, effort, lap) => { hudRef.current = { phase, t, effort, lap }; }}
              onPick={setPicked}
              propRefs={propRefs}
              resetNonce={resetNonce}
              seekTo={state?.t ?? null}
              onPickable={(fn) => {
                pickable.current = fn;
                setPickReady(true);
              }}
              onSpots={setSpots}
              pickedKey={picked?.key ?? null}
              emphasis={emphasis}
              seekAt={seekAt}
              onHover={setHovered}
              hoveredKey={hovered?.key ?? null}
            />
            {/* THE PICKED MUSCLE SAYS WHAT IT IS — canon B8 on Rex's input.
                NAME ONLY, ON THE MUSCLE. What job it is doing is the selection
                card's line, not this plate's: the plate stands on the anatomy
                and has to stay small enough not to become the thing you look at.
                It also used to carry a role line that could never render —
                `roles[picked.name]` indexed an exercise record keyed
                {label, category, source, primary[], secondary[], stabilizer[]}
                with a GLB MESH id, so it was `undefined` on every pick and
                `.press__name-role` was styled dead CSS. The role now comes off
                the pick itself (`picked.role`, set from `mesh.userData.role`)
                and is spent in the card where there is room for it. */}
            {/* The pick outranks the pointer: once a muscle is chosen its name
                stays put, so moving the mouse across the body to read other
                names does not keep stealing the plate off the thing you are
                studying. With nothing chosen, the plate follows the pointer and
                is the floor's whole "this is pressable" affordance. */}
            <HoverName hover={picked ?? hovered} role={ROLE_WORD[(picked ?? hovered)?.role]} />

            {/* THE WAY DOWN, AND UNTIL NOW THIS SCALE HAD NONE A VISITOR COULD
                REACH. `to-fiber` was real and worked and lived inside the `⌘D`
                inspector, so the app's premise — body, fibre, cell, signalling —
                was broken at its first step behind a developer keystroke.
                NOT ON IDLE. Owner, 2026-09-03: *"idle에서는 안들어가도 돼"*, and
                it is also the honest answer — with no movement chosen there is no
                muscle in play, so `usedSpots` returns nothing and nothing draws.
                The guard is the empty list, not a check for the word. */}
            <MuscleLens spots={lensSpots} onGo={(spot) => descend({
              name: spot.name,
              /* THE CANONICAL MUSCLE RIDES DOWN, not just the mesh that drew the
                 door. Everything below this seam wants to know WHICH MUSCLE was
                 entered, and a primitive id cannot answer that. */
              key: spot.key,
              role: spot.role,
              group: spot.group,
              label: spot.label,
              point: spot.point,
              screen: screenFor(spot),
            })} />
          </Suspense>

          <MotionCamera
            preset={camera}
            nonce={resetNonce}
            dive={camDive}
            /* The walk's framing outranks the pick's while it is running — Beat 4
               leans toward the biggest prime mover, and a pick made before that
               must not fight it. */
            focus={walkFocus ?? picked?.point ?? null}
          />

          <OrbitControls
            makeDefault
            enabled={!panelOpen}
            enableDamping
            dampingFactor={0.08}
            /* NO `target` PROP. `MotionCamera` above eases the aim — into a
               movement's framing, and into a picked muscle on a descent — and
               `OrbitControls` writes its `target` on every frame it is given
               one. Handing it the preset's target puts the aim back where the
               preset says it is, so the ease moves the camera and the target
               snaps home under it and the two fight. The three scales below all
               leave the aim to the ease for the same reason, and
               `tourGrammar.test.js` holds this one because the body was the
               scale that had it wrong. `makeDefault` still lets the ease reach
               the controls' own target when it needs to. */
            /* 0.05 WHILE DIVING — the dive stops at 0.22 from the muscle's centroid
               and `controls.update` would shove it back out to 0.5 every frame. */
            minDistance={0.5}
            maxDistance={8}
          />
          {/* The direction cube, KEPT AND NO LONGER STANDING ON THE EXHIBIT.
              Its faces are view presets and that is genuinely useful, so it is
              not deleted — it appears while the View control is open, which is
              the moment somebody is thinking about where the camera is. On the
              stage full time it was the loudest piece of chrome in the top
              right of every frame, and it reads as a CAD viewport rather than
              as a thing a visitor is meant to touch. Judged from the shots,
              not from the code. */}
          {/* THE CUBE TURNS AROUND WHAT THE CAMERA IS LOOKING AT — 2026-09-06.
              Owner: *"cube누르면 막 줌 아웃하고 그러는데 그러지 말고 그냥
              default랑 동일하게"*. It was not zooming out; it was turning around
              the ORIGIN. `OrbitControls` here is given no `target` — `MotionCamera`
              owns the aim and writes it every frame, with a note above saying
              why — so the gizmo fell back to (0,0,0) while every preset frames
              something around chest height. Pressing a face therefore swung the
              camera onto a point a metre below the subject and kept its
              distance to THAT, which lands further from the body and reads as a
              zoom out.
              `onTarget` is drei's own hook for exactly this: the same point the
              preset aims at, so a face press changes the DIRECTION and nothing
              else. Distance, fov and framing all survive. */}
          <GizmoHelper
            alignment="top-right"
            margin={[78, 78]}
            onTarget={() => new THREE.Vector3(...(camera.target ?? [0, 0, 0]))}
          >
            <GizmoViewcube
              faces={["Right", "Left", "Top", "Bottom", "Front", "Back"]}
              color="#f7f8fa"
              textColor="#161c24"
              strokeColor="#c3cad6"
              hoverColor="#2f6fd0"
            />
          </GizmoHelper>
        </Canvas>

        {/* THE ⌘D INSPECTOR WAS DELETED HERE, 2026-09-05, under §18.
            It listed `mesh` / `bound to` / `hit` — a GLB id, a skinning chain
            and a raw coordinate — which is the catalogue vocabulary this floor
            spent the rest of the spec getting away from, and §18's list of what
            a visitor may press has eight entries and does not include it. It
            was also bound to ⌘D, the browser's bookmark chord, so the way in
            was a keystroke a visitor is likely to press meaning something else
            entirely.
            Nothing is lost that a visitor could reach: the muscle's name is on
            the plate, its group and role and action are on the card, and the
            way down is the card's own button. What went with it was the last
            place on this floor that spoke in mesh ids. */}

        {/* §4's `Pause  Home`, and it is the SHARED control rather than this
            floor's own. The three deep floors have mounted `<Ways>` since it was
            written and the body never did — measured on the merged build, this
            scale's `[data-testid="ways"]` was empty. Four floors drawing their
            own pause is four definitions of one button, and the glyph, the
            accessible name (a bare "❚❚" was being read out) and `aria-pressed`
            are all solved in that file already.
            `prevScale("body")` is null, so no climb-out button is drawn and what
            is left is exactly the pair the spec's diagram shows. */}
        <Ways
          state={{ exercise: exerciseId, scale: "body" }}
          playing={playing}
          onPlaying={setPlaying}
          /* The walk's pause and the movement's share one control now (owner:
             "pause / resume으로 합침"), and this floor draws the orientation
             cube, so the stack starts below it. */
          tourPaused={walk.paused}
          onResumeTour={walk.resume}
          belowCube
        />

        {/* THE VIEW CONTROL WENT, 2026-09-06. Muscle and skeleton opacity are
            fixed while a movement plays — the sliders were a way to take the
            picture apart, and this floor's job is to show one assembled. The
            orientation cube it was hiding is now drawn unconditionally, which
            is what the front door does. */}

        {/* The arc that stood here went with `.press__beat`, 2026-09-05 — see
            `press.css` and the timeline block below. The half of its note worth
            keeping is why none of this is coloured: the pair before IT had three
            tints for eighteen phase names, so eleven fell through to grey. */}

        {/* THE GUIDE STANDS ON THE STAGE, over the canvas and under the chrome.
            Inside `press__stage` because that is the box its anchors are
            measured against and the box it must not walk out of; `guide.css`
            clamps it to 40 px of the edges for the same reason. */}
        {/* NO `visible={walk.running}` ANY MORE. That prop is what deleted the
            character the moment it stopped talking, and the owner caught it
            exactly that way, 2026-09-02: *"body에서 캐릭터 조금 듣다가 swimming
            으로 넘어갔거든 근데 캐릭터 사라짐"*. Switching workouts is a
            pointerdown, a pointerdown is an interrupt, an interrupt ends the
            walk — and ending the walk unmounted the guide.
            The three deep scales never passed this prop at all, so they were
            already right in intent and wrong in effect: `Guide` also bailed on a
            null anchor. Both are fixed there; this one only had to stop lying
            about what "visible" means. With no beat the character walks to its
            home corner and waits, hushed. */}
        {/* BELL DOES NOT GO QUIET — owner, 2026-09-06: *"얘는 죽지 않아 항상
            마지막에는 뭔 액션으로 안내해줘야돼"*, and again for this floor
            specifically after arriving from another one. `walk.line` is null the
            moment the pass runs out, and null is what made the character
            furniture.
            SO THE STANDING LINE IS A FALLBACK, NOT A BEAT. It is not in the
            storyboard: a beat would be replayed by a press and counted by the
            pace gates, and this is neither — it is what Bell says when there is
            nothing else to say.
            TWO OF THEM, BECAUSE THE ACTION CHANGES. With nothing picked the next
            move is to pick; with a muscle picked the card is already offering
            `Go inside`, so the sentence points at the card rather than repeating
            the invitation the visitor has already taken. `any` is the BODY
            lane's word and it earns its place: the pass has just taught that
            muscles have different roles, and without it "pick one" reads as
            "pick a bright one". */}
        <Guide
          /* The selection card takes this corner when a muscle is picked; Bell
             steps left of it rather than standing on it. Measured, not guessed —
             see `Guide.jsx`. */
          avoid=".press__card"
          at={walk.at}
          line={
            walk.line ??
            /* "PICK" IS THE WRONG VERB — owner, 2026-09-07: *"Pick any muscle is
               wrong bcz we are using a 돋보기"*. The magnifier sits on the
               muscles; pressing it is the whole gesture. */
            (picked
              ? "Press the magnifier to go inside."
              : "Press the magnifier on a muscle to go inside.")
          }
        />

        {/* THE TIMELINE STRIP THAT STOOD HERE WAS DELETED 2026-09-07 — owner: *"exercise들에서
            밑에 timeline bar있잖아 그거 지워 그냥 지워"*. Phases, the scrub and the now-mark went
            with it; the body and the glow still read the one clock. */}

        {/* THE SELECTION CARD — what you picked, what part it plays here, and
            the way into it. Three lines and a control, deliberately: the plate
            on the muscle carries identity in place, and everything that needs
            room to be read lives here instead of growing on top of the anatomy.
            Bottom-right because the transport is bottom-centre and the view
            sliders are bottom-left, so this is the one free corner and it does
            not cover the body at any width the stage is drawn at. */}
        {/* THE ROLE KEY. Revealed on the beat that states the rule and left
            standing afterwards, because it is the one thing from the walk still
            worth having once the walk has gone.
            ONE HUE AT THREE WEIGHTS, never three colours. Three coloured
            swatches would teach the exact thing this floor spends its whole
            narration un-teaching — that colour means role — and the drawer's
            old `Activation` key did precisely that. The ladder here is ink at
            the three role weights, which is the channel the body actually uses,
            and the note underneath says what the colour is for instead. */}
        {/* THE ROLE KEY WAS DELETED HERE, 2026-09-06, at the owner's word while
            walking the app. `body.md` §13 asked for it and this reverses that —
            the owner's own list is first canon and the md is second.
            What replaces it is the hover tag: pointing at a muscle now says
            `Pectoralis major · Primary`, so the role is read off the thing it
            belongs to instead of off a card in the corner that a visitor has to
            carry in their head while looking somewhere else. */}

        {/* The floor's own `Resume tour` button was deleted 2026-09-06 — `<Ways>`
            draws that slot now, merged with Pause, so the two things that stop
            and start are one control instead of two in different corners. */}

        {/* NO CARD FOR A MUSCLE THIS MOVEMENT DOES NOT USE. It used to open one
            reading `Not one of the muscles this movement uses` with a `Go inside`
            under it — an answer nobody asked for, attached to an invitation into
            a muscle the floor has nothing to say about. Pressing one now names
            it on the plate and stops there. */}
        {picked?.role && (
          <aside className="press__card" data-testid="selection-card">
            <p className="press__card-name">{picked.label ?? picked.name.replace(/_/g, " ")}</p>
            {/* GROUP FIRST, THEN ROLE — the same order the picture answers them
                in: the hue told you where it lives before you pressed it, the
                brightness told you what it is doing. An uninvolved muscle has a
                group and no role, and the separator goes with the missing half
                rather than leaving a dangling dot. */}
            <p className="press__card-role">
              {[picked.group, ROLE_WORD[picked.role]].filter(Boolean).join(" · ")}
            </p>
            {/* The muscle's own line where somebody has written one, the role's
                otherwise. Never both: two sentences is a paragraph, and the
                card's whole job is to be a caption. */}
            <p className="press__card-says">
              {MUSCLE_SAYS[motion.id]?.[picked.key] ?? roleSentence(picked.role, motion.id)}
            </p>
            {/* THE `Go inside →` BUTTON IS GONE — 2026-09-07, owner: *"근데 나는 ui
                상으로는 카드가 안보여, 뭐 어쨋든 지워"*. It was a second door on a
                floor whose door is the magnifier — the same reason ENERGY's
                `See the network →` went (*"문은 돋보기 하나"*). The card stays as
                the caption it is; `descend` is reached through `MuscleLens`. */}
          </aside>
        )}

        {/* THE TRANSPORT PILL IS GONE TOO. Pause moved to `<Ways>` and the rate
            chips were deleted, which left a floating white lozenge with nothing
            in it — furniture for controls that are not there any more. */}
      </div>

    </main>
  );
}

export { allMotions };
