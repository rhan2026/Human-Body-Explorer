import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { beatAt, cameraStops, stepsOf, TOGETHER, tourLength } from "./tour.js";

/**
 * The player, away from React.
 *
 * `beatAt` is where every timing bug in a guided pass ends up, so it is a pure
 * function of the storyboard and a number — the same argument `gizmoLayout.js`
 * makes about itself. A solver inside a component is a solver nobody can put a
 * number to.
 */

const BEATS = [
  { ms: 1000, camera: [0, 0, 5], line: "one" },
  { ms: 2000, camera: [1, 1, 3], line: "two" },
  { ms: 500, camera: [0, 0, 5], line: "three" },
];

test("a beat lasts exactly as long as it says, and the next one starts there", () => {
  assert.equal(beatAt(BEATS, 0).index, 0);
  assert.equal(beatAt(BEATS, 999).index, 0);
  // The boundary belongs to the beat that starts on it. Off by one here shows
  // up as a line that flashes the wrong sentence for one tick every beat.
  assert.equal(beatAt(BEATS, 1000).index, 1);
  assert.equal(beatAt(BEATS, 2999).index, 1);
  assert.equal(beatAt(BEATS, 3000).index, 2);
  assert.equal(beatAt(BEATS, 3499).index, 2);
});

test("past the end there is no beat, which is how the scene is handed back", () => {
  assert.equal(beatAt(BEATS, 3500), null);
  assert.equal(beatAt(BEATS, 99_999), null);
  // And a pass with nothing in it never starts, rather than starting empty.
  assert.equal(beatAt([], 0), null);
  assert.equal(beatAt(null, 0), null);
  assert.equal(beatAt(BEATS, -1), null);
});

test("`into` says how far through a beat we are, for anything that eases", () => {
  assert.equal(beatAt(BEATS, 1500).into, 500);
  assert.equal(beatAt(BEATS, 1500).start, 1000);
});

test("the length is the sum, so the chrome knows how long to stay down", () => {
  assert.equal(tourLength(BEATS), 3500);
  assert.equal(tourLength([]), 0);
});

/**
 * THE ONE THAT IS ABOUT THE POINT RATHER THAN THE MECHANICS.
 *
 * What shipped before this file existed was a set of plates: every number moved
 * out of the panel and onto the thing it counted, and the screen stayed still.
 * The owner's correction was that the screen has to MOVE — *"막 줌인 되고
 * 줌아웃되고"* — and a storyboard that never changes its camera is the old
 * failure wearing a timer. Two stops is a cut; three is a pass.
 */
test("a storyboard whose camera never moves is a slideshow", () => {
  assert.equal(cameraStops(BEATS).length, 2, "two distinct framings, and the third repeats the first");
  assert.equal(cameraStops([{ ms: 1, camera: [0, 0, 5] }, { ms: 1, camera: [0, 0, 5] }]).length, 1);
  assert.deepEqual(cameraStops([]), []);
});

/**
 * A BEAT'S SPEED HAS TO REACH THE FRAME LOOP IN THE FRAME THE BEAT STARTS.
 *
 * The scenes drove the run at a speed carried in React state, set from
 * `onSpeed`. State lands on the next render, so between a beat's SEEK and its
 * SPEED there was one frame at the previous beat's speed — and one frame at 1x
 * is 16 ms of run time.
 *
 * Measured end to end on the fibre pass: the conclusion's first frame parks at
 * 1.296 s, four milliseconds before the third burst, and that one tick carried
 * it to 1.311 — into the release. The store read 0.261 of full under "after one
 * repetition the store came back to here" against 0.476 under "after ten, only
 * to here". The comparison was inverted on screen, while both beats HELD
 * measured correctly, which is why eight rounds of per-beat stills never saw it.
 *
 * This pins the shape rather than any one scene: the player must hand out the
 * beat itself, so a scene can read the speed synchronously instead of waiting a
 * render for it.
 */
