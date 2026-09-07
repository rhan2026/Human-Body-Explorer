/**
 * What a muscle fiber is doing at time t, as numbers. No Three.js in here.
 *
 * The scene renders this and nothing else, so the same state can later be
 * produced by the real exercise clock instead of the prototype's controls
 * without the geometry knowing the difference.
 *
 * ---------------------------------------------------------------------------
 * Scientific standing, stated here because the repo's rule is to say which is
 * which (docs/what-good-looks-like.md, "Anatomically real, even when it barely
 * shows"):
 *
 * MEASURED — the filament lengths. Thick filament 1.6 um, thin filament 1.0 um
 * from the Z-disc, Z-disc ~0.05 um, resting sarcomere ~2.2 um. These are
 * standard vertebrate skeletal-muscle values and they are the reason the A-band
 * never changes length while the I-band and H-zone close, which is the single
 * checkable claim the sarcomere view makes.
 *
 * ILLUSTRATIVE — everything with a rate in it. The calcium transient, the Hill
 * curve binding it to activation, the length-tension relation and the ATP
 * counter are textbook shapes with plausible constants, not a fitted model and
 * not bound to PRD section 9. They exist to make the mechanism legible. When a
 * real calcium model lands (OPEN_QUESTIONS item on ExerciseModel / Zenodo
 * 10257879), it replaces `advance` and the geometry is untouched.
 * ---------------------------------------------------------------------------
 */

import { phaseAt as phaseOf } from "../motion/ease.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ---- filament geometry, in micrometres ----------------------------------- */

export const FILAMENT = {
  /** Thick filament. Sets the A-band, and never changes length. */
  thick: 1.6,
  /** Thin filament, measured from the Z-disc it is anchored to. */
  thin: 1.0,
  zDisc: 0.05,
  /** Slack length, near the peak of the length-tension curve. */
  restLength: 2.2,
  /**
   * Shortest length this model draws. Below about 2.0 um the thin filaments
   * from opposite Z-discs meet at the M-line and start to overlap each other,
   * which is real but is not something the geometry represents, so the H-zone
   * is reported as closed and the sarcomere is not taken far past it.
   */
  minLength: 1.9,
};

/**
 * Band widths at a given sarcomere length. This is pure geometry — given where
 * the Z-discs are and how long the filaments are, there is nothing to choose.
 *
 * Origin is one Z-disc, so the M-line sits at length/2.
 */
export function bands(length) {
  const halfA = FILAMENT.thick / 2;
  const half = length / 2;
  // Distance from a Z-disc to the near edge of the A-band.
  const iBandHalf = Math.max(0, half - halfA);
  // Thick filament with no thin filament alongside it, either side of the M-line.
  const hZone = Math.max(0, length - 2 * FILAMENT.thin);
  // Where thin and thick actually lie side by side. Only here can a cross-bridge form.
  const overlap = clamp(FILAMENT.thin - iBandHalf, 0, FILAMENT.thick / 2);

  return {
    aBand: FILAMENT.thick,
    iBand: iBandHalf * 2,
    iBandHalf,
    hZone,
    overlap,
    /** Fraction of the thick filament with thin filament available to bind. */
    overlapFraction: clamp(overlap / (FILAMENT.thick / 2), 0, 1),
  };
}

/* ---- modes --------------------------------------------------------------- */

/**
 * Contraction patterns. `rep` is driven by whatever motion is handed in (see
 * src/motion/definition.js); the other three are the standard laboratory
 * stimulations, which are the honest thing to offer at this scale when no
 * motion is given — a single fiber on its own does not do a rep, it does a
 * twitch or it does a tetanus.
 */
export const EXERCISE_MODES = {
  twitch: {
    label: "Single twitch",
    note: "One stimulus. Calcium rises and is pumped back before force peaks.",
    period: 1.0,
    speed: 0.16,
    shortens: true,
  },
  tetanus: {
    label: "Tetanus",
    note: "Stimuli arrive faster than calcium clears, so twitches fuse.",
    period: 1.0,
    speed: 0.16,
    shortens: true,
  },
  isometric: {
    label: "Isometric hold",
    note: "Cross-bridges cycle at length. Force without shortening.",
    period: 2.0,
    speed: 0.5,
    shortens: false,
  },
  rep: {
    label: "Repetition",
    note: "Driven by the exercise's effort curve — illustrative, not a force model.",
    /* NO SECOND NOTE FOR A BOUND RUN, AND NO SECTION EITHER. This carried a
       `boundNote` — "From the published model's force, calcium and the store."
       — because the note above calls the contraction illustrative and that is
       false once a scenario drives it. The rule stands; the slot is gone. On a
       bound run `FiberControls` now hides this whole section, chips and heading
       together, so the replacement had nowhere to render and would have sat
       here looking live. What the run IS is said once, in `FiberMetrics`,
       outside every flag. */
    period: null, // the motion's own duration
    speed: 1,
    shortens: true,
  },
};

export const DEFAULT_MODE = "twitch";

function periodOf(mode, motion) {
  const spec = EXERCISE_MODES[mode] ?? EXERCISE_MODES[DEFAULT_MODE];
  return spec.period ?? motion?.duration ?? 1;
}

/**
 * Neural drive, 0 to 1, at time t. This is the only thing the mode changes;
 * everything downstream is shared. `motion` is only read by `rep`.
 */
function driveAt(mode, time, intensity, motion) {
  const period = periodOf(mode, motion);
  const t = ((time % period) + period) % period;

  switch (mode) {
    case "twitch":
      return t < 0.005 ? intensity : 0;
    case "tetanus": {
      const rate = 15 + 65 * intensity;
      return (t * rate) % 1 < 0.005 * rate ? intensity : 0;
    }
    case "isometric":
      return intensity;
    case "rep":
      return motion ? motion.effortAt(time) * intensity : 0;
    default:
      return 0;
  }
}

