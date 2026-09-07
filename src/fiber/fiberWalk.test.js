import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { fiberWalk } from "./fiberWalk.js";
import { LEVELS } from "./fiberGeometry.js";
import { storeCeilings, storeFullScale } from "./fiberSimulation.js";
import { loadScenario } from "../scenarioData.js";
import { FRAME_SLIP_MS, readingMs } from "../tour.js";

const readJson = async (p) => JSON.parse(await readFile(new URL(`../../public${p}`, import.meta.url), "utf8"));

/* THE SAME TWO ARGUMENTS THE PAGE HANDS IT, measured the same way.
   `MuscleFiberVisualization.jsx` loads the run through `scenarioData.js` and
   measures the ceilings with `storeCeilings`; a gate that measured them some
   other way would be grading a walk nobody plays. */
const run = await loadScenario("soce_on", readJson);
const ceilings = storeCeilings(run);
const walk = () => fiberWalk(run, ceilings);

/** One of the run's own series, as the loader hands it out. */
const series = (name) => {
  const v = run.series(name)?.values;
  assert.ok(Array.isArray(v) && v.length > 1, `the run has no series "${name}"`);
  return v.map(Number);
};

/** The largest value inside each repetition's own cycle. */
const repPeaks = (name) => {
  const t = series("t");
  const v = series(name);
  const { cycle_s: cycle, repetitions: reps } = run.protocol;
  const out = [];
  for (let k = 0; k < reps; k += 1) {
    let best = -Infinity;
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] >= k * cycle && t[i] < (k + 1) * cycle && v[i] > best) best = v[i];
    }
    out.push(best);
  }
  return out;
};

/* A FIGURE, NOT A DIGIT. `CaMKK2` and `PGC-1α` carry a digit inside a name and
   are not what the owner cut — a number preceded by a letter or a hyphen is part
   of what the thing is called. This matches a digit that stands on its own,
   which is what a percentage or a multiple looks like. */
const FIGURE = /(?<![A-Za-z-])\d/;

test("every part the walk stands beside is a part this scale draws", () => {
  const model = LEVELS.sarcomere.build();
  const ids = model.anchors.map((a) => a.id);
  try {
    for (const beat of walk()) {
      assert.ok(
        ids.includes(beat.anchor),
        `"${beat.id}" stands beside "${beat.anchor}", which the sarcomere does not draw — a guide ` +
          `pointing at a part that is not there is worse than one that never mentioned it. Have: ${ids.join(", ")}`,
      );
    }
  } finally {
    model.dispose();
  }
});

/**
 * THE WALK REFUSES RATHER THAN GUESSES. Six of its sentences are measurements
 * and one of them needs the ceilings the page measured; half a walk saying the
 * store refilled to 0% because an argument was missing is worse than silence.
 */
test("no run, no walk", () => {
  assert.deepEqual(fiberWalk(null, ceilings), []);
  assert.deepEqual(fiberWalk(run, []), []);
  assert.deepEqual(fiberWalk({ protocol: run.protocol, series: () => null }, ceilings), []);
});

/* ── EVERY CLAIM, AGAINST THE FILE IT CLAIMS ABOUT ────────────────────────────
   Not style gates. Each one is a sentence a visitor reads as a fact about the
   run in front of them, and the run is re-exported by a Python layer nothing
   here controls. §5 forbids a claim that has quietly stopped being true, and
   the only way to keep one honest is to keep asking. */

test("the pull really does fade, and by the figure the beat quotes", () => {
  const peaks = repPeaks("force_relative");
  for (let i = 1; i < peaks.length; i += 1) {
    assert.ok(
      peaks[i] < peaks[i - 1],
      `repetition ${i + 1} pulls harder than ${i} (${peaks[i]} vs ${peaks[i - 1]}); the beat says the ` +
        "peak falls from the first repetition to the tenth, and a bump in the middle is not that",
    );
  }
  const fall = (peaks[0] - peaks[peaks.length - 1]) / peaks[0];
  assert.ok(fall > 0.4, `peak pull falls ${(fall * 100).toFixed(1)}%; the beat quotes that figure as the fade`);
});

