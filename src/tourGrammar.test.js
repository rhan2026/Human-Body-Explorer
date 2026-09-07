import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { loadScenario } from "./scenarioData.js";
import { stepsOf, TOGETHER } from "./tour.js";
import { buildCellChainLevel } from "./cell/cellChainGeometry.js";
import { RUNS } from "./cell/cellBinding.js";
import { instantsOf, responseSpan } from "./cell/energyBinding.js";
import { cellTour } from "./cell/cellTour.js";
import { fiberTour } from "./fiber/fiberTour.js";
import { LEVELS } from "./fiber/fiberGeometry.js";
import { advance, createFiberState, forcePeaks, storeCeilings } from "./fiber/fiberSimulation.js";
import { SCENARIOS, routesOf } from "./signalling/signallingBinding.js";
import { signallingTour } from "./signalling/signallingTour.js";

/**
 * Q4 — DOES EVERY CAMERA MOVE BUY SOMETHING?
 *
 * *Failure: the camera moves and what there is to see did not change.*
 *
 * Every move earns itself and the numbers are here so a later change has to
 * keep earning it. Re-measured 2026-08-31, and the row labels are the lesson.
 *
 * THE FIRST VERSION OF THIS TABLE NAMED ITS ROWS BY BEAT INDEX, AND THE INDICES
 * ARE THE ONLY PART OF IT THAT DID NOT SURVIVE. The fibre pass gained two
 * introduction beats (myosin, actin) and the cell pass gained two (wall,
 * control) during the parallel lane work of 2026-08-30, and both had their
 * cameras re-authored in the same pass. "fibre 1" and "cell 3" stopped naming
 * the beats they were measured on, and because an index says nothing about its
 * subject there was no way to tell which beat a stale row had been about — the
 * 2026-08-27 cell figure (Δcam 0.329, 1.80 back) matches no move that ships
 * today and cannot be traced to one. So the rows are keyed by the PART each
 * beat belongs to, which is `stepsOf`'s own key and the id of the ring a
 * visitor presses. A part can be renamed; it cannot silently become a
 * different beat.
 *
 *   fibre  myosin, actin       no move                    cuts on the opener's framing
 *          t-tubule            Δcam 2.322  Δlook 1.504    a new subject
 *          sr (opens)          no move                    a cut on one framing
 *          sr (drains)         Δcam 1.497  Δlook 1.690    across to the store
 *          tropomyosin         Δcam 3.813  Δlook 3.358    3.13 → 4.67 back
 *          sr (conclusion)     no move                    the conclusion's cut
 *   cell   arm-control         Δcam 0.868  Δlook 0.868    one column to the other
 *          camkk               Δcam 0.466  Δlook 0.420    zoom 1.100, which does
 *                                                         NOT clear the framing
 *                                                         test — it earns on
 *                                                         subject alone
 *          ampk-subunit (2nd)  Δcam 0.428  Δlook 0.152    the smallest move here
 *   sig    split-resistance    Δcam 0.640  Δlook 0.223    a pull-back, 2.60 → 3.20
 *          trunk (1st)         Δcam 0.500  Δlook 0.000    THE ONLY MOVE IN ALL
 *                                                         THREE PASSES THAT EARNS
 *                                                         ON FRAMING ALONE
 *
 * The signalling pull-back is the one that looked wrong and is not: its lookAt
 * barely moves because `resistanceOnly` and `enduranceOnly` share a height —
 * both bands are y 0.340 to 0.640 — so the two columns differ in x, not in y.
 * What the 2.60 → 3.20 buys is width: the pair spans 1.80 and fills **86% of
 * the frame at 2.60 against 70% at 3.20**, so at the doors framing they run
 * edge to edge with no margin. (Measured in a browser 2026-08-27; the two
 * numbers above have drifted 0.601 → 0.640 and 0.030 → 0.223 since, and the
 * argument is about the 2.60 → 3.20, which has not.)
 *
 * The trunk's first beat is the row to watch. Its lookAt is 0.000 — exactly the
 * same aim as the beat before it — so the whole of what it buys is 3.20 → 2.70,
 * a zoom of 1.185 against a threshold of 1.1. Flatten that camera by a tenth
 * and this test goes red, correctly, and nothing else in three passes will.
 *
 * What this holds is the grammar rather than any one number: a beat either
 * moves the camera to something new, or holds it and lets the run be the
 * change. A beat that moves the camera to the same subject at the same distance
 * over the same instants is the failure, and nothing was watching for it.
 */
