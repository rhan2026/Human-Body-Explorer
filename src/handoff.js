/**
 * ── WHAT ONE FLOOR HANDS THE NEXT ────────────────────────────────────────────
 *
 * The four floors are built by four sessions that never read each other's
 * files. This module is the only thing they share, and it exists because on
 * 2026-09-05 the entire cross-floor state was ONE STRING: `main.jsx` held
 * `cameFrom`, a muscle name, and nothing else survived a scale change. Both the
 * BODY lane and the FIBER lane opened their first message by asking for the
 * same missing thing, independently, within a minute of each other.
 *
 * CONTRACT — this is the whole of what crosses a floor boundary. A floor's
 * internals do not belong here and never travel: `fiberSimulation`'s state,
 * the cell's pools, the network's 108 background species are each their own
 * floor's business. What travels is what the NEXT floor cannot recompute and
 * would otherwise have to invent.
 *
 * Derived points — everything that reads or writes a handoff, enumerated so a
 * field added here has a findable set of consumers:
 *   `main.jsx`          holds it for as long as the viewer is below the body,
 *                       clears it on arrival at the body, merges it into the
 *                       `state` every scene is given.
 *   `crossing.js`       carries it on the ride object (`beginDescent`).
 *   `MotionScene.jsx`   writes the body→fiber one (the muscle that was picked).
 *   `wayin/WayIn.jsx`   writes the two deep ones (fiber→cell, cell→signalling).
 *   `scaleRoute.js`     writes NONE of it. The address stays two segments; the
 *                       decision of 2026-08-30 stands, and `scaleRoute.test.js`
 *                       pins it. A handoff is what a WALK carries, not what a
 *                       link carries — which is also the honest answer for a
 *                       shared URL: nobody walked in, so nothing was handed.
 *
 * ── THE CLOCKS ARE NOT ONE CLOCK, AND THIS FILE REFUSES TO PRETEND ───────────
 *
 * `scaleRoute.js` already paid for this once. An instant used to ride in the
 * hash, and a descent at 3.9 s of a bench press landed at 3.9 s of a ten-
 * repetition protocol — "inside the right bout, a different repetition, and
 * nothing calibrates the hand-authored loop against the published one". The
 * number left the grammar on 2026-08-30 for exactly that reason.
 *
 * So a position never travels as a bare number. It travels as `{clock, t}`,
 * and the three clocks are different lengths of different things:
 *
 *   CLOCK.body      one loop of a hand-authored movement. Bench press 4.4 s.
 *                   Ours. Not calibrated against anything published.
 *   CLOCK.protocol  12.96 s — Francis, TEN repetitions of 0.65 s then 6.5 s of
 *                   recovery (`soce_on.json`.protocol). FIBER and ENERGY stand
 *                   on this same run, which is the one place a position really
 *                   does transfer.
 *   CLOCK.session   2,640 s — Fowler's 44 minutes. A different scale of TIME,
 *                   not a longer take of the same one.
 *
 * An arriving floor reads `clock` FIRST and decides. Same clock: use `t`.
 * Different clock: use nothing, and say on screen that the timescale changed
 * (the ENERGY→SIGNALS beat is written to do exactly that). What a floor must
 * never do is take a `t` whose clock it does not share — that is the silent
 * snap CLAUDE.md §5 forbids, and it is why the field is shaped so the mistake
 * requires ignoring a value rather than forgetting one.
 *
 * `rep` is the exception and the reason it is a separate field: FIBER and
 * ENERGY are both on Francis's ten repetitions, so "you came down at rep 7" is
 * a fact that genuinely survives that seam. It is null everywhere else. It is
 * NOT derived from `t` here — the floor that owns the run computes it, because
 * the cycle length is read off the loaded scenario and this module loads
 * nothing.
 *
 * ── ABSENT IS A VALUE ────────────────────────────────────────────────────────
 *
 * Every field may be null and null means "not known", never "zero" and never a
 * default. `armFor` already works this way and says why: "An exercise that is
 * not here gets no arm. There is no default: defaulting to resistance would
 * draw a caption the model was never asked to support." The muscle's fibre
 * `axis` is the live case — the BODY lane reported on 2026-09-05 that it is
 * still checking whether the data exists, and said it would send nothing rather
 * than something if it does not. A receiving floor branches on null; it does
 * not fill one in.
 */

import { armFor } from "./workoutMapping.js";
import { canonicalExerciseId } from "./motion/registry.js";