test("the player hands out the beat, so a scene never runs a frame at the last one's speed", async () => {
  const beats = [
    { ms: 1000, camera: [0, 0, 5], speed: 1, seek: 0 },
    { ms: 1000, camera: [1, 1, 3], speed: 0, seek: 5 },
  ];
  const second = beatAt(beats, 1000);
  assert.equal(second.beat.speed, 0, "the beat carries its own speed and a caller can read it now");
  assert.equal(second.beat.seek, 5, "and its own seek, so the two arrive together or not at all");

  /* AND EVERY SCENE HAS TO ACTUALLY READ IT. The first version of this test
     asked only whether the player could hand the beat over, which it always
     could — the defect was three scenes not taking it. Read off the source the
     way `signallingClaims.test.js` reads its claims: a scene that steps its run
     from React state alone is a scene one render behind its own storyboard. */
  const { readFile } = await import("node:fs/promises");
  for (const file of ["./fiber/FiberScene.jsx", "./cell/CellScale.jsx", "./signalling/SignallingScale.jsx"]) {
    const src = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(
      src,
      /(tour\.)?beat\??\.?\.speed/,
      `${file} never reads the beat's own speed, so between a beat's seek and its speed it runs one ` +
        `frame at the previous beat's — 16 ms at 1x, which is enough to cross a burst`,
    );
  }
});

/**
 * The pass may not report an ending before it has had a beginning.
 *
 * `at` is undefined in two different situations and they mean opposite things:
 * after the last beat, and BEFORE THE FIRST. Every scale builds its beats from
 * a scenario it is still fetching, so the first render of a cold page has no
 * current beat — and the effect that says "the line is gone" fired in both.
 *
 * All three scales latch on that signal: `if (line === null) setTourOn(false)`.
 * Correct for an ending, fatal for a beginning. Measured Q17 R10 on the fibre:
 * the FIRST page load in a fresh browser lost the race 1 time in 8 — beats
 * built, clock running, `again` already offered, and not one sentence ever
 * shown. A test opens exactly one cold page, which is why `gate-the-ride`'s
 * "moving between deep scales" timed out at 60 s waiting for a sentence that
 * had been cancelled before it existed.
 *
 * Asserted against the source, the way `signallingClaims.test.js` holds its own
 * cross-file invariants: the hook is a hook and this file tests pure helpers,
 * and the property worth keeping is one line of reasoning rather than one
 * behaviour that needs a browser and a cold cache to show itself.
 */
