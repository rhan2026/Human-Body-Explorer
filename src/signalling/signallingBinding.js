/**
 * The Fowler export, turned into the quantities the signalling scale draws.
 * No Three.js.
 *
 * THE ONE SENTENCE. Resistance and endurance push on different doors, and
 * forty-five minutes later they arrive at the same room. The split is real and
 * it is upstream; the arrival is real and it is shared. Both halves are drawn,
 * because either half alone is a different and wrong claim.
 *
 * THREE ARMS, ALWAYS. `fowler_resistance` and `fowler_endurance` are the two
 * bouts; `fowler_rest` is the same network, the same baseline and the same
 * integrator with neither input on. It does not move at all — max drift 0.0000
 * over the whole run at the shipped precision — and drawing it is what licenses
 * reading the other two as entirely the bout. Without it, the network's own
 * settling would be on screen as though the exercise had caused it, which is the
 * mistake the cell scale one step up already paid for.
 *
 * NOTHING HERE IS A ROUTE READ OFF A DIAGRAM. The app is not shipped the 259
 * interactions, so which nodes belong to which arm is MEASURED from the three
 * series: a node is on the resistance route if resistance moves it off the rest
 * control by more than SEPARATION at the end of the run, and likewise for
 * endurance. That is a stronger statement than reachability — a node the graph
 * connects but the model never moves is not on the route in any sense a viewer
 * cares about — and it is the statement the shipped bytes can support.
 *
 * EVERY COUNT IS COUNTED. Not one of 18 / 9 / 56 / 24 / 16 appears as a literal
 * in this file or on the screen (CLAUDE.md §9). `signallingBinding.test.js`
 * asserts them against the committed bytes; the screen prints what `routesOf`
 * derived, so a re-export moves both together or fails loudly.
 */

/** The three arms. Two bouts and the control that makes them readable. */
export const SCENARIOS = Object.freeze({
  resistance: "fowler_resistance",
  endurance: "fowler_endurance",
  control: "fowler_rest",
});

/**
 * How far apart two arms have to be before this screen says they differ, on a
 * dimensionless [0,1] activity.
 *
 * ONE THRESHOLD, USED TWICE, ON PURPOSE — it decides both which route a node is
 * on and whether the trunk still tells the arms apart, and those are the same
 * question asked of different pairs. 0.05 is the resolution `decisions.md` P-6
 * argues at: it states that eight of the twelve outputs separate by under 0.02
 * and treats that as indistinguishable, so a bar this screen calls "different"
 * has to clear that by a margin. It is OURS, not the authors', and the panel
 * says so beside every count it produces.
 */
export const SEPARATION = 0.05;

/**
 * The export's clock is minutes (`provenance.time_unit`); the hash's is seconds,
 * as it is for every other scale. This is the only place the two meet.
 */
export const secondsPerMinute = 60;

/** Read one series, and refuse it if it arrives without its label. */
function read(scenario, id, t) {
  const r = scenario.sample(id, t);
  if (!r.provenance?.evidence_type) {
    throw new Error(`${id} reading carries no evidence type — an unlabelled number does not reach the geometry`);
  }
  return r;
}

const last = (values) => values[values.length - 1];

/**
 * Which nodes each arm moves, measured — plus the authors' own name for each.
 *
 * Computed once per load, not per frame: it reads whole series rather than
 * samples, and the answer is a property of the run and not of the instant. The
 * order inside each list is the order `by_measured_separation` ranks it, so the
 * loudest node in a band is drawn first and the drawing has a reason for its
 * layout that is not "whatever `Object.keys` returned".
 */
