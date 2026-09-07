import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, createFiberState, EXERCISE_MODES, standingNote, stimulusAt } from "./fiberSimulation.js";

const motion = {
  id: "fake",
  duration: 4,
  phases: [
    { at: 0, name: "top", label: "Top" },
    { at: 2, name: "bottom", label: "Bottom" },
  ],
  effortAt: (t) => ((t % 4) < 2 ? 0.2 : 0.9),
};

test("rep mode is driven by the motion handed in, not by pushup.js", () => {
  assert.ok(EXERCISE_MODES.rep, "rep mode exists");
  assert.equal(EXERCISE_MODES.push_up, undefined, "push_up mode is gone");
  const s = createFiberState();
  for (let i = 0; i < 20; i++) advance(s, 0.05, { mode: "rep", intensity: 1, isActive: true, motion }); // t=1.0
  assert.equal(s.drive, 0.2);
  assert.equal(s.phase, "top");
  assert.equal(s.phaseLabel, "Top");
  for (let i = 0; i < 30; i++) advance(s, 0.05, { mode: "rep", intensity: 1, isActive: true, motion }); // t=2.5
  assert.equal(s.drive, 0.9);
  assert.equal(s.phase, "bottom");
});

test("rep mode without a motion drives nothing and says nothing", () => {
  const s = createFiberState();
  advance(s, 0.05, { mode: "rep", intensity: 1, isActive: true });
  assert.equal(s.drive, 0);
  assert.equal(s.phaseLabel, null);
});

test("tetanus intensity scales the drive amplitude, which is how the body clock reaches the fibre", () => {
  const lo = createFiberState();
  const hi = createFiberState();
  for (let i = 0; i < 400; i++) {
    advance(lo, 0.001, { mode: "tetanus", intensity: 0.2, isActive: true });
    advance(hi, 0.001, { mode: "tetanus", intensity: 0.9, isActive: true });
  }
  assert.ok(hi.calcium > lo.calcium, `hi ${hi.calcium} > lo ${lo.calcium}`);
});

/**
 * THE CAPTION MAY NOT SAY EMPTY, BECAUSE THE STORE NEVER IS.
 *
 * Caught by looking at the screen on 2026-08-26, which is the only way it could
 * have been: the stage read "Force is falling. The store is empty." while the
 * callout two inches to its right read "TERMINAL CISTERNA 542 µM of 941". Both
 * were drawn from the same frame. One of them was wrong.
 *
 * It was the sentence. `forceIsFalling` is true for the whole work phase —
 * `t >= cycle && t < t_exercise_s` — so the line shows from the second
 * repetition onward, and across the entire shipped run `Ca_SR_total` bottoms at
 * 167.9 µM against a 941.2 µM first sample. Eighteen per cent is not empty at
 * any instant the caption is on screen, and the number it contradicts is
 * ALREADY on the same picture, which is the worst version of this: a viewer
 * does not have to leave the frame to catch us.
 *
 * The claim `fixing-prd.md` §2.1 actually wants is the causal one and it is
 * true throughout — "Fatigue is not the command getting weaker. It is the
 * supply running out." Running down is what the store does. Empty is what it
 * never becomes.
 *
 * This pins the wording rather than the physiology because the wording is what
 * broke, and it is cheap: any absolute word put back here fails.
 */