/**
 * THE OTHER HALF OF THE SURPRISE, AND IT IS THE HALF THAT CAN ROT. The pull
 * fading is the expected thing; the calcium NOT fading is what makes the ending
 * worth saying. If a re-export ever makes the tenth burst weak, the ending is
 * false and this is what says so.
 */
test("the command does not weaken — the tenth burst delivers what the first did", () => {
  const peaks = repPeaks("Ca_myo_total");
  const kept = peaks[peaks.length - 1] / peaks[0];
  assert.ok(
    kept > 0.9,
    `the tenth burst peaks at ${(kept * 100).toFixed(1)}% of the first; the walk's ending says the ` +
      "signal does not weaken while the pull does",
  );
});

test("the store never runs out, which is what the surprise turns on", () => {
  const sr = series("Ca_SR_total");
  const left = Math.min(...sr) / storeFullScale(run);
  assert.ok(
    left > 0.05,
    `the store bottoms out at ${(left * 100).toFixed(1)}% of its resting load; the beat says it never ` +
      "runs out, and a store that reaches zero would make the expected answer the right one",
  );
});

test("the store really does refill less after every burst", () => {
  assert.ok(ceilings.length > 1, "no per-repetition ceilings were measured, so the beat is standing on nothing");
  for (let i = 1; i < ceilings.length; i += 1) {
    assert.ok(
      ceilings[i].value < ceilings[i - 1].value,
      `repetition ${ceilings[i].rep} refilled higher than ${ceilings[i - 1].rep}; the beat says each one ` +
        "gets back less than the last",
    );
  }
});

/**
 * THE NUMBER THAT FLATTERS, AND THE ARCHIVE IS WHY. Calcium's multiple is in the
 * hundreds because the resting level is a rounding error next to the peak — the
 * same trap the cell walk names for AMP. The beat says so out loud, and this
 * pins the reason it has to.
 */
test("calcium's multiple is huge because rest is nearly nothing", () => {
  const ca = series("Ca_myo_total");
  assert.ok(
    ca[0] / Math.max(...ca) < 0.01,
    `resting calcium is ${((ca[0] / Math.max(...ca)) * 100).toFixed(2)}% of the peak; the beat warns that ` +
      "the multiple is a statement about how quiet rest is, and it stops being worth saying if rest rises",
  );
});

test("the second half of the run really is quiet", () => {
  const t = series("t");
  const f = series("force_relative");
  const { t_exercise_s: work, cycle_s: cycle } = run.protocol;
  let most = 0;
  for (let i = 0; i < t.length; i += 1) if (t[i] >= work + cycle && f[i] > most) most = f[i];
  assert.ok(
    most / Math.max(...f) < 0.01,
    `the pull reaches ${((most / Math.max(...f)) * 100).toFixed(2)}% of its peak after the bursts stop; the ` +
      "beat says nothing here moves on its own",
  );
});

test("phosphate only goes one way, which is the whole of the waste beat", () => {
  const pi = series("Pi_myo_total");
  for (let i = 1; i < pi.length; i += 1) {
    assert.ok(pi[i] >= pi[i - 1], `phosphate falls at sample ${i}; the beat says it never clears`);
  }
  assert.ok(
    Math.max(...pi) / pi[0] > 2,
    `phosphate ends at ${(Math.max(...pi) / pi[0]).toFixed(1)}x its start; the beat quotes that multiple`,
  );
});

/**
 * AND EVERY ONE OF THEM IS COUNTED. §9 — a value that comes out of a count must
 * not be typed. A literal goes stale the day the Python layer re-exports and
 * nothing tells anybody.
 */