export function routesOf(arms) {
  const { resistance, endurance, control } = arms;
  const rank = resistance.network.roles.by_measured_separation;
  const inputs = resistance.network.roles.inputs;
  const outputs = resistance.network.roles.phenotypes;

  const claimed = new Set([...inputs, ...outputs]);
  const buckets = { resistanceOnly: [], enduranceOnly: [], shared: [], quiet: [] };

  /* Of the nodes no arm claims, how many nevertheless moved. The panel used to
     call all of them "marks that never move" and 17 of 24 do — `quiet` is a
     statement about OUR threshold, not about the model, and a screen that
     promotes the threshold into a fact about the model has invented a result.
     Counted here so the sentence beside the count is counted too. */
  let quietButMoving = 0;

  for (const id of rank) {
    if (claimed.has(id)) continue;
    const rest = last(control.series(id).values);
    const dR = Math.abs(last(resistance.series(id).values) - rest);
    const dE = Math.abs(last(endurance.series(id).values) - rest);
    const movedR = dR > SEPARATION;
    const movedE = dE > SEPARATION;
    if (!movedR && !movedE && Math.max(dR, dE) > 0) quietButMoving += 1;
    buckets[movedR && movedE ? "shared" : movedR ? "resistanceOnly" : movedE ? "enduranceOnly" : "quiet"].push(id);
  }

  /* The authors' expansions, transcribed from their species sheet. One of them
     ships with a trailing space and it is trimmed rather than retyped — editing
     the string would make it ours, and ours is not what a `Curated` badge
     promises. 57 of the 121 `pathway` cells are blank in the same sheet and
     ship blank; `type` is complete and is the fallback. */
  const names = Object.fromEntries(
    Object.entries(resistance.network.nodes).map(([id, n]) => [id, (n.name ?? "").trim()]),
  );

  /* WHAT EACH NODE IS, IN THE AUTHORS' OWN WORD, and it is the whole reason the
   * scene can be a cell rather than a chart.
   *
   * Every node ships a `type`: `receptor`, `second messenger`, `protein`,
   * `transcription factor`, `gene`, `ligand`, `phenotype`, `input`. That is not
   * a taxonomy we invented to justify a picture — it is a column of the authors'
   * species sheet, and it happens to say where in a cell the thing lives.
   * Receptors are in the membrane. Second messengers and kinases are in the
   * cytosol. Transcription factors and genes are in the nucleus. A signalling
   * cascade running membrane -> cytosol -> nucleus is the first thing anybody is
   * taught about this, and until now this scale drew it as five rows sorted by
   * WHICH ARM MOVED THEM — an analysis grouping, correct and abstract, with no
   * inside to be inside of.
   *
   * §5 IS WHY THIS IS PASSED THROUGH RATHER THAN COMPUTED. The Fowler model has
   * no geometry — no compartments, no distances, no cell boundary — so a layout
   * that placed nodes by anything WE decided would be anatomy we made up. This
   * places them by a field the archive ships, and `signallingGeometry.js` maps
   * type to compartment in one table that names every type it handles. A type
   * the archive adds and that table does not know lands in the cytosol and says
   * so in a test rather than vanishing.
   */
  const types = Object.fromEntries(
    Object.entries(resistance.network.nodes).map(([id, n]) => [id, (n.type ?? "").trim()]),
  );

  /* AND WHICH CASCADE EACH NODE BELONGS TO — the authors' `pathway` column, and
   * the reason the cytosol can stop being a crowd.
   *
   * The note above says this field ships blank for 57 of 121 and picks `type` as
   * the complete one. Both are true and they are not alternatives. Counted from
   * the shipped bytes: the nine NAMED pathways — MAPK 13, Calcium 11, PI3K/Akt
   * 8, Smad 8, STARS 7, Hippo 6, cAMP/PKA/AMPK 5, Integrin 3, NFkB 3 — live
   * entirely in `outside`, `membrane` and `cytosol`. Every one of the 57 blanks
   * is a transcription factor, a gene, a phenotype or an input: 43 in the
   * nucleus, 12 in the outcome, 2 outside. The blanks are not missing data. They
   * are where the cascades ARRIVE, which is why the authors had nothing to put
   * in the column.
   *
   * So the field is complete exactly where a layout needs it and blank exactly
   * where a layout does not. `signallingGeometry.js` groups a compartment's
   * marks into named columns when it has them and leaves the compartment alone
   * when it does not, which is the nucleus and the outcome untouched.
   *
   * TRIMMED AND OTHERWISE UNTOUCHED, like `names` above and for the same reason:
   * one of these cells ships with a trailing space, and editing the string would
   * make it ours. */
  const pathways = Object.fromEntries(
    Object.entries(resistance.network.nodes).map(([id, n]) => [id, (n.pathway ?? "").trim()]),
  );

  /* WHICH DOORS EACH BOUT ACTUALLY PUSHES ON — the first step out of the input,
     off the network's own edge list.
   *
   * WHICH INPUT IS ON IS READ, NOT ASSUMED. Each arm holds exactly one of the
   * two inputs at 1 and the other at 0 (`protocol.ResistanceExercise = 1`,
   * `EnduranceExercise = 0`, and the mirror image in the endurance file), so
   * the arm's own protocol block says which node it enters at. Matching the
   * scenario name against the node id would have worked today and would be a
   * guess about a file we do not write.
   *
   * THIS IS THE ONE STRUCTURAL FACT THE ROUTES DID NOT HAVE. Every other bucket
   * above is measured from the SERIES — which nodes an arm moves — and that is
   * the right question for what to draw. It cannot answer "where does the bout
   * enter", because a node the input feeds directly and a node twelve steps
   * downstream are both just nodes that moved. The edges shipped on 2026-08-22
   * and nothing had read them except the faint wiring layer. */
  const edges = resistance.network.edges ?? [];
  const stepsOutOf = (scenario) => {
    const input = inputs.find((id) => scenario.protocol?.[id] === 1) ?? null;
    const steps = input === null
      ? []
      : [...new Set(edges.filter(([a, b]) => a === input && b !== input).map(([, b]) => b))];
    return Object.freeze({ input, steps: Object.freeze(steps) });
  };
  const resistanceDoors = stepsOutOf(resistance);
  const enduranceDoors = stepsOutOf(endurance);
  const doors = Object.freeze({
    resistance: resistanceDoors,
    endurance: enduranceDoors,
    /* The punchline of the whole screen, one layer earlier than the trunk: four
       of the first steps are the SAME node under both bouts. The Y is shared
       before it looks shared. */
    shared: Object.freeze(resistanceDoors.steps.filter((id) => enduranceDoors.steps.includes(id))),
    all: Object.freeze([...new Set([...resistanceDoors.steps, ...enduranceDoors.steps])]),
  });

  return Object.freeze({
    inputs: Object.freeze([...inputs]),
    outputs: Object.freeze([...outputs]),
    ...Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, Object.freeze(v)])),
    quietButMoving,
    doors,
    names: Object.freeze(names),
    types: Object.freeze(types),
    pathways: Object.freeze(pathways),
    provenance: resistance.provenance,
  });
}

