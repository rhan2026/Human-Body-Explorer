import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadScenario } from "../scenarioData.js";
import { cameraStops, stepsOf, tourLength } from "../tour.js";
import { SCENARIOS, SEPARATION, drawnAt, routesOf, secondsPerMinute } from "./signallingBinding.js";
import { ARMS_FUSE_BELOW } from "./signallingGeometry.js";
import { RUN_SECONDS_PER_SECOND, signallingTour } from "./signallingTour.js";

/**
 * THE GATE THIS FILE EXISTS FOR: A LINE MAY NOT POINT THE OTHER WAY FROM ITS
 * NUMBER — the same discipline `fiberTour.test.js` is named for, asked of a
 * storyboard whose claims are about two arms rather than one store.
 *
 * A beat is a window over the run: `[seek, seek + speed * RUN_SECONDS_PER_SECOND *
 * ms/1000]`, in the scale's own seconds, at the rate its frame loop actually steps
 * the clock. The shipped series is read across that window — through `drawnAt`,
 * the same producer the screen draws from — and asked to do what the line says.
 *
 * THE ONE THAT IS NOT FREE, AND IS WHY THIS FILE IS NOT CEREMONY. "The two bouts
 * arrive together" is true at every instant of this run, including the first one,
 * where it is true because nothing has happened yet: at t = 0 all twelve gaps are
 * exactly 0.0000 and all twelve outputs are exactly where they started. A gate
 * that only checked the gap would pass a pass whose conclusion is parked on an
 * unstarted network. So the arrival is checked in two halves — the pairs are one
 * mark AND the outputs have travelled several times further than the pair gap
 * since the run's first sample — and it is the second half that costs the beat
 * its freedom to sit anywhere.
 */

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(`../../public${path}`, import.meta.url), "utf8"));

const ARMS = {
  resistance: await loadScenario(SCENARIOS.resistance, readJson),
  endurance: await loadScenario(SCENARIOS.endurance, readJson),
  control: await loadScenario(SCENARIOS.control, readJson),
};
const ROUTES = routesOf(ARMS);
const PROTOCOL = ARMS.resistance.protocol;
/** The run's last instant, in the seconds the scene's clock counts in. */
const RUN_SECONDS = ARMS.resistance.grid.tEnd * secondsPerMinute;
const BEATS = signallingTour(PROTOCOL, ROUTES, RUN_SECONDS);

/** What the scene draws at `t`, off the same bytes and the same function. */
const at = (t) => drawnAt(ARMS, ROUTES, t);
/** How much of the run a beat covers, at the rate the frame loop steps the clock. */
const windowOf = (beat) => (beat.speed ?? 1) * RUN_SECONDS_PER_SECOND * (beat.ms / 1000);
/** The furthest any one node moved between two frames of a band. */
const spread = (a, b) => a.reduce((w, v, i) => Math.max(w, Math.abs(v - b[i])), 0);
/** `steps + 1` frames across a beat's window, clamped to the archive. */
const walk = (beat, steps = 20) => {
  const span = windowOf(beat);
  return Array.from({ length: steps + 1 }, (_, i) =>
    at(Math.min(beat.seek + (span * i) / steps, RUN_SECONDS)),
  );
};
const find = (re) => {
  const beat = BEATS.find((b) => re.test(b.line ?? ""));
  assert.ok(beat, `no beat matches ${re}, so the test below is watching nothing`);
  return beat;
};

test("the shipped run is the one this storyboard was written against", () => {
  assert.equal(ARMS.resistance.grid.t0, 0);
  assert.equal(RUN_SECONDS, 44.9 * secondsPerMinute, "the archive's last sample moved");
  assert.ok(PROTOCOL.bout_minutes > 0, "the bout length this pass's last beat depends on is gone");
  assert.ok(BEATS.length > 0, "the shipped export builds no pass at all");
});