test("the null line is only sent once a beat has actually fired", async () => {
  const source = await readFile(new URL("./tour.js", import.meta.url), "utf8");

  /* The guard CONDITION, not the statement's exact shape — Q20 R2 grew the
     body (it dispatches PASS_ENDED beside the null), and a pin on the one-line
     form failed a change that kept the property. The property is that both the
     null and anything sent with it sit behind `!at && lastBeat.current >= 0`. */
  const guard = /if \(!at && lastBeat\.current >= 0\) \{?[\s\S]{0,600}?onLine\?\.\(null\)/;
  assert.match(
    source,
    guard,
    "the end-of-pass report is no longer guarded by a beat having fired, so a scale that is still " +
      "fetching its scenario will be told its pass is over before it starts",
  );

  // `lastBeat` has to start below zero or the guard is always true.
  assert.match(source, /const lastBeat = useRef\(-1\);/, "lastBeat no longer starts before the first beat");

});

/**
 * A SENTENCE A VISITOR EARNED BY PRESSING SOMETHING DOES NOT VANISH.
 *
 * Canon D2ⓐ's last clause — *"글은 그 뒤에 짧게"* — is about a line that ARRIVES
 * after the picture has answered. Under the pass it was the opposite: a
 * demonstration ended by handing back `null` and all three scales wrote that
 * straight into the sentence, so the words appeared for their beats and then the
 * screen went back to saying nothing. Pressing a part and being left with a
 * blank foot is the shape of a control that did not work.
 *
 * So `null` means "nothing more to say", never "unsay it". What replaces a
 * sentence is the next sentence, which is another press.
 *
 * `setTourOn(false)` went with it, and the two are one change: `tourOn` answered
 * "has this screen already shown its pass", and there is no pass to have shown.
 * It is now only whether the arrival introduction is still running (canon D5),
 * which is a fact about arriving rather than about what anybody pressed.
 */
test("no deep scale wipes its sentence when a demonstration ends", async () => {
  for (const path of [
    "./fiber/MuscleFiberVisualization.jsx",
    "./cell/CellScale.jsx",
    "./signalling/SignallingScale.jsx",
  ]) {
    const consumer = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(
      consumer,
      /if \(line === null\) setTourOn\(false\);/,
      `${path} still latches its pass off on a null line, which is the pass model canon D2ⓐ replaced`,
    );
    /* THE PROPERTY, NOT ONE SPELLING OF IT — and this comment said so already
       while the regex below still pinned a spelling. It was widened once when
       the fibre grew a second statement beside the setter, and it went red
       again on 2026-09-05 for a floor that states the rule the OTHER WAY ROUND.
       ENERGY guards the inverse: `if (line === null && /^Test it yourself/…)
       return;` — it refuses exactly one null, the invitation its controls
       appear under, and lets every other line leave with its pass because that
       floor's state 4 is wordless (*"아무런 텍스트 없이"*). That is more careful
       than "never write a null", not less, and the gate failed it for the shape
       of the if.
       WHAT IS ACTUALLY BEING HELD is that a null is CONSIDERED before it reaches
       the setter. A floor that pipes `setTourLine(line)` straight through has no
       way to keep a sentence a visitor still needs, whatever it intended; a
       floor that tests for null near the setter has made a decision, and which
       decision is that floor's to make. The absence test above — no latching the
       pass off on a null — is unchanged and is the half that catches the model
       this replaced. */
    assert.match(
      consumer,
      /line (?:!==|===) null[\s\S]{0,300}?setTourLine\(line\)/,
      `${path} writes a null line into the sentence without ever testing for one, so the words a ` +
        "visitor pressed for are wiped a moment after they arrive",
    );
  }
});

/**
 * A STORYBOARD IS ALREADY CUT INTO PARTS; `stepsOf` only reads the cut.
 *
 * Canon D2ⓐ turns the beats about one part into that part's demonstration,
 * started by a press instead of by a clock. Every beat already carries `focus`,
 * so nothing here is a new authoring surface — which is the point: the lines,
 * the seeks and the camera stops that were argued over stay exactly as written.
 */
test("stepsOf groups a storyboard by the part each beat is about", () => {
  const { opener, steps } = stepsOf([
    { line: "wide" },
    { focus: "myosin", line: "a" },
    { focus: "actin", line: "b" },
    { focus: "sr", line: "c" },
    { focus: "sr", line: "d" },
    { focus: "myosin", line: "e" },
  ]);
  assert.equal(opener.length, 1, "the focus-less beat is the opener, not a part");
  assert.deepEqual(
    steps.map((s) => s.id),
    ["myosin", "actin", "sr"],
    "a part takes the position of its FIRST beat, so the rings read in the order the pass walked",
  );
  assert.deepEqual(
    steps.find((s) => s.id === "myosin").beats.map((b) => b.line),
    ["a", "e"],
    "beats about one part gather even when the storyboard returns to it later",
  );
});

test("stepsOf on an unbuilt storyboard is empty rather than undefined", () => {
  const { opener, steps } = stepsOf([]);
  assert.deepEqual(opener, []);
  assert.deepEqual(steps, []);
});

/**
 * `focus` WAS DOING TWO JOBS AND ONE BEAT NEEDED THEM SEPARATED.
 *
 * The fibre's closing beat is the store's conclusion — the store's camera, the
 * store's second ceiling — and it carries no `focus` on purpose: its sentence
 * rules the store OUT, and a ring still burning on the store made "waste around
 * the strands" read as waste inside it. Grouping on `focus` alone filed it as an
 * opener, so pressing the store ended on a setup whose payoff was in another
 * pile.
 */
test("a beat can belong to a part without the picture pointing at it", () => {
  const { opener, steps } = stepsOf([
    { focus: "sr", line: "setup" },
    { part: "sr", line: "payoff" },
    { line: "wide" },
  ]);
  assert.deepEqual(
    steps.find((s) => s.id === "sr").beats.map((b) => b.line),
    ["setup", "payoff"],
    "a demonstration must end on its own conclusion, not on the beat before it",
  );
  assert.deepEqual(opener.map((b) => b.line), ["wide"], "only a beat with neither is an opener");
});

/**
 * AND THE SECOND HALF OF THE PASS BELONGS TO NO PART AT ALL.
 *
 * The owner specified the deep scales' cycle twice and made it exact on
 * 2026-08-31: *"Main -> Tour (각자 설명, 같이 이뤄져서 뭐가 일어나는지 설명) ->
 * Main(여기서 켜짐)"*. Two halves — each part explains itself, and then what
 * happens when they act together. Only the first half was reachable, because
 * `part` had two piles and the second half fitted neither: a beat about the
 * whole run is not the opener (the opener is what the scale says BEFORE anyone
 * presses) and it is not any one part's demonstration.
 *
 * So it filed itself under whichever part its camera happened to be on, and the
 * fibre shows what that cost: the answer to tropomyosin's question — "Burst
 * after burst, is that pull weaker?" — sat inside the t-tubule's demonstration,
 * so pressing tropomyosin asked and never told, and pressing the tubule told
 * without asking.
 */
test("stepsOf keeps the beats about the whole run out of every part's pile", () => {
  const { opener, steps, finale } = stepsOf([
    { line: "wide" },
    { focus: "sr", line: "the store" },
    { focus: "sr", part: TOGETHER, line: "together, and the picture still points at the store" },
    { part: TOGETHER, line: "together, pointing at nothing" },
  ]);
  assert.deepEqual(opener.map((b) => b.line), ["wide"]);
  assert.deepEqual(
    steps.find((s) => s.id === "sr").beats.map((b) => b.line),
    ["the store"],
    "a part's demonstration is what is about that part, and the conclusion is not",
  );
  assert.deepEqual(
    finale.map((b) => b.line),
    ["together, and the picture still points at the store", "together, pointing at nothing"],
    "the finale keeps the storyboard's order, and a beat still points wherever it pointed",
  );
  assert.ok(
    !steps.some((s) => s.id === TOGETHER),
    "the whole run is not a part, so it must never turn up as one — a ring is drawn per step id",
  );
});

test("stepsOf on an unbuilt storyboard has an empty finale, not a missing one", () => {
  assert.deepEqual(stepsOf([]).finale, []);
});

/**
 * AND ONE BEAT NEEDED THEM SEPARATED THE OTHER WAY ROUND.
 *
 * The signalling storyboard has no focus-less beat at all: its opening beat is
 * the wide one that names the picture — "Same cell as upstairs — now the orders
 * it sends" — and it carries `focus: "doors"` because the beacon has to land on
 * something while it plays. Grouped on `focus`, that scale had no opener, so the
 * one sentence saying what the whole picture IS (canon G1) was filed as the
 * first half of the doors' demonstration and shown only to whoever pressed the
 * doors. On the scale canon S1 says nobody can read, that is the sentence to
 * lose last.
 *
 * `part: null` — DECLARED, not absent. `beat.part ?? beat.focus` cannot express
 * this: nullish-coalescing reads a declared null as "not stated" and falls back
 * to the focus, which is the whole thing being overridden.
 */
test("a beat can point the picture at something and still belong to no part", () => {
  const { opener, steps } = stepsOf([
    { part: null, focus: "doors", line: "what this picture is" },
    { focus: "doors", line: "the doors" },
  ]);
  assert.deepEqual(
    opener.map((b) => b.line),
    ["what this picture is"],
    "a beat that declares no part is an opener even when the picture points somewhere",
  );
  assert.deepEqual(
    steps.find((s) => s.id === "doors").beats.map((b) => b.line),
    ["the doors"],
    "the opener was still swept into the part its beacon happened to sit on",
  );
});