/** The five drawn bands, in the order the signal walks them. */
const BANDS = ["inputs", "resistanceOnly", "enduranceOnly", "shared", "outputs"];

/**
 * What the twelve drawn nodes are doing at one instant, for one bout.
 *
 * `drawnAt` above answers the OLD picture's question — how the arm buckets sit
 * against each other — and it cannot answer this one, because the hero drawing
 * needs a value for twelve named ids and the buckets are not keyed that way.
 *
 * WHICH BOUT IS NOT ASKED FOR HERE, IT IS PASSED IN. The owner, 2026-08-31:
 * *"selection은 거의 없고 운동에 따라 다르게"* — a visitor picked a bench press or
 * a run upstairs, and asking them again at the bottom of the descent is asking
 * the same question twice. `workoutMapping.js` turns the exercise into one of
 * Fowler's two inputs and the scene hands the answer down.
 *
 * THAT REVERSES A DECISION THIS FILE'S NEIGHBOUR ARGUED FOR, and the reversal is
 * the owner's. `SignallingScale.jsx` carried a note saying no arm is preselected
 * from the exercise because "a default is a claim as much as a sentence is" —
 * true, and the claim is `workoutMapping.js`'s, which is labelled `Mapped`, is
 * ours, and is reachable. CLAUDE.md §5 settles the tie in those words: when
 * rigour starts refusing features, the section yields and the objective does
 * not.
 *
 * Every value is the archive's own sample at that instant, through the same
 * `read` every other number on this scale goes through — so a series with no
 * evidence type still cannot reach a pixel.
 */
export function heroReading(arms, ids, arm, tSeconds) {
  const scenario = arm === "endurance" ? arms.endurance : arms.resistance;
  const tMin = tSeconds / secondsPerMinute;
  const activity = {};
  for (const id of ids) activity[id] = read(scenario, id, tMin).value;
  return { arm, activity, t: tSeconds };
}

