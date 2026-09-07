/**
 * "60 kg · 10 reps · 3 sets · 90 s rest" translated onto the protocols that were
 * actually run. PRD-v2 §5.2 and §9.1, evidence label `Mapped`.
 *
 * WHAT THIS IS FOR. Francis's input surface is a fixed 0.65 s cycle at 100 Hz,
 * ten times. Fowler's is two dimensionless scalars in [0, 1] held for 45
 * minutes, and `fowler_resistance.json:protocol.input_surface` says in the
 * shipped bytes that nothing calibrates 1.0 against %1RM or %VO₂max. So there is
 * no function from kilograms to anything either model consumes, there never
 * will be, and PRD-v2 §10 lists inventing one among the things this product does
 * not do. The mapping is therefore mostly a record of what a workout does NOT
 * reach — which is the honest shape of it, not a failure of it.
 *
 * CONTRACT — every key of the input appears exactly once across `consumed` and
 * `dropped`, and every entry carries a sentence. A field read off the form and
 * listed in neither is a number the screen implies was used and was not; that is
 * the defect this whole module is built to make impossible rather than unlikely.
 * Derived points: `workoutMapping.test.js` pins the exhaustiveness against
 * several inputs. There is no longer a rendering one.
 *
 * `mapWorkout` REACHES NO PIXEL AS OF 2026-08-30. Canon H2 deleted the form
 * that fed it (`WorkoutInput.jsx`) and the browser case that watched its
 * sentences move (`tests/workout-mapping-reaches-the-screen.spec.js`), which is
 * the whole of what used to be listed here. It is kept rather than deleted with
 * them for one reason and it is not sentiment: `armFor` in this same file is
 * live — `signalling/SignallingScale.jsx` uses it to decide which of Fowler's
 * two arms a visitor arrived on — and the two share the roster that decides it.
 * If nothing has claimed `mapWorkout` by the time the papers are reattached,
 * delete it; do not build a screen to justify it. Flagged in the handover
 * rather than left for someone to find as a surprise.
 *
 * Nothing about the protocols is typed here. Both come in as loaded scenarios
 * and every count, cycle length and duration is read off `protocol`, so an
 * archive that changes moves this screen with it instead of leaving it quoting
 * a run that is no longer shipped.
 */
import { canonicalExerciseId } from "./motion/registry.js";

/**
 * Which of Fowler's two exercise inputs each exercise is drawn as.
 *
 * `Mapped`, and ours: the paper models a resistance bout and an endurance bout
 * and says nothing about bench presses. The assignment is by movement class
 * only — never by load or rep count, because no rep range anywhere in that
 * archive is tied to either scalar, and picking a threshold here would be
 * re-fitting a published input by hand.
 *
 * An exercise that is not here gets no arm. There is no default: defaulting to
 * resistance would draw a caption the model was never asked to support.
 */
const ARM = {
  bench_press: "resistance",
  push_up: "resistance",
  pull_up: "resistance",
  lunge: "resistance",
  running: "endurance",
  swimming_freestyle: "endurance",
};

/** The signalling arm for an exercise, or null. Any spelling; never throws. */
export function armFor(exercise) {
  return ARM[canonicalExerciseId(exercise)] ?? null;
}

const num = (value) => (Number.isFinite(+value) ? +value : 0);

export function mapWorkout(input, { fibre, signalling }) {
  const { exercise, kg, reps, sets, restS } = input;
  const category = armFor(exercise);
  const cycles = num(reps) * num(sets);

  const f = fibre.protocol;
  const drawnFibre = {
    scenario: fibre.id,
    repetitions: f.repetitions,
    cycleS: f.cycle_s,
    recoveryS: f.t_recovery_s,
    /* WHOSE PROTOCOL IT IS, quoted rather than restated. This panel said "10
       repetitions is what Francis ran" and "the 6.5 s Francis holds after the
       last repetition" — handing our protocol to the authors on the one screen
       built to keep those apart, under a badge whose sentence reads "The
       translation is ours, not theirs". Neither is in their script. The fact
       lives beside the numbers in `generate.py:WHOSE_PROTOCOL`; an attribution
       typed here is a second copy that goes stale exactly the way that one did.

       IT MOVED, on 2026-08-28, out of the payload's `protocol` block and into
       the provenance record. The comment here used to end "and this module
       prints it", and this module did not print it — nothing rendered `whose`,
       so the sentence shipped in the file, was read into this object and
       reached no pixel. The record is what `Evidence.jsx` opens, so putting it
       there is what makes it pressable rather than present. */
    whose: fibre.provenance?.whose_protocol,
  };

  let drawnSignalling = null;
  if (category) {
    // The file has to agree with the word above it. Reading the active scalar
    // back out of the protocol block is what makes wiring the wrong arm an
    // error here rather than a caption nobody checks.
    const expected = `${category[0].toUpperCase()}${category.slice(1)}Exercise`;
    if (!(signalling?.protocol?.[expected] > 0)) {
      throw new Error(
        `the ${category} arm must be a scenario holding ${expected} > 0; got "${signalling?.id}"`,
      );
    }
    drawnSignalling = {
      scenario: signalling.id,
      input: expected,
      level: signalling.protocol[expected],
      minutes: signalling.protocol.bout_minutes,
    };
  }

  const consumed = [];
  const dropped = [];

  if (category) {
    consumed.push({
      field: "exercise",
      value: exercise,
      reaches: `picks the animation, the muscle roles, and which of Fowler's two inputs is held at ${drawnSignalling.level.toFixed(1)} for ${drawnSignalling.minutes} min — ${drawnSignalling.input}. A switch, not a dose.`,
    });
  } else {
    dropped.push({
      field: "exercise",
      value: exercise,
      why: `"${exercise}" is not one of the movements with a signalling arm, so no published protocol applies to it and none is drawn.`,
    });
  }

  dropped.push({
    field: "kg",
    value: kg,
    why: `${num(kg)} kg reaches no model — neither archive calibrates its exercise input against %1RM, so every load draws the same frames.`,
  });

  dropped.push({
    field: "reps",
    value: reps,
    why: `${num(reps)} repetitions: the fibre and cell scales play the archived ${drawnFibre.repetitions}-repetition run at ${drawnFibre.cycleS} s a cycle, whatever you type. Nothing recomputes, and the count is not the authors' — ${drawnFibre.whose}`,
  });

  dropped.push({
    field: "sets",
    value: sets,
    why: `${num(sets)} sets: neither archive has any inter-set structure to run them against — each is one continuous run.`,
  });

  dropped.push({
    field: "restS",
    value: restS,
    why: `${num(restS)} s of rest is not modelled. The only recovery in either archive is the ${drawnFibre.recoveryS} s held after the last repetition — and that segment is ours too, not the authors': their script has no way to end this protocol other than switching the stimulus off, which is what we did.`,
  });

  return Object.freeze({
    evidence: "Mapped",
    category,
    cycles,
    fibre: drawnFibre,
    signalling: drawnSignalling,
    consumed,
    dropped,
  });
}