const readJson = async (p) => JSON.parse(await readFile(new URL(`../public${p}`, import.meta.url), "utf8"));
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const span = (b) => (b.speed ?? 0) * ((b.ms ?? 0) / 1000);

/** The sarcomere's own anchors, stepped so they are where the scene has them. */
function fibrePoints() {
  const model = LEVELS.sarcomere.build();
  const state = createFiberState();
  for (let i = 0; i < 30; i += 1) advance(state, 1 / 60);
  model.update?.(state, state.time);
  return [...(model.anchors ?? []), ...(model.sites ?? [])];
}

async function storyboards() {
  const fib = await loadScenario("soce_on", readJson);
  /* RETARGETED 2026-09-05, THE SAME WAY `tourPace.test.js` WAS AND FOR THE SAME
     TWO REASONS. `RUNS.none` is gone — the ENERGY rewrite named its conditions
     for the INPUT rather than the gene, so the unbroken run is `normal` — and
     `cellTour` is `energyTour`, which takes four arguments and returns an empty
     array when the last two are missing. Fourteen assertions in this file were
     failing on the first and would have graded nothing on the second.
     The inputs are `CellScale.jsx`'s own, read the way it reads them. */
  const bout = await loadScenario(RUNS.normal.bout, readJson);
  const ca = await loadScenario("soce_on", readJson);
  const model = buildCellChainLevel();
  const cell = cellTour(bout, model.anchors, instantsOf(bout, ca), { span: responseSpan(bout) });
  model.dispose();
  const arms = {
    resistance: await loadScenario(SCENARIOS.resistance, readJson),
    endurance: await loadScenario(SCENARIOS.endurance, readJson),
    control: await loadScenario(SCENARIOS.control, readJson),
  };
  return [
    /* THE PEAKS ARE NOT OPTIONAL, AND THIS FILE WAS THE THIRD PLACE TO LEARN IT.
       `fiberTour(protocol, ceilings, peaks, points)` builds its ending out of
       the first repetition against the last, so a call without `peaks` returns
       an EMPTY array — and every assertion below then grades nothing while the
       file reports green. `tourPace.test.js` carries the same warning about its
       own call and `fiberTour.test.js` about a third; here it was live, and the
       only reason it surfaced is the "a storyboard with 0 beats is not a pass"
       guard at the top of the loop.
       `forcePeaks` RATHER THAN A HAND-ROLLED SWEEP. `tourPace.test.js` derives
       its peaks from the shipped bytes on purpose — it is grading the arithmetic
       — and this file is grading the GRAMMAR, so re-deriving them here would be
       a second copy of an app function with nothing to gain by differing.

       AND `points` IS THE SAME TRAP AGAIN, WHICH I WALKED INTO WHILE FIXING THE
       FIRST ONE. Adding the peaks made the storyboard non-empty and I stopped
       there; without `points`, `anchorAt` answers `[0, 0, 0]` for every beat.
       Measured by the FIBER lane: 23 beats, ONE distinct lookAt without them and
       SEVEN with. So "a beat that moves the camera arrives somewhere the last
       one was not" was grading a pass in which every close shot looks at the
       origin — the delta it exists to watch is structurally zero. Half-waking a
       gate is its own failure mode, and this file has now been bitten by the
       same shape twice.
       The model is stepped before its anchors are read because they move: the
       thirty frames are what `tourAimsAtTheModel.test.js` builds, so the two
       agree about where the parts are. */
    ["fibre", fiberTour(fib.protocol, storeCeilings(fib), forcePeaks(fib), fibrePoints())],
    ["cell", cell],
    ["signalling", signallingTour(arms.resistance.protocol, routesOf(arms), arms.resistance.grid.tEnd * 60)],
  ];
}

