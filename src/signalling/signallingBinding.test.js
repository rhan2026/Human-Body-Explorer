import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { loadScenario } from "../scenarioData.js";
import {
  SCENARIOS,
  SEPARATION,
  bandWhy,
  drawnAt,
  gapReading,
  routesOf,
  secondsPerMinute,
  upstairsNote,
} from "./signallingBinding.js";

/**
 * The seam where the Fowler export becomes a picture.
 *
 * The question that catches a disconnected seam is never "is the value right"
 * but "if I change the input, does the output change?" — asked here of all 121
 * nodes rather than of a table of ten, because this scale's drawn quantities are
 * the nodes themselves and a table would be a second list to go stale. Every
 * node in every drawn band is scaled tenfold in turn, and its own mark must move
 * while its neighbours do not (`every drawn node is wired to its own series`).
 *
 * EVERY COUNT ON THIS SCALE IS COUNTED HERE, NOT TYPED. CLAUDE.md §9 forbids
 * writing down a number that something counts. The route sizes below (17 / 8 /
 * 58 / 24) are assertions about the shipped bytes, not constants the module
 * carries — `routesOf` derives them and the screen prints what it derived.
 *
 * THEY WERE 18 / 9 / 56 UNTIL 2026-08-17, and nothing about the model changed.
 * The export was dropping the last archived sample, `routesOf` classifies every
 * node at the last sample it is given, and `ANKRD1` and `cAMP` sat in one-route
 * bands that the run's real end does not put them in.
 */

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(`../../public${path}`, import.meta.url), "utf8"));

const load = async () => ({
  resistance: await loadScenario(SCENARIOS.resistance, readJson),
  endurance: await loadScenario(SCENARIOS.endurance, readJson),
  control: await loadScenario(SCENARIOS.control, readJson),
});

/**
 * One series moved, everything else untouched, through the real carrier.
 *
 * ADDED, NOT MULTIPLIED, AND THAT IS THE POINT. The sibling seams test this by
 * multiplying a published series tenfold (cellBinding.test.js, scenarioDrive.
 * test.js). Written that way here it passed 119 of 121 nodes and reported
 * "EnduranceExercise is drawn from nothing" for the other two — because a
 * tenfold change of exactly 0.0 is exactly 0.0, and this export is full of hard
 * zeros: the endurance input and everything below it read 0.0000 in the
 * resistance arm all run. A multiply cannot move them, so on those nodes the
 * guard could not fail and therefore guarded nothing. An offset moves every
 * number there is.
 */
const bumped = (scenario, name, by) =>
  Object.freeze({
    ...scenario,
    series: (s) => {
      const r = scenario.series(s);
      return s === name ? Object.freeze({ ...r, values: r.values.map((v) => v + by) }) : r;
    },
    sample: (s, t) => {
      const r = scenario.sample(s, t);
      return s === name ? Object.freeze({ ...r, value: r.value + by }) : r;
    },
  });

const BANDS = ["inputs", "resistanceOnly", "enduranceOnly", "shared", "outputs"];

test("the hash's seconds are seconds, and this run's clock is the archive's last sample", async () => {
  const arms = await load();
  const routes = routesOf(arms);

  // The export is in minutes (provenance.time_unit) and the hash is in seconds
  // everywhere in this app. One conversion, in one place, at this seam.
  assert.equal(secondsPerMinute, 60);
  assert.equal(arms.resistance.grid.t0, 0);
  // 44.9, not 44 and not 45. The authors' bout is 45 min and the archive's
  // last sample is 44.9; the export used to stop at 44.0 because `kept()` took
  // every 10th index and walked off the end. Pinned against the archive's own
  // end rather than a round number, because a round number is what hid it.
  assert.equal(arms.resistance.grid.tEnd, 44.9);

  const halfHour = drawnAt(arms, routes, 1800);
  assert.equal(halfHour.tMinutes, 30, "1800 s is 30 min into the run");
  assert.equal(halfHour.tSeconds, 1800);

  // A body-clock instant carried down from the push-up lands in the first
  // seconds of a 45-minute run. That is a true reading of "9 s after the bout
  // began" and it must not be rescaled into something more photogenic.
  assert.equal(drawnAt(arms, routes, 9).tMinutes, 0.1);

  // Off the end says so rather than snapping quietly (CLAUDE.md §5).
  assert.equal(drawnAt(arms, routes, 5000).outOfRange, true);
  assert.equal(drawnAt(arms, routes, 1800).outOfRange, false);
  assert.equal(drawnAt(arms, routes, 5000).tMinutes, 44.9, "clamped to the last sample the run has");
});