/**
 * The three clocks behind the four floors, named so a position can say which
 * one it belongs to.
 *
 * CONTRACT — this is the only list of clocks. The lengths are NOT here: each is
 * read off the scenario or the motion that owns it, because a number typed here
 * is a second copy that drifts the first time an archive is re-shipped. What is
 * here is only the identity, which is what a receiving floor compares.
 */
export const CLOCK = Object.freeze({
  /** One loop of a hand-authored movement. BODY. */
  body: "body",
  /** Francis's ten repetitions. FIBER and ENERGY share it. */
  protocol: "protocol",
  /** Fowler's 44 minutes. SIGNALS. */
  session: "session",
});

/**
 * Which clock a floor stands on. The pair that shares one is the pair a
 * position transfers across, and it is the only pair.
 */
export const CLOCK_OF_SCALE = Object.freeze({
  body: CLOCK.body,
  fiber: CLOCK.protocol,
  cell: CLOCK.protocol,
  signalling: CLOCK.session,
});

/**
 * Why the viewer is going down — the bridge the transition is ABOUT, in the
 * product's own words rather than a direction.
 *
 * Each seam has one and they are not interchangeable: the descent into a muscle
 * is spatial, the one into the cell follows a molecule, and the one into the
 * network is not a descent at all — the camera pulls BACK and AMPK becomes one
 * relay among many. A floor reads this to decide what its arrival should look
 * like, which is what stops the third seam being drawn as a fourth zoom.
 */
export const BRIDGE = Object.freeze({
  /** BODY → FIBER. The picked muscle stays the subject; everything else goes. */
  muscle: "muscle",
  /** FIBER → ENERGY. Follow the ATP that the last pull spent. */
  atp: "atp",
  /** ENERGY → SIGNALS. Pull back: AMPK becomes one node in a larger network. */
  ampk: "ampk",
});

/** The bridge each seam uses, keyed `from>to`. Absent for a seam with none. */
const BRIDGE_OF_SEAM = Object.freeze({
  "body>fiber": BRIDGE.muscle,
  "fiber>cell": BRIDGE.atp,
  "cell>signalling": BRIDGE.ampk,
});

/** The bridge concept for a seam, or null when the two floors are not adjacent. */
export function bridgeFor(from, to) {
  return BRIDGE_OF_SEAM[`${from}>${to}`] ?? null;
}

/**
 * Does a position taken on `from` mean anything on `to`?
 *
 * The whole of the guard, and it is one comparison rather than a table, because
 * the question is never "are these floors adjacent" — it is "are they reading
 * the same run". `fiber` → `signalling` (a Go Home and back in) is as wrong as
 * `cell` → `signalling`, and a table of seams would have missed it.
 */
export function clockSurvives(from, to) {
  return CLOCK_OF_SCALE[from] !== undefined && CLOCK_OF_SCALE[from] === CLOCK_OF_SCALE[to];
}

/**
 * Build a handoff. Every field optional; what is not known is not there.
 *
 * FROZEN, because four sessions write these and a mutable one is a floor
 * reaching into another floor's state through the back door — which is the
 * exact thing this module exists to make impossible rather than unlikely.
 *
 * `arm` is DERIVED, not passed: it is `armFor(exercise)` and there is one
 * roster of arms in this app. A caller that could pass its own would be a
 * second place an exercise gets classified, and the two would disagree the
 * first time a movement is added.
 */
