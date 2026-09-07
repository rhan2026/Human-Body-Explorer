import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  advance,
  burstsArrived,
  createFiberState,
  forceIsFalling,
  stimulusAt,
  storeFullScale,
} from "./fiberSimulation.js";

/** The bytes the browser fetches, read off disk. Same files, same numbers. */
const shipped = (id) =>
  JSON.parse(readFileSync(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"));

/**
 * The seam where the published model replaces the invented curve.
 *
 * `fiberSimulation.js` has said since it was written that a real calcium model
 * "replaces `advance` and the geometry is untouched". These tests hold it to
 * that, and hold the binding to what the model actually contains — which is not
 * what the obvious visual choice would have been.
 */

/**
 * The loader's shape: every reading arrives carrying its record.
 *
 * `outOfRange` is part of that shape and is reproduced faithfully here, clamp
 * included — the real loader snaps to the nearest sample and says it did. A
 * fixture that clamped without saying so would let the scene read past the end
 * of the run and never be caught.
 */
function fakeScenario(series, evidence = "Derived") {
  const provenance = Object.freeze({ evidence_type: evidence, source: "test" });
  return Object.freeze({
    id: "test",
    provenance,
    sample: (name, t) => {
      const values = series[name];
      if (!values) throw new Error(`no series "${name}"`);
      const last = values.length - 1;
      const i = Math.min(last, Math.max(0, Math.round(t * 10)));
      return Object.freeze({
        series: name,
        value: values[i],
        t: i / 10,
        requestedT: t,
        outOfRange: t < 0 || t > last / 10,
        provenance,
      });
    },
  });
}

const FLAT = {
  force_relative: Array.from({ length: 40 }, () => 0.8),
  Ca_myo_total: Array.from({ length: 40 }, () => 20),
  Ca_SR_total: Array.from({ length: 40 }, () => 900),
};

/** Force decays across the run; calcium does not. That is this model's fatigue. */
const FATIGUING = {
  force_relative: Array.from({ length: 40 }, (_, i) => 0.87 - 0.55 * (i / 39)),
  Ca_myo_total: Array.from({ length: 40 }, (_, i) => 27.1 - 0.4 * (i / 39)),
  Ca_SR_total: Array.from({ length: 40 }, (_, i) => 620 - 380 * (i / 39)),
};

test("without a scenario nothing changes — the invented curve still drives", () => {
  const a = createFiberState();
  const b = createFiberState();
  const motion = { effortAt: () => 0.6, phases: [{ at: 0, name: "rest", label: "Rest" }], duration: 4 };
  for (let i = 0; i < 20; i++) {
    advance(a, 0.016, { mode: "rep", motion });
    advance(b, 0.016, { mode: "rep", motion, scenario: null });
  }
  assert.equal(a.drive, b.drive, "passing scenario: null must be identical to not passing it");
  assert.equal(a.evidence, undefined, "an unbound scene must not claim an evidence type");
});

test("a scenario drives the sarcomere instead of the invented curve", () => {
  const state = createFiberState();
  const motion = { effortAt: () => 0.1, phases: [{ at: 0, name: "rest", label: "Rest" }], duration: 4 };
  const scenario = fakeScenario(FLAT);
  for (let i = 0; i < 30; i++) advance(state, 0.016, { mode: "rep", motion, scenario });

  assert.ok(state.drive > 0.5, `drive ${state.drive} should follow the scenario's 0.8, not the motion's 0.1`);
});

test("the reading's evidence type reaches the state, so the scene can label it", () => {
  const state = createFiberState();
  const scenario = fakeScenario(FLAT);
  advance(state, 0.016, { mode: "rep", scenario });
  assert.equal(state.evidence, "Derived");
});

test("a scenario without an evidence type does not drive anything", () => {
  const state = createFiberState();
  const scenario = fakeScenario(FLAT, null);
  assert.throws(
    () => advance(state, 0.016, { mode: "rep", scenario }),
    /evidence/i,
    "an unlabelled number must not reach the geometry",
  );
});

test("the SR store is carried, because it is where this model's fatigue lives", () => {
  // The driven study measured it: force falls 0.871 -> 0.324 and the store falls
  // to 0.21 of rest, while peak calcium moves 27.1 -> 26.7 uM. The store is the
  // strongest signal in the data and the terminal cisternae are already drawn.
  const state = createFiberState();
  const scenario = fakeScenario(FATIGUING);
  const early = [];
  const late = [];
  // `advance` clamps dt to 0.05 s — a frame-rate guard, not an accident — so the
  // run is 80 steps rather than 40 to cover the fixture's four seconds.
  for (let i = 0; i < 80; i++) {
    advance(state, 0.05, { mode: "rep", scenario });
    (i < 20 ? early : late).push(state.store);
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(
    mean(late) < mean(early) * 0.8,
    `store should empty across the run: early ${mean(early)} late ${mean(late)}`,
  );
});

test("fatigue is NOT drawn by dimming the calcium — that would be inventing it", () => {
  // Measured on the real export: peak Ca_myo_total is 27.1 uM at rep 1 and
  // 26.7 uM at rep 10, a 1.5% move, while force falls 63%. A scene that dims
  // calcium to show fatigue is showing something the model does not contain.
  const state = createFiberState();
  const scenario = fakeScenario(FATIGUING);
  const peaks = [];
  for (let i = 0; i < 80; i++) {
    advance(state, 0.05, { mode: "rep", scenario });
    peaks.push(state.calcium);
  }
  const first = Math.max(...peaks.slice(0, 20));
  const last = Math.max(...peaks.slice(-20));
  const drop = (first - last) / first;
  assert.ok(
    drop < 0.15,
    `calcium fell ${(100 * drop).toFixed(1)}% across the run; the model's calcium moves ~1.5% and the drive must not manufacture more`,
  );
});

/**
 * The test that would have caught it.
 *
 * Six tests above passed while the published force reached no pixel at all.
 * Each of them asked "does state carry the right value" — `drive` was correct,
 * `store` was correct, `evidence` was correct — and none asked whether any of
 * it reached the picture. `state.drive` was written every frame and read by
 * nothing; the sarcomere was moving on the model's calcium pushed through an
 * unfitted Hill curve, under a `Derived` badge.
 *
 * A seam can be live, typed and unit-tested and still be disconnected. The one
 * question that catches that is not "is the value right" but **"if I change the
 * input, does the output change?"**
 */
test("changing the published force changes what is drawn", () => {
  const settle = (v) => {
    const s = createFiberState();
    const scenario = fakeScenario({ ...FLAT, force_relative: Array.from({ length: 40 }, () => v) });
    // "rep" and not "isometric": isometric has shortens:false by design, so its
    // length is force-independent and the check would pass vacuously on it.
    for (let i = 0; i < 200; i++) advance(s, 0.016, { mode: "rep", scenario });
    return s;
  };

  const strong = settle(0.87);
  const weak = settle(0.087);

  // Every quantity the scene actually draws. A tenfold change in the published
  // force must move them; if it does not, the binding is decorative.
  for (const key of ["tension", "length", "shortening"]) {
    assert.notEqual(
      strong[key],
      weak[key],
      `a 10x change in the published force left ${key} identical — the force is being carried and dropped`,
    );
  }

  assert.ok(
    strong.tension > weak.tension * 3,
    `tension should scale with the published force: ${weak.tension} -> ${strong.tension}`,
  );
});

/**
 * The run is finite; the tab is not. Who owns the seam.
 *
 * The export covers 13 s and FiberScene loops it, which is a scene decision and
 * deliberately NOT this module's: `advance` walks its clock forward and never
 * rewinds, so a caller that does not wrap gets `outOfRange` readings and knows
 * it. Pinning that here keeps the wrap in one place — the day someone adds a
 * second wrap in here, one of these two assertions goes red.
 *
 * The wrap matters because it is not free. Measured on the real export, force is
 * continuous across the seam (0.00014 -> 0.00053) while the SR store jumps
 * 716.6 -> 941.2 µM in a single frame. The bars show nothing and the store
 * teleports, so the loop reads as a fibre recovering. `lap` is what lets the
 * readout say otherwise, and it starts at 0 rather than undefined so the
 * readout's `state.lap > 0` is a question about laps and not about binding.
 */
test("advance never rewinds its own clock — the scene owns the loop", () => {
  const state = createFiberState();
  const scenario = fakeScenario(FLAT); // 40 samples at 0.1 s = 3.9 s of grid
  assert.equal(state.lap, 0);

  for (let i = 0; i < 90; i++) advance(state, 0.05, { mode: "rep", scenario });

  assert.ok(state.time > 3.9, `clock should have run past the grid, is ${state.time}`);
  assert.equal(state.lap, 0, "advance must not wrap — FiberScene does, and two wraps would fight");
  assert.equal(
    scenario.sample("force_relative", state.time).outOfRange,
    true,
    "past the end the reading says so, which is how an unwrapped caller finds out",
  );
});

test("the unbound branch clears what the scenario wrote", () => {
  // Once a scenario had been bound, state kept claiming `Derived` for ever —
  // including while the invented twitch curve was driving it again.
  const state = createFiberState();
  const scenario = fakeScenario(FLAT);
  advance(state, 0.016, { mode: "rep", scenario });
  assert.equal(state.evidence, "Derived");

  const motion = { effortAt: () => 0.6, phases: [{ at: 0, name: "rest", label: "Rest" }], duration: 4 };
  advance(state, 0.016, { mode: "rep", motion, scenario: null });

  assert.equal(state.evidence, undefined, "a `Derived` badge must not survive the model being unbound");
  assert.equal(state.force, null, "a stale published force would go on driving the sarcomere");
  assert.equal(state.store, null);
});

/**
 * The store, on the scale the picture draws it at.
 *
 * `state.store` has been correct and unread since it was written — the fibre
 * scale's own version of the failure the test above is named for. Raw µM is not
 * a thing a torus can be, so the geometry needs the ratio, and the ratio needs a
 * full mark that the panel agrees with. Both come from here.
 */
test("the store arrives as a fraction of the run's own resting load", () => {
  const state = createFiberState();
  const scenario = fakeScenario(FATIGUING);

  advance(state, 0.016, { mode: "rep", scenario });
  assert.equal(state.storeFraction, 1, "the run's first sample IS full — nothing else can be");
  assert.equal(storeFullScale(scenario), 620, "full is read out of the archive, not typed here");

  for (let i = 0; i < 80; i++) advance(state, 0.05, { mode: "rep", scenario });
  assert.ok(
    state.storeFraction < 0.5,
    `the fixture empties to 0.39 of rest; the fraction reads ${state.storeFraction}`,
  );

  advance(state, 0.016, { mode: "rep", scenario: null });
  assert.equal(state.storeFraction, null, "unbound there is no store, and 0 would claim there is an empty one");
});

/**
 * The sentence the panel is allowed to say, held to the runs that ship.
 *
 * "Force is falling. The store is empty." is two claims, and this is where they
 * are checked — not in the JSX, which can only be read as text. The window
 * `forceIsFalling` opens has to be a window in which BOTH are true, or the line
 * is a caption that happens to sit near a picture.
 */
test("the falling-force window is a window in which force is actually falling", () => {
  const full = (sr) => sr[0];
  const perRep = (run, cycle, from, to) => {
    const reps = [];
    for (let i = 0; i < run.t.length; i++) {
      const t = run.t[i];
      if (t < from || t >= to) continue;
      const r = Math.floor(t / cycle);
      const cell = (reps[r] ??= { force: 0, store: 0 });
      cell.force = Math.max(cell.force, run.force_relative[i]);
      cell.store = Math.max(cell.store, run.Ca_SR_total[i] / full(run.Ca_SR_total));
    }
    return reps.filter(Boolean);
  };

  for (const id of ["soce_on", "soce_off"]) {
    const file = shipped(id);
    const p = file.protocol;
    const reps = perRep(file.series, p.cycle_s, p.cycle_s, p.t_exercise_s);
    assert.ok(reps.length >= 5, `${id}: ${reps.length} repetitions inside the window is not a trend`);

    for (let r = 1; r < reps.length; r++) {
      assert.ok(
        reps[r].force < reps[r - 1].force,
        `${id}: peak force rose from ${reps[r - 1].force} to ${reps[r].force} inside the window the ` +
          `panel calls "Force is falling"`,
      );
    }
    // The store's ceiling wobbles by a thousandth between two mid-run
    // repetitions, so this asks what the sentence asks — it never gets back to
    // rest, and it ends the window lower than it started it.
    for (const rep of reps) {
      assert.ok(rep.store < 0.7, `${id}: the store refilled to ${rep.store} of rest — that is not empty`);
    }
    assert.ok(reps.at(-1).store < reps[0].store, `${id}: the store's ceiling did not fall across the window`);

    // And the window is the window: open through the stimulus, shut over the
    // recovery, where force is 0 and "falling" would be a lie.
    assert.equal(forceIsFalling(p.cycle_s, p), true);
    assert.equal(forceIsFalling(p.t_exercise_s, p), false, `${id}: the line must not survive into the recovery`);
    assert.equal(forceIsFalling(0, p), false, `${id}: the first repetition is the strongest, so nothing is falling yet`);
  }

  // The same 13 s, the same protocol fields, no stimulus. `repetitions: 0` is
  // the only thing separating it from the two above, and it is what keeps a
  // fatigue caption off an unstimulated fibre.
  const rest = shipped("rest_only");
  assert.equal(rest.protocol.repetitions, 0);
  for (const t of rest.series.t) {
    assert.equal(forceIsFalling(t, rest.protocol), false, `rest_only claimed falling force at t=${t}`);
  }
});

/**
 * WHAT FIRES, AND WHETHER THE PICTURE MAY BE DRAWN ON IT.
 *
 * The burst train is the cause of everything else on this scale — the calcium
 * leaving the store, the tension, the fatigue — and until now it reached no
 * pixel: `protocol` shipped in the file and `forceIsFalling` was the only thing
 * that had ever read it. `stimulusAt` is what the T-tubules are drawn through,
 * so the two things it has to be are checked here rather than in the geometry:
 * it is the protocol's own train and nothing else, and the run's calcium
 * actually answers it.
 *
 * WHOSE NUMBERS. `cycle_s` and `stim_s` are the authors' `exerciseParam`;
 * `repetitions` is OURS, and `whose_protocol` in the file says so in its own
 * words. Nothing here invents a rate — the drawing shows the field, and the
 * field carries its own attribution.
 */
test("the stimulus is the protocol's own train — ten bursts, then nothing", () => {
  const p = shipped("soce_on").protocol;

  // The exercise half IS the train: ten cycles of 0.65 s and not a millisecond
  // more, so "then it stops" is arithmetic rather than a caption.
  assert.equal(+(p.repetitions * p.cycle_s).toFixed(6), p.t_exercise_s);

  const dt = 1 / 8000;
  const steps = Math.round(((p.t_exercise_s + p.t_recovery_s) / dt));
  let edges = 0;
  let on = 0;
  let onSteps = 0;
  let afterTheLast = 0;
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const now = stimulusAt(t, p);
    if (now && !on) edges++;
    if (now) onSteps++;
    if (now && t >= p.t_exercise_s) afterTheLast++;
    on = now;
  }

  assert.equal(edges, p.repetitions, `the train fired ${edges} times for ${p.repetitions} repetitions`);
  assert.equal(afterTheLast, 0, "something fired during the recovery, where the protocol holds still");
  // A quarter of each cycle, which is what 0.1625 s of 0.65 s is. Drawn any
  // wider and the flash would be claiming a longer depolarisation than the
  // authors' `exerciseParam` holds.
  const duty = (onSteps * dt) / p.t_exercise_s;
  assert.ok(Math.abs(duty - p.stim_s / p.cycle_s) < 0.001, `duty cycle ${duty} is not stim_s/cycle_s`);

  // The edges, named: on at the top of every cycle, off for the rest of it.
  assert.equal(stimulusAt(0, p), 1);
  assert.equal(stimulusAt(p.stim_s, p), 0, "the burst outlasted stim_s");
  assert.equal(stimulusAt(p.cycle_s, p), 1, "the second cycle did not start a second burst");
  assert.equal(stimulusAt(p.t_exercise_s, p), 0);
  assert.equal(stimulusAt(-1, p), 0);

  // The run that holds still is the one that proves the condition is the
  // protocol and not the clock — same 13 s, same fields, `repetitions: 0`.
  const rest = shipped("rest_only");
  assert.equal(rest.protocol.repetitions, 0);
  for (const t of rest.series.t) assert.equal(stimulusAt(t, rest.protocol), 0, `rest_only fired at t=${t}`);
  assert.equal(stimulusAt(1, undefined), 0, "no protocol must not draw a stimulus");
});

/**
 * THE COUNT AND THE FLASH ARE ONE EVENT, SO THEY MAY NOT DISAGREE.
 *
 * The tubule's flash is `stimulusAt` and the callout beside it is
 * `burstsArrived`, and a viewer reads them as one thing: the plate says which
 * burst this is while the membrane is lit. Two functions over one protocol is
 * how that stays true — but only if nothing between them drifts, so the tie is
 * asserted rather than assumed. The failure this catches is an off-by-one that
 * would name the burst BEFORE the one that is lighting the screen.
 *
 * Not a duration anywhere in here: the count answers "which one", never "how
 * long". `docs/fixing-prd.md` §0 and the owner's standing "i dont want
 * timeframs anywhere".
 */
test("the burst count names the burst that is firing, and stops at the last one", () => {
  const p = shipped("soce_on").protocol;

  // Every instant the membrane is lit, the plate names a burst that has begun
  // and not one that has not. Swept at 8 kHz, the rate the train test uses.
  const dt = 1 / 8000;
  let seen = 0;
  for (let i = 0, n = Math.round((p.t_exercise_s + p.t_recovery_s) / dt); i < n; i++) {
    const t = i * dt;
    const n_ = burstsArrived(t, p);
    assert.ok(n_ >= 0 && n_ <= p.repetitions, `count ${n_} outside 0..${p.repetitions} at t=${t}`);
    if (stimulusAt(t, p)) {
      assert.equal(n_, Math.floor(t / p.cycle_s) + 1, `the flash at t=${t} is not the burst the count names`);
      seen = Math.max(seen, n_);
    }
  }
  assert.equal(seen, p.repetitions, `only ${seen} of ${p.repetitions} bursts were ever named`);

  assert.equal(burstsArrived(0, p), 1, "the first burst is arriving at t=0 and the plate says so");
  assert.equal(burstsArrived(p.cycle_s, p), 2);
  // The recovery holds at ten: they have all been and gone, and an eleventh is
  // a burst the protocol never fired.
  assert.equal(burstsArrived(p.t_exercise_s, p), p.repetitions);
  assert.equal(burstsArrived(p.t_exercise_s + p.t_recovery_s, p), p.repetitions);

  // Nothing to count is 0, not 1. `rest_only` runs the same span with
  // `repetitions: 0`, and an unbound scene has no protocol at all.
  assert.equal(burstsArrived(3, shipped("rest_only").protocol), 0);
  assert.equal(burstsArrived(3, undefined), 0);
  assert.equal(burstsArrived(-1, p), 0);
});

test("the published calcium answers every burst, which is what licenses drawing one", () => {
  const file = shipped("soce_on");
  const p = file.protocol;
  const { t, Ca_myo_total: ca } = file.series;
  const at = (want) => ca[t.reduce((best, v, i) => (Math.abs(v - want) < Math.abs(t[best] - want) ? i : best), 0)];

  // Every one of the ten. If a single burst did not move the calcium, the flash
  // would be a decoration sitting next to a coincidence.
  const peaks = [];
  for (let r = 0; r < p.repetitions; r++) {
    const start = at(r * p.cycle_s);
    const end = at(r * p.cycle_s + p.stim_s);
    assert.ok(end > start, `repetition ${r}: calcium went ${start} -> ${end} across its own burst`);
    peaks.push(end);
  }

  // And the recovery answers nothing, because nothing fires in it. This is the
  // half of the run where a viewer learns the rhythm was the stimulus and not
  // the scene's own idle animation.
  const quiet = Math.max(...ca.filter((_, i) => t[i] >= p.t_exercise_s));
  assert.ok(
    quiet < Math.min(...peaks) / 10,
    `calcium reached ${quiet} µM in the recovery against a burst peak of ${Math.min(...peaks)}`,
  );
});

/**
 * "The bursts never weakened" is on screen, so it is measured here.
 *
 * The fibre pass's last beat used to end "That is what tiring is" — a claim
 * about a person over a picture of a store. It says this instead, which is a
 * claim about the file the browser actually loads, and this is the check that
 * keeps it true. Measured on the SHIPPED, THINNED copy rather than the archive,
 * because the thinned copy is what plays: peak calcium there jitters +-8% off
 * the archive's smooth 27.78 -> 27.56 uM purely from the 61 Hz stride, and a
 * bound tight enough for the archive would be a gate that fails on the export.
 *
 * The pair is the point. Either number alone says nothing — force falling is
 * unremarkable, calcium holding is unremarkable, and the two together are the
 * whole reason the beat exists.
 */
test("across the ten repetitions the bursts hold and the force does not", () => {
  const run = shipped("soce_on");
  const { t, Ca_myo_total: ca, force_relative: force } = run.series;
  const { cycle_s: cycle, repetitions } = run.protocol;
  assert.equal(repetitions, 10, "the beat says 'after ten'");

  const peakIn = (series, rep) => {
    let top = -Infinity;
    for (let i = 0; i < t.length; i++) {
      if (t[i] >= rep * cycle && t[i] < (rep + 1) * cycle) top = Math.max(top, series[i]);
    }
    assert.ok(Number.isFinite(top), `no sample lands in repetition ${rep + 1}`);
    return top;
  };

  const caRatio = peakIn(ca, repetitions - 1) / peakIn(ca, 0);
  const forceRatio = peakIn(force, repetitions - 1) / peakIn(force, 0);

  assert.ok(
    caRatio > 0.85 && caRatio < 1.15,
    `the tenth burst is ${(100 * caRatio).toFixed(1)}% of the first — "never weakened" is no longer what this file does`,
  );
  assert.ok(
    forceRatio < 0.55,
    `force at the tenth is ${(100 * forceRatio).toFixed(1)}% of the first — the beat needs a fall to point at`,
  );
});

/**
 * THE STATE ROW SAYS WHAT THE TENSION ROW SAYS.
 *
 * Q24 R10, 2026-08-29. Measured in a browser across one 0.65 s stride of
 * `soce_on`, reading `__fiberState` and the rendered label together:
 *
 *   t=0.03  force 0.386  ->  "At rest"
 *   t=0.20  force 0.787  ->  "At rest"
 *   t=0.24  force 0.463  ->  "At rest"
 *   t=0.30  force 0.170  ->  "At rest"
 *
 * Four of nine samples said the fibre was at rest while the row directly under
 * them read `Relative tension · 0.79 of maximum`. CLAUDE.md §9: the screen says
 * what is happening now.
 *
 * The cause was a rule written for the invented curve and left in place when a
 * run is bound. `advance` decided the phase from `calcium > 0.5` with a
 * fall-through on `shortening > 0.15` — and `shortening` is 0 for the WHOLE of
 * any bound run, so the fall-through was dead and `"Relaxing"` was a label
 * `PHASE_LABEL` defines and nothing could ever reach. Calcium leaves the
 * myoplasm long before the cross-bridges let go, which is the model's own
 * point, so a calcium-only rule has to call the entire force decay "rest".
 *
 * Bound runs now read the published force this screen is already drawing. The
 * unbound branch is untouched: there `state.force` is null and the invented
 * curve's own rule is the only one there is.
 */
test("a bound run never calls the fibre at rest while it is holding force", () => {
  const run = shipped("soce_on");
  const scenario = {
    id: run.id,
    provenance: run.provenance,
    sample: (name, t) => {
      const values = run.series[name];
      const times = run.series.t;
      let i = 0;
      while (i < times.length - 1 && times[i + 1] <= t) i += 1;
      return Object.freeze({
        series: name, value: values[i], t: times[i], requestedT: t,
        outOfRange: t < times[0] || t > times[times.length - 1],
        provenance: run.provenance,
      });
    },
  };

  const wrong = [];
  for (let i = 0; i <= 65; i += 1) {
    const t = i / 100;
    const state = createFiberState();
    state.time = t;
    advance(state, 0, { mode: "run", scenario, motion: null });
    if (state.phase === "rest" && state.force > 0.15) {
      wrong.push(`t=${t.toFixed(2)} force ${state.force.toFixed(3)} said "rest"`);
    }
  }
  assert.equal(
    wrong.length, 0,
    `the fibre called itself at rest while drawing force: ${wrong.slice(0, 6).join(" | ")}`,
  );

  // AND THE THIRD LABEL IS REACHABLE. A run that decays through 0.15 has to
  // pass through relaxing; if it never does, the rule has collapsed to two
  // states again and `PHASE_LABEL.relaxing` is furniture.
  const labels = new Set();
  for (let i = 0; i <= 65; i += 1) {
    const state = createFiberState();
    state.time = i / 100;
    advance(state, 0, { mode: "run", scenario, motion: null });
    labels.add(state.phase);
  }
  assert.ok(labels.has("relaxing"), `one stride never relaxes — phases seen: ${[...labels].join(", ")}`);
  assert.ok(labels.has("activated"), `one stride never activates — phases seen: ${[...labels].join(", ")}`);
  assert.ok(labels.has("rest"), `one stride never rests — phases seen: ${[...labels].join(", ")}`);
});