test("the routes are measured against the rest control, not asserted", async () => {
  const arms = await load();
  const routes = routesOf(arms);

  // Two doors, twelve outputs — the authors' own `node_roles`.
  assert.deepEqual(routes.inputs, ["ResistanceExercise", "EnduranceExercise"]);
  assert.equal(routes.outputs.length, 12);

  // The 107 that are neither, split by whether each arm moves them off the rest
  // control by more than SEPARATION at the end of the run.
  assert.equal(routes.resistanceOnly.length, 17);
  assert.equal(routes.enduranceOnly.length, 8);
  assert.equal(routes.shared.length, 58);
  assert.equal(routes.quiet.length, 24);
  assert.equal(
    routes.resistanceOnly.length + routes.enduranceOnly.length + routes.shared.length + routes.quiet.length,
    121 - 2 - 12,
  );

  // The named ones decisions.md P-6 turns on: the split is upstream.
  for (const id of ["integrin", "BMP", "TGFB", "LPA"]) {
    assert.ok(routes.resistanceOnly.includes(id), `${id} is a resistance-only node`);
  }
  for (const id of ["B_AR", "ROS"]) {
    assert.ok(routes.enduranceOnly.includes(id), `${id} is an endurance-only node`);
  }
  // Every node is classified exactly once, so nothing is drawn twice or dropped.
  const all = [...routes.inputs, ...routes.outputs, ...routes.resistanceOnly, ...routes.enduranceOnly, ...routes.shared, ...routes.quiet];
  assert.equal(new Set(all).size, 121);
  assert.equal(all.length, 121);
});

test("the two arms arrive at the same room, and the picture is not allowed to say otherwise", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const end = drawnAt(arms, routes, arms.resistance.grid.tEnd * 60);

  // P-6, measured off the bytes the browser downloads. Ten of twelve outputs
  // separate by under 0.02 on a [0,1] activity, and the widest is 0.037.
  const gaps = routes.outputs.map((_, i) => Math.abs(end.bands.outputs.r[i] - end.bands.outputs.e[i]));
  assert.equal(gaps.filter((g) => g < 0.02).length, 10);
  assert.ok(Math.max(...gaps) < 0.04, `widest output gap ${Math.max(...gaps)}`);

  // Angiogenesis and Mitochondrial_Biogenesis are the same single-rule chain off
  // PGC_1a, so they are bit-identical at every sample in both arms. Drawn
  // adjacent and joined, never as two bars a viewer could read as two results.
  const ang = routes.outputs.indexOf("Angiogenesis");
  const mito = routes.outputs.indexOf("Mitochondrial_Biogenesis");
  assert.ok(ang >= 0 && mito >= 0);
  assert.equal(end.bands.outputs.r[ang], end.bands.outputs.r[mito]);
  assert.equal(end.bands.outputs.e[ang], end.bands.outputs.e[mito]);
  assert.deepEqual(end.identicalOutputs, [["Angiogenesis", "Mitochondrial_Biogenesis"]]);

  // AND THE TRAP UNDER IT. Resistance is the LARGER of the two on the master
  // regulator of mitochondrial biogenesis. A screen that captions endurance as
  // the mitochondrial arm is contradicted by its own bytes.
  assert.ok(end.pgc1a.resistance > end.pgc1a.endurance, "PGC_1a: resistance is the larger");
  assert.ok(end.pgc1a.resistance - end.pgc1a.endurance < 0.002);
});