test("the spent caption does not call the store empty, which it never is", async () => {
  const { readFile } = await import("node:fs/promises");
  /* IT READS THE FUNCTION NOW, NOT THE JSX, BECAUSE THE JSX STOPPED DRAWING IT.
     The owner settled the deep scales' four states on 2026-08-31 and the first
     and fourth are both *"아무런 텍스트 없이 (Full Animation the default)"*, so
     the standing caption left the screen with them. Its guard fired exactly as
     written — "the spent caption is gone, so this test is watching nothing" —
     which is the guard doing its job rather than a failure.
     The sentences still exist and are still worth grading: `standingNote` is
     where they live, and if this scale ever speaks between demonstrations again
     it will speak them. See the note on `standingNote` itself for the fact that
     nothing renders it today. */
  const src = await readFile(new URL("./fiberSimulation.js", import.meta.url), "utf8");
  const caption = (src.match(/return "([^"]+)";/g) ?? []).join(" ");
  assert.ok(caption.length > 0, "standingNote returns no sentences, so this test is watching nothing");
  assert.doesNotMatch(
    caption,
    /\b(empty|emptied|exhausted|gone|depleted|zero)\b/i,
    `the caption claims the store reaches nothing: "${caption}"`,
  );

  /* Read straight off the shipped bytes rather than through a loader, because
     the claim is about what SHIPS: if a re-export ever brings the store near
     nothing, this test's premise is wrong and the caption is allowed to say so. */
  const run = JSON.parse(
    await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8"),
  );
  const store = run.series?.Ca_SR_total ?? run.Ca_SR_total;
  assert.ok(Array.isArray(store) && store.length > 0, "soce_on ships no Ca_SR_total to check");
  const floor = Math.min(...store);
  const full = store[0];
  assert.ok(
    floor / full > 0.1,
    `the store now falls to ${((floor / full) * 100).toFixed(1)}% of its first sample — if it ever
     approaches nothing, this test's premise is wrong and the caption may say so`,
  );
});

/**
 * A STANDING NOTE MAY NOT DENY MOTION OVER A WINDOW THE STIMULUS FIRES IN.
 *
 * This is `fiberTour.test.js`'s "a beat that says nothing is happening does not
 * open mid-burst", ported to the sentence that is on screen when no pass is
 * running — which is most of the time a viewer spends here, and which never got
 * the fix.
 *
 * The pass's opening beat used to read "One sarcomere, holding still" and froze
 * at t=0, where `soce_on`'s first burst fires: the tubule at full orange in the
 * frame claiming nothing was happening. That was found, corrected and gated in
 * 2026-08-26. `standingNote`'s first window is `t < cycle_s` — 0 to 0.65 s —
 * and it went on saying "One sarcomere, holding still. The store is full."
 * across a window whose first 0.1625 s IS that burst, and in which the store
 * falls 941.2 to 301.9. Both halves of the sentence were false for most of it.
 *
 * The window is not the problem and is not moved: there is no quiet instant at
 * the start of this run to move to. The sentence is, and it now says what the
 * first cycle actually is, in the shape the other two notes already use.
 */
test("no standing note claims stillness over a window the burst fires in", async () => {
  const { readFile } = await import("node:fs/promises");
  const RUN = JSON.parse(
    await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8"),
  );
  const protocol = RUN.protocol;
  const denies = /still|holding|at rest|quiet|nothing|unchanged/i;

  const end = protocol.repetitions * protocol.cycle_s + protocol.t_recovery_s;
  const seen = new Map();
  for (let t = 0; t < end; t += 0.005) {
    const note = standingNote(t, protocol);
    if (!note) continue;
    const at = seen.get(note) ?? { firstFire: null };
    if (at.firstFire === null && stimulusAt(t, protocol) === 1) at.firstFire = t;
    seen.set(note, at);
  }
  assert.ok(seen.size >= 2, `only ${seen.size} standing note(s) over the whole run — this test is watching one string`);

  for (const [note, { firstFire }] of seen) {
    if (!denies.test(note)) continue;
    assert.equal(
      firstFire,
      null,
      `"${note}" is the sentence on screen at t=${firstFire?.toFixed(4)} s, which is inside a burst. The ` +
        `T-tubule is at full orange under a caption saying nothing is happening — the same defect the ` +
        `pass's opening beat was corrected for, in the sentence that shows when no pass is running`,
    );
  }
});