test("a beat that moves the camera arrives somewhere the last one was not", async () => {
  const idle = [];
  for (const [name, beats] of await storyboards()) {
    assert.ok(beats.length > 2, `${name}: a storyboard with ${beats.length} beats is not a pass`);
    beats.forEach((b, i) => {
      const prev = beats[i - 1];
      if (!prev) return;
      /* A BEAT WITHOUT A CAMERA IS NOT A BEAT THAT DID NOT MOVE — 2026-09-05.
         `enter` is a scene-resolved verb, like `level`: it names the anchor to
         push into and `FiberScene` resolves it against whatever model is on
         screen at that moment. The storyboard does not hold the fascicle's or
         the fibre's anchors, so there is no position to compare statically and
         `d3` was reading `[0]` off undefined. Skipped rather than defaulted: a
         `[0,0,0]` stand-in would make two scene-resolved beats look like two
         beats framed identically at the origin, which is the exact claim this
         assertion exists to make. */
      if (!prev.camera || !b.camera) return;
      const moved = d3(prev.camera, b.camera);
      if (moved < 1e-6) return; // a cut on one framing, which is its own device
      const look = d3(prev.lookAt ?? [0, 0, 0], b.lookAt ?? [0, 0, 0]);
      const back = d3(b.camera, b.lookAt ?? [0, 0, 0]);
      const prevBack = d3(prev.camera, prev.lookAt ?? [0, 0, 0]);
      /* Either the subject changed, or the framing did. A dolly is a change of
         framing; `1.1` is where Q2 R4 landed after ruling that a 1.42x push "is
         not a push", so a move that changes neither by that much is a move
         nobody can see the point of. */
      const zoom = Math.max(back, prevBack) / Math.min(back, prevBack);
      const newSubject = look > 0.02;
      const newFraming = zoom > 1.1;
      if (!newSubject && !newFraming) {
        idle.push(
          `${name} beat ${i}: the camera travelled ${moved.toFixed(3)} and arrived at the same subject ` +
            `(ΔlookAt ${look.toFixed(3)}) at the same distance (${prevBack.toFixed(2)} → ${back.toFixed(2)})`,
        );
      }
    });
  }
  assert.deepEqual(idle, [], `a camera move that buys nothing:\n  ${idle.join("\n  ")}`);
});

test("no beat replays the last one's instants from the same place", async () => {
  const repeats = [];
  for (const [name, beats] of await storyboards()) {
    beats.forEach((b, i) => {
      const prev = beats[i - 1];
      if (!prev) return;
      if (!prev.camera || !b.camera) return; // scene-resolved beat — see the note above
      if (d3(prev.camera, b.camera) > 1e-6) return;
      const a0 = prev.seek ?? 0;
      const a1 = a0 + span(prev);
      const b0 = b.seek ?? a1;
      const b1 = b0 + span(b);
      /* Same framing AND the same stretch of run AND the same thing drawn.
         Two beats on one framing at two INSTANTS is the conclusion cut and is
         the point. Two beats on one framing over one WINDOW is a repeat —
         UNLESS what is drawn changed, which is the signalling split: the same
         nine minutes twice, one arm and then both, and its own comment says why
         it has to be the same nine minutes ("it is only a comparison if it is
         the same nine minutes"). The first version of this test flagged that
         beat, which is a test holding an implementation rather than the claim:
         the claim is that a viewer is not shown a stretch they have watched. */
      const sameDraw = (prev.arm ?? null) === (b.arm ?? null);
      if (sameDraw && Math.abs(a0 - b0) < 1e-6 && Math.abs(a1 - b1) < 1e-6 && a1 - a0 > 1e-6) {
        repeats.push(`${name} beat ${i}: replays beat ${i - 1}'s ${(a1 - a0).toFixed(3)} s from the same camera`);
      }
    });
  }
  assert.deepEqual(repeats, [], `a beat a viewer has already seen:\n  ${repeats.join("\n  ")}`);
});