test("the trunk count is counted, moves, and is not monotone", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const at = (min) => drawnAt(arms, routes, min * 60).separating;

  assert.equal(SEPARATION, 0.05);
  assert.equal(at(0), 0, "at the first sample the two arms are one arm");
  assert.equal(at(arms.resistance.grid.tEnd), 17);
  assert.ok(at(10) > at(0.5), "the trunk tells them apart more as the run goes on");

  // NOT A PROGRESS BAR. It falls at 12, 21 and 34 minutes: nodes that had parted
  // come back together. A bar that only fills would be drawing a monotone
  // journey this model does not take.
  const series = arms.resistance.series("t").values.map((m) => at(m));
  const falls = series.filter((c, i) => i > 0 && c < series[i - 1]).length;
  assert.equal(falls, 3, `the count falls ${falls} times over the run`);
});

test("the rest control is drawn and is flat, which is what licenses reading the arms as the bout", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const first = drawnAt(arms, routes, 0);
  const last = drawnAt(arms, routes, arms.resistance.grid.tEnd * 60);

  for (const band of BANDS) {
    assert.ok(first.bands[band].c.length > 0, `${band} has no control arm drawn`);
    for (let i = 0; i < first.bands[band].c.length; i++) {
      // The difference, not the identity: several of these values are the JSON
      // literal -0.0, and `-0` is not `0` to a strict deep compare while being
      // the same number to every question this screen asks of it.
      const drift = Math.abs(last.bands[band].c[i] - first.bands[band].c[i]);
      assert.equal(drift, 0, `${band}[${i}] (${first.bands[band].ids[i]}) control drifted by ${drift}`);
    }
  }
  assert.equal(last.controlDrift, 0);
});

test("every drawn node is wired to its own series", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const base = drawnAt(arms, routes, 20 * 60);
  let checked = 0;

  for (const band of BANDS) {
    const ids = routes[band === "inputs" ? "inputs" : band];
    for (let i = 0; i < ids.length; i++) {
      // Move THIS node's resistance series. Its own resistance mark must move;
      // every other mark in the same band, and its own endurance and control
      // marks, must not.
      const moved = drawnAt({ ...arms, resistance: bumped(arms.resistance, ids[i], 0.25) }, routes, 20 * 60);
      assert.notEqual(moved.bands[band].r[i], base.bands[band].r[i], `${ids[i]} is drawn from nothing`);
      assert.equal(moved.bands[band].e[i], base.bands[band].e[i], `${ids[i]} endurance moved with resistance`);
      assert.equal(moved.bands[band].c[i], base.bands[band].c[i], `${ids[i]} control moved with resistance`);
      for (let k = 0; k < ids.length; k++) {
        if (k !== i) {
          assert.equal(moved.bands[band].r[k], base.bands[band].r[k], `${ids[i]} moved ${ids[k]}`);
        }
      }
      checked++;
    }
  }
  assert.equal(checked, 2 + 12 + 18 + 9 + 56, "every node in every drawn band was asked");
});

test("nothing reaches the picture without the label that says where it came from", async () => {
  const arms = await load();
  const routes = routesOf(arms);

  assert.equal(drawnAt(arms, routes, 600).evidence, "Derived");

  // The loader freezes provenance onto every reading; a carrier that lost it is
  // refused rather than defaulted, because the failure mode of a default is a
  // badge over something that never earned it.
  const stripped = Object.freeze({
    ...arms.resistance,
    sample: (s, t) => Object.freeze({ ...arms.resistance.sample(s, t), provenance: undefined }),
  });
  assert.throws(
    () => drawnAt({ ...arms, resistance: stripped }, routes, 600),
    /evidence type/,
  );
});

test("the authors' own words for the two doors ship, and ours do not", async () => {
  const arms = await load();
  const names = routesOf(arms).names;
  // species.csv column `name`, transcribed. Writing our own expansion would be
  // an unlabelled claim, so the screen prints these or prints nothing.
  assert.equal(names.ResistanceExercise, "ResistanceExercise");
  assert.equal(names.EnduranceExercise, "Endurance Exercise");
  assert.equal(names.ROS, "reactive oxygen species");
  assert.equal(names.SAC, "stretch activated channel");
  assert.equal(names.STARS, "striated muscle activator of rho signalling");
});

