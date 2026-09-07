import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadScenario } from "./scenarioData.js";
import { FRAME_SLIP_MS, readingMs, WORDS_PER_SECOND } from "./tour.js";
import { fiberTour } from "./fiber/fiberTour.js";
import { cellTour } from "./cell/cellTour.js";
import { buildCellChainLevel } from "./cell/cellChainGeometry.js";
import { instantsOf, responseSpan } from "./cell/energyBinding.js";
import { signallingTour, RUN_SECONDS_PER_SECOND } from "./signalling/signallingTour.js";
import { SCENARIOS, routesOf, secondsPerMinute } from "./signalling/signallingBinding.js";

/**
 * A BEAT HAS TO BE ON SCREEN LONGER THAN ITS OWN SENTENCE TAKES TO READ.
 *
 * Eleven questions of a design audit had asked whether the passes tell the
 * truth, whether the camera has a reason, whether the change can be caught.
 * None of them asked the cheapest question there is, and measured 2026-08-27 it
 * was the one with the most failures in it: at 200 words a minute, with the
 * line's own 260 ms fade subtracted, TEN OF THE TWENTY-THREE BEATS across the
 * three passes replace their sentence before it can be finished.
 *
 * The worst is the cell scale's opening — fifteen words, "Most of the sensor is
 * already on. This run starts from a cell at rest.", on screen for 2.8 s where
 * it needs 4.8. A viewer's first sentence on that scale is taken away while
 * they are still in it. The fibre's "A burst fires — 0.1625 s of it." gets
 * 1.34 s of readable time for a 2.4 s sentence.
 *
 * WHY LENGTHENING AND NOT CUTTING. Both work and cutting is the house style —
 * §9's 비움 기본 — but a sentence that survived Q1 through Q5 is a sentence
 * somebody argued for, and lengthening loses nothing while cutting is a second
 * argument. Where a beat's `speed` is non-zero its ms cannot move alone: the
 * window it narrates is `[seek, seek + speed * ms/1000]`, so ms goes up and
 * speed comes down by the same factor and the window is untouched. Every window
 * assertion in the three tour tests still holds, which is how you can tell the
 * change is about pace and not about content.
 *
 * This does not gate the OTHER end. A beat with slack is not a defect — the
 * fibre's ten-repetition beat has four seconds of it and every second is the
 * thing it is showing.
 *
 * AND `ms` IS NOT WHAT A VIEWER GETS, which is the correction that came from
 * measuring the fix rather than trusting it. Real dwell, timed inside the page,
 * runs +83 to -83 ms around the declared value; the first version of this rule
 * had no budget for the bad end and two fibre beats it passed by 16 and 13 ms
 * came back at 2659 and 2969 on screen against requirements of 2684 and 2987.
 * `FRAME_SLIP_MS` is that spread rounded up and it comes off every beat here.
 */
const readJson = async (path) => JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));

/** The fade read off the stylesheet, so this cannot drift from the CSS. */
const CSS = await readFile(new URL("./fiber/fiber.css", import.meta.url), "utf8");
const FADE_MS = Number(CSS.match(/animation:\s*tour-line\s+(\d+)ms/)?.[1]);

const FIBER_RUN = JSON.parse(await readFile(new URL("../public/scenarios/soce_on.json", import.meta.url), "utf8"));
const P = FIBER_RUN.protocol;
const T = FIBER_RUN.series.t;
const SR = FIBER_RUN.series.Ca_SR_total;
const firing = (t) => {
  const k = Math.floor(t / P.cycle_s);
  return k < P.repetitions && t - k * P.cycle_s < P.stim_s;
};
const FIBER_FORCE = FIBER_RUN.series.force_relative;
const FIBER_PEAKS = [];
for (let k = 0; k < P.repetitions; k += 1) {
  let bi = null;
  for (let i = 0; i < T.length; i += 1) {
    if (T[i] < k * P.cycle_s || T[i] >= (k + 1) * P.cycle_s) continue;
    if (bi === null || FIBER_FORCE[i] > FIBER_FORCE[bi]) bi = i;
  }
  if (bi !== null) FIBER_PEAKS.push({ rep: k + 1, at: T[bi], frameAt: T[bi], force: FIBER_FORCE[bi] });
}
if (FIBER_PEAKS.length) {
  const phase = FIBER_PEAKS[0].at;
  for (const r of FIBER_PEAKS) r.frameAt = (r.rep - 1) * P.cycle_s + phase;
}

