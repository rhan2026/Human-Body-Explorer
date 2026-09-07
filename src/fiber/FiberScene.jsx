/**
 * The R3F content of the fiber visualization: lights, the current scale level,
 * its labels, and the frame loop that drives both from the simulation.
 *
 * Goes inside a Canvas. MuscleFiberVisualization owns that Canvas; keeping this
 * separate is what lets the anatomy page later drop this scene into its own
 * existing Canvas instead of nesting a second one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { OrbitControls } from "@react-three/drei";
import { LIGHTS, CONTROLS, SCENE } from "../anatomyStyle.js";
import { LEVELS } from "./fiberGeometry.js";
import {
  advance,
  burstsArrived,
  createFiberState,
  settleAt,
  storeFullScale,
  EXERCISE_MODES,
  DEFAULT_MODE,
  storeCeilings,
  forcePeaks,
} from "./fiberSimulation.js";
import { useCameraTransition } from "./useCameraTransition.js";
import { frameCamera, turnedFrame } from "./fitCamera.js";
import { SHOW_FIGURES } from "../uiMode.js";
import { SILENT_MS, useTour } from "../tour.js";
import { useCoverOpen } from "../crossing.js";
/* Which drawn roles a named part is — the press and the spotlight both read it.
   Anchor ids and mesh roles were named separately; this is the join. */
const ROLES_OF = {
  myosin: ["myosin"], actin: ["actin"], tropomyosin: ["tropomyosin", "troponin", "calcium-ion"],
  sr: ["sarcoplasmic-reticulum", "calcium-ion"], "t-tubule": ["t-tubule"],
  "muscle-fiber": ["muscle-fiber", "muscle-fiber-focus"], perimysium: ["fascicle-boundary"], focus: ["muscle-fiber-focus"],
  /* The fibre level's four — owner, FIBER pace 7. Ids are that level's anchor ids. */
  sarcolemma: ["sarcolemma"], myofibril: ["myofibril"], myonucleus: ["myonucleus"], mitochondrion: ["mitochondrion"],
};
const FILAMENT_IDS = new Set(["myosin", "actin", "tropomyosin"]);
/* The fibre level's parts are big on screen in a close-up — a 40 px keep-off left the guide on the nucleus (pace 2, F2). */
const FIBRE_IDS = new Set(["sarcolemma", "myofibril", "myonucleus", "mitochondrion"]);
const ANCHOR_OF_ROLE = Object.fromEntries(Object.entries(ROLES_OF).flatMap(([id, roles]) => roles.map((r) => [r, id])));
const _close = new THREE.Vector3();
const _wideV = new THREE.Vector3();
import { fiberParts, fiberTour } from "./fiberTour.js";
import { createRunClock, stepRunClock } from "../runLoop.js";
import Gizmos from "../gizmo/Gizmos.jsx";
import WayIn from "../wayin/WayIn.jsx";
import Handle from "../gizmo/Handle.jsx";
import { CELL_CAMERA } from "../cell/cellGeometry.js";
import { ENERGY_CAMERA, buildCellChainLevel } from "../cell/cellChainGeometry.js";

/**
 * What the callouts say, and only two of them say a number.
 *
 * THE PANEL IS NOT WHERE THIS BELONGS AND THAT IS THE WHOLE CHANGE. A `<dl>` of
 * eleven rows four hundred pixels from the tissue asked a viewer to carry a
 * falling number across the screen to a torus that was already dimming, and
 * then to work out that the two were the same fact. The store's digits now sit
 * on the cisterna that holds it and the burst count on the tubule the burst
 * arrives at, so the causal chain — a command lands, the supply answers it, the
 * supply is lower each time and the command never is — is readable in one
 * glance at one place (docs/fixing-prd.md §0, §2.1).
 *
 * `gizmoContract.assertLabelled()` is why the evidence word and the record ride
 * along: a callout carrying a value makes a claim, and the six anatomy names
 * below carry none and need none. Both words are `Derived` and both `why`
 * strings say what OUR arithmetic did, because neither number is one an author
 * printed — `Ca_SR_total` is theirs and the rounding is ours, `cycle_s` is
 * theirs and the repetition count is ours by the file's own `whose_protocol`.
 *
 * Unbound there is no protocol and no store, so every anchor falls through as
 * the bare noun it always was rather than reading 0 — an empty store drawn
 * over the invented curve would claim a depletion nothing modelled.
 */
function fiberGizmoItems(anchors, reading, scenario) {
  const protocol = scenario?.protocol;
  /* THE PROTOCOL IS THE FIRST THING OFF A PHONE. Measured at 320 px: the plate
     is capped at `calc(100vw - 60px)` = 260, this one's value and unit alone
     render 226 px wide, and the evidence badge was pushed to x 251..317 —
     outside a plate ending at 268, which `gate-legibility` calls an evidence
     word cut off by its own container. The name had already collapsed to width
     0 (the known Q17 R8 behaviour, TODO'd).
     So the clause folds the way signalling's two split plates do at the same
     breakpoint: the protocol rides at 421 px and up, and on a phone the unit is
     the noun. Nothing is lost — `whose_protocol` and the burst plate's own
     `why` carry the cycle and the frequency at every width, one press away. */
  const narrow =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 420px)").matches
      : false;
  /* THE PHONE FOLD FOR "TROPOMYOSIN + TROPONIN · CALCIUM LANDS ON TROPONIN" IS
     GONE, AND SO IS ITS SUBJECT. The plate caps at `calc(100vw - 60px)` = 260 px
     and that was the one sarcomere label that overflowed it — screenshotted at
     320 during the landing beat as "CALCIUM …". Canon F1 took the role clause
     off the plate outright (the pass says it), so there is no label left here
     that needs a hand-picked width case. The protocol clause below still folds:
     that one is a VALUE's unit, not a name, and it overflows for a different
     reason. */
  return anchors.map((anchor) => {
    if (anchor.id === "t-tubule" && reading && protocol?.repetitions > 0) {
      return {
        ...anchor,
        value: `${burstsArrived(reading.time, protocol)} of ${protocol.repetitions}`,
        /* THE PROTOCOL, IN THE UNIT, because a count of bursts is true of every
           protocol and this screen draws one under all six exercises. Q24
           measured what that costs: on the authors' resistance pattern (40 Hz,
           6 s cycle, 60 s — Fig 8A/B) SOCE separates the last repetition's
           force by 76 %, on their HIIT stride (120 Hz, 20 s) by 0.3 %, and the
           whole of their Figure 8 is that the two differ. A bench press drew
           the sprint stride and said nothing. Read off `protocol`, never typed
           — `gate-legibility` reads the same two fields out of the shipped
           JSON, so an archive that changes its cycle moves this line with it. */
        /* "STRIDE" IS THE AUTHORS' WORD FOR THIS CYCLE, and it is here because
           this route can be a bench press. All six exercises draw this one run,
           and the protocol under it is the running one — Figure 8C, "designed
           to mimic gastrocnemius medialis activity during running", with the
           methods paragraph calling the 0.65 s cycle a stride in those words.
           Four of the six movements are resistance. §5 says show the mismatch
           rather than hide it, and one word next to the breadcrumb is the
           cheapest way to make it visible. */
        unit: narrow
          ? "bursts"
          : `bursts · a ${protocol.cycle_s} s stride at ${protocol.freq_hz} Hz`,
        evidence: "Derived",
        why: "counted off the run's own protocol; cycle_s is the authors', the repetition count is ours",
        provenance: scenario,
      };
    }
    if (anchor.id === "sr" && reading?.store != null) {
      return {
        ...anchor,
        value: String(Math.round(reading.store)),
        /* The comparison, in the unit, because it is what makes one reading
           mean anything: 168 is a number and "168 of 941" is a store that has
           emptied. Full scale is read back out of THIS run rather than typed —
           `soce_on` rests at 941.2 µM and `soce_off` at 930.5, and a constant
           here would print one run's resting load over the other's. */
        unit: `µM of ${Math.round(storeFullScale(scenario))}`,
        evidence: "Derived",
        why: "Ca_SR_total at this instant, against this run's own first sample; the division is ours",
        provenance: scenario,
      };
    }
    return anchor;
  });
}

/**
 * What the fibre's entrance leads to.
 *
 * The builder and the camera are the CELL's own — imported rather than
 * described — so a preview cannot drift from what a viewer arrives at. If
 * `buildCellLevel` changes shape, the disc changes with it.
 */
const CELL_SEAM = Object.freeze({
  to: "cell",
  /* THE DESTINATION'S OWN BUILDER, AND IT HAD DRIFTED TO THE OLD ONE — 2026-09-04.
     This built `buildCellLevel`, and the cell scale has drawn
     `buildCellChainLevel` since the chain rewrite; `CellScale.jsx` says so in the
     past tense at its own model line. So the coin promising "this is the room you
     are about to be in" showed a room that no longer exists.
     THIS IS THE SECOND TIME THE SAME DRIFT HAS BEEN FOUND. `CellScale`'s own
     signalling seam had it, was caught, and the note there records the same
     sentence — `previewLevel`'s rule 1 is that the group comes from the
     destination's own builder "called by the name the destination calls it by",
     and a frozen constant in a different file is exactly where that rule goes
     quiet. It went unnoticed both times because the coin is small.
     No gate can see this by reading one file, which is why the note is here and
     not only in a commit. */
  build: buildCellChainLevel,
  camera: ENERGY_CAMERA,
  /* The busiest corner of that room — owner, 11 — seen from ENERGY's own angle. */
  /* THE CALCIUM SIDE — 2026-09-07, owner (FIBER pace 8): *"아직 별로임"*. AMPK +
     CaMKK2 framed two resting blobs with nothing moving in the disc; the stream
     of calcium into CaMKK2 and the packets leaving it are 1.1 units to the right
     and are what this seam carries. Camera lands at z 2.6, outside the z 1.0
     wall (fov 20 keeps the corner large from out there). */
  /* THE WHOLE ROOM, A LITTLE CLOSER — 2026-09-07, owner: *"코인은 다음 스테이지의 전체를
     보여주기로 하지 않았어?"*. Same rule as ENERGY's coin of SIGNALS. margin 0.9 keeps
     the camera outside the z 1.0 membrane (0.45 stood inside it — the milky disc). */
  margin: 0.6, /* 1.15, 0.95, 0.72 — owner: "0.6" */
  centre: [0, 0, 0], /* the room's own centre, not the parts' */
});

/** Scratch vector for the guide's projection — one per module, never allocated
    in the frame loop. */
const _guideV = new THREE.Vector3();
const _avoidV = new THREE.Vector3();

/** How far an unselected part is washed toward the stage's paper. 0.62 is the
    most that still leaves every part's own hue readable — below that the two
    filament tans stop separating from each other, above it the near-black
    Z-disc turns to paper and the sarcomere loses its ends. */
const WASH = 0.62;