/**
 * AND EVERY STANDING NOTE HAS TO MOVE THE WAY ITS OWN SENTENCE SAYS.
 *
 * `fiberTour.test.js` exists because a guided pass said "watch it empty" over a
 * window that was mostly refill, and nothing in the project could see a sentence
 * disagreeing with the series it narrates. That gate reads BEATS. These three
 * sentences make the same kind of claim — falling, running down, filling back
 * up — over windows this function chooses, and until now they were checked by
 * reading them.
 *
 * Verified by hand first, which is why the numbers are here: over
 * `[cycle_s, t_exercise_s)` the per-repetition force PEAKS run 0.726 -> 0.324,
 * monotonically, -55.4%, and the store's ceilings run 548.1 -> 453.4. Both
 * halves of "Force is falling. The store is running down." are true of the
 * envelope, which is what a viewer watching ten repetitions sees; the
 * instantaneous force rises and falls inside every one of them, so the claim is
 * only true at the envelope and the check has to be too.
 *
 * The last assertion is the one that matters most: every distinct note this
 * function can return must be matched by a check above. A fourth sentence, or a
 * reworded one, fails here rather than shipping unchecked.
 */
test("every standing note moves the way its own sentence says", async () => {
  const { readFile } = await import("node:fs/promises");
  const RUN = JSON.parse(
    await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8"),
  );
  const P = RUN.protocol;
  const T = RUN.series.t;
  const SR = RUN.series.Ca_SR_total;
  const F = RUN.series.force_relative;
  const end = P.repetitions * P.cycle_s + P.t_recovery_s;

  /** Rows inside `[a, b)`, as indices into the shipped arrays. */
  const inside = (a, b) => {
    const out = [];
    for (let i = 0; i < T.length; i += 1) if (T[i] >= a && T[i] < b) out.push(i);
    return out;
  };
  /** The per-repetition maximum of a series across a window — the envelope. */
  const envelope = (series, a, b) => {
    const peaks = [];
    for (let r = 0; r * P.cycle_s < b; r += 1) {
      const lo = r * P.cycle_s;
      if (lo < a) continue;
      const rows = inside(lo, lo + P.cycle_s);
      if (rows.length) peaks.push(Math.max(...rows.map((i) => series[i])));
    }
    return peaks;
  };
  /* "RUNNING DOWN" IS A TREND AND NOT A MONOTONE SEQUENCE, and the archive is
     what settled it. The first version of this asked for strictly non-increasing
     and failed on the store's own ceilings: 548, 519, 503, **504**, 483, 474,
     465, 457, 453 — one +1 step at the fourth repetition, on a 95 µM range. The
     claim on screen is that the store is running down, and it is; a test that
     demanded monotonicity would have been stricter than the sentence and would
     have sent me to change a sentence that is true. So: the last repetition is
     the lowest, every one is under the first, and the fall is worth seeing. */
  const falls = (xs) =>
    xs.length > 2 &&
    Math.min(...xs) === xs.at(-1) &&
    xs.every((v, i) => i === 0 || v <= xs[0] + 1e-9) &&
    xs.at(-1) < xs[0] * 0.95;

  const WINDOWS = [
    [0, P.cycle_s],
    [P.cycle_s, P.t_exercise_s],
    [P.t_exercise_s, end],
  ];

  const checked = new Set();
  for (const [a, b] of WINDOWS) {
    const note = standingNote((a + b) / 2, P);
    assert.ok(note, `no standing note over [${a}, ${b}) — this test's windows have drifted from the function's`);
    const rows = inside(a, b);
    assert.ok(rows.length > 3, `only ${rows.length} archived samples inside [${a}, ${b})`);
    const sr = rows.map((i) => SR[i]);

    if (/drops and comes back/.test(note)) {
      const trough = Math.min(...sr);
      assert.ok(trough < sr[0], `"${note}" — the store never drops inside its own window`);
      assert.ok(sr.at(-1) > trough, `"${note}" — the store never comes back inside its own window`);
      checked.add(note);
    }
    if (/falling|running down/.test(note)) {
      const force = envelope(F, a, b);
      const ceilings = envelope(SR, a, b);
      assert.ok(
        falls(force),
        `"${note}" — the per-repetition force peaks over this window are ${force.map((v) => v.toFixed(3))}, ` +
          `which is not falling. The instantaneous force rises and falls in every repetition, so this claim ` +
          `is about the envelope and nothing else`,
      );
      assert.ok(falls(ceilings), `"${note}" — the store's per-repetition ceilings are ${ceilings.map((v) => v.toFixed(0))}`);
      checked.add(note);
    }
    if (/filling back up/.test(note)) {
      assert.ok(sr.at(-1) > sr[0], `"${note}" — the store does not rise across the window that says it does`);
      checked.add(note);
    }
    if (/bursts are over/.test(note)) {
      const firing = rows.find((i) => stimulusAt(T[i], P) === 1);
      assert.equal(firing, undefined, `"${note}" — a burst fires at t=${firing !== undefined ? T[firing] : ""}`);
      checked.add(note);
    }
  }

  const all = new Set();
  for (let t = 0; t < end; t += 0.01) {
    const note = standingNote(t, P);
    if (note) all.add(note);
  }
  assert.deepEqual(
    [...all].filter((n) => !checked.has(n)),
    [],
    "a standing note this function returns is matched by no check above, so it ships making a claim about " +
      "the series that nothing reads",
  );
});