test("the walk's figures are counted from the archive, not written into it", () => {
  /* COMMENTS FIRST, THEN THE INTERPOLATIONS. The first cut of this only looked
     inside template literals that still HELD a `${`, so replacing the one
     interpolation in a line with the number it happened to print left the
     template with none — and the gate looked straight past the very mutation it
     exists to catch. Measured: `**Peak pull falls 63% …**` typed in by hand,
     thirteen of thirteen green. What is scanned now is the whole function with
     its prose and its counted values removed, so anything shaped like a figure
     that is left is one somebody typed. */
  const src = String(fiberWalk)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\$\{[^}]*\}/g, "⟨counted⟩");
  const typed = [...src.matchAll(/\d+(?:\.\d+)?\s*(?:%|x\b)/g)].map((m) => m[0]);
  assert.deepEqual(
    typed,
    [],
    `the source spells out ${typed.join(", ")} instead of counting it — a typed figure goes stale the day ` +
      "the Python layer re-exports and nothing tells anybody",
  );
  /* AND NOW NO BEAT CARRIES A FIGURE AT ALL — owner, 2026-09-04:
     *"숫자는 필요가 없어 뭐 막 58%이런건 그냥하지를 마 숫자가 내가 20살인데 뭔
     도움이 되겠어 그냥 이해를 돕는거야"*.
     This used to require at least five beats to SHOW a counted number, which was
     the right rule while the walk's job was to prove its claims on screen. The
     job changed: the walk is for somebody who has never heard of any of this,
     and a percentage is a thing to be trusted rather than a thing to be
     understood. The claims did not go anywhere — every one of them is still
     checked against the archive by the cases above, which is where a number
     belongs.
     The scan above stays and is the important half: it catches a figure TYPED
     into the source, which goes stale the day the Python layer re-exports. This
     half is now its mirror — none reaches the screen either. */
  const withNumbers = walk().filter((b) => FIGURE.test(b.line));
  assert.deepEqual(
    withNumbers.map((b) => b.line),
    [],
    "a beat puts a figure in front of a first-time visitor; the claim belongs on screen, the number does not",
  );
});

/**
 * A SENTENCE THAT LEAVES BEFORE IT IS READ IS NOT A SENTENCE. `tourPace.test.js`
 * holds this for the three storyboards and its `PASSES` list cannot hold a walk
 * — a walk has no seek, no speed and no 45-second ceiling — so the same rule is
 * asked here, with the same two subtractions and the guide's own fade.
 */
const GUIDE_FADE_MS = Number(
  (await readFile(new URL("../guide/guide.css", import.meta.url), "utf8")).match(
    /animation:\s*guide-say\s+(\d+)ms/,
  )?.[1],
);

test("the fade this rule subtracts is the one the stylesheet actually plays", () => {
  assert.ok(
    Number.isFinite(GUIDE_FADE_MS) && GUIDE_FADE_MS > 0,
    "`.guide__say`'s animation duration could not be read out of guide.css, so the margin below is being " +
      "measured against a guess",
  );
});

test("no beat takes its sentence away before it can be read", () => {
  const short = [];
  for (const beat of walk()) {
    const need = readingMs(beat.line);
    const have = beat.ms - GUIDE_FADE_MS - FRAME_SLIP_MS;
    if (have < need) {
      short.push(`"${beat.line}" gets ${(have / 1000).toFixed(2)} s and needs ${(need / 1000).toFixed(2)}`);
    }
  }
  assert.deepEqual(short, [], `these beats replace themselves too fast:\n  ${short.join("\n  ")}`);
});

/**
 * THE ONE MOVE THE OWNER CALLED THE MOST IMPORTANT: build the expectation, then
 * break it. A surprise a reader did not first believe is just a fact, so the
 * order of these two beats is load-bearing and not a matter of taste.
 */
test("the walk builds the expectation before it breaks it, and ends on the break", () => {
  const ids = walk().map((b) => b.id);
  assert.ok(ids.indexOf("expect") > -1 && ids.indexOf("but") > ids.indexOf("expect"));
  assert.equal(ids[ids.length - 1], "surprise");
});
