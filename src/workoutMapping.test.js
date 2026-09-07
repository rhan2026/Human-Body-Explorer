import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { loadScenario } from "./scenarioData.js";
import { mapWorkout, armFor } from "./workoutMapping.js";

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));

/** The two arms the mapping lands on, loaded from the committed bytes. */
const fibre = await loadScenario("soce_on", readJson);
const resistance = await loadScenario("fowler_resistance", readJson);
const endurance = await loadScenario("fowler_endurance", readJson);

const BASE = { exercise: "bench_press", kg: 60, reps: 10, sets: 3, restS: 90 };
const map = (input, signalling = resistance) =>
  mapWorkout({ ...BASE, ...input }, { fibre, signalling });

const fieldsOf = (result) => [...result.consumed, ...result.dropped].map((e) => e.field).sort();
const whyOf = (result, field) => result.dropped.find((e) => e.field === field)?.why;

test("every number the viewer typed is accounted for — consumed or dropped, never neither", () => {
  // The contract, and the reason this module exists at all. A field that is
  // read off the form and appears in neither list is a number the screen
  // implies was used and was not; that is the failure PRD-v2 §5.2 names.
  const inputs = [
    BASE,
    { ...BASE, exercise: "running" },
    { ...BASE, exercise: "deadlift" },
    { ...BASE, kg: 0, reps: 10, sets: 1, restS: 0 },
  ];
  for (const input of inputs) {
    const signalling = armFor(input.exercise) === "endurance" ? endurance : resistance;
    const result = mapWorkout(input, { fibre, signalling });
    assert.deepEqual(fieldsOf(result), Object.keys(input).sort(), JSON.stringify(input));
    for (const entry of result.dropped) {
      assert.ok(entry.why?.length > 20, `${entry.field} was dropped without saying why`);
    }
    for (const entry of result.consumed) {
      assert.ok(entry.reaches?.length > 20, `${entry.field} claims to reach something unnamed`);
    }
    assert.equal(result.evidence, "Mapped");
  }
});

test("the load reaches no model, at any weight — nothing here is calibrated to %1RM", () => {
  // PRD-v2 §10 lists "convert kilograms to calcium concentrations" among the
  // things this product does not do. The kilogram field therefore has exactly
  // one honest destination and it is the dropped list.
  for (const kg of [0, 20, 60, 200]) {
    const result = map({ kg });
    assert.equal(result.consumed.find((e) => e.field === "kg"), undefined, `${kg} kg was consumed`);
    assert.match(whyOf(result, "kg"), /1RM/);
  }
});

test("changing the repetitions changes what the mapping says", () => {
  // The recurring defect of this repository, asked at the seam where it would
  // land: a form whose output is the same sentence whatever is typed into it.
  const ten = map({ reps: 10, sets: 1 });
  const twelve = map({ reps: 12, sets: 1 });
  assert.equal(ten.cycles, 10);
  assert.equal(twelve.cycles, 12);
  assert.notEqual(whyOf(ten, "reps"), whyOf(twelve, "reps"));
  // Both readings name the archived count rather than asserting one of their own.
  assert.match(whyOf(ten, "reps"), /10/);
  assert.match(whyOf(twelve, "reps"), /10/);
});

test("the category is read off the exercise and never off the numbers", () => {
  // Reps and load do not decide it, because nothing in either archive
  // calibrates a rep range against either exercise input. Inventing that
  // threshold here would be the re-fit rule broken in a new place.
  assert.equal(map({ exercise: "bench_press", reps: 30, kg: 5 }).category, "resistance");
  assert.equal(mapWorkout({ ...BASE, exercise: "running", reps: 1, kg: 200 }, { fibre, signalling: endurance }).category, "endurance");
  assert.equal(armFor("swimming_freestyle"), "endurance");
  assert.equal(armFor("pushup"), "resistance");
});

test("an exercise with no arm gets no arm — never a silent default", () => {
  const result = mapWorkout({ ...BASE, exercise: "deadlift" }, { fibre, signalling: null });
  assert.equal(result.category, null);
  assert.equal(result.signalling, null);
  assert.equal(armFor("deadlift"), null);
  assert.match(whyOf(result, "exercise"), /deadlift/);
});

test("the protocol numbers are read from the archive, never typed here", () => {
  // Mutate the protocol and the mapping has to move with it. A constant `10`
  // written into this module would survive the archive changing underneath it,
  // which is how a screen ends up quoting a run that is no longer shipped.
  const doctored = { id: "doctored", protocol: { repetitions: 3, cycle_s: 1, t_recovery_s: 2 },
    provenance: { whose_protocol: "OURS, all of it" } };
  const result = mapWorkout(BASE, { fibre: doctored, signalling: resistance });
  assert.deepEqual(result.fibre, { scenario: "doctored", repetitions: 3, cycleS: 1, recoveryS: 2, whose: "OURS, all of it" });
  assert.match(whyOf(result, "reps"), /3/);
  assert.match(whyOf(result, "reps"), /OURS, all of it/);
  // And the real one reports the real one.
  assert.deepEqual(map({}).fibre, { scenario: "soce_on", repetitions: 10, cycleS: 0.65, recoveryS: 6.5, whose: fibre.provenance.whose_protocol });
  assert.deepEqual(map({}).signalling, {
    scenario: "fowler_resistance",
    input: "ResistanceExercise",
    level: 1,
    minutes: 45,
  });
});

test("handing it the wrong arm's file is an error, not a mislabelled screen", () => {
  // fowler_endurance holds EnduranceExercise = 1. Drawn under the word
  // "resistance" it would be a caption contradicted by its own bytes, and
  // nothing downstream would notice.
  assert.throws(
    () => mapWorkout(BASE, { fibre, signalling: endurance }),
    /resistance/,
  );
});

test("the ten-repetition run is ours, and the screen does not hand it to Francis", async () => {
  // The worst place in the app to get an attribution wrong: this panel's whole
  // job is saying which numbers are the authors' and which are ours, and its
  // badge tooltip already reads "The translation is ours, not theirs".
  //
  // It read "10 repetitions is what Francis ran" and "the 6.5 s Francis holds
  // after the last repetition". Three sources say otherwise. The authors'
  // MakeFigs.m has no live call at this cycle and this frequency — :171 is the
  // one that would and it is commented out — and no recovery segment at all.
  // ampk_francis_soce_on.json's own record calls the Francis protocol "ours".
  // And CellReadout.jsx says the same thing one scale down.
  //
  // Read out of `provenance`, not `protocol`: the sentence moved there on
  // 2026-08-28 so the record every value carries holds it, which is what puts
  // it in the source panel on the fibre and cell scales as well as here.
  //
  // Fixed by reading the attribution out of the bytes instead of writing a new
  // one here, which is what the rest of this module already does with counts.
  const attribution = fibre.provenance.whose_protocol;
  assert.ok(attribution?.length > 20, "soce_on ships no attribution for its protocol");
  assert.match(attribution, /ours/i);

  for (const field of ["reps", "restS"]) {
    const why = whyOf(map({}), field);
    assert.doesNotMatch(why, /Francis (ran|holds|runs)/, `${field} hands our protocol to Francis`);
  }
  assert.ok(whyOf(map({}), "reps").includes(attribution), "the reps sentence does not quote the file");
});
