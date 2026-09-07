/**
 * The signalling scale, as the shell renders it: three published arms on the
 * network's own clock.
 *
 * THIS FILE IS THE SEAM. `signallingBinding.js` turns the export into drawn
 * quantities and `signallingGeometry.js` turns those into matrices; neither can
 * reach a screen on its own, and this project's one recurring defect is exactly
 * the gap between them — seven times something has been computed, carried, unit
 * tested and reached no pixel. So there is one frame loop here, it calls
 * `drawnAt` and hands the result straight to `model.update`, and there is no
 * second path by which anything could arrive at the geometry.
 *
 * ALL THREE ARMS OR NOTHING. If any of the three scenarios fails to load this
 * draws nothing and says why. There is deliberately no two-arm fallback: without
 * `fowler_rest` the network's own settling is on screen as though the exercise
 * had caused it, and without either bout the whole sentence — different doors,
 * same room — has only one door in it.
 *
 * NEITHER ARM IS CHOSEN FOR YOU — THE VIEWER CHOOSES, AND THAT IS A DIFFERENT
 * THING. Arriving from a bench press still does not select the resistance arm:
 * `ResistanceExercise = 1.0` is a dimensionless scalar held for 45 minutes and
 * nothing in the archive calibrates it against %1RM or %VO2max
 * (`provenance.inputs.input_surface`), so picking an arm from the exercise you
 * came from would be a mapping we do not have, made silently. What the app may
 * not do from a hash, a person may do with a switch. Both arms are loaded always
 * and the run is the same run in every state; the switch changes which of the two
 * is DRAWN, and it opens at "both", which is the picture that shipped before
 * this control existed.
 *
 * THAT IS ALSO THE POINT OF THE SCREEN. Two doors, one trunk: you cannot see
 * that a door is a door until you shut it and the column under it stays on its
 * baseline tick. The panel used to say this in a paragraph; the pass showed it
 * to a visitor who could not touch it; the switch is where a visitor does it.
 *
 * THE CLOCK IS THE NETWORK'S OWN, AND IT IS NOT THE BODY'S. `t` in the hash is
 * seconds, as everywhere else, but the run those seconds index is the authors'
 * 45-minute protocol rather than the push-up's 12.98 s. That is the payload:
 * the signal walks the network layer by layer and at ten minutes the median node
 * has completed about a tenth of its change. The run is finite and the tab is
 * not, so it loops, and the loop is NAMED — wrapping puts every node back to its
 * baseline in one frame, which is a recovery that never happened.
 */

import { SHOW_FIGURES, SHOW_SOURCES } from "../uiMode.js";
import { arrivedFromInside } from "../crossing.js";
import { hasWebGL, NoWebGL } from "../webgl.jsx";
import { armFor } from "../workoutMapping.js";
import EvidenceBadge from "../Evidence.jsx";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { Html, OrbitControls } from "@react-three/drei";
import { LIGHTS, CONTROLS, SCENE } from "../anatomyStyle.js";
import AnatomyEnvironment from "../anatomyEnvironment.jsx";
import { loadScenario } from "../scenarioData.js";
import { useCameraTransition } from "../fiber/useCameraTransition.js";
import Gizmos from "../gizmo/Gizmos.jsx";
import Handle from "../gizmo/Handle.jsx";
import { createRunClock, stepRunClock } from "../runLoop.js";
import AppShell from "../shell/AppShell.jsx";
import Ways from "../shell/Ways.jsx";
import DrawerSlot from "../shell/DrawerSlot.jsx";
/* `beginCrossing` is not imported here any more, and the bug it was part of is
   fixed by that. This file imported it and never called it: leaving the cell
   and leaving the signalling were silent hash writes with no crossing wash,
   while every other way between scales had one. `Ways.jsx` fires it now, in
   the one place all four scales share, so the direction cannot be forgotten on
   one screen and remembered on the others. */
import { SILENT_MS, readingMs, stepsOf, useOpenerStanding, useTour, plainLine } from "../tour.js";
import { holdTour } from "../tourControl.js";
import { useCoverOpen } from "../crossing.js";
import {
  SCENARIOS,
  drawnAt,
  heroReading,
  heroPair,
  readable,
  routesOf,
  secondsPerMinute, heroProgress } from "./signallingBinding.js";
import { BANDS, ORBIT_LIMITS, STANDING, fusedMarks, pullFor, restFor } from "./signallingGeometry.js";
import { buildHeroLevel, heroLift, SPELLED, platesShown, ARC_R } from "./heroGeometry.js";
import { FORM_R } from "./heroForms.js";
/* THE ONE DOOR EVERY WAY BETWEEN SCALES GOES THROUGH — `scaleRoute.js` names
   its callers, and the closing strip below joins `Ways` and `WayIn` on that
   list rather than writing a hash of its own. */
import { HERO_IDS } from "./heroNetwork.js";
import { RUN_SECONDS_PER_SECOND } from "./signallingTour.js";
import SourceLine from "../trace/SourceLine.jsx";
import { PAPERS } from "../trace/papers.js";

/**
 * HOW LONG THE PLAIN LAP RUNS BEFORE THE PASS SPEAKS.
 *
 * The owner's arrival grammar, 2026-09-06: *"1. 한번 쭉 보여주고 (main) 이 때는
 * toggle이고 뭐고 없어 그냥 left header + right pause skip / 2. 그다음 guided tour /
 * 3. now main again with all the toggles"*.
 *
 * A WHOLE LAP, BECAUSE "한번 쭉" IS A LAP. `SILENT_MS` (1.6 s) is what stood here
 * and it is a different promise: it says "about to start", not "watch this once".
 *
 * FIVE SECONDS, NOT FORTY-FIVE. At the run's own rate a lap is 44.9 s, and with
 * the 32.9 s pass behind it that is 77.8 s before a visitor may touch anything.
 * The owner, asked: *"너무 길어 signalling timeline없애고 훨씬 빨리 하게 해"*, and
 * then, of ENERGY and this floor together: *"기본적으로 한 5초 정도로 맞추고
 * 싶은데"*. So the intro lap gets its own rate — `runSeconds / INTRO_S` — and the
 * pass and the standing loop keep theirs. Speeding the WHOLE clock would have
 * re-timed every beat the SIGNALS lane composed against the run, and the beads
 * with them. (It was 12 for one commit; the owner's number is 5.)
 *
 * The 0-45 minute axis went in the same breath, which is what makes this honest:
 * there is no longer a clock on screen for the faster lap to contradict.
 */
const INTRO_S = 5;
/* THE PASS THIS FLOOR PLAYS. `signallingTour` is still imported above for its
   ONE constant and nothing else — the storyboard it exports is the census
   scene's and stays where it is as that scene's record. `signalsTour` is
   written against the thirteen this scale actually draws. */
import { signalsTour, playsOnArrival, SIGNALS_CAMERA } from "./signalsTour.js";
import { veilOf } from "./runVeil.js";

/* WHAT ENERGY DRAWS AMPK IN — a copy of `cellChainGeometry.js`'s AMPK_REST and
   AMPK_LIT (2026-09-06, via the orchestrator; that floor lerps between them by
   its `response` every frame). Copied rather than imported so this floor does
   not load the other's geometry module for two hexes; if ENERGY recolours
   AMPK, this pair has to follow. The handoff carries `response`, so the colour
   held here is the exact albedo the viewer was looking at when they pressed —
   fifth brief §3. */
const AMPK_HANDOFF = Object.freeze({ rest: "#7f5f7b", lit: "#b587af" });
const SEAM_TAU_S = 0.22;
import SignallingReadout from "./SignallingReadout.jsx";
import "../fiber/fiber.css";
import "./signalling.css";
import "../scaleHead.css";
import Guide from "../guide/Guide.jsx";
import { useAim } from "../guide/useAim.js";
import { useWalk, walkAlreadyDone } from "../guide/useWalk.js";
import { heroWalk } from "./heroWalk.js";

/* HOW FAST THE RUN IS REPLAYED — one model minute per wall second — MOVED TO
   `signallingTour.js` AS `RUN_SECONDS_PER_SECOND`, unchanged in value and for one
   reason: a beat covers `speed * that * ms`, so the storyboard, this frame loop
   and the test that measures what a beat's line narrates all have to be holding
   the same number. It was `MINUTES_PER_SECOND * secondsPerMinute` here, and a
   test that retyped the product could have gone green over a scene that had
   changed it. It is still ours and still the one number here that is not the
   model's; it is still named on screen by the lit replay chip. */

/**
 * Every count this scale shows, on the thing in the picture it is about.
 *
 * Each names the band it is anchored to, and each was a row or a paragraph in
 * the panel saying the same thing about marks the reader had to find by colour.
 * `split-*` carry the arm swatch already (lane 6's anchors), so putting the
 * count on them makes the callout the legend AND the number — which is what the
 * panel's two-column heading was doing from 600 px away.
 *
 * TWO MORE ARRIVED ON 2026-08-25, and both came out of `SignallingReadout`:
 *
 * - `doors` — where the bout enters, and how many first steps that is. It reads
 *   the ARM, so pressing a chip changes the sentence at the top of the canvas
 *   and the fan of lit edges under it at the same time. The panel's version
 *   ("Resistance enters at integrin and TGFB; endurance at B_AR and ROS") named
 *   two of resistance's nine doors and was about to be contradicted by a picture
 *   that had just started drawing all nine. All of them are in the record.
 * - `outputs` — the widest of the twelve gaps, on the band where the two arms'
 *   marks land on top of each other. It sat 600 px away in a paragraph, where
 *   `gate-evidence-survives` had already measured it at 254 px from the nearest
 *   badge against a 250 px bound.
 *
 * ONE PLACE PER QUANTITY. The rows these replace are deleted from
 * `SignallingReadout`, not duplicated: R3F commits the canvas subtree in its own
 * root, so a number printed in both places can differ by a tick, and the cell
 * scale shipped exactly that for ten minutes (CellScale.jsx). That is also why
 * `widestOutputGap` moved into `drawnAt` rather than being computed here — one
 * producer, whichever root reads it.
 */
/* The two plates that fold on a narrow stage — see the comment at <Gizmos>. */
const NARROW_FOLD = new Set(["split-resistance", "split-endurance"]);
/* The two whose NAME is a two-arm claim, not just their number. `reached by
   both` and `twelve outputs … apart` are comparisons; with one arm drawn there
   is no second thing to be apart from. See the filter at <Gizmos>. */
const COMPARES_ARMS = new Set(["trunk", "outputs"]);

/* NO `gizmoItems`. It built the old picture's six callouts out of bands,
   counts and arm buckets — "two workouts enter here", "the cell's own
   relay" — and the drawing is twelve named objects now, so a plate is a
   name tag that `heroGeometry.js` hangs on one of them and the sentence
   behind it lives in the record. Flagged, grepped (no caller anywhere in
   `src/`), removed, grepped again. Its `whyFor` helper went with it; the
   two transition effects that spent a day stranded inside it after its
   `return` had already been moved out on 2026-08-31. */

/**
 * THE THREE ARM STATES, BACK AS A CONTROL — canon D2ⓐ, 2026-08-31.
 *
 * They went on 2026-08-30 with the chip row ("toggle들은 다 없애자 <- guided
 * pass에만 집중해") and what went with them was the only thing a visitor could
 * do on this scale. The handover note in `TODO.md` records the same owner
 * saying what the objection actually was — *"toggle이건 화면 어딘가에 toggle로
 * 넣어 나는 패널이 싫은거야"* — so it is the drawer that was refused, not the
 * switch. This file's own header states the reason the switch has to exist at
 * all: two doors, one trunk, and you cannot see that a door is a door until you
 * SHUT it and the column under it stays on its baseline tick. Until now that was
 * a thing to watch a pass do.
 *
 * EACH POSITION NAMES ITS OWN STATE, which is the §5 rule that shapes the whole
 * control. A switch has no order — a visitor may arrive at "Resistance" from
 * "Both" or from "Endurance" — so a label like "hide the other one", or any
 * wording that asks a reader to remember the frame before, is a claim about a
 * sequence the control does not have. Three absolute names, and the lit one is
 * what is drawn.
 *
 * AND NONE OF THEM IS PRESELECTED FROM THE EXERCISE UPSTAIRS. It opens at
 * `both` on every arrival, including a descent from a bench press: the header
 * says at length why that mapping does not exist, and a default is a claim as
 * much as a sentence is. `descendedArm` still orders the PASS's beats — that is
 * the picker upstairs reporting its own choice, which the plate's record says in
 * those words — and it does not move this.
 *
 * ORDER IS FIXED AND NOT THE VISITOR'S. `both` first because it is the whole
 * picture and where the scale opens, then the two arms in the order the canvas
 * draws them, resistance's column at x < 0 and endurance's at x > 0. Not led by
 * the descent, however the pass is: a switch whose positions move between two
 * visits is a different control each time.
 */
/* NO `ARMS_SHOWN`. The three chips it named — Both / Resistance / Endurance —
   went with the switch on 2026-08-31: the exercise upstairs decides which bout
   is drawn. The note above is kept because it is the record of why the order
   was fixed and why nothing was preselected, and `arm` below carries who
   reversed the second half of that and on what grounds. The list itself is
   gone rather than left standing — a const nothing reads is a control waiting
   to be wired back by someone who did not read the reversal. */

/* `reading`, not `drawn` — see CellScale.jsx: `drawnAt`'s result inside the
   frame loop is already called `drawn`. */
/** Scratch vector for the guide's projection — one per module, never
    allocated in the frame loop. */
const _guideV = new THREE.Vector3();

/**
 * HOW FAR THE VIEWPOINT SWAYS, and why it sways rather than turns.
 *
 * drei's `autoRotate` was tried first and measured well — pixels changed over
 * nine seconds went 8.4% to 14.4% — but it never stops. Three minutes in, a
 * visitor is looking at the back of the network, and this layout's meaning is
 * positional: the doors are at the membrane, the cascade runs downward, the two
 * arms are left and right. A camera that eventually shows the other side has
 * taken the sentence away to buy the parallax.
 *
 * So it is bounded. The azimuth swings SWAY_ARC either side of the framing that
 * `SIGNALLING_CAMERA` was chosen for and comes back, which is enough travel for
 * a near node to visibly cross a far one and not enough to re-frame anything.
 * The period shares no factor with the node rock's, so the two never lock.
 */
/* 0.300 -> 0.080, 2026-09-06. ±17° was a third of the way round a network whose
   owner's §10 says *"3D network를 구경하는 것보다 topology를 읽는 것이 우선"*;
   ±4.6° is the parallax the audit asked for without the diagram ever turning
   into a different diagram. Still inside `ORBIT_LIMITS` by a wide margin
   (`signallingClaims.test.js`). */
const SWAY_ARC = 0.080;
const SWAY_PERIOD = 23;

/**
 * Swings the viewpoint a little and brings it back.
 *
 * An audit put "no camera movement at all" among the three confirmed reasons
 * this scale reads flat against the fibre: nothing in the frame moved except
 * thirteen forms rocking in place, and a rotation in place changes a form's
 * shading without changing where anything IS. Motion parallax is the strongest
 * depth cue that works without stereo and this scene had none of it.
 *
 * A sway costs no honesty. It is the VIEWPOINT and not the model — it says
 * nothing about any node, any edge or any quantity, and the same picture is
 * there whether it moves or not.
 *
 * IT YIELDS. `active` goes false the moment a viewer drags, because the note on
 * the controls below is explicit that a viewer who turns the scene keeps that
 * turn; taking the camera back afterwards would be the thing D6 was right about
 * wearing a different hat. It also stands down during a demonstration, where
 * the camera belongs to the storyboard.
 */

/**
 * WHAT EACH DRAWN THING SAYS WHEN A VISITOR PRESSES ITS RING.
 *
 * The owner's words are already quoted a few hundred lines below, on the ring
 * condition itself: *"each elements clickable (and they each show what they do
 * when clicked)"*, and "a drawn object a visitor cannot ask about is the G1
 * complaint again". The rings became pressable; what they show was never
 * written. Measured 2026-09-04: thirteen rings on this scale, thirteen silences.
 *
 * NOT THE RETIRED STORYBOARD. `beats` was emptied on purpose and that argument
 * stands — a narrator over a picture already telling the story in order is what
 * canon D2 removed. One sentence per part, played only when that part is asked
 * about, is a label with a verb in it.
 *
 * TWO OF THESE ANSWER A QUESTION THE WHOLE DESCENT WAS LEAVING OPEN. A novice
 * read of the guided tour asked why anybody trains at all — *"저는 왜 지치는지는
 * 알고 나왔는데, 왜 훈련하는지는 모르고 나왔습니다"* — and the two outputs the
 * network already draws, protein synthesis and cell growth, are that answer.
 * They were on screen the whole time with nothing attached to them.
 */
/** The three outcomes' short names for the zone legend — the owner's sketch. */
const ZONE_NAME = {
  Protein_Synthesis: "Protein",
  Cell_Growth: "Growth",
  Mitochondrial_Biogenesis: "Mitochondria",
};

const SAYS = {
  /* REWORDED 2026-09-07 — owner (last pass, L4): *"이런 워딩들 모든 카드 한번 보고 고쳐"*,
     and *"lifting running 말고 endurance resistance로"*. Plain, one idea each. */
  ResistanceExercise: "Resistance exercise — lifting, push-ups, squats: the muscle works against a load.",
  EnduranceExercise: "Endurance exercise — running, cycling, swimming: the muscle works for a long time.",
  integrin: "A doorway that opens when the cell is pulled on. Resistance exercise pulls.",
  B_AR: "A doorway that opens to adrenaline, which rises with hard endurance exercise.",
  ROS: "Reactive oxygen — a by-product of working muscle. A little of it is a signal, not damage.",
  RhoA: "A relay that carries the pull signal inward from the doorway.",
  AMPK: "The energy sensor — on when fuel runs low or calcium rises. Here it is one relay among many.",
  JNK: "A relay both workouts push on — the first place their two routes touch.",
  PGC_1a: "The switch that tells the cell to build more mitochondria.",
  S6: "Part of the protein-building machinery. On means the cell is making protein.",
  Protein_Synthesis: "Making new protein. This is how a muscle gets bigger.",
  Cell_Growth: "The muscle cell itself getting larger — the result of the protein above.",
  Mitochondrial_Biogenesis: "Building more mitochondria — the parts that burn fuel with oxygen. This is how a muscle gains stamina.",
};