test("no protocol, no routes, no run — a storyboard on undefined would seek to NaN", () => {
  assert.deepEqual(signallingTour(undefined, ROUTES, RUN_SECONDS), []);
  assert.deepEqual(signallingTour(PROTOCOL, undefined, RUN_SECONDS), []);
  assert.deepEqual(
    signallingTour(PROTOCOL, { ...ROUTES, doors: undefined }, RUN_SECONDS),
    [],
    "an export with no edge list lights no fan, and three beats of this pass are about the fan",
  );
  /* `null >= 0` IS TRUE IN JAVASCRIPT and that exact trap shipped on the fibre
     scale. Here a null run length would build a last beat that seeks to null —
     which is zero — so the pass would end on the same unstarted picture it opened
     on, under a line about where the two bouts arrived. */
  assert.deepEqual(signallingTour(PROTOCOL, ROUTES, null), []);
  assert.deepEqual(signallingTour(PROTOCOL, ROUTES, 0), []);
  /* A run longer than the bout puts this pass's conclusion somewhere the input is
     no longer on, without a line of the storyboard changing. */
  assert.deepEqual(
    signallingTour({ ...PROTOCOL, bout_minutes: 1 }, ROUTES, RUN_SECONDS),
    [],
    "a run that outlasts the bout still gets a pass that narrates its end as the bout's",
  );
});

test("the camera moves, which is the whole correction this pass is", () => {
  assert.ok(
    cameraStops(BEATS).length >= 3,
    `the pass has ${cameraStops(BEATS).length} framings; two is a cut and one is the slideshow this replaced`,
  );
  /* CLOSING WHERE IT OPENED IS NOT THE FAILURE THIS WAS GUARDING. The assertion
     used to forbid it, and then a design review made the conclusion return to
     the wide framing ON PURPOSE: that beat says the two bouts arrive as one mark,
     and the only thing that teaches a viewer to read a two-colour lump as one is
     a pair that is visibly two — which lives above the outputs band and was out
     of frame at the close shot. Coming back to the opening is what makes the
     ending a comparison with the beginning.
     What the case is actually about is that the camera MOVES. Three distinct
     framings is that, and the middle of the pass has to be somewhere other than
     the ends — a storyboard that opens wide, stays wide and closes wide would
     pass the count above by reusing two shots elsewhere. */
  const middle = BEATS.slice(1, -1).map((b) => (b.camera ?? []).join(","));
  assert.ok(
    middle.some((c) => c && c !== (BEATS[0].camera ?? []).join(",")),
    "every beat between the first and last is framed exactly like the first — the camera never leaves",
  );
});

test("every beat seeks somewhere the archive actually has", () => {
  for (const beat of BEATS) {
    assert.ok(
      beat.seek >= 0 && beat.seek <= RUN_SECONDS,
      `"${beat.line}" seeks to ${beat.seek} s, outside the archive's 0–${RUN_SECONDS} s`,
    );
  }
});

test("no beat inherits its clock or its chip", () => {
  /* Two ways the same defect: a beat with no `seek` shows whatever the beat
     before it left on the clock, and a beat with no `arm` shows whatever the
     viewer had pressed before the pass started. Both make the picture a function
     of something other than the beat. */
  for (const beat of BEATS) {
    assert.equal(typeof beat.seek, "number", `"${beat.line}" starts wherever it happens to be`);
    assert.ok(
      ["resistance", "endurance", "both"].includes(beat.arm),
      `"${beat.line}" draws whichever arm the viewer left the chips on`,
    );
  }
});

test("the beat that shuts one door is measured on both halves of what it says", () => {
  const beat = find(/stays on its tick/i);
  /* The line has to name the arm the beat draws, or the two checks below are
     measuring a column the sentence is not about. */
  assert.match(beat.line, new RegExp(beat.arm, "i"), "the line names an arm the beat does not draw");

  const own = beat.arm === "resistance" ? "resistanceOnly" : "enduranceOnly";
  const other = beat.arm === "resistance" ? "enduranceOnly" : "resistanceOnly";
  const lane = beat.arm === "resistance" ? "r" : "e";
  const frames = walk(beat);
  /* AGAINST THE TICK, NOT AGAINST THE FIRST FRAME, and the difference is the
     whole assertion. "Stays on its tick" is a statement about where a mark sits
     relative to the no-exercise control drawn under it — the `c` lane, the flat
     tick in `signallingGeometry.js` — and not about how much it happened to move
     during these four and a half seconds. Measured against the window's own first
     frame instead, a column shifted bodily off its tick reads as perfectly still
     and the sentence passes over a picture that contradicts it. Probed
     2026-08-26: +0.5 on an endurance-only node left the first version green. */
  const off = (frame, band) => spread(frame.bands[band][lane], frame.bands[band].c);

  const moved = frames.reduce((w, f) => Math.max(w, off(f, own)), 0);
  assert.ok(
    moved > SEPARATION * 4,
    `"${beat.line}" covers ${beat.seek.toFixed(0)}–${(beat.seek + windowOf(beat)).toFixed(0)} s, over ` +
      `which its own column's loudest node never gets further than ${moved.toFixed(4)} from the tick under ` +
      `it. Nothing a viewer can see happens under a line saying this arm moves it.`,
  );
  const drift = frames.reduce((w, f) => Math.max(w, off(f, other)), 0);
  assert.ok(
    drift < SEPARATION,
    `the column this beat calls still leaves its tick by ${drift.toFixed(4)} inside the window, past the ` +
      `${SEPARATION} this screen calls a difference. The sentence is only true early: by the end of the ` +
      `run that column has drifted 0.05, which is where the bucket that defines it stops holding.`,
  );
});