const CEILINGS = [];
for (let k = 1; k < P.repetitions; k += 1) {
  let best = null;
  for (let i = 0; i < T.length; i += 1) {
    const t = T[i];
    if (t < k * P.cycle_s || t >= (k + 1) * P.cycle_s || firing(t)) continue;
    if (best === null || SR[i] > SR[best]) best = i;
  }
  if (best !== null) CEILINGS.push({ rep: k + 1, at: T[best], value: SR[best] });
}

const CELL_BOUT = await loadScenario("ampk_francis_soce_on", readJson);
/* RETARGETED 2026-09-05, AND IT WAS GRADING NOTHING.
   `cellTour` is `energyTour` now — `(bout, anchors, instants, { span })` — and
   this file called it with the first two. The other two are guarded at the top
   of that function (`if (!at || !grid || !inst || !(span > 0)) return []`), so
   the pass came back EMPTY and the assertion beneath the loop is the only
   reason anyone noticed: "cell built no storyboard, so this test is watching
   nothing" is what a silent green would have looked like without it. The fibre
   entry two lines down carries the same warning about its own peaks argument,
   written the same day for the same reason.
   The four inputs are `CellScale.jsx`'s own, read the same way it reads them:
   the normal bout, the chain level's anchors, the instants swept from the bout
   against the calcium run, and the response span. Nothing is typed here. */
const CELL_CA = await loadScenario("soce_on", readJson);
const CELL_MODEL = buildCellChainLevel();
const CELL_INSTANTS = instantsOf(CELL_BOUT, CELL_CA);
const CELL_SPAN = responseSpan(CELL_BOUT);
const ARMS = {
  resistance: await loadScenario(SCENARIOS.resistance, readJson),
  endurance: await loadScenario(SCENARIOS.endurance, readJson),
  control: await loadScenario(SCENARIOS.control, readJson),
};

const PASSES = [
  /* THE PASS TAKES ITS TWO ENDING FRAMES NOW. `fiberTour(protocol, ceilings,
     peaks, points)` since 2026-09-05: the ending compares the first repetition
     against the last, so a call without the peaks builds nothing and this file
     would grade an empty array while reporting green. */
  ["fiber", fiberTour(P, CEILINGS, FIBER_PEAKS)],
  ["cell", cellTour(CELL_BOUT, CELL_MODEL.anchors, CELL_INSTANTS, { span: CELL_SPAN })],
  [
    "signalling",
    signallingTour(ARMS.resistance.protocol, routesOf(ARMS), ARMS.resistance.grid.tEnd * secondsPerMinute),
  ],
];

test("the fade this rule subtracts is the one the stylesheet actually plays", () => {
  assert.ok(
    Number.isFinite(FADE_MS) && FADE_MS > 0,
    "`.fiber__spent--tour`'s animation duration could not be read out of fiber.css, so every margin below " +
      "is being measured against a guess",
  );
});

for (const [scale, beats] of PASSES) {
  test(`${scale}: no beat takes its sentence away before it can be read`, () => {
    assert.ok(beats.length > 0, `${scale} built no storyboard, so this test is watching nothing`);
    const short = [];
    for (const [i, beat] of beats.entries()) {
      const need = readingMs(beat.line);
      if (need === 0) continue;
      const have = beat.ms - FADE_MS - FRAME_SLIP_MS;
      if (have < need) {
        short.push(
          `beat ${i} shows "${beat.line}" for ${(have / 1000).toFixed(2)} s of readable time and it needs ` +
            `${(need / 1000).toFixed(2)}`,
        );
      }
    }
    assert.deepEqual(
      short,
      [],
      `${scale}: at ${WORDS_PER_SECOND} words a second — a fast rate, chosen so only clear failures fail — ` +
        `these beats replace their own sentence before a reader gets to the end of it:\n  ${short.join("\n  ")}`,
    );
  });
}