/**
 * A LEVEL CHANGE RE-FRAMES ON PURPOSE, NOT ON A ROUNDING.
 *
 * `useCameraTransition` re-arms whenever its destination CHANGES, and the fibre
 * scale's three levels sit at `[1.3, 1.7, 6]`, `[1.3, 1.7, 6.1]` and
 * `[1.1, 1.8, 7.6]`. So fascicle → fiber re-armed on a **0.100 difference —
 * 1.6% of apparent size**, a move nobody can see — and that accident was the
 * only thing returning a viewer who had orbited away to the level's own
 * framing. Measured 2026-08-27: after an orbit and a switch, the silhouette
 * lands back within 5 px of the un-orbited frame, which is the behaviour the
 * geometry file asks for ("where each level frames well"). It should not rest
 * on two numbers being 0.1 apart: make them equal one day and a viewer's orbit
 * survives one rung of the ladder and not the other, silently.
 */
test("the fibre scale's level is part of what re-arms the camera", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("./fiber/FiberScene.jsx", import.meta.url), "utf8");
  const call = src.match(/useCameraTransition\([^;]*\);/s)?.[0] ?? "";
  assert.ok(call, "FiberScene no longer eases its camera at all");
  assert.match(
    call,
    /level/,
    "a level change re-frames only because two of the three cameras happen to differ",
  );
});

/**
 * THE AIM IS EASED, NOT COMMITTED.
 *
 * `useCameraTransition` lerps `controls.target` toward the destination every
 * frame — that is half of what a camera move is. Handing `OrbitControls` a
 * `target` prop takes that half away: R3F applies an array prop by calling
 * `target.set(...)` at COMMIT, which is before any frame runs, so the aim
 * arrives instantly while the position glides to meet it. Half a move at once
 * and half over 0.6 s is two moves, and the fast half reads as the cut.
 *
 * The three lower scales pass `target={[0, 0, 0]}`, and that is harmless for a
 * reason worth writing down rather than being surprised by later: it is the same
 * value their ease already defaults to, R3F compares array props shallowly so it
 * is applied once at mount and never again, and nothing about it changes. What
 * cannot be passed is a target that MOVES — which is what the body scale's was,
 * and it is the one scale whose presets differ enough for it to matter: push-up
 * to pull-up swings the aim 24.6°, which is 65% of the frame's height.
 * The assertion below already excepted `[0, 0, 0]`; this paragraph did not, and
 * a comment that is wrong about which files do what is how a fixed thing gets
 * re-broken.
 *
 * SAID PLAINLY, BECAUSE IT IS A LIMIT OF THE EVIDENCE: the shape of a 0.6 s
 * ease could not be photographed here. This machine's renderer painted 2 frames
 * in 1.5 s under load, and a silhouette cannot separate the camera from the pose
 * anyway — a pull-up body against a push-up body moves the drawn centroid 300 px
 * on its own. So this holds the wiring, which is where the defect is, and the
 * end state was checked in a browser: position and target both land on the new
 * preset.
 */
test("the body scale leaves its aim to the ease, like the three scales below", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = async (f) => readFile(new URL(f, import.meta.url), "utf8");

  const body = await read("./MotionScene.jsx");
  const orbit = body.match(/<OrbitControls[\s\S]*?\/>/)?.[0] ?? "";
  assert.ok(orbit, "the body scale no longer mounts OrbitControls");
  assert.doesNotMatch(
    orbit,
    /\btarget=/,
    "the body scale commits its orbit target as a prop, which cuts the aim the ease is there to carry",
  );

  /* And the three below stay the way they already were. */
  for (const f of ["./fiber/FiberScene.jsx", "./cell/CellScale.jsx", "./signalling/SignallingScale.jsx"]) {
    const src = await read(f);
    const controls = src.match(/<OrbitControls[\s\S]*?\/>/)?.[0] ?? "";
    if (!controls) continue;
    assert.doesNotMatch(controls, /\btarget=\{(?!\[0, 0, 0\])/, `${f} began committing its orbit target`);
  }
});