/**
 * BOTH arms at one instant, which is what the SIGNALS floor draws.
 *
 * WHY THIS EXISTS RATHER THAN TWO CALLS AT THE CALL SITE. It is two calls — the
 * point is that they are two calls to the SAME `tSeconds`, and that is the
 * invariant the floor's whole comparison rests on. A scene that read resistance
 * at one instant and endurance at another would draw a difference the archive
 * does not contain, and it would look exactly like a real one. One function, one
 * `t`, no way for a caller to hold it wrong.
 *
 * NOTHING IS COMBINED. The two activity maps come back separate and stay
 * separate all the way to the two streams and the two bars; nothing here
 * subtracts, ratios or normalises them against each other. Every difference a
 * viewer sees is the difference between two of the authors' own series read at
 * one time — §5's line about not putting our arithmetic in the authors' mouths,
 * applied at the one place where making a comparison prettier would be easiest.
 *
 * @returns `{ t, r, e }` — `r` and `e` are `{ id: 0..1 }`, on the network's clock.
 */
export function heroPair(arms, ids, tSeconds) {
  return {
    t: tSeconds,
    r: heroReading(arms, ids, "resistance", tSeconds).activity,
    e: heroReading(arms, ids, "endurance", tSeconds).activity,
  };
}

/**
 * How far each arm has moved a node over ITS OWN run, at `tSeconds` — 0 at the
 * first sample, 1 at the last, clamped.
 *
 * WHY THIS EXISTS. The owner's brief of 2026-09-06 asks the picture to show a
 * signal ARRIVING — a node taking its workout's colour as the signal reaches it,
 * a ribosome extruding a strand, one mitochondrion becoming three. The archive's
 * series cannot drive that raw: they start well above zero (PGC-1α at 0.71) and
 * some move by almost nothing (mitochondrial biogenesis 0.357 → 0.387 over the
 * whole run). What the picture needs is "how much of what this workout does to
 * this node has happened yet", and that is the series' rise over its own run.
 *
 * WHAT IT IS AND IS NOT. It is a display mapping of the same kind as the colour
 * ramp's endpoints: the authors' own series, per arm, rescaled onto 0..1 between
 * its first and last samples. It is NOT one arm measured against the other —
 * `heroPair`'s rule holds, nothing here subtracts, ratios or normalises across
 * arms — so it says "this workout's effect here is this far along" and never
 * "this workout does more". Where both arms are shown the two numbers stand
 * side by side, as the activities do. A series that falls, or does not move,
 * has no rise to show and reads 0 all run rather than dividing by nothing;
 * `signallingBinding.test.js` holds the ends, the clamp and the monotonicity.
 *
 * @returns `{ r: {id: 0..1}, e: {id: 0..1} }`
 */
export function heroProgress(arms, ids, tSeconds) {
  const tMin = tSeconds / secondsPerMinute;
  const of = (scenario) => {
    const { t0, tEnd } = scenario.grid;
    const out = {};
    for (const id of ids) {
      const first = read(scenario, id, t0).value;
      const last = read(scenario, id, tEnd).value;
      const now = read(scenario, id, tMin).value;
      const rise = last - first;
      out[id] = rise > 0 ? Math.min(1, Math.max(0, (now - first) / rise)) : 0;
    }
    return out;
  };
  return { r: of(arms.resistance), e: of(arms.endurance) };
}

/**
 * What the signalling scale draws at `tSeconds` on ITS OWN run.
 *
 * `tSeconds` is the hash's seconds, and the run they name is the network's 45
 * minutes rather than the body's 13 s. The conversion is the single division
 * below and the screen states both numbers, because a viewer arriving from a
 * push-up at `@9.0s` is nine seconds into a forty-five-minute protocol and has
 * to be told that rather than left to assume the clocks are one clock.
 *
 * Readings snap to the nearest archived sample; nothing is interpolated, and the
 * grid is NOT uniform — 0.1 min for the first two minutes, then 1.0 min
 * (`sampling.head_samples`). scenarioData.js searches `t` for exactly that
 * reason and so must anything else that reads these files.
 */
