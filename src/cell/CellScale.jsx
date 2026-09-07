/**
 * The ENERGY floor — "Cellular Energy" — page and scene. Default export
 * `CellScale({ state })`; the file name is a cross-floor contract
 * (`seamBuildsTheDestination.test.js` reads it), the visitor only ever sees
 * ENERGY.
 *
 * ONE FRAME LOOP, ONE ROAD TO THE PIXELS. `energyBinding.frameAt` turns the
 * archived runs into drawing quantities and `cellChainGeometry.update` turns
 * those into matrices; this file is the only place the two meet, and it meets
 * them once per frame. This project's recurring defect is a quantity that is
 * computed, carried and reaches no pixel — so there is no second path.
 *
 * THE CLOCK IS THE FIBER'S CLOCK. Same Francis run, same 13 s, same ten
 * repetitions of 0.65 s, and the handoff carries the instant the visitor left
 * upstairs at, so rep 7 on the fibre is rep 7 here — "same event, different
 * scale" (`docs/20260905-fix/cell.md` §12). The loop is `runLoop.js`'s: hold,
 * cut, hold, so the jump at the seam can only read as the recording restarting.
 *
 * FOUR RUNS, LOADED ONCE. Normal and "Calcium path off" are two archived runs on
 * one clock and the knockout IS the calcium-off bout, so a condition switch
 * swaps a reference rather than fetching — the old page blanked nothing on a
 * switch and neither does this. Calcium itself comes from the fibre's own
 * `soce_on` archive: the input that drove the coupled bout, not a stand-in.
 *
 * 2026-09-06 — LIVING METABOLIC CHAMBER (`docs/20260906-fix/energy.md`). Four
 * things changed here. The rep strip is gone, and with it the only scrubber —
 * owner item 14, *"ATP에서 timeline같은거 그냥 쳐 빼 … one rep돌고 guided tour
 * 끝나면 계속 같은 rep도는거야"* — so the default picture is one repetition
 * going round: the one the handoff named, fixed at arrival, and every pass
 * hands the clock back to its first instant when it lets go (global rule 4).
 * The halo rings and the one standing label went (owner items 13 and 12,
 * brief §8): what singles a part out now is the geometry's own spotlight, fed
 * once per frame from card, hover or the beat's subject. And both passes are
 * handed `paused: !playing`, so Pause stops the tour with the scene (global
 * rule 2) the moment `tour.js` reads the option.
 */

import { SHOW_SOURCES } from "../uiMode.js";
import { hasWebGL, NoWebGL } from "../webgl.jsx";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
const _close = new THREE.Vector3();
const _wideV = new THREE.Vector3();
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { LIGHTS, CONTROLS, SCENE } from "../anatomyStyle.js";
import AnatomyEnvironment from "../anatomyEnvironment.jsx";
import { useCameraTransition } from "../fiber/useCameraTransition.js";
/* NOT `FocusRing`, and no ring of this floor's own either. The fibre's orange
   press-ring is that floor's vocabulary; the pale halo this page drew instead
   went on 2026-09-06 (owner item 13, *"black rings도 개 ㅈ같아 (everywhere)"*).
   Selection is `model.spotlight`, handed an id in the frame loop. */
import { createRunClock, stepRunClock } from "../runLoop.js";
import { SILENT_MS, useTour, plainLine } from "../tour.js";
import { holdTour } from "../tourControl.js";
import { useCoverOpen } from "../crossing.js";

/**
 * HOW LONG THE PLAIN LAP RUNS BEFORE THE PASS SPEAKS — the owner's arrival
 * grammar, 2026-09-06: *"1. 한번 쭉 보여주고 (main) 이 때는 toggle이고 뭐고 없어 그냥
 * left header + right pause skip / 2. 그다음 guided tour / 3. now main again with
 * all the toggles"*.
 *
 * WHAT THE LAP IS, on this floor, took a second exchange to settle. Not the grid
 * — *"모든거 한바귀가 아니야"* — and not the one repetition main state loops: the
 * owner took "ATP→AMPK 기본 루프 한 번 (12.96초짜리 protocol 한 바퀴)" and then
 * said *"기본적으로 한 5초 정도로 맞추고 싶은데"*. So it is the ten repetitions of
 * the protocol, t0 to t0 + REPS·REP_SECONDS, run once at the rate that fits them
 * into five seconds, and NOT the rest phase after them.
 *
 * ITS OWN RATE, AS ON SIGNALS. The pass seeks where it likes and main state plays
 * the loop rep at 1x; neither is touched, because the beats were composed
 * against the run at 1x and the ENERGY lane's tokens and packets with them.
 *
 * WHAT STOOD HERE HELD THE CLOCK AT SPEED 0 FOR 1.6 s (audit r2) so the pass
 * would not snap back to t0 from the middle of rep 1. A whole lap does not have
 * that problem: it ends where the protocol ends, and the pass's first seek is a
 * cut from there, the same cut SIGNALS makes.
 */
const INTRO_S = 3; /* 5 until 2026-09-07 — owner: "너무 초반 motion이 길어" */
import AppShell from "../shell/AppShell.jsx";
import Ways from "../shell/Ways.jsx";
import WayIn from "../wayin/WayIn.jsx";
import { beginDescent } from "../crossing.js";
import { hashForScale, parseHash, SCALE_LABEL, currentRoute, go } from "../scaleRoute.js";
import { SIGNALLING_CAMERA } from "../signalling/signallingGeometry.js";
import { buildHeroLevel } from "../signalling/heroGeometry.js";
import { HERO_IDS } from "../signalling/heroNetwork.js";
import { heroPair, heroProgress, routesOf } from "../signalling/signallingBinding.js";
import { loadScenario } from "../scenarioData.js";
import Guide from "../guide/Guide.jsx";
import { useAim } from "../guide/useAim.js";
import { frameAt, responseSpan, repAt, instantsOf, PARTS, CONDITIONS } from "./energyBinding.js";
import { REPS, REP_SECONDS, RUNS } from "./cellBinding.js";
import EvidenceTrace from "../trace/EvidenceTrace.jsx";
import { pct } from "../trace/trace.js";
import { PALETTE } from "../anatomyStyle.js";
import { CHAIN_RUNS, armStrength } from "./cellChain.js";
import { buildCellChainLevel, ENERGY_CAMERA, WAY_IN_AT } from "./cellChainGeometry.js";
import { energyTour, energyResult } from "./cellTour.js";
import "../fiber/fiber.css";
import "./cell.css";

/** The instant the way-in's coin shows SIGNALS at: 20 min into the Fowler
    44-min run, where both arms are moving. */
const COIN_T_S = 1200;
/** Where the pull-back ends: far enough out that AMPK is one small thing in a
    wide dark room — the shot the signalling floor opens from. */

/** The pull-back's length. ~1.2 s: long enough to read as travel, short enough
    not to be a film between two floors. */
/* The wide dark room — the shot the signalling floor opens from. */
const NETWORK_CAMERA = [0.3, -0.45, 7.5];
const PULL_MS = 1200;
/** How much of the pull is spent going IN to AMPK before coming out. */
const PULL_IN = 0.3;

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const ease = (k) => 1 - (1 - k) * (1 - k);

/** `PARTS` by id, for the hover card. */
const PART = Object.fromEntries(PARTS.map((p) => [p.id, p]));

