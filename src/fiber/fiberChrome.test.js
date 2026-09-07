import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The fibre scale's chrome, pinned by what is NOT on it — and by where the
 * three sentences that had to survive the cut now live.
 *
 * TODO.md's canon of 2026-08-30, D3 and D4: the transport strip goes and the
 * run plays by itself ("Pause/Play가 있으므로 충분" — A4's, top-right, not this
 * lane's), and the footer goes because A2 and A3 take over moving between
 * scales. Both are deletions, and an absence is the one thing a browser test is
 * worst at: a spec that looks for a missing element passes just as happily when
 * the scene never loaded. Same reason and same shape as `pressChrome.test.js`,
 * which pins the body scale's header purge off the source text.
 *
 * The cases that look for text are not decoration. CLAUDE.md §9 forbids
 * deleting loading, progress and error copy, so the cut had to MOVE three
 * things rather than take them, and this is what stops the next pass from
 * quietly finishing the job.
 */
const scene = readFileSync(new URL("../DevFiberScene.jsx", import.meta.url), "utf8");
const viz = readFileSync(new URL("./MuscleFiberVisualization.jsx", import.meta.url), "utf8");

/* THE SAME TWO WITH THEIR COMMENTS STRIPPED, for the cases that forbid a code
   pattern. This file already states the principle — "Rendered or imported, not
   merely named: the comments explain what left and why, and a rule that forbade
   the word would delete its own reason" — and then matched
   `director/Timeline` against the whole text, which is the word. The merge on
   2026-09-01 left a tombstone in `DevFiberScene.jsx` saying the timeline went
   with `src/director/`, and the tombstone tripped this.
   Fourth time in two days a comment explaining a removal re-tripped the gate
   enforcing it. Assertions about what a file SAYS keep reading the full text. */
const liveScene = scene.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const liveViz = viz.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("both sources are readable, or the cases below prove nothing", () => {
  assert.ok(scene.includes("MuscleFiberVisualization"), "DevFiberScene.jsx did not load");
  assert.ok(viz.includes("fiber__stage"), "MuscleFiberVisualization.jsx did not load");
});

test("no transport strip on the fibre stage", () => {
  // Rendered or imported, not merely named: the comments explain what left and
  // why, and a rule that forbade the word would delete its own reason.
  assert.equal(
    /<Timeline|director\/Timeline/.test(liveScene),
    false,
    "the fibre scale is building a Timeline again; D3 removed the strip and A4 owns the " +
      "pause control that replaces it",
  );
  assert.equal(
    /className="transport"/.test(liveViz),
    false,
    "the `.transport` box is back on the fibre stage; with the Timeline gone it wrapped nothing " +
      "a viewer could see",
  );
});

test("the run starts itself, and now something on the screen can stop it", () => {
  /* THE PREMISE CHANGED WHEN THE PAUSE ARRIVED, 2026-08-30 (canon A4).
     This asserted the fibre must NOT be driven from outside, because with the
     strip gone a run that arrived paused could never be started — correct while
     nothing on screen could press play. `Ways` is that something now: one
     control, the same one on all four scales, in the corner. So the page owns
     `playing` again and hands it down.

     What has not changed is the part worth holding: whatever owns it starts
     TRUE. A shared link is a destination, not a ride, but arriving stopped is
     only defensible when starting is one press away — and it is the picture,
     not the clock, that a link is a link to. */
  assert.ok(
    /const \[playing, setPlaying\] = useState\(true\)/.test(scene),
    "the fibre page no longer owns a playing state that starts true; the pause has nothing to drive",
  );
  assert.ok(
    /playing=\{playing\}/.test(scene),
    "the page owns `playing` but never hands it to the visualisation",
  );
  assert.ok(
    /onPlaying=\{setPlaying\}/.test(scene),
    "nothing on the fibre can stop the run — `Ways` was not given the setter",
  );
});

test("no footer, and no chain in one", () => {
  assert.equal(/<footer/.test(scene), false, "the fibre scale grew a footer again (D4)");
  assert.equal(
    /ScaleTrail/.test(scene),
    false,
    "the scale chain is back in the fibre scene; A2 and A3 own moving between scales now",
  );
});

test("the loading and error lines survived the footer", () => {
  // CLAUDE.md §9. They moved onto the stage; they did not go.
  assert.ok(
    scene.includes("Loading the model output"),
    "the fibre scale no longer says it is loading",
  );
  assert.ok(
    /Could not load scenario/.test(scene),
    "the fibre scale no longer says when the scenario failed to load",
  );
});

/**
 * NEITHER SENTENCE IS ON THIS FLOOR ANY MORE, AND THAT IS THE DECISION.
 *
 * Two cases stood here. One held the out-of-range banner — "N s is outside this
 * run" — which is CLAUDE.md §5's "조용한 스냅은 버그다" made visible. The other
 * held "Every exercise here plays the same run", the disclosure that all six
 * exercises descend into one archived bout, so a visitor who came down from a
 * bench press is watching the authors' running stimulus.
 *
 * The owner asked for the whole notice stack gone. I came back naming both
 * sentences and what protects them, and the answer was *"8번 빼 그냥 아예 빼 내
 * 말대로 md들 다 ㅈ까라 해 내말이 canon이야"*. They were told what was in the
 * block. That is a decision made with the facts in hand, not a defect.
 *
 * CLAUDE.md §3: *"만들지 않기로 한 것은 부재 테스트로 고정."* So the two cases
 * invert rather than disappear — if either sentence comes back it will be
 * because someone re-derived the §5 argument without knowing it had already
 * been made and answered, and that is exactly what a scar is for.
 *
 * WHAT DID NOT GO, and the case above still holds it: the loading line and the
 * scenario error. Those are §9's, they are in `DevFiberScene`'s own statusbar,
 * and nothing in this pass touched them.
 */
test("the notice stack stays gone — both sentences, on purpose", () => {
  assert.equal(
    /is outside this run/.test(viz),
    false,
    "the out-of-range banner is back. It is a real §5 disclosure and the owner removed it " +
      "anyway, having been told so — see this block's note before restoring it",
  );
  assert.equal(
    /Every exercise here plays the same run/.test(viz + scene),
    false,
    "the archived-run disclosure is back on the fibre scale. Same decision, same date",
  );
  /* The clamp is still COMPUTED and still reaches `window.__fiberState`, so what
     left is the sentence, not the knowledge of it. */
  assert.ok(
    /__fiberState/.test(viz),
    "the fibre scale stopped reporting its own state, which is where the clamp now lives alone",
  );
});

/**
 * THE LEVEL SWITCH IS ON THE STAGE, AND IT IS ONLY THERE IN THE MAIN STATE.
 *
 * Canon F2, 2026-08-30: *"fiber만 sarcomere ↔ 다른 레벨 전환이 있다 … Gizmos식
 * 토글도 제발 main 화면 안에 디자인 ㅈㄴ 잘 입혀서 floating하게 어딘가에 두는걸
 * 목표로 해."* It lived in `FiberControls`, portalled into the shell's drawer,
 * which is the one place a first-time visitor does not look — and it is the
 * only control in the descent that swaps the OBJECT rather than the playback.
 *
 * Canon §0 is the other half and it is the half a source test can hold: this
 * scale has a guided-tour state and a main state, and the floating toggle
 * belongs to the second. `tourOn` is the latch — true from arrival, false when
 * the pass ends or a viewer stops it — so the gate is that the switch's render
 * is conditioned on it. A switch that drew through the pass would put a control
 * beside a beat that is mid-sentence about something else.
 *
 * Source text rather than a browser, for `fiberChrome`'s own reason: this file
 * exists to pin arrangements, and half of what it pins is an absence.
 */
test("the scale switch floats on the stage and hides during the pass", () => {
  /* SCOPED TO THE PANEL, AND IT USED TO BE THE WHOLE FILE.
     The ban is on handing the level SETTER to a control that renders into the
     shell's drawer — that is what canon F2 is about, and `FiberControls` is
     that control. A bare `/onLevel=/` over the file said the same thing for as
     long as the panel was the only thing that could want one.
     It is not, since 2026-09-05: the guided pass descends through three models,
     so `FiberScene` takes an `onLevel` to ASK for a level the way it already
     takes `onIntro` to report a stage. That is the storyboard reaching for the
     thing it is a storyboard of, not a switch in a drawer, and a regex that
     cannot tell them apart bans the wrong one. The first version of this case
     banned `level=` too and went red on the scene's own render for the mirror
     of this reason. */
  const controls = viz.match(/<FiberControls[\s\S]*?\/>/g) ?? [];
  const inDrawer = controls.filter((el) => /onLevel=/.test(el));
  assert.deepEqual(
    inDrawer,
    [],
    "the level switch is being handed back to `FiberControls`, which renders into the shell's " +
      "drawer; canon F2 puts it on the picture it changes",
  );
  assert.ok(
    /className="fiber-levels"/.test(viz),
    "nothing on the fibre stage switches level — the drawer chips went and nothing replaced them",
  );
  /* THE LATCH IS THE RUNNING PASS, AND `tourOn` IS NOT IT — 2026-09-04.
     This pinned `showControls && !tourOn`, which was right when `stage === "tour"`
     was how a pass ran. Canon D2ⓐ made the pass a PART's demonstration and left
     `stage` at "main" throughout, so `tourOn` is false for every pass this scale
     actually plays and the ladder stood on the stage through all of them.
     Measured in a browser before this was changed: five plates folded to one, a
     sentence on the stage, and the switch still up.
     Canon §0 is unchanged and is what both versions are for — the pass gets the
     showing, the main state gets the touching. What changed is which name means
     "a pass is running". `FiberScene` reports it; `passRunning` holds it. */
  /* AND NOT WHILE SILENT EITHER — 2026-09-06. The owner's arrival grammar puts
     a plain contraction BEFORE the pass with *"toggle이고 뭐고 없어"*, and the
     ladder is a toggle. `!tourOn` covered one of the two stages before main;
     `stage === "main"` names the one stage the toggle belongs to. */
  assert.ok(
    /stage === "main" && !passRunning && !leaving && \(/.test(viz),
    "the floating scale switch is drawn outside main; the owner's first two stages have no toggles " +
      "and canon §0 gives the toggle to the main state",
  );
  assert.equal(
    /LEVEL_ORDER/.test(readFileSync(new URL("./FiberControls.jsx", import.meta.url), "utf8")),
    false,
    "`FiberControls` is drawing the scale chips again; two switches for one level is two places " +
      "for the lit one to disagree",
  );
});


/**
 * THE ARRIVAL IS THREE STAGES ON THIS FLOOR TOO — owner, 2026-09-06: a plain
 * lap, then the pass, then main with the toggles. Here the lap is *"수축 한 번"*
 * at the level you arrive at, its own length — *"fiber말고는 이해하지?"* — which
 * is the ONE PULL window read off the scenario (0.65 s at a fifth speed), not
 * five seconds. Skip lands in main, and main is the sarcomere.
 *
 * Measured 1280x800: 0–3.3 s Skip only, no ladder, no bubble; 3.3 s beat 0;
 * 89.2 s the hand-over with the ladder. Skip at 1.5 s: main and the ladder at
 * 1.6 s and nothing behind it. The first cut of the skip re-armed the lap —
 * the level change it makes read as a new arrival — and that is what
 * `handingOver` is for.
 */
test("the plain contraction runs first, its own length, and its Skip lands in main", () => {
  const fs = readFileSync(new URL("./FiberScene.jsx", import.meta.url), "utf8");
  assert.match(fs, /\(\(runWindow\.to - runWindow\.from\) \/ runWindow\.speed\) \* 1000/, "the lap's length is typed instead of read off the ONE PULL window");
  assert.match(fs, /beats\.length && lap \? lap : SILENT_MS/, "the plain contraction no longer precedes the pass");
  assert.match(fs, /if \(!skipIntro\) return;[\s\S]{0,80}setStage\("main"\)/, "Skip during the plain contraction no longer lands in main");
  assert.match(fs, /handingOver\.current = true;[\s\S]{0,40}onLevel\?\.\("sarcomere"\)/, "the skip's own level change will re-arm the lap again");
  assert.match(viz, /holdTour\(\{ id: "intro", skip: \(\) => setSkipIntro/, "the page no longer holds Skip during the plain contraction");
});