export function drawnAt(arms, routes, tSeconds) {
  const tMin = tSeconds / secondsPerMinute;
  const readAll = (scenario, ids) => ids.map((id) => read(scenario, id, tMin).value);

  const bands = {};
  for (const band of BANDS) {
    const ids = routes[band];
    bands[band] = Object.freeze({
      ids,
      r: Object.freeze(readAll(arms.resistance, ids)),
      e: Object.freeze(readAll(arms.endurance, ids)),
      c: Object.freeze(readAll(arms.control, ids)),
    });
  }

  const anchor = read(arms.resistance, routes.inputs[0], tMin);

  /* THE TRUNK'S NUMBER, AND WHY IT MAY NOT BE A PROGRESS BAR. Of the nodes both
     arms move, how many still tell the two apart at this instant. It rises 0 ->
     16 over the run but it FALLS three times on the way — at 12, 21 and 34
     minutes nodes that had parted come back together. A bar that only fills
     would be drawing a monotone journey this model does not take. */
  const separating = bands.shared.r.reduce(
    (n, v, i) => n + (Math.abs(v - bands.shared.e[i]) > SEPARATION ? 1 : 0),
    0,
  );

  /* THE ARRIVAL, AS ONE NUMBER RATHER THAN A COUNTER. It was computed in
     `SignallingReadout` until 2026-08-25 and is now read by the `outputs`
     callout, on the band it is about — so it moved here, because the panel and
     the canvas commit in two different React roots and a number computed twice
     can differ by a tick (the cell scale shipped exactly that for ten minutes).
     "12 of 12 outputs differ by less than 0.05" was the earlier form and it read
     12 of 12 at all 64 samples — a live-looking counter that had never counted.
     The widest gap is the same fact and it does move, 0.0000 to 0.0383. Its NODE
     is not named: at t = 0 all twelve gaps are exactly 0.0000 and `indexOf`
     would pick slot 0, which is an array order printed as a result. */
  const widestOutputGap = bands.outputs.r.reduce(
    (w, v, i) => Math.max(w, Math.abs(v - bands.outputs.e[i])),
    0,
  );
  /* AND WHICH ONE, WHEN THAT IS A FACT AND NOT AN ARRAY ORDER. Q22 R2: Fowler's
     Fig 2b says the greatest differences after exercise are in protein
     degradation, inflammation, cell growth and protein synthesis — and ranked
     at our run's end, those are our top four, in that order (0.038, 0.031,
     0.016, 0.014). The plate said "0.0383 apart at most" and named nothing, so
     the picture drew the authors' figure and told the viewer only that the
     twelve were one mark. It names the widest now, under two guards the
     comment above already asked for: the gap must clear the export's own
     rounding step (below it, "widest" is noise), and it must be UNIQUE — at
     t = 0 all twelve are 0.0000 and a tie names slot 0, which is an array
     order printed as a result. */
  const step = 10 ** -(arms.resistance?.sampling?.round_digits ?? 4);
  let widestOutput = null;
  if (widestOutputGap > step) {
    const at = bands.outputs.r
      .map((v, i) => [Math.abs(v - bands.outputs.e[i]), i])
      .filter(([g]) => g === widestOutputGap);
    if (at.length === 1) widestOutput = routes.outputs[at[0][1]];
  }

  /* AND THE SAME TWELVE ON THE PAPER'S OWN AXIS. Q29 R3, 2026-08-30. The gap
     above is absolute activity, where the widest of the twelve is 0.0383 — a
     hair, and the pass closes by saying the twelve are one mark. Fowler's
     Figure 2 does not plot activity; it plots "fractional changes from
     baseline", and their abstract's result is that the two modes differ there:
     "endurance exercise preferentially activates inflammation". Read the way
     they read it, against the control arm this scale already loads, our own
     twelve say the same thing — protein degradation -8.7 % under resistance
     against -0.6 % under endurance (8.1 points), inflammation +5.8 against
     +10.0 (4.2), cell growth +26.7 against +23.0, protein synthesis +19.3
     against +16.2. The model reproduces the paper's headline and the plate was
     reporting the one axis on which it does not show.
     Same two guards as the absolute reading: the baseline must be big enough
     that a percentage of it means anything, and the widest must be unique or
     it is an array order printed as a result. */
  const restStep = step * 10;
  const fromRest = bands.outputs.c.map((c, i) =>
    c > restStep
      ? Math.abs((bands.outputs.r[i] - c) / c - (bands.outputs.e[i] - c) / c) * 100
      : null,
  );
  const widestFromRest = fromRest.reduce((w, v) => (v == null ? w : Math.max(w, v)), 0);
  let widestFromRestOutput = null;
  if (widestFromRest > 0.05) {
    const at = fromRest.map((v, i) => [v, i]).filter(([v]) => v === widestFromRest);
    if (at.length === 1) widestFromRestOutput = routes.outputs[at[0][1]];
  }

  /* Outputs that are the SAME FUNCTION, not merely close. Angiogenesis and
     Mitochondrial_Biogenesis are one rule each off PGC_1a with identical
     parameters, so they are bit-identical at every sample in both arms. Found by
     comparing, not by knowing: a re-export that broke the identity would empty
     this list and the screen would stop claiming it. */
  const identicalOutputs = [];
  for (let i = 0; i < routes.outputs.length; i++) {
    for (let k = i + 1; k < routes.outputs.length; k++) {
      if (bands.outputs.r[i] === bands.outputs.r[k] && bands.outputs.e[i] === bands.outputs.e[k]) {
        identicalOutputs.push([routes.outputs[i], routes.outputs[k]]);
      }
    }
  }

  /* THE CLAIM THIS SCREEN IS NOT ALLOWED TO MAKE. PGC_1a is the master
     regulator of mitochondrial biogenesis and RESISTANCE moves it further than
     endurance does, by 0.0009 on a [0,1] activity. Carried to the panel so the
     screen states the trap rather than being caught by it. */
  const pgcRest = read(arms.control, "PGC_1a", tMin).value;
  const pgc1a = Object.freeze({
    resistance: read(arms.resistance, "PGC_1a", tMin).value - pgcRest,
    endurance: read(arms.endurance, "PGC_1a", tMin).value - pgcRest,
  });

  /* How far the control has moved from its own first sample, over every node
     this screen draws. It is 0.0000 and printing it is the whole argument: the
     two arms' movement is the bout, because the arm that did no bout did not
     move. */
  const controlDrift = BANDS.reduce(
    (worst, band) =>
      bands[band].c.reduce(
        (w, v, i) => Math.max(w, Math.abs(v - arms.control.series(bands[band].ids[i]).values[0])),
        worst,
      ),
    0,
  );

  return Object.freeze({
    tMinutes: anchor.t,
    tSeconds: anchor.t * secondsPerMinute,
    requestedT: tSeconds,
    outOfRange: anchor.outOfRange,
    evidence: anchor.provenance.evidence_type,
    bands: Object.freeze(bands),
    separating,
    widestOutputGap,
    widestOutput,
    widestFromRest,
    widestFromRestOutput,
    identicalOutputs,
    pgc1a,
    controlDrift,
  });
}