test("the trunk beat runs over a window where the trunk is still moving", () => {
  const beat = find(/trunk|same middle/i);
  const frames = walk(beat);
  const [first] = frames;
  for (const lane of ["r", "e"]) {
    const moved = frames.reduce((w, f) => Math.max(w, spread(f.bands.shared[lane], first.bands.shared[lane])), 0);
    assert.ok(
      moved > SEPARATION,
      `"${beat.line}" says both columns feed this band, and over its own window the ${lane} arm moves it ` +
        `${moved.toFixed(4)} — a still band under a line about being fed.`,
    );
  }
});

test("the beat that says the two bouts land together is parked where they have arrived", () => {
  const beat = find(/one mark|nearly match/i);
  assert.equal(beat, BEATS.at(-1), "the pass no longer ends on its own point");

  /* HALF ONE: they are together, in the picture's own terms. `SEPARATION` is what
     the panel calls a difference and `ARMS_FUSE_BELOW` is where two marks stop
     overlapping — the line says "one mark", so the second is the binding one. */
  for (const frame of walk(beat, 8)) {
    assert.ok(
      frame.widestOutputGap < ARMS_FUSE_BELOW,
      `at ${frame.tMinutes} min the widest of the twelve gaps is ${frame.widestOutputGap.toFixed(4)}, ` +
        `wider than the ${ARMS_FUSE_BELOW.toFixed(4)} at which two marks separate. The line says one mark ` +
        `and the picture draws two.`,
    );
    assert.ok(frame.widestOutputGap < SEPARATION, "the gap is past what this screen calls a difference");
  }

  /* HALF TWO, AND IT IS THE ONE WITH TEETH. At the run's first sample all twelve
     gaps are 0.0000 — the two bouts "arrive together" there in the sense that
     neither has gone anywhere. So the outputs must have TRAVELLED, by several
     times the gap that is left between the arms, or this beat is narrating an
     arrival at a network that has not moved. Probed by re-seeking this beat: at
     10 min the travel is 0.0095 against a gap of 0.0059 and this fails. */
  const start = at(0);
  const end = walk(beat, 8).at(-1);
  const travel = spread(end.bands.outputs.r, start.bands.outputs.r);
  assert.ok(
    travel > end.widestOutputGap * 2,
    `"${beat.line}" parks at ${end.tMinutes} min, where the twelve outputs have travelled ${travel.toFixed(4)} ` +
      `from the run's first sample and the two arms are ${end.widestOutputGap.toFixed(4)} apart. Coinciding ` +
      `because nothing has happened yet is not an arrival.`,
  );
});

test("the pass hands the chip back", () => {
  assert.ok(
    new Set(BEATS.map((b) => b.arm)).size >= 2,
    "no beat turns the arm chip, so the pass never shows a door being shut",
  );
  assert.equal(
    BEATS.at(-1).arm,
    BEATS[0].arm,
    "the pass ends holding a chip it did not open on; whatever the viewer sees last is not what it started with",
  );
});