/**
 * THE FILE THAT MOVES THE CAMERA HONOURS reduced-motion TOO.
 *
 * Seven files in this app check `prefers-reduced-motion` — `tour.js`,
 * `Descent.jsx`, `MotionScene.jsx` and four stylesheets — and until 2026-08-27
 * `useCameraTransition.js`, the one that actually slides a camera, had none. So
 * a reduced-motion viewer lost the twelve moves that were designed for them to
 * lose and kept the ones nobody had thought about: switching exercise glided
 * 1.259 units and swung the aim 24.6°, which is 65% of the frame's height, and
 * the fibre level ladder slid 1.517.
 *
 * A CUT, NOT A CANCELLATION. Reset and the level ladder are function, not
 * decoration, and a Reset that does not reset is worse than one that arrives
 * instantly. Measured after: with `reduce` the camera reads exactly its preset
 * [1.7, 1.5, 3.35] on the first sample after the switch; without it, [1.7019,
 * 1.4996, 3.3461] — still on its way.
 */
test("the camera's own file checks whether a viewer asked for calm", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("./fiber/useCameraTransition.js", import.meta.url), "utf8");
  /* THE CODE, NOT THE COMMENT. The first version of this asserted the file
     MENTIONS `prefers-reduced-motion`, and a paragraph about it satisfies that
     — deleting the branch left the test green. What has to be true is that the
     per-frame step depends on the answer. */
  const step = src.match(/const k = [^;]+;/)?.[0] ?? "";
  assert.ok(step, "the ease no longer computes a step");
  assert.match(
    step,
    /calm/,
    `the camera's per-frame step is \`${step}\` — it does not ask whether a viewer wants to be slid at`,
  );
  /* And it CUTS rather than refusing: the destination is still reached, because
     Reset and the level ladder are function and not decoration. */
  assert.doesNotMatch(
    src,
    /if \(\s*calm\.current\s*\)\s*return/,
    "reduced motion turns the camera off rather than making it arrive at once",
  );
});

/**
 * THE MAIN STATE IS A FRAMING, AND A PASS MUST HAND IT BACK.
 *
 * Canon section 0 gives every deep scale two states: the pass, and the scale's
 * own standing screen that a visitor touches. The standing screen is not a mood
 * — it is the level's own exported camera. Whatever the pass borrowed, the
 * scale gets back.
 *
 * WHAT `!tour.interrupted` DID INSTEAD, measured 2026-08-31 on the fibre at
 * 1280x900 in a real browser. A press ends the pass — that is the design — and
 * `enabled` then went false forever, so the camera stayed at whatever beat the
 * press landed on. The fibre's storyboard travels: its last framings sit at
 * `CISTERNA_X + 0.7`, and the sarcomere's own geometry ends at x = 0.80. So an
 * interrupted viewer was left looking at a close-up of a coordinate the object
 * does not reach, the sarcomere ran off the right edge of the frame, and
 * **`[data-testid="way-in"]` measured x = 2841 in a 1280-wide window** — the
 * whole way down to the cell, off screen, on the scale that has one.
 *
 * The clause was written when these scales had OrbitControls and it protected a
 * real thing: a viewer's own camera. D6 removed the orbit from all three on
 * 2026-08-30, so from that day it protected nothing and only stranded people
 * who did what the canon asks them to do. `home` went the same way — nothing
 * has called `setHome` since D3 took the strip, so every `home ? … : …` in
 * these three files was picking the same branch every time.
 *
 * THE ORBIT CAME BACK ON 2026-08-31 AND THIS ASSERTION DID NOT MOVE. The owner
 * narrowed D6 rather than overturning it (TODO.md B9): the orbit is on in the
 * main state and off while a demonstration runs — *"tour중에는 회전을 끄고 —
 * Main → Tour → Main(여기서 켜짐)"*. So a pass and a viewer's hands are never
 * live in the same frame, and the clause has no subject even now.
 *
 * AND IT WOULD STILL BE WRONG IF IT DID. `interrupted` means the pass was
 * STOPPED, and a ring press stops the pass — the camera a viewer aimed and the
 * camera a viewer merely interrupted are two different cameras, and this flag
 * cannot tell them apart. That is the whole of the measurement above.
 * Retargeting this to allow `interrupted` back would be inverting it, not
 * retargeting it. What a viewer's own turn is protected by now is that in the
 * main state nothing changes the ease's destination at all, plus the
 * `INTERRUPTS` listener already in `useCameraTransition.js`.
 *
 * Source text rather than a render, matching the two tests above: what is being
 * fixed here IS the argument, and a mounted R3F scene cannot be asked what its
 * camera would ease to without a GPU. The browser measurement is in the commit.
 */