/**
 * The widest output gap, printed so it never claims the export's own rounding.
 *
 * Lives beside `widestOutputGap` rather than in the scale that draws it, for
 * the reason the header there gives: one producer, whichever root reads it.
 * `export_for_app.py` rounds the Fowler copy to `sampling.round_digits`
 * decimals, so every gap computed off that copy is a multiple of one step and
 * a gap OF one step is the resolution floor, not a separation. The plate read
 * `0.0001 apart at most` there, which is a measurement's typography over the
 * smallest non-zero number the file can hold.
 *
 * The step is READ off the file. A coarser export has to move this with it.
 */
export function gapReading(gap, roundDigits) {
  const digits = Number.isInteger(roundDigits) ? roundDigits : 4;
  const step = 10 ** -digits;
  return gap <= step ? `<${step.toFixed(digits)}` : gap.toFixed(digits);
}

/**
 * The names the scale above teaches, and they are in this picture.
 *
 * Q18 R1 counted what each scale reuses from the one above it and found the
 * signalling scale names exactly ONE of its 121 nodes — `PGC-1α` — while
 * `AMPK`, `CAMK` and `Ca` are all nodes here and all three are what the cell
 * and fibre spend their passes on. A viewer arrives from thirty seconds of
 * "AMPK · energy sensor" onto a picture that contains AMPK and calls it a dot.
 *
 * Named in the RECORD and not on the canvas, which is the rule `SignallingScale`
 * already states for the door names: no node on this canvas is captioned, so a
 * name printed in a panel is a name a viewer cannot attach to a mark. Behind the
 * badge it answers "which ones", which is the question a band of 8 provokes.
 * And the screen was at 200 of its 200 rendered words when this was argued, so a
 * sentence here cost nothing and a sentence there would have had to displace one
 * already argued for. The count is 114 today — `SignallingReadout.jsx`'s header
 * has the measurement — which weakens the arithmetic and not the placement: a
 * name a viewer cannot attach to a mark is the reason, and it is unchanged.
 *
 * THE SECOND CLAUSE IS THE IMPORTANT ONE. Fowler's `AMPK` is a normalised
 * activity over 45 minutes; the cell scale's is a phosphorylated fraction from a
 * different paper over 13 seconds, and under the resistance arm the network's
 * ends slightly BELOW its own rest value (0.0667 against 0.0792) while the
 * cell's rises. Same name, different number, and nothing here converts one into
 * the other — CLAUDE.md §5: show where a comparison comes apart rather than
 * leaving it to be found as a contradiction.
 */