export default function FiberScene({
  level = "sarcomere",
  exerciseMode = DEFAULT_MODE,
  intensity = 0.7,
  isActive = true,
  motion = null,
  scenario = null,
  axis = null,
  playing = true,
  /** Replay speed for a bound run. 1 is the model's own seconds; see useFrame. */
  replay = 1,
  showLabels = true,
  showGrid = false,
  startAt = 0,
  tourOn = false,
  /** Presses of the strip's `again`; each one replays the guided pass. */
  tourNonce = 0,
  onTourLine,
  /* WHETHER A DEMONSTRATION IS PLAYING RIGHT NOW. Not derivable outside this
     component: `stage` is "main" for every part demonstration (canon D2ⓐ), and
     `onTourLine`'s value is deliberately STICKY — a demonstration ends by
     handing back `null` and this scale takes that as "nothing more to say",
     not as "unsay it". So the last sentence stays on screen after the pass is
     over, and anything reading it as "a pass is running" is wrong from the
     second demonstration onward. */
  onRunning,
  /** WHERE THE GUIDE SHOULD STAND, written per frame in CANVAS pixels.
      A ref and not a callback: this is projected inside the render loop, and
      turning sixty projections a second into sixty React renders to move one
      box is what the body scale's readout already got wrong. `useAim` reads it
      at 50 Hz on the DOM side. */
  guideRef = null,
  /** WHICH PART THE WALK IS NAMING, written by the page's walk. A ref and not a
      value so a beat changing does not re-render the canvas. It wins over the
      pressed part and over the beat's own focus, because on arrival the walk is
      what is speaking — see `fiberWalk.js`. */
  guideAnchor = null,
  /** Told when the arrival cascade — canon D5's whole introduction — starts
      and finishes. Reported by `Gizmos`, which runs it. */
  /** THE PASS CHANGES THE LEVEL, so the level's owner has to hear about it.
      `level` is a prop — `DevFiberScene` holds it, because the chips outside
      this canvas set it too — and the descent's first three beats are a model
      swap. Without this the storyboard could name a level and nothing would
      happen, which is the exact shape of the `onIntro` defect this scale
      already paid for once (a callback the scene called and the page read as a
      different type). */
  /** THE EXPLORER'S THREE MODES, EXPRESSED AS A WINDOW ON THE RUN.
      `{ from, to, speed }` narrows the loop the frame loop already runs: ONE
      PULL is one cycle slowed down, FULL SET is the whole bout at 1x, and null
      is the archive's own bounds. It is a window and not a new clock because
      every quantity this floor draws — signal, calcium, store, cross-bridges,
      shortening, force, phosphate — is read from the same seconds, and a second
      clock is how two of them start disagreeing. */
  runWindow = null,
  /** COMPARE parks the run on one instant. Null the rest of the time. */
  freezeAt = null,
  /** The muscle the visitor picked upstairs, as its mesh id — the descent's
      first beat names it, so going in is going into THEIRS. */
  muscle = null,
  onLevel = null,
  /** WHICH REPETITION THE COMPARISON IS SHOWING, or null when it is not. The
      DOM draws the two meters; the canvas cannot, and should not try. */
  onCompare = null,
  onIntro = null,
  /** The page takes its own furniture down when the way down is pressed. */
  onLeave = null,
  /** Bumped when the page's Skip is pressed during the plain contraction. */
  skipIntro = 0,
  /** The storyboard's own opening sentence — the one beat with no part, which
      names the picture rather than any piece of it. Reported up so the page can
      stand it before anybody has pressed anything (canon G1). */
  onOpener = null,
  /** The simulation state as the parent last sampled it, ~10 Hz. The callouts
      are React and the frame loop is not, so they read this rather than the
      ref below — a plate driven off a mutable ref never re-renders and shows
      the value it had when the scene mounted. */
  reading = null,
  onState,
  /** Called with the request this scene could not honour, or null. */
  onRange,
  /** THE EVIDENCE TRACE'S TWO HANDLES (`src/trace/`, 2026-09-07). `seekRef`
      is filled with the same seek the storyboard uses — settle, then re-seed
      the clock — so a pointer moving along the trace moves the picture through
      the one door a seek has. `onOpen` reports which ring is open, so the
      store's own evidence (941 → 168 µM) can appear only when the store was
      pressed. A ref for the seek because it is called from a pointer event at
      pointer rate, not from a render. */
  seekRef = null,
  onOpen = null,
  /** The whole model's place on the canvas, `{x, y, w, h}` in canvas pixels,
      written per frame — what the evidence trace keeps off when the camera
      brings the tissue onto it. The level's declared frame, projected. */
  avoidRef = null,
}) {
  const spec = LEVELS[level] ?? LEVELS.sarcomere;

  // Rebuilt only when the level changes. The simulation state survives the
  // rebuild, so switching scale mid-contraction does not restart the rep.
  const model = useMemo(() => spec.build(), [spec]);
  useEffect(() => {
    model.group.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      // A translucent sheath casting a hard shadow is the "dirt" anatomyStyle
      // warns about, so the two that are see-through only receive.
      /* NOTHING CASTS AND NOTHING RECEIVES — the fibre's shadow map came off on
         2026-09-06. These two flags cost nothing with no map, and leaving them
         would be the scene saying it takes part in something that no longer
         happens. */
    });
  }, [model]);
  useEffect(() => () => model.dispose(), [model]);

  const state = useRef(createFiberState());
  /* The loop's own clock, alongside the simulation's. A bound scenario is a
     finite recording and `advance` has no end to stop at; runLoop.js is what
     ends it, holds it, and cuts it back to the top. */
  const clock = useRef(createRunClock(0));
  /* The pass's own speed, held here rather than pushed at the parent: the chips
     in the transport are the viewer's setting and the pass must not overwrite
     what they chose. When it ends this goes null and `replay` is theirs again. */
  const [tourReplay, setTourReplay] = useState(null);

  /* THE GUIDED PASS DRIVES THE CAMERA WHILE IT RUNS, AND HANDS IT BACK WHEN IT
     STOPS. `useCameraTransition` already re-arms on a changed destination, so a
     storyboard is just a destination that changes on a timer — and when the pass
     ends, `enabled` goes false and the ease stops fighting the viewer's orbit.
     Falling back to `spec.camera` rather than to wherever the last beat left it:
     the level's own framing is where this scene means to sit, and a pass that
     ends by abandoning the camera in a close-up has taken the scene away. */
  /* THE POINTS A SHOT MAY BE COMPOSED ON: the labelled callouts plus the
     storyboard-only sites. Both come out of the build, so the storyboard asks
     the scene rather than typing a copy — see `fiberTour`'s own signature. */
  /* ── THE MUSCLE'S OWN GRAIN, AND WHY IT HAS TO REACH THE ANCHORS TOO ──────
     `axis` is the fibre direction `rig.mjs` fits per mesh chain, and BODY has
     been emitting it since 2026-09-05. The effect further down rotates
     `model.group` onto it, which is what makes a descent land along the real
     grain instead of cutting to a generic sarcomere lying on +X.

     BUT THE ANCHORS DO NOT LIVE IN THAT GROUP. Every ring, every plate, the
     guide's standing point and the pass's beacon are positioned from
     `anchor.at`, which is model space, and they are drawn as SIBLINGS of the
     group rather than children of it. So the first version of this wiring
     rotated the tissue and left every mark behind: screenshotted 2026-09-05
     after descending into pectoralis major (axis [0.75, 0.18, -0.63], 41.2 deg
     off +X), two handles sat in empty paper a third of the stage from the rod
     they name, and the model ran off the bottom-left corner.

     So the rotation is applied ONCE, here, and everything that has to agree
     with the picture is turned by the same quaternion. */
  const spin = useMemo(() => {
    /* NOT AT THE SARCOMERE — 2026-09-06. Turning the model onto the picked
       muscle's grain is the whole point one and two levels up: a fascicle runs
       the way the muscle runs. Down here the visitor is inside one myofibril and
       the muscle's macroscopic direction has stopped being the subject, while
       the cost is paid in full — most rig axes are near vertical, so the turned
       frame comes out taller than wide, `shouldRoll` fires on a 1280-wide
       DESKTOP, and the camera rolls 90 deg and backs off 15-30%. Measured across
       the 310 rig meshes that carry a fibre line: median 21 deg off perpendicular
       to the filaments. That roll is what the owner is looking at when they ask
       for dead centre, and no camera number can undo it. */
    if (level === "sarcomere") return null;
    if (!axis) return null;
    const a = new THREE.Vector3(...axis);
    if (!(a.lengthSq() > 0)) return null;
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      a.normalize(),
    );
  }, [axis?.[0], axis?.[1], axis?.[2], level]);

  /** A point list turned onto the muscle's grain. Identity when there is none. */
  const turn = useMemo(() => {
    if (!spin) return (list) => list;
    const v = new THREE.Vector3();
    return (list) =>
      list.map((p) => ({ ...p, at: v.set(...p.at).applyQuaternion(spin).toArray() }));
  }, [spin]);

  const anchors = useMemo(() => turn(model.anchors), [model, turn]);
  const points = useMemo(
    () => [...anchors, ...turn(model.sites ?? [])],
    [anchors, model, turn],
  );
  const beats = useMemo(
    () =>
      scenario
        ? fiberTour(
            scenario.protocol,
            storeCeilings(scenario),
            forcePeaks(scenario),
            points,
            /* NO MUSCLE NAME IN THE PASS — 2026-09-06. `fiberTour` opens on
               "<Muscle> is made of bundles called fascicles" when it is given
               one, and its own note argues that naming it is what makes the
               visitor feel they went into THEIRS. The owner has ruled the other
               way, and not for the first time: *"내가 100번 말한거 같은데 들어온
               이상 어떤 muscle인지는 진짜 ㅈ도 1도 상관이 없어"*. The floor plays
               one archived run whatever was pressed upstairs, so the name was
               the one word in the pass that the picture could not back up.
               The parameter stays on the function — `null` is a case it already
               handles and already has a line for. */
            null,
          )
        : [],
    [scenario, points],
  );
  /* THE FIVE DEMONSTRATIONS, WHICH ARE A DIFFERENT STORYBOARD NOW.
     They used to be this one, cut up by `stepsOf` on each beat's `focus`. That
     made one array do two jobs it cannot do at once: the pass's t-tubule beat
     opens on a question the tropomyosin beat asked three beats earlier, so
     pressing the tube's ring cold played an answer with no question in front of
     it. And `stepsOf`'s other pile — `finale`, everything marked `TOGETHER` —
     was destructured here and rendered NOWHERE, which is how the whole-run beat
     and both conclusion frames spent nine days unreachable. Two storyboards,
     each written for its own job, and no pile that nothing draws. */
  const parts = useMemo(
    () => (scenario ? fiberParts(scenario.protocol, points) : []),
    [scenario, points],
  );


  /* THE FOUR STATES, IN THE OWNER'S OWN WORDS (2026-08-31):
       1. 화면으로 들어가면 아무런 텍스트 없이 (Full Animation the default)만 보여
       2. tour로 각각의 element들을 설명해 → automatic tour → this is this this does this
       3. tour로 그다음에 전체적으로 어떻게 working 하는지 animation을 통해 보여줘
       4. 다시 아무런 텍스트 없이 + go to next level + each elements clickable

     `silent` → `tour` → `main`, and 2 and 3 are one uninterrupted run of the
     storyboard rather than two mechanisms: `stepsOf`'s `finale` is a contiguous
     tail on all three scales, which `tourGrammar.test.js` holds, so playing the
     beats in order IS state 2 followed by state 3.

     WHAT THIS REPLACES, AND IT WAS MY MISREADING. I had built the tour as
     something a visitor presses — canon D2ⓐ's "조작기가 먼저" — and that clause
     is about state 4, not about the tour. The press model stays exactly where
     it belongs: in `main`, one part at a time. The tour is automatic and runs
     first, which is what the owner has said from the beginning.

     THE HOLD BEFORE IT STARTS is state 1 and it is short on purpose: long
     enough to see that the picture moves, before anything is said about it. */
  const [stage, setStage] = useState("silent");
  const coverOpen = useCoverOpen();
  /* THE MATCH CUT — 2026-09-07, owner 4.3: *"화면 전환이 존나게 자연스럽게"*. The
     body's camera ends its dive ON the muscle; this floor used to open on the
     fascicle from its full wide framing, so the cut was close-then-wide with
     nothing carrying across. Arriving from a ride, the camera is held at 45% of
     the way in from the wide framing while the cover is on, and released when
     it comes off: the ease then backs out to the wide framing over the ring's
     own opening (tau 0.12 s against `in` 620 ms). A cold arrival opens wide as
     before — there is no cut to match. */
  const arrivedByRide = useRef(typeof document !== "undefined" && document.documentElement.dataset.crossing !== undefined);
  /* THE LAP BEGINS WHEN THE COVER IS OFF, AT THE WINDOW'S OWN START. One-shot:
     the frame loop holds the run while this is false and seeks once when it
     turns true, so the first thing seen is the burst the window opens on. */
  const lapStarted = useRef(false);
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
  /* AND THE ARRIVAL IS THE PASS AGAIN, 2026-09-05. What stood here said the
     opposite — "there is nothing to enter `tour` for any more", because the
     arrival had been given to `fiberWalk.js`. That was the wrong trade and the
     walk's own header says why: it "moves no camera, seeks no clock and touches
     nothing the run is doing". Eighteen sentences over an animation that
     ignored every one of them, on the floor whose whole identity is WATCH.
     `beats.length` is the precondition, which is the shape every scale uses. */
  useEffect(() => {
    if (stage !== "silent") return undefined;
    /* THE SILENCE DOES NOT START UNTIL THE CROSSING IS OVER, and it used to.
       Screenshotted 2026-09-05 descending from BODY into pectoralis major: the
       descent card was still on screen reading "Pectoralis major / Going inside
       — down to one sarcomere" while this floor's first beat was already saying
       "Pectoralis major is built from bundles like this one." Both names, one
       frame. The integration session and I had each reasoned that the two could
       not collide — the card is DURING the crossing and the line is AFTER it —
       and the arithmetic says otherwise: `Descent.jsx`'s moving beat is
       620 + 1770 + 500 = 2890 ms and this hold is 1600, measured from a mount
       that happens UNDER the wash. 1290 ms of overlap.
       `arrivedFromInside()` is the flag the crossing itself sets on the document
       element, so this waits for the thing that is actually happening rather
       than for a copy of its duration — `CROSSING_MS` is exported and would
       have been the wrong number anyway, being one of the three beats. */
    /* THE POLL ON `arrivedFromInside()` THAT STOOD HERE IS `useCoverOpen` NOW —
       2026-09-07 — and it reads `crossing` alone. `arrivedFromInside` also
       counts `cinematic`, the shell's 1,800 ms recede, so BODY → FIBER waited
       ~0.6 s past the moment the ring had opened. And the wait now holds the
       CLOCK too, not only this timer: the ONE PULL window was cut to open on
       the burst, and the burst was happening under the cover. */
    /* AND PAUSE HOLDS IT — owner, FIBER pass 3: *"시작하자마자 pause를 눌러도 guided
       tour가 시작해버려 … 멈췄다 다시 play하면 들어가는거야"*. Paused, no timer;
       Play restarts the contraction's clock from its window's start (the frame
       loop below) and this timer with it. */
    if (!coverOpen || !playing) return undefined;
    let timer = null;
    const begin = () => {
      /* ONE CONTRACTION, ITS OWN LENGTH — the owner's arrival grammar
         (2026-09-06): a plain lap first, then the pass, then the toggles. On
         this floor the lap is *"수축 한 번"* at the level you arrive at, and
         unlike ENERGY and SIGNALS it is NOT fitted to five seconds: *"fiber말고는
         이해하지?"*. What plays while silent is already the ONE PULL window —
         `runWindow`, one `cycle_s` at a fifth speed, opening just before the
         second burst — so its length is read off that window rather than typed:
         (to − from) / speed, 0.65 / 0.2 = 3.25 s on this archive. `SILENT_MS`
         stays for a floor with nothing to say, and for a window that has not
         arrived yet. */
      const lap = runWindow && runWindow.speed > 0 ? ((runWindow.to - runWindow.from) / runWindow.speed) * 1000 : null;
      timer = setTimeout(() => setStage(beats.length ? "tour" : "main"), beats.length && lap ? lap : SILENT_MS);
    };
    begin();
    return () => clearTimeout(timer);
  }, [stage, beats.length, runWindow, coverOpen, playing]);
  /* SKIP DURING THE PLAIN CONTRACTION LANDS IN MAIN — owner: *"tour건너 뛰고 그
     단계의 마지막 main으로 가는거야"* — and main is the sarcomere, for the reason
     the hand-over below gives: the fascicle and the fibre are transitional
     views, and the parts a visitor can press are on the sarcomere. The page
     holds the button; the press arrives as a count. */
  useEffect(() => {
    if (!skipIntro) return;
    setStage("main");
    if (level !== "sarcomere") {
      handingOver.current = true;
      onLevel?.("sarcomere");
    }
  }, [skipIntro]);
  /* A LEVEL SWAP IS AN ARRIVAL — UNLESS THE PASS IS THE ONE SWAPPING.
     The model changes under the visitor, so a level a VIEWER picked introduces
     itself the way the first one did. But the guided pass's first three beats
     are level changes: that is the descent, fascicle to fibre to sarcomere, and
     resetting to `silent` on each of them would stop the pass on its second
     beat every single time. `stageRef` rather than `stage` in the dependency
     list, because reading the stage here must not re-run this on a stage
     change — only a level change may. */
  const stageRef = useRef(stage);
  stageRef.current = stage;
  /* AND NOT WHEN THE HAND-OVER ITSELF IS THE ONE SWAPPING. Skip during the
     plain contraction lands in main, and main is the sarcomere — so it changes
     the level, and this effect read that as a new arrival, re-armed the plain
     lap, and the pass the visitor had just skipped started 3.3 s later.
     Measured 2026-09-06: Skip at 1.5 s, the button flickered at 1.7 s, beat 0
     at 4.9 s. The tour's own hand-over never tripped this only because its last
     beats are already on the sarcomere. One flag, consumed by the one change
     it excuses; a level a VIEWER picks still introduces itself. */
  const handingOver = useRef(false);
  useEffect(() => {
    if (handingOver.current) {
      handingOver.current = false;
      return;
    }
    /* ONLY WHILE ARRIVING — 2026-09-07, owner (FIBER pace 6): *"fiber를 누르면 계속
       fiber여야 하는데 sarcomere로 자꾸 돌아간다"*. A press in `main` used to
       count as an arrival: silent, then a tour that ended at once on a stale
       clock and handed the floor back to the sarcomere. Measured: "Fiber" at
       0.3 s with Skip lit, "Sarcomere" again at 2.0 s. */
    if (stageRef.current !== "silent") return;
    setStage("silent");
  }, [level]);
  /* NO STANDING OPENER ANY MORE. `stepsOf` used to hand back an `opener` — the
     one beat with no part — and this scale printed it as a line that stands
     whether or not anything is playing. The pass opens itself now: its first
     beat is the fascicle, and what the scale says about itself is said by the
     descent rather than by a caption over it. Cleared once so nothing is left
     standing from a previous mount. */
  useEffect(() => {
    onOpener?.(null);
  }, [onOpener]);

  /* WHICH PART IS OPEN, AND HOW MANY TIMES IT HAS BEEN ASKED FOR. A count, not
     a flag, for `useTour`'s own reason: pressing the same ring twice is one
     visitor asking twice, and re-arming on an unchanged value re-arms nothing. */
  const [open, setOpen] = useState(null);
  const [asked, setAsked] = useState(0);
  /* WHICH PARTS HAVE BEEN WATCHED. `Handle` dims a ring that has had its
     demonstration, so what stays bright is what is left — see the note there. */
  const [seen, setSeen] = useState(() => new Set());
  const press = (id) => {
    setOpen(id);
    setAsked((n) => n + 1);
    setSeen((s) => new Set(s).add(id));
  };
  /* THE BACKGROUND CLOSES WHAT A PRESS OPENED — owner, FIBER pace 7: *"배경을
     클릭하면 원래 화면으로 돌아와야"*. Nothing ever set `open` back to null before.
     The click is a pointerdown, and a pointerdown disarms the camera ease, so
     the ease is re-armed one nonce later. */
  const [home, setHome] = useState(0);
  const close = () => {
    if (stage !== "main" || open === null) return;
    setOpen(null);
    setHome((n) => n + 1);
    onTourLine?.(null, null, { unsay: true }); /* the description goes with the press */
  };
  /* A NATIVE CLICK ON THE CANVAS, NOT R3F's `onPointerMissed` — measured 2026-09-07:
     the object-level miss handler never ran for a click on the paper. A mesh press
     raises `hit` first (either order works: press after close still ends open). */
  const closeRef = useRef(close);
  closeRef.current = close;
  const hit = useRef(false);
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      if (hit.current) {
        hit.current = false;
        return;
      }
      closeRef.current();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [gl]);
  /* A LEVEL CHANGE IS A DIFFERENT SET OF PARTS. Leaving `open` on an id the new
     level does not have would hold the veil up around nothing. */
  useEffect(() => {
    setOpen(null);
    /* A LEVEL IS A DIFFERENT SET OF PARTS, so nothing on the new one has been
       watched. Carrying the marks across would dim rings a visitor has never
       pressed. */
    setSeen(new Set());
  }, [level]);

  /* ── WHICH RING THE POINTER IS ON ────────────────────────────────────────
     `fiber.md` §6: *"다만 항상 이름 label은 없음. ring만 있고 hover하면 이름."*

     This reverses a decision from 2026-08-31 and the reason that decision was
     made is still true — screenshotted then, an unlabelled sarcomere was "a
     bundle of dusty tubes and grey rings with NOT ONE WORD on it", and the
     handles at `#5c554c` 0.55 were camouflage. What changed since is the rings:
     they are `#3a352e` at 0.68 now (commit "Make the ring you can press look
     like something you can press"), so the thing a visitor is meant to find is
     findable, and the name arriving on hover is the answer the spec prefers.

     READ OFF `Handle`'s OWN TESTID, not from a callback it does not have.
     `src/gizmo/*` is frozen to this lane, and `Handle` keeps its hover in local
     state — but its button carries `data-testid="handle-<id>"`, which is a
     stable public surface. Delegated on the window in the capture phase, so it
     works for a pointer and for keyboard focus, and so it does not care where
     the button is portalled to. */
  const [hovered, setHovered] = useState(null);
  useEffect(() => {
    const idOf = (e) => {
      const el = e.target?.closest?.('[data-testid^="handle-"]');
      return el ? el.getAttribute("data-testid").slice("handle-".length) : null;
    };
    const on = (e) => {
      const id = idOf(e);
      if (id) setHovered(id);
    };
    const off = (e) => {
      if (idOf(e)) setHovered(null);
    };
    for (const [type, fn] of [
      ["pointerover", on],
      ["pointerout", off],
      ["focusin", on],
      ["focusout", off],
    ]) {
      window.addEventListener(type, fn, true);
    }
    return () => {
      for (const [type, fn] of [
        ["pointerover", on],
        ["pointerout", off],
        ["focusin", on],
        ["focusout", off],
      ]) {
        window.removeEventListener(type, fn, true);
      }
    };
  }, []);

  /* The anchor the current beat is about, for the plates. Null outside a pass. */
  const [tourFocus, setTourFocus] = useState(null);
  const lastSpot = useRef(null);
  /* Furniture down the instant the way down is pressed — owner, FIBER 14. */
  const [leaving, setLeaving] = useState(false);

  /**
   * THE PART ITSELF SAYS IT IS THE SUBJECT — 2026-09-06, and this replaces the
   * ring that used to say it.
   *
   * Owner, twice and in the same breath: *"이 orange accent on parts 개 ㅈ같아 …
   * 그리고 black rings도 개 ㅈ같아 (everywhere)"*, and then what to do instead —
   * *"3d element를 highlight 하던지 처음에 설명할 때랑 눌렀을 때 나머지를 다른
   * 색으로 하던지 뭐가 뭐인지 안보인다고"*. Both marks are gone from `Handle.jsx`
   * now, so if nothing took their job the floor would lose the ability to say
   * which of five parts is being talked about.
   *
   * WASHED TOWARD THE PAPER, WHICH IS THE VOCABULARY THIS APP ALREADY SPEAKS.
   * `MotionScene`'s `ROLE_WASH` does exactly this on the body — a muscle keeps
   * its own colour and simply holds less contrast against the page — and it was
   * chosen there over opacity for a reason that applies here too: this palette
   * has no lightness discipline (tan actin at L* 71 against a near-black Z-disc
   * at L* 30), so fading by alpha reorders which part shouts, while washing
   * toward the ground moves every hue the same way.
   *
   * COLOUR ONLY, NEVER ALPHA. Touching `opacity` would flip `transparent` on
   * materials that are opaque by design and hand the sarcomere's overlapping
   * filaments a sort order to get wrong. The wash is one `lerp` per material per
   * change, not per frame.
   *
   * THE SUBJECT IS WHICHEVER IS MOST SPECIFIC: a pressed part outranks a hovered
   * one, and a hovered one outranks the beat the pass is on — the last is what
   * makes "처음에 설명할 때" work without the tour needing to know this exists.
   */
  const subject = open ?? hovered ?? tourFocus?.id ?? null; /* a beat with no focus sends null (tour.js) */
  const washBase = useRef(new Map());
  useEffect(() => {
    const base = washBase.current;
    const paper = new THREE.Color(SCENE.background);
    /* Role is inherited: a part is a group of instanced meshes and only the
       group carries the tag, so each material asks its ancestors once. */
    const roleOf = (object) => {
      for (let node = object; node; node = node.parent) {
        if (node.userData?.role) return node.userData.role;
      }
      return null;
    };
    /* ONE STANDS OUT AND THE REST GO PALE — NEVER ALL OF THEM. Owner, 2026-09-06:
       *"i didnt mean all white i meant one to be hightlighted and the rest to be
       white"*. A `subject` that matches no drawn part — a tour beat focused on an
       id this level does not carry, a hover on something without a role tag —
       failed `role !== subject` for EVERY material, so the whole sarcomere washed
       to paper and nothing was highlighted. The picture went blank instead of
       pointing.
       So the subject has to be PRESENT before it can dim anything: one walk to
       find out whether any part answers to it, and the wash only runs if one
       does. Nothing to point at means point at nothing, which leaves the floor
       exactly as it draws itself. */
    const parts = [];
    let found = false;
    model.group.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      if (!materials.length) return;
      const role = roleOf(object);
      if (subject && role === subject) found = true;
      parts.push([role, materials]);
    });
    const lit = found ? subject : null;
    /* THE SUBJECT'S ROLES, AS THE SPOTLIGHT READS THEM — 2026-09-07 (FIBER pace 2): the
       spotlight left the calcium lit beside the cover and the store, and this pass
       washed it back to paper because it matched one role by name. */
    const litRoles = lit ? new Set(ROLES_OF[lit] ?? [lit]) : null;
    for (const [role, materials] of parts) {
      for (const material of materials) {
        if (!material.color) continue;
        if (!base.has(material)) base.set(material, material.color.clone());
        const home = base.get(material);
        material.color.copy(home);
        if (litRoles && !litRoles.has(role)) material.color.lerp(paper, WASH);
      }
    }
    /* No cleanup that restores: the next run rewrites every material from its
       stored home, and the model is disposed with the level. A cleanup here
       would fight the run that replaces it. */
  }, [model, subject]);
  /* THE PART THE VISITOR PRESSED, which is not always the part the beat points
     at — `Gizmos`' say-point note carries why, and the store's closing beat is
     the case. Its anchor hangs the words; its label heads them. */
  const openAnchor = anchors.find((a) => a.id === open) ?? null;
  /* ONE PLAYER, TWO STORYBOARDS. In `tour` it plays the whole guided pass in
     order; in `main` a press plays that one part's demonstration. Which array
     is handed over is the only difference, and `stage` is the only thing that
     decides it. */
  const playing_beats =
    stage === "tour" ? beats : open ? (parts.find((p) => p.id === open)?.beats ?? []) : [];
  /* THE ONE DOOR A SEEK HAS — the storyboard's and the evidence trace's.
     Seeking the clock rather than the `startAt` prop: `startAt` is the
     address's instant and the pass must not rewrite the address on every
     beat. `state.current.time` moves with it so the first frame after a seek
     is already the sought one rather than the old one.
     AND IT SETTLES, WHICH IS THE HALF THAT WAS MISSING. `state.current.time = at`
     moves the clock; every reading the geometry draws is re-derived from the
     scenario on the next frame — except the sarcomere's length, whose
     `shortening` has memory and cannot move on a held frame. Measured beat by
     beat: beat 3 holds at 0.488 s and inherited 0.0 nm where the run is 14.2 nm
     into its travel. See `settleAt`, and the re-seed below — one defect with
     two doors, fixed at both. */
  const seekTo = (t) => {
    const g = scenario?.grid;
    const at = g ? Math.min(Math.max(t, g.t0), g.tEnd) : Math.max(0, t);
    settleAt(state.current, at, { mode: exerciseMode, intensity, isActive, motion, scenario });
    clock.current = createRunClock(at);
  };
  const tour = useTour(playing_beats, {
      /* Skip is for the arrival pass; a part's demonstration is not a thing to
         skip (owner, SIGNALS 22: *"누르면 이미 main인데 skip이 다시 활성화 돼 왜?"*). */
      skippable: stage === "tour",
      /* PAUSE HOLDS THE PASS, IT DOES NOT KILL IT — 2026-09-06, owner: *"pause
         하면 tour도 멈추고 resume하면 그 자리에서 tour start"*. `playing` is the
         transport's own flag and it already stopped the run's clock; until
         `useTour` grew a `paused` option the pass kept narrating over a frozen
         picture, and pressing Pause at all fired a `pointerdown`, which is an
         INTERRUPT, which ended the pass outright with no way back to the beat. */
      paused: !playing,
    /* See `useTour`: `enabled` coming back on is not enough, because a press
       set `stopped` and left `started` at the wall-clock the first run began
       at. The count clears both. */
      nonce: asked,
      /* THE PASS RUNS ON ARRIVAL, WHICH IT HAD STOPPED DOING. This read
         `!!scenario && !!open` — a demonstration only, nothing automatic — and
         the note above it explained that the arrival belonged to `fiberWalk`.
         `fiberWalk` moved no camera, seeked no clock and touched nothing the
         run was doing, by its own header, so what a visitor met on this floor
         was eighteen sentences over an animation that ignored them.
         Now: in `tour` it plays because there is a storyboard, in `main`
         because a ring was pressed. */
      enabled: !!scenario && (stage === "tour" ? beats.length > 0 : !!open),
      onLine: (line) => onTourLine?.(line, openAnchor?.label ?? null),
    /* Seeking the clock rather than the `startAt` prop: `startAt` is the
       address's instant and the pass must not rewrite the address on every
       beat. `state.current.time` moves with it so the first frame after a seek
       is already the sought one rather than the old one. */
    /* AND IT SETTLES, WHICH IS THE HALF THAT WAS MISSING. `state.current.time = at`
       moves the clock; every reading the geometry draws is re-derived from the
       scenario on the next frame — except the sarcomere's length, whose
       `shortening` has memory and cannot move on a held frame.
       WHAT THAT WAS ACTUALLY WORTH IN THIS PASS, measured beat by beat rather
       than asserted: beat 3 holds at 0.488 s and inherited 0.0 nm where the run
       is 14.2 nm into its travel; the two conclusion frames were off by 2.0 and
       0.3 nm. So the pass's ending was NOT the damage — the first draft of this
       comment said it was, on the reasoning that the wide beat leaves the clock
       on the tenth repetition, and the reasoning was right about the inheritance
       and wrong about the size: both conclusion beats seek to the store's
       CEILINGS, which are quiet instants where the run itself barely pulls.
       The caller that needed this is one file over — see `settleAt`, and the
       re-seed below. Fixed in both places a seek happens because it is one
       defect with two doors. */
      onSeek: seekTo,
      onSpeed: setTourReplay,
      onFocus: setTourFocus,
    },
  );
  /* ---- THE THREE VERBS THE STORYBOARD GREW ---------------------------- *
     `useTour` lives in `src/tour.js`, which this lane does not own, so none of
     these could be added there. It does not need to be: the hook already hands
     back the effective beat, so a scale can read any field it likes off it and
     `tour.js` never has to know the field exists. Keyed on `tour.index` for the
     same reason the hook's own entry effects are — a storyboard rebuilt on a
     render must not re-fire what it already did. */

  /* `level` — THE DESCENT. Three beats, three models. The level is a prop, so
     this asks its owner; a scale that set its own would fight the chips. */
  const beatLevel = tour.beat?.level ?? null;
  useEffect(() => {
    if (beatLevel && beatLevel !== level) onLevel?.(beatLevel);
  }, [beatLevel, tour.index]);

  /* `compare` — THE REVEAL. Which repetition is on screen, for the two meters
     the DOM draws. Null the moment the pass moves off a comparison beat, and
     null when the pass ends, so the meters cannot outlive what they measure. */
  const beatCompare = tour.beat?.compare ?? null;
  useEffect(() => {
    onCompare?.(beatCompare);
  }, [beatCompare, onCompare]);
  useEffect(() => {
    if (!tour.running) onCompare?.(null);
  }, [tour.running, onCompare]);

  /* WHERE THE WAY DOWN STANDS, READ OFF THE MODEL THAT IS ON SCREEN. */
  const wayInAt = useMemo(() => {
    /* ONE FIXED SPOT ON EVERY LEVEL — 2026-09-07, owner (pace 2, F1): *"exercise들 처럼
       고정이 좋을 것 같은데 (fiber, sarcomere, fascicle 다 비슷한 곳에)"*. Bottom centre,
       just under each level's own frame; not rotated with the model, because a
       fixed thing does not turn. (It stood at the row's end, then under the
       myosin — both were places in the picture, and the owner wanted a place on
       the screen.) */
    /* Then, pace 3-1 (P1): *"그냥 이 fiber 3d의 중앙으로 하자"* — the frame's centre. */
    const [cx = 0, cy = 0] = spec.frame?.centre ?? [];
    return [cx, cy, 0.3];
  }, [spec]);

  /* WHAT CROSSES THE SEAM WITH THE VISITOR. Recomputed per beat rather than per
     frame: this is read once, when a control is pressed, and sixty renders a
     second to keep a value nobody is looking at is the mistake the body scale's
     readout already made. `liveState` is the ref the frame loop writes. */
  const handoff = useCallback(() => {
    if (!scenario) return null;
    const p = scenario.protocol;
    /* READ AT THE MOMENT OF THE PRESS, which is why this is a function and not
       a memo. The first version memoised the object, so what crossed the seam
       was whatever the clock said when the memo last ran — a visitor who
       watched two more repetitions and then pressed would arrive downstairs on
       the repetition they were on when the storyboard changed beats. */
    const t = state.current?.time ?? 0;
    const rep =
      p?.cycle_s > 0 && p?.repetitions > 0
        ? Math.min(p.repetitions, Math.floor(t / p.cycle_s) + 1)
        : null;
    return {
      run: scenario.id ?? scenario.name ?? null,
      clock: "protocol",
      t,
      rep,
      phosphate: state.current?.phosphate ?? null,
      phosphateFraction: state.current?.phosphateFraction ?? null,
    };
  }, [scenario]);

  /* A SEAM YOU CAN ASK. `window.__fiberState` exists for the same reason and
     the note there is the argument: this scene is judged from outside, and a
     value that only exists inside a click handler cannot be checked without
     performing the click and then reading the floor below — which is two
     floors' worth of doubt for one number.
     The handoff is exactly that kind of value. It is read once, at the moment a
     control is pressed, and if it is wrong the symptom appears one scale down
     as a repetition that looks plausible. Measured 2026-09-05: FIBER left at
     rep 7 and ENERGY opened on rep 1, and nothing on either screen said which
     side had dropped it. */
  useEffect(() => {
    window.__fiberHandoff = () => handoff();
    return () => {
      delete window.__fiberHandoff;
    };
  }, [handoff]);

  /* THE TOUR HANDS THE SCALE OVER WHEN IT RUNS OUT. `tour.running` goes false
     both when the storyboard ends and when one of `INTERRUPTS` stops it, so a
     visitor who reaches for something is taken to the main state rather than
     being held in a pass they have left. */
  useEffect(() => {
    if (stage !== "tour" || tour.running) return;
    setStage("main");
    /* AND MAIN IS THE SARCOMERE. `fiber.md` §12C: the fascicle and the fibre are
       transitional scale views, not explorer tabs — the parts a visitor can
       press, and every quantity this floor draws, are on the sarcomere and
       nowhere else. A pass interrupted during the descent would otherwise hand
       over the fibre level with the explorer on it: five rings that are not
       there, a comparison of a store that is not drawn. The ladder is still
       right there if they want to go back up a rung; this is only about where
       being handed the scale leaves them. */
    if (level !== "sarcomere") onLevel?.("sarcomere");
  }, [stage, tour.running]);
  /* THE PAGE NEEDS THE STATE, NOT THE CASCADE. `onIntro` used to report whether
     the plate cascade was running, which was standing in for "is this scale
     still showing rather than waiting". The scale has a real state machine now,
     so it says which of the four states it is in and the page decides what to
     draw. */
  useEffect(() => {
    onIntro?.(stage);
  }, [stage, onIntro]);
  /* Handing the speed back is part of handing the scene back. Without this a
     viewer who interrupts during the quarter-speed close-up keeps a quarter
     speed they never chose, and the chips lie about what is playing. */
  useEffect(() => {
    if (!tour.running) setTourReplay(null);
  }, [tour.running]);

  useEffect(() => {
    onRunning?.(tour.running);
  }, [tour.running, onRunning]);
  useEffect(() => {
    onOpen?.(open);
  }, [open, onOpen]);
  useEffect(() => {
    if (seekRef) seekRef.current = seekTo;
  });
  /* THE NONCE CARRIES THE LEVEL, so a level change re-arms the ease on purpose
     rather than by accident. `useCameraTransition` re-arms whenever its
     destination CHANGES, and the three levels' cameras are `[1.3,1.7,6]`,
     `[1.3,1.7,6.1]` and `[1.1,1.8,7.6]` — so fascicle → fiber re-armed on a
     0.100 difference, which is 1.6% of apparent size and a move nobody can see.
     Snapping back to the level's own framing is right and the file says so
     ("where each level frames well"); resting it on a number that close to zero
     means the day someone makes two levels share a camera, a viewer's orbit
     silently survives one rung of the ladder and not the other. */
  /* THE PASS BORROWS THE CAMERA AND ALWAYS GIVES IT BACK, however it ends.
     `tour.camera` is null the moment there is no beat, so this reads: the
     level's own framing, except while a storyboard is speaking.

     WHAT WAS HERE, AND WHY IT HAD TO GO. The third argument used to be
     `armed || !tour.interrupted` — a pass that ran out returned the camera, a
     pass a viewer STOPPED left it where they stopped it. That clause was
     written when this scale had OrbitControls and it protected something real:
     the camera a VIEWER had aimed. D6 removed the orbit from all three deep
     scales on 2026-08-30, and from that day it protected nothing.

     What it cost, measured 2026-08-31 at 1280x900 in a browser. A press ends
     the pass — that is the design, and canon B2 makes touching the point of
     these scales — and `enabled` then stayed false. So the camera kept whatever
     beat the press had landed on. This storyboard TRAVELS: its last framings
     sit near `CISTERNA_X + 0.7 = 3.75`, and the sarcomere's own geometry ends
     at x = 0.80. An interrupted viewer was left in a close-up of a coordinate
     the object never reaches — the sarcomere ran off the right edge, and
     `[data-testid="way-in"]` measured **x = 2841 in a 1280-wide window**. The
     way down to the cell was off screen for anyone who touched anything.

     `home` went with it: it counted presses of the strip's `reset`, D3 deleted
     the strip on 2026-08-30, and nothing has called `setHome` since — every
     ternary here was picking the same branch every time. `asked` went too; it
     existed only to undo the freeze on a level switch, and a camera that is
     never frozen re-frames on the destination change alone.

     THE NONCE STILL CARRIES THE LEVEL, and that is not redundancy. The hook
     re-arms when its destination changes, and the three levels sit at
     `[1.3,1.7,6.1]`, `[1.3,1.7,6.1]` and `[0,1.3,3.0]` — the first two are now
     EQUAL, so fascicle → fiber changes no destination at all and would re-arm
     on nothing. `tourGrammar.test.js` holds this. */
  /* THE STANDING FRAMING IS FITTED TO THE WINDOW, not typed for one of them.
     `spec.frame` is what this level says has to be visible and `fitCamera`
     answers how far along the level's own direction that is — see
     `fitCamera.js` for the measurement that made the distance an input. The
     beats keep their authored positions: each is a close-up on one part, and a
     close-up is a choice about what to EXCLUDE. */
  const { camera, size } = useThree();

  /* THE WORDS FOLLOW WHAT THE VISITOR PRESSED, THE BEACON FOLLOWS THE BEAT —
     the distinction `Gizmos` already draws between `sayAt` and `focusAt`. The
     guide carries the words, so it stands at the pressed part when there is
     one and falls back to the beat's own subject. */
  /* THE LEVEL'S OWN FRAME, NOT A MEASURED BOX. The sarcomere is long and
     thin — a bounding sphere around it reaches both bottom corners of a
     1280x800 stage (measured: both were "covered" at rest, so the block could
     never move back). And `Box3.setFromObject` at build time is wrong the
     other way: every level is InstancedMesh and its matrices are written by
     `update()`, so before the first frame it answers ±0.80 for a sarcomere
     that draws out past 3.0 (the note at `__fiberBox` below, and
     fiberGeometry.js). `spec.frame` is what the level declares has to be in
     shot — the same rectangle `fitCamera` frames — so its four corners,
     projected, are the picture's own screen rectangle. Per frame, four
     projections. */
  useFrame(() => {
    if (avoidRef) {
      const { centre, half } = spec.frame;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      let behind = false;
      for (let i = 0; i < 4; i += 1) {
        _avoidV.set(centre[0] + (i & 1 ? half[0] : -half[0]), centre[1] + (i & 2 ? half[1] : -half[1]), centre[2]);
        _avoidV.applyMatrix4(model.group.matrixWorld).project(camera);
        if (_avoidV.z > 1) behind = true;
        const px = ((_avoidV.x + 1) / 2) * size.width;
        const py = ((1 - _avoidV.y) / 2) * size.height;
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
      }
      avoidRef.current = behind ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    if (!guideRef) return;
    /* THE RAW ANCHOR LIST, NOT THE PLATE LIST. `Gizmos` is fed a FILTERED set —
       plates fold at narrow widths — and the guide must be able to stand beside
       a part whose name is currently folded away. The model's anchors are every
       part this level drew. */
    const wanted = guideAnchor?.current ?? null;
    const named = wanted ? anchors.find((a) => a.id === wanted)?.at ?? null : null;
    const at = named ?? openAnchor?.at ?? tourFocus?.at ?? null;
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
    /* BEHIND THE CAMERA IS NOT OFF-SCREEN, IT IS MIRRORED — the same trap
       `Gizmos` documents at its own projection. A guide placed from a mirrored
       point stands somewhere plausible and points at nothing. */
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
      /* A FILAMENT SPANS THE FRAME; 40 px of clearance put the bubble on it (myosin
         beat, 2026-09-07 still). The subject's own reach, by part. */
      r: FILAMENT_IDS.has(wanted ?? tourFocus?.id) ? 150 : FIBRE_IDS.has(wanted ?? tourFocus?.id) ? 120 : 40,
    };
  });
  /* AND THE FRAME TURNS WITH IT. `spec.frame` states what must be visible of a
     model lying on +X; once the model is on the muscle's grain that box is the
     wrong box, and `fitDistance` would frame a rod that is no longer there.
     Measured after the anchors were fixed and before this was: descending into
     pectoralis major put the sarcomere's left end off the bottom-left corner of
     a 1440x900 stage.
     The rotated box is the axis-aligned bounds of the turned one — the model is
     a rod, so |cos| and |sin| of the turn against its own half-extents is the
     whole of it. Depth becomes height and width honestly, which is why this is
     computed from the quaternion rather than from the angle: a yaw costs the
     frame almost nothing and a pitch costs it everything, and only the
     quaternion knows which one a given muscle asked for. */
  const framed = useMemo(() => {
    const frame = spin ? turnedFrame(spec.frame, spin) : spec.frame;
    return frameCamera(frame, spec.camera, SCENE.camera.fov, size.width / size.height);
  }, [spec, spin, size.width, size.height]);
  /* A BEAT THAT ASKS FOR "THE LEVEL'S OWN FRAMING" MUST GET THE FITTED ONE.
     `fiberTour`'s `WIDE` IS `LEVELS.sarcomere.camera` BY IDENTITY, so three of
     its beats hand back the raw constant — and that constant is now a
     DIRECTION, not a position (`fitCamera.js`). Passing it through would put
     the crop back for the length of those beats: measured at 1280x900, the raw
     camera covers x = ±1.60 of an object that draws to ±3.34. Reference
     equality rather than comparing numbers, because the storyboard imports the
     very array this reads. A beat with its own close-up keeps it — a close-up
     is a decision about what to leave OUT, and fitting one would undo it. */
  const wide = tour.camera === spec.camera;
  /* `enter` — THE THIRD VERB, AND THE ONE THAT MAKES A DESCENT A DESCENT.
     A beat may name a part to push INTO rather than a position to sit at, and
     this resolves it against the level that is on screen right now. It has to
     be resolved here: the anchors belong to the built model, `fiberTour` is
     handed the SARCOMERE's points, and the descent's push-ins are on the
     fascicle and the fibre. A storyboard that carried those coordinates would
     be the copied constant this floor has now paid for three times.

     WHAT IT COMPUTES. The same direction the level is already framed along,
     at a fraction of the fitted distance, aimed at the named part. So the shot
     is the level's own shot, moved in — not a new angle, which would read as a
     cut rather than as travel.

     WHY A FRACTION AND NOT A DISTANCE. `framed.position` is worked out from the
     level's `frame` against the live window, so it is different on every
     screen. A typed distance would be a close-up on one monitor and a fly-past
     on another. 0.34 was chosen against the thing being entered: at the
     fascicle the target is one 0.284-wide fibre inside a 1.26-wide bundle, and
     a third of the framing distance brings it to about the width the FIBRE
     level then opens at — which is the match cut the descent is made of. */
  const enterAt = useMemo(() => {
    const id = tour.beat?.enter;
    if (!id) return null;
    const at = anchors.find((a) => a.id === id)?.at;
    if (!at) return null;
    /* 0.55, AND 0.34 WAS MEASURED AND REJECTED. The first number was reasoned
       about — a third of the framing distance brings one 0.284-wide fibre to
       about the width the FIBRE level opens at, which is the match cut a
       descent is made of — and the picture it makes is a wall. Screenshotted at
       1440x900 on the fascicle's push-in: the frame is filled edge to edge with
       undifferentiated tissue, no fibre separable from its neighbours and no
       scale cue anywhere, under a line reading "Inside a bundle are long
       fibres". Being inside the bundle is not the same as seeing into it.
       Over half the distance keeps the sheath's far wall in shot, which is what
       gives the fibres something to be inside of. */
    const k = typeof tour.beat.enterBy === "number" ? tour.beat.enterBy : 0.55;
    const [cx, cy, cz] = framed.position;
    const [lx, ly, lz] = framed.lookAt;
    return {
      /* The view line, shortened. `lookAt` moves to the part; the camera keeps
         the level's own bearing and closes on it. */
      position: [at[0] + (cx - lx) * k, at[1] + (cy - ly) * k, at[2] + (cz - lz) * k],
      lookAt: at,
    };
  }, [tour.beat?.enter, tour.beat?.enterBy, model, framed.position, framed.lookAt]);
  /* THE FRAME TURNS ON A PORTRAIT WINDOW, AND ONLY THE FRAME. `fitCamera`'s
     `shouldRoll` carries the measurement: this subject is 5.6:1 and a phone is
     0.5:1, so a level camera left it 60 px tall in a 640 px window. `up` is
     where the photographer stands; the MODEL's orientation is a claim (it comes
     from the muscle's own measured axis, below) and is untouched.
     Written straight onto the camera rather than eased: a roll that animates is
     the horizon tipping, which reads as the room turning rather than as the
     picture being framed. It changes only when the window's shape crosses the
     subject's own — a resize, not a beat. */
  useEffect(() => {
    camera.up.set(...framed.up);
  }, [camera, framed.up[0], framed.up[1], framed.up[2]]);
  useCameraTransition(
    enterAt ? enterAt.position : wide || !tour.camera ? framed.position : tour.camera,
    enterAt ? enterAt.lookAt : (tour.lookAt ?? framed.lookAt),
    true,
    /* THE WINDOW IS PART OF WHAT RE-ARMS THE EASE. The hook re-arms on a
       CHANGED destination, and a resize changes the destination by a smooth
       amount — which would have the camera crawling after the window instead
       of arriving. Rounding to whole pixels keeps a drag from re-arming on
       sub-pixel noise. */
    `${level}:${tour.index}:${home}:${Math.round(size.width)}x${Math.round(size.height)}`,
  );

  // Orient the fibre along the muscle's measured axis. +X is the long axis of
  // every level; a null axis leaves the default lying-down framing.
  useEffect(() => {
    if (!spin) { model.group.quaternion.identity(); return; }
    model.group.quaternion.copy(spin);
  }, [model, spin]);

  // Reset the clock when the pattern changes, so a twitch starts at its stimulus
  // rather than wherever the previous mode happened to be.
  //
  // `startAt` is the instant the HASH names — the body-clock second the viewer
  // was looking at when they descended. It is in this dependency list, not only
  // in the mount, because the hash is live: main.jsx re-parses on `hashchange`
  // and hands down a new state without remounting, so seeding on mount alone
  // meant editing `@t` in the address bar changed the URL and nothing else.
  // CellScale:61 carries the same note for the same reason.
  //
  // Clamped rather than trusted, AT BOTH ENDS. A shared link can name any
  // number, and a negative or past-the-end `t` must not run the clock backwards
  // or off the grid — the loader would then answer every frame with
  // `outOfRange` and the scene would sit on one sample looking broken.
  //
  // ONLY THE LOWER HALF OF THAT WAS EVER WRITTEN, and the upper half is where
  // the damage is. `#...fiber@99999s` was seeded whole: measured 2026-08-17,
  // twelve seconds later the clock read 98217.2 at lap 138, the readout
  // announced "Replay 139 of the same run" over a run played once, and the
  // sarcomere sat still under a `Derived` label because `sample` clamps to the
  // last archived row. Walking back into the grid at one 12.98 s span per frame
  // takes about eight minutes. CellScale:56 and SignallingScale:74 both clamp
  // both ends and both print the request they could not honour; this scene had
  // neither the clamp nor the sentence.
  //
  // Announced, not just fixed: `outOfRange` below is handed to the readout, so
  // the snap is visible. CLAUDE.md §5 — a snap the viewer cannot see is a bug.
  const grid = scenario?.grid;
  const requested = Number.isFinite(startAt) ? startAt : 0;
  const seed = grid
    ? Math.min(Math.max(requested, grid.t0), grid.tEnd)
    : Math.max(0, requested);
  const outOfRange = seed !== requested;

  useEffect(() => {
    /* SETTLED, NOT JUST STAMPED, AND THIS IS THE DOOR THE DAMAGE CAME THROUGH.
       A hash that names an instant arrives PAUSED, `advance(state, 0)` cannot
       move `shortening`, and a cold load starts at rest — so the sarcomere drew
       the length it was BORN with, whatever instant the address asked for.
       Measured on `soce_on`, cold, sixty held frames:

         fiber@0.114s   drew   0.0 nm   the run is at 234.9 nm
         fiber@6s       drew   0.0 nm   the run is at  92.7 nm

       234.9 of the 300 nm the sarcomere can draw, missing, on a screen whose
       one lesson is how far it travels. `ask.js` sends "Why do muscles get
       tired?" to `fiber@5.202s`, so this is a link the app hands out.
       See `settleAt` for the catch-up window and for why snapping to the force
       was measured and rejected. */
    settleAt(state.current, seed, { mode: exerciseMode, intensity, isActive, motion, scenario });
    state.current.atp = 0;
    state.current.lap = 0;
    state.current.held = null;
    clock.current = createRunClock(seed);
    // `seed`, not `startAt`: seed is the request already clamped to the grid, so
    // a link asking for an instant outside the run re-seeds to the nearest one
    // the run has rather than re-seeding to a time it does not.
    //
    // AND `scenario` JOINED THE LIST, which is the difference between fixing
    // this and half-fixing it. The run is fetched, so on a cold paused arrival
    // this effect runs once with `scenario` still null — `settleAt` has no
    // archive to catch up against and can only stamp the clock. The scenario
    // lands a moment later, and with the old two-item list nothing re-ran: the
    // frame kept the length it mounted with, which for a cold load is a
    // sarcomere at rest under a hash naming the instant the store is emptiest.
    // The identity changes once per load, so this is one extra run, not churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intensity, isActive
    // and motion are read by the settle but must not re-seed the clock: dragging
    // the dev route's intensity slider would restart the run under the hand.
  }, [exerciseMode, seed, scenario]);

  useEffect(() => {
    onRange?.(outOfRange ? { requested, t0: grid?.t0 ?? 0, tEnd: grid?.tEnd ?? null } : null);
  }, [onRange, outOfRange, requested, grid?.t0, grid?.tEnd]);

  useFrame((_, delta) => {
    /* Held close under the cover — see `arrivedByRide`. Written every frame so
       the ease's own lerp cannot drift it out before anyone can see it. */
    if (arrivedByRide.current && !coverOpen && stage === "silent") {
      _close.set(...framed.lookAt).lerp(_wideV.set(...framed.position), 0.55);
      camera.position.copy(_close);
    }
    // The mode speeds are presentation choices for the invented curves — a
    // twitch runs at 0.16x so a 100 ms event is watchable. A bound scenario's
    // `t` is a BODY CLOCK in real seconds, so applying that multiplier would
    // stretch a 13 s exercise to 81 s while the labels still said 13.
    //
    // THAT REASON HOLDS AND IS KEPT: the mode's speed still never touches a
    // bound run. What it was an argument against is a multiplier nobody chose
    // and nothing declares — and `replay` is the opposite of that. It is 1x
    // until a viewer presses one of the 0.25x/0.5x/1x chips the body scale has
    // always had, the pressed chip is what says which, and the clock beside it
    // goes on reading the model's own seconds: the run still ends at 13.0 s,
    // it just takes longer to watch. A stretch a viewer asked for and can see
    // is not the silent one this clamp was defending against.
    //
    // It is not a comfort control. One calcium transient is 0.126 s FWHM and
    // the burst that causes it is 0.1625 s — about ten frames at 1x — so at 1x
    // the T-tubules above flash at 1.5 Hz and the release they cause is over
    // before the eye has found it. This scale's whole lesson is an ORDER
    // between two events that are shorter than the eye can use.
    //
    // A FACTOR RATHER THAN A REPLACEMENT, so the chips are never a dead control:
    // unbound they scale the mode's own presentation speed, bound they scale 1.
    // Either way the chip means "a quarter of the speed you would otherwise be
    // watching", which is true on both branches and needs no second sentence.
    /* The pass's speed wins while it runs, and only while it runs. `??` rather
       than a boolean: `tourReplay` is null exactly when no beat has set one, so
       a viewer's chip is never overwritten and is never ignored either. */
    /* THE BEAT'S OWN SPEED, READ THIS FRAME, NOT A RENDER LATER. `onSpeed` puts
       it in React state, and state lands on the next render — so between a
       beat's seek and its speed arriving, the frame loop ran once at the
       PREVIOUS beat's speed. Measured end to end: the conclusion's first frame
       parks at 1.296 s, four milliseconds before the third burst, and one tick
       at 1x carried it to 1.311 — into the release. The store read 0.261 of full
       under "after one repetition the store came back to here", against 0.476
       under "after ten, only to here". The comparison was inverted on screen
       while both beats, held, measured correctly.
       `tour.beat` is available synchronously, which is how the signalling scene
       has always read it. The state stays as the fallback for the frames before
       the first beat and after the last. */
    /* COMPARE PARKS THE RUN, AND IT SETTLES RATHER THAN JUMPS.
       `state.time = t` moves the clock, but the sarcomere's LENGTH has memory —
       `shortening` is a lagged reading — so a bare assignment draws the new
       instant's colours over the old instant's travel. Measured when the tour's
       seeks had the same hole: a beat holding at 0.488 s inherited 0.0 nm where
       the run is 14.2 nm into its travel. `settleAt` runs the catch-up window,
       which is why it is the same call the storyboard's own seek makes. */
    if (scenario && !tour.running && typeof freezeAt === "number") {
      if (state.current.time !== freezeAt) {
        settleAt(state.current, freezeAt, { mode: exerciseMode, intensity, isActive, motion, scenario });
        clock.current = createRunClock(freezeAt);
      }
      /* And the geometry still gets a frame: the model's `update` runs below on
         every frame regardless, so a frozen run is a still picture rather than
         a stopped one — the beacon still breathes and the handles still fade by
         distance, which is what tells a visitor the scale is alive. */
    }

    /* A BEAT OUTRANKS A MODE OUTRANKS THE PROP. The pass is the strongest
       claim about what should be on screen; a mode is what the visitor chose
       once the pass handed the scale over; `replay` is the default under both. */
    const chosen = tour.beat?.speed ?? tourReplay ?? (tour.running ? null : runWindow?.speed) ?? replay;
    /* HELD UNDER THE COVER, THEN SEEKED TO THE WINDOW'S START — see `coverOpen`. */
    let speed = chosen * (scenario ? 1 : (EXERCISE_MODES[exerciseMode] ?? EXERCISE_MODES[DEFAULT_MODE]).speed);
    if (stage === "silent" && scenario && runWindow) {
      if (!playing) lapStarted.current = false;
      if (!coverOpen || !playing) speed = 0;
      else if (!lapStarted.current) {
        lapStarted.current = true;
        settleAt(state.current, runWindow.from, { mode: exerciseMode, intensity, isActive, motion, scenario });
        clock.current = createRunClock(runWindow.from);
      }
    }
    if (playing && !(scenario && !tour.running && typeof freezeAt === "number")) {
      const opts = { mode: exerciseMode, intensity, isActive, motion, scenario };
      if (!scenario) {
        advance(state.current, delta * speed, opts);
      } else {
        // A scenario is a finite run — 6.5 s of exercise then 6.5 s of recovery —
        // replayed in a tab that is not finite. `runLoop.js` owns the seam, and
        // the note there is the argument: the loop used to fire inside a moving
        // picture, where a 716.6 -> 941.2 µM refill of the SR store in one frame
        // is indistinguishable from the fibre recovering. It now ends still, cuts
        // in one frame, and starts still. The two holds are what make the cut
        // read as a cut.
        //
        // THE CLOCK GRANTS THE TIME AND `advance` SPENDS IT. `advance` owns
        // `state.time` for the unbound curves above and has no end to stop at, so
        // here it is handed exactly what the clock allowed and the clock's answer
        // is written back over it.
        //
        // `granted` is 0 on every held frame — including the one the hold
        // releases on, since a step never crosses two boundaries — so the
        // mechanical lag and the ATP tally freeze with the picture instead of
        // integrating under a frame that claims to be still. Handing `advance`
        // the raw delta and then resetting `state.time` afterwards did exactly
        // that for one frame per lap.
        const c = clock.current;
        const before = state.current.time;
        c.t = before;
        /* THE WINDOW IS THE MODE. `runWindow` narrows the same loop rather than
           replacing it, so ONE PULL and FULL SET are the archive's own seconds
           seen through a shorter lap — and the wrap they lap on is the one
           `runLoop.js` already holds still either side of, which is what keeps
           a 31% refill of the store from reading as the fibre recovering. */
        /* A PASS OWNS THE CLOCK AND A MODE DOES NOT.
           `runWindow` narrows the loop for the explorer's three modes, and it
           was being applied while the storyboard played — so every seek the
           pass made was clamped into ONE PULL's 0.55..1.20 s window. Measured in
           a browser: parked on the closing beat, which seeks to 6.014 s, the
           run reported t = 1.20. The whole-set beat played one cycle, and both
           comparison frames were the same instant; only the meters looked right,
           because they are computed from `forcePeaks` and never asked the clock.
           The pass states which instant it is about; a mode is what a visitor
           chose to watch when nothing is being said. */
        const win = tour.running ? null : runWindow;
        const from = win ? win.from : scenario.grid.t0;
        const to = win ? win.to : scenario.grid.tEnd;
        stepRunClock(c, Math.min(delta, 0.05) * speed, from, to);
        const granted = c.held ? 0 : c.t - before;
        // Wound back by exactly what `advance` is about to add, so it READS at
        // the instant the clock landed on. Left alone it reads at the instant it
        // came from, and on the cut frame that draws the run's last sample under
        // a clock already reporting the first — one frame where the number and
        // the picture disagree, which is the §5 failure in miniature.
        state.current.time = c.t - granted;
        advance(state.current, granted, opts);
        state.current.time = c.t;
        state.current.lap = c.lap;
        state.current.held = c.held;
      }
    } else if (scenario) {
      /* PAUSED IS NOT FROZEN. Q17 R7 made a link that names an instant arrive
         stopped on it, and `seed` above puts that instant in `time` — but every
         reading the geometry draws (force, calcium, the store) is derived from
         the scenario inside `advance`, which only ran while playing. So a
         paused arrival drew the instant's CLOCK over the previous frame's
         picture: measured on cold loads of `fiber@0.1s` and `fiber@9s`, both
         reported tension 0.875 and no store at all, and
         `destination-carries-the-hash` found 0 pixels moved between the two.
         The cell and signalling scales never had this — their `drawnAt(t)` is
         pure — and this file's clock-vs-state split is why the fibre did.
         `advance` at dt = 0 leaves `time` where it is and re-derives the rest
         from the scenario at that instant, which is the whole of what a paused
         scene owes the address bar. Unbound scenes keep their own dynamics. */
      advance(state.current, 0, { mode: exerciseMode, intensity, isActive, motion, scenario });
    }
    /* THE STORYBOARD ASKS FOR THE MOLECULE, and the geometry draws one head's
       worth of it. Set here rather than inside `advance` because it is not a
       reading — it is which of two pictures the scene is showing, the same kind
       of fact as which level is on screen. `fiberGeometry` carries why one and
       not a hundred and twelve. */
    state.current.showAtp = !!tour.beat?.atp;
    /* THE FIELD IS WHAT A SET LEAVES, so it is drawn while a set is what is on
       screen: the pass's own set, reveal and cause beats, and the explorer's
       FULL SET and COMPARE. Not ONE PULL — a field of waste over a single
       contraction says that contraction made it. */
    state.current.showPhosphate = tour.running
      ? !!(tour.beat?.set || tour.beat?.compare || tour.beat?.atp || tour.beat?.bridge)
      : runWindow?.set === true || freezeAt != null;
    model.update(state.current, state.current.time);
    /* THE SPOTLIGHT, AFTER THE UPDATE — see `spotlightOn` in fiberGeometry. Named
       by the beat's subject or by the part a visitor pressed; re-applied every
       frame while named (update repaints the SR each frame), restored once. */
    {
      const subject = tourFocus?.id ?? open ?? null;
      const roles = subject ? new Set(ROLES_OF[subject] ?? [subject]) : null;
      if (roles) { model.spotlight?.(roles); lastSpot.current = subject; }
      else if (lastSpot.current) { model.spotlight?.(null); lastSpot.current = null; }
    }
    onState?.(state.current);
  });

  // The instrument this scene kept needing. Three separate conclusions about it
  // have been withdrawn — "it does not animate", "the threshold is never
  // crossed", "the published force drives the geometry" — and every one was
  // wrong the same way: judged from outside, from a still frame, with no way to
  // ask the clock what it thought the time was. MotionScene has carried
  // `window.__motionState` for the same reason. Read-only; nothing reads it back.
  useEffect(() => {
    window.__fiberState = () => ({ ...state.current });
    /* AND WHAT IS ACTUALLY DRAWN, for the same reason and a newer one. Every
       level here is `InstancedMesh` and its instance matrices are written by
       `update()` on a live reading, so at build time `Box3.setFromObject`
       answers ±0.80 for a sarcomere that draws out past 3.0 — node cannot see
       the object at all. `LEVELS[*].frame` says what has to be visible and
       `fitCamera` stands the camera where that is true; this is how those
       numbers get checked against the thing rather than against the anchors. */
    window.__fiberBox = () => {
      const box = new THREE.Box3().setFromObject(model.group);
      return { min: box.min.toArray(), max: box.max.toArray() };
    };
    return () => {
      delete window.__fiberState;
      delete window.__fiberBox;
    };
  }, [model]);

  return (
    <>
      <ambientLight intensity={LIGHTS.ambient} />
      {/* NO `castShadow`, NO SHADOW CAMERA, NO BIAS — the map came off the Canvas
          on 2026-09-06 at the owner's *"그림자 필요없음"*, so the nine properties
          that aimed and tuned it were aiming nothing. This is the same light it
          always was; it simply stopped being a shadow light. */}
      <directionalLight position={LIGHTS.key.position} intensity={LIGHTS.key.intensity} />
      <directionalLight position={LIGHTS.fill.position} intensity={LIGHTS.fill.intensity} />

      {showGrid && (
        <gridHelper
          args={[SCENE.grid.size * 2, SCENE.grid.divisions * 2, SCENE.grid.colour, SCENE.grid.subColour]}
          position={[0, -1.6, 0]}
        />
      )}

      {/* EVERY MESH CASTS AND RECEIVES, set here rather than in each builder.
          `fiberGeometry` has eleven `InstancedMesh` sites across three levels
          and threading two booleans through all of them is eleven chances to
          miss one; the model is a tree and the tree can be told once. */}
      {/* THE PARTS THEMSELVES ARE PRESSABLE — owner, FIBER 12: *"sacromere에서 각
          파트들 클릭도 안되고"*. The 44 px handle was the only press surface;
          a visitor presses the thing. Same shape as ENERGY's group press. */}
      <primitive
        object={model.group}
        onClick={(e) => {
          const id = ANCHOR_OF_ROLE[e.object?.userData?.role];
          /* Only a part THIS level names: the fibre's SR sleeve answers to "sr"
             too, and "sr" is a sarcomere demonstration. */
          if (!id || stage !== "main" || tour.running || !anchors.some((a) => a.id === id)) return;
          e.stopPropagation();
          hit.current = true;
          press(id);
        }}
      />
      {/* THE NOUNS FOLD BEFORE THE READINGS DO. `gizmoLayout`'s own comment said
          the stacking fallback is "never reached at the counts the four scales
          carry (7 at 320 px is the worst, and it places)" — this scale went to
          eight and it stopped being true. Measured 2026-08-26:
          "Terminal cisterna" landed 1570 px² on top of "Tropomyosin + troponin"
          at 320 px, and `gate-legibility` said so.
          The solver is right to stack rather than hide — ugly and legible beats
          absent, and a gate should see the crowding. What was wrong is handing a
          320 px screen eight plates. On a phone the readings stay and the nouns
          are one press on `labels` away, which is the control that already
          exists for exactly this. Above 420 px nothing changes.
          CANON F1 TOOK THE COUNT FROM EIGHT TO FIVE — three of these anatomy
          nouns are gone because no beat named them (`fiberGeometry.js` carries
          the rule). Five may well place at 320 px where eight did not; the fold
          stays because nobody has measured that yet, and a phone opening on the
          two readings is the arrangement this comment argues for regardless of
          how the third noun would have placed. */}
      {/* NO FOCUS RING — 2026-09-06. It was an orange lasso drawn around whatever
          the pass was talking about, in the same `#b4530a` the press-ring used,
          and the owner named both in one breath: *"이 orange accent on parts 개
          ㅈ같아 … 그리고 black rings도 개 ㅈ같아 (everywhere)"*. Its job — say
          which part the sentence is about — is done by the `subject` effect
          above, which keeps that part's colour and washes the rest toward the
          paper. A lasso on top of that would be the second thing saying the one
          thing, in the one colour that was asked to go. */}
      <Gizmos
        items={leaving ? [] : fiberGizmoItems(anchors, reading, scenario).filter(
          /* AND THE NAMES FOLD WHILE A PASS IS RUNNING, for the same reason
             they fold at 320 px: the line is the explanation and a plate is the
             free-exploration layer, so two of them on screen at once is two
             things to read and no reason to prefer either. Measured
             2026-08-26 — "It lands on troponin, and the filaments pull." landed
             770 px² on top of "2 of 10" and `gate-legibility` said so.
             The plates carrying a NUMBER stay, because watching a number move is
             the whole of what the pass is for. */
          /* THE FOLD, THIRD FORM. Original: names fold whenever a pass runs
             (the top-of-stage line collided with plates). Design pass, first
             try: no fold at all, because focus needs the named plate up — and
             the overlap gate went red at every width: the OPENING beat carries
             no focus, so for its four seconds every name plate stood in a
             close framing and painted over its neighbours, which is exactly
             what the fold prevented. So: during a pass a name plate passes
             only while it IS the subject. Focusless beats fold everything,
             focused beats show the one the sentence names, free exploration
             is untouched. */
          /* FOURTH FORM, AND IT FOLLOWS THE FIGURES. The reading plates rode
             through every beat on "watching a number move is the whole of what
             the pass is for" — and with `SHOW_FIGURES` off Gizmos never draws
             the number, so what actually rode through was two bare nouns:
             screenshotted at 320, the opening beat (no focus) stood
             "Terminal cisterna" and "T-tubule" over the tissue while the
             sentence was about neither. The exemption keeps its reason only
             while the number is drawn. And DURING a pass the focused plate no
             longer asks `showLabels` — a phone folds its nouns, but the beat's
             own subject is the one plate the fold was never about, which is
             how the troponin beat lost its plate at 320. */
          /* STATES 1 AND 4 SHOW NO TEXT AT ALL — the owner's first and fourth
             lines, both *"아무런 텍스트 없이 (Full Animation the default)"*. So a
             plate draws only while the tour is naming its part. In `silent`
             nothing has been said yet; in `main` the picture stands on its own
             and a name arrives only when a visitor presses for it, which is the
             same beat's focus arriving through the same filter. */
          /* AND IN STATE 4 EVERY NAME IS UP — canon G1, and this line was `false`
             for a day.

             The owner's state 4 is *"다시 아무런 텍스트 없이 (Full Animation the
             default) + go to next level + each elements clickable (and they each
             show what they do when clicked)"*, and I read "텍스트" as "anything
             rendered in words" and drew nothing. Screenshotted 2026-08-31 at
             1280x900: the sarcomere is a bundle of dusty tubes and grey rings
             with NOT ONE WORD on it, and the five handles are `#5c554c` at 0.55
             opacity standing on top of grey ring geometry, so they are
             camouflage. A visitor is looking at an abstract object with no name
             and no visible way to ask for one.

             That fails G1 outright — *"유저가 '이게 무엇인지' 보여야 한다. 위
             전부를 관통한다"* — and G1 is the standard the other items serve.
             The reading that survives both sentences is the one the cell and the
             signalling scale already shipped and the owner has not objected to:
             state 4 carries no PROSE, which is the thing said a hundred times to
             fix, and a part's NAME is not prose. "Each element clickable" needs
             the visitor to be able to see that there are elements at all.

             So the three scales agree now, and the fibre was the odd one. */
          /* AND IN THE MAIN STATE A NAME ARRIVES ONLY WHEN IT IS ASKED FOR —
             `fiber.md` §6, "ring만 있고 hover하면 이름". The pressed part keeps
             its name for as long as its demonstration is the thing on screen,
             which is the same rule one step longer: a visitor who asked is
             still asking. */
          /* AND `showLabels` NOW REACHES A PIXEL — 2026-09-06. It was a prop of
             this component and of nothing else: declared at line 179, read
             nowhere, so the chip that drove it was a dead control and the canon
             it enforced ("ring만 있고 hover하면 이름") was enforced by accident.
             The owner's complaint is the cost of that rule, in their words:
             *"actin이 정확히 어딘지를 모르갰어"*. Standing still, nothing on this
             floor says which rod is actin — colour is a warm-on-warm pair the
             lighting can invert, the thin one is the WIDER one once its
             tropomyosin is on, and the name lives in an `aria-label`. The plates
             already carry the right words ("Actin · thin filament"); they were
             just never allowed to stand. This adds no copy — it lets copy that
             exists be read. */
          (item) =>
            tour.running
              ? item.id === tourFocus?.id || (SHOW_FIGURES && item.value !== undefined)
              : showLabels || item.id === hovered || item.id === open,
        )}
        visible
        focus={tourFocus?.id ?? hovered ?? open ?? null}
        focusAt={tourFocus?.at ?? null}
        /* The name plate is the press surface — owner, FIBER pace 7: *"name tag를 클릭 영역으로"*. */
        onPress={stage === "main" && !tour.running ? (id) => (anchors.some((a) => a.id === id) ? press(id) : undefined) : null}
        sayAt={openAnchor?.at ?? null}
        /* ARRIVING IS A NEW SET OF PARTS, which on this scale means a new level:
           the ladder swaps the whole model, so a viewer who presses `Fascicle`
           is meeting three new things and is introduced to them. Waiting for the
           scenario matters — with no run there are no plates to cascade, and the
           introduction would be over before the first one existed. */
        introKey={scenario ? `${level}` : ""}
      />

      {/* THE WAY IN, canon A3. It stands beside the mitochondria — the one
          thing on this stage that IS the next scale: the cell scale's own note
          calls its field of view "where the fibre scale draws mitochondria",
          so the corridor a viewer is about to be inside is literally next to
          this ring rather than somewhere a caption promises.
          Offset to the right of that anchor so the ring never sits on the
          thing it points at. Hidden while the pass runs. */}
      <WayIn
        /* THE WAY DOWN STANDS ON THE MODEL, and it used to stand past the edge
           of it. `[2.32, -0.33, 0]` was typed against the sarcomere's frame
           half-width — which is the FRAME, not the object — and it is drawn on
           all three levels, where the fibre's and the fascicle's models are
           different sizes again. The mitochondria this control's own comment
           says it "stands beside" are on the FIBRE level. Read off whichever
           model is on screen: the far end of it, a little low, so it is beside
           the tissue rather than inside it and cannot be mistaken for a part. */
        at={wayInAt}
        /* MAIN ONLY — 2026-09-07, owner: *"모든 화면에서 guided tour 중 돋보기
           안보여야돼 (body제외)"*. `!tour.running` hid it through the pass and
           showed it through the plain lap before the pass — the owner's still of
           stage one had a magnifier on the fascicle. Same rule as ENERGY now:
           the door is drawn when the floor is the visitor's. */
        visible={stage === "main" && !tour.running && !leaving}
        onLeave={() => { setLeaving(true); onLeave?.(); }}
        seam={CELL_SEAM}
        /* WHAT THIS FLOOR HANDS THE NEXT ONE. FIBER and ENERGY replay the same
           archived bout on the same protocol clock, so the repetition a visitor
           left on is a fact that survives the crossing — `docs/20260905-fix`
           asks ENERGY to open on the repetition FIBER was showing. The
           phosphate goes too, because it is the mechanism the bridge sentence
           names and the next floor's question ("where does that energy come
           from") is the other half of it.
           NO ATP NUMBER. A fibre scenario publishes force, calcium, the store
           and phosphate; there is no ATP-demand series in it. "Every one of
           those pulls spent ATP" is a true statement about a mechanism and not
           a quantity this run measured, and filling the field with our own
           integral would be exactly the invention this repo refuses. */
        carry={handoff}
      />

      {/* ONE RING PER PART THE STORYBOARD IS ABOUT — canon D2ⓐ. `Handle.jsx`
          carries why the press is a ring and not the plate; `stepsOf` carries
          why this set is exactly the set of parts that have something to show.
          A ring stands ON its part's anchor, which is where the plate hangs
          from, so the name and the control are the same place.

          Drawn while a demonstration runs as well as before one, because the
          ring is how a visitor goes to the NEXT part — this is the main state
          and the main state is for touching. Only the one that is open reads
          differently. */}
      {anchors.map((anchor) =>
        parts.some((part) => part.id === anchor.id) ? (
          <Handle
            key={anchor.id}
            id={anchor.id}
            at={anchor.at}
            label={anchor.label}
            open={open === anchor.id}
            seen={seen.has(anchor.id)}
            onOpen={press}
            /* HOLLOW, LIKE SIGNALS' — 2026-09-06, the owner's *"그 black circles
               ㅈㄴ 별로야"*. Each of these five was a dark ring PLUS a filled
               `#3a352e` bull's-eye at 0.68 opacity, and a depth-ignoring ghost
               copy of the ring on top of that: three dark passes stacked into
               what photographs as a black dot. SIGNALS has drawn the same
               component `hollow` since it landed and reads as a ring you may
               press; this floor was the only one filling them in.
               THE WRONG PATH IS WORTH NAMING: on 2026-09-05 the owner said the
               fibre's rings were poor and the answer was to make them DARKER
               (ink 0.5 -> 0.68). That is how they got here. Darker was the axis;
               the fill was the fault. */
            hollow
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
          `fitCamera` arrived after D6, so its fitted distance had never met
          these bounds; computed in node across seven window shapes from 320x640
          to 2560x1440, the three levels sit 4.79–11.22 back, inside 1.4–16 with
          room at both ends.

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
      <OrbitControls
        makeDefault
        /* AND WHILE PAUSED — owner: *"pause 하고 그 카메라 레벨에서 화면은 돌릴 수
           있어야돼"*. A held beat hands the picture to the hand; Play takes it back. */
        enabled={!tour.running || !playing}
        enableDamping={CONTROLS.enableDamping}
        dampingFactor={CONTROLS.dampingFactor}
        minDistance={1.4}
        maxDistance={16}
      />
    </>
  );
}