/**
 * WHERE EACH BOUT ENTERS — the first structural fact on this scale, and the one
 * the measured routes cannot supply.
 *
 * Every other bucket `routesOf` returns is measured from the SERIES: which nodes
 * an arm moves. That is the right question for what to draw and it cannot answer
 * "where does the bout come in", because a node the input feeds directly and a
 * node twelve steps downstream both just moved. The edges shipped on 2026-08-22
 * and were read by nothing except the faint wiring layer until the entry fans
 * were lit.
 *
 * COUNTED HERE, NOT TYPED (CLAUDE.md §9). 9 / 6 / 4 are assertions about the
 * committed bytes; `gizmoItems` prints what `routesOf` derived, so a re-export
 * that rewires the inputs moves both together or fails on this line.
 */
test("each bout's doors are the network's own edges out of the input it holds at 1", async () => {
  const arms = await load();
  const { doors } = routesOf(arms);

  // WHICH INPUT IS ON IS READ FROM THE PROTOCOL, not guessed from the scenario's
  // name. Both arms are the same network from the same baseline; the only thing
  // that distinguishes them is which of the two scalars is held at 1.
  assert.equal(doors.resistance.input, "ResistanceExercise");
  assert.equal(doors.endurance.input, "EnduranceExercise");
  assert.equal(arms.resistance.protocol.EnduranceExercise, 0);
  assert.equal(arms.endurance.protocol.ResistanceExercise, 0);

  assert.equal(doors.resistance.steps.length, 9);
  assert.equal(doors.endurance.steps.length, 6);
  // The four that do not move when the chip does — the trunk, one layer before
  // the trunk band. This is the number the default view's callout prints.
  assert.deepEqual([...doors.shared], ["SAC", "STARS", "HSP70", "IGF1"]);
  assert.equal(doors.all.length, 11, "9 + 6 with the four shared counted once");

  // The doors the panel used to name by hand are still each bout's own, and the
  // sentence that named two of resistance's nine is what this replaced.
  for (const id of ["integrin", "TGFB"]) assert.ok(doors.resistance.steps.includes(id));
  for (const id of ["B_AR", "ROS"]) assert.ok(doors.endurance.steps.includes(id));
  for (const id of doors.shared) {
    assert.ok(doors.resistance.steps.includes(id), `${id} is called shared and resistance does not open it`);
    assert.ok(doors.endurance.steps.includes(id), `${id} is called shared and endurance does not open it`);
  }

  // Every door is a node with a slot, or the lit line would run off to nothing.
  const routes = routesOf(arms);
  const drawn = new Set([
    ...routes.inputs, ...routes.resistanceOnly, ...routes.enduranceOnly, ...routes.shared, ...routes.outputs,
  ]);
  for (const id of doors.all) assert.ok(drawn.has(id), `${id} is a door with no mark on screen`);
});

test("the widest of the twelve gaps is computed once, where both roots can read it", async () => {
  // It was computed inside `SignallingReadout` and is now printed by a callout
  // inside the R3F root. Two producers of one number in two React roots is the
  // defect the cell scale shipped for ten minutes — they commit independently
  // and the two copies differ by a tick. So `drawnAt` owns it and both read it.
  const arms = await load();
  const routes = routesOf(arms);
  const gap = (min) => drawnAt(arms, routes, min * 60).widestOutputGap;

  assert.equal(gap(0), 0, "at the first sample nothing has moved and every gap is zero");
  const end = drawnAt(arms, routes, arms.resistance.grid.tEnd * 60);
  const byHand = Math.max(
    ...routes.outputs.map((_, i) => Math.abs(end.bands.outputs.r[i] - end.bands.outputs.e[i])),
  );
  assert.equal(end.widestOutputGap, byHand);
  assert.ok(end.widestOutputGap > 0.03 && end.widestOutputGap < 0.04, `${end.widestOutputGap}`);
});

/**
 * The outputs plate may not print the export's rounding as a separation.
 *
 * `export_for_app.py` rounds the Fowler copy to `sampling.round_digits`
 * decimals, so every gap computed off it is a multiple of that step and a gap
 * OF one step is the resolution floor. `0.0001 apart at most` read as a
 * measurement; it is the smallest non-zero number the file can express.
 *
 * The run's real spread reaches 0.0383, so the plate is honest almost
 * everywhere — and the frames it is not are the quiet early ones the guided
 * pass parks on, which is where a viewer reads it most carefully.
 */