/* WHAT EACH NAME IS, AND FOR ONE OF THEM WHAT IT IS NOT. Q27 R1, 2026-08-29:
   this map read `CAMK: "the cell scale's calcium switch"`, which is an identity
   claim neither paper makes. The cell scale's switch is **CaMKK2**, a kinase
   KINASE that phosphorylates AMPK; Fowler's node table calls `CAMK`
   "calcium-calmodulin dependent protein kinase", the family CaMKK2 acts
   upstream OF. Same pathway, adjacent steps, different proteins — and the
   numbers say so too (cell 0 -> 1.00, signalling 0 -> 0.52 under resistance).
   Naming one as the other is the failure this whole note exists to prevent,
   one level finer than the numbers it already warns about. Each entry now says
   what the node IS, from that paper's own node table, and the note underneath
   still says the numbers do not convert. */
export const UPSTAIRS = Object.freeze({
  AMPK: "which the cell scale draws as a phosphorylated fraction",
  CAMK: "Fowler's calcium-calmodulin dependent protein kinase, NOT the cell scale's CaMKK2 — that one acts on this family",
  Ca: "which the fibre scale draws in micromolar",
});

export function bandWhy(ids) {
  return `ours: this arm leaves the no-exercise control by more than ${SEPARATION} at the end. ${ids.join(", ")}.`;
}

/**
 * The upstairs names, wherever in the network they sit — and it is NOT on the
 * band that holds them.
 *
 * Q18 R2 put this on the two split bands' records, which is where the nodes
 * are. Q18 R8 measured what that costs on a phone: `NARROW_FOLD` folds
 * `split-resistance` and `split-endurance` at 420 px and below, so on a 320 px
 * screen those two plates do not render AT ALL — and the sentence connecting
 * this scale to the one above it went with them. Measured at four widths: 320
 * and 375 draw `two bouts enter here`, `reached by both` and `12 outputs`; 421
 * and 1280 draw all five.
 *
 * So it rides the doors plate, which survives every width, and it scans every
 * band rather than one: the question a viewer brings down the stairs is "where
 * is the thing I just learned", and the answer must not depend on how wide
 * their screen is. The band lists stay where the bands are — eight ids is a
 * "which ones", and a "which ones" may fold.
 */