/**
 * AND THE PASS STILL HAS TO BE SITTABLE. Each tour test has its own version of
 * this bound; this one is here so that a fix for the rule above cannot quietly
 * turn a 26-second pass into a minute by lengthening every beat in it.
 */
/* THE CEILING IS PER SCALE NOW, AND ONLY THE FIBRE'S MOVED.
   45 s was one number for three passes and it was the right one while all three
   were the same kind of thing: a narrated demonstration a viewer presses. On
   2026-09-05 the fibre's stopped being that. It is the floor's whole teaching
   sequence — `docs/20260905-fix/fiber.md` — and it contains, on purpose:
     · a descent through three models, which is three arrivals to establish;
     · 3.2 s of ONE CONTRACTION with nothing said over it;
     · 6.5 s of the WHOLE SET at 1x with nothing said over it, which is the
       beat the spec is most explicit about — "말을 안 하는 게 중요해. 사용자가
       관찰해야 하니까";
     · a cut between two archived frames.
   14.5 s of its 86.7 is deliberate silence. A ceiling on wall-clock counts that
   as lecture, and it is the opposite of lecture — it is the part where the
   picture is asked to do the teaching.
   The spec licenses the length in so many words: "말 수는 BODY보다 많지만
   여기서는 실제 mechanism을 가르쳐야 하니까 괜찮아."

   WHAT THE OLD NUMBER WAS ACTUALLY PROTECTING is in the paragraph above this
   test: that a fix for the reading-rate rule cannot quietly turn a 26-second
   pass into a minute by lengthening every beat. That protection is kept and is
   now stated directly — no single beat may outstay a viewer — which catches the
   creep the total was standing in for, and catches it on the two scales this
   lane does not own as well. */
const SITTABLE_MS = { fiber: 95_000, cell: 62_000 /* 2026-09-07, owner (cell C2/C5, pace 2 C1/C3): held messages, time over long sentences */ };
const DEFAULT_SITTABLE_MS = 45_000;
/** How many times its own reading time a beat may hold one sentence.
    PROPORTIONAL AND NOT ABSOLUTE, because the thing being bounded is padding
    and a long sentence honestly needs a long beat. An absolute ceiling picked
    to clear the longest sentence in the app stops catching anything short. */
const BEAT_SLACK = 2.6;

test("no pass grows past what someone will sit through", () => {
  for (const [scale, beats] of PASSES) {
    const ms = beats.reduce((s, b) => s + b.ms, 0);
    const ceiling = SITTABLE_MS[scale] ?? DEFAULT_SITTABLE_MS;
    assert.ok(ms < ceiling, `the ${scale} pass runs ${(ms / 1000).toFixed(1)} s`);
  }
});

test("no single beat outstays a viewer, which is what a total was standing in for", () => {
  const long = [];
  for (const [scale, beats] of PASSES) {
    for (const [i, b] of beats.entries()) {
      /* A SILENT BEAT IS EXEMPT AND THAT IS THE WHOLE POINT OF ONE. The fibre's
         set beat is 6.5 s because the bout is 6.5 s at 1x; it is not holding a
         sentence on screen, it is holding the screen still so the sentence
         already read can be checked against it. What this catches is a beat
         that talks for too long. */
      if (!b.line) continue;
      const needs = readingMs(b.line) + FADE_MS + FRAME_SLIP_MS;
      if (b.ms > needs * BEAT_SLACK) {
        long.push(
          `${scale} beat ${i}: ${(b.ms / 1000).toFixed(1)} s for a line that reads in ` +
            `${(needs / 1000).toFixed(1)} s`,
        );
      }
    }
  }
  assert.deepEqual(long, [], `a beat holds one sentence past what anyone reads it in:\n  ${long.join("\n  ")}`);
});

/* THE WHOLE-FILM CEILING IS GONE WITH THE FILM. `director/ride.js` played
   the three passes end to end as one scripted descent, and this case held that
   whole to two and a half minutes. The film was deleted on 2026-08-30 at the
   owner's word ("자동 투어 없에"), so there is no whole left to hold — a test
   that reads a file nobody ships is not a rule, it is a red light with no
   circuit behind it. The per-pass ceiling above is untouched and is the one
   that was ever doing work: a pass is what a viewer actually sits through now. */