test("the concluding beat is held, not played through", () => {
  /* The fibre pass learned this in a browser: parked on its point and left
     playing, the picture had moved off the sentence by the time the sentence had
     been read. Here it is worse than drifting — `runLoop.js` holds at `tEnd` and
     then cuts the whole network back to its baseline, so a last beat that spent
     its clock would end the pass on an unstarted network. */
  assert.equal(BEATS.at(-1).speed, 0, "the run plays on through the conclusion, away from the thing it concludes");
  assert.equal(windowOf(BEATS.at(-1)), 0);
});

test("no line prints a count it did not derive", () => {
  const lines = BEATS.map((b) => b.line ?? "");
  const spoken = lines.join(" ");
  /* INVERTED ON 2026-08-30 (T13). This required every band count to be spoken;
     the owner took the figures out of the UI and six counts had survived inside
     these lines. The claim now runs the other way: the pass teaches in
     beginner words and prints no count at all. The guards in the tour still
     USE the counts to refuse an unlit pass — that is data, not display. */
  assert.ok(!/\b\d+\b/.test(spoken), `a pass line still prints a number: "${spoken.match(/[^.]*\b\d+\b[^.]*/)?.[0]}"`);
  /* THE TRAP THIS SCALE ALREADY RECORDED. The archive ships 264 arrows and the
     paper quotes 259 interactions for its own table; they answer different
     questions (`scenarioData.js`), and a line that printed either would be
     attributing our count to the authors or theirs to our picture. */
  assert.ok(!/\b(259|264)\b/.test(spoken), "a line quotes an interaction count");
});

test("the pass is long enough to follow and short enough to sit through", () => {
  const ms = tourLength(BEATS);
  assert.ok(ms > 12_000 && ms < 45_000, `the pass runs ${(ms / 1000).toFixed(1)} s`);
});

/**
 * THE OPENING SAYS WHY IT IS ONE COLOUR.
 *
 * At t = 0 every pair in this network coincides, so the scene draws in one arm's
 * colour while both arm swatches sit in the legend. Honest — they are identical
 * — and a viewer reading it cold has no way to know that. The line carries it
 * now, and this asserts the line is TRUE of the instant it opens on rather than
 * merely present: a re-export where the two bouts start apart would make it a
 * claim about a frame that does not show it.
 */
test("the opening's claim that both bouts start together is true of its own instant", () => {
  const first = BEATS[0];
  assert.match(first.line, /start on the same mark|start together/i, "the opening stopped explaining its own colour");
  const at = drawnAt(ARMS, ROUTES, first.seek);
  assert.equal(
    at.separating,
    0,
    `${at.separating} of the drawn pairs are already apart at ${first.seek} s, so "both bouts start on ` +
      `the same mark" is a claim about a frame that does not show it`,
  );
});

/**
 * The pass asks before it answers, and this is the one place in the app that does.
 *
 * Q17 counted the interactive controls a viewer can reach on the four scales —
 * 74 — and none of them asks anything: 28 move the clock, 21 open a record, 13
 * navigate, 11 change what is drawn. `ask.js` says out loud that "there is no
 * answer string anywhere below"; its four questions are answered by navigating
 * to an instant, never by the viewer having committed to something first.
 *
 * Beats 1 through 6 build one expectation and build it well — two bouts, nine
 * doors against six with four shared, two separate columns, then one trunk —
 * and anybody following it arrives at the outputs expecting two endings. The
 * last beat says there is one. That is this scale's whole point and it was
 * being announced rather than answered.
 *
 * So the beat before it ends in a question. Losing the question turns the
 * surprise back into a statement, which is a thing no other gate here would
 * notice, because every line would still be true.
 */