/**
 * A HELD FRAME HAS TO BE ITS OWN INSTANT, INCLUDING THE PART WITH MEMORY.
 *
 * `advance(state, 0)` re-derives force, calcium and the store — but not
 * `shortening`, whose relaxation is `(1 - exp(-step / mechTau))` and is exactly
 * 0 at step 0. So a paused seek re-coloured the store and kept the pull it
 * arrived with, and the sarcomere's length is the one thing on this scale a
 * viewer is asked to compare between two frames.
 *
 * THE GUIDED PASS IS THE CALLER THAT MADE THIS URGENT. Its last two beats are
 * held frames that seek BACK to early in the run, and the beat before them ends
 * on the tenth repetition where the sarcomere barely shortens — so the
 * conclusion was drawn with the wide beat's leftover length. Their subject is
 * the store's colour, which is why it went unseen.
 *
 * Instants come from the protocol, not from typed seconds: force peaks near the
 * end of each stimulus, so the first repetition's is around `stim_s` and the
 * last one's around `(repetitions - 1) * cycle_s + stim_s`. The test does not
 * need the exact argmax — it needs two instants whose pictures differ, and it
 * compares against what a continuous run actually draws at the same two.
 *
 * The bound is 10 nm. Measured residual is 2.2 nm here and 6.03 nm at the worst
 * of forty instants swept across the run, which is the catch-up integrator's
 * own step; 10 nm is 3% of the 300 nm the sarcomere draws. 1 nm was the first
 * bound and it failed on the residual — a tolerance fitted to the hope rather
 * than to the measurement.
 */
test("a seek to a held instant brings the drawn length with it", async () => {
  const { readFile } = await import("node:fs/promises");
  const { loadScenario } = await import("../scenarioData.js");
  const { settleAt } = await import("./fiberSimulation.js");
  const scenario = await loadScenario("soce_on", async (p) =>
    JSON.parse(await readFile(new URL(`../../public${p}`, import.meta.url), "utf8")),
  );
  const opts = { mode: "rep", scenario };
  const { cycle_s: cycle, stim_s: stim, repetitions: reps } = scenario.protocol;
  const early = stim;
  const late = (reps - 1) * cycle + stim;

  // What a continuous run draws at those two instants — the answer to match.
  const truth = {};
  {
    const s = createFiberState();
    for (let i = 0; i < Math.ceil((late + 0.1) * 240); i += 1) {
      advance(s, 1 / 240, opts);
      if (truth.early === undefined && s.time >= early) truth.early = s.length;
      if (truth.late === undefined && s.time >= late) truth.late = s.length;
    }
  }
  assert.ok(
    truth.early < truth.late - 0.05,
    "the first repetition no longer pulls visibly harder than the last, so the pass's own " +
      "conclusion has nothing to compare and this test has lost its subject",
  );

  const s = createFiberState();
  for (let i = 0; i < late * 240; i += 1) advance(s, 1 / 240, opts); // standing late, pull weak
  const stale = s.length;
  settleAt(s, early, opts);
  assert.ok(
    Math.abs(s.length - truth.early) < 0.01,
    `a seek to ${early} s drew ${s.length.toFixed(4)} um; a continuous run is at ` +
      `${truth.early.toFixed(4)} there. It arrived from ${stale.toFixed(4)} — if those two are equal, ` +
      "the mechanical lag never caught up and the frame is the one it came from",
  );
});