function EnergyScene({
  guideRef,
  /** WHERE THE RESTING GUIDE MUST NOT STAND, projected like `guideRef`.
      Owner, 2026-09-06: *"In the resting/main state, the right-bottom guide
      house + bubble still sit on top of the CaMKK2 region … this is still the
      main visible problem in ENERGY"*. At rest there is no beat and so no
      anchor, and the guide walks to its home corner — which on this floor is
      where CaMKK2 sits. The corner cannot know that; only this loop does. */
  clearRef,
  bout,
  ca,
  normal,
  span,
  calciumShare,
  coupled,
  replayNonce,
  startAt,
  playing,
  pulling,
  onPulled,
  /** THE LENS'S PRESS, HANDED UP. The page owns `pulling` and the descent
      record, and the lens lives down here inside the canvas, so the press has to
      travel one way and the rectangle the other. Was the CTA's own onClick until
      the CTA was deleted (2026-09-06). */
  onGoDown,
  /** What this floor sends down, read at press time — the page owns it. */
  carry,
  onRead,
  onStage,
  /** Bumped when the page's Skip is pressed during the plain lap. */
  skipIntro = 0,
  onNarrating,
  onTourLine,
  /** THE EVIDENCE TRACE'S TWO HANDLES (`src/trace/`, 2026-09-07). `seekRef`
      is filled with a seek that also moves the loop rep to the instant asked
      for — a pointer along the trace picks WHICH repetition the room goes
      round, since the main state loops one — and `onCard` reports the part a
      press singled out, so the trace can show that object's own series and
      nothing else (md: "누른 object에 대한 evidence만"). */
  seekRef = null,
  onCard = null,
  /** AMPK's place on the canvas, `{x, y, r}`, per frame — what the trace keeps
      off when the camera brings the sensor onto it. Same 72 px as CaMKK2's. */
  avoidRef = null,
}) {
  const { camera, controls, size } = useThree();

  /* THE SEAM DOWNWARD, AND IT IS THE ONE THAT COSTS A FETCH. The other two
     level builders take no arguments; `buildHeroLevel` takes the routes,
     which come from the three Fowler scenarios. So the entrance appears when
     they land rather than pretending it can draw the next scale before it
     knows what is in it — the alternative would be a stand-in shape, which is
     exactly the decorative lie §5 refuses. Under a second on this machine, and
     the door is hidden until the tour ends anyway. */
  const [seam, setSeam] = useState(null);
  /* FETCHED WHEN SOMEONE REACHES FOR THE DOOR, NOT ON ARRIVAL — 2026-09-06. The
     owner chose this (*"2번으로 하고"*: *"안 누르는 방문자는 값을 안 낸다"*), the
     coin's BUILD was deferred to the first hover, and the record said the
     visitor paid nothing. The network said 228 KB: this `Promise.all` still ran
     on mount, because `WayIn` could not exist before `seam` did. `WayIn` stands
     on `visible` now and asks through `onWant`; the disc opens when this lands. */
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (!wanted) return undefined;
    let live = true;
    Promise.all([
      loadScenario("fowler_resistance"),
      loadScenario("fowler_endurance"),
      loadScenario("fowler_rest"),
    ])
      .then(([resistance, endurance, control2]) => {
        if (!live) return;
        const routes = routesOf({ resistance, endurance, control: control2 });
        /* THE DESTINATION'S OWN BUILDER — `previewLevel.js` promises the coin
           shows what you actually arrive at, and rule 1 there is that the group
           comes from the destination's own builder "called by the name the
           destination calls it by". `seamBuildsTheDestination.test.js` reads
           this literal. */
        setSeam({
          to: "signalling",
          build: () =>
            buildHeroLevel(
              routes,
              resistance?.network?.edges ?? null,
              Object.keys(routes?.names ?? {}).filter((id) => !HERO_IDS.includes(id)),
            ),
          camera: SIGNALLING_CAMERA,
          /* The spot where the routes meet — owner, 11 — from SIGNALS's own angle. */
          /* THE WHOLE NETWORK, A LITTLE CLOSER — 2026-09-07, owner (pace 2, C4): *"coin은 그냥 전체를 보여주자 … 조금 zoom"*. (JNK alone, then the meeting region, were tried.) */
          margin: 0.72, /* 0.40 and 0.52 cropped the receptors and the membrane — whole, a little closer than 0.8 */
          /* THE SIGNALLING SCALE'S OWN LAMPS — it declares 0.5 / 3.4 / 1.2
             inline, and a preview at this app's defaults showed the right room
             under the wrong light. */
          lights: { ambient: 0.5, key: 3.4, fill: 1.2 },
          /* THE COIN SHOWS THE NETWORK WORKING, NOT ASLEEP. It used to be dressed
             with the resistance arm at t = 0 — every node at rest, no packets —
             which is the grey the owner saw in the magnifier (*"돋보기에서
             Signals는 ㅈㄴ 회색이야"*, 2026-09-06; SIGNALS lane's diagnosis via
             the orchestrator). Both arms twenty minutes into the 44-minute run,
             through the destination's own `heroPair` and `heroProgress`.
             IT WAS A NAMESPACE ACCESS WITH A `?.` UNTIL THE MERGE, so that this
             floor built on either side of it — and an optional call that silently
             returns `undefined` is exactly the shape this repo refuses: the coin
             would have gone back to drawing a network with no progress in it and
             nothing would have said so. Both lanes are merged, so it is a named
             import now and a build fails if the helper ever leaves. Nothing
             typed: the numbers are the Fowler archive's at 1200 s. */
          dress: (built) =>
            built.update?.({
              ...heroPair({ resistance, endurance }, HERO_IDS, COIN_T_S),
              progress: heroProgress({ resistance, endurance }, HERO_IDS, COIN_T_S),
              show: "both",
            }),
        });
      })
      .catch(() => {
        /* No entrance rather than a broken one. The address still reaches the
           scale, and §9 keeps the scale's own loading and error copy. */
        if (live) setSeam(null);
      });
    return () => {
      live = false;
    };
  }, [wanted]);

  const model = useMemo(() => buildCellChainLevel(), []);
  useEffect(() => () => model.dispose(), [model]);
  /* WHERE THE DOOR STANDS: `WAY_IN_AT`, one value for every frame. The
     portrait branch that used to live here was derived against the activity
     ring (2026-09-05) and the ring is gone; the wide camera now backs off on a
     portrait stage instead (`wideCamera` below), so the same world point is
     inside the frame at 390 wide — measured, r6. */
  const wayInAt = WAY_IN_AT;
  /* The level itself, for still-frame review — a screenshot script can hide
     one named mesh at a time to find which of them draws a defect. Read-only
     in the sense that matters: nothing in the app reads it back. */
  useEffect(() => {
    window.__energyModel = model;
    return () => {
      delete window.__energyModel;
    };
  }, [model]);
  const anchorAt = useCallback(
    (id) => (id ? model.anchors?.find((a) => a.id === id)?.at ?? null : null),
    [model],
  );

  /* THE ARRIVAL INSTANT STARTS THE CLOCK, clamped into the grid. Clamped here
     and announced by the page's notice — a raw seed that the loop walked back
     into range over seven frames was a snap, and a quiet snap is a bug (§5). */
  const { t0, tEnd } = bout.grid;
  const seed = Math.min(Math.max(startAt ?? t0, t0), tEnd);
  const clock = useRef(createRunClock(seed));
  /* The previous frame's result, so conversions between frames become flights
     (`frameAt`'s `prev`). Null after any seek — a seek is not an event. */
  const prev = useRef(null);
  /* THE LOOP REP IS THE ONE YOU ARRIVED IN, AND IT STAYS THAT ONE. Owner item
     14 (2026-09-06): *"one rep돌고 guided tour끝나면 계속 같은 rep도는거야"* —
     the default picture is one repetition going round, and it is the rep the
     handoff named, not whichever one the clock is in when a beat lets go. So
     it is read off the arrival instant, never off the clock, and only a new
     arrival (the re-seed below) moves it. Replay, a condition switch and the
     end of a pass all return to its first instant. */
  const loopRep = useRef(repAt(seed, t0));
  const seek = useCallback(
    (t) => {
      const at = Math.min(Math.max(t, t0), tEnd);
      // The lap survives: "replay 3" counts the seams this viewer has watched go
      // past, and seeking back does not un-watch them.
      clock.current = { ...createRunClock(at), lap: clock.current.lap };
      prev.current = null;
      /* A seek is a new picture: beads mid-flight, calcium mid-crossing and
         packets on the route belong to the instant that was left. Held beats
         (speed 0) never age them, so they froze there (audit r2). */
      model.reset?.();
    },
    [t0, tEnd],
  );
  /* And a seek, for the same still-frame review: the strip that used to be the
     scrubber is gone (owner item 14), and a shot of "the front arriving" or
     "calcium landing" needs an instant, not a wait. Read-only in the sense that
     matters: nothing in the app calls it. */
  useEffect(() => {
    window.__energySeek = (t) => seek(t);
    return () => {
      delete window.__energySeek;
    };
  }, [seek]);
  /* Where a part is on the canvas, in canvas pixels — for `tests/one-off/`,
     which has to press ATP the way a hand does and cannot see the scene. Read-
     only, like `__energyState`; nothing in the app calls it. */
  useEffect(() => {
    window.__energyProject = (id) => {
      const at = anchorAt(id);
      if (!at) return null;
      const v = new THREE.Vector3(...at).project(camera);
      return v.z > 1 ? null : { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    };
    return () => {
      delete window.__energyProject;
    };
  }, [anchorAt, camera, size.width, size.height]);
  /* "The start" is the loop rep's first instant — the only start this floor
     has since the View toggle went (owner, 2026-09-06 night: 삭제; a switch
     offering a second reading of the run was the timeline back under another
     name). A pass that needs the whole set seeks there itself. */
  useEffect(() => {
    if (replayNonce) seek(loopRep.current.from);
  }, [replayNonce, seek]);
  /* Re-seeded when the arrival instant changes — the scene does not remount on
     a hash edit, so seeding on mount alone moved nothing. A new arrival is a
     new loop rep, for the same reason. */
  useEffect(() => {
    loopRep.current = repAt(seed, t0);
    seek(seed);
  }, [seed, seek, t0]);

  const [hover, setHover] = useState(null);
  const [card, setCard] = useState(null);
  useEffect(() => {
    onCard?.(card);
  }, [card, onCard]);
  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (t) => {
      loopRep.current = repAt(t, t0);
      seek(t);
    };
  }, [seekRef, seek, t0]);

  /* THE TEST. A condition change swaps the bout and starts the loop rep
     again; turning the calcium path OFF also plays the result beats. Keyed on
     `coupled` rather than on the button, because the bout arrives with it. */
  const coupled0 = useRef(coupled);
  const [resultNonce, setResultNonce] = useState(0);
  const resultOnce = useRef(false);
  useEffect(() => {
    if (coupled0.current === coupled) return;
    coupled0.current = coupled;
    seek(loopRep.current.from);
    /* A card left open from before the test sat on the picture through the
       whole result (r2/31-result-0) — the visitor asked a different question. */
    setCard(null);
    /* ONCE — 2026-09-07, owner: *"skip되서 end 몇 calcium off 해도 guided tour 재시작하지마"*.
       The comparison is explained the first time the path is turned off; every later
       toggle just switches the condition, silently. */
    if (!coupled && !resultOnce.current) {
      resultOnce.current = true;
      setResultNonce((n) => n + 1);
    }
  }, [coupled, seek]);

  const instants = useMemo(() => instantsOf(bout, ca), [bout, ca]);
  const beats = useMemo(
    () => energyTour(bout, model.anchors, instants, { span, arrival: startAt ?? null }),
    [bout, model, instants, span, startAt],
  );
  const resultBeats = useMemo(
    () => energyResult(bout, model.anchors, instants, { calciumShare }),
    [bout, model, instants, calciumShare],
  );

  /* silent → tour → main, exactly as the fibre. `beats` is the precondition
     for state 2: a scale with nothing to say arrives and hands itself over. */
  const [stage, setStage] = useState("silent");
  /* AND NOT UNDER THE COVER — 2026-09-07. Measured (crossings.mjs): this page
     mounts ~0.67 s after the press and the ring opens at ~1.375 s, so a lap that
     started on mount spent its first 0.7 s unseen. The clock is held at 0 until
     the cover is off, the lap is seeked to t0 at that moment, and INTRO_S is
     counted from it. A cold arrival has no cover and starts at once. */
  const coverOpen = useCoverOpen();
  /* Arriving from a ride: hold close under the cover (see the frame loop). */
  const arrivedByRide = useRef(typeof document !== "undefined" && document.documentElement.dataset.crossing !== undefined);
  useEffect(() => {
    if (stage !== "silent" || !coverOpen) return undefined;
    /* THE LAP STARTS AT THE START. The re-seed above put the clock at the
       arrival instant — rep 7 upstairs, rep 7 here — which is right for the loop
       rep and wrong for "한번 쭉": a lap that begins in rep 7 is not a lap.
       Declared after the re-seed on purpose; effects run in order and this one
       has to write last. Only when there is a pass to precede — a floor with
       nothing to say keeps its 1.6 s and its arrival instant. */
    if (beats.length) seek(t0);
    const start = setTimeout(
      () => setStage(beats.length ? "tour" : "main"),
      beats.length ? INTRO_S * 1000 : SILENT_MS,
    );
    return () => clearTimeout(start);
  }, [beats, stage, seek, t0, coverOpen]);
  /* SKIP DURING THE PLAIN LAP LANDS IN MAIN — owner: *"tour건너 뛰고 그 단계의
     마지막 main으로 가는거야"*. The page holds the button (see its note); the
     press arrives as a count. And the clock goes to the loop rep's first
     instant, exactly as it does when a pass lets go — the falling-edge seek
     below cannot see this, because no pass ran. */
  useEffect(() => {
    if (!skipIntro) return;
    setStage("main");
    seek(loopRep.current.from);
  }, [skipIntro, seek]);

  const [focus, setFocus] = useState(null);
  /* `paused` — global rule 2 (2026-09-06): Pause stops the pass WITH the scene
     and Resume picks up the same beat. The scene's half is `step` in the frame
     loop; the pass's half is this option, which `tour.js` reads once the
     orchestrator lands it there (until then it is ignored, and the scene still
     stops). Both passes, so the result cannot keep talking over a paused cell. */
  const tour = useTour(stage === "tour" ? beats : [], {
    enabled: stage === "tour",
    skippable: true,
    paused: !playing,
    onSeek: seek,
    onLine: onTourLine,
    onFocus: setFocus,
  });
  /* THE SECOND TOUR, for after the visitor's test. Its own nonce: a press is
     one of `INTERRUPTS`, so the button that turned the path off has already
     stopped whatever was running, and only a changed nonce re-arms. */
  const result = useTour(resultBeats, {
    enabled: resultNonce > 0,
    skippable: false,
    nonce: resultNonce,
    paused: !playing,
    onSeek: seek,
    onLine: onTourLine,
    onFocus: setFocus,
  });
  useEffect(() => {
    if (stage === "tour" && !tour.running) setStage("main");
  }, [stage, tour.running]);
  /* THE OPENER'S ONE MOVING THING (owner, pass 6): beat 0 holds the first
     instant under its line; the geometry lets one echo of the last pull
     upstairs fade across the room on the viewer's clock. Once, on entry. */
  useEffect(() => {
    if (stage === "tour" && tour.index === 0) model.echo?.();
  }, [stage, tour.index, model]);
  /* WHEN A PASS LETS GO, THE CLOCK GOES BACK TO THE OPENING FRAME — global
     rule 4 (2026-09-06): *"끝나면 같은 앵글로 돌아온다"*. The camera's half is
     `useCameraTransition` below falling back to `ENERGY_CAMERA`; this is the
     clock's. Falling edge only: `running` is false before the first beat too,
     and that is not an ending. */
  const spoke = useRef(false);
  useEffect(() => {
    const now = tour.running || result.running;
    if (spoke.current && !now) seek(loopRep.current.from);
    spoke.current = now;
  }, [tour.running, result.running, seek]);
  /* Both passes, by name. `useTour` registers `window.__tourBeats` per hook and
     the second mount overwrites the first, so a still-frame review of the
     arrival pass needs its own list. Read-only. */
  useEffect(() => {
    const strip = (b) => ({ ms: b.ms, line: b.line ?? null, focus: b.focus ?? null });
    window.__energyBeats = () => ({ tour: beats.map(strip), result: resultBeats.map(strip) });
    return () => {
      delete window.__energyBeats;
    };
  }, [beats, resultBeats]);
  useEffect(() => {
    onStage?.(stage);
  }, [stage, onStage]);
  useEffect(() => {
    onNarrating?.(result.running);
  }, [result.running, onNarrating]);

  /* THE PASS BORROWS THE CAMERA AND ALWAYS GIVES IT BACK. Whichever tour is
     speaking owns the shot; otherwise `ENERGY_CAMERA`, the wide arrival. The
     nonce re-arms across beats of either tour. Disabled while the pull-back
     drives the camera by hand below. */
  const speaking = tour.running ? tour : result.running ? result : null;
  /* THE WIDE FRAMING BACKS OFF ON A PORTRAIT STAGE. fov 38 is vertical, so at
     390 × 740 the camera that holds the room on a landscape screen sees only
     x ±0.85 of it — the ATP pool cut at the left edge and CaMKK2 off-screen
     right (r5, 60-phone-arrival). The same direction, further out: at 0.53
     aspect this is ×1.68, 7.9 units, x ±1.43 — both pools and the sensor in
     frame, the membrane's far sides cropped, which is context. Landscape is
     untouched (the factor is 1 at any aspect over 1.05). The pass's own shots
     are the geometry's and are left alone. */
  const portraitK = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    return Math.max(1, (1.05 / aspect) ** 0.75);
  }, [size.width, size.height]);
  const wideCamera = useMemo(() => ENERGY_CAMERA.map((v) => v * portraitK), [portraitK]);
  /* AND THE PASS'S OWN SHOTS BACK OFF BY THE SAME FACTOR — along their own
     line, about their own lookAt, so a pair shot on a phone still holds both of
     its subjects (pass 1 left the beats at landscape distances; the wide frame
     was the only one measured at 390). Direction unchanged, so the containment
     the tour test holds still holds here. */
  /* A STEEPER FACTOR FOR THE BEATS THAN FOR THE WIDE FRAME: a pair shot is
     framed on two things a unit apart, and ×1.68 at 0.53 aspect still cut the
     trimer at the right edge of the AMP + AMPK beat (p2r1, 61-phone-beat5);
     (1.05/aspect)¹ = ×2.0 there holds both. The wide frame keeps its gentler
     0.75, because the room is context and cropping its sides is fine. */
  const beatK = useMemo(() => Math.max(1, 1.05 / (size.width / Math.max(1, size.height))), [size.width, size.height]);
  /* THE PASS'S WIDE BEATS TAKE THE WIDE FRAME'S FACTOR, NOT THE BEATS': they
     are `ENERGY_CAMERA` (4.7 back), and main returns to `wideCamera` — scaling
     them by beatK put the end of the pass 1.1 units further out than the frame
     main resumes at, a dolly at every handover on a phone (review, 2026-09-06;
     and 4.7 × 2.0 = 9.4 is past OrbitControls' maxDistance 9, where the ease
     never settles). Side shots are 2.8 back and the wide is 4.7: 4 separates them. */
  const beatCamera = useMemo(() => {
    const c = speaking?.camera;
    const l = speaking?.lookAt ?? [0, 0, 0];
    if (!c) return null;
    const back = Math.hypot(...c.map((v, i) => v - l[i]));
    const k = back > 4 ? portraitK : beatK;
    return c.map((v, i) => l[i] + (v - l[i]) * k);
  }, [speaking?.camera, speaking?.lookAt, beatK, portraitK]);
  useCameraTransition(
    beatCamera ?? wideCamera,
    speaking?.lookAt ?? [0, 0, 0],
    !pulling,
    `${tour.index}/${result.index}`,
  );

  /* HOVER AND CLICK, on the invisible hit meshes. The geometry's spotlight
     singles the part out (fed per frame below) and a pill names it; a click
     opens the one-line card. No rings (owner item 13) and no plates — the
     molecules are populations and flows, and eight standing handles are what
     made the old picture look like the signalling floor. */
  const shown = card ?? hover;
  const shownAt = anchorAt(shown);

  /* THE PULL-BACK. In to AMPK, then out past the whole room while the pools
     fade (`dim` → `frameAt`) and AMPK stays: the next floor is not smaller, it
     is the same cell seen wider, so the camera goes BACK, not in. Driven here
     by hand rather than through `useCameraTransition`, which eases to one
     goal; this has two, in order, on a clock. */
  const pull = useRef(null);
  const dim = useRef(0);
  useEffect(() => {
    if (!pulling) {
      pull.current = null;
      dim.current = 0;
      return;
    }
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    pull.current = { at: performance.now(), from: camera.position.clone(), done: false, reduced };
  }, [pulling, camera]);

  useFrame((frameState, delta) => {
    /* Held close under the cover, as FIBER is — owner, 25: the crossings should
       share one grammar. FIBER pulls back from the sarcomere (`Descent.jsx`),
       this floor opens 55 % of the way in on the myofibril bars and eases out to
       its wide framing as the ring opens. */
    if (arrivedByRide.current && !coverOpen && stage === "silent") {
      _close.set(0, 0, 0).lerp(_wideV.set(...wideCamera), 0.55);
      frameState.camera.position.copy(_close);
    }
    const c = clock.current;
    const step = playing ? Math.min(delta, 0.05) : 0;
    /* THE BEAT'S OWN SPEED, READ THIS FRAME, NOT A RENDER LATER — `tour.beat`
       is synchronous, and a speed that lands through state runs one frame at
       the previous beat's rate (the fibre measured the damage). Main state
       plays the body clock at 1x. */
    /* HELD WHILE SILENT: the first thing a visitor sees is the instant they
       arrived at, standing still, not rep 1 running for 1.6 s and then a snap
       back to t0 when the pass begins (audit r2). */
    /* NO LONGER HELD WHILE SILENT — see `INTRO_S`. The plain lap runs the
       protocol once at the rate that fits it into INTRO_S; a ratio, so a longer
       archive cannot quietly lengthen the number that names it. */
    const speed =
      stage === "silent" ? (coverOpen ? (REPS * REP_SECONDS) / INTRO_S : 0) : speaking?.beat?.speed ?? 1;
    /* THE BOUNDS, READ THIS FRAME. A pass may seek anywhere on the grid, so
       while one speaks the whole grid is open; otherwise the clock goes round
       the loop rep — the floor's one resting state. */
    /* THE GRID WHILE SILENT, TOO: the arrival instant may be in the rest phase
       (a visitor who left the fibre after the set), and the loop rep's bounds
       would clamp it to rep 10's end and cut before the pass had begun. Silent
       is held at speed 0 anyway; the loop starts when the pass hands back. */
    /* THE PROTOCOL WHILE SILENT — the ten repetitions and not the rest phase
       after them (*"모든거 한바귀가 아니야"*). The pass still gets the whole grid. */
    const { from, to } = speaking
      ? { from: t0, to: tEnd }
      : stage === "silent"
        ? { from: t0, to: t0 + REPS * REP_SECONDS }
        : loopRep.current;
    // Last argument is the VIEWER's seconds: the seam holds are spent in wall
    // time, so slowing a beat does not stretch the stillness.
    const lapBefore = c.lap;
    stepRunClock(c, step * speed, from, to, step);
    /* THE CUT IS A NEW PICTURE, LIKE A SEEK. `runLoop.js` holds, cuts to the
       first instant and holds again; but beads mid-flight, calcium mid-crossing
       and packets on the route belong to the instant that was left, and on the
       one-rep loop (every 2.45 s now, not every 13) the first frame after the
       cut drew the sensor still open and lit while the pool had already snapped
       back (r5, 40-loop-e). So the cut frame resets what a seek resets. */
    if (c.lap !== lapBefore) {
      prev.current = null;
      model.reset?.();
    }

    if (pull.current && !pull.current.done) {
      const p = pull.current;
      const k = p.reduced ? 1 : Math.min(1, (performance.now() - p.at) / PULL_MS);
      const ampk = anchorAt("ampk") ?? [0.3, -0.45, 0];
      _a.set(ampk[0], ampk[1], ampk[2] + 1.6);
      _b.set(...NETWORK_CAMERA);
      if (k < PULL_IN) camera.position.lerpVectors(p.from, _a, ease(k / PULL_IN));
      else camera.position.lerpVectors(_a, _b, ease((k - PULL_IN) / (1 - PULL_IN)));
      _v.set(...ampk);
      if (controls) {
        controls.target.copy(_v);
        controls.update();
      } else camera.lookAt(_v);
      dim.current = k;
      if (k >= 1) {
        p.done = true;
        onPulled?.();
      }
    }

    /* The fog follows the lens: the far wall is ~3 units behind the pools. */
    const fog = frameState.scene.fog;
    if (fog) {
      /* near = the camera's own distance from the origin, not 0.3 short of
         it: measured in view space, −0.3 put 6–14 % of fog on AMPK in its own
         close shot (review); at d the heroes are ≤ 3 % in the wide frame and
         0 in their close-ups, the back wall still a third gone. */
      const d = camera.position.length();
      fog.near = d;
      fog.far = d + 2.6;
    }

    const frame = frameAt({
      bout,
      ca,
      normal,
      span,
      coupled,
      t: c.t,
      prev: prev.current,
      dt: step * speed,
      dim: dim.current,
    });
    /* `wallDt` is the VIEWER's seconds — idle drift, breathing and dust run on
       it, so a held beat (speed 0) is alive and Pause (step 0) is still.
       `frame.dt` stays the run's seconds that flights and the hinge age on. */
    model.update({ ...frame, wallDt: step });
    prev.current = frame;
    /* THE SELECTION IS THE GEOMETRY'S OWN — owner item 12 (2026-09-06): the
       named part keeps its material and the rest recede into the paper. Card
       over hover over the beat's subject; null brings everything back. */
    model.spotlight?.(card ?? hover ?? focus?.id ?? null);

    /* WHERE THE GUIDE STANDS, in canvas pixels, written per frame and read at
       10 Hz by `useAim`. Beside the beat's subject; beside the picture's middle
       when a beat names nothing. Behind the camera is mirrored, not off-screen. */
    const { size } = frameState;
    const at = focus?.at ?? anchorAt(focus?.id);
    if (!at) {
      guideRef.current = { x: size.width / 2, y: size.height * 0.46, r: size.width * 0.2 };
    } else {
      _v.set(...at).project(camera);
      guideRef.current =
        _v.z > 1
          ? null
          : /* 72, NOT THE OLD 40: a pool or a two-lobed sensor is ~100 px across at
               these shots and the character stood on CaMKK2 in the test beat
               (measured 2026-09-05, r1/10-beat-7). */
            { x: ((_v.x + 1) / 2) * size.width, y: ((1 - _v.y) / 2) * size.height, r: 72 };
    }

    /* AND WHAT IT MUST NOT SIT ON, which matters only when there is no beat.
       CaMKK2 is the one the owner named and it is the one in the corner: the
       room puts it at [1.02, -0.6, -0.2], low and to the right, which is where
       the guide waits. The same 72 px the anchor uses — it is the same object,
       measured the same way, and a second number here would drift from that
       one silently. */
    if (avoidRef) {
      const ampkAt = anchorAt("ampk");
      if (!ampkAt) {
        avoidRef.current = null;
      } else {
        _v.set(...ampkAt).project(camera);
        avoidRef.current =
          _v.z > 1 ? null : { x: ((_v.x + 1) / 2) * size.width, y: ((1 - _v.y) / 2) * size.height, r: 72 };
      }
    }
    const restAt = anchorAt("camkk2");
    if (!restAt) {
      clearRef.current = null;
    } else {
      _v.set(...restAt).project(camera);
      clearRef.current =
        _v.z > 1
          ? null
          : { x: ((_v.x + 1) / 2) * size.width, y: ((1 - _v.y) / 2) * size.height, r: 72 };
    }

    onRead({
      t: c.t,
      /* `rep` IS THE 0-BASED INDEX (it indexes `instantsOf().onsets`); the
         handoff says 1-based. A tester reading `.rep` beside the old strip lit
         "7" saw 6 (FIBER lane, 2026-09-05), so the displayed number travels
         too, under its own name. */
      rep: repAt(c.t, t0).rep,
      repDisplayed: repAt(c.t, t0).rep + 1,
      condition: coupled ? "normal" : "calciumOff",
      ampk: { fraction: frame.ampkLevel, response: frame.response },
      lap: c.lap,
      held: c.held,
    });
  });

  return (
    <>
      <AnatomyEnvironment />
      {/* ITEM 7 (owner, pass 3): depth falloff, not depth of field — the far
          side of the room fades toward the paper so front, middle and back
          separate, and nothing goes soft (the visitor needs to inspect
          everything). Near and far ride the camera's distance from the origin
          (useFrame below), so a close-up fogs nothing near and a wide frame
          fades the back wall; the far edge of the membrane comes out paler
          than the near one for free, which is the owner's item 8. */}
      <fog attach="fog" args={[SCENE.background, 4.5, 7.4]} />
      <ambientLight intensity={LIGHTS.ambient} />
      <directionalLight position={LIGHTS.key.position} intensity={LIGHTS.key.intensity} />
      <directionalLight position={LIGHTS.fill.position} intensity={LIGHTS.fill.intensity} />
      {/* NO SHADOW RIG, AND IT WAS TRIED ON THIS ROOM, NOT INHERITED. 2026-09-05:
          the fibre's rig wired as-is — `shadows` PCF on the Canvas, the key
          light casting with `SHADOW`'s map/bias/frustum, every form above
          `opaqueEnough` casting, a `ShadowMaterial` catcher plane inside the
          far wall a unit behind the pools. Two stills
          (.claude/shots/energy/shadow-try): every pool grew a grey twin on the
          wall, offset down-left by its depth — the ATP pool a smear the size of
          the pool, the trimer a dark blob under the ring — the catcher plane
          itself read as a pale rounded panel behind the room, and the 2.6
          frustum cut a hard horizontal edge across it. The 2026-09-01 verdict
          on the old chain ("not a contact cue — a duplicate") holds here for
          the same reason: there is no ground, only a wall, and a wall shadow
          is a second copy of the thing. The depth cue this room has is the
          one the fibre's rig cannot give — parallax of the motes against the
          shell — and that stays. */}
      <primitive object={model.group} />
      <primitive
        object={model.hit}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(e.object.userData.part ?? null);
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          setCard(e.object.userData.part ?? null);
        }}
        onPointerMissed={() => setCard(null)}
      />
      {/* NO STANDING NAME AND NO RING. The "ATP demand from contraction"
          caption that stood over the pulse went with brief §8 and global rule
          5 — the demand is a membrane ripple now, an input event, and the tour
          says its name; the halo rings went with owner item 13. What singles
          a part out is `model.spotlight`, in the frame loop. */}
      {shown && shownAt && !pulling && PART[shown] && (
        <group position={shownAt}>
          <Html center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
            {card ? (
              <div className="energy-card" data-testid="energy-card">
                <b className="energy-card__name">{PART[shown].name}</b>
                <span className="energy-card__line">{PART[shown].line}</span>
              </div>
            ) : (
              <div className="energy-hover">{PART[shown].name}</div>
            )}
          </Html>
        </group>
      )}
      {/* THE WAY IN, beside AMPK — what this floor is about and what the next
          is the consequence of. Hidden while a pass runs: the tour is the
          showing, main is the touching. */}
      {/* BOTH DOORS CARRY THE SAME RECORD. The CTA builds it in the page; this
          door is the app's own way in and must not send less. Read at press
          time, as the fibre's does — a memoised object is a frame stale. */}
      {/* THE LENS TAKES THE PRESS THIS FLOOR USED TO GIVE A BUTTON — 2026-09-06.
          `See the network →` is deleted (owner: *"아예 필요없어 돋보기 있잖아"*),
          and the way down is the lens every other floor uses. But this crossing
          is not like the others: ENERGY → SIGNALS is the one seam where the
          camera pulls BACK rather than zooming in, and that retreat happens in
          the scene BEFORE the swap. So the press goes to `setPulling` instead of
          straight to the router, and `onPulled` finishes it. The rectangle comes
          back with the press because the wash still closes on what was pressed —
          it used to read the button's box and there is no button now. */}
      <WayIn
        at={wayInAt}
        visible={stage === "main" && !pulling}
        seam={seam}
        onWant={() => setWanted(true)}
        carry={carry}
        onGo={onGoDown}
      />
      {/* Orbit in main only — *"tour중에는 회전을 끄고"*. Bounds unchanged from
          the old scale so the storyboard's shots still fit inside them. */}
      <OrbitControls
        makeDefault
        enabled={stage === "main" && !result.running && !pulling}
        enableDamping={CONTROLS.enableDamping}
        dampingFactor={CONTROLS.dampingFactor}
        minDistance={1.2}
        maxDistance={9}
      />
    </>
  );
}