/* ---- kinetics ------------------------------------------------------------ */

/**
 * Free sarcoplasmic calcium, as a fraction of the peak a full tetanus reaches.
 *
 * Release from the terminal cisternae is fast and reuptake by SERCA is slow,
 * which is the whole reason a twitch outlasts its stimulus and why a fast train
 * fuses. Time constants are the right order for a fast fiber; they are not
 * fitted.
 */
const CA_RELEASE_TAU = 0.004;
const CA_UPTAKE_TAU = 0.045;

/**
 * Calcium to activation. Troponin C binding is cooperative, so the curve is
 * sigmoid rather than linear — a small rise in calcium near the middle of the
 * range produces most of the force.
 */
const CA_HALF = 0.35;
const CA_HILL = 3;

function activationFrom(calcium) {
  const c = Math.pow(clamp(calcium, 0, 1), CA_HILL);
  return c / (c + Math.pow(CA_HALF, CA_HILL));
}

/**
 * Length-tension. Force falls off either side of optimal because a sarcomere
 * that is too long has too few cross-bridges available and one that is too
 * short has its filaments interfering. Reported, not fed back into the length —
 * closing that loop needs a force model this prototype does not have.
 */
export function lengthTension(length) {
  const b = bands(length);
  const tooShort = clamp((length - 1.6) / 0.4, 0, 1);
  return clamp(b.overlapFraction, 0, 1) * tooShort;
}

export function createFiberState() {
  return {
    time: 0,
    drive: 0,
    /**
     * fraction_of_maximum, straight from the scenario, unmultiplied. null until
     * a scenario is bound, and `null` is load-bearing: it is how everything
     * downstream tells "the published force" from "the invented curve".
     */
    force: null,
    /**
     * SR calcium in µM, and the same reading as a fraction of this run's own
     * resting load. Both null unbound, for the same reason `force` is: the
     * invented curve has no store, and drawing an empty one would be a claim
     * about a quantity that is not being modelled at all.
     */
    store: null,
    storeFraction: null,
    /**
     * Myoplasmic phosphate in µM, and the same reading against this run's own
     * ceiling. Both null unbound, for the reason `store` is — the authors'
     * `Pi_myo_total` is what makes the force decline a mechanism, and the
     * invented curve does not have one.
     */
    phosphate: null,
    phosphateFraction: null,
    /**
     * Whether a stimulus is arriving at the T-tubules this instant. 0 unbound —
     * `stimulusAt` needs a protocol and the invented curve has none, so nothing
     * fires and the membrane is drawn as the membrane it is.
     */
    stim: 0,
    /** How far into the burst, 0..1, or null between bursts. */
    stimPhase: null,
    /** The bound scenario's evidence type, so the scene can label what it draws. */
    evidence: undefined,
    /**
     * How many times the bound scenario has been replayed from the top.
     *
     * FiberScene loops a finite run rather than sitting on its last sample, and
     * that loop is not free: at the seam the SR store jumps 716.6 -> 941.2 µM in
     * one frame, a 31% refill in the exact quantity this model's fatigue lives
     * in. Force is continuous across it (0.00014 -> 0.00053) so the seam is
     * invisible in the bars, which is what makes the store's teleport read as
     * physiology. The count is kept here so the readout can say it is a repeat.
     * Written by the scene, which owns the wrap; `advance` never wraps.
     */
    lap: 0,
    calcium: 0,
    activation: 0,
    length: FILAMENT.restLength,
    girth: 1,
    shortening: 0,
    crossBridges: 0,
    atp: 0,
    phase: "rest",
    phaseLabel: null,
    ...bands(FILAMENT.restLength),
    tension: lengthTension(FILAMENT.restLength),
  };
}

/**
 * Step the fiber forward by `dt` muscle-seconds.
 *
 * Mutates and returns `state`, because this runs inside useFrame and allocating
 * a new object 60 times a second to hold twelve numbers is not worth it.
 */
/**
 * Display transform, and NOT part of the published model.
 *
 * The scenario carries myoplasmic calcium in µM; the geometry wants 0..1. This
 * divisor is a drawing choice made here, so it is named here rather than buried
 * in the scene. Anything derived through it is a modelled concentration shown on
 * an invented scale, which is a weaker claim than the concentration itself.
 */
/* EXPORTED so the panel's trace and its bar cannot disagree. Both draw the same
   ratio — the bar as a width, the trace as a height — and two drawings of one
   number that use two axes are worse than one drawing. */
export const CA_FULL_SCALE_UM = 29.422;

/**
 * What "a full store" means, and it is deliberately NOT a constant beside the
 * one above.
 *
 * The store's resting load is a property of the run, not of muscle — `soce_on`
 * rests at 941.2 µM and `soce_off` at 930.5, and typing either here would put a
 * number on screen that the other run never had. So full is the run's own first
 * sample, read back out of the archive.
 *
 * EXPORTED FOR THE SAME REASON `CA_FULL_SCALE_UM` IS. The terminal cisternae
 * draw this ratio as a colour and the panel draws it as a trace; if the two
 * disagreed about full, the picture and the number beside it would be showing
 * different stores.
 *
 * `grid?.t0 ?? 0` rather than `grid.t0`, because `sample` already clamps
 * anything at or before the first sample onto it — so this answers with the
 * archive's first row for a fixture that publishes no grid at all.
 */
export const storeFullScale = (scenario) =>
  scenario.sample("Ca_SR_total", scenario.grid?.t0 ?? 0).value;