test("the widest-gap plate says '<' when the gap is the file's own step", async () => {

  const shipped = JSON.parse(
    await readFile(new URL("../../public/scenarios/fowler_resistance.json", import.meta.url), "utf8"),
  );
  const digits = shipped.sampling.round_digits;
  assert.equal(digits, 4, "the export's rounding moved; this test's numbers are about 4 decimals");
  const step = 10 ** -digits;

  assert.equal(gapReading(step, digits), "<0.0001", "one step is the floor, not a separation");
  assert.equal(gapReading(0, digits), "<0.0001", "zero is below the floor too");
  assert.equal(gapReading(2 * step, digits), "0.0002", "two steps is a measurement and prints as one");
  assert.equal(gapReading(0.0383, digits), "0.0383", "the run's widest still prints plainly");

  // The step is read off the file, never assumed: a coarser export moves it.
  assert.equal(gapReading(0.001, 3), "<0.001");
  assert.equal(gapReading(0.002, 3), "0.002");
});

/**
 * The record names the nodes, and the upstairs warning rides a plate a phone
 * can actually see.
 *
 * Q18 R2 put the warning on the two split bands, which is where the nodes are.
 * R8 measured what that costs: `NARROW_FOLD` folds those two plates at 420 px
 * and below, so at 320 px they do not render at all and the one sentence
 * connecting this scale to the one above it went with them. It rides the doors
 * plate now, which survives every width, and scans every band.
 *
 * Both halves are still checked. The band lists answer "which ones" and may
 * fold. The warning may not: Fowler's AMPK is a normalised activity over 45
 * minutes and the cell's is a phosphorylated fraction from another paper over
 * 13 seconds, and under resistance the network's ends BELOW its own rest value
 * while the cell's rises.
 */
test("the band record names its members, and the upstairs warning is not on a plate that folds", async () => {
  const arms = await load();
  const routes = routesOf(arms);

  for (const band of ["resistanceOnly", "enduranceOnly"]) {
    const why = bandWhy(routes[band]);
    for (const id of routes[band]) {
      assert.ok(why.includes(id), `${band}'s record does not name ${id}, so "which ones" has no answer`);
    }
    assert.doesNotMatch(
      why,
      /same NAME/,
      `${band} carries the upstairs warning again — it folds at 420 px and takes the warning with it`,
    );
  }

  const note = upstairsNote(routes);
  /* THE CONNECTION, NOT ITS OLD WORDING. This matched "AMPK, the cell scale's
     energy sensor" until 2026-08-29, when Q27 R1 rewrote `UPSTAIRS` because one
     of its three entries was an identity claim neither paper makes: `CAMK` was
     called "the cell scale's calcium switch", and the cell's switch is CaMKK2,
     a kinase kinase that acts ON the family Fowler's node names. The entries
     now say what each node is rather than which of ours it resembles. What this
     test grades is unchanged — AMPK is named and the connection to the scale
     above is made — so it asks for that instead of for the sentence. */
  assert.match(note, /AMPK,[^;.]*cell scale/, "the doors record no longer connects AMPK upstairs");
  assert.match(
    note,
    /CAMK,[^;.]*NOT the cell scale's CaMKK2/,
    "the note equates Fowler's CAMK with the cell scale's CaMKK2 again — different proteins, " +
      "adjacent steps of one pathway, and neither paper says they are the same",
  );
  assert.match(
    note,
    /not the same number/i,
    "the note names the cell scale's word without saying the two are different quantities, which is " +
      "the half that turns a connection into a contradiction",
  );

  // It has to find the name wherever the model puts it, not in one band.
  const somewhere = ["resistanceOnly", "enduranceOnly", "shared", "outputs", "inputs"].some((b) =>
    (routes[b] ?? []).includes("AMPK"),
  );
  assert.ok(somewhere, "AMPK is in none of the drawn bands, so the note is about a node nobody sees");

  // And a network with none of the taught names says nothing extra.
  assert.equal(upstairsNote({ shared: ["ROS", "NFkB"] }), "", "the note fires on a network that has no shared name");
});