/* `pullFor` lives in `signallingGeometry.js` since pass 3, beside the camera it
   pulls and the contract test that measures it. */

function CameraSway({ active, standing }) {
  const home = useRef(null);
  useFrame(({ camera, clock }) => {
    if (!active) {
      home.current = null;
      return;
    }
    /* AND IT SWAYS ABOUT THE RESTING SHOT, NOT ABOUT WHEREVER THE CAMERA WAS.
       Measured 2026-09-06 at 390x844: it captured the camera the frame it came
       on — the pass's last frame — and wrote that radius every frame after, so
       the ease toward the pulled-back `standing` never landed and the outer
       nodes stayed cut at the edges. The resting shot is the one home. */
    if (home.current && home.current.from !== standing) home.current = null;
    /* IT STARTS FROM WHERE THE CAMERA IS AND FROM ZERO — both halves measured
       at the hand-back on 2026-09-06. The phase used to be the wall clock, so
       the first swaying frame stood wherever the sine happened to be — up to
       the whole arc away from the frame the pass had just left; and it aimed
       at the origin while the resting shot aims at `STANDING.lookAt`, a 0.18
       re-aim in one frame. Photographed as the picture dropping 55 px the
       moment the tour ended. Tonight's rule is that the tour's last frame and
       the resting frame are one shot, so the sway now begins AT that frame and
       drifts out of it. */
    if (!home.current) {
      const [tx, ty, tz] = standing.lookAt;
      const [cx, cy, cz] = standing.camera;
      home.current = {
        r: Math.hypot(cx - tx, cz - tz),
        y: cy,
        a: Math.atan2(cx - tx, cz - tz),
        t0: clock.elapsedTime,
        target: [tx, ty, tz],
        from: standing,
      };
    }
    const { r, y, a, t0, target } = home.current;
    const t = clock.elapsedTime - t0;
    const angle = a + SWAY_ARC * Math.sin((t / SWAY_PERIOD) * Math.PI * 2);
    camera.position.set(target[0] + Math.sin(angle) * r, y, target[2] + Math.cos(angle) * r);
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
}

/**
 * Which drawn node a raycast hit belongs to, or null.
 *
 * WALKS UP RATHER THAN MATCHING DOWN. A form is a group of lobes, barrels and
 * cristae built by `heroForms.js`; the raycast lands on whichever child mesh the
 * ray met, and only the group above it carries the tag. Bounded by the scene
 * root, so a hit on something untagged returns null instead of climbing out.
 */
function nodeIdAt(object) {
  for (let o = object; o; o = o.parent) {
    const role = o.userData?.role;
    if (typeof role === "string" && role.startsWith("node-")) return role.slice(5);
  }
  return null;
}

function SignallingSceneContent({
  onClear = null,
  clearNonce = 0,
  /** Where the guide should stand, in canvas pixels. A ref and not a
      callback: sixty projections a second must not become sixty renders. */
  guideRef = null,
  /** WHERE THE GUIDE MUST NOT STAND — the three outcomes' ending arcs, projected
      like `guideRef`. See the frame loop that writes it. */
  clearRef = null,
  /** WHICH PART THE GUIDE IS STANDING BESIDE — a REF holding an anchor id, set
      by the page's walk. A ref and not a value so a beat changing does not
      re-render the canvas. It wins over the tour's own focus because the walk
      is what is speaking on this scale; the tour's beats are empty here. */
  guideAnchor = null,
  arms,
  routes,
  /* The arm the exercise upstairs maps to, computed by `SignallingScale` where
     the route lives. Passed rather than derived here: this component never sees
     `state`, and reaching for it is what broke the scene — the error boundary
     caught it and said so, and 329 node tests did not. */
  descendedArm,
  /** The route's `entry` — see `signalsTour.js` for the whole contract. The
      only value that changes anything is `"cold"`, which skips the pass. */
  entry = null,
  /** `state.ampk` from the crossing — `{ fraction, response, run }` frozen by
      the floor above at the press, or null for a cold link. Keyed on the
      record, not on `entry`: no record, no purple to hold, so the floor opens
      in stone rather than inventing a response. */
  handedAmpk = null,
  /** The paper-coloured sheet over the stage, driven from the frame loop. */
  veilRef = null,
  onRead,
  startAt,
  playing,
  reading,
  arm,
  replay,
  onTourLine,
  onTourArm,
  /** Told when the arrival cascade — canon D5's whole introduction — starts and
      finishes. Reported by `Gizmos`, which runs it and owns its length. */
  onIntro,
  /** Bumped when the page's Skip is pressed during the plain lap. */
  skipIntro = 0,
  /** The storyboard's opening sentence — the one beat that belongs to no part,
      which names the picture rather than any piece of it. Reported up so the
      page can stand it before anybody has pressed anything (canon G1). */
  onOpener,
  /** THE VIEWER'S SHOW CONTROL — "both" (default), "resistance", "endurance".
      It hides a stream; it never changes what the other one is, and it never
      changes what is READ. Both arms are loaded and both are sampled every
      frame either way, so switching is a change of drawing and not of data. */
  show = "both",
  /** `{ t }` in run seconds when the viewer drags the timeline, else null. */
  /** The node the viewer has selected, or null. Dims what it is not wired to. */
  selected = null,
  /** The node under the pointer, or null. Only decides where a ring is drawn. */
  hovered = null,
  /** Told which node the pointer is over, so the page can name it in one line. */
  onHover,
  /** Told when a node is pressed, so the page can open or clear the selection. */
  onSelect,
}) {
  /* Read once at mount, like the fibre scale's label fold: a viewer who has
     rotated their phone has not asked the picture to rearrange itself. */
  /* READ ONCE, IN STATE — reviewed pass 4: as a plain expression this was
     re-evaluated on every resize render and, once it fed the model memo, a
     phone rotation rebuilt the whole scene mid-visit. And BY ASPECT, not
     width: the 428–430 px phones fell through a 420 px query to the desktop
     drawing at pull 2.3 — the picture §11 rejected. Under 7:10 is a phone
     held upright; a portrait tablet (3:4) keeps the wide grid. */
  const [narrowStage] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-aspect-ratio: 7/10)").matches,
  );
  /* The wiring comes off the resistance arm's file, and any arm would do: the
     three scenarios are the same network under different inputs, so the edges
     are identical in all of them. Read here rather than inside the geometry so
     the geometry keeps taking data and never fetching it. */
  const edges = arms?.resistance?.network?.edges ?? null;
  /* THE TWELVE, AND THE HUNDRED AND EIGHT BEHIND THEM. `buildSignallingLevel`
     drew every node the archive ships on five compartment shelves; the owner,
     having watched it: *"120개는 절대 넣지마"*. `heroGeometry` draws twelve as the
     things they are and the rest as quiet dust. The old builder is NOT deleted —
     it is still what `signallingGeometry.test.js` measures the compartment
     contract against, and that contract is what says a type the archive adds
     cannot vanish from a picture. */
  const dust = useMemo(
    () => Object.keys(routes?.names ?? {}).filter((id) => !HERO_IDS.includes(id)),
    [routes],
  );
  /* THE STAGE'S LAYOUT GOES IN — pass 4, P0: a narrow stage builds the narrow,
     tall grid (`heroGeometry.layoutOf`), read once at mount like the fold. */
  const model = useMemo(() => buildHeroLevel(routes, edges, dust, { narrow: narrowStage }), [routes, edges, dust, narrowStage]);
  /* WHAT CASTS AND WHAT ONLY RECEIVES, told to the tree once — `FiberScene.jsx`
     runs the same effect on its model, and the reason is the same: this builder
     has a dozen mesh sites plus twelve forms built elsewhere, and threading two
     booleans through all of them is a dozen chances to miss one.
     ONE THRESHOLD, READ BOTH WAYS. The twelve forms are opaque and cast. The
     membrane leaflets (0.34) and its sheet (0.09), the link paths (0.5–1.0),
     the background crowd (0.62) and the shadow ground all sit at or under
     `opaqueEnough` and catch instead — which is `anatomyStyle.js`'s "a
     translucent sheath casting a hard shadow is dirt" rule, and is also what
     keeps a field of texture specks from each throwing a speck of shadow. */
  useEffect(() => {
    model.group.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      /* AND RECEIVING IS THE OPPOSITE OF CASTING HERE, WHERE ON THE FIBRE IT IS
         EVERYTHING. `anatomyStyle.SHADOW` carries the argument: the fibre's
         subject is big overlapping cylinders and one fibre's shadow landing on
         the next is most of what the map buys there, but nothing on this scale
         is more than a dozen shadow-map texels across, so a form receiving its
         own shadow buys a staircase and no picture. What catches the shadow is
         what the shadow is FOR — the ground behind, and the wrapper. */
    });
  }, [model]);
  useEffect(() => () => model.dispose(), [model]);
  /* WHERE THE DRAWING SITS ON THE GLASS — the same tool `FiberScene` has as
     `__fiberBox`, and the same one `MotionScene` reports as `__rigDebug().screen`.
     Projected here rather than handed out as world coordinates, because the
     question this exists to answer is "does the picture fit its stage", and that
     is a screen question: `docs/what-good-looks-like.md`'s rule about nothing
     leaving the body is a rule about the frame. Read-only; nothing reads it in
     the app. */
  const _boxV = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (typeof window === "undefined") return;
    window.__heroScreen = () => {
      /* TWO BOXES, AND ONLY ONE OF THEM IS A RULE. `all` is everything the group
         holds, which includes the hundred-and-eight background crowd and the
         membrane sheet — both are meant to run past the frame, and measuring
         them says nothing. `named` is the twelve forms plus the two inputs, the
         things this scale is about and the things its plates point at. That is
         what has to fit. */
      const project = (v) => { _boxV.copy(v).project(camera); return [_boxV.x, _boxV.y]; };
      const span = (pts) => {
        const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
        for (const [x, y] of pts) {
          min[0] = Math.min(min[0], x); max[0] = Math.max(max[0], x);
          min[1] = Math.min(min[1], y); max[1] = Math.max(max[1], y);
        }
        return { min, max };
      };
      const box = new THREE.Box3().setFromObject(model.group);
      const corners = [];
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) corners.push(project(new THREE.Vector3(x, y, z)));
      const named = (model.anchors ?? []).map((a) => project(new THREE.Vector3(...a.at)));
      return { all: span(corners), named: named.length ? span(named) : null };
    };
    /* One node's place on the canvas, in canvas pixels — for `tests/one-off/`,
       which has to press a node the way a hand does. Read-only, as above. */
    window.__signalsProject = (id) => {
      const at = model.anchors?.find((a) => a.id === id)?.at;
      if (!at) return null;
      _boxV.set(...at).project(camera);
      return _boxV.z > 1 ? null : { x: ((_boxV.x + 1) / 2) * size.width, y: ((1 - _boxV.y) / 2) * size.height };
    };
  });
  useEffect(() => () => { delete window.__heroScreen; delete window.__signalsProject; }, []);

  /* THE HASH'S INSTANT STARTS THE CLOCK, CLAMPED HERE AND ANNOUNCED IN THE
     PANEL. Clamped rather than left to the wrap below, for the reason the cell
     scale measured in a browser: the wrap subtracts one span per frame, so an
     instant off the end walks back into the grid over a handful of frames and
     arrives reading in-range. A snap over seven frames is still a snap. The
     clamp is honest only because SignallingReadout prints the request it could
     not honour. */
  const runSeconds = arms.resistance.grid.tEnd * secondsPerMinute;
  const seed = Math.min(Math.max(startAt ?? 0, 0), runSeconds);
  const clock = useRef(createRunClock(seed));
  /* Re-seeded when the hash's instant changes, not only on mount: the scene does
     not remount on a hash change, so seeding on mount alone means editing `@t`
     while already here moves nothing and says nothing. */
  useEffect(() => {
    // Lap preserved across the re-seed, for the reason CellScale.jsx carries:
    // the count is of seams watched, and a drag of the timeline is not an
    // un-watching of them. The clock's shape stays runLoop.js's.
    clock.current = createRunClock(seed);
  }, [seed]);
  /* THE DRAG-SEEK EFFECT WENT WITH THE AXIS — 2026-09-06. It read a `seek` prop
     the page set from the timeline's range, and the timeline is deleted. `seed`
     above is untouched: that one is a fact about the ADDRESS, which is why the
     two were separate in the first place. */
  /* THE GUIDED PASS, AND THE THREE THINGS IT HANDS BACK.
   *
   * Declared AFTER the re-seed above on purpose: both fire on mount and the last
   * write to the clock wins, so the storyboard's own first instant has to be the
   * one that survives or the pass opens wherever the hash pointed.
   *
   * The camera, the chip and the replay speed all come back on their own when it
   * ends — including when a viewer ends it, which is the only way it ends that
   * matters. The camera because `useCameraTransition` re-arms on a changed
   * destination and `tour.camera` goes null; the other two because they are READ
   * off the current beat every render rather than pushed into state. With no copy
   * of the viewer's setting held anywhere there is nothing to restore, and
   * nothing to forget to restore. `FiberScene` keeps its pass's speed in a
   * `useState` and needs an effect to clear it; the only reason this scene does
   * not is that the arm and the speed were already props here. */
  /* NO STORYBOARD ON THIS SCALE — 2026-08-31, and it is not a deletion, it is a
     job that moved.
   *
   * `signallingTour` was written against the census: its beats focus `doors`,
   * `trunk`, `nucleus`, `outputs`, `split-resistance` — anchors that no longer
   * exist — and each carries a camera framed on a compartment band that is no
   * longer there. Left running against the twelve it did visible damage:
   * screenshotted at 1280x900, the pass drove the camera into a close framing of
   * a band that is gone and printed "A few doors light from both sides" over an
   * empty middle. A storyboard pointing at a picture that has been redrawn does
   * not degrade quietly.
   *
   * AND THE REDRAWN PICTURE DOES NOT NEED ONE. The owner's spec for this screen
   * describes the explanation as the animation itself — exercise starts, the
   * input lights, the signal spreads through the network, the outcomes come up.
   * That is the RUN, which this scale already plays: forty-five minutes of the
   * bout, with every node's brightness its own activity at that instant. A
   * second narrator on top of a picture that is already telling the story in
   * order is the thing canon D2 spent a hundred rounds removing.
   *
   * `signallingTour.js` is NOT deleted. It is the record of what the census
   * scale said, `tourGrammar.test.js` still holds its shape, and whatever
   * narration the twelve eventually want will be written against them rather
   * than salvaged out of a storyboard about bands. Empty here means the four
   * states collapse to one on this scale: it arrives, and it plays. */
  /* THE WHOLE-SCALE PASS STAYS EMPTY, and it has to. Filling it put this scale
     straight back into `stage === "tour"` — measured 2026-09-04: pressing PCr
     played ATP's sentence, because the tour had taken the whole array and was
     reading it in order, which is the narration that was retired. What the rings
     need is a STEP each, not a storyboard. */
  /* THE PASS IS BACK, 2026-09-05, AND IT IS NOT THE ONE THAT WAS STOOD DOWN.
     The note above is kept whole because its diagnosis was right and still is:
     `signallingTour`'s beats focus `doors`, `trunk`, `nucleus`, `outputs` —
     anchors this scene does not have — and running it against the thirteen drove
     the camera into a framing of a band that no longer exists. That storyboard
     is still not played and is still not deleted.
     WHAT CHANGED IS THAT SILENCE STOPPED BEING FREE. The paragraph above argues
     the redrawn picture needs no narrator because "the RUN is the explanation".
     It is a good argument and the SIGNALS brief overrules it for one reason a
     run cannot answer: this floor's subject is a COMPARISON, and a comparison
     has to be pointed at. The run shows both arms travelling; it does not say
     that the doors they enter are different, that the routes meet again at JNK,
     or that the two endings land almost level. Those are the three sentences the
     floor exists for and the picture cannot speak them.
     `signalsTour` is written against the thirteen, moves the camera only between
     framings of nodes that exist, and drives the clock monotonically from the
     first sample to the last in one pass — see its header for how sync is a
     property of the data here rather than something tuned. */
  /* THE PASS TAKES THE RESTING SHOT'S PULL, ONCE, AT MOUNT — a viewer who
     rotates a phone mid-pass has not asked the storyboard to re-plan, so this
     is read the way `narrowStage` is, and the beats memo does not depend on
     `standing`. `pullFor` is the same function `standing` reads. */
  const { size: stageAtMount } = useThree();
  const tourPull = useRef(null);
  if (tourPull.current === null) tourPull.current = pullFor(stageAtMount, narrowStage);
  const beats = useMemo(
    () => (playsOnArrival(entry) ? signalsTour(descendedArm, { pull: tourPull.current, narrow: narrowStage }) : []),
    [descendedArm, entry],
  );
  /* THE STORYBOARD, CUT INTO THE PARTS IT IS ABOUT — canon D2ⓐ. `stepsOf`
     carries why; the short of it is that every beat already names its subject,
     so the pass was always a queue of demonstrations played at a viewer, and
     this hands each one its own control instead. On this scale that mattered
     twice over: it is the one screen with NOTHING to press — no chip, no
     toggle, no level — so before this a visitor's only move was to interrupt.

     `opener` is the beat that belongs to no part — the wide sentence naming the
     picture, which `signallingTour.js` had to declare because every beat here
     carries a focus. It is what the scale says about itself before anybody
     presses anything (canon G1), so it stands rather than being played. */
  const { opener, finale } = useMemo(() => stepsOf(beats), [beats]);
  /* ONE STEP PER PART, BUILT FROM `SAYS` RATHER THAN CUT OUT OF A STORYBOARD —
     see the note on `SAYS`. `useTour` is handed `steps.find(s => s.id === open)`,
     so a ring plays its own sentence and nothing plays when none is open. */
  const steps = useMemo(
    () =>
      (model.anchors ?? [])
        .filter((a) => SAYS[a.id])
        .map((a) => ({
          id: a.id,
          beats: [{ focus: a.id, line: SAYS[a.id], ms: readingMs(SAYS[a.id]) + 1200 }],
        })),
    [model],
  );
  /* THE FOUR STATES, IN THE OWNER'S OWN WORDS (2026-08-31):
       1. 화면으로 들어가면 아무런 텍스트 없이 (Full Animation the default)만 보여
       2. tour로 각각의 element들을 설명해 → automatic tour
       3. tour로 그다음에 전체적으로 어떻게 working 하는지 animation을 통해 보여줘
       4. 다시 아무런 텍스트 없이 + go to next level + each elements clickable

     `FiberScene` carries the long form of this note. The short of it: the tour
     is AUTOMATIC and runs first, and canon D2ⓐ's "조작기가 먼저" governs state 4
     rather than the tour. States 2 and 3 are one uninterrupted run of the
     storyboard, because `stepsOf`'s `finale` is a contiguous tail. */
  const [stage, setStage] = useState("silent");
  /* AND NOT UNDER THE COVER — 2026-09-07, see `useCoverOpen`. Measured: this
     scene's Skip was up at 1,852 ms after the press and the ring opened at
     2,614; the lap's first 0.8 s ran unseen. Held at 0, seeked to the run's
     first instant when the cover is off, INTRO_S counted from there. */
  const coverOpen = useCoverOpen();
  /* THE TOUR WAITS FOR SOMETHING TO SAY, AND NOTHING ELSE.
     Each scale first guarded this on whatever it happened to be loading —
     `scenario` here, `reading` on the cell, `routes` on the signalling — three
     different proxies for one fact. On the cell that proxy was simply wrong:
     `reading` is the 10 Hz readout snapshot, its interval hands React the SAME
     object every tick, so after the first commit the state never changes and on
     2026-08-31 it measured null for the whole visit. The cell arrived, drew its
     five rings, and never said one word — 46 s watched in a browser, `sentence`
     null at every mark, states 2 and 3 missing entirely and no gate red.
     `beats` IS the precondition: it is what the tour plays, every scale builds
     it from its own load, and a scale with no storyboard has no state 2 to
     enter. One fact, checked where it is used. */
  useEffect(() => {
    if (stage !== "silent" || !coverOpen) return undefined;
    if (beats.length) clock.current = createRunClock(0);
    /* NO STORYBOARD MEANS NO STATE 2, NOT NO STATE 4 — and that was a real
       defect, found 2026-09-01 by watching this scale for 42 s and seeing it
       say nothing and change nothing. `beats` is deliberately empty here, so
       the guard above returned early forever and the scale never left `silent`:
       every consumer of `stage === "main"` was dead for the whole visit. A
       scale with nothing to narrate should arrive and hand itself over, which
       is exactly what state 4 is. */
    /* A LAP, NOT A BEAT OF SILENCE. `SILENT_MS` is still the right length for a
       floor with nothing to show first; this one shows the whole run once. */
    const start = setTimeout(
      () => setStage(beats.length ? "tour" : "main"),
      beats.length ? INTRO_S * 1000 : SILENT_MS,
    );
    return () => clearTimeout(start);
  }, [beats, stage, coverOpen]);

  /* THE PAGE OWNS THE INTRO'S SKIP AND HANDS THE PRESS DOWN — see its own note.
     A count, not a flag: `useTour`'s reason, and here it also means a second
     press during a re-entry is a second press. */
  useEffect(() => {
    if (skipIntro) setStage("main");
  }, [skipIntro]);

  useEffect(() => {
    onOpener?.(opener.find((b) => b.line)?.line ?? null);
  }, [opener, onOpener]);
  /* WHICH PART IS OPEN, AND HOW MANY TIMES IT HAS BEEN ASKED FOR. A count, not
     a flag, for `useTour`'s own reason: pressing the same ring twice is one
     visitor asking twice, and re-arming on an unchanged value re-arms nothing. */
  const [open, setOpen] = useState(null);
  const [asked, setAsked] = useState(0);
  const press = (id) => {
    setOpen(id);
    setAsked((n) => n + 1);
  };
  /* A clear from the page (background click, L2): the demonstration ends, the bell
     unsays, the plate goes. */
  useEffect(() => {
    if (!clearNonce) return;
    setOpen(null);
    onTourLine?.(null, null, { unsay: true });
  }, [clearNonce]);
  /* The anchor the current beat is about — plate highlight and scene beacon. */
  /* Whether the viewer has taken the camera. One way: once it is theirs it
     stays theirs for the visit. Lives beside the control it gates rather than
     up in the page — the last time state was declared away from its reader in
     this repo the page rendered blank and `vite build` was green about it. */
  const [turned, setTurned] = useState(false);
  /* WHICH NODE THE WALK IS NAMING — see `CellScale.jsx` for the whole reason.
     The words and the drawing have to be about the same thing in the same
     second, and this scale's storyboard is empty, so nothing was lighting while
     the character talked. */
  const [beaconId, setBeaconId] = useState(null);
  const [tourFocus, setTourFocus] = useState(null);
  /* The world point the walk is naming, so the beacon can stand on it. Derived
     from the id rather than carried as a coordinate — a typed point is the fit
     that expires the next time the layout moves, which is what this scale's own
     camera gate exists to forbid. */
  const beaconAt = useMemo(
    () => (beaconId ? model.anchors?.find((a) => a.id === beaconId)?.at ?? null : null),
    [beaconId, model],
  );
  /* THE PART THE VISITOR PRESSED, WHICH ON THIS SCALE IS NOT ALWAYS THE PART
     THE BEAT POINTS AT. The trunk's demonstration ends on its answer, and that
     beat carries `part: "trunk"` with `focus: "outputs"` — the beacon walks down
     to the band where the answer IS while the demonstration is still the
     trunk's. So the words hang off this anchor and the light off `tourFocus`,
     which is why `Gizmos` takes the two as separate props. Its anchor hangs the
     words; its label heads them. */
  const openAnchor = model.anchors.find((a) => a.id === open) ?? null;
  /* A PAUSE IS SOMETHING THE VIEWER DID. `playing` opens false on a shared
     `@t` link — the run "arrives stopped" at the instant the link names — and
     reviewed before it shipped, `paused: !playing` would have frozen the pass
     at its first beat on exactly those arrivals, against tonight's rule that
     every arrival opens with the pass. So the hold counts only once `playing`
     has been true this visit: an arrival-stopped run lets the pass play (as it
     always did), and the first press of Pause after that holds it. */
  const everPlayed = useRef(playing);
  if (playing) everPlayed.current = true;
  const heldByViewer = !playing && everPlayed.current;
  const tour = useTour(
    stage === "tour" ? beats : open ? (steps.find((s) => s.id === open)?.beats ?? []) : [],
    {
      /* See `useTour`: `enabled` coming back on is not enough, because a press
         set `stopped` and left `started` at the wall-clock the first run began
         at. The count clears both. */
      nonce: stage === "tour" ? 0 : asked,
      enabled: (stage === "tour" || !!open),
      /* PAUSE HOLDS THE PASS — tonight's rule 2, pass 2 of 2026-09-06. `useTour`
         freezes the storyboard and shifts its clock so Resume continues at the
         same beat; the frame loop below stops writing the run clock on the SAME
         flag (`passAt`), so the network cannot run on under a frozen sentence
         and the two cannot disagree. `heldByViewer` is `playing` from `Ways`,
         minus the arrival case — see where it is set. */
      paused: heldByViewer,
      skippable: stage === "tour",
      onLine: (line) => onTourLine?.(line, openAnchor?.label ?? null),
      onFocus: setTourFocus,
      /* Clamped to the run like the hash's instant, and the lap carried across for
         the reason the re-seed above gives: the count is of seams a viewer has
         watched, and a storyboard seeking is not an un-watching of them. */
      onSeek: (t) => {
        const to = Math.min(Math.max(t, 0), runSeconds);
        clock.current = createRunClock(to);
      },
    },
  );
  /* THE TOUR HANDS THE SCALE OVER WHEN IT RUNS OUT — or when a visitor reaches
     for something, which `INTERRUPTS` turns into the same ending.

     THESE TWO EFFECTS SPENT A DAY AS DEAD CODE, and that is the part worth
     writing down. They were pasted into `gizmoItems`' `whyFor` helper, AFTER its
     `return` — a plain function with no `stage`, no `tour`, no `setStage` and no
     `onIntro` in scope. Unreachable code is not a syntax error and Vite does not
     type-check, so the build was green and all 373 node cases passed while this
     scale had no way to END its tour and no way to tell the page it had.
     Measured in a browser 2026-08-31: the last beat finished at 41.4 s and its
     sentence was still on the picture at 55 s with `WayIn` still hidden — a
     scale a visitor cannot leave, arrived at through a green gate. The lesson is
     not "read more carefully". It is that a state machine whose transitions sit
     somewhere they can never run is indistinguishable, from every gate we own,
     from one that works. Only opening it found this. */
  useEffect(() => {
    if (stage === "tour" && !tour.running) setStage("main");
  }, [stage, tour.running]);
  useEffect(() => {
    onIntro?.(stage);
  }, [stage, onIntro]);
  /* `tour.beat`, NOT `beats[tour.index]`. The array holds the beat as written;
     the player holds the beat as PLAYED, which is what a scene has to obey — a
     held beat is frozen by overriding its speed, and looking the original up
     again threw that away. Measured: the conclusion beat kept advancing under a
     hold that was supposed to freeze it. */
  const beat = tour.beat;
  /* THE SEAM'S COLOUR AND HOLD — fifth brief §3. The tint is ENERGY's own lerp
     at the handed `response`; `k` is 1 through `arrive` and `reveal` (the
     pull-back, 4.6 s, wordless as of tonight) and then eases to 0 with a
     0.22 s time constant — 95 % gone in about 650 ms, inside the owner's
     500–800. Mutated in place so the frame loop allocates nothing. */
  const seam = useMemo(() => {
    const response = Number(handedAmpk?.response);
    if (!Number.isFinite(response)) return null;
    const tint = new THREE.Color(AMPK_HANDOFF.rest).lerp(new THREE.Color(AMPK_HANDOFF.lit), Math.min(1, Math.max(0, response)));
    return { tint: `#${tint.getHexString()}`, k: 0 };
  }, [handedAmpk]);
  /* The switch reaches the picture HERE and nowhere else, and so does the pass —
     one seam, two writers, and the pass only while it is running. `show` sets two
     `visible` flags and touches no matrix, so neither can move a mark. Re-applied
     when the model is rebuilt, or a new geometry would open with both arms drawn
     under a switch that says otherwise. */
  /* WHAT THE PICTURE IS DRAWING, AND IT DEFAULTS TO BOTH NOW.
     This read `beat?.arm ?? arm` — the pass's arm, else the arm the exercise
     upstairs maps to — and either way it was ONE of them. The SIGNALS brief's
     first non-negotiable is that both are visible together by default, and its
     opening diagnosis is this exact line: *"the current scene says it is
     comparing resistance and endurance, but it only renders one workout at a
     time … the narration can say 'these two behave differently' while the viewer
     literally cannot see both."*
     So `show` is the viewer's control and it opens at `"both"`. A beat may still
     name an arm, and none of them does — `signalsTour` sets `show: "both"` on
     every beat precisely so that a pass cannot quietly go single-armed.
     THE EXERCISE UPSTAIRS DID NOT STOP MATTERING, it stopped deciding what is
     drawn. It picks which side the pass calls the viewer's, and nothing else. */
  /* `beat.show` IS READ NOW, 2026-09-06. The paragraph above says every beat
     sets `show: "both"` so the pass cannot go single-armed — and this line never
     looked at that field, so the pass ran under whichever chip the visitor
     arrived on ("Running" from a run, since the chips open on the door you came
     through). Photographed mid-pass: "They open different doors" over a picture
     drawing one door. A beat's `show` wins while the beat plays; the chip is the
     viewer's again the moment it ends. */
  const shownArm = beat?.arm ?? beat?.show ?? show ?? "both";
  /* NO `model.show`. The old scene drew both bouts at once and hid one; this one
     draws ONE bout's route and colours it in that bout's own tint, so there is
     nothing to hide and nothing to put back. A beat that names an arm still
     moves `shownArm`, and `update` above reads it every frame. */
  /* THE SWITCH HAS TO SAY WHAT IS DRAWN. The pass switches the arm by
     derivation, which is why there is nothing to restore when it ends or is
     interrupted — and that is right. What it left out is that the control lives
     outside the canvas and still read the viewer's `arm`, so measured in a
     browser on 2026-08-26 the picture showed the endurance fan alone under a
     "Both" that was still lit. A control that disagrees with the thing it
     controls is worse than one that does nothing.
     Lifted the way the line is and stored no more than the line is: `beat` is
     null the moment the pass ends, so this reports null and the switch is the
     viewer's again with nothing to put back. `tour.js` is untouched — the arm is
     this storyboard's field, so reporting it is this scene's job. */
  useEffect(() => {
    onTourArm?.(beat ? shownArm : null);
  }, [beat, shownArm, onTourArm]);
  /* THE PASS BORROWS THE CAMERA AND ALWAYS GIVES IT BACK, however it ends.
     `tour.camera` is null the moment there is no beat, so this reads: the
     scale's own framing, except while a storyboard is speaking.

     TWO THINGS LEFT THIS CALL. `home` counted presses of the strip's `reset`
     and D3 deleted the strip on 2026-08-30 — nothing has called `setHome`
     since, so all four ternaries picked one branch every time. And
     `!tour.interrupted` disarmed the ease permanently once a viewer touched
     anything, which canon B2 makes the normal way to use these scales; it was
     protecting a camera a VIEWER had aimed, and D6 removed the orbit here the
     day before. `FiberScene.jsx` carries the browser measurement that caught
     it. This scale's beats stay near one centre, so it stranded people less
     visibly than the fibre — the same clause, a quieter symptom. */
  /* STAND FURTHER BACK WHEN THE WINDOW IS NARROWER THAN THE CONTRACT — canon S1,
     measured 2026-08-31 at 320x640.
   *
   * `SIGNALLING_CAMERA` is one typed position, and `signallingGeometry.js` says
   * exactly how far its guarantee reaches: every callout inside |ndc.y| 0.86
   * "over the whole aspect range the app is used at, 0.99 to 1.82". A phone in
   * portrait is 0.50. Below the floor the picture simply overflowed sideways —
   * screenshotted, the network cropped at both edges with marks running off the
   * canvas, on the one scale whose whole subject is how wide the fan is.
   *
   * A perspective camera's `fov` is VERTICAL, so the width it covers is
   * `fov * aspect`: at half the aspect it shows half the world width from the
   * same distance. Stepping back by `floor / aspect` shows the same world width
   * the contract was fitted at, and nothing else about the shot changes.
   *
   * ABOVE THE FLOOR THIS IS EXACTLY 1 AND NOTHING MOVES. Every measured constant
   * on this scale — the band spacing solved against |ndc.y| 0.94, the plate
   * bound at 0.86, the outcome plate's clearance at -0.538 — was fitted from
   * this camera at desktop aspects, and re-fitting them is a different piece of
   * work. This only rescues the range where the contract already says it does
   * not hold.
   *
   * AND IT DOES NOT ROLL. `fitCamera.js` turns the fibre's camera on a phone
   * because a sarcomere is a long thin thing and which end is up is not a claim.
   * Here the vertical axis IS the claim — outside, membrane, cytosol, nucleus,
   * what the cell does, in that order, top to bottom. A cell drawn on its side
   * to fit a window is a different picture. */
  const { size } = useThree();
  const standing = useMemo(() => {
    const pull = pullFor(size, narrowStage);
    const rest = restFor(narrowStage);
    /* AND IT AIMS AT THE ORIGIN AT EVERY WIDTH NOW, because the origin is the
       middle of the picture again.
       It used to aim at `[0, (BANDS.outside.y + SPAN + BANDS.outcome.y - 0.28) / 2, 0]`,
       and that was right for the scene it was written for: `buildSignallingLevel`
       hung five compartment shelves whose midpoint was well above zero, so
       stepping back alone left the cell stranded in the upper half —
       screenshotted at 320x640, the network between y 155 and 400 of a 640 px
       window with the bottom third empty. That scene has drawn no pixel since
       2026-08-31. `heroGeometry` runs its rows from +TOP_Y to −TOP_Y and its
       depth from +z to −z about zero, so the correction is now an OFFSET off the
       middle of a symmetric drawing — it aimed 0.225 high, and every constant on
       this scale is measured from a camera looking at the origin. Deleted rather
       than re-fitted: the layout centres itself, so there is nothing left to
       correct and nothing to expire. */
    /* AND THE DRAWING STOPPED BEING SYMMETRIC ON 2026-09-05, WHICH IS WHY THIS
       AIMS LOW AGAIN. The paragraph above deleted an offset because "the layout
       centres itself" — true when the rows ran +TOP_Y to −TOP_Y about zero and
       nothing else was drawn. The outcome shelf and its lip are below the bottom
       row now (`heroGeometry.js`, and the brief's rule 7 is why they exist), so
       the picture runs from about +0.85 at the input forms to about −1.15 at the
       lip: a centre of −0.15 rather than 0.
       PHOTOGRAPHED BEFORE IT WAS FIXED: at 1280x800 aiming at the origin, the
       shelf ran off the bottom edge of the canvas and the outcome row — the end
       of the whole four-scale descent — was cropped. `SHELF_DROP` is that
       measured centre and `1.08` is the pull-back that puts a margin under the
       lip rather than the lip on the edge.
       IT IS AN OFFSET OFF A KNOWN GEOMETRY, NOT A FITTED CONSTANT. If the shelf
       moves, this moves with it, because both are set off the outcome row. */
    /* THE SHELF WENT ON 2026-09-06 AND THE OFFSET STAYED, re-measured: the rows
       are dropped by `Y_DROP` and the outcome captions hang under the bottom
       row, so the picture still runs a little further below zero than above it.
       The 1.08 pull-back went with the shelf — `SIGNALLING_CAMERA` itself now
       stands where the framing test fits the bottom outcome's rim, and the
       pass's last beat IS this shot — `STANDING`, one object for both — which
       is tonight's rule: the tour ends on the frame it left, no ease. */
    return {
      camera: [rest.camera[0], rest.camera[1], rest.camera[2] * pull],
      lookAt: [...rest.lookAt],
    };
  }, [size.width, size.height]);

  useCameraTransition(
    tour.camera ?? standing.camera,
    tour.lookAt ?? standing.lookAt,
    true,
    tour.index,
  );

  /** Whether the run is sitting on its last sample, which is the only time the
      outcomes wear their two arcs. Written by the update loop below and read by
      the guide's, so the two do not have to be one function. */
  const endedRef = useRef(false);
  /* WHERE THE GUIDE SHOULD STAND, written per frame in CANVAS pixels. The words
     follow what the VISITOR pressed and fall back to the beat's own subject —
     the same `sayAt` / `focusAt` split `Gizmos` already draws, applied to the
     thing that carries the sentence. */
  useFrame((frame) => {
    if (!guideRef) return;
    const { camera, size } = frame;
    const naming = guideAnchor?.current ?? null;
    if (naming !== beaconId) setBeaconId(naming);
    /* THE RAW ANCHOR LIST, NOT THE PLATE LIST. `Gizmos` is fed a FILTERED set
       — plates fold at narrow widths and during a pass — and the guide must be
       able to stand beside a part whose name is currently folded away. The
       model's anchors are every part this scale drew. */
    const wanted = guideAnchor?.current ?? null;
    const named = wanted ? model.anchors?.find((a) => a.id === wanted)?.at ?? null : null;
    const at = named ?? openAnchor?.at ?? heroLift(tourFocus?.at ?? null, narrowStage);
    /* AND WHAT IT MUST NOT STAND ON, WHICH IS NEW GEOMETRY — 2026-09-06. The
       ending's two arcs (fifth brief §1) are the picture that says two routes
       reached almost the same place, and their whole argument is that the warm
       one and the cool one are near-equal LENGTHS. A character parked on one
       end of one of them shortens exactly the thing the reader is comparing —
       the lane's still p6-04 has it on Mitochondria's cool arc.
       THE SCORING CANNOT SEE THEM. It reads the spoken subject, DOM plates and
       what a floor marked with `data-guide-clear`; an arc is a torus in the
       scene. So this floor says where they are, in the same pixels as the
       anchor, the way ENERGY does for CaMKK2.
       ONLY AT THE ENDING, because that is the only time they are drawn — and
       `ARC_R` in pixels is measured rather than assumed: the same radius is a
       different number of pixels at each beat's distance. */
    if (clearRef) {
      /* At rest the outcomes themselves (the captions that used to mark them for
         the guide are gone — the cell's way); at the ending, their arcs. */
      const reach = endedRef.current ? ARC_R : stage === "main" ? ARC_R * 0.8 : 0;
      clearRef.current = reach
        ? (model.anchors ?? [])
            .filter((a2) => a2.kind === "outcome" && a2.ringAt)
            .map((a2) => {
              _guideV.set(...a2.ringAt).project(camera);
              if (_guideV.z > 1) return null;
              const x = ((_guideV.x + 1) / 2) * size.width;
              const y = ((1 - _guideV.y) / 2) * size.height;
              _guideV.set(a2.ringAt[0] + reach, a2.ringAt[1], a2.ringAt[2]).project(camera);
              const ex = ((_guideV.x + 1) / 2) * size.width;
              const ey = ((1 - _guideV.y) / 2) * size.height;
              return { x, y, r: Math.hypot(ex - x, ey - y) };
            })
            .filter(Boolean)
        : null;
    }

    if (!at) {
      /* THE OPENING BEAT BELONGS TO NO PART — it is the one sentence that says
         what the whole picture is (canon G1), and it was the beat the guide
         stayed silent through, because there was nothing to stand beside.
         So when nothing is named, it stands beside the PICTURE: the middle of
         the frame, with a clearance wide enough that it does not land on top of
         what it is introducing. */
      guideRef.current = { x: size.width / 2, y: size.height * 0.46, r: size.width * 0.2 };
      return;
    }
    _guideV.set(...at).project(camera);
    /* BEHIND THE CAMERA IS NOT OFF-SCREEN, IT IS MIRRORED — `Gizmos` documents
       the same trap at its own projection. A guide placed from a mirrored point
       stands somewhere plausible and points at nothing. */
    if (_guideV.z > 1) {
      guideRef.current = null;
      return;
    }
    guideRef.current = {
      x: ((_guideV.x + 1) / 2) * size.width,
      y: ((1 - _guideV.y) / 2) * size.height,
      /* The parts on these three scales are drawn objects rather than points —
         a node circle is about 50 px across on a 1280 stage — so the clearance
         is wider than the body scale's. Read off the screenshots on
         2026-09-01, where 26 had the character standing on top of AMPK. */
      r: 40,
    };
  });

  /*
   * THE PASS OWNS THE CLOCK WHILE IT RUNS, AND IT OWNS IT BY POSITION.
   *
   * The defect `docs/20260905-fix/signaling.md` opens the tour section on:
   * *"narration runs for roughly two minutes while the underlying 45-second
   * replay can loop several times, so the words and animation fall out of
   * sync"*. That is what a SPEED per beat buys — the run and the words are two
   * clocks agreeing by arithmetic, and any frame the arithmetic is off by, they
   * drift, and the drift accumulates over eleven beats and then wraps.
   *
   * So a beat no longer says how FAST to play. It says where the run should BE
   * when the beat ends (`at`, a fraction), and this eases the clock from where
   * the previous beat left it to there over the beat's own milliseconds. The run
   * position is then a function of how far through the pass we are, which cannot
   * drift from the words because it is computed FROM them. A slow machine draws
   * fewer frames of the same interval and still lands on the last sample.
   *
   * `fromAt` is captured when the index changes rather than read off the
   * previous beat, so an interrupted or re-armed pass eases from wherever the
   * viewer actually left the clock instead of snapping back to a beat boundary.
   */
  const passClock = useRef({ index: -1, at: 0, since: 0 });

  useFrame((_, delta) => {
    const c = clock.current;
    // Clamped like the other scales: a backgrounded tab hands back a delta of
    // seconds, and a scene that skips half the run on the first frame after a
    // wake is showing a jump it did not compute.
    // The run ends still, cuts in one frame, and starts still — runLoop.js. The
    // wrap it replaces put every node back to its baseline inside a moving
    // picture, where the only thing 121 species resetting at once can read as is
    // the network relaxing.
    // The last argument is the VIEWER's seconds, and it is the whole reason the
    // hold is visible here. This clock advances up to 3.0 of the run's seconds
    // per frame, so a hold spent in run seconds is spent in one frame — measured
    // in a browser as a 1-frame hold before this argument existed.
    // Paused still draws: `drawnAt` runs every frame either way, so a held
    // instant is a still of the network, not a frozen framebuffer.
    /* THE PASS'S SPEED WINS WHILE IT RUNS, AND ONLY WHILE IT RUNS. `??` rather
       than a boolean: a beat either carries a speed or it does not, so a viewer's
       chip is never overwritten and is never ignored either. */
    const speed = beat?.speed ?? replay;
    /* THE PASS'S POSITION, WHEN THERE IS ONE. `Number.isFinite` rather than a
       truthy test: `at: 0` is the whole of the first four beats and is exactly
       the value a truthy test would drop, which would let the run start under a
       still network's sentences. */
    /* AND NOT WHILE PAUSED. With `passAt` null the free-running step below is
       already gated on `playing`, so a pause holds the clock where the beat
       left it; `pc.since` stops accruing with it, and `useTour`'s `paused`
       shifts the storyboard's own clock by the same span, so on Resume the
       ease and the sentence pick up together. */
    const passAt = tour.running && !heldByViewer && Number.isFinite(beat?.at) ? beat.at : null;
    if (passAt !== null) {
      const pc = passClock.current;
      if (pc.index !== tour.index) {
        pc.index = tour.index;
        pc.at = runSeconds > 0 ? c.t / runSeconds : 0;
        pc.since = 0;
      }
      pc.since += delta;
      const span = Math.max(1, beat.ms ?? 1) / 1000;
      const u = Math.min(1, pc.since / span);
      /* SMOOTHSTEP RATHER THAN LINEAR, so the run does not start and stop with a
         jerk at every beat boundary. It is the same ease the camera is on, which
         matters: a clock that snaps while the camera glides reads as two
         different things moving, and the whole point of this floor is that they
         are one. */
      const eased = u * u * (3 - 2 * u);
      clock.current.t = (pc.at + (beat.at - pc.at) * eased) * runSeconds;
      /* THE HOLD IS CLEARED WITH IT. `runLoop.js` puts the clock into its "end"
         hold on reaching `tEnd`, and a pass that has just placed the clock by
         hand has not reached anything — leaving the hold set would make the last
         two beats cut the network back to baseline under a sentence about where
         it ended up. */
      clock.current.held = null;
    }
    /* A HELD BEAT IS A PAUSE, INCLUDING FOR THE SEAM HOLD, and that is not a
       nicety. `runLoop.js` puts the clock into its "end" hold the moment it
       reaches `tEnd` and then cuts the whole network back to its baseline when
       the hold is spent — and the hold is spent out of the VIEWER's seconds, the
       last argument here. This pass's conclusion parks on the run's last sample
       for five of those seconds. Left ungated, it would have spent the 0.9 s hold
       and then shown an unstarted network under a line about where the two bouts
       arrived: the fibre scale's "watch it empty over a window that is mostly
       refill", one scale over and one step worse. `speed: 0` therefore stops both
       clocks, exactly the way pausing already did. */
    /* THE PASS SUPPRESSES THE FREE-RUNNING STEP ENTIRELY. Both driving the clock
       forward and placing it by position in the same frame is two authors on one
       value, and the one that lost would do so silently. */
    const step =
      passAt === null && playing && speed > 0 && !(stage === "silent" && !coverOpen) ? Math.min(delta, 0.05) : 0;
    /* THE MULTIPLIER GOES ON THE RUN SECONDS ONLY, for the reason the comment
       above already gives about the last argument: it is the VIEWER's seconds
       and the seam hold is spent out of it. This clock advances up to 3.0
       run-seconds a frame, so a hold scaled with the run would be spent in one
       frame at 1x and drawn out to nothing a viewer could see. */
    /* THE INTRO LAP RUNS AT ITS OWN RATE — see `INTRO_S`. A ratio rather than a
       second constant, so a change to the archive's length cannot silently make
       the opening lap longer than the number that names it. */
    const rate = stage === "silent" ? runSeconds / RUN_SECONDS_PER_SECOND / INTRO_S : 1;
    stepRunClock(c, step * RUN_SECONDS_PER_SECOND * rate * speed, 0, runSeconds, step);
    /* THE VEIL OVER THE CUT — `runVeil.js`. Written straight to the element:
       a React state at 60 Hz for a sheet's opacity would re-render the page. */
    if (veilRef?.current) veilRef.current.style.opacity = veilOf(c).toFixed(3);
    if (seam) {
      /* FROM THE FIRST FRAME. The pass starts SILENT_MS (1.6 s) after arrival,
         and a hold keyed on the running pass alone let AMPK land in stone,
         turn purple at the first beat and fade again (verifiers, 2026-09-06).
         The silent stage is part of the arrival, so it holds too. */
      const held = stage === "silent" || (tour.running && (beat?.id === "arrive" || beat?.id === "reveal"));
      seam.k = held ? 1 : seam.k + (0 - seam.k) * Math.min(1, delta / SEAM_TAU_S);
      if (seam.k < 0.002) seam.k = 0;
    }

    const drawn = drawnAt(arms, routes, c.t);
    /* `drawn` still feeds the readout and the notices — it is what measures the
       two arms against each other. The PICTURE takes `heroReading`, the same
       instant read for the twelve ids of ONE bout, because the drawing is one
       bout's route and not a comparison of buckets. */
    /* BOTH ARMS, ONE INSTANT, ONE CALL — `heroPair` exists so those three cannot
       come apart. The picture used to take `heroReading` for a single arm; what
       it takes now is the comparison itself, and `show` decides which halves of
       it are drawn rather than which one is read. `selected` dims what the
       chosen node is not wired to, which is the brief's click behaviour. */
    /* AND EACH ARM'S PROGRESS, 2026-09-06 — `heroProgress`: what colours a node
       as its workout reaches it and what drives the three outcomes' forms.
       `hover` goes in with it so the form under the pointer can say so itself
       now that the ring is going. Same `c.t` for all of them, which is the
       invariant `heroPair` exists for. */
    model.update({
      ...heroPair(arms, HERO_IDS, c.t),
      progress: heroProgress(arms, HERO_IDS, c.t),
      show: shownArm,
      focus: selected,
      hover: hovered,
      /* Fifth brief §1 / §3 / §8 — see `buildHeroLevel`'s `update`. */
      ended: (endedRef.current = c.t >= runSeconds - 1e-6),
      wall: delta,
      seam,
    });
    /* NO `lap` ON THE PAYLOAD (canon D8). One lap, always looping, and a
       pause to stop it — nothing counts. It was computed here and read by a
       line that is now deleted, which is this repository's recurring defect:
       a value carried to no pixel. */
    onRead({ ...drawn, held: c.held });
  });

  return (
    <>
      {/* THIS SCENE LIGHTS ITSELF, AND THE REASON IS WHAT IT DRAWS. The shared
          rig is `ambient 1.15` against a key of 2.5 — right for the body and the
          fibre, which are big smooth surfaces where a hard key would blow out a
          muscle's own colour. Here the subject is a hundred and twenty small
          spheres, and at that ambient they receive almost the same light on
          every face: they render as flat discs, so a viewer gets a scatter of
          coloured dots instead of objects sitting in a space. The owner's words
          were "뭐가 뭔지 잘 안보여".
          Ambient down, key up, fill roughly held — the same three lights, the
          same positions from `anatomyStyle.js`, re-weighted for a scene made of
          small round things. Local to this scale rather than edited in the
          shared constants, which the fibre and the cell are lit correctly by. */}
      <AnatomyEnvironment />
      <ambientLight intensity={0.5} />
      <directionalLight position={LIGHTS.key.position} intensity={3.4} />
      <directionalLight position={LIGHTS.fill.position} intensity={1.2} />
      {/* The re-weighting above is untouched — the scene is still lit by its own
          three, because that weighting was measured against what it draws. What
          the projector below adds is the cue no re-weighting could give: with one
          key and no shadow, a small round thing at z 0.22 and the same thing at
          z 0.76 shade identically, and the only way a viewer learns which is
          nearer is by orbiting. */}
      {/* NO SHADOW RIG. `viz-depth-a` brought one and it is the half of that
          pass that is rejected — graded 2026-09-01 from screenshots of both
          scales. Everything else it did lands: the membrane is a sheet with
          thickness instead of two hairlines, the cell has a translucent body so
          a viewer is INSIDE something, and the background crowd is scattered
          through z so near dots are near.
          The shadow was not. These scenes have no ground: a drawn cell floats
          in paper, so every shadow fell on the backdrop at whatever distance
          the projector happened to make, and each of the eight or twelve
          objects grew a grey twin down and to its left. Not a contact cue — a
          duplicate. `anatomyStyle.js`'s SHADOW block and its own long argument
          are kept in the file for whoever gives these scenes a floor to land
          on; the argument is sound and the scene is not ready for it. */}
      {/* THE NETWORK IS THE PICKER NOW — brief's NODE INTERACTION section.
          Handlers sit on the whole group rather than on thirteen forms because
          the forms are built in `heroGeometry.js` as plain three objects: a
          per-form handler would mean R3F components for each, which is a second
          representation of the drawing to keep in step with the first. One
          handler and a walk up the parents reads the same tags the rest of the
          file reads.
          `blind()` is why this works at all. Every atmosphere layer — the crowd,
          the pulses, the membrane sheet, the meters, the shelf — has its raycast
          stubbed out, so the only thing in front of a form is the form. That
          landmine was defused before it was laid; this is the code it was
          defused for. */}
      <primitive
        object={model.group}
        onPointerMove={(e) => {
          const id = nodeIdAt(e.object);
          e.stopPropagation();
          onHover?.(id);
        }}
        onPointerOut={() => onHover?.(null)}
        onPointerDown={(e) => {
          const id = nodeIdAt(e.object);
          if (!id) return;
          e.stopPropagation();
          /* A SECOND PRESS ON THE SAME NODE CLEARS IT — the brief's *"click again
             to clear"*. Handled here rather than in the page so the gesture and
             its undo live at one address. */
          /* ONE GESTURE, TWO STATES — 2026-09-07 (last pass, L6): the mesh set `selected`
             (the card) and only a ring set `open` (the demonstration and the bell), so
             S6 could keep talking under PGC-1α's card with both plates up. A press is
             a press: the same click sets both, and pressing the selected one again
             clears both. */
          if (selected === id) onClear?.();
          else {
            press(id);
            onSelect?.(id);
          }
        }}
      />
      {/* THE TWO-ARM COUNTS ARE ABOUT A PAIR OF MARKS, so they go when there is
          no pair — the trunk's "telling the arms apart" and the outputs' widest
          gap are both differences between two arms, and one arm alone has none.
          `gizmoItems` draws those anchors without a value when `reading` is
          null, which is what a callout naming a band it cannot count should look
          like. The two split counts stay: they are properties of the RUN, not of
          what is drawn this second. The doors callout stays too and CHANGES —
          it is the one that reads the chip. */}
      {/* THREE ON A PHONE, FIVE ON A SCREEN. All five plates here carry a value,
          so the fibre scale's rule — fold the names, keep the readings — has
          nothing to fold. What a 320 px stage HAD instead was 193 px of usable
          height once the transport strip was reserved out of it, and five plates
          at 29 px each did not settle in it: measured 2026-08-26, "resistance
          only" and "twelve outputs" landed on the same band and
          `gate-legibility` called it.
          THE STRIP LEFT THIS SCALE ON 2026-08-30 (canon D3), so 193 px is a
          floor and not the number today. The fold is kept at the same width
          because nothing has re-measured it, not because the reservation is
          still there: anyone raising the threshold has to photograph it first.
          The two that go are the two arm counts. What survives is this screen's
          whole argument in the order it happens — the doors you enter by, the
          nodes both arms reach, and where the twelve outputs land. The arm
          counts are the middle detail of that middle step, and they are back at
          421 px. Nothing is deleted; a plate that cannot be placed is not read
          either. */}
      {/* This scale is why `tour.js` learned `focusAt`. Its every lookAt sits
          at x = 0 on a band centre, so a beacon placed from the camera pulsed
          over empty paper while the line talked about a column at ±0.62 or the
          doors at the top — measured across all eight beats, and the ring moved
          exactly once, by accident, when the trunk's centre happened to be the
          lookAt. The storyboard says where its subject IS, off the same BANDS
          the marks are drawn from, and `tourFocus.at` now carries it for every
          scale rather than this one reaching around. */}
      {/* THE BEACON HAS TO REACH WHAT IT IS CENTRED ON. Measured 2026-08-30 on
          the opening beat at 1280x800: the two door marks sit at x = ±0.34 —
          the membrane band's own width — and a ring of radius 0.18 breathes out to 0.26,
          so it pulsed in the gap BETWEEN them and touched neither. That is the
          same defect `focusAt` was added to fix one axis over, and it survived
          on the one beat that opens and closes the pass.
          The doors are the only focus whose subject is a PAIR rather than a
          band's middle; the other four are columns the ring sits inside. So the
          radius is the band's own half-width there and unchanged elsewhere,
          derived rather than typed, so a band moved in the geometry moves the
          beacon with it. */}
        {/* LIFTED ONTO THE NEAR WALL BEFORE IT IS DRAWN OR SOLVED. Every
            `focusAt` a beat carries is a band coordinate with z 0, and the forms
            are on a dome now — `heroGeometry.heroLift` carries the measurement. Both
            the beacon and the plate solver take the lifted point, because both
            of them project it and both would land it in the same wrong place. */}
      {/* NO BEACON — 2026-09-06, the last `#b4530a` in the app. Owner, naming
          both marks in one breath: *"이 orange accent on parts 개 ㅈ같아 … 그리고
          black rings도 개 ㅈ같아 (everywhere)"*. `FocusRing` lassoed whoever was
          talking in that colour, and FIBER's mount went earlier in this pass for
          the same reason.
          WHAT SAYS IT INSTEAD is this floor's own material: the node being
          spoken about or pressed keeps its colour and the rest recede toward the
          paper. A lasso on top of that is a second thing saying one thing, in
          the one colour that was asked to go. `heroLift` is still what places
          the plate, which is where the lift argument above belongs. */}
      <Gizmos
        /* ONE PLATE PER DRAWN NODE. `gizmoItems` built the old picture's six
           callouts out of bands, counts and arm buckets; the drawing is twelve
           named objects now, so a plate is a name tag on one of them and the
           sentence behind it lives in the record. The name is the archive's own
           id with its underscores opened out — `heroGeometry.js` does that and
           nothing else to it. */
        /* AND NOT ALL THIRTEEN AT ONCE ANY MORE, 2026-09-05.
           Photographed at 1280x800 on the first build of this rebuild: thirteen
           name plates standing over the drawing at all times, so the first thing
           a viewer meets is a wall of labels and the network is what shows
           between them. The brief's visual language is that the connections and
           the travelling signals are the protagonists; thirteen permanent
           captions are a fourteenth layer in front of both.
           WHAT DECIDES WHICH PLATES STAND: the beat's own subject while the pass
           runs, plus whatever the viewer is pointing at or has selected. So the
           pass names things as it reaches them, and afterwards the drawing is
           the drawing until somebody asks. That is canon G1's requirement met by
           ASKING rather than by pre-announcing — every one of the thirteen is
           still nameable, and `SAYS` puts a sentence under the name in the DOM
           the moment a pointer is over it.
           THE OUTCOMES KEEP THEIRS. They are the end of the whole four-scale
           descent and the one row whose names are the payoff rather than a
           label — a viewer who watches both signals arrive at three unnamed
           lumps has been shown the answer and not told it. */
        /* ONE RULE, IN `heroGeometry.platesShown`, 2026-09-06 — owner §9:
           *"Default state에서는 Resistance, Endurance, 필요하면 AMPK 정도만 항상
           … Hover: node name / Click: name + description + paired comparison /
           Guided tour: 현재 말하는 object만 label."* The outcomes lost their
           standing plates with it; their names hang as quiet captions under the
           OUTCOMES divider instead (below), which is the owner's own sketch of
           the zone. `tour.running` covers both the arrival pass and a pressed
           part's own demonstration — in either, the part being spoken about is
           the only plate. */
        items={platesShown(model.anchors, {
          touring: tour.running,
          tourFocus: tourFocus?.id ?? null,
          hovered,
          selected,
          open,
        })}
        focus={tourFocus?.id ?? null}
        focusAt={heroLift(tourFocus?.at ?? null, narrowStage)}
        /* WHERE THE WORDS HANG, AND IT IS THE PRESS AND NOT THE BEAT — see
           `openAnchor` above and `Gizmos`' own note. The trunk's answer is the
           case this scale contributes: `focusAt` is the outputs band, `sayAt`
           is still the trunk the visitor pressed. */
        sayAt={openAnchor?.at ?? null}
        /* ARRIVING HERE IS ARRIVING, AND THERE IS NOTHING ELSE TO ARRIVE AT.
           The fibre keys this on its level because its ladder swaps the whole
           model and a viewer who presses `Fascicle` is meeting three new things.
           This scale has one set of parts for its whole life: the geometry is
           built once from `routes` and the scene does not mount until all three
           arms have loaded, so the honest key is a constant.
           IT IS NOT THE ARM, and that is the one candidate worth ruling out in
           writing. Shutting a door drops the two comparison plates from `items`
           — `Gizmos` re-staggering on that would introduce names the visitor
           met a moment ago, which is the defect its own comment records
           measuring in the middle of the fibre's store demonstration. */
        introKey="network"
      />

      {/* ONE RING PER PART THE STORYBOARD IS ABOUT — canon D2ⓐ. `Handle.jsx`
          carries why the press is a ring and not the plate; `stepsOf` carries
          why this set is exactly the set of parts that have something to show.
          A ring stands ON its part's anchor, which on this scale is the margin
          just outside the band it names rather than on top of the marks — so
          the name and the control are the same place and neither covers the
          picture.
          FOUR OF THE SIX ANCHORS GET ONE. `nucleus` has no beat in the
          storyboard at all, and `outputs` gave its beat to the trunk because
          that beat is an answer — see `signallingTour.js`. A plate with no ring
          is a part with nothing to demonstrate, which is the honest shape;
          inventing a demonstration to fill a ring is the second script canon D5
          deleted.

          Drawn while a demonstration runs as well as before one, because the
          ring is how a visitor goes to the NEXT part — this is the main state
          and the main state is for touching. Only the one that is open reads
          differently. */}
      {/* A RING PER CASCADE TOO, AND THOSE HAVE NO BEAT. `stepsOf` cuts the
          storyboard by focus, so "a ring exists where there is something to
          demonstrate" gave rings to the three parts the pass narrates and to
          nothing else — while the nine cascades this overhaul made visible could
          be SEEN to be separate groups and not asked about. A cascade's
          demonstration is its own name, which is the smallest true answer to
          "what is this group" and costs the scale no standing words. */}
      {/* A RING ON EVERY ONE OF THE TWELVE. The gate used to be "does the
          storyboard have a beat focused here", which was right when the rings
          were three parts of a hundred-and-twenty-one-mark census and is wrong
          now: the twelve ARE the elements, and state 4 is *"each elements
          clickable (and they each show what they do when clicked)"*. A drawn
          object a visitor cannot ask about is the G1 complaint again. */}
      {/* AND SINCE 2026-09-05 A RING ONLY WHERE THE POINTER IS. The two notes
          above are the argument that every drawn thing must be askable, and it
          stands — what changed is that the ASKING no longer needs a permanent
          mark on top of every object. The picture now raycasts: hovering a form
          names it, pressing one selects it, and both go through the forms
          themselves rather than through thirteen rings floating over them.
          THE BRIEF NAMES THE DEFECT: *"do not put giant persistent interaction
          rings over all nodes"*, under a section whose whole subject is that the
          connections and the travelling signals should be what a viewer looks at.
          Thirteen hollow circles at 53 px each, over forms about 80 px across, is
          a second network drawn on top of the first one.
          WHAT IS KEPT IS THE RING ON THE OPEN ONE, and on the one under the
          pointer. That is the affordance doing its job — it says "this is the
          thing you are about to ask about" and then "this is the thing you
          asked about" — without saying it thirteen times at once to a viewer who
          has not reached for anything. `Handle`'s `<Html>` button is also what
          carries the 44 px hit target and the keyboard route, so a ring on the
          hovered and the open node keeps every one of the twelve reachable by
          tab, which raycasting alone would not. */}
      {model.anchors.map((anchor) =>
        (anchor.kind || steps.some((step) => step.id === anchor.id)) &&
        (open === anchor.id || hovered === anchor.id || selected === anchor.id) ? (
          <Handle
            key={anchor.id}
            id={anchor.id}
            at={anchor.ringAt ?? anchor.at}
            label={anchor.label}
            open={open === anchor.id}
            onOpen={(id) => { press(id); onSelect?.(id); }}
            /* AROUND THE OBJECT, NOT ON IT — `Handle`'s note carries the
               screenshot. Hollow so the thing it names stays the thing you look
               at; the radius is the one below (a second `radius` prop used to
               stand here and lose). */
            hollow
            /* SMALLER HERE, BECAUSE A RING IS READ AGAINST WHAT IT MARKS.
               `Handle`'s default 0.15 is tuned to the fibre, whose parts are fat
               tubes; measured 2026-08-31, one world unit is 246 px there and
               296 px here, so the same number draws a 74 px ring on the fibre
               and an 89 px one on this scale — over marks a tenth that size. The
               three rings became the loudest thing in a picture of 120 nodes.
               0.09 is 53 px, which still clears the 44 px hit target the `<Html>`
               button declares and no longer competes with the network. */
            radius={0.09}
          />
        ) : null,
      )}
      {/* D6 IS NARROWED, NOT OVERTURNED, 2026-08-31. The owner asked for the
          orbit back below the body — *"다시 body 밑에 레벨들도 3d로 돌릴 수 있게
          ← 이거 예전에 뺐잖아 ← 다시 살려"* (TODO.md B9) — and then said where it
          goes: *"tour중에는 회전을 끄고 — Main → Tour (각자 설명) → Main(여기서
          켜짐)"*. So D6's reason was right and its scope was wrong. *"우리가
          정한 각도만 봐"* is a rule about the DEMONSTRATION, and it was applied
          to the whole scale.

              MAIN   orbit on   the touching state — rings, the way in, and a
                                shape a visitor can turn
                ↓  a press
              TOUR   orbit off  the showing state — the camera is the
                                storyboard's, and only the storyboard's
                ↓  it ends or is interrupted
              MAIN   orbit on

          `!tour.running` AND NOT `!open`, WHICH IS THE ONE THING TO GET RIGHT
          HERE. `open` is which RING is open, and nothing ever sets it back to
          null — only a level change does, on the one scale that has levels. So
          `!open` would turn the orbit off at the first press and never turn it
          on again, which is D6 with extra steps. `tour.running` is `!!at` in
          `tour.js`, and `at` is null both when the storyboard runs out and when
          `stopped` is set by one of `INTERRUPTS` — the two ways a demonstration
          can end are exactly the two ways a viewer gets the shape back.

          SO THERE IS NO DEMONSTRATION-VERSUS-DRAG CONTEST TO SETTLE: the two
          are never live in the same frame, and `!tour.interrupted` stays out of
          `useCameraTransition` for the reason `b31befd` measured rather than
          being reinstated now that its old subject exists again. It keyed off
          the pass being STOPPED, and a ring press stops the pass — so it kept
          the camera at a beat's coordinate nobody aimed at, with the way down
          off screen at x = 2841 in a 1280-wide window. The camera still always
          returns to the level's own fitted framing (`fitCamera.js`), and a
          viewer who then turns it keeps that turn, because in MAIN nothing
          changes the ease's destination and the `INTERRUPTS` listener in the
          hook disarms an ease still in flight.

          RESTORED WITH THE BOUNDS IT HAD BEFORE D6, unchanged, because they were
          chosen against these objects and nothing about the objects changed.

          NO `target` PROP, unlike the pre-D6 markup which passed `[0, 0, 0]`.
          The ease lerps `controls.target` every frame and committing an array
          prop cuts that half of the move in one — `tourGrammar.test.js` carries
          it. `[0, 0, 0]` was harmless because it was what the ease defaulted to
          anyway; on the fibre it no longer is, since `fitCamera` aims at the
          frame's centre. Omitting it is the same value on two scales and the
          right one on the third.

          DISABLING DOES NOT DISCONNECT, checked in the installed sources rather
          than assumed. drei only skips its own `controls.update()` while
          disabled (`OrbitControls.js`), and the ease calls `update()` itself, so
          the aim still tracks `controls.target` through a demonstration. three's
          `onPointerUp` releases capture and fires `end` WITHOUT consulting
          `enabled` (0.185.1), so flipping this false under a live gesture — which
          a ring press cannot do anyway, since `Handle` puts its button in an
          `<Html>` layer the canvas never sees — strands no pointer. */}
      <CameraSway active={!turned && !tour.running} standing={standing} />
      {/* IT SWAYS UNTIL SOMEBODY TURNS IT, AND THEN IT IS THEIRS.
          An audit of the three scales put "no camera movement at all" among the
          three confirmed reasons this one reads flat against the fibre: nothing
          in the frame moves except thirteen forms rocking in place, and a
          rotation in place changes a form's shading without changing where
          anything IS. Motion parallax is the strongest depth cue available
          without stereo and this scene had none of it.

          A drift is the one motion that costs no honesty. It is the VIEWPOINT,
          not the model: it says nothing about any node, any edge or any
          quantity, and the same picture is there whether it turns or not.

          IT STOPS THE MOMENT A VIEWER TOUCHES IT, because the note above this
          control is explicit that a viewer who turns the scene keeps that turn,
          and taking the camera back off them afterwards would be the thing D6
          was right about wearing a different hat. `start` fires on the first
          drag, and once off it stays off for the visit. */}
      {/* LIMITED, 2026-09-06 — owner §10: *"SIGNALS에서 camera orbit을 크게
          허용하면 topology가 깨집니다 … orbit 범위 제한, vertical tilt 제한"*. The
          four angles come from `ORBIT_LIMITS`, derived from the standing shot,
          and `signalsTour.test.js` holds every beat inside them so the frame
          after the hand-back cannot snap. No pan: a network dragged off its
          centre is a topology with a piece missing, and the tour's own
          dolly/pan is `useCameraTransition`'s, not these controls'. */}
      <OrbitControls
        makeDefault
        enabled={!tour.running}
        onStart={() => setTurned(true)}
        enableDamping={CONTROLS.enableDamping}
        dampingFactor={CONTROLS.dampingFactor}
        enablePan={false}
        minDistance={1.4}
        /* 10, NOT 6 — measured 2026-09-06 at 390x844: `standing` pulls the camera
           back by `pullFor` on a phone (CONTRACT_FLOOR / aspect: 9.55 out at
           390x844 today), and a ceiling of 6 clamped it the frame the controls
           came on, cropping the outer nodes at ndc x ±1.04. The ceiling is for
           the viewer's wheel, not for the framing — and it has to stay above
           the narrowest phone's pull, which `signallingGeometry.js` notes. */
        maxDistance={10}
        minAzimuthAngle={ORBIT_LIMITS.minAzimuthAngle}
        maxAzimuthAngle={ORBIT_LIMITS.maxAzimuthAngle}
        minPolarAngle={ORBIT_LIMITS.minPolarAngle}
        maxPolarAngle={ORBIT_LIMITS.maxPolarAngle}
      />
      {/* THE OUTCOME ZONE'S OWN WORDS — owner §8's sketch, verbatim:
              ────────────────────
              OUTCOMES
              Protein   Growth   Mitochondria
          The hairline is `heroGeometry`'s (`outcome-line`); these are the word
          at its left end and the three short names under the three forms, as
          quiet captions rather than plates — a legend for the zone, not a label
          on a node. Not during a pass: §9's rule that only the spoken part is
          labelled covers these too. */}
      {/* THE LEGEND AND THE CAPTIONS STAND ONLY FOR A PART SOMEONE IS ON — the cell's way (owner, 20/24). */}
      {!tour.running && model.zone && (hovered || selected) ? (
        <>
          <Html position={model.zone.at} zIndexRange={[1, 1]} style={{ pointerEvents: "none" }}>
            {/* MARKED SO BELL STEPS OFF IT — 2026-09-06. Measured at 1280x800 on
                the resting frame: the guide's bubble covered `Mitochondria` by
                1,223 px². Its four-corner scoring forbids only what it is told
                about, and this legend is neither the spoken subject nor a
                `.gizmo--focus` plate — it is permanent furniture. `avoid` was
                the wrong door: it ALSO shifts the guide's home corner sideways
                by the element's width, which is right for the body's selection
                card and wrong for a caption that is nowhere near the corner. */}
            <span className="sig-zone" data-guide-clear>Outcomes</span>
          </Html>
          {model.anchors
            .filter((a) => a.kind === "outcome" && (a.id === hovered || a.id === selected))
            .map((a) => (
              <Html
                key={a.id}
                position={[a.ringAt[0], a.ringAt[1] - FORM_R * 1.25, a.ringAt[2]]}
                center
                zIndexRange={[1, 1]}
                style={{ pointerEvents: "none" }}
              >
                <span className="sig-zone__name" data-guide-clear>{ZONE_NAME[a.id] ?? a.label}</span>
              </Html>
            ))}
        </>
      ) : null}
    </>
  );
}