test("no deep scale keeps the camera where a pass was interrupted", async () => {
  const { readFile } = await import("node:fs/promises");
  const scenes = ["fiber/FiberScene.jsx", "cell/CellScale.jsx", "signalling/SignallingScale.jsx"];
  for (const scene of scenes) {
    const src = await readFile(new URL(`./${scene}`, import.meta.url), "utf8");
    const call = src.match(/useCameraTransition\([^;]*\);/s)?.[0] ?? "";
    assert.ok(call, `${scene} no longer eases its camera at all`);
    assert.doesNotMatch(
      call,
      /interrupted/,
      `${scene} disarms its camera ease once a viewer has touched anything, which leaves ` +
        `the scale with no standing framing to come back to — the state canon section 0 ` +
        `calls the main state`,
    );
  }
});

/**
 * THE ORBIT IS OFF WHILE A DEMONSTRATION IS DRIVING THE CAMERA, AND ON EITHER
 * SIDE OF IT.
 *
 * Canon D6 took the orbit off the three deep scales on 2026-08-30 — *"body와
 * 달리 화면을 돌릴 수 없다 — 우리가 지정해준대로만 봐"*. The owner put it back on
 * 2026-08-31 and, in the same breath, said where it belongs: *"tour중에는 회전을
 * 끄고 — Main → Tour (각자 설명) → Main(여기서 켜짐)"*. D6's reason was right and
 * its scope was wrong: "only the angles we chose" is a rule about the
 * demonstration, and it had been applied to the whole scale.
 *
 * SO THIS HOLDS THE SWITCH, AND THE SWITCH IS THE PART THAT IS EASY TO GET
 * WRONG. `open` is the obvious candidate and it is the trap: it records which
 * RING is open, and nothing sets it back to null — only a level change does, on
 * the one scale that has levels. `enabled={!open}` would turn the orbit off at
 * the first press and never turn it on again, which is D6 with extra steps and
 * would look exactly like a working feature until somebody pressed a ring.
 * `tour.running` is `!!at` in `tour.js`, and `at` goes null both when a
 * storyboard runs out and when `stopped` is set by one of `INTERRUPTS` — the
 * two ways a demonstration ends are the two ways the shape comes back.
 *
 * Source text, like the camera tests above and for their reason: an R3F scene
 * cannot be asked what its controls would do without a GPU, and the defect this
 * is about IS the prop.
 */
