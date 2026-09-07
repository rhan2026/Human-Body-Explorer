/**
 * The muscle fiber visualization, as one embeddable component.
 *
 * This is the surface the anatomy page will use. Everything it needs is a prop;
 * it holds no router state, no global store, and no knowledge of the body model.
 *
 *   <MuscleFiberVisualization
 *     exerciseMode="rep"
 *     motion={motionForExercise}
 *     intensity={0.8}
 *     isActive={inRep}
 *     showControls={false}
 *   />
 *
 * With `showControls` it drives itself from the prototype panel, seeded by the
 * props. Without it, the props are the only input — which is the mode the real
 * integration uses.
 */

import { arrivedFromInside } from "../crossing.js";
import { hasWebGL, NoWebGL } from "../webgl.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";

import { SCENE } from "../anatomyStyle.js";
import FiberScene from "./FiberScene.jsx";
import FiberCompare from "./FiberCompare.jsx";
import FiberControls from "./FiberControls.jsx";
import DrawerSlot from "../shell/DrawerSlot.jsx";
import FiberMetrics from "./FiberMetrics.jsx";
import { DEFAULT_MODE, forcePeaks, standingNote, storeCeilings } from "./fiberSimulation.js";
import { fiberWalk } from "./fiberWalk.js";
import { useOpenerStanding, plainLine } from "../tour.js";
import { holdTour } from "../tourControl.js";
import { LEVELS, LEVEL_ORDER } from "./fiberGeometry.js";
import "./fiber.css";
import "../scaleHead.css";
import Guide from "../guide/Guide.jsx";
import EvidenceTrace from "../trace/EvidenceTrace.jsx";
import { drop, pct, peakChange, repPeaks } from "../trace/trace.js";
import { useAim } from "../guide/useAim.js";
import { useWalk, walkAlreadyDone } from "../guide/useWalk.js";

/**
 * A prop that the prototype controls may also write.
 *
 * The prop wins whenever it changes, so a parent staying in charge always can;
 * between changes the local control is free to move. Without this, the controls
 * would either be ignored or would permanently shadow the parent.
 */
function useOverridable(propValue, enabled) {
  const [value, setValue] = useState(propValue);
  useEffect(() => setValue(propValue), [propValue]);
  return enabled ? [value, setValue] : [propValue, () => {}];
}

/** This scale's own "already walked" mark — one per scale, because being walked
    through the body is not being walked through this. */
const WALK_KEY = "hpe.guide.fiberWalk";