/**
 * The most phosphate this run ever holds, so the accumulation has a top.
 *
 * `Pi_myo_total` HAS SHIPPED IN EVERY FIBRE SCENARIO SINCE THE FIRST ONE and
 * nothing in `src/fiber/` has ever read it. `scenarioData.test.js` names it in
 * the schema and that is the only mention anywhere in the app. Meanwhile the
 * pass's closing line says *"waste around the strands took the pull"* and the
 * comment in `advance` names the authors' own attribution — force decline is
 * "largely attributed" to phosphate accumulation — so the floor has been making
 * a claim in words about a series it was shipping and not drawing.
 *
 * Measured on `soce_on`: 1504.5 -> 7492.0 µM over the 13 s file, monotonic, and
 * 1505 -> 6120 across the ten repetitions themselves — 4.07x. That is a bigger
 * swing than anything else on this floor and it had no channel at all.
 *
 * NOT THE FIRST SAMPLE, unlike `storeFullScale`. The store starts full and
 * empties, so its first row is its ceiling; phosphate starts low and builds, so
 * its first row is its floor. The ceiling is the run's own maximum, which for a
 * monotonic series is its last row — taken by scan rather than by index so a
 * run that is not monotonic still gets a true top rather than a wrong one.
 *
 * WHAT THIS IS AND IS NOT. Normalising a published series against its own range
 * is a display decision, the same one `storeFraction` already makes, and it is
 * ours. The VALUES are the authors'. Nothing here re-fits anything and nothing
 * invents a phosphate that the run does not contain.
 */
/* MEMOISED, AND THAT IS NOT AN OPTIMISATION DETAIL. `storeFullScale` is one
   `sample()` call and costs nothing to repeat inside `advance`; this walks the
   whole grid — 796 rows on `soce_on` — and `advance` runs every frame. Called
   raw it would be 47,760 samples a second to answer a question whose answer
   cannot change while the scenario is the same object. Keyed weakly so a
   scenario that goes out of scope takes its entry with it. */
const PI_CEILING = new WeakMap();