test("a viewer can turn every deep scale, except while one is being demonstrated", async () => {
  for (const scene of ["fiber/FiberScene.jsx", "cell/CellScale.jsx", "signalling/SignallingScale.jsx"]) {
    const src = await readFile(new URL(`./${scene}`, import.meta.url), "utf8");
    const controls = src.match(/<OrbitControls[\s\S]*?\/>/)?.[0] ?? "";
    assert.ok(controls, `${scene} mounts no OrbitControls, so a viewer cannot turn it at all`);
    /* THE PROPERTY, NOT ONE SPELLING OF IT — retargeted 2026-09-05.
       This matched `enabled={!tour.running}` literally, which was the whole of
       the switch on the day it was written and stopped being so when the floors
       were rebuilt: ENERGY now reads `stage === "main" && !result.running &&
       !pulling`, which is the same rule stated over three facts instead of one
       — the arrival pass, the result pass and the pull-back each own the camera
       while they run, and each of the three ends. Pinning the spelling made a
       floor that says the rule MORE precisely fail for saying it differently.
       WHAT IS STILL PINNED IS THE TRAP THIS CASE WAS BUILT AROUND, and it is
       named two paragraphs up: `open` records which ring is open and nothing
       clears it, so an orbit gated on it goes off at the first press and stays
       off — "D6 with extra steps", indistinguishable from a working feature
       until somebody presses a ring. That is an absence test and it is the half
       that catches anything.
       And the prop has to be gated on SOMETHING that ends: a bare `enabled` or
       one that never mentions a demonstration is the other way to fail. */
    const enabled = controls.match(/enabled=\{[^}]*\}/)?.[0] ?? "";
    assert.ok(
      enabled,
      `${scene} mounts OrbitControls with no \`enabled\` prop, so the storyboard and the viewer ` +
        `fight for the camera for the whole of every demonstration`,
    );
    assert.doesNotMatch(
      enabled,
      /\bopen\b/,
      `${scene}'s orbit reads \`${enabled}\` — \`open\` records which ring is open and nothing ever ` +
        `clears it, so the orbit would go off at the first press and stay off`,
    );
    assert.match(
      enabled,
      /running|stage|pulling|tour/,
      `${scene}'s orbit reads \`${enabled}\` — it names no demonstration state, so either the ` +
        `storyboard never gets the camera or the viewer never gets it back`,
    );
  }
});

/**
 * NO SHOT ASKS FOR A DISTANCE THE RESTORED CONTROLS WOULD QUIETLY MOVE.
 *
 * `cellTour.js` has said this out loud since it was written — *"`OrbitControls`
 * in `CellScale.jsx` clamps the camera to 1.2–9 from its target, so a shot
 * outside that is a shot the controls quietly move somewhere else"* — and for
 * the day between canon D6 and its narrowing the component it names was not
 * mounted, so the sentence described nothing and the storyboards were free to
 * drift out of bounds with nothing watching. The clamp applies during a
 * demonstration too: `enabled` gates the pointer handlers, not `update()`, and
 * the ease calls `update()` on every frame it runs.
 *
 * The bounds are read off each scene's own markup rather than repeated here, so
 * a storyboard and its clamp cannot be brought back into agreement by editing
 * the copy of the numbers that nobody runs.
 */
test("no beat is framed outside the bounds its scale's controls clamp to", async () => {
  const scenes = {
    fibre: "./fiber/FiberScene.jsx",
    cell: "./cell/CellScale.jsx",
    signalling: "./signalling/SignallingScale.jsx",
  };
  const outside = [];
  for (const [name, beats] of await storyboards()) {
    const src = await readFile(new URL(scenes[name], import.meta.url), "utf8");
    const controls = src.match(/<OrbitControls[\s\S]*?\/>/)?.[0] ?? "";
    const min = Number(controls.match(/minDistance=\{([\d.]+)\}/)?.[1]);
    const max = Number(controls.match(/maxDistance=\{([\d.]+)\}/)?.[1]);
    assert.ok(min > 0 && max > min, `${name}: unreadable orbit bounds in \`${controls}\``);
    beats.forEach((b, i) => {
      if (!b.camera) return;
      const back = d3(b.camera, b.lookAt ?? [0, 0, 0]);
      if (back < min || back > max) {
        outside.push(`${name} beat ${i} (${b.focus ?? "no part"}): ${back.toFixed(3)} back, clamped to ${min}–${max}`);
      }
    });
  }
  assert.deepEqual(
    outside,
    [],
    `a shot outside the clamp is a shot the controls move somewhere else, silently:\n  ${outside.join("\n  ")}`,
  );
});