/**
 * The widest output is named only when it is one, and the four widest are the
 * authors' four.
 *
 * Fowler's Figure 2b: the greatest differences immediately after exercise are
 * in protein degradation, inflammation, cell growth and protein synthesis.
 * That is a claim about THEIR run; this checks it of ours, on the shipped
 * copies, so the plate that names the widest is naming the paper's own first.
 * At t = 0 all twelve gaps are 0.0000 and nothing may be named — a tie is an
 * array order, not a result.
 */
test("the widest output is the paper's own, and is not named on a tie", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const end = drawnAt(arms, routes, arms.resistance.grid.tEnd * secondsPerMinute);
  assert.equal(end.widestOutput, "Protein_Degradation", `the widest output at the end is ${end.widestOutput}`);

  const gaps = routes.outputs
    .map((id, i) => [id, Math.abs(end.bands.outputs.r[i] - end.bands.outputs.e[i])])
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  assert.deepEqual(
    gaps.slice(0, 4),
    ["Protein_Degradation", "Inflammation", "Cell_Growth", "Protein_Synthesis"],
    "the four widest are no longer Fowler's Figure 2b four, in its order — the record's sentence is now false",
  );

  const start = drawnAt(arms, routes, 0);
  assert.equal(start.widestOutput, null, `at t=0 every gap is zero and the plate named ${start.widestOutput}`);
});

/* ---- the 2026-09-06 brief: an outcome's own progress through its run ------ */

import { heroProgress } from "./signallingBinding.js";

test("an outcome's progress is its own rise over its own run, per arm, and nothing is compared across arms", async () => {
  const arms = await load();
  const ids = ["Protein_Synthesis", "Cell_Growth", "Mitochondrial_Biogenesis"];
  const t0 = arms.resistance.grid.t0 * secondsPerMinute;
  const tEnd = arms.resistance.grid.tEnd * secondsPerMinute;
  /* Owner §8 asks the three outcomes to be SEEN happening — a strand extruding,
     a bundle thickening, one mitochondrion becoming three. The archive moves
     mitochondrial biogenesis 0.357 → 0.387 over the whole run, which no form
     can show raw. So this is a display mapping of the same kind as the colour
     ramp: each arm's series, on its own, from where it started to where it
     ended. 0 at the first sample, 1 at the last, clamped, and NEVER one arm's
     rise measured against the other's — `heroPair`'s rule holds here too. */
  const start = heroProgress(arms, ids, t0);
  const end = heroProgress(arms, ids, tEnd);
  for (const id of ids) {
    assert.ok(Math.abs(start.r[id]) < 1e-9 && Math.abs(start.e[id]) < 1e-9, `${id} has progress before the run starts`);
    assert.ok(Math.abs(end.r[id] - 1) < 1e-9 && Math.abs(end.e[id] - 1) < 1e-9, `${id} does not reach 1 at the last sample (${end.r[id]}, ${end.e[id]})`);
  }
  let prev = heroProgress(arms, ids, t0);
  for (let t = t0; t <= tEnd; t += 60) {
    const now = heroProgress(arms, ids, t);
    for (const id of ids) {
      for (const arm of ["r", "e"]) {
        assert.ok(now[arm][id] >= prev[arm][id] - 1e-9, `${id} progress went backwards at ${t}s under ${arm}`);
        assert.ok(now[arm][id] >= 0 && now[arm][id] <= 1, `${id} progress ${now[arm][id]} is outside 0..1`);
      }
    }
    prev = now;
  }
  /* A node that does not move over the run has no progress to show, rather
     than a division by zero: B_AR under resistance is flat at 0 for 64 samples. */
  const flat = heroProgress(arms, ["B_AR"], tEnd);
  assert.equal(flat.r.B_AR, 0, "a flat series produced progress");
  assert.ok(Math.abs(flat.e.B_AR - 1) < 1e-9, "the door that opens under endurance did not reach its own end");
});