test("the beat before the pass's answer asks for it", () => {
  const answer = find(/one mark|nearly match/i);
  assert.equal(answer, BEATS.at(-1), "the answer is no longer last");

  const asks = BEATS[BEATS.indexOf(answer) - 1];
  assert.ok(asks, "there is no beat before the answer");
  assert.match(
    asks.line,
    /\?\s*$/,
    `the beat before "${answer.line}" is "${asks.line}" — it states where it should ask, and the ` +
      `last beat goes back to being an announcement`,
  );

  // The question has to be about the thing the answer is about, or it is
  // decoration parked next to a surprise.
  /* THE VOCABULARY MOVED WITH THE PASS (T13): the answer beat now says "at the
     far end" rather than "outputs", so the question naming the same thing means
     matching the new words. The claim — question and answer are about one
     subject — is unchanged. */
  assert.match(asks.line, /outputs|end the same/i, "the question does not name what the answer names");

  /* AND THE ANSWER SAYS WHERE THE SPLIT DID LAND. A viewer who answered
     "different" is not simply wrong: seventeen of the fifty-eight shared nodes
     are apart at this instant and nineteen of the twenty-five separated pairs
     sit above the outputs band, which is why the beat's framing is as wide as it
     is. Without that clause the surprise reads as a correction instead of a
     location, and CLAUDE.md §5 is explicit that a comparison which does not line
     up is shown with the place it comes apart, not simply overruled. */
  /* "UPSTREAM" BECAME "NEAR THE DOORS" in T13's beginner rewrite — the same
     location, said in the pass's own established word (the doors are beats 2-4).
     The claim is unchanged: the answer names where the split lives. */
  assert.match(
    answer.line,
    /upstream|near the doors/i,
    `"${answer.line}" tells a viewer they were wrong and not where they were right`,
  );

  /* NO NUMBER IN EITHER LINE BEYOND THE ONES ALREADY INTERPOLATED. The trunk
     plate counts the split at this same instant; `SignallingScale.jsx`'s header
     is the rule — one quantity, one root, because two roots commit separately
     and can differ by a tick. */
  const typedCounts = (answer.line.match(/\b\d+\b/g) ?? []).filter((n) => n !== String(ROUTES.outputs.length));
  assert.deepEqual(typedCounts, [], `the answer types counts the plates already carry: ${typedCounts}`);
});

/**
 * WHAT A VISITOR CAN PRESS, AND WHAT THE SET COSTS.
 *
 * Canon D2ⓐ turns the beats about one part into that part's demonstration,
 * started by a ring standing on it. `stepsOf` reads the cut; this asserts the
 * cut, because on this scale it is not simply "one ring per focus" and both
 * departures were paid for.
 *
 * THE OPENER. Every beat here carries a focus, so without `part: null` on the
 * first one the scale had no opener and the sentence that says what the picture
 * IS — the only one canon G1 is about, on the scale canon S1 says nobody can
 * read — was the doors' first half.
 *
 * THE OUTPUTS. The last beat opens on "Almost.", replying to the trunk beat's
 * question. Cut on focus they land in different piles: the trunk ends on a
 * question nothing answers and the outputs open on an answer to a question
 * nobody asked. So the answer joins the question, and the outputs band has a
 * plate and no ring.
 *
 * AND THE PAIR IS THE SECOND HALF OF THE TOUR, NOT A FOURTH PART — 2026-08-31,
 * the owner's *"Main → Tour (각자 설명, 같이 이뤄져서 뭐가 일어나는지 설명) →
 * Main"*. "Different doors, the same middle" is what happens when the two paths
 * act TOGETHER; it is not a fact about a part the way the two splits and the
 * doors are. So the pair moved from `part: "trunk"` to `part: TOGETHER` whole —
 * the pairing this file already asserted is untouched — and the trunk anchor
 * gives up its ring to the finale's own control, which stands on it.
 */
test("the pass cuts into the parts a visitor can press", () => {
  const { opener, steps, finale } = stepsOf(BEATS);
  assert.deepEqual(
    opener.map((b) => b.line),
    [BEATS[0].line],
    "the beat that names the whole picture is not the opener, so it is behind a press",
  );
  assert.equal(opener[0].focus, "doors", "the opener stopped pointing its beacon anywhere");
  assert.deepEqual(
    steps.map((s) => s.id),
    ["split-resistance", "split-endurance", "doors"],
    "the set of rings changed",
  );
  assert.match(finale[0].line, /Do they end the same\?$/, "the finale stopped opening on the question");
  assert.match(finale.at(-1).line, /^Almost\./, "the question and its answer were sorted apart again");
  assert.equal(finale.at(-1).focus, "outputs", "the answer stopped pointing at the band it is about");
  assert.equal(finale[0].focus, "trunk", "the question stopped pointing at the middle it is about");
  for (const id of ["trunk", "outputs"]) {
    assert.equal(
      steps.find((s) => s.id === id),
      undefined,
      `a ring on ${id} would open on half of the pass's ending`,
    );
  }
});