/**
 * ONE STORYBOARD, TWO READINGS, AND THE CUT HAS TO SERVE BOTH.
 *
 * The owner spelled the deep scales' structure out on 2026-08-31 — four states,
 * in order: arrive with no text at all; an AUTOMATIC tour explaining each
 * element; the same tour going on to show *"전체적으로 어떻게 working 하는지"*;
 * then no text again, with the way down and every part pressable.
 *
 * States 2 and 3 are one uninterrupted sequence and state 4 is a press. So the
 * same beats have to play two ways: straight through, in order, for the tour,
 * and one part at a time when a visitor presses a ring afterwards. `stepsOf`
 * gives the second reading. This is what makes the FIRST one free — the opener
 * is the head of the array, the whole-run beats are a contiguous tail of it,
 * and everything between belongs to some part. Play the array as written and
 * you have played state 2 and then state 3, in that order, with no reordering
 * and no second copy of the storyboard to keep in step.
 *
 * IT IS NOT FREE BY LUCK. Nothing stops a storyboard from putting a whole-run
 * beat in the middle, and nothing would notice: `stepsOf` would still group it
 * correctly and every press would still be right, while the automatic sequence
 * quietly explained the ending before the parts it is about. That is the shape
 * this case exists to catch, and it can only be caught here, where all three
 * passes are loaded at once.
 */
test("each pass ends with its whole-run half, so the tour is the storyboard played in order", async () => {
  for (const [name, beats] of await storyboards()) {
    /* THE FIBRE LEFT THIS GRAMMAR ON 2026-09-05, AND IT LEFT IT ON PURPOSE.
       Everything above holds while ONE array serves both readings — the tour
       played straight through and a press replaying one part — because then
       "state 3 after state 2" is free. The fibre split into TWO storyboards
       that day, for a reason the single array could not carry: its pass has a
       t-tubule beat that ANSWERS a question its tropomyosin beat asked three
       beats earlier, and a press has to be able to replay either without the
       other. With the split there are no `TOGETHER` beats left and `finale` is
       empty by construction, not by omission.
       THE HALF OF THE RULE THAT SURVIVES MOVED WITH IT. "Teach every part
       before the whole" is now graded in `fiberTour.test.js`, against that
       floor's own two arrays. The half that does not survive is "the whole run
       is LAST", and the fibre is deliberately the other way round: its cause
       and its bridge come after the set, because they are what the set was for.
       A pass that ends on the set is a pass that shows fatigue and never names
       it.
       cell and signalling are still one array each, so the rule is still theirs
       and still enforced below. */
    if (name === "fibre") continue;
    const { opener, steps, finale } = stepsOf(beats);

    assert.ok(
      finale.length > 0,
      `${name}: the pass has no whole-run half at all, so state 3 — the owner's ` +
        `"전체적으로 어떻게 working 하는지" — has nothing to play`,
    );
    assert.deepEqual(
      beats.slice(-finale.length),
      finale,
      `${name}: the whole-run beats are not the last ones in the storyboard, so playing it in order ` +
        `explains how everything works together before it has explained the parts`,
    );
    assert.deepEqual(
      beats.slice(0, opener.length),
      opener,
      `${name}: the beat that names the picture is not the first one`,
    );
    assert.equal(
      opener.length + steps.reduce((n, s) => n + s.beats.length, 0) + finale.length,
      beats.length,
      `${name}: the three groups do not add up to the storyboard, so some beat plays in the tour and ` +
        `belongs to nothing a visitor can press`,
    );
    assert.ok(
      !steps.some((step) => step.id === TOGETHER),
      `${name}: "${TOGETHER}" is the reserved id for the whole-run half and something is using it as ` +
        `an anchor, which would put a ring on it`,
    );
  }
});