export function makeHandoff({
  from = null,
  to = null,
  exercise = null,
  muscle = null,
  run = null,
  clock = null,
  t = null,
  rep = null,
  at = null,
  phaseName = null,
  condition = null,
  ampk = null,
  phosphate = null,
  phosphateFraction = null,
} = {}) {
  const id = exercise ? canonicalExerciseId(exercise) : null;
  /* THE POSITION IS DROPPED AT THE BOUNDARY IT CANNOT CROSS, here rather than
     at each arrival, for `serializeHash`'s reason: "a forgotten field cannot
     put an instant back in the address bar". A floor that forgets to check
     `clock` still cannot read a number that means something else, because
     there is no number to read. */
  const carries = from && to ? clockSurvives(from, to) : true;
  return Object.freeze({
    from,
    to,
    bridge: from && to ? bridgeFor(from, to) : null,
    exercise: id,
    /** `resistance` | `endurance` | null. The one roster (`workoutMapping.js`). */
    arm: armFor(id),
    /**
     * `{key, label, group, role, meshNames, centroid, axis}` — whatever the
     * BODY floor knew.
     *
     * `axis` IS THE FIBRE DIRECTION AND THE DATA IS THERE. This said it was
     * "null until the mesh set is confirmed to carry one"; the BODY lane
     * confirmed it on 2026-09-05 by reading `rig.json` directly — **140 of the
     * 146 roster meshes carry an axis**, and the two sides mirror properly
     * (pectoralis major left `[0.752, 0.185, -0.632]`, right `[-0.752, 0.190,
     * -0.631]`). Six drop out and those are the nulls.
     *
     * IT STILL REACHES NOTHING, AND THE GAP IS ONE PROP. Measured the same day:
     * BODY emits it, this module carries it, `main.jsx` puts it on
     * `state.handoff` — and `DevFiberScene.jsx` passes fourteen props to
     * `MuscleFiberVisualization` without it, so `axis` defaults to null and
     * `FiberScene`'s `if (!axis) { quaternion.identity(); return; }` takes the
     * early return. The rotation is not dead code and never was; it has been
     * one line short of a caller.
     */
    muscle: muscle ? Object.freeze({ ...muscle }) : null,
    /** The scenario id the position was taken in, or null. */
    run: carries ? run : null,
    /** Which clock `t` belongs to. Never omitted when `t` is present. */
    clock: carries ? clock : null,
    /** Position on `clock`, in seconds. Null across a clock change. */
    t: carries && Number.isFinite(t) ? t : null,
    /**
     * Repetition index on Francis's protocol. Null off it.
     *
     * ONE-BASED, and it is written down because an off-by-one across a seam is
     * invisible: the FIBER lane computes it as `floor(t / cycle_s) + 1` clamped
     * to `repetitions`, so the first repetition is 1 and the tenth is 10. A
     * floor reading this as an array index lands one repetition early and every
     * frame of it still looks plausible — cell.md §12's "Rep 7에서 내려왔으면
     * ENERGY도 Rep 7" would quietly become Rep 6 and nothing on screen would
     * say so.
     *
     * AND THERE IS A SECOND `rep` IN THIS APP, ONE APART. `energyBinding.js`'s
     * `repAt()` returns a ZERO-based index (`floor((t - t0) / REP_SECONDS)`,
     * clamped to `REPS - 1`) and is right to: `cellTour.js` uses it to index
     * `inst.onsets[]`. Both are correct and internally consistent; the hazard is
     * only that one word names two things a repetition apart. Enumerated here
     * because this is the declaration site (CLAUDE.md §3) and because the FIBER
     * lane measured the two disagreeing in the wild — the ENERGY strip lighting
     * rep 7 while `__cellState().rep` reported 6.
     *
     * WHY IT TRAVELS AT ALL, WHEN `t` IS ALREADY HERE — and it is NOT the
     * reason this comment gave for an hour on 2026-09-05.
     *
     * I read the gap between what FIBER sends (t=4.014) and where ENERGY seats
     * itself (3.931) as a constant −83 ms grid snap, and wrote that the seam had
     * 31 ms of margin before every arrival would land a repetition early. That
     * was wrong, and the ENERGY lane refused the fix it implied with the
     * arithmetic: the offset is a designed SEEK, not a snap. The arriving floor
     * jumps to that repetition's own burst onset —
     * `onsets = [0.026, 0.676, 1.301, …]` — so rep 7 lands on
     * `onsets[6] + 0.029 = 3.931`. Both numbers sit inside `[3.90, 4.55)`.
     * `onsets[r]` is BY CONSTRUCTION within `[r·0.65, (r+1)·0.65)`, so no phase
     * can carry it into a neighbouring repetition. There is no margin to run
     * out, and the constant −83 ms was just FIBER's peak phase (0.114) minus
     * ENERGY's onset phase (0.026), which is a difference of landmarks and not
     * a drift.
     *
     * The real reason is smaller and holds: deriving the repetition needs the
     * receiver to know `REP_SECONDS` and `t0` — the sender's arithmetic,
     * re-implemented on the far side of a boundary. Carrying it keeps that in
     * one place.
     *
     * AND A FLOOR MAY LEGITIMATELY IGNORE IT. The ENERGY strip is a CLOCK: a
     * visitor arriving in the rest phase (rep 10, which has no burst) watches
     * rep 1's burst replayed, and the strip has to show the repetition being
     * PLAYED rather than the one they left. Pinning it to this field would make
     * it lie in exactly that case. `rep` is what was true at the press; what a
     * floor draws is the floor's own business.
     */
    rep: carries && Number.isInteger(rep) ? rep : null,
    /**
     * Phosphate around the contractile machinery when the viewer left — µM,
     * sampled from the run's own `Pi_myo_total`, and the fraction of that run's
     * maximum. The FIBER lane measured 1504.5 → 7492.0 over the archive and
     * 1505 → 6120 across the ten repetitions.
     *
     * FLAT, WHERE `ampk` IS BUNDLED, AND THE DIFFERENCE IS NOT STYLE. Both are
     * readings that must not be read as belonging to the scene they land in.
     * `ampk` has to survive a change of clock — it IS the ENERGY → SIGNALS
     * bridge — so it carries its run inside itself, because nothing else can
     * hold the two together across that boundary. Phosphate never crosses one:
     * it is the FIBER → ENERGY fact and those two floors share Francis's run.
     * So it is gated by `carries` like `t`, `rep` and `run`, and it vanishes
     * with the run it belongs to rather than outliving it. An orphan number is
     * unreachable either way; this way costs no shape.
     *
     * The normalisation is ours and the value is the authors' — the FIBER lane
     * says so explicitly, and the same split `storeFraction` already uses.
     */
    phosphate: carries && Number.isFinite(phosphate) ? phosphate : null,
    phosphateFraction: carries && Number.isFinite(phosphateFraction) ? phosphateFraction : null,
    /** Where on the glass the viewer pressed, for the ride to grow out of. */
    at: Array.isArray(at) && at.every(Number.isFinite) ? Object.freeze([...at]) : null,
    /**
     * What the MOVEMENT was doing when the viewer left the body — "Pressing ·
     * concentric" and the like, the body scale's own phase word.
     *
     * A NAME, NOT A POSITION, which is why it is not clock-gated when `t` from
     * the same floor is. The body's clock is one loop of a hand-authored
     * movement and nothing calibrates it against Francis's protocol, so 3.9 s
     * cannot cross — but "they came down during the press" stays true wherever
     * they land, in the same way `condition` does.
     *
     * IT IS THE BODY'S PHASE AND NOT THE DESTINATION'S. FIBER and ENERGY have
     * phases of their own — a repetition's contraction and its recovery — and
     * this is not one of them. A floor that draws it must say whose it is or
     * not draw it; showing it beside a protocol timeline would claim the two
     * clocks line up, which is the thing this module exists to prevent.
     */
    phaseName: phaseName ?? null,
    /**
     * Which arm of the ENERGY floor's own experiment was running when the
     * viewer left it — `normal` | `calciumOff`. A CONTROL STATE, not a measured
     * quantity, which is why it is not clock-gated: "they had the calcium path
     * switched off" stays true across a change of timescale in a way that a
     * position does not.
     */
    condition: condition ?? null,
    /**
     * The AMPK reading the viewer left ENERGY on, and it travels WITH ITS RUN.
     *
     * This is the one number that crosses the clock change, and it only gets to
     * because it is not a position — it is the state the cell was in. The
     * `run` beside it is the whole of what makes that honest: SIGNALS draws
     * AMPK too, off a different archive over 44 minutes, and a bare
     * `fraction` landing there would read as a value of the scene it arrived
     * in. Bundled rather than spread across three fields so the number cannot
     * be picked up without the run it was measured in.
     *
     * NOT COMPUTED HERE, and no shape is guessed: the ENERGY floor passes what
     * its own scenario holds. `run` falls back to the handoff's own because a
     * reading and a position taken on the same floor came from the same file.
     */
    ampk: ampk ? Object.freeze({ ...ampk, run: ampk.run ?? run ?? null }) : null,
  });
}

/**
 * What the arriving floor should SAY about time, or null when there is nothing
 * to say.
 *
 * Returned as a fact rather than a sentence: the floor writes its own words —
 * SIGNALS already has the one worth keeping ("Above, we followed individual
 * contractions. Here, we zoom out in time too."). What this answers is only
 * *whether* the timescale changed, so a floor cannot forget to mention it and
 * cannot claim it did not.
 */
export function timeShift(handoff) {
  const from = CLOCK_OF_SCALE[handoff?.from];
  const to = CLOCK_OF_SCALE[handoff?.to];
  if (!from || !to || from === to) return null;
  return Object.freeze({ from, to });
}