/** A reading, or null if this run does not publish that series at all. */
function safeSample(scenario, key, t) {
  try {
    const v = scenario.sample(key, t)?.value;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function phosphateCeiling(scenario) {
  if (!scenario) return 0;
  const cached = PI_CEILING.get(scenario);
  if (cached !== undefined) return cached;

  const grid = scenario.grid;
  let top = 0;
  if (!grid || !(grid.count > 1)) {
    top = safeSample(scenario, "Pi_myo_total", grid?.t0 ?? 0) ?? 0;
  } else {
    /* `{ t0, tEnd, count }` AND NOTHING ELSE. The first version of this walked
       `grid.t0` to `grid.t1` in steps of `grid.dt`, and neither field exists —
       `scenarioData.js` publishes no `dt` at all and says why: "The grid is NOT
       uniform... a single step size would describe neither half", because a run
       is a fine exercise phase and a coarse recovery. So the loop never ran,
       `top` stayed 0, and every grain of phosphate was hidden behind a
       fraction of exactly zero while `state.phosphate` read 2571.97 µM.
       Caught in a browser, not by a gate: the drawn field was empty under a
       line saying phosphate builds up.
       Stepping by the grid's own average spacing and letting `sample()` snap to
       the nearest stored row visits every row once — the same sweep
       `storeCeilings` and `storeEmptiestAt` already use, for the same reason. */
    const step = (grid.tEnd - grid.t0) / (grid.count - 1);
    for (let t = grid.t0; t <= grid.tEnd + 1e-9; t += step) {
      const v = safeSample(scenario, "Pi_myo_total", t);
      if (v !== null && v > top) top = v;
    }
  }
  PI_CEILING.set(scenario, top);
  return top;
}

/**
 * Where the store got back to at the end of each repetition, and when.
 *
 * THE CONCLUSION NEEDED SOMETHING TO COMPARE AGAINST. A design review muted the
 * guided pass and read its last beat cold: a pale ring frozen at 168 µM, with
 * nothing on screen saying what full had looked like. "Refills less each time"
 * is a comparison, and a single frame cannot hold one.
 *
 * These are the instants that can. Within each cycle, the store climbs back
 * toward its ceiling and is highest just before the next burst takes it again —
 * so the argmax lands ON the next stimulus, which is why the search excludes any
 * instant while the tubule is firing. Without that guard the "recovered" frame
 * freezes at maximum stimulation, which is the defect this whole helper is a
 * correction of: a beat whose point is that the supply is gone, drawn at the
 * moment the command is loudest.
 *
 * Measured on `soce_on`: 548.1 µM after the first repetition and 448.9 after the
 * tenth, 58% and 48% of the first sample. Ten points of ramp, which is small —
 * and that is exactly why it has to be a CUT between two frames at one camera
 * rather than a drift the eye is asked to remember across twenty seconds.
 */
export function storeCeilings(scenario) {
  const grid = scenario?.grid;
  const p = scenario?.protocol;
  if (!grid || !(grid.count > 1) || !(p?.cycle_s > 0) || !(p?.stim_s > 0) || !(p?.repetitions > 0)) return [];
  const step = (grid.tEnd - grid.t0) / (grid.count - 1);
  const firing = (t) => {
    const k = Math.floor(t / p.cycle_s);
    return k < p.repetitions && t - k * p.cycle_s < p.stim_s;
  };
  const out = [];
  for (let k = 1; k < p.repetitions; k += 1) {
    let bestT = null;
    let best = -Infinity;
    for (let t = k * p.cycle_s; t < (k + 1) * p.cycle_s; t += step) {
      if (t > grid.tEnd || firing(t)) continue;
      const v = scenario.sample("Ca_SR_total", t)?.value;
      if (typeof v === "number" && v > best) {
        best = v;
        bestT = t;
      }
    }
    if (bestT !== null) out.push({ rep: k + 1, at: bestT, value: best });
  }
  return out;
}

/**
 * The peak of every repetition: when it happened, and what force and calcium
 * were doing there.
 *
 * THIS IS WHAT THE FLOOR'S ENDING IS A COMPARISON OF. `storeCeilings` finds
 * where the store got back to; this finds where each pull got to. Measured on
 * `soce_on`, and the whole reason the fibre scale exists:
 *
 *     rep   peak force    peak calcium (µM)
 *      1      0.8713          27.145
 *      5      0.4852          29.422
 *     10      0.3239          26.743
 *
 * Force keeps 37.2% of the first repetition. Calcium keeps 98.5%. The command
 * is still arriving at full strength and the muscle is making a third of the
 * force from it — which is the sentence the floor closes on, and until this
 * helper existed it was only ever a sentence.
 *
 * EACH QUANTITY IS ITS OWN PEAK, AND THE FIRST DRAFT OF THIS GOT IT WRONG.
 * That draft let force pick the instant and then read calcium THERE, reasoning
 * that two quantities sampled at two different times are not a comparison. It
 * measures 21.31 -> 26.70 uM, which says the calcium signal GREW by 25% across
 * a set -- the opposite of what the run does and the opposite of what the floor
 * says. The cause is physiology: calcium leads force, and the lag between them
 * is not constant across repetitions, so a calcium reading taken at peak force
 * is taken at a different point of the transient every time.
 *
 * What is being compared is THE SIZE OF EACH PULSE -- how much calcium came out
 * against how much force came of it -- and the size of a transient is its own
 * maximum. Read that way it is 27.145 -> 26.743, the 98.5% above, which is also
 * the figure the comment inside `advance` has quoted all along.
 *
 * `at` IS THE FORCE PEAK AND `frameAt` IS THE PICTURE, AND THEY ARE NOT THE
 * SAME INSTANT. The bars are each repetition's own maximum, which is the honest
 * magnitude. The frozen FRAME cannot be, and a screenshot is why: the peaks
 * drift later within their cycle as the run tires —
 *
 *     rep  1   phase 0.114 s   (the stimulus is still on; stim_s is 0.1625)
 *     rep  6   phase 0.147 s
 *     rep 10   phase 0.164 s   (the stimulus has just ended)
 *
 * so the two frames the reveal cuts between differed in whether the T-tubule
 * was firing — orange in one and dark in the other. That is the ONE variable
 * the beat over them says does not change. Measured 2026-09-05 at 1440x900:
 * rep 1's frame drew four lit tubules and rep 10's drew none, under the line
 * "The calcium pulse barely changed."
 *
 * `frameAt` puts every repetition at the FIRST one's phase, so the cut isolates
 * what actually differs — how far the sarcomere shortens, how pale the store
 * is, how much phosphate has collected — and the command looks identical
 * because it is.
 *
 * SWEPT AT THE ARCHIVE'S OWN RESOLUTION, like every other instant this file
 * hands the storyboard. `sample()` snaps to the nearest stored row, so stepping
 * by the grid's own spacing visits each row once and the argmax is a row that
 * exists rather than an interpolation between two that do.
 *
 * Repetition numbers are 1-based, because they are shown to a person.
 */
export function forcePeaks(scenario) {
  const grid = scenario?.grid;
  const p = scenario?.protocol;
  if (!grid || !(grid.count > 1) || !(p?.cycle_s > 0) || !(p?.repetitions > 0)) return [];
  const step = (grid.tEnd - grid.t0) / (grid.count - 1);
  const out = [];
  for (let k = 0; k < p.repetitions; k += 1) {
    let atForce = null;
    let force = -Infinity;
    let calcium = -Infinity;
    let phosphate = -Infinity;
    for (let t = k * p.cycle_s; t < (k + 1) * p.cycle_s; t += step) {
      if (t > grid.tEnd) continue;
      const f = scenario.sample("force_relative", t)?.value;
      if (typeof f === "number" && f > force) {
        force = f;
        atForce = t;
      }
      const c = scenario.sample("Ca_myo_total", t)?.value;
      if (typeof c === "number" && c > calcium) calcium = c;
      /* Phosphate only rises, so its maximum in a cycle is wherever the cycle
         ends -- found the same way rather than by assuming that. */
      const pi = safeSample(scenario, "Pi_myo_total", t);
      if (pi !== null && pi > phosphate) phosphate = pi;
    }
    if (atForce === null) continue;
    out.push({
      rep: k + 1,
      at: atForce,
      /* Filled in below, once the first repetition's phase is known. */
      frameAt: atForce,
      force,
      calcium: Number.isFinite(calcium) ? calcium : null,
      phosphate: Number.isFinite(phosphate) ? phosphate : null,
    });
  }
  /* THE SHARED PHASE, TAKEN FROM THE FIRST REPETITION. Clamped inside the
     cycle so a run whose first peak is late cannot push a later repetition's
     frame past its own window. */
  if (out.length) {
    const phase = Math.min(out[0].at - 0 * p.cycle_s, p.cycle_s - 1e-6);
    for (const row of out) {
      const t = (row.rep - 1) * p.cycle_s + phase;
      row.frameAt = t <= grid.tEnd ? t : row.at;
    }
  }
  return out;
}

/**
 * When the store is at its emptiest, in this run's own seconds.
 *
 * SWEPT, NOT TYPED. `soce_on` bottoms at 167.9 µM at 5.202 s — the figure
 * `docs/fixing-prd.md` §2.1 quotes — and the guided pass parks there for its
 * last beat, because that instant beside a burst still arriving at full
 * strength IS the reading. Writing 5.202 into the storyboard would put a viewer
 * on a half-full store the first time the archive is re-exported, under a line
 * telling them it is empty.
 *
 * The sweep is `grid.count` points across the grid, which is the archive's own
 * resolution: `sample()` snaps to the nearest stored row, so this visits every
 * row once and the argmin is the stored minimum rather than an interpolation.
 */
export function storeEmptiestAt(scenario) {
  const grid = scenario?.grid;
  if (!grid || !(grid.count > 1) || !(grid.tEnd > grid.t0)) return null;
  const step = (grid.tEnd - grid.t0) / (grid.count - 1);
  let bestT = grid.t0;
  let best = Infinity;
  for (let i = 0; i < grid.count; i += 1) {
    const t = grid.t0 + i * step;
    const v = scenario.sample("Ca_SR_total", t)?.value;
    if (typeof v === "number" && v < best) {
      best = v;
      bestT = t;
    }
  }
  return Number.isFinite(best) ? bestT : null;
}

/**
 * Whether the run's own finding is true of the instant on screen, so the panel
 * can say it and stay quiet the rest of the time.
 *
 * MEASURED OVER THE SHIPPED RUNS, not asserted. From the second repetition to
 * the end of the stimulus, `soce_on` drops peak force 0.871 -> 0.324 rep by rep
 * while the store's per-rep ceiling falls 0.58 -> 0.48 of rest and never returns
 * to it; `soce_off` does the same. `rest_only` runs the same 13 s with
 * `repetitions: 0` and moves neither, which is why the count is in the condition
 * — a fatigue caption over an unstimulated fibre is a lie the clock alone would
 * not catch.
 *
 * THE WINDOW, NOT THE LIVE STORE, AND THAT IS THE WHOLE DESIGN. The live store
 * is a sawtooth: it empties inside each 0.1625 s stimulus and partly refills
 * over the rest of the 0.65 s cycle. A threshold on it would blink the sentence
 * on and off about twice a second. What falls is the CEILING, and a ceiling is
 * not something one instant has.
 *
 * Held to the shipped archives in `scenarioDrive.test.js`.
 */
export function forceIsFalling(t, protocol) {
  const { repetitions, cycle_s: cycle, t_exercise_s: work } = protocol ?? {};
  return repetitions > 0 && t >= cycle && t < work;
}

/**
 * The one sentence the stage carries when nobody is being shown anything.
 *
 * `forceIsFalling` used to be the whole of it, so the picture spoke for exactly
 * one stretch of the run and was wordless either side of it. Measured
 * 2026-08-26 at the hash `gate-legibility` shares — `fiber@6.1s`, which
 * free-runs to t = 10.75 — the fibre was in `rest` and said nothing at all,
 * while five sentences about it sat in the panel beside it.
 *
 * Three windows, because the protocol has three and each is a different thing
 * happening: before the second burst there is nothing to have fallen from yet,
 * during the work the force falls, and after the last burst the store refills.
 * Nothing is claimed that the run does not do — the store's own trace rises
 * through the recovery, which is what `fiberTour`'s conclusion compares.
 */
/* NOTHING RENDERS THIS TODAY, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.
   The owner settled the deep scales' four states on 2026-08-31 — states 1 and 4
   are both *"아무런 텍스트 없이 (Full Animation the default)"* — so the caption
   this returns left `MuscleFiberVisualization`'s sentence slot, which now draws
   only while the tour is speaking or a part is held open.
   Recorded here rather than deleted because this project's one recurring defect
   is text that is computed, carried and reaches no pixel, and the honest form of
   that is saying so at the source. The sentences are still graded by
   `fiberSimulation.test.js`; if this scale is ever given something to say
   between demonstrations, they are what it says. */
export function standingNote(t, protocol) {
  const { repetitions, cycle_s: cycle, t_exercise_s: work } = protocol ?? {};
  if (!(repetitions > 0)) return null;
  /* "HOLDING STILL. THE STORE IS FULL" WAS TRUE AT ONE INSTANT AND SHOWN FOR
     0.65 SECONDS. This window is `[0, cycle_s)` and the run's first burst fires
     at t=0 for 0.1625 s of it, so the T-tubule was at full orange under a
     sentence saying nothing was happening — and `Ca_SR_total` falls 941.2 to
     301.9 inside the same window, so the second half was false too.
     The pass's opening beat was corrected for exactly this on 2026-08-26 and
     gated in `fiberTour.test.js`; the gate reads BEATS, so the sentence a
     viewer sees when no pass is running kept the defect. Ported to
     `fiberSimulation.test.js` now, over every note this function returns.
     The window is not moved, because there is no quiet instant at the start of
     this run to move to — 941.2 µM exists only at t=0. The sentence says what
     the first cycle IS instead, in the shape the two below already use. */
  if (t < cycle) return "The first burst arrives. The store drops and comes back.";
  if (t < work) return "Force is falling. The store is running down.";
  return "The bursts are over. The store is filling back up.";
}

/**
 * Whether the stimulus is arriving at t. 1 inside a burst, 0 between them, and
 * 0 for the whole recovery once the last one has been and gone.
 *
 * THIS IS THE CAUSE OF EVERYTHING ELSE ON THE SCREEN AND IT REACHED NO PIXEL.
 * A 0.1625 s burst of 100 Hz stimulation arrives every 0.65 s, ten times, and
 * then 6.5 s of nothing — that is what empties the store, raises the tension
 * and fatigues the fibre, and `protocol` has carried it in the shipped file
 * since the export existed with `forceIsFalling` as its only reader. A viewer
 * watching the calcium had no way to learn on screen that a stimulus is why.
 *
 * THE FIELDS, AND WHOSE THEY ARE. `cycle_s` and `stim_s` are the authors'
 * `exerciseParam` and `freq_hz` is their stimulation frequency; `repetitions`
 * is OURS, and the file's own `whose_protocol` says so. Nothing is invented
 * here and nothing is rounded — the train is the fields, read back.
 *
 * 100 Hz IS NOT DRAWN AND MUST NOT BE. A hundred spikes a second cannot be
 * counted by eye and a scene that drew them would be drawing a strobe nobody
 * can read. What the burst is, at this scale, is 0.1625 s during which the
 * membrane is being driven — so it is drawn as one arrival, at its own length.
 */
export function stimulusAt(t, protocol) {
  const { cycle_s: cycle, stim_s: burst, repetitions: reps } = protocol ?? {};
  if (!(cycle > 0) || !(burst > 0) || !(reps > 0)) return 0;
  if (t < 0 || t >= reps * cycle) return 0;
  return t % cycle < burst ? 1 : 0;
}

/**
 * How far into the burst t is, 0 at its onset and 1 at its end. Null outside.
 *
 * THE MODEL'S STIMULUS IS BINARY AND THE DRAWING OF IT NEED NOT BE. `stimulusAt`
 * is the fact — a square wave, on for `stim_s` of every `cycle_s`, ten times —
 * and nothing here changes it: the window this reports opens and closes at
 * exactly the instants that function switches.
 *
 * What it buys is the SHAPE INSIDE the window, and `fiber.md` §3 is why one is
 * wanted: *"현재 T-tubule은 signal이 들어올 때 완전한 orange + emissive 0.9로
 * 튀는데... 역설적으로 변하지 않는 signal이 화면에서 가장 큰 변화가 돼버려."* A
 * square wave held at full strength for its whole window reads as ON, and the
 * one quantity on this floor that must not look like it is changing was the
 * loudest thing on the stage.
 *
 * A drawn envelope over this phase is a display decision and is ours, said once
 * here: the burst's onset, its end and its identical strength every repetition
 * are the model's, and how the flash fades between them is not a claim about
 * anything the archive measured.
 */
export function stimulusPhase(t, protocol) {
  const { cycle_s: cycle, stim_s: burst, repetitions: reps } = protocol ?? {};
  if (!(cycle > 0) || !(burst > 0) || !(reps > 0)) return null;
  if (t < 0 || t >= reps * cycle) return null;
  const into = t % cycle;
  return into < burst ? into / burst : null;
}

/**
 * How many bursts of the train have arrived by t, counted from one.
 *
 * WHY A COUNT AND NOT A CLOCK. The tubule above flashes and goes dark, and a
 * flash carries no memory: a viewer arriving at the sixth repetition sees the
 * same 0.1625 s arrival at the same brightness as the first and has no way to
 * know it is the sixth. The count is what makes the train legible as a train —
 * and it is the half of §2.1's reading that the picture could not draw, because
 * "the command is not getting weaker" is a statement about ten identical events
 * and one frame only ever shows one of them.
 *
 * IT IS NOT A DURATION. The owner's standing line is "i dont want timeframs
 * anywhere", so this answers "which one" and never "how long" — 3 of 10, never
 * 1.95 s. The instant is the scrubber's job and the span is nobody's.
 *
 * DERIVED FROM THE SAME TWO FIELDS `stimulusAt` READS, deliberately: the flash
 * and the count must never disagree about which burst is on, and two functions
 * reading one protocol cannot drift the way two hand-kept counters would.
 * `repetitions` is ours and the shipped file's `whose_protocol` says so, which
 * is why anything drawing this carries `Derived` rather than the authors' name.
 *
 * Clamped at `reps` rather than running on, so the recovery half reads "10 of
 * 10" — every burst has been and gone, and nothing more is coming. Running the
 * floor on would print an eleventh burst that the protocol never fired.
 */
export function burstsArrived(t, protocol) {
  const { cycle_s: cycle, repetitions: reps } = protocol ?? {};
  if (!(cycle > 0) || !(reps > 0) || !(t >= 0)) return 0;
  return Math.min(Math.floor(t / cycle) + 1, reps);
}

export function advance(state, dt, { mode = DEFAULT_MODE, intensity = 0.7, isActive = true, motion = null, scenario = null } = {}) {
  const spec = EXERCISE_MODES[mode] ?? EXERCISE_MODES[DEFAULT_MODE];
  const step = clamp(dt, 0, 0.05);
  state.time += step;

  // A bound scenario replaces the invented curve. This is the seam this file's
  // header promised: `advance` changes, the geometry below does not.
  //
  // Force and calcium are taken SEPARATELY from the model rather than one being
  // derived from the other, because in this model they do not move together.
  // Measured across ten repetitions of the exported run: force falls 0.871 ->
  // 0.324 while peak myoplasmic calcium moves 27.1 -> 26.7 µM, about 1.5%. The
  // fatigue lives in the force and in the store. **A scene that showed fatigue
  // by dimming the calcium would be inventing it**, which is what running the
  // calcium off the force lag would quietly do.
  let drive;
  if (scenario) {
    const force = scenario.sample("force_relative", state.time);
    if (!force.provenance?.evidence_type) {
      throw new Error("scenario reading carries no evidence type — an unlabelled number does not reach the geometry");
    }
    state.evidence = force.provenance.evidence_type;

    // `intensity` deliberately does NOT multiply this. It is a UI slider; a
    // published fraction_of_maximum times a slider is an invented number that
    // would inherit the scenario's `Derived` badge on its way to the screen.
    state.force = isActive ? clamp(force.value, 0, 1) : 0;
    drive = state.force;
    state.drive = drive;

    // Calcium is the model's own, on the display scale named above — not the
    // lag, which is the textbook shape this binding exists to replace.
    state.calcium = clamp(scenario.sample("Ca_myo_total", state.time).value / CA_FULL_SCALE_UM, 0, 1);

    // Raw µM. The store emptying across repetitions is the strongest fatigue
    // signal in the data, and the terminal cisternae are what hold it.
    state.store = scenario.sample("Ca_SR_total", state.time).value;

    // The same reading against this run's own resting load. Computed HERE and
    // carried on the state rather than worked out again in the geometry,
    // because the cisternae and the panel both draw it and they are not allowed
    // to disagree about how full a full store is.
    const full = storeFullScale(scenario);
    state.storeFraction = full > 0 ? clamp(state.store / full, 0, 1) : 0;

    /* PHOSPHATE, AND IT IS THE ANSWER THE FLOOR ENDS ON.
       Raw µM plus the same reading against this run's own ceiling, for exactly
       the reason the store carries both: the particles draw the fraction and
       anything printed draws the value, and they may not disagree about what
       full means. The authors attribute the force decline to this accumulation
       and the comment at the top of this branch already quotes the measurement
       — force 0.871 -> 0.324 while peak calcium moves 1.5%. This is the third
       quantity that makes that a mechanism rather than a mystery. */
    /* GUARDED, BECAUSE NOT EVERY BOUND RUN HAS THIS SERIES. Every fibre
       scenario the app ships carries `Pi_myo_total`, and reading it unguarded
       threw `no series "Pi_myo_total"` on the fixtures that do not — which is
       exactly the shape of a run somebody exports next year without it. A
       missing series is `null`, which is the same thing the unbound branch
       below writes and which the geometry already draws as no phosphate at
       all: absent, not zero, and never an exception on the frame loop. */
    const pi = scenario.has?.("Pi_myo_total") === false ? null : safeSample(scenario, "Pi_myo_total", state.time);
    state.phosphate = pi;
    if (pi === null) {
      state.phosphateFraction = null;
    } else {
      const piTop = phosphateCeiling(scenario);
      state.phosphateFraction = piTop > 0 ? clamp(pi / piTop, 0, 1) : 0;
    }

    // What fires. Not sampled from a series — there is no stimulus series; it
    // is the protocol the run was generated under, and the T-tubules are drawn
    // through it. Kept on the state for the same reason `storeFraction` is:
    // the scene must not work out a second opinion about when a burst is on.
    state.stim = stimulusAt(state.time, scenario.protocol);
    /* How far into the burst, for the tubule's flash. Null between bursts. */
    state.stimPhase = stimulusPhase(state.time, scenario.protocol);
  } else {
    // Everything the scenario branch wrote is cleared here, not left to decay.
    // A stale `evidence` is a `Derived` badge over an invented curve, and a
    // stale `force` would go on driving the sarcomere after the model is gone.
    state.force = null;
    state.store = null;
    state.storeFraction = null;
    /* Cleared with the rest, and for the identical reason `store` is: the
       invented curve has no phosphate series, so a stale accumulation would be
       waste piling up under a drive that is not spending anything. */
    state.phosphate = null;
    state.phosphateFraction = null;
    state.stim = 0;
    state.stimPhase = null;
    state.evidence = undefined;
    state.lap = 0;

    drive = isActive ? driveAt(mode, state.time, clamp(intensity, 0, 1), motion) : 0;
    state.drive = drive;

    // Calcium chases the drive up quickly and falls back slowly. Two time
    // constants on one first-order lag; the asymmetry is the mechanism.
    const tau = drive > state.calcium ? CA_RELEASE_TAU : CA_UPTAKE_TAU;
    state.calcium += (drive - state.calcium) * (1 - Math.exp(-step / tau));
  }

  // ILLUSTRATIVE in both branches — CA_HALF and CA_HILL are textbook, not
  // fitted. Bound, this is the model's calcium through an unfitted curve, so it
  // may cue a mechanism and may not be the number anything calls force.
  state.activation = activationFrom(state.calcium);

  // What shortens the sarcomere. Bound: the published force. Unbound: the
  // invented Hill output. `??` not `||` — an inactive scenario sets force to 0,
  // which must stay 0 and not fall through.
  //
  // The published model is ISOMETRIC and carries no length, so drawing a length
  // from force is a display choice of ours, not a modelled length.
  const contractile = state.force ?? state.activation;

  // Shortening lags activation — the load has to accelerate, and the fiber has
  // series elasticity in its tendon. A slower lag on release than on pull, for
  // the same reason a muscle relaxes more slowly than it contracts.
  const target = spec.shortens ? contractile : 0;
  const mechTau = target > state.shortening ? 0.035 : 0.07;
  state.shortening += (target - state.shortening) * (1 - Math.exp(-step / mechTau));

  state.length =
    FILAMENT.restLength - (FILAMENT.restLength - FILAMENT.minLength) * state.shortening;

  const b = bands(state.length);
  state.aBand = b.aBand;
  state.iBand = b.iBand;
  state.iBandHalf = b.iBandHalf;
  state.hZone = b.hZone;
  state.overlap = b.overlap;
  state.overlapFraction = b.overlapFraction;

  // A fiber holds its volume, so what it loses in length it puts back into
  // girth. Same rule the body rig uses in rig.js updateGirth — sqrt of the
  // length ratio — so the fiber thickens on contraction exactly as the whole
  // muscle does one scale up.
  state.girth = Math.sqrt(FILAMENT.restLength / state.length);

  // Bound cross-bridges: only where filaments overlap, only where calcium has
  // uncovered the binding sites.
  state.crossBridges = state.activation * b.overlapFraction;
  // Bound: the model's own fraction_of_maximum, untouched. Unbound: the invented
  // curve. Multiplying the published force by lengthTension() would apply our
  // length-tension relation on top of one the authors already fitted.
  state.tension = state.force ?? state.activation * lengthTension(state.length);

  // One ATP per cross-bridge cycle. An arbitrary unit deliberately — this is a
  // relative cost readout, not a rate in millimoles.
  state.atp += state.crossBridges * step * 60;

  if (mode === "rep" && motion) {
    const p = phaseOf(motion.phases, state.time, motion.duration);
    state.phase = p.name;
    state.phaseLabel = p.label ?? null;
  } else if (state.force != null) {
    /* BOUND: THE LABEL FOLLOWS THE FORCE THIS SCREEN IS DRAWING.
       Measured in a browser over one 0.65 s stride of `soce_on`: at t = 0.20 s
       the fibre held 0.787 of maximum and the State row said "At rest", with
       `Relative tension · 0.79 of maximum` printed directly under it. Four of
       nine samples across the stride did that.
       The rule underneath was written for the invented curve — `calcium > 0.5`
       with a fall-through on `shortening > 0.15` — and `shortening` is 0 for
       the whole of any bound run, so the fall-through was dead code and
       `PHASE_LABEL.relaxing` was a label nothing could reach. Calcium leaves
       the myoplasm long before the cross-bridges let go, which is this model's
       own point (the authors attribute the force decline to phosphate, not to
       calcium running out), so a calcium-only rule has to call the entire force
       decay "rest".
       0.15 of full-scale calcium is where the rise crosses on the way up
       (t = 0.03 s reads 0.260 and is already at 0.386 of maximum force), and
       0.05 of maximum force is where the decay stops being visible in the
       tension row. Both are display thresholds for a label, not model
       constants: nothing downstream reads them. */
    state.phase =
      state.calcium > 0.15 ? "activated" : state.force > 0.05 ? "relaxing" : "rest";
    state.phaseLabel = null;
  } else {
    state.phase = state.calcium > 0.5 ? "activated" : state.shortening > 0.15 ? "relaxing" : "rest";
    state.phaseLabel = null;
  }

  return state;
}


/**
 * HOW LONG THE MECHANICS HAVE TO RUN BEFORE A HELD FRAME IS ITS OWN INSTANT.
 *
 * `advance(state, 0)` re-derives force, calcium and the store from the scenario
 * — that is what "PAUSED IS NOT FROZEN" in `FiberScene` bought — but it cannot
 * move `state.shortening`, because the relaxation is
 * `(1 - Math.exp(-step / mechTau))` and at step 0 that is exactly 0. So every
 * quantity a held frame draws was correct EXCEPT the one the sarcomere's length
 * is made of: a paused seek re-coloured the store and kept the pull it arrived
 * with. Measured before this existed — standing at 6.012 s (length 2.1063 µm),
 * seeking to 0.108 s and holding 120 frames left the length at 2.1063 while the
 * force read 0.8713. The picture and the instant disagreed, which is §5's
 * silent snap with the sound turned all the way down.
 *
 * It is not a hypothetical: `ask.js` sends "Why do muscles get tired?" to
 * `fiber@5.202s`, and a hash that names an instant arrives PAUSED.
 *
 * SNAPPING TO THE TARGET WAS THE WRONG FIX AND WAS MEASURED BEFORE IT WAS
 * REJECTED. `2.2 - 0.3 * force(t)` is one line and it removes the lag, which is
 * real — series elasticity, and the reason a muscle relaxes more slowly than it
 * pulls. It also exaggerates: at the first repetition's peak it draws the
 * sarcomere 33.6 nm deeper than the run ever goes, 11% of the drawn travel,
 * flattering exactly the comparison the control below is built on.
 *
 * So the lag is integrated instead, from far enough back that where it started
 * no longer shows. `mechTau` is at most 0.07 s and five of those is 0.7% of any
 * initial condition. Swept against a continuous run, worst error over forty
 * instants, seeded hostile (fully shortened):
 *
 *   0.15 s   34.21 nm      0.35 s   6.03 nm
 *   0.25 s    7.95 nm      1.00 s   6.03 nm
 *
 * 0.35 is where it stops improving — the 6 nm left is the integrator's own step,
 * 2% of the travel — and it costs 0.04 ms, which is why the scrubber can call
 * this on every tick of a drag.
 */
export const MECH_SETTLE_S = 0.35;

/**
 * Put `state` at instant `t` with everything it draws true of `t`, including
 * the mechanical lag. Unbound scenes have no archive to catch up against and
 * keep their own dynamics, so this only moves the clock for them.
 */
export function settleAt(state, t, opts = {}) {
  if (!opts.scenario) {
    state.time = t;
    return state;
  }
  const from = Math.max(opts.scenario.grid?.t0 ?? 0, t - MECH_SETTLE_S);
  const STEP = 1 / 240;
  state.time = from;
  // `- 1e-9` so a `t` that lands exactly on a step boundary does not buy one
  // extra iteration and overshoot the instant it was asked for.
  for (let u = from; u < t - 1e-9; u += STEP) advance(state, Math.min(STEP, t - u), opts);
  state.time = t;
  // The last word on force, calcium and the store belongs to `t` itself rather
  // than to the final step, which may have been shorter than STEP.
  advance(state, 0, opts);
  return state;
}