export default function CellScale({ state }) {
  const guidePoint = useRef(null);
  const stageRef = useRef(null);
  /** Where the lens was when it was pressed — the wash closes on it. Was the
      CTA's own rectangle until the CTA was deleted. */
  const pressAt = useRef(null);
  /** What the RESTING guide must not stand on — see `clearRef` in the scene. */
  const clearPoint = useRef(null);
  /* CANVAS PIXELS TO STAGE PIXELS. Both the anchor and the keep-off circle are
     projected in the render loop against the CANVAS, and the guide lays itself
     out against the STAGE, which is a different box. One helper so the two
     cannot drift — they were one line apart and would have been copied. */
  const resolveAt = useCallback((ref) => {
    const at = ref.current;
    const stage = stageRef.current;
    if (!at || !stage) return null;
    const canvas = stage.querySelector("canvas");
    if (!canvas) return null;
    const s = stage.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    return { x: at.x + (c.x - s.x), y: at.y + (c.y - s.y), r: at.r ?? 0 };
  }, []);
  const resolveGuide = useCallback(() => resolveAt(guidePoint), [resolveAt]);
  const resolveClear = useCallback(() => resolveAt(clearPoint), [resolveAt]);

  const [runs, setRuns] = useState(null);
  const [status, setStatus] = useState("loading");
  const live = useRef(null);
  const [readout, setReadout] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [condition, setCondition] = useState("normal");
  const [replayNonce, setReplayNonce] = useState(0);
  const [tourLine, setTourLine] = useState(null);
  const [stage, setStage] = useState("silent");
  /* SKIP DURING THE PLAIN LAP, HELD FROM THE PAGE — the scene is inside
     `Suspense` and mounts a beat later, and until something holds the pass the
     guide shows its resting prompt (SIGNALS measured ~100 ms of it). This
     `stage` mirrors the scene's (`onStage`), so the press goes DOWN as a count
     rather than being set here and overwritten by the scene's next report. */
  const [skipIntro, setSkipIntro] = useState(0);
  useEffect(() => {
    if (stage !== "silent") return undefined;
    return holdTour({ id: "intro", skip: () => setSkipIntro((n) => n + 1) });
  }, [stage]);
  const [narrating, setNarrating] = useState(false);
  /* HAS THE COMPARISON PLAYED — 2026-09-07, owner (cell C3): *"press the magnifier
     … 이건 다 끝나고만 보여야"*. `narrating` is the result pass running (the scene
     reports it); the resting prompt offers the toggle first and the magnifier only
     after that pass has run once. */
  const [compared, setCompared] = useState(false);
  const resultRan = useRef(false);
  useEffect(() => {
    if (narrating) resultRan.current = true;
    else if (resultRan.current) setCompared(true);
  }, [narrating]);
  const [pulling, setPulling] = useState(false);

  /* ── THE EVIDENCE TRACE — `docs/20260907-fix/evidence_trace_clean.md` ──────
     AMPK RESPONSE beside the room: the Normal run's pAMPK rise on the ring's
     own scale (`responseSpan`, so Normal peaks at exactly 1 and the knockout
     at 0.02 — never typed). When the calcium path is turned off the Normal
     line stays as a thin ghost and the knockout's draws over it — the same
     visual logic as the 3D's ghost AMPK (md: "3D ghost AMPK와 같은 visual
     logic"). A part a visitor pressed replaces it with that part's own series
     and nothing else; five graphs at once never happens (`cellPage.test.js`).

     THE WINDOW IS THE TEN-REPETITION BOUT, and this is the one place the
     trace is not exactly the window the floor is playing. The main state
     loops ONE repetition (owner item 14) and the AMPK response is nearly
     flat inside any one of them — a trace of the loop rep would be a line
     that says nothing. So the trace draws the bout, the cursor goes round the
     loop rep inside it, and a pointer along the trace picks which rep the
     room goes round (`seekRef`). Owner's rule, in their words: "trace = 3D의
     창"; this deviates by design and `ENERGY_TRACE_WINDOW` is the one line
     that puts the strict reading back. Reported in the lane's item list. */
  const timeAt = useRef(0);
  const seekRef = useRef(null);
  const avoidPoint = useRef(null);
  const [cardPart, setCardPart] = useState(null);
  useEffect(() => {
    let alive = true;
    /* FOUR RUNS, ONCE. The calcium-off bout and the knockout `armStrength`
       reads are one archived run (`RUNS.calciumOff.bout` === `CHAIN_RUNS.noCalciumArm`),
       so a condition switch swaps a reference and blanks nothing. */
    Promise.all([
      loadScenario(RUNS.normal.bout),
      loadScenario(RUNS.calciumOff.bout),
      loadScenario(CHAIN_RUNS.rest).catch(() => null),
      loadScenario("soce_on"),
    ])
      .then(([normal, calciumOff, rest, ca]) => {
        if (!alive) return;
        setRuns({
          normal,
          calciumOff,
          ca,
          span: responseSpan(normal),
          strength: armStrength({ bout: normal, rest, noCalciumArm: calciumOff }),
        });
        setStatus("ready");
      })
      .catch((e) => alive && setStatus(`Could not load the coupled run — ${e.message}`));
    return () => {
      alive = false;
    };
  }, []);

  // useFrame runs at 60 fps and a readout does not need that. Same throttle the
  // fibre panel uses.
  useEffect(() => {
    const id = setInterval(() => live.current && setReadout(live.current), 100);
    return () => clearInterval(id);
  }, []);

  /* The instrument, for the same reason the fibre carries `__fiberState`: this
     scene is judged from still frames. `__cellState` is the same function under
     the name the existing browser gates read. */
  useEffect(() => {
    const read = () => (live.current ? { ...live.current } : null);
    window.__energyState = read;
    window.__cellState = read;
    return () => {
      delete window.__energyState;
      delete window.__cellState;
    };
  }, []);

  const bout = runs ? runs[condition] : null;
  /* Arrival: the handoff's instant (FIBER→ENERGY shares the Francis clock), else
     the hash's, else the run's first sample. `handoff.js` is the orchestrator's;
     read, never imported. */
  const arrival = state?.handoff?.t ?? state?.t ?? null;
  const t0 = bout?.grid.t0 ?? 0;
  const tEnd = bout?.grid.tEnd ?? 0;
  const outOfRange = bout && arrival != null && (arrival < t0 || arrival > tEnd);

  /* "bout": the ten repetitions, t0 to t0 + REPS·REP_SECONDS. "loop": exactly
     the repetition the room is going round — the strict "trace = 3D의 창". */
  const ENERGY_TRACE_WINDOW = "bout";
  const traceWindow = useMemo(() => {
    if (!bout) return null;
    if (ENERGY_TRACE_WINDOW === "loop" && readout) return repAt(readout.t, t0);
    return { from: t0, to: t0 + REPS * REP_SECONDS };
  }, [bout, t0, ENERGY_TRACE_WINDOW === "loop" ? readout?.rep : null]);
  /* A part's own series when a part was pressed; AMPK's response otherwise.
     The response is (pAMPK − pAMPK[0]) / span — `frameAt`'s own ring scale, so
     the line and the ring cannot disagree. Ghosted Normal under the knockout. */
  const traceLines = useMemo(() => {
    if (!runs || !bout) return [];
    const part = PARTS.find((p) => p.id === cardPart);
    const SERIES = { atp: "ATP", pcr: "PCr", adp: "ADP", amp: "AMP" };
    if (part && SERIES[part.id]) {
      const s = bout.series(SERIES[part.id]);
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of s.values) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      /* The archive's own range, as `chainReading` draws the shapes — a bar
         from zero would say ATP does nothing (7.56 → 6.03 of 8.92 mM). */
      return [{ id: part.id, label: part.name, t: s.t, values: s.values, lo, hi, color: PALETTE.atp }];
    }
    const response = (run) => {
      const s = run.series("pAMPK_fraction");
      const span = runs.span > 0 ? runs.span : 1;
      return { t: s.t, values: s.values.map((v) => (v - s.values[0]) / span) };
    };
    const normal = response(runs.normal);
    /* THE SMALL NUMBER ON THE GRAPH — owner 2026-09-07: where the response stands at the
       bout's end, as a share of this run's own peak (the ring's scale). */
    const boutEnd = (bout.grid?.t0 ?? 0) + REPS * REP_SECONDS;
    const atEnd = (r) => {
      let v = 0;
      for (let k = 0; k < r.t.length; k++) if (r.t[k] <= boutEnd) v = r.values[k];
      return `${Math.round(Math.max(0, Math.min(1, v)) * 100)} % of peak`;
    };
    if (condition === "calciumOff") {
      const off = response(runs.calciumOff);
      return [
        { id: "ampk-normal", label: "AMPK response · normal", t: normal.t, values: normal.values, lo: 0, hi: 1, tone: "ampk", ghost: true, mark: atEnd(normal) },
        { id: "ampk-off", label: "Calcium path off", t: off.t, values: off.values, lo: 0, hi: 1, tone: "calcium-path", mark: atEnd(off) },
      ];
    }
    return [{ id: "ampk", label: "AMPK response", t: normal.t, values: normal.values, lo: 0, hi: 1, tone: "ampk", mark: atEnd(normal) }];
  }, [runs, bout, condition, cardPart]);
  /* THE ONE NUMBER, and only after the experiment (md: "path-off 실험을 완료한
     뒤에만"). `strength.calcium` is `armStrength`'s share of AMPK's rise that
     the CaMKK2 knockout removes — computed off the two archives, ours, so it
     is "this run" and not the paper's figure. */
  const traceNote = useMemo(() => {
    /* Not beside a pressed part's own trace: that block is about the part,
       and only the part (md: "누른 object에 대한 evidence만"). */
    if (condition !== "calciumOff" || narrating || !runs?.strength || cardPart) return null;
    const share = pct(runs.strength.calcium);
    return share ? [["of the modeled AMPK response", share.replace("+", "")]] : null;
  }, [condition, narrating, runs, cardPart]);

  const guideAt = useAim(resolveGuide, !!tourLine);
  /* POLLED ONLY AT REST, and the reason is not economy. While a beat plays the
     guide already stands beside that beat's subject and the scoring keeps it
     off; feeding CaMKK2 in as well would push the character away from the very
     molecule a beat about CaMKK2 is pointing at. */
  const clearAt = useAim(resolveClear, !tourLine);
  /* ONE ARRAY IDENTITY PER MOVE. `useAim` hands back the same point object when
     nothing changed; without this the fresh `[point]` on every render would
     restart the guide's frame loop and its spring twenty times a second. */
  const guideClear = useMemo(() => (clearAt ? [clearAt] : null), [clearAt]);

  /* THE TOUR'S LAST SENTENCE LEAVES WITH THE TOUR: state 4 is *"아무런 텍스트
     없이"*. `onTourLine(null)` at either tour's end clears it directly. */
  const lastLine = useRef(null);
  const onTourLine = useCallback((line) => {
    /* THE PROMPT OUTLIVES THE PASS. `useTour` hands back `null` when a pass runs
       out, and the last beat of this floor's pass is the invitation to test —
       the sentence the controls that appear under it are for. So that one
       `null` is refused; a condition change or the result's own lines replace
       it. Every other line still leaves with its pass (state 4 is wordless). */
    if (line === null && /^Test it yourself/.test(lastLine.current ?? "")) return;
    lastLine.current = line;
    setTourLine(line);
  }, []);
  const chooseCondition = useCallback((key) => {
    lastLine.current = null;
    setTourLine(null);
    setCondition(key);
  }, []);

  /* THE RECORD THIS FLOOR SENDS DOWN — `condition` and `ampk`, bundled with
     the run the numbers were read from (orchestrator's contract: a bare
     fraction arriving on the Fowler clock would be read as that scene's own).
     One function, read at the instant of the press, used by both doors. */
  const carry = useCallback(() => {
    const last = live.current;
    return {
      condition: last?.condition ?? condition,
      ampk: last ? { ...last.ampk, run: RUNS[condition].bout } : null,
    };
  }, [condition]);
  useEffect(() => {
    window.__energyCarry = carry;
    window.__energyHandoff = () => state?.handoff ?? null;
    return () => {
      delete window.__energyCarry;
      delete window.__energyHandoff;
    };
  }, [carry, state]);

  const onPulled = useCallback(() => {
    /* NAVIGATE EXACTLY AS `WayIn` DOES: the descent record for the wash, then
       the hash. No sessionStorage — the orchestrator's `handoff.js` builds the
       `bridge: "ampk"` record at the crossing from `__energyState`. */
    const r = pressAt.current;
    beginDescent({
      startedAt: performance.now(),
      from: parseHash(currentRoute()).scale,
      name: SCALE_LABEL.signalling,
      spanM: null,
      at: r ?? null,
      reduced: !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      /* THE ENERGY → SIGNALS RECORD, frozen once here (orchestrator's `handoff.js`
         contract, 2026-09-05). `t` and `rep` are NOT carried: the next floor is
         on the Fowler 44-minute clock and the contract nulls them at this seam.
         `ampk` travels only bundled with the run it was read from, so a bare
         fraction cannot be read as the arriving scene's own value. `fraction` is
         the authors' pAMPK_fraction; `response` is ours — the rise above t0 over
         the Normal run's own largest rise (`responseSpan`). */
      ...carry(),
    });
    go(hashForScale(parseHash(currentRoute()), "signalling"));
  }, [carry]);

  return (
    <main className="app">
      {/* NO DRAWER, SO NO ☰ — 2026-09-06, the owner's *"body 밑 단계에서는 hamburger
          left side bar 없어도 될듯"*. What was in it was one paragraph: the
          peer-review honesty sentence, kept here verbatim because "two spellings
          of one claim are two claims". Its other spelling still stands in
          `provenance/SourcePanel.jsx:267`, so the claim did not leave the
          repository — and both are behind `uiMode.js`'s `SHOW_SOURCES = false`,
          which is the owner's own 2026-08-30 switch ("논문 아예 다 빼는데 일단
          ui상으로만 빼"). Its sibling `cell-sources` paragraph was already dead
          for the same reason. So the drawer held one sentence a visitor could
          not have reached, behind a button that dimmed the floor to show it. */}
      <AppShell scale={state?.scale} />
      <Ways state={state} playing={playing} onPlaying={setPlaying} />

      <div className="body body--single">
        {/* `cell-stage-only` is what actually reclaims the sidebar's column —
            `.fiber` is a two-column grid and an empty track is still a track. */}
        <div className="fiber cell-stage-only">
          <div className="fiber__stage" data-testid="cell-stage" ref={stageRef}>
            {/* THE STAGE SAYS WHY THE STAGE IS EMPTY — §9 keeps these words. */}
            {status !== "ready" ? (
              <p className="stage-status" data-testid="stage-status">
                {status === "loading" ? "Loading the coupled run…" : status}
              </p>
            ) : !readout ? (
              <p className="stage-status" data-testid="stage-status">
                Waiting for the first frame…
              </p>
            ) : null}

            {/* HUSHED WHILE THE CAMERA PULLS BACK — 2026-09-07. Measured at 700 ms
                into the ride to SIGNALS: the room washed, AMPK alone in colour,
                and the bubble still reading "then press the magnifier". */}
            <Guide at={guideAt} line={tourLine} announce={!tourLine} clear={guideClear} hush={pulling} avoid=".energy-network"
            /* Nothing while the comparison plays — owner (pace 2, C2): the toggle prompt stood through the replay. */
            resting={narrating ? null : compared ? "Now press the magnifier to go deeper." : "Try turning the calcium path off."} />

            <div className="cell-stage-notices" data-narrating={narrating ? "1" : "0"} data-compared={compared ? "1" : "0"}>
              {/* §5: an input outside the grid is said out loud, never snapped
                  quietly. Driven by the REQUEST — the clock is clamped before
                  it draws, so the live sample would read in-range forever. */}
              {outOfRange && (
                <p className="note cell-stage-notice cell-out-of-range" data-testid="cell-out-of-range">
                  <strong>{String(Number(arrival))} s is outside this run.</strong>{" "}
                  The archive covers {t0.toFixed(2)} to {tEnd.toFixed(2)} s — the clock below starts
                  at the nearest instant it has.
                </p>
              )}
            </div>

            {/* The live region the browser cases watch. Mounted only while a
                line exists — around fifteen cases wait on its ABSENCE. */}
            {tourLine ? (
              <p className="fiber__spent fiber__spent--tour say--carried" role="status" data-testid="tour-line">
                <span className="say__body" key={tourLine}>
                  {plainLine(tourLine)}
                </span>
              </p>
            ) : null}

            {!hasWebGL() ? (
              <NoWebGL what="The cell scene" />
            ) : (
              <Canvas
                onCreated={({ gl }) => {
                  gl.domElement.setAttribute("role", "img");
                  gl.domElement.setAttribute("aria-label", "Three-dimensional scene of one cell's energy economy.");
                }}
                camera={{ position: ENERGY_CAMERA, fov: SCENE.camera.fov, near: SCENE.camera.near, far: SCENE.camera.far }}
                dpr={SCENE.dpr}
                gl={SCENE.gl}
              >
                <Suspense fallback={null}>
                  {runs && (
                    <EnergyScene
                      guideRef={guidePoint}
                      clearRef={clearPoint}
                      bout={bout}
                      ca={runs.ca}
                      normal={runs.normal}
                      span={runs.span}
                      calciumShare={runs.strength?.calcium ?? 0}
                      coupled={condition === "normal"}
                      replayNonce={replayNonce}
                      startAt={arrival ?? undefined}
                      playing={playing}
                      pulling={pulling}
                      onGoDown={({ at: box }) => {
                        pressAt.current = box;
                        setPulling(true);
                      }}
                      onPulled={onPulled}
                      carry={carry}
                      onRead={(d) => {
                        live.current = d;
                        timeAt.current = d.t;
                      }}
                      onStage={setStage}
                      skipIntro={skipIntro}
                      onNarrating={setNarrating}
                      onTourLine={onTourLine}
                      seekRef={seekRef}
                      onCard={setCardPart}
                      avoidRef={avoidPoint}
                    />
                  )}
                </Suspense>
              </Canvas>
            )}

            {traceWindow && (
              <EvidenceTrace
                className="trace--energy-left"
                visible={status === "ready" && stage === "main" && !narrating && !pulling && !!readout}
                lines={traceLines}
                from={traceWindow.from}
                to={traceWindow.to}
                timeRef={timeAt}
                onSeek={(t) => seekRef.current?.(t)}
                avoidRef={avoidPoint}
                paper="lindenSantangeli"
                note={traceNote}
                noteLabel={traceNote ? "Calcium path · this run" : null}
                draw="sweep"
                testid="energy-evidence"
              />
            )}

            {/* MAIN ONLY: the three controls the owner asked for and nothing
                else. Chip classes borrowed from the fibre's level ladder so one
                control language covers both floors. */}
            {/* AND WHILE THE INVITATION IS BEING SPOKEN: "Turn off the calcium
                path" with nothing to press for five seconds is a control that
                arrives late (audit r2). */}
            {/* AND NOT WHILE PULLING BACK either — same still, same reason. */}
            {status === "ready" && !pulling && (stage === "main" || /^Test it yourself/.test(tourLine ?? "")) && (
              <div className="energy-controls" data-testid="energy-controls">
                {/* NOT `.fiber-levels` ON THE GROUPS. That class is the fibre's level
                    ladder and fiber.css positions it absolutely on the stage, so two
                    groups wearing it stacked on the same pixels — measured 2026-09-05:
                    the View group intercepted every pointer aimed at Condition. The
                    rungs keep the ladder's chip idiom; the groups are plain columns. */}
                <div className="energy-controls__group" role="group" aria-label="Condition" data-testid="energy-condition">
                  <p className="label">Condition</p>
                  {Object.keys(CONDITIONS).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`fiber-levels__rung${condition === key ? " fiber-levels__rung--on" : ""}`}
                      aria-pressed={condition === key}
                      onClick={() => chooseCondition(key)}
                    >
                      <span className="fiber-levels__dot" aria-hidden="true" />
                      {RUNS[key]?.label ?? CONDITIONS[key]?.label ?? key}
                    </button>
                  ))}
                </div>
                {/* REPLAY IS GONE — owner, ENERGY 18: *"replay는 없애도 될듯"*. A condition switch already returns the loop rep to its first instant. */}
              </div>
            )}

            {/* NO REP STRIP, AND NO SCRUBBER — owner item 14 (2026-09-06):
                *"ATP에서 timeline같은거 그냥 쳐 빼"*. Nothing replaces it: the
                loop rep is the default picture and Replay is the only time
                control. */}

            {/* NO `See the network →` — 2026-09-06. Owner: *"ENERGY → SIGNALS의
                'See the network' 아예 필요없어 돋보기 있잖아"*.
                THIS REVERSES AN INSTRUCTION FROM AN HOUR EARLIER and the two are
                one decision read together. They first said the magnifier "floats
                directly next to AMPK, which makes it feel like AMPK's control"
                and to rely on the CTA instead; I removed the lens. The complaint
                was the PLACEMENT, and the answer they landed on is the one that
                keeps the app consistent: every floor goes down through the same
                lens, and this floor's has to stand somewhere that is not on top
                of a molecule. So the lens is back, the button is gone, and where
                the lens stands is the ENERGY lane's to place — they are moving
                the whole room this pass.
                THE PULL-BACK IS UNCHANGED. `setPulling` still runs, from
                `WayIn`'s own press through `onPulled`; what left is a second door
                to the same place. */}
          </div>
        </div>
      </div>
    </main>
  );
}