export function upstairsNote(routes) {
  const bands = ["resistanceOnly", "enduranceOnly", "shared", "outputs", "inputs"];
  const found = [];
  for (const band of bands) {
    for (const id of routes?.[band] ?? []) if (UPSTAIRS[id]) found.push(id);
  }
  if (!found.length) return "";
  /* AND WHY THEY LOOK COMPARABLE, which is the half the warning was missing.
     Q27 R2, 2026-08-29: saying "not the same number" leaves a reader to wonder
     what the trap is. Measured off the shipped runs — the cell's AMPK is a
     FRACTION OF A POOL and Fowler's is a NORMALISED ACTIVITY, and both are
     numbers between 0 and 1, so two quantities from two papers land in the same
     range and invite a comparison neither supports (the cell ends its bout at
     0.998 of the pool; this network ends resistance at 0.0667, below its own
     rest). Calcium is the other shape of the same trap: micromolar upstairs,
     0-to-1 here. The ranges are named rather than the values, because the
     values belong to another archive and a second copy of them here is a copy
     that goes stale. */
  return (
    ` This network holds names the scales above teach: ${found
      .map((id) => `${id}, ${UPSTAIRS[id]}`)
      .join("; ")}. The same NAME, not the same number — this is Fowler's normalised activity over ` +
    "45 minutes and those are other papers' quantities over other runs, and nothing here converts one " +
    "into the other. Watch the ranges rather than the values: a normalised activity here and a " +
    "fraction of a pool on the cell scale are both numbers between 0 and 1, which is exactly why they " +
    "invite a comparison neither paper supports; the fibre's calcium is micromolar and does not even " +
    "share the range."
  );
}

/** A node id the way a reader spells it — the underscore is the file's. One
 *  implementation; `SignallingReadout` and the outputs plate both read it. */
export const readable = (id) => String(id).replace(/_/g, " ");

/**
 * The twelve destinations, in words a first-year already owns.
 *
 * WHY THE BOTTOM BAND NEEDED THIS. The whole descent — body, fibre, cell,
 * signalling — is one promise, and the cell scale's row in the depth table ends
 * on "that starts the changes". This is the layer that owes the answer, and
 * until 2026-08-30 the answer on screen was a plate reading `what the cell ends
 * up doing` over twelve anonymous marks. A visitor who came down four scales to
 * find out what a bench press does to them arrived at a band that would not say.
 *
 * NOT THE NODE IDS, AND THAT IS THE DEPTH TABLE RATHER THAN TASTE.
 * `Mitochondrial_Biogenesis` and `Angiogenesis` were pulled off this layer on
 * 2026-08-30 (T16) as "two outcome names and a node id, three terms the depth
 * table keeps off this layer", and the ruling there was to keep the CLAIM and
 * drop the NAMES. So these are the claims in everyday words. The ids stay in the
 * record, which is where an identifier is useful.
 *
 * `more mitochondria` IS ALLOWED WHERE `Mitochondrial_Biogenesis` IS NOT, and
 * the difference is not a synonym game: the fibre scale two levels up DRAWS
 * mitochondria and labels them, so this is the one word here that points at
 * something the visitor has already seen with their own eyes. That is
 * `objective.md`'s third promise — the same event at four sizes — paying out.
 *
 * SEPARATED BY COMMAS RATHER THAN THE APP'S `·`, and the reason is the gate
 * rather than typography: `gate-word-budget` counts on whitespace, so eleven
 * middots between twelve phrases are eleven more "words" against the ceiling —
 * a third of the list's own cost, spent on punctuation.
 *
 * KEYED BY THE ARCHIVE'S OWN IDS AND CONSUMED BY MAPPING OVER `routes.outputs`,
 * never by writing the list out. CLAUDE.md §9 forbids typing a value something
 * counts, and a hand-written list of twelve is that rule's exact shape one step
 * up: it would be a count, an order and a membership all typed at once, and it
 * would go stale silently the first time the archive's roles changed. An id with
 * no entry here falls through to `readable`, so a new phenotype shows up on
 * screen as a spelled-out id rather than vanishing from the sentence.
 */
const PLAIN = Object.freeze({
  Protein_Synthesis: "building protein",
  Protein_Degradation: "breaking protein down",
  Cell_Growth: "growing",
  Proliferation: "making more cells",
  Differentiation: "becoming muscle",
  Inflammation: "inflammation",
  Anti_Inflammatory: "calming it down",
  Antioxidant: "mopping up damage",
  Angiogenesis: "new blood vessels",
  Mitochondrial_Biogenesis: "more mitochondria",
  Fiber_Type: "a changed fibre type",
  Oxygen_Transport: "carrying more oxygen",
});

/** One destination in everyday words, falling back to the id spelled out. */
export const plainly = (id) => PLAIN[id] ?? readable(id);