export default function MuscleFiberVisualization({
  /* THE LABELS CHIP'S OWNER, once the drawer that held it went — 2026-09-06.
     `useOverridable(showLabels && !narrow, showControls)` hands back a NO-OP
     setter whenever `showControls` is false, which is every shipped fibre
     screen, so a chip wired to the local `setLabels` alone would have looked
     live and done nothing. This is the same two-line shape the level ladder
     already uses for `onLevel`: whichever owner is real answers, the other is a
     no-op by construction. */
  onShowLabels = null,
  replay: replayProp = null,
  exerciseMode = DEFAULT_MODE,
  intensity = 0.7,
  isActive = true,
  motion = null,
  scenario = null,
  /** The instant the hash names, in body-clock seconds. Forwarded, not used here. */
  startAt = 0,
  hashNamesAnInstant = false,
  axis = null,
  level = "sarcomere",
  showControls = false,
  /* WHERE A LEVEL CHANGE GOES WHEN THIS COMPONENT DOES NOT OWN THE STATE.
     `useOverridable` hands back the PROP and a no-op setter unless
     `showControls` is on, so the ladder below could be drawn and pressed and
     change nothing. The shipped scene keeps `level` (`DevFiberScene`) and passes
     it down, so the press has to go back up. Given one, the ladder draws. */
  onLevel = null,
  /** The muscle the visitor picked upstairs, as its mesh id. */
  muscle = null,
  showLabels = true,
  showMetrics = true,
  showGrid = false,
  /**
   * Play/pause, when a parent wants to own it. Both are optional and the local
   * state is the fallback. Between D3 and A4 the fallback was what the app
   * actually ran on — no page handed these down, so the run started and kept
   * going — but A4 landed on 2026-08-31 and `DevFiberScene.jsx` owns the flag
   * again, passing it in beside `Ways`. The fallback is now the prototype and
   * demo path only.
   *
   * NOT `useOverridable`, which is the pattern above for props the prototype
   * panel may also write. That pattern lets the local copy drift from the
   * parent's between prop changes, and ownership of this has to be single —
   * which is exactly what let A4 be wired by handing `playing` down rather than
   * adding a second source of truth.
   */
  playing: playingProp,
  onPlaying,
  /** Presses of a replay control. Each one re-arms the guided pass. Wired,
      unpressed, waiting on D5. */
  tourNonce = 0,
  /** Told whether a guided pass is armed. */
  onPassing,
  onState,
  className = "",
}) {
  const [mode, setMode] = useOverridable(exerciseMode, showControls);
  const [drive, setDrive] = useOverridable(intensity, showControls);
  const [active, setActive] = useOverridable(isActive, showControls);
  const [scale, setScale] = useOverridable(level, showControls);
  /* WHICH REPETITION THE COMPARISON IS SHOWING, straight off the storyboard
     beat. Null the rest of the time, which is most of the time — see
     `.fiber-compare` in `fiber.css` for why this is not a permanent gauge. */
  const [compare, setCompare] = useState(null);
  /* THE TWO INSTANTS THE COMPARISON IS OF, measured off the bound run. Memoised
     on the scenario because it sweeps the whole grid, and read here rather than
     inside `FiberCompare` so the meters and the storyboard's own seeks come
     from one call — the beat parks the clock on `peaks[n].at` and the bar is
     that same repetition's reading, and two sweeps could disagree the day the
     helper changes. */
  const peaks = useMemo(() => (scenario ? forcePeaks(scenario) : []), [scenario]);

  /* ---- THE EXPLORER'S STATE ------------------------------------------- *
     Three ways to watch one run. `FiberModes.jsx` carries why these three. */
  const [runMode, setRunMode] = useState("one");
  /* Which repetition COMPARE is holding against the first. Starts at the last,
     because that is the comparison the pass just made and the one the mode
     exists to let a visitor take apart. */
  const [compareRep, setCompareRep] = useState(null);
  const effectiveRep = compareRep ?? (peaks.length ? peaks[peaks.length - 1].rep : 1);

  /* THE WINDOW EACH MODE WATCHES THROUGH, derived from the run's own protocol
     rather than typed. `cycle_s` and `repetitions` are the authors' and ours
     respectively and `protocol.whose_protocol` says which; nothing here invents
     a duration. */
  const runWindow = useMemo(() => {
    const p = scenario?.protocol;
    if (!p?.cycle_s || !p?.repetitions) return null;
    if (runMode === "set") {
      /* The bout, and only the bout. The archive keeps 6.5 s of recovery after
         it, which is real and is not what "the full set" means — a visitor who
         asked to watch ten repetitions should not spend half the loop watching
         nothing happen. */
      /* `set: true` is what tells the scene this window is a SET, which is what
         the phosphate field is about — see `fiber.md` §7. */
      return { from: 0, to: p.cycle_s * p.repetitions, speed: 1, set: true };
    }
    if (runMode === "one") {
      /* One cycle, opening a little before a burst so the loop starts with the
         command rather than in the middle of the response. The second burst
         rather than the first: the first fires at t=0 with the store full and
         nothing before it, so a loop seam there is a jump from a tired fibre to
         a fresh one. A fifth speed, for the reason the pass slows down — the
         burst is 0.1625 s and the transient it causes is 0.126 s FWHM, and the
         ORDER between them is the lesson. */
      const from = p.cycle_s - p.stim_s * 0.6;
      /* 0.2 -> 0.5 ON 2026-09-07 — owner, FIBER 8: *"마지막 main에서 one show of movement가 너무 느려"*. One cycle now takes 1.3 s of the viewer's time instead of 3.25. */
      return { from, to: from + p.cycle_s, speed: 0.8 /* 0.5 -> 0.8, owner 2026-09-07: "main motion 너무 길어 더 빨리 수축" */ };
    }
    return null;
  }, [scenario, runMode]);

  /* COMPARE freezes on the scrubbed repetition's own measured peak. */
  /* WHERE A SCRUB PUT THE SET, or null while it is playing. `fiber.md` §10:
     dragging the strip parks the run, which is what makes "everything moves on
     the same clock" something a visitor can verify rather than be told. */
  const [scrubAt, setScrubAt] = useState(null);
  /* A mode change hands the run back — a scrub belongs to the set it was made
     in, and carrying it into ONE PULL would park a loop that is supposed to
     loop. */
  useEffect(() => {
    setScrubAt(null);
  }, [runMode]);

  const freezeAt = useMemo(() => {
    if (runMode === "set") return scrubAt;
    if (runMode !== "compare") return null;
    /* `frameAt`, not `at` — the shared phase, so scrubbing between repetitions
       changes only what fatigue changed. `forcePeaks` carries the measurement. */
    const row = peaks.find((p) => p.rep === effectiveRep);
    return row?.frameAt ?? row?.at ?? null;
  }, [runMode, peaks, effectiveRep, scrubAt]);
  /* THE NOUNS START FOLDED ON A PHONE. Eight plates do not place in a 320 px
     viewport — measured, `gate-legibility` caught "Terminal cisterna" 1570 px²
     over "Tropomyosin + troponin" — and the six that collide are the anatomy
     names. `FiberScene` keeps the two that carry a reading whatever this says,
     so a narrow screen opens with what the scale is FOR and the names one press
     away. Read once at mount rather than watched: a viewer who has pressed
     `labels` has made a decision, and a rotation that undid it would be the
     screen arguing with them. */
  const narrow =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 420px)").matches
      : false;
  const [labels, setLabels] = useOverridable(showLabels && !narrow, showControls);
  /* THE GUIDED PASS PLAYS ITSELF ON ARRIVAL. Rex asked for the camera to move
     and narrate, and a first-time viewer does not know there is anything to
     press. It ends on the first pointer, key, wheel or touch — `cinematic.js`'s
     four, and pointermove is deliberately not among them because a resting
     mouse jitters. Held in state rather than a ref so the line can leave the
     screen when it does. */
  const [tourLine, setTourLine] = useState(null);
  /* Whether a demonstration is playing — reported by `FiberScene`, which is the
     only place that knows. See the note on its `onRunning` prop for why neither
     `stage` nor `tourLine` can stand in for it. */
  const [passRunning, setPassRunning] = useState(false);

  /* ── THE EVIDENCE TRACE — `docs/20260907-fix/evidence_trace_clean.md` ──────
     Calcium and force over the window the picture is playing, floating in the
     left-upper open space, on the SAME clock: `timeAt` is written per frame
     from the scene's own state (below, in `handleState`), the seek goes back
     through the scene's one seek (`seekRef`), and the window is `runWindow`
     itself — ONE PULL in the main state — so the trace is literally the 3D's
     small window and never a second reading of the run.
     ONLY ONCE THE PHENOMENON HAS BEEN SHOWN: `stage === "main"` and no
     demonstration running. Nothing of this exists in the plain lap or the
     pass (md rule 3; the owner's arrival grammar).
     THE NUMBERS ARE COMPUTED, NEVER TYPED (CLAUDE.md §9): the peak of the
     last repetition against the first, off the export, on the protocol's own
     cycle. And they are OURS — our port of the authors' model under their
     protocol — so the reveal says "this run" and the source line stays the
     door to Francis, not a claim that Francis reports −63 % (§5). */
  const timeAt = useRef(0);
  const seekRef = useRef(null);
  const avoidPoint = useRef(null);
  const [openPart, setOpenPart] = useState(null);
  const traceLines = useMemo(() => {
    if (!scenario) return [];
    const ca = scenario.series("Ca_myo_total");
    const force = scenario.series("force_relative");
    let caHi = 0;
    for (const v of ca.values) if (v > caHi) caHi = v;
    let forceHi = 0;
    for (const v of force.values) if (v > forceHi) forceHi = v;
    /* THE SMALL NUMBERS ON THE GRAPH — owner 2026-09-07: this run's own peaks in the archive's units (µM; fraction of maximum as %), rounded for display. */
    return [
      { id: "calcium", label: "Calcium", t: ca.t, values: ca.values, lo: 0, hi: caHi, tone: "calcium", mark: `${caHi >= 10 ? Math.round(caHi) : caHi.toFixed(1)} µM peak` },
      /* `force_relative` is already the authors' fraction of maximum. */
      { id: "force", label: "Force", t: force.t, values: force.values, lo: 0, hi: 1, tone: "force", mark: `${Math.round(forceHi * 100)} % of max` },
    ];
  }, [scenario]);
  const traceReveal = useMemo(() => {
    if (!scenario) return null;
    const p = scenario.protocol;
    const caPeaks = repPeaks(scenario.series("t").values, scenario.series("Ca_myo_total").values, p);
    const forcePeaks = repPeaks(scenario.series("t").values, scenario.series("force_relative").values, p);
    const rows = [
      ["Ca²⁺ peak", pct(peakChange(caPeaks))],
      ["Force", pct(peakChange(forcePeaks))],
    ].filter(([, v]) => v);
    return rows.length ? { label: "Model result · this run", rows } : null;
  }, [scenario]);
  /* THE STORE'S OWN EVIDENCE, and only when the store was pressed (md: "SR
     calcium 941 → 168은? 처음부터 보여주지 않아. Calcium store 자체를 클릭했을
     때만"). First sample against the lowest, off `Ca_SR_total`; the rounding
     is display and the record is one press away on the source. */
  const traceNote = useMemo(() => {
    if (!scenario || openPart !== "sr") return null;
    const d = drop(scenario.series("Ca_SR_total").values);
    return d ? [["SR Ca²⁺", `${Math.round(d.from)} → ${Math.round(d.to)} µM`]] : null;
  }, [scenario, openPart]);
  const traceWindow = runWindow ?? (scenario ? { from: scenario.grid.t0, to: scenario.grid.tEnd } : null);
  /* THE STORYBOARD'S OPENING SENTENCE, which under a press model belongs to no
     part and so is never played. It is the one line that says what the whole
     picture is — canon G1, *"유저가 이게 무엇인지 보여야 한다"* — so it stands
     while the names are arriving, and the run's own phase note takes over once
     the introduction is done and the scale is waiting to be touched. */
  const [openerSaid, setOpenerSaid] = useState(null);
  /* WHOSE SENTENCE THIS IS. The label of the part that was pressed, kept beside
     the line so the name can head it — see `.say__of`. Set together with the
     line and never cleared alone, or a sentence would end up wearing the
     previous part's name. */
  const [saidBy, setSaidBy] = useState(null);
  /* AND IT STANDS FOR ITS OWN READING TIME, NOT THE CASCADE'S. `useOpenerStanding`
     carries the measurement — the cascade is under two seconds and these sentences
     need three to eight. Whichever is longer is how long the scale speaks. */
  const openerUp = useOpenerStanding(openerSaid);
  /* WHERE THE GUIDE IS STANDING. `FiberScene` writes this inside the render
     loop in canvas pixels; the resolver below moves it into the stage's frame,
     because the canvas is one child of the stage and the guide is another. */
  const guidePoint = useRef(null);
  /* WHICH PART THE WALK IS NAMING. Read by the scene inside its render loop, so
     a beat changing does not re-render the canvas. */
  const walkAnchor = useRef(null);
  const stageRef = useRef(null);
  const resolveGuide = useCallback(() => {
    const at = guidePoint.current;
    const stage = stageRef.current;
    if (!at || !stage) return null;
    const canvas = stage.querySelector("canvas");
    if (!canvas) return null;
    const s = stage.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    /* The canvas is sized in CSS pixels by its own box, and `size` inside R3F
       reports the same box, so this is an offset and not a scale. Measured
       rather than assumed: the stage also holds the tour line and the chrome. */
    return { x: at.x + (c.x - s.x), y: at.y + (c.y - s.y), r: at.r ?? 0 };
  }, []);

  /* A SHARED LINK IS A DESTINATION, NOT A TOUR. `destination-carries-the-hash`
     went red on two scales the night the passes landed, and it was right: a hash
     that names an instant is somebody saying "look at THIS", and a storyboard
     that immediately seeks to its own first beat makes two different links draw
     the same picture — the exact defect that spec exists to catch, reintroduced
     by the thing meant to explain the scene.
     `descent.spec.js` had already settled the principle for the dive: "a shared
     link is not a ride". Same rule, one layer down. Arriving with no instant is
     arriving at the front of the scale, and that is where a pass belongs. */
  /* TRUE ON ARRIVAL AND FOR EVERYONE, INCLUDING A SHARED LINK. This used to be
     `!hashNamesAnInstant || arrivedFromInside()`, guarding a real defect: a
     storyboard that seeks to its own first beat makes two links that name
     different instants draw the same picture, which is exactly what
     `destination-carries-the-hash` exists to catch. The introduction cannot do
     that any more — it moves no camera and touches no clock, it only shows the
     names of things that are already on screen. So the guard has nothing left
     to guard, and a visitor arriving by link gets told what the parts are like
     everybody else. */
  /* WHICH OF THE FOUR STATES THIS SCALE IS IN — `silent`, `tour`, `main`.
     `FiberScene` owns the machine and reports it; this file only decides what
     is drawn in each. It was a boolean called `tourOn` that meant "the plate
     cascade is running", which was standing in for a state machine that did not
     exist yet. */
  const [stage, setStage] = useState("silent");
  const tourOn = stage === "tour";
  /* Owner, FIBER 14: nothing rides the zoom. Set by the scene's WayIn press. */
  const [leaving, setLeaving] = useState(false);
  /* SKIP DURING THE PLAIN CONTRACTION, HELD FROM HERE — `Ways` reads
     `tourControl`, so the button appears wherever the page mounts it, and this
     component mounts before `FiberScene` does (the scene is behind `Suspense`).
     Holding it from the scene left the guide's resting prompt showing in the
     gap; SIGNALS measured ~100 ms of it. `stage` here mirrors the scene's
     (`onIntro`), so the press travels DOWN as a count rather than being set
     here and overwritten by the scene's next report. Only once there is a run
     to contract — `beats` are built from `scenario`, so that is the same test. */
  const [skipIntro, setSkipIntro] = useState(0);
  useEffect(() => {
    if (stage !== "silent" || !scenario) return undefined;
    return holdTour({ id: "intro", skip: () => setSkipIntro((n) => n + 1) });
  }, [stage, scenario]);
  /* NAMING THE PART AND FINDING IT ARE ONE STEP, in that order. The walk asks
     for a part by name; this records the name for the scene's projection and
     answers with where the character is standing. Both halves are what
     `useWalk` wants: a beat says nothing until its anchor resolves. */
  const resolveWalkAnchor = useCallback(
    (id) => {
      walkAnchor.current = id ?? null;
      return resolveGuide();
    },
    [resolveGuide],
  );
  /* THE WALK THIS SCALE PLAYS ON ARRIVAL, and `fiberWalk.js` carries why it is a
     walk rather than the storyboard: the storyboard is real and keeps the
     presses, but it was written to be watched by somebody who already knows
     what a cisterna is. The walk moves no camera and seeks no clock.
     `storeCeilings` is called with the same run the scene measures it from, so
     the sentence about the refill and the picture of it cannot disagree. */
  const walkBeats = useMemo(
    () => (scenario ? fiberWalk(scenario, storeCeilings(scenario)) : []),
    [scenario],
  );

  /* THE ONE THING THIS FLOOR FOUND, STANDING WHERE THE OTHER TWO STAND IT.
     Measured 2026-09-05 at 1440x900: the cell and the signalling scales each
     keep a `scale-facts` block on the picture and the fibre kept none, so
     `gate-legibility`'s "every scale says at least one thing on the picture
     itself" named exactly one bare scale and it was this one — owner,
     2026-09-04: *"fiber의 설명이 예전에 머물러 있어"*.

     AND THE SAME MEASUREMENT SAID THE FIBRE DREW ONE NAMED RING TO THE OTHERS'
     FIVE AND EIGHT, WHICH WAS MY FILTER AND NOT THE SCALE. That reading kept
     only labels of five words or more; the fibre's names are the SHORT ones
     ("Actin · thin", "T-tubule · carries the signal"), so they fell out of the
     count and the other two floors' longer glosses did not. Re-read directly:
     `fiberGizmoItems` maps every anchor, `showLabels` defaults true, and the
     fold at `FiberScene.jsx:872` applies only while a pass is running. Written
     down because the wrong version of this sentence stood in this file first.

     IN WORDS, AND THE RUN PICKS WHICH WORDS. `storeCeilings` is where the store
     got back to between one repetition and the next; the sentence branches on
     the first and last of those, so a re-export that moved the finding moves the
     sentence with it. No figures — owner, 2026-09-04: *"숫자는 필요가 없어 뭐 막
     58%이런건 그냥하지를 마"*. The falling ceiling is 58% -> 48% of rest on
     `soce_on` and stays out of the prose; the direction is what a reader needs.

     AND THE SECOND LINE IS THE SURPRISE, not a caveat. The ceiling drops every
     repetition and a reader who has followed that expects the store to run out;
     `storeEmptiestAt`'s low point is 167.9 µM on this run, which is low and is
     not nothing. That gap is what this floor is about. */
  const spend = useMemo(() => {
    /* SARCOMERE ONLY, AND THIS IS THE SAME RULE AS EVERY OTHER CLAIM ON THIS
       FLOOR. Both sentences are about the terminal cisternae — how full the
       store gets back to between repetitions — and the store is DRAWN on the
       sarcomere and nowhere else. `buildFiberLevel` and `buildFascicleLevel`
       read three fields off the state (`crossBridges`, `length`, `girth`) and
       none of them is the store.
       Screenshotted 2026-09-05 at 1440x900: "The store gets back a little less
       after every repetition" stood at the foot of the FASCICLE, over eighteen
       tubes with no store among them. A visitor looking for the thing the
       sentence names would have found nothing, which is the failure this whole
       floor's rebuild is about. */
    if (scale !== "sarcomere") return null;
    const c = scenario ? storeCeilings(scenario) : [];
    if (c.length < 2) return null;
    return { falling: c[c.length - 1].value < c[0].value };
  }, [scenario, scale]);
  /* THE WALK IS NOT ARMED ANY MORE, 2026-09-05, AND NOTHING IS DELETED.
     It played on arrival and the guided pass now does. Both cannot: they write
     the same sentence slot and stand the same character in two places, and the
     one that moves the picture is the one this floor is for. `fiberWalk.js`'s
     own header is the argument against keeping it in front — "this moves no
     camera, seeks no clock and touches nothing the run is doing" — which on a
     floor whose identity is WATCH is eighteen sentences over an animation that
     ignores them.
     Left standing rather than removed: the module is pure, `fiberWalk.test.js`
     still grades it, and the day the pass is interrupted early enough to want a
     quieter arrival this is what that would be built from. `false` and not a
     deleted call, so the disarming is a line somebody can read and reverse. */
  const WALK_ARMED = false;
  const walk = useWalk(
    WALK_ARMED && !walkAlreadyDone(WALK_KEY) && stage !== "silent",
    walkBeats,
    resolveWalkAnchor,
    WALK_KEY,
  );
  /* THE SENTENCE THE CHARACTER IS CARRYING. A press outranks everything and it
     STAYS (canon D2ⓐ) — a visitor who asked for a part's sentence keeps it, and
     the walk is only what fills the arrival before anybody has asked. */
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
  /* THE TOUR'S LAST SENTENCE LEAVES WITH THE TOUR. It stays for the length of a
     demonstration — canon D2ⓐ, "글은 그 뒤에 짧게", and a line a visitor pressed
     for must not be wiped a moment after it lands — but state 4 is
     *"아무런 텍스트 없이"*, so the automatic tour ending is the one transition
     that clears it. Without this the whole-run conclusion sat on the picture
     for the rest of the visit: measured, `endedSilent: false` at 54 s. */
  useEffect(() => {
    if (stage === "main") {
      setTourLine(null);
      setSaidBy(null);
    }
  }, [stage]);
  /* THE INTRODUCTION IS SHORT AND IT ENDS BY ITSELF — canon §0's two states,
     with D5 saying what the first one does: *"action 전에 모든 element를 먼저
     보여준다 — this does this, this is here. 끝나면 그 층의 main 상태로 간다."*

     It is the plate cascade and nothing else: every part named, in place, one
     after another, and then the scale stands and waits (`gizmo.css` carries why
     that is the whole introduction and why there is no second script). The
     length is the cascade's own, so the two cannot drift.

     WHAT THIS REPLACES was forty-two seconds of narration that started itself
     and ENDED ON ANY PRESS — so the more a visitor explored, the less the
     screen taught. Canon D2ⓐ: *"지금은 정반대다. 자막이 먼저 떠들고, 방문자가
     누르면 오히려 꺼진다."*

     THE LENGTH IS NOT DECLARED HERE. `Gizmos` runs the cascade and tells us
     when it is over; a number typed in this file would be a second opinion
     about a duration the stylesheet owns, and it would say "the introduction is
     finished" while the last name was still fading in. */
  /* The strip is outside this component and the pass's on/off is inside it. */
  useEffect(() => {
    /* THE REAL PASS, NOT THE ARRIVAL CASCADE. `tourOn` is `stage === "tour"` —
       the whole-scale narration canon D2ⓐ retired — so this reported `false` for
       every part demonstration the scale actually plays, and the outer scene's
       copy of `FiberControls` had no way to know a pass was running. */
    onPassing?.(tourOn || passRunning);
  }, [tourOn, passRunning, onPassing]);
  /* Playback is controlled when a parent hands it down and self-managed
     otherwise, and since D3 nothing hands it down. TRUE IS THEREFORE LOAD-
     BEARING, not a default: with the strip gone there is no play button on
     this scale, so a run that arrived stopped could never be started. The page
     used to seed this false for a hash naming an instant — a shared link is a
     destination and not a ride — and that reading was right only while
     something on screen could press play. */
  const [ownPlaying, setOwnPlaying] = useState(true);
  const playing = playingProp ?? ownPlaying;
  const setPlaying = onPlaying ?? setOwnPlaying;
  /* Replay speed for a bound run. Local rather than a prop because the only
     thing that sets it is the panel's own chips — no parent has ever had an
     opinion about it, and the day one does it becomes overridable the way
     `playing` is.

     IT STARTS AT HALF, AND 1x IS WHERE IT USED TO START BECAUSE OF A CLAMP
     RATHER THAN A CHOICE. `FiberScene` forced 1x the moment a scenario bound,
     the chips inherited that number when they arrived, and nobody has ever
     argued FOR it. The argument against it is measured and is this scale's
     entire subject: one calcium transient is 0.126 s FWHM and the burst that
     causes it is 0.1625 s, which at 1x is about eight and ten frames — the
     ORDER between them, which is the lesson, is over before the eye has found
     either. At half speed they are fifteen and twenty, and the 0.65 s cycle
     reads as a rhythm instead of a flicker.

     HALF AND NOT A QUARTER, which is the other chip and is free. A quarter
     turns the 13 s run into 52 s of watching before the tenth repetition
     lands, and the thing a viewer is here to see is the tenth compared with
     the first. 0.25x is right for inspecting one transient and is one press
     away; it is the wrong place to arrive. */
  /* THE RATE IS A CONSTANT AGAIN, AND HALF IS THE CONSTANT. It was lifted to
     the page on 2026-08-27 so the chips could ride the strip; D3 removed the
     strip, so there are no chips and no writer. The prop stays because the
     number was never this component's opinion to have — a page that wants a
     different rate still passes one — but nothing in the app does today, and a
     0.25x that a viewer can reach belongs to whoever brings a control back. */
  const replay = replayProp ?? 0.5;
  /* The instant the hash asked for and this scene refused. Held here rather
     than inside the Canvas because the panel is outside it — the same shape
     CellScale and SignallingScale use, where the scene clamps and the readout
     is the only reason the clamp is honest.

     IT WAS SET AND NEVER DRAWN, from the day the right-hand panel came down
     until 2026-08-30. `FiberScene` reported the clamp here, this state took it,
     and nothing rendered it: the sentence lived in `DevFiberScene`'s footer,
     fed by an `onRange` prop that this component's signature never
     destructured. So the page held a handler that was dropped on the floor and
     this component held the value with no reader — a silent snap in both
     halves, which CLAUDE.md §5 calls a bug rather than a rough edge. Found
     while removing the footer (D4); the banner is printed here now, where the
     value has been all along. */
  const [range, setRange] = useState(null);

  // useFrame runs at 60 fps and the readout does not need that. Same throttle
  // PushUpScene uses for its HUD.
  //
  // NO LONGER GATED ON `showMetrics`, and that gate was a bug waiting for a
  // second reader. The callouts in the viewport read the same sample now — a
  // gizmo is React and the frame loop is not — so a scene with the panel off
  // would have drawn plates frozen at whatever the store held when it mounted.
  // One 10 Hz interval feeds both; two would be two opinions about one number.
  const live = useRef(null);
  const [readout, setReadout] = useState(null);
  useEffect(() => {
    const id = setInterval(() => live.current && setReadout({ ...live.current }), 100);
    return () => clearInterval(id);
  }, []);

  /* THE PLATE IS LATE, NOT WRONG — MEASURED, AND A FIX WAS TRIED AND REMOVED.
     Q13 R5, 2026-08-27: the interval above samples at a fixed 10 Hz and the
     store empties and refills inside one calcium transient (0.126 s FWHM). Over
     279 frames of the bound run the plate and the store the cisterna is drawn
     from disagreed by a median of 11 µM and a worst of **379 µM — 40% of full
     scale**: "499 µM of 941" printed over a cisterna drawn nearly empty.
     `FiberScene` names this failure forty lines above the call that feeds this,
     about ONE frame of skew. This was forty.

     WHAT WAS TRIED: publishing out of turn whenever the store moved more than
     2% of full scale. Measured with and without, the plate changed **12.7 times
     a second against 12.6** — no difference, because at this machine's 20 fps
     the 100 ms interval already fires every other frame. Removed rather than
     kept: machinery that changes nothing is machinery the next reader has to
     understand for nothing.

     WHAT THE NUMBER ACTUALLY IS: against the last five frames rather than the
     current one, the plate's value is a value the store really had — median 0,
     ninetieth percentile 1 µM. The residual is one React commit over a canvas,
     which no DOM number escapes, and it shows as 379 µM only because the store's
     slope inside a transient is enormous. `gate-the-ride` holds the property
     that survives a slow machine: never a number the run did not have. */
  const handleState = (state) => {
    live.current = state;
    timeAt.current = state.time;
    onState?.(state);
  };

  return (
    /* `fiber--stage-only` IS WHAT ACTUALLY GIVES THE STAGE THE WINDOW. The
       modifier and its narrow-screen rule have been in `fiber.css` since the
       sidebar came off, saying "one track, and the stage takes the window" —
       and nothing has ever put the class on. So under 1000 px the grid kept
       reserving `minmax(0, 1fr)` for a `.fiber__panel` this file no longer
       renders: measured 2026-08-31 at 320x640, the canvas stopped at y = 269
       and 371 px of blank paper stood under it, more than half the window.
       The cell scale carries the same modifier under its own name for the same
       reason (`CellScale.jsx`), and it works there because it is applied. */
    <div className={`fiber fiber--stage-only ${className}`.trim()}>
      <div className="fiber__stage" data-testid="fiber-stage" ref={stageRef}>
        {/* THE LAST STANDING SENTENCES ON THIS FLOOR ARE GONE — 2026-09-06.
            They read "The store gets back a little less after every repetition"
            and "It still never runs empty — ours, by reading where the store
            recovers to between one repetition and the next", bottom left, all
            the time.
            THE OWNER EXCLUDED THE FIBRE WHEN THEY FIRST ASKED FOR THIS —
            *"밋밋한 화면 텍스트는 fiber말고 다른 층"* — so I left them, said so,
            and said they were now the only permanent copy on the floor. Shown
            that, the answer was *"빼"*. Recorded because the exclusion was
            explicit and this reverses it on their word, not on my reading.
            `spend` is still computed. What it says — the reserve recovers a
            little short each time — is the pass's fourth beat, spoken while the
            cisternae are visibly dimming, which is where a finding about the
            picture belongs. */}
        {/* THE CONTROLS ARE IN THE DRAWER, AND NOTHING WRAPS THEM ANY MORE.
            The 272 px column on the right came off on 2026-08-30 at the owner's
            word ("right sidebar 삭제해") and its controls went into the shell's
            drawer by portal. They spent the same day inside a `.transport` box
            on the stage, next to the `Timeline`, because that box was the one
            thing on the stage that held controls — but `DrawerSlot` renders
            nowhere, so the box wrapped a portal and a clock. D3 took the clock
            and the box had nothing left to be.

            WHAT WENT WITH THE COLUMN: `FiberMetrics`, and the `Contraction`
            heading whose whole content was a provenance caption for numbers
            that no longer render (the fibre lane's own audit entry). The
            metrics need a home before `SHOW_FIGURES` can go back to true, and
            that is worth saying out loud because `uiMode.js` promises the flag
            is the entire procedure. */}
        {/* THE ONE CONTROL THAT CHANGES WHAT IS DRAWN, ON THE PICTURE IT
            CHANGES — canon F2, 2026-08-30: *"Gizmos식 토글도 제발 main 화면 안에
            디자인 ㅈㄴ 잘 입혀서 floating하게 어딘가에 두는걸 목표로 해."*
            It was three chips inside ☰, under a heading, behind a press. Every
            other scale's drawer holds settings; this one held the only door in
            the descent that swaps the object — fascicle, fibre, sarcomere — and
            `docs/objective.md`'s Gizmos section is what it failed: a Gizmo hands
            you the system and the few controls that turn it, in the open.

            HIDDEN WHILE THE PASS RUNS, VISIBLE IN THE MAIN STATE, which is the
            latch canon §0 draws and `A3`'s way-in will share. `tourOn` is that
            latch and it already exists here: true from arrival, false the moment
            the pass ends or a viewer stops it, true again on `again`. Nothing
            new is held for this. The pass is showing; the main state is
            touching, and a toggle competing with a beat is two invitations at
            once.

            A LADDER, NOT A ROW OF CHIPS. `LEVEL_ORDER` is outer to inner and it
            is drawn top to bottom, so the control has the same shape as the move
            it makes — the descent this whole app is. The lit rung is where you
            are; the dot column reads down like a depth gauge. `fiber.css`
            carries the placement and why the left edge is the corner that is
            free at every width.

            NOT PORTALLED. `DrawerSlot` is how a scene's own state reaches the
            shell; this is a control on the scene's own stage, and it renders
            where it stands. */}
        {/* HIDDEN WHILE A DEMONSTRATION RUNS, and `tourOn` is the wrong test for
            that — it is `stage === "tour"`, the whole-scale narration canon D2ⓐ
            retired, so it is false for every pass this scale actually plays. The
            same mistake was in the labels chip. Canon §0 gives the pass the
            showing and the main state the touching, so the ladder goes while a
            part is being demonstrated and comes back when it ends. */}
        {/* AND NOT WHILE SILENT EITHER — 2026-09-06. The owner's first stage is
            *"toggle이고 뭐고 없어 그냥 left header + right pause skip"*, and this
            ladder is a toggle. `stage === "main"` says it in one test where
            `!tourOn` said it for one of the two stages before main. */}
        {(showControls || onLevel) && stage === "main" && !passRunning && !leaving && (
          <div className="fiber-levels" role="group" aria-label="Scale" data-testid="fiber-levels">
            {LEVEL_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                className={scale === key ? "fiber-levels__rung fiber-levels__rung--on" : "fiber-levels__rung"}
                aria-pressed={scale === key}
                /* Both, and neither is redundant: `setScale` is the local state
                   the prototype panel drives, `onLevel` is the shipped scene's.
                   Whichever is live answers; the other is a no-op by
                   construction. */
                onClick={() => {
                  setScale(key);
                  onLevel?.(key);
                }}
              >
                <span className="fiber-levels__dot" aria-hidden="true" />
                {LEVELS[key].label}
              </button>
            ))}
            {/* THE NAMES SWITCH, MOVED OUT OF THE DRAWER on 2026-09-06 when the
                ☰ came off this floor. It is the one control the sidebar carried
                that had no other home — everything else in there duplicated the
                lens, the viewbar or Ways. It stands in the plate the ladder
                already owns rather than starting a second floating cluster,
                because two plates on one edge is the layout the owner is
                pointing at when they say the design still has room. */}
            {/* THE `names` SWITCH IS GONE — owner, FIBER pass 7: *"이거 names그냥 빼도 돼"*. */}
          </div>
        )}
        {showControls && (
          <DrawerSlot>
            <FiberControls
              bound={!!scenario}
              exerciseMode={mode}
              onExerciseMode={setMode}
              motion={motion}
              intensity={drive}
              onIntensity={setDrive}
              isActive={active}
              onActive={setActive}
              showLabels={labels}
              /* A PASS IS RUNNING WHENEVER A LINE IS BEING SAID — 2026-09-04.
                 This was `tourOn`, which is `stage === "tour"`: the whole-scale
                 narration canon D2ⓐ retired. During a PART's demonstration —
                 which is the only pass this scale plays now — `stage` is "main",
                 so `passing` was false while `FiberScene` was folding the plates
                 down to the focused one. The labels chip sat lit with the labels
                 folded, and a viewer pressing it got the opposite of what it
                 said.
                 `tourLine` WAS TRIED FIRST AND IS THE WRONG SIGNAL: it is sticky
                 on purpose — a demonstration ends by handing back `null` and this
                 scale keeps the sentence rather than unsaying it — so from the
                 second press onward it would hold the chip dark forever. The
                 scene reports the running state directly instead. */
              passing={tourOn || passRunning}
              onShowLabels={setLabels}
            />
          </DrawerSlot>
        )}
        {/* WHAT THE STAGE STILL HAS TO SAY, top-left, where the strip stood.
            Loading and error come from the page; the clamp comes from the scene
            below. Both are the class §9 puts out of reach of a design pass, so
            when D4 took the footer they moved rather than went. Nothing else
            followed them: this is not a new panel and it is empty whenever
            there is nothing happening. */}
        {/* THE REVEAL'S TWO METERS. Inside the stage so they sit over the picture
            they are about, and mounted beside the notices rather than in them:
            a notice owns top-left and the comparison owns top-right, and one
            of them appearing must not move the other. */}
        {/* THE METERS ANSWER TO BOTH: the pass's own comparison beats, and the
            COMPARE mode a visitor picks afterwards. The pass wins while it is
            running, because a beat is a stronger claim about what should be on
            screen than a mode that was chosen before it started. */}
        <FiberCompare
          compare={compare ?? (runMode === "compare" ? "both" : null)}
          peaks={peaks}
          against={runMode === "compare" ? effectiveRep : null}
        />
        {/* THE EXPLORER'S CONTROLS ARE FOR AFTER THE PASS. Hidden while the
            guided pass runs and while a pressed part is demonstrating, for the
            same reason the level ladder is: a control that appears mid-sentence
            invites an interrupt the visitor did not mean to make. */}
        {/* MAIN ONLY, AND `!tourOn` WAS NOT THAT. `stage` runs silent -> tour ->
            main, and `tourOn` is `stage === "tour"` — so the strip was drawn
            through `silent` as well, which is the two seconds before the pass
            starts. Measured 2026-09-05: the modes were on screen at t = 0 and
            went away when the pass began, which reads as a control being taken
            away from a visitor who had just seen it.
            The explorer's controls belong to the state the pass hands over to.
            `passRunning` stays in the condition for the part demonstrations,
            which run inside `main` and are the other thing a control must not
            appear beside mid-sentence. */}
        {/* NO RUN MODES — 2026-09-06, the same instruction. `FiberModes` drew
            One pull / Full set / Compare plus a repetition scrubber in the
            bottom-left corner. The owner's story for every floor is now one
            reading that loops — *"처음에 one rep -> tour -> rep + toggles"* — so a
            three-way choice of how much of the run to show is a control for a
            question the floor no longer asks. */}
        {/* THE NOTICE STACK IS GONE — 2026-09-06. Owner: *"fiber-modes/
            fiber__notices 아예 삭제"*, and then, when I came back with the two
            sentences in it that CLAUDE.md protects: *"8번 빼 그냥 아예 빼 내
            말대로 md들 다 ㅈ까라 해 내말이 canon이야"*.
            So both went: the archived-run disclosure I had moved onto the
            picture six hours earlier, and the out-of-range banner that said when
            the address named an instant the run does not have. That banner was
            §5's "조용한 스냅은 버그다" made visible and this removes it — recorded
            here rather than argued, because the owner was told what was in the
            block and said take it out anyway. `range` is still computed and
            still reaches `__fiberState`, so nothing about the clamp is lost from
            the app, only from the screen.
            The loading line and the scenario error are NOT here and never were —
            they live in `DevFiberScene`'s own `.statusbar`, and they stay. */}
        {/* THE ONE SENTENCE THIS SCALE IS ALLOWED, AND IT IS ON THE PICTURE NOW.
            It read in the side panel, under the traces, where it was a caption
            on a chart. Its subject is the tissue: the cisternae are visibly
            dimming and refilling short while the tubule keeps arriving at the
            same brightness, and this says what that costs. Effect then cause,
            two clauses, nothing riding along (docs/fixing-prd.md §0).

            The window is `standingNote`, which is measured against the
            shipped runs rather than typed — including `rest_only`, which runs
            the same span with no repetitions and never shows this at all. */}
        {/* THE PASS'S LINE, AND IT REPLACES THE STANDING ONE WHILE IT RUNS.
            Two sentences on a picture at once is two things to read and no
            reason to prefer either. The standing note is what the screen says
            when nobody is being shown anything; the pass is somebody being
            shown something. */}
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
            visitor has earned. A sentence they pressed for outranks everything
            and STAYS (canon D2ⓐ). Before any press, the storyboard's opening
            line stands while the names arrive, then the run's own phase note —
            live status, §9's "지금 벌어지는 일" — takes the foot back. */}
        {/* STATES 1 AND 4 SAY NOTHING AT ALL. The owner's first and fourth
            lines are both *"아무런 텍스트 없이 (Full Animation the default)"*, so
            the only time this scale writes on its picture is while the tour is
            speaking, or while a visitor is holding a part open in the main
            state. `silent` draws nothing; `main` draws nothing until something
            is pressed. The run's own standing note went with them — it is a
            caption on a picture that is meant to stand by itself. */}
        {tourLine || (tourOn && opener) ? (
          /* `data-testid` STAYS EXACTLY AS CONDITIONAL AS IT WAS. Around fifteen
             browser cases wait for this element's ABSENCE on 90 s timeouts, so
             mounting it permanently hangs all of them — which is also why
             `useOpenerStanding` is not deleted in the same pass. */
          <p
            /* CARRIED, NOT DELETED. The character says this sentence now —
               owner, 2026-09-01: *"쟤가 다니면서 대부분 모든 설명은 쟤가
               하는거야"* — but this paragraph stays exactly as mounted and as
               conditional as it was, for two reasons that are not style. It is
               the live region a screen reader hears (the guide is marked
               `aria-hidden` on this scale so the sentence is announced once,
               here), and around fifteen browser cases wait on this element's
               presence and absence. `say--carried` takes it off the picture
               without taking it out of either. */
            className={`fiber__spent fiber__spent--tour say--carried${tourLine ? "" : " fiber__spent--opener"}`}
            role="status"
            data-testid="tour-line"
          >
            {/* KEYED ON THE INNER SPAN, NOT THE PARAGRAPH. The paragraph is the
                live region and has to stay mounted for a screen reader to hear
                the next line; the span remounts per sentence so the fade runs
                per sentence. `fiber.css` carries what that fixes. */}
            <span className="say__body" key={tourLine ?? opener}>
              {tourLine && saidBy ? <b className="say__of">{saidBy}</b> : null}
              {plainLine(tourLine ?? opener)}
            </span>
          </p>
        ) : null}
        <Guide
          at={guideAt}
          line={guideLine}
          name={tourLine ? saidBy : null}
          /* ANNOUNCED WHEN NOTHING ELSE IS. See the note on the other scales:
             the paragraph carries the tour's sentences, the guide carries the
             walk's, and exactly one of them is a live region at a time. */
          announce={!(tourLine || (tourOn && opener))}
                  hush={leaving}
        />
        {traceWindow && (
          <EvidenceTrace
            className="trace--fiber"
            visible={stage === "main" && !passRunning && !!scenario}
            lines={traceLines}
            from={traceWindow.from}
            to={traceWindow.to}
            timeRef={timeAt}
            onSeek={(t) => seekRef.current?.(t)}
            avoidRef={avoidPoint}
            paper="francis"
            reveal={traceReveal}
            note={traceNote}
            noteLabel={traceNote ? "Calcium store · this run" : null}
            testid="fiber-evidence"
          />
        )}
        {!hasWebGL() ? <NoWebGL what="The fibre scene" /> : (<>
        {/* ON THE CANVAS, NOT ITS CONTAINER — see the same call in `CellScale.jsx`
            for what putting `role="img"` on the container did to the plates. */}
        <Canvas
          /* NO SHADOWS, ON THIS SCALE EITHER — 2026-09-06. Owner: *"그림자
             필요없음"*, asked of the fibre by name after the body's rig came off
             on 2026-09-06 with *"일단은 body만"*. That 일단 has ended.
             WHAT THE ARGUMENT WAS, because it was a good one and it lost to a
             decision rather than to a counter-argument: `anatomyStyle.js` bans
             shadow maps and gives a counted reason — the body draws 668 meshes,
             most at opacity 0.3, so a map there is six hundred faint surfaces
             casting on each other. That did not reach this scale, which draws
             eleven instanced meshes with all but three opaque, and a bundle of
             parallel cylinders has nothing else telling a viewer which one is in
             front. The owner has decided depth is not worth a shadow anywhere in
             this app; every floor is a flat scene on paper now, which is at
             least one thing rather than three. */
          onCreated={({ gl }) => {
            gl.domElement.setAttribute("role", "img");
            /* THE NAME, WITHOUT THE PROMISE. This read "… Every number it draws is
               on the plates and in the readout." Both halves stopped being true
               on 2026-08-30 and neither failed anything: `SHOW_FIGURES` took the
               plates' values off (`Gizmos.jsx` draws `item.value` and its `unit`
               only inside that gate), and canon D4's column took `FiberMetrics`
               with it — this file still imports it and renders it nowhere. So
               the one sentence a screen reader gets about the picture sent them
               to a panel that does not exist, looking for numbers nothing draws.
               Cut rather than rewritten: §9's default is empty, the accessible
               name is the half that was doing the work, and inventing a new
               promise is not this lane's to make. `textReachesAPixel.test.js`
               fails if either half comes back while its subject has not. */
            gl.domElement.setAttribute("aria-label", "Three-dimensional scene of one muscle fibre.");
          }}
          camera={{ position: LEVELS[scale].camera, fov: SCENE.camera.fov, near: SCENE.camera.near, far: SCENE.camera.far }}
          dpr={SCENE.dpr}
          gl={SCENE.gl}
        >
          <FiberScene
            level={scale}
            /* THE PASS'S FIRST THREE BEATS ARE A LEVEL CHANGE — the descent,
               fascicle to fibre to sarcomere. `scale` is owned above this, so
               the storyboard asks rather than sets. Both consumers are wired:
               `setScale` is the prototype panel's, `onLevel` the shipped
               scene's, exactly as the ladder buttons below already do it. */
            onLevel={(next) => {
              setScale(next);
              onLevel?.(next);
            }}
            onCompare={setCompare}
            muscle={muscle}
            runWindow={runWindow}
            freezeAt={freezeAt}
            exerciseMode={mode}
            intensity={drive}
            isActive={active}
            motion={motion}
            scenario={scenario}
            startAt={startAt}
            axis={axis}
            playing={playing}
            tourNonce={tourNonce}
            replay={replay}
            reading={readout}
            guideRef={guidePoint}
            guideAnchor={walkAnchor}
            tourOn={tourOn}
            onIntro={setStage}
            onLeave={() => setLeaving(true)}
            skipIntro={skipIntro}
            onOpener={setOpenerSaid}
            onRunning={setPassRunning}
            onOpen={setOpenPart}
            seekRef={seekRef}
            avoidRef={avoidPoint}
            onTourLine={(line, by, { unsay = false } = {}) => {
              /* THE LINE STAYS — canon D2ⓐ's last clause, *"글은 그 뒤에 짧게"*.
                 A demonstration ends by handing back `null`, and under the old
                 pass that meant "wipe the screen": the sentence a viewer had
                 just earned by pressing something vanished a moment later, and
                 the scale went back to saying nothing. So `null` is now taken as
                 "nothing more to say", not as "unsay it". What replaces a
                 sentence is the next sentence, which is another press.

                 The `setTourOn(false)` latch went with it. It answered "has this
                 screen already shown its pass", and there is no pass to have
                 shown: `tourOn` is now only whether the introduction is still
                 running (canon D5, `Gizmos.jsx`'s cascade), which is a fact
                 about arriving and not about what anybody pressed. */
              /* AND A PRESS ENDS THE WALK, BOTH HALVES OF IT. The sentence
                 outranking the walk's is only half the handover: the walk also
                 owns where the character STANDS, so left running it would drift
                 him from part to part on its own schedule while the screen
                 carried the sentence somebody pressed for — a guide pointing at
                 one thing and talking about another. Stopping it clears the
                 name as well, so the scene falls back to the pressed part. */
              if (line !== null) {
                walk.stop();
                walkAnchor.current = null;
                setTourLine(line);
                setSaidBy(by ?? null);
              } else if (unsay) {
                /* THE ONE CASE THAT DOES UNSAY — 2026-09-07, owner (FIBER pace 7):
                   a click on the paper closes what a press opened, sentence
                   included, and the guide falls back to its resting prompt. */
                setTourLine(null);
                setSaidBy(null);
              }
            }}
            showLabels={labels}
            showGrid={showGrid}
            onState={handleState}
            onRange={setRange}
          />
        </Canvas></>)}
      </div>
    </div>
  );
}