/**
 * THE ARRIVAL LINE IS GONE — "From bench press · pectoralis major —…", removed
 * on 2026-08-25 with the rest of the exercise link (fixing-prd §3). It named
 * where the viewer came from and then spent the rest of itself denying that the
 * name meant anything: the muscle selects nothing, because the Fowler model is
 * one cell's network with no anatomy in it, and the exercise selects no arm,
 * because nothing maps a bench press onto `ResistanceExercise = 1.0`. A caption
 * that exists to disown its own subject is the caption to cut, and the Bout
 * chips below are the answer it was standing in for: what the app may not do
 * from a hash, a person may do with a control.
 *
 * WHERE THE ONE CLAIM IN IT LIVES NOW. `protocol.input_surface` — "nothing
 * calibrates 1.0 against %1RM or %VO2max" — is a field of the shipped record and
 * reaches a reader through any evidence badge on this screen. §5's floor is that
 * a source is REACHABLE, and it names labelling as the part that is optional; a
 * sentence a viewer had to read before they had a question is not the same thing
 * as an answer waiting where they ask it.
 */

/** This scale's own "already walked" mark — one per scale, because being
    walked through the body is not being walked through this. */
const WALK_KEY = "hpe.guide.heroWalk";

export default function SignallingScale({ state }) {
  /* WHERE THE GUIDE IS STANDING. The scene writes this inside the render loop
     in canvas pixels; this moves it into the stage's frame, because the canvas
     is one child of the stage and the guide is another. */
  const guidePoint = useRef(null);
  /* WHICH PART THE WALK IS ON. Held in a ref and read by the scene's frame
     loop, so a beat changing does not re-render the canvas. */
  const walkAnchor = useRef(null);
  const stageRef = useRef(null);
  /* The paper sheet over the stage for the run's seam — `runVeil.js`. */
  const veilRef = useRef(null);
  /** The ending's arcs, in canvas pixels — see the scene's `clearRef`. */
  const clearPoint = useRef(null);
  /* CANVAS PIXELS TO STAGE PIXELS: the loop projects against the canvas and the
     guide lays itself out against the stage, which is a different box. */
  const toStage = useCallback((at) => {
    const stage = stageRef.current;
    if (!at || !stage) return null;
    const canvas = stage.querySelector("canvas");
    if (!canvas) return null;
    const s = stage.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    return { x: at.x + (c.x - s.x), y: at.y + (c.y - s.y), r: at.r ?? 0 };
  }, []);
  const resolveGuide = useCallback(() => toStage(guidePoint.current), [toStage]);
  const resolveClear = useCallback(() => {
    const list = clearPoint.current;
    if (!list?.length) return null;
    const out = list.map(toStage).filter(Boolean);
    return out.length ? out : null;
  }, [toStage]);
  /* NAMING THE PART AND FINDING IT ARE ONE STEP, in that order. The walk asks
     for an id; this records it for the scene's frame loop and hands back
     whatever the scene has projected so far. Until the scene has caught up that
     is the PREVIOUS beat's point or nothing at all, which is exactly what
     `useWalk` wants: a beat says nothing until its anchor resolves, and one it
     can never resolve is skipped having never spoken. */
  const resolveWalkAnchor = useCallback(
    (id) => {
      walkAnchor.current = id ?? null;
      return resolveGuide();
    },
    [resolveGuide],
  );
  const [arms, setArms] = useState(null);
  const [status, setStatus] = useState("loading");
  const live = useRef(null);
  const [readout, setReadout] = useState(null);
  /* STOPPED ON A LINK THAT NAMES AN INSTANT, for the reason `tourOn` below
     carries: a hash with a `t` is somebody saying "look at THIS", and a scene
     that seeks there and plays on has shown it for about a second. Measured on
     the fibre, which `ask.js` links into at 5.202 s — the store's emptiest
     instant, on screen for 1.3 s before the stage line moved on to "The bursts
     are over". Same predicate as the pass, so the two cannot disagree about
     whether this arrival is a descent or a destination. */
  const [playing, setPlaying] = useState(state?.t == null || arrivedFromInside());
  /* THIS SCALE COULD NOT BE SLOWED AND IT IS THE FASTEST ONE. 60x is a whole
     model minute a wall second, and a transition in the network is over before
     a viewer finds it. The panel used to DECLARE the rate in a sentence,
     because a constant nobody can press cannot be declared by a lit chip. It
     can now: the chips make the rate pressable, so the lit chip is the
     declaration and the sentence went with the other timeframes. */
  /* 1, AND NOTHING SETS IT ANY MORE. The three speed chips went on 2026-08-30
     with the rest of the toggles, so this is the rate the run clock reads
     whenever no beat is driving it — a constant rather than state, because a
     setter nobody calls is the dead flexibility this scale just spent a round
     removing. `SignallingSceneContent` still reads it, and a beat's own `speed`
     still wins through `beat?.speed ?? replay`. */
  /* 1 -> 3 ON 2026-09-07 — owner, SIGNALS 22: *"마지막 main에서는 movement가 안보이고
     눌러야 보여"*. Measured in main: the clock ran (84 -> 240 run-s over 3 s) but at
     60 run-s/s a 45-minute session is a 45-second lap and the beads barely crawl.
     Main runs three times faster; the pass keeps its own speeds. */
  const replay = 3;
  /* WHICH BOUT IS DRAWN, AND IT IS THE VIEWER'S AGAIN — see `ARMS_SHOWN`.
     `both` on every arrival, never the arm the exercise upstairs maps to. */
  /* WHICH BOUT IS DRAWN, AND THE VISITOR ALREADY ANSWERED THAT UPSTAIRS.
     Owner, 2026-08-31: *"selection은 거의 없고 운동에 따라 다르게"*. Somebody
     picked a bench press or a run on the first screen and descended four scales
     on that choice; asking again at the bottom is asking the same question
     twice, and the answer they would give is the one they already gave.
     `workoutMapping.js` turns the exercise into one of Fowler's two inputs —
     four resistance movements, two endurance — and has no default, so an
     exercise it does not know falls to resistance HERE rather than there: the
     mapping stays a mapping, and the picture still has to draw something.
     THIS REVERSES THE NOTE ON `ARMS_SHOWN` BELOW, which argued that no arm
     should be preselected from the exercise because "a default is a claim as
     much as a sentence is". That was right about the claim and the claim is
     `workoutMapping.js`'s, labelled `Mapped`, ours, and reachable. CLAUDE.md §5
     settles which side yields when rigour starts refusing features. */
  const arm = armFor(state?.exercise) ?? "resistance";
  /* THE LAST SENTENCE A VISITOR PRESSED FOR, AND IT STAYS. Held in state
     because it outlives the demonstration that produced it — canon D2ⓐ's last
     clause. See the `onTourLine` handler below for what `null` now means. */
  const [tourLine, setTourLine] = useState(null);
  /* WHOSE SENTENCE THIS IS. The label of the part that was pressed, kept beside
     the line so the name can head it — see `.say__of`. Set together with the
     line and never cleared alone, or a sentence would end up wearing the
     previous part's name. */
  const [saidBy, setSaidBy] = useState(null);
  /* THE STORYBOARD'S OPENING SENTENCE, which under a press model belongs to no
     part and so is never played. It is the one line that says what the whole
     picture is — canon G1, and on the scale canon S1 says nobody can read — so
     it stands while the names are arriving. */
  const [openerSaid, setOpenerSaid] = useState(null);
  /* AND IT STANDS FOR ITS OWN READING TIME, NOT THE CASCADE'S. `useOpenerStanding`
     carries the measurement — the cascade is under two seconds and these sentences
     need three to eight. Whichever is longer is how long the scale speaks. */
  const openerUp = useOpenerStanding(openerSaid);
  /* THE ONE SENTENCE THIS STAGE SAYS WHEN NOBODY IS BEING SHOWN ANYTHING.
     Only with both arms drawn: with one hidden, nothing is on top of anything
     and the count would be a caveat against a misreading nobody can make. */
  /* MOVED UP ABOVE `standing` on 2026-08-30, and the move is the fix. When the
     chips went, this memo still read the `arm` state they owned and threw
     `arm is not defined` — the error boundary caught it and the whole scene
     became "Could not load this scene", which `npm run build` and 52 node tests
     were all green through. The scar is CLAUDE.md §4's, exactly: 게이트 초록 ≠
     보인다. It was the browser that found it, one measurement later. */
  const [tourArm, setTourArm] = useState(null);
  /* WHAT IS ACTUALLY DRAWN: the beat's arm while a demonstration is running,
     the switch's the rest of the time. One expression, read by the switch, the
     readout and this memo, so none of the three can name a different picture
     from the one on the canvas. */
  /* ---- the explorer, and it is three controls -------------------------- */

  /*
   * WHY THREE AND NOT TWENTY. The brief is explicit — *"do not expose twenty
   * pathway settings"* — and this scale spent 2026-08-30 having every toggle it
   * owned removed for the same reason. What comes back is only what a viewer
   * needs to ask a question the picture can answer.
   *
   *   SHOW   which of the two streams are drawn. Opens at BOTH, which is the
   *          floor's whole premise, and the other two positions exist so a
   *          viewer can isolate a route they have just been shown.
   *   TIME   where in the 45 minutes the picture is. This scale had no
   *          timeline at all; the brief asks for one, and a comparison a viewer
   *          cannot scrub is a comparison they have to take on trust.
   *   TRACE  whole network, or only what the selected node is wired to. It is
   *          the SELECTION expressed as a control, so a viewer who found the
   *          fade by pressing a node can also find it deliberately.
   *
   * `show` is NOT seeded from the exercise. That was the old behaviour and it is
   * the defect the brief opens on. The exercise still decides which side the
   * pass calls yours; it no longer decides what is on screen.
   */
  /* IT OPENS ON THE DOOR YOU CAME THROUGH — 2026-09-06. Owner: *"signalling은
     시나리오가 달라야할듯? running에서 가냐 아니면 benchpress에서 가냐 energy는
     같아도 되지?"* — and they are right that this is the floor where it matters:
     ENERGY draws one cell's chemistry, which is the same chemistry either way,
     while this floor's whole subject is that the two workouts open DIFFERENT
     doors into it.
     `armFor` was already live and already computed above; only the opening
     state was still "both". The note that argued against preselecting reasoned
     from `ResistanceExercise = 1.0` being uncalibrated — which is an argument
     against claiming an INTENSITY, not against knowing which of two arms a
     bench press is. The categorical mapping is `workoutMapping.js`'s, labelled
     `Mapped`, and reachable.
     `?? "both"` and not `?? arm`: `arm` falls back to "resistance" so the
     picture always has something to draw, and a visitor who arrived without an
     exercise must not be told they did a bench press. No exercise, no door —
     both, as before.
     THE COMPARISON IS NOT LOST. Every beat of the pass sets `show: "both"`, so
     the demonstration still shows two doors; what changes is the picture left
     standing when it ends, and "Watch the comparison again" puts both back. */
  const [show, setShow] = useState(() => armFor(state?.exercise) ?? "both");
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  /* CLEAR — owner (last pass, L2): *"모델이 아닌 부분 눌리면 자동 clear (clear버튼 없애)"*. One
     path for the card, the demonstration and the bell; the nonce reaches the scene. */
  const [clearNonce, setClearNonce] = useState(0);
  const clearPick = useCallback(() => {
    setSelected(null);
    setClearNonce((n) => n + 1);
  }, []);
  /* ── EVIDENCE ON THIS FLOOR — `docs/20260907-fix/evidence_trace_clean.md` ──
     Not a line graph: the network already draws time. Evidence is the pair of
     marks on the selected node or outcome — two lengths, and the lengths ARE
     the evidence; the values (0.xxx) come out only when the pair is pressed
     (progressive disclosure). `showNums` resets with every new selection so
     a fresh node opens on its lengths again.
     And the constellation's two numbers — 120 components, 259 interactions,
     the paper's own — while the pointer rests on the background paper, never
     standing (the two fact lines that stood bottom-left left on 2026-09-06 as
     standing sentences; this is not one). `hovered` is a hero node under the
     pointer, and the hint yields to it. */
  const [showNums, setShowNums] = useState(false);
  useEffect(() => {
    setShowNums(false);
  }, [selected]);
  const [netHint, setNetHint] = useState(false);
  const dwell = useRef(null);
  const onPaperMove = useCallback((e) => {
    clearTimeout(dwell.current);
    /* The hint's own source line is a button — reaching for it must not
       dismiss the thing it is on. */
    if (e.target?.closest?.('[data-testid="signals-net"]')) return;
    if (e.target?.tagName !== "CANVAS") {
      setNetHint(false);
      return;
    }
    dwell.current = setTimeout(() => setNetHint(true), 600);
  }, []);
  const onPaperLeave = useCallback(() => {
    clearTimeout(dwell.current);
    setNetHint(false);
  }, []);
  useEffect(() => {
    if (hovered) {
      clearTimeout(dwell.current);
      setNetHint(false);
    }
  }, [hovered]);
  useEffect(() => () => clearTimeout(dwell.current), []);
  /* WHERE A VIEWER DRAGGED THE TIMELINE TO, in run seconds, or null for "they
     have not". Held as an object rather than a bare number so that dragging back
     to an instant already visited still re-seeds — two drags to 12.0 min are two
     requests, and a bare number would make the second one a no-op. */
  /* THE HAND-SEEK IS GONE WITH THE AXIS THAT DROVE IT — 2026-09-06. Nothing on
     this floor sets a time by hand any more: the pass seeks through `useTour`'s
     own `onSeek`, straight into the scene's clock, and otherwise the run loops.
     Left as a note rather than a `null` prop because a prop that is always null
     is a wire somebody will one day try to use. */

  const shownArm = tourArm ?? arm;
  const standing = useMemo(() => {
    /* THE DRAWN ARM, WHICHEVER SET IT. With one arm drawn nothing is on top of
       anything, and the count would caveat a misreading nobody can make. This
       took the pass's arm alone while there was no control; now that a visitor
       can shut a door themselves, it has to answer to them too. */
    if (!readout || shownArm !== "both") return null;
    const { fused, drawn } = fusedMarks(readout.bands);
    if (!drawn || !fused) return null;
    return { fused, drawn };
  }, [readout, shownArm]);
  /* THE INTRODUCTION IS RUNNING — canon D5, and that is all this now means.
     It is the plate cascade: every part named, in place, one after another, and
     then the scale stands and waits (`gizmo.css` carries why that is the whole
     introduction and why there is no second script). `Gizmos` owns its length
     and reports both ends, so no number is declared here that could say "the
     introduction is finished" while a name was still fading in.

     TRUE ON ARRIVAL AND FOR EVERYONE, INCLUDING A SHARED LINK. This used to be
     `state?.t == null || arrivedFromInside()`, guarding a real defect: a
     storyboard that seeks to its own first beat makes two links naming
     different instants draw the same picture, which is what
     `destination-carries-the-hash` exists to catch. The introduction cannot do
     that any more — it moves no camera and touches no clock, it only shows the
     names of things already on screen — so the guard has nothing left to guard.
     `playing` keeps the same predicate and keeps its reason: a link with an
     instant in it still arrives stopped. */
  /* WHICH OF THE FOUR STATES THIS SCALE IS IN — `silent`, `tour`, `main`. The
     scene owns the machine and reports it through `onIntro`; this file only
     decides what is drawn in each.

     IT USED TO BE A BOOLEAN, AND THAT IS THE BUG THIS REPLACES. `tourOn` was
     `useState(true)` wired straight to `onIntro`, back when the scene reported
     `false` once, at the end of the plate cascade. When the scene became a
     state machine it started reporting the STAGE STRING instead — and `"main"`
     is truthy, so after the tour ended `tourOn` stayed true forever. Three
     Two things broke and neither failed a test: state 4 kept the opening
     sentence on the picture, and the `status === "ready"` line — gated
     `!tourOn` — never rendered again.

     THE THIRD ONE IS THE CELL'S, NOT THIS SCALE'S, and the difference is worth
     keeping straight: `CellScale` draws `WayIn visible={!tourOn}`, so there a
     truthy `"main"` meant the way down never came back at all. This scale is
     the bottom of the descent and has no `WayIn` to lose — measured, not
     assumed: `wayInAtEnd: false` here is correct and the same reading on the
     cell was the defect.

     Deriving the boolean from the state rather than storing a second copy of it
     is what makes that class of drift impossible instead of merely fixed. */
  const [stage, setStage] = useState("silent");
  const tourOn = stage === "tour";
  /* SKIP DURING THE PLAIN LAP — owner, asked what it should do: *"tour건너 뛰고
     그 단계의 마지막 main으로 가는거야"*. It lands where the pass's own Skip
     lands, so a visitor who does not want to be shown anything presses one
     button once.
     REGISTERED FROM THE PAGE, NOT THE SCENE, and that is not a preference. The
     scene is inside `Suspense` and mounts a beat after the page, and until
     something holds the pass `Guide` believes nothing is running and shows its
     resting prompt — measured about 100 ms of "Press any part of the network"
     on a screen whose whole rule is *"화면으로 들어가면 아무런 텍스트 없이"*.
     Registering here closes that window because the page is already there.
     THE PRESS TRAVELS DOWN AS A COUNT because the machine lives in the scene:
     this `stage` is a mirror of it (`onIntro`), so setting it here would be
     overwritten by the scene's own next report. `useTour` replaces this
     registration when the pass starts and restores nothing when it ends, which
     is right — by then the pass owns Skip.
     ONLY WHERE THERE IS A PASS TO SKIP: `playsOnArrival` is the same test the
     scene builds its beats with. */
  const [skipIntro, setSkipIntro] = useState(0);
  useEffect(() => {
    if (stage !== "silent" || !playsOnArrival(state?.entry ?? null)) return undefined;
    return holdTour({ id: "intro", skip: () => setSkipIntro((n) => n + 1) });
  }, [stage, state?.entry]);

  /* THE WALK THIS SCALE PLAYS ON ARRIVAL, and the reason it is a walk rather
     than the tour is in `heroWalk.js`: this scale's storyboard is
     deliberately empty, so before today it arrived and said nothing at all for
     the whole visit. The walk moves no camera and seeks no clock — it only
     names parts that are on screen — so none of what stood the old pass down
     can come back through it. */
  /* THE WALK IS STOOD DOWN, 2026-09-05, AND THE TOUR IS WHY.
     The note above is the walk's own justification and it was true for four
     days: the storyboard was empty, so the scale arrived and said nothing, and a
     walk that moves no camera and seeks no clock was the safe way to give it
     words back. `signalsTour` now fills that storyboard, so the justification is
     spent — and worse than spent, because both would run at once. The walk fires
     on `stage !== "silent"`, which is exactly when the pass is playing, so a
     visitor would meet two narrators writing to one line.
     WHICH ONE HAD TO GO IS NOT A TOSS-UP. The brief asks for a guided comparison
     of 25 to 30 seconds, synchronised to the run, where every beat moves
     something. The walk is 20 beats and 128.7 s, it moves nothing, and its shape
     is the cell scale's *"you might expect … but"* — which the brief names and
     refuses for this floor: *"this floor does not use the 'you might expect...
     but...' formula. Its language is comparison."*
     NOTHING IS DELETED. `heroWalk.js` and its thirteen cases still hold what the
     archive says about each of the thirteen — `heroWalk.test.js` is where the
     door measurements and the PGC-1α finding are pinned, and `signalsTour`'s own
     header quotes them. The file is the record; it is no longer the narrator.
     The press-a-node sentences in `SAYS` are untouched and still play. */
  const walkBeats = useMemo(() => heroWalk(arm, arms), [arm, arms]);
  const walk = useWalk(false, walkBeats, resolveWalkAnchor, WALK_KEY);
  /* THE TOUR STILL WINS WHEN THERE IS ONE. A visitor who pressed a part gets
     that part's sentence, and the walk is only what fills the silence before
     anybody has. */
  /* THE OPENING SENTENCE STANDS UNTIL THE PASS SPEAKS, AND NOT ONE BEAT LONGER.
     Owner, 2026-09-06: *"현재 reveal과 down은 의도적으로 무언인데 직전 말풍선이
     그대로 남아 있어 … 그러면 visitor에게는 silent beat가 아니라 이전 문장을
     읽으면서 카메라가 계속 움직이는 beat가 돼"*.
     THE FALLBACK WAS THE BUG, not the beat. A silent beat DOES report itself —
     `useTour` calls `onLine(beat.line ?? null)` — but this expression then fell
     through to the opener, and the opener is usually the same sentence beat 0
     just said. So the two wordless beats showed the previous words, and the 1.4 s
     and 2.2 s the storyboard bought for the camera were spent reading.
     `useOpenerStanding` alone does not fix it: the reveal lands INSIDE the
     opener's own reading time. What ends the opener is the pass beginning to
     speak, so that is what is asked. Cleared when the tour leaves, so a replay
     opens the same way it did the first time. */
  const [spoke, setSpoke] = useState(false);
  useEffect(() => setSpoke((s) => s || !!tourLine), [tourLine]);
  useEffect(() => {
    if (!tourOn) setSpoke(false);
  }, [tourOn]);
  const opener = openerUp && !spoke ? openerSaid : null;
  const guideLine = tourLine ?? walk.line ?? (tourOn ? opener : null);
  const guideAt = useAim(resolveGuide, !!guideLine);
  const guideClear = useAim(resolveClear, true);
  /* THE TOUR'S LAST SENTENCE LEAVES WITH THE TOUR — the fibre's rule, and its
     wording. A line a visitor PRESSED for stays (canon D2ⓐ, *"글은 그 뒤에
     짧게"*); state 4 is *"아무런 텍스트 없이"*, so the automatic tour ending is
     the one transition that clears it. */
  useEffect(() => {
    if (stage === "main") {
      setTourLine(null);
      setSaidBy(null);
    }
  }, [stage]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadScenario(SCENARIOS.resistance),
      loadScenario(SCENARIOS.endurance),
      loadScenario(SCENARIOS.control),
    ])
      .then(([resistance, endurance, control]) => {
        if (!alive) return;
        setArms({ resistance, endurance, control });
        setStatus("ready");
      })
      .catch((e) => alive && setStatus(`Could not load the three arms — ${e.message}`));
    return () => {
      alive = false;
    };
  }, []);

  // Measured once per load rather than per frame: which nodes each arm moves is
  // a property of the run, not of the instant.
  const routes = useMemo(() => (arms ? routesOf(arms) : null), [arms]);

  // useFrame runs at 60 fps and a readout does not need that. Same throttle the
  // cell and fibre panels use.
  useEffect(() => {
    const id = setInterval(() => live.current && setReadout(live.current), 100);
    return () => clearInterval(id);
  }, []);

  /**
   * The instrument, for the same reason the other scenes carry theirs: three
   * conclusions about this app have been withdrawn and all three were judged
   * from a still frame. Read-only — nothing reads it back.
   */
  useEffect(() => {
    window.__signallingState = () => (live.current ? { ...live.current } : null);
    return () => {
      delete window.__signallingState;
    };
  }, []);

  /* `muscle` and `from` were computed here and rendered nowhere once the arrival
     line went — two lines of descent-formatting kept alive by nothing. Deleted
     rather than left: this file's own opening paragraph is about the gap between
     what is computed and what reaches a pixel, and a dead local is that gap
     pointing the other way. `state` still has a reader: `Ways` below, which
     builds the address it climbs to. It was `Timeline` that read it when this
     was written; that file was deleted on 2026-08-31 and `Ways` inherited the
     job. */

  return (
    <main className="app">
      {/* THE SHELL, 2026-08-30. It overlays rather than divides — opening the
          drawer cannot resize the picture — which is why the right-hand column
          could go and this could come. The scale's own controls live in it now,
          at the owner's word: the panel was the thing being refused, not the
          switches. */}
      <AppShell
        scale={state?.scale}
        /* Nothing in the drawer on this scale. Its only entry was the way out,
           which is in the corner now — and §9's default is empty, so an
           otherwise empty menu is a menu with nothing to say. */
        drawer={null}
      />
      {/* THE WAY OUT LEFT THE DRAWER, 2026-08-30 (canon A2). `← Back to the …`
          was behind a press, on the one control a visitor needs before they
          need anything else. It names its destination the same way, in the
          corner the body scale already used. */}
      <Ways state={state} playing={playing} onPlaying={setPlaying} />

      <div className="body body--single">
        <div className="fiber sig-no-panel">
          <div className="fiber__stage" data-testid="signalling-stage" ref={stageRef} onPointerMove={onPaperMove} onPointerLeave={onPaperLeave}>
            {/* THE STAGE SAYS WHY THE STAGE IS EMPTY. Photographed 2026-08-27
                with the scenario fetch delayed six seconds
                (`.claude/shots/q10/signalling-loading.png`): **930x760 px of blank
                paper**, and the only thing explaining it was a 12 px muted line
                in the top-right corner of the panel — as far from the emptiness
                as this layout can put it. The fibre never looks like that, since
                its geometry is local and only the model output is fetched, so a
                viewer descending fibre → cell meets a screen that reads as
                broken on exactly one of the three.
                Moved rather than duplicated: two places for one fact is the
                defect R3 removed from the transport, and it would be the same
                defect here. The words are unchanged — CLAUDE.md §9. */}
            {status !== "ready" && (
              <p className="stage-status" data-testid="stage-status">
                {status === "loading" ? "Loading the three arms…" : status}
              </p>
            )}
            {/* WHAT THIS SCREEN IS, IN TWO LINES AT THE TOP — the owner's, 2026-08-31,
                and the only place on any of these scales where a standing sentence
                is asked for rather than avoided: *"화면 위 문장은 이것 정도면 돼"*.
                §9's default is empty and this is the exception the owner named, so
                it is the two lines they wrote and no third one.
                The count is NOT in the sentence. Their draft said "a network of 120
                signalling components" and §9 forbids exactly that — *"세어 나오는
                값을 글자로 박지 마라"* — so the number moved to the counter below,
                where it is counted off the archive that is loaded. The subtitle
                keeps its shape without it. */}
            {/* THE FLOOR'S OPENING SENTENCE IS THE BOT'S, NOT A HEADING.
                Owner, 2026-09-05: *"the same muscle cell handles lifting and
                runing differently <- this link this shld be spoken by the bot we
                have also a workout swtches blah blah <- by bot"*.
                It was standing text saying the same thing the walk's first beats
                say, in a second voice, and §9's default is empty. The fibre and
                the body never had one; these two were the outliers. What the
                heading carried is in the walk now, which is where a visitor is
                already looking when they arrive. */}
            {/* THE TWO FACT LINES ARE GONE, 2026-09-06. Owner: *"밋밋한 화면
                텍스트는 fiber말고 다른 층이 막 있던데 얘네 다 빼 불필요해"*.
                They were "13 of 121 components drawn · 264 interactions in the
                model" and the Fowler accuracy pair. Both were true and neither
                was what a visitor came to look at; they sat in the bottom-left
                corner of a 3D scene as paragraphs, which is the shape §9 calls
                a standing sentence.
                §5's floor is REACHING the source, not printing it: every
                labelled number on this floor still carries an `EvidenceBadge`
                (`Gizmos.jsx:768`) that opens the record on a click, so the
                paper's own validation is one press away rather than one
                paragraph away. Nothing else read these two nodes — no test, no
                selector outside `scaleHead.css`'s own hide rule. */}
            {/* THE 0-45 MINUTE AXIS IS GONE — 2026-09-06, owner: "너무 길어
                signalling timeline없애고 훨씬 빨리 하게 해", answering how long the
                plain opening lap should be. It drew the run as
                `15 h settling | 0 min --- EXERCISE --- 45 min`, with a marker and a
                range to scrub by hand.
                WHAT IT SAID IS NOT LOST, which is why it can go. The axis existed
                to make section 5's mismatch visible — the export reads "15 h
                settling, then 45 min held", the owner had drawn a recovery arm this
                archive does not contain, and the grid runs 0.0 to 44.9 MINUTES.
                Those numbers are read off the grid in `signallingBinding.js` and
                still reach the readout; the axis was one way of showing them.
                THE SCRUB WENT WITH IT, and nothing else sought this clock by hand:
                the pass seeks, and otherwise the run loops. */}
            {/* ---- the explorer ------------------------------------------ */}
            {/* NOT UNTIL THE PICTURE IS THE VISITOR'S — 2026-09-06. Owner, of the
                phone's land beat: *"mobile land에서 top chips가 Resistance
                chevron을 가리는 것. 이것만은 실제 UX issue라 해결하는 게 좋아.
                나는 tour 중에는 Both / Resistance / Endurance 칩을 잠깐 숨기는
                쪽이 제일 깔끔하다고 봐. Tour가 끝나면 다시 나타나면 돼."*
                THE LAND BEAT IS WHY IT MATTERS AND NOT ONLY THAT IT OVERLAPS.
                That shot is the tableau — INPUTS at the top, then routes, then
                the outcomes — and on a phone the chips sit exactly on the
                resistance chevron, so the beat that says "Different routes" hides
                where one of the routes begins.
                `stage !== "main"` RATHER THAN "while the tour runs", because the
                owner's arrival grammar puts a plain lap before the pass with the
                same rule: *"이 때는 toggle이고 뭐고 없어 그냥 left header + right
                pause skip"*. Both sentences are the same gate.
                A CONTROL THAT DISAGREES WITH THE PICTURE IS WORSE THAN A MISSING
                ONE anyway: the note below already had the chips lighting from the
                BEAT's arm rather than the viewer's, because a chip lit for your
                workout under a picture drawing both is the control lying. Hiding
                them is that argument carried to its end. */}
            {status === "ready" && arms && stage === "main" && (
              <div className="sig-explorer" data-testid="signals-explorer">
                {/* LIT BY WHAT IS DRAWN, 2026-09-06: while a beat plays the picture
                    draws the beat's `show` (both), and a chip lit for the viewer's
                    own arm under a picture drawing both is the control disagreeing
                    with the thing it controls — this file's own note. `tourArm` is
                    the beat's arm while there is one and null after, so the chip
                    goes back to the viewer's the moment the pass ends. */}
                {/* SHOW — THE FLOOR'S FIRST NON-NEGOTIABLE, AS A CONTROL.
                    Three chips were removed from this scale on 2026-08-30 with
                    every other toggle, and the note that replaced them argued
                    that the exercise upstairs had already answered the question.
                    That argument holds for "which workout is MINE" and does not
                    hold for "which workouts can I SEE" — the brief's opening
                    finding is that a viewer was being told about a comparison
                    they could not look at. BOTH is the default and the other two
                    are for isolating a route after the pass has shown it. */}
                <div className="sig-explorer__group" role="group" aria-label="Which workouts are drawn">
                  {[
                    ["both", "Both"],
                    /* "Resistance" / "Endurance", 2026-09-06 — owner: *"lifting ->
                       resistance, running -> endurance 이 낫지 않을까?"* The
                       plates already say "Resistance exercise · lifting", so the
                       chip carries the term and the plate keeps the gloss. */
                    ["resistance", "Resistance"],
                    ["endurance", "Endurance"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`sig-chip sig-chip--${id}${(tourArm ?? show) === id ? " is-on" : ""}`}
                      aria-pressed={(tourArm ?? show) === id}
                      onClick={() => setShow(id)}
                    >
                      {label}
                      {/* WHICH SIDE IS THEIRS, AND IT IS A MARK RATHER THAN A
                          SENTENCE. Brief §18: the visitor's exercise belongs to
                          one side of the comparison and the floor still shows
                          both. A dot on the chip says that in no words. */}
                      {id === arm ? <i className="sig-chip__yours" aria-label="your workout" /> : null}
                    </button>
                  ))}
                </div>
                {/* NO TRACE ROW, 2026-09-06 — owner: *"Trace / Selected 이건
                    필요할까?"* It was not: pressing a node fades what it is not
                    wired to and pressing again clears it, and the second chip
                    was disabled until then. One row, no labels. */}
              </div>
            )}
            {/* ---- what the pointer is on, and what it reads --------------- */}
            {/* HOVER IS ONE LINE AND SELECTION IS THE PAIR. The brief splits them
                exactly there — *"hover: one-line explanation"*, *"click: … show
                paired Resistance vs Endurance state"* — and the split is right:
                a name under the cursor should cost nothing to dismiss, and a
                comparison should stay put while you read it. `SAYS` is where the
                thirteen sentences already lived; nothing new was written. */}
            {/* NO HOVER PANEL, 2026-09-06 — owner §9: *"Hover: node name"*. The
                name is the plate `platesShown` stands at the node under the
                pointer; a second copy of it in the corner, with a sentence,
                was the click state leaking into the hover state. */}
            {status === "ready" && stage === "main" && netHint && !hovered && !selected && ( /* the pick box has the corner while a node is selected */
              <div className="trace trace--in trace--signals-net" data-testid="signals-net" data-guide-clear="">
                <p className="trace__label">{PAPERS.fowler.network.components} components</p>
                <p className="trace__label">{PAPERS.fowler.network.interactions} interactions</p>
                <p className="trace__foot">
                  <SourceLine paper="fowler" />
                </p>
              </div>
            )}
            {/* MAIN ONLY — 2026-09-07, the orchestrator's call on the lane's
                report: the owner's arrival grammar (*"이 때는 toggle이고 뭐고
                없어"*) is the same gate the chips above carry. A node pressed
                during the lap or the pass stays selected and the panel stands
                the moment main arrives. */}
            {status === "ready" && arms && selected && stage === "main" && (
              <div className="sig-pick" data-testid="signals-pick" data-guide-clear="">
                <p className="sig-pick__name">
                  <b>{SPELLED[selected] ?? readable(selected)}</b>
                </p>
                {SAYS[selected] ? <p className="sig-pick__say">{SAYS[selected]}</p> : null}
                {/* THE PAIRED READING, AND LENGTH IS THE CHANNEL.
                    Brief rule 6, and this floor is its worst case: PGC-1α ends
                    +25.8 % under resistance against +25.7 % under endurance, and
                    no material tint can carry a difference that size — nor
                    should it try, because the honest answer there is that they
                    are level. Two bars whose WIDTH is the value say "level" and
                    "a third of it" with the same mark, and a viewer who cannot
                    separate the two hues still reads the two lengths.
                    READ AT THE INSTANT ON SCREEN, off `heroPair`, so the numbers
                    under the cursor are the numbers in the picture. Nothing is
                    normalised or stretched between the two: the bars are the
                    authors' own activations, and a gap that looks small is
                    small. */}
                {(() => {
                  const t = (readout?.tMinutes ?? 0) * secondsPerMinute;
                  const pair = heroPair(arms, [selected], t);
                  const rows = [
                    ["resistance", "Resistance", pair.r[selected] ?? 0],
                    ["endurance", "Endurance", pair.e[selected] ?? 0],
                  ];
                  /* THE LENGTHS FIRST, THE VALUES ON A PRESS (md: "가능하면
                     숫자도 처음엔 없음. 두 length 자체가 evidence … 누르면
                     actual model values reveal"). Three decimals as the md
                     sketches — the archive rounds to four (`sampling.round_digits`). */
                  return (
                    <dl
                      className={`sig-pair${showNums ? " sig-pair--open" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={showNums}
                      aria-label={showNums ? "Hide the values" : "Show the values"}
                      onClick={() => setShowNums((s) => !s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowNums((s) => !s);
                        }
                      }}
                      data-testid="signals-pair"
                    >
                      {rows.map(([armId, label, v]) => (
                        <div key={armId} className={`sig-pair__row sig-pair__row--${armId}`}>
                          <dt>{label}</dt>
                          <dd>
                            <span
                              className="sig-pair__bar"
                              style={{ width: `${Math.min(100, Math.max(0, v * 100))}%` }}
                            />
                            {showNums && stage === "main" ? <span className="sig-pair__num">{v.toFixed(3)}</span> : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  );
                })()}
                {/* EVIDENCE ONLY AFTER THE PHENOMENON (md rule 3). A node can be
                    pressed during the plain lap or the pass — nothing stops the
                    press — and the panel then shows its two lengths as it always
                    has; the values and the paper line are the evidence, and they
                    wait for main. */}
                {stage === "main" && (
                  <p className="sig-pick__source">
                    <SourceLine paper="fowler" />
                  </p>
                )}
              </div>
            )}
          {/* THE TRANSPORT FLOATS ON THE PICTURE NOW THAT THE HEADER IS GONE.
              Rex: "시간이나 위에 header이런건 그냥 빼야되고". A bar across the top
              was a row of chrome above the thing a viewer came to look at, and
              the only items in it that DID anything were these — press, scrub,
              speed. They sit on the stage instead, where the thing they drive
              is, and the way between scales moved to the trail at the foot,
              which was already saying where the viewer is. */}
            {/* THE ONE CONTROL THAT CHANGES WHAT IS DRAWN, ON THE PICTURE IT
                CHANGES — the fibre scale's level ladder, one scale down, and
                the same canon F2 words the owner used for it: *"Gizmos식 토글도
                제발 main 화면 안에 디자인 ㅈㄴ 잘 입혀서 floating하게 어딘가에
                두는걸 목표로 해."* Same classes and same corner deliberately:
                these are the two scales that have a "what is drawn" switch at
                all, and one control language across them is worth more than a
                second stylesheet saying the same thing in different pixels.
                `fiber.css` carries the placement and why the left edge is the
                corner free at every width — and its own warning that the gizmo
                solver does not know this is here, which the opaque ground is
                the answer to.

                HIDDEN WHILE THE NAMES ARRIVE, PRESENT EVER AFTER — canon §0's
                two states, with `tourOn` as the latch exactly as on the fibre.
                It is NOT hidden during a demonstration: this is the main state,
                a demonstration is something a visitor asked for inside it, and
                the ring for the next part is drawn throughout for the same
                reason.

                AND IT READS `shownArm`, NOT `arm`. While a beat is driving the
                picture the lit position is the beat's — a control that says
                "Both" over a canvas drawing one fan is the defect measured here
                on 2026-08-26. A press is one of `cinematic.js`'s INTERRUPTS, so
                touching this ends the open demonstration on its way down and
                the picture is the visitor's on the same gesture; there is no
                state to hand back because the beat's arm was never stored.

                NOT PORTALLED. `DrawerSlot` is how a scene's state reaches the
                shell; this is a control on the scene's own stage. */}
            {/* NO ARM SWITCH. Three chips — Both / Resistance / Endurance —
                stood here and asked a visitor to choose the thing they chose on
                the first screen. `ARMS_SHOWN` above is kept with its reasoning
                because that reasoning is still the record of why the order was
                fixed and why nothing was preselected, and the reversal is
                written beside `arm`. What replaced the control is not another
                control: the exercise decides, and the picture says which bout it
                is drawing in the bout's own colour. */}
          {/* NO TIMELINE STRIP, 2026-08-30 (canon D3): the run plays itself.
              The clock, the speed chips and the scrubber were the last thing on
              this stage asking a viewer to operate the recording rather than
              watch it. A pause is coming to the top-right as its own item; this
              does not invent one. */}

            {/* THE PASS'S LINE, AND IT IS THE ONLY SENTENCE THIS STAGE HAS EVER
                CARRIED. §9's default is empty and stays empty: it is here while a
                beat is on screen and gone the moment the pass ends, so what is on
                the picture is only ever what is happening on it right now. The
                fibre stage has a standing note this replaces while it runs, and
                so does this one now.

                WHAT IT REPLACES, AND WHY IT HAD TO EXIST. Measured 2026-08-26 on
                a shared link with the instant pinned — which is how a link
                somebody sends you arrives, with no pass running — this scale put
                ZERO sentences on its picture and five in the panel beside it.
                One of those five is the caveat that makes the picture readable:
                `SignallingReadout.jsx` says why it exists — *"A reader who takes
                '11 of 58 separating' off the picture is reading a distinction
                the picture cannot draw, and that is a misreading a real person
                makes on sight."* A caveat against a misreading made ON SIGHT
                belongs where the sight is. It stays in the panel too; the same
                `fusedMarks` answers both, so they cannot disagree. */}
              {/* `role="status"`, which the pass has never had. The three lines of every
                pass — including the question each one now asks and the answer that
                follows it — changed on screen and were announced nowhere, so the
                chance to be wrong existed for sighted viewers only. `Descent.jsx`
                already did this, and as of 2026-08-30 it is the only other surface
                that does: `App.jsx`'s blocked-question notice and `Director.jsx`'s
                ride card were the other two named here and both went with the film.
                The passes were still the omission, not the pattern.
                A polite live region rather than an alert: this is narration, and it
                may wait for whatever the reader is in the middle of. */}
            {/* THREE THINGS CAN BE IN THIS ONE SLOT, and the order is what the
                visitor has earned — the fibre stage's order, and the same
                reasoning. A sentence they pressed for outranks everything and
                STAYS (canon D2ⓐ). Before any press, the storyboard's opening
                line stands while the names arrive, and then the stage's own
                caveat takes the foot back.
                THE CAVEAT IS NOT DELETED AND ITS CONDITION IS UNCHANGED: it
                needs both arms drawn, because with one hidden nothing is on top
                of anything. What changed is that it is no longer the only
                sentence this screen has ever shown — canon S1's complaint was
                that a visitor's first and only sentence here was an apology for
                the drawing. */}
            {/* STATES 1 AND 4 SAY NOTHING AT ALL — the owner's first and fourth lines
                are both *"아무런 텍스트 없이 (Full Animation the default)"*. So this
                scale writes on its picture only while the tour is speaking or a
                visitor is holding a part open. `MuscleFiberVisualization`
                carries the long form. */}
            {tourLine || (tourOn && opener) ? (
              /* `data-testid` STAYS EXACTLY AS CONDITIONAL AS IT WAS. Around
                 fifteen browser cases wait for this element's ABSENCE on 90 s
                 timeouts, so mounting it permanently hangs all of them. */
              <p
                /* CARRIED, NOT DELETED — see `MuscleFiberVisualization.jsx`
                   for the whole reason. The character says it; this stays as
                   the live region and as the element the browser cases watch. */
                className={`fiber__spent fiber__spent--tour say--carried${tourLine ? "" : " fiber__spent--opener"}`}
                role="status"
                data-testid="tour-line"
              >
                {/* KEYED ON THE INNER SPAN, NOT THE PARAGRAPH. The paragraph is
                    the live region and has to stay mounted for a screen reader
                    to hear the next line; the span remounts per sentence so the
                    fade runs per sentence. `fiber.css` carries what that fixes. */}
                <span className="say__body" key={tourLine ?? opener}>
                  {tourLine && saidBy ? <b className="say__of">{saidBy}</b> : null}
                  {plainLine(tourLine ?? opener)}
                </span>
              </p>
            ) : null}
            <Guide
              /* AT REST IN MAIN — owner (last pass, L5): the bell walked onto the pressed node and covered what a visitor wanted to press next. It speaks from its corner now. */
              at={stage === "main" ? null : guideAt}
              line={guideLine}
              clear={guideClear}
              name={tourLine ? saidBy : null}
              /* ANNOUNCED WHEN NOTHING ELSE IS ANNOUNCING IT. The paragraph
                 below is mounted only while the TOUR is speaking; the walk's
                 own sentences never reach it, so on those the guide is the only
                 speaker and has to be the live region. Getting this wrong in
                 either direction is a real defect — silence for a screen reader,
                 or the same sentence read twice. */
              announce={!(tourLine || (tourOn && opener))}
            />
            {/* THE OVERLAP SENTENCE IS NOT DELETED AND ITS CONDITION IS
                UNCHANGED — §9, and the owner ruled on this class of copy
                directly. What changed is that it no longer STANDS: state 4 is
                *"아무런 텍스트 없이"*, and this was the only sentence a visitor
                met on arriving, which is exactly the complaint canon S1 opens
                with — *"화면에 남은 유일한 문장이 그림이 겹친다는 변명이다"*.
                It is still true (it counts the two ARMS of one node fusing, not
                neighbours occluding, so this morning's three-column layout did
                not touch it) and it still has to reach a visitor. Where it goes
                is the walk-through's to settle. IT GOES WHERE THE OTHER
                EXPLANATIONS WENT — the tour — because that is now the only time
                this scale writes on its picture, and a caveat about a misreading
                made ON SIGHT has to be on screen while somebody is being shown
                the marks. `signallingClaims` caught the first version of this
                edit, which took the sentence out and gave it nowhere: the
                condition is still `standing`, so it still needs both arms drawn
                and still counts with the same `fusedMarks` the panel counts
                with. */}
            {/* NO OVERLAP CAVEAT. It said "N of M marks are drawn as one — closer
                than a mark is wide", and it was true and necessary of a picture
                that put a hundred and twenty-one marks on five shelves: two arms
                of one node could land within `ARMS_FUSE_BELOW` of each other and
                read as one. This picture draws twelve objects on a grid with a
                row and a column each. Nothing fuses, so the sentence would be
                warning a viewer about a misreading the drawing can no longer
                produce — which is worse than saying nothing, because it teaches
                a reader to distrust a thing that is fine.
                `fusedMarks` and `ARMS_FUSE_BELOW` stay in `signallingGeometry.js`
                with the census builder they measure; if the marks ever come back,
                so does the sentence, and `signallingClaims.test.js` still holds
                the claim there. */}

            {!hasWebGL() ? <NoWebGL what="The network map" /> : (<>

            {/* ON THE CANVAS, NOT ON ITS CONTAINER, and the difference was measured
            the hard way. Q34 R2 first put `role="img"` and the label as props on
            <Canvas>; R3F does not forward them to the canvas element, it puts
            them on the container it wraps around it — and `role="img"` makes
            every descendant presentational, so on the cell scale 6 of 6 plates
            and 4 of 5 badges left the accessibility tree, and on signalling 5 of
            5 and 5 of 10. The fix was worse than the defect and only a probe
            that counted what was INSIDE the labelled node caught it.
            `onCreated` reaches `gl.domElement`, which is the canvas and nothing
            else. */}

            <Canvas
              onPointerMissed={() => { if (selected) clearPick(); }}
              /* PCF AND NOT PCF-SOFT — `CellScale.jsx` carries the argument and
                 `anatomyStyle.SHADOW` the numbers. R3F's bare `shadows` picks
                 `PCFSoftShadowMap`, which ignores `shadow-radius`, and a soft
                 drawn shadow on a 1024 map is what this picture wants. */
              onCreated={({ gl }) => {
                gl.domElement.setAttribute("role", "img");
                /* THE NAME, WITHOUT THE PROMISE — see
                   `MuscleFiberVisualization.jsx`. This one said the counts are
                   "on the plates beside it", and `SHOW_FIGURES` is what draws a
                   plate's count. `SignallingReadout` does still render, so only
                   the counts half was false here; a half-true sentence is still
                   a sentence a screen reader cannot act on. */
                gl.domElement.setAttribute("aria-label", "Three-dimensional map of the signalling network.");
              }}
              camera={{
                /* Mounted ON the resting shot, so the first frame is the frame
                   and nothing eases into it. */
                position: STANDING.camera,
                fov: SCENE.camera.fov,
                near: SCENE.camera.near,
                far: SCENE.camera.far,
              }}
              dpr={SCENE.dpr}
              gl={SCENE.gl}
            >
              <Suspense fallback={null}>
                {arms && routes && (
                  <SignallingSceneContent
                    guideRef={guidePoint}
                    clearRef={clearPoint}
                    guideAnchor={walkAnchor}
                    arms={arms}
                    routes={routes}
                    descendedArm={armFor(state?.exercise)}
                    entry={state?.entry ?? null}
                    /* ON THE HANDOFF, NOT ON THE STATE — `main.jsx` puts the
                       crossing record under `state.handoff` (`below = { ...state,
                       muscle, handoff: context }`); `state.ampk` is nothing and
                       read silently as "no purple to hold". Measured 2026-09-06:
                       the first cut of this read `state?.ampk` and AMPK arrived
                       in stone from ENERGY. `signallingClaims.test.js` holds
                       the key. */
                    handedAmpk={state?.handoff?.ampk ?? null}
                    veilRef={veilRef}
                    replay={replay}
                    playing={playing}
                    /* THE VIEWER'S OWN AGAIN. It was hardcoded `"both"` while
                       there was no control to hold it; the scene has always
                       taken an arm because the pass sets one on four of its
                       beats, and `shownArm` inside still resolves
                       `beat?.arm ?? arm` exactly as before. */
                    arm={arm}
                    /* THE THREE THE EXPLORER OWNS. `show` opens at "both" and is
                       the brief's first non-negotiable; `selected` is the node a
                       viewer pressed; the two callbacks carry the pointer back
                       up so the naming and the paired readout are DOM rather
                       than another thing drawn into the canvas. */
                    show={show}
                    selected={selected}
                    hovered={hovered}
                    onHover={setHovered}
                    onSelect={setSelected}
                    onClear={clearPick}
                    clearNonce={clearNonce}
                    onIntro={setStage}
                    skipIntro={skipIntro}
                    onOpener={setOpenerSaid}
                    onTourArm={setTourArm}
                    onTourLine={(line, by, { unsay = false } = {}) => {
                      /* THE LINE STAYS — canon D2ⓐ's last clause, *"글은 그 뒤에
                         짧게"*. A demonstration ends by handing back `null`, and
                         under the old pass that meant "wipe the screen": the
                         sentence a viewer had just earned by pressing something
                         vanished a moment later, and this stage — which has no
                         standing note of its own beyond the fused-mark caveat —
                         went back to apologising for the drawing. So `null` is
                         "nothing more to say", not "unsay it". What replaces a
                         sentence is the next sentence, which is another press.

                         The `setTourOn(false)` latch went with it. It answered
                         "has this screen already shown its pass", and there is
                         no pass to have shown: `tourOn` is now only whether the
                         introduction is still running (canon D5), which is a
                         fact about arriving and not about what anybody
                         pressed.

                         AND `null` MEANS THE OTHER THING WHILE THE PASS IS
                         RUNNING — 2026-09-06. One handler serves two callers.
                         A press hands back `null` when its demonstration ends
                         and the sentence it earned must stay. A BEAT hands back
                         `null` because the beat is wordless on purpose, and
                         there the same rule leaves the previous sentence up
                         through it. Owner: *"현재 reveal과 down은 의도적으로
                         무언인데 직전 말풍선이 그대로 남아 있어 … 그러면
                         visitor에게는 silent beat가 아니라 이전 문장을 읽으면서
                         카메라가 계속 움직이는 beat가 돼"*. The storyboard buys
                         1.4 s and 2.2 s for the camera and both were spent
                         reading. `stage === "tour"` is the difference and the
                         page already holds it. */
                      if (line !== null) {
                        setTourLine(line);
                        setSaidBy(by ?? null);
                      } else if (stage === "tour") {
                        setTourLine(null);
                        setSaidBy(null);
                      } else if (unsay) {
                        /* the one case that does unsay: a clear (L2/L5) */
                        setTourLine(null);
                        setSaidBy(null);
                      }
                    }}
                    startAt={state?.t ?? 0}
                    /* The same 10 Hz reading the panel prints — see
                       CellScale.jsx for why it is handed back in rather than
                       throttled a second time inside the canvas. */
                    reading={readout}
                    onRead={(d) => {
                      live.current = d;
                    }}
                  />
                )}
              </Suspense>
            </Canvas>
            <div className="sig-veil" ref={veilRef} aria-hidden="true" style={{ backgroundColor: SCENE.background }} /></>)}
            {/* THE RIGHT SIDEBAR IS GONE on 2026-08-30, by the owner: "right
                sidebar 삭제해", following "toggle들은 다 없애자 <- guided pass에만
                집중해". The screen is the picture and the pass now; the panel was
                the last furniture standing beside them.
                WHAT WENT WITH IT, NAMED SO IT CAN COME BACK: the orientation
                sentence ("Each dot is one order this cell passes on…"), the twelve
                destinations in plain words, and the note that two of them move as
                one. Those are one day old and they are the payoff of the whole
                four-scale descent — `signallingBinding.js`'s `plainly` and its
                test in `signallingClaims.test.js` are both untouched and still
                green, so the words exist and only their home is missing. The pass
                is where they belong under this direction; that is a change to the
                storyboard's shape and it is the owner's to make, not a thing to
                slip in while deleting a panel.
                WHAT COULD NOT GO, AND DID NOT: `SignallingReadout` still renders,
                on the stage, because CLAUDE.md §9 does not let loading, progress
                or error text be deleted — the out-of-range banner, the carried
                instant, the replay seam and "Waiting for the first frame…" are all
                its and all still there. What it lost is the standing prose, not
                the disclosures. */}
            {status === "ready" && (
              <SignallingReadout
                drawn={readout}
                arms={arms}
                routes={routes}
                /* THE DRAWN ARM — the pass's while it runs, the switch's the
                   rest of the time. Both roots read the one expression. */
                arm={shownArm}
                requestedT={state?.t ?? null}
              />
            )}
          </div>
        </div>
      </div>

      {/* NO CLOSING STRIP, 2026-09-06. It stood 80 px tall under the canvas on
          every visit after the pass — a farewell sentence and four buttons —
          and the orchestrator's brief deletes it outright: the ways
          out are the shell's (Go Home, the floor above), and a card over the
          end of the picture is the opposite of state 4's *"아무런 텍스트 없이"*.
          `signallingClaims.test.js` holds the absence. */}

      {/* NO FOOTER, 2026-08-30 (canon D4). It held three things and none is
          lost. `ScaleTrail` was `<span>`s by design — its own file says "all
          three would promise a click that does not happen" — so it was never a
          way anywhere; the exit is the top-bar chip. Both sentences live word
          for word in `provenance/SourcePanel.jsx`, which any evidence badge
          opens, so §5's floor is reach and it is intact. */}
    </main>
  );
}
