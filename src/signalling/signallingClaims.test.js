import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { loadScenario } from "../scenarioData.js";
import { SCENARIOS, SEPARATION, routesOf } from "./signallingBinding.js";

/**
 * What the signalling scale is allowed to SAY, as distinct from what it draws.
 * `signallingGeometry.test.js` asks whether a published number reaches a pixel;
 * this file asks whether the sentence beside that pixel is true.
 *
 * Both claims pinned here were on screen on 2026-08-17 and both were false
 * against the bytes the same screen had already downloaded. They are absence
 * tests because the damage is a sentence being present.
 */

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(`../../public${path}`, import.meta.url), "utf8"));

/** Source with comments removed — a scar is not a wound (cellClaims.test.js). */
const code = async (name) =>
  (await readFile(new URL(name, import.meta.url), "utf8"))
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const last = (values) => values[values.length - 1];

/**
 * FORBIDDEN: a run length the screen did not measure.
 *
 * "This scale's run is the network's own 45 minutes — 0 to {runSeconds} s" put
 * two numbers in one sentence that could not both be true: `runSeconds` came
 * from the loaded grid and read 2640 s, which is 44 min. The banner rejected
 * 2700 s — a moment inside the authors' bout and inside the archive — as off
 * the end of a run it was calling forty-five minutes long.
 *
 * The exporter's dropped tail is fixed (`export_for_app.kept`), so the two
 * numbers now agree at 44.9 min. This test is what stops the literal coming
 * back: the bout length is the protocol's and is printed from it, the run
 * length is the grid's and is printed from that, and neither is typed.
 */
test("the readout never types a run length — both numbers come from the file", async () => {
  const readout = await code("./SignallingReadout.jsx");
  assert.ok(
    !/\b45\b/.test(readout),
    "SignallingReadout writes 45 into a sentence; the run is 44.9 min and the bout is a field",
  );
  /* THE SECOND HALF LOST ITS SUBJECT AND BECAME AN ABSENCE TEST. It used to
     require the panel to READ the bout's length off the file rather than type
     it, which was the right check while the length was on screen. It is not on
     screen any more — no timeframes anywhere, 2026-08-25 — so requiring the
     field to be read would require the number to exist somewhere to read it
     into. The first assertion above still forbids typing 45; this one now
     forbids rendering the length at all, from any source. */
  assert.ok(
    !/boutMinutes/.test(readout),
    "the bout length is not read from the protocol block",
  );
});

/**
 * FORBIDDEN: calling the undrawn nodes motionless.
 *
 * The panel said 24 nodes "are moved by neither" and that drawing them would be
 * "a third of the screen holding marks that never move". Measured below: 17 of
 * the 24 move. What is true of all 24 is that neither arm leaves them further
 * than SEPARATION from the control — which is OUR threshold, and the sentence
 * has to say that rather than promote a threshold into a fact about the model.
 */
test("the 24 undrawn nodes are below our threshold, not motionless", async () => {
  const arms = {
    resistance: await loadScenario(SCENARIOS.resistance, readJson),
    endurance: await loadScenario(SCENARIOS.endurance, readJson),
    control: await loadScenario(SCENARIOS.control, readJson),
  };
  const routes = routesOf(arms);

  const moves = routes.quiet.filter((id) => {
    const rest = last(arms.control.series(id).values);
    return (
      Math.abs(last(arms.resistance.series(id).values) - rest) > 0 ||
      Math.abs(last(arms.endurance.series(id).values) - rest) > 0
    );
  });
  assert.equal(moves.length, 17, "measured off the shipped bytes at the end of the run");
  assert.equal(routes.quietButMoving, moves.length, "the panel prints a count it did not count");
  assert.ok(moves.includes("myogenin"), "the largest of them, 0.0498 — one SEPARATION short");

  const readout = await code("./SignallingReadout.jsx");
  assert.ok(
    !/never move/.test(readout),
    `SignallingReadout calls the undrawn nodes motionless; ${moves.length} of them move`,
  );
  assert.ok(
    /SEPARATION/.test(readout) && /quiet/.test(readout),
    "the sentence about the undrawn nodes does not carry the threshold that defines them",
  );
  assert.equal(SEPARATION, 0.05);
});

/**
 * FORBIDDEN: counting a distinction this picture cannot draw, in silence.
 *
 * The panel prints "Separating now: N of 58" — shared nodes whose two arms
 * differ by more than SEPARATION (0.05). A node's height is `k * SPAN` with
 * SPAN 0.3, and the marks are MARK_R 0.026 spheres, so two arms stop overlapping
 * only once they differ by 2*0.026/0.3 = 0.173. Every node the panel calls
 * separated at 0.05 is drawn as ONE MARK.
 *
 * At the default entry frame it is total: at t=0 nothing has moved, all 97 pairs
 * coincide, and endurance draws last — measured on the canvas, 112 warm pixels
 * against 37,870 cool, which is antialiasing. The legend carries a RESISTANCE
 * swatch and the panel prints a resistance count over a picture with no
 * resistance in it.
 *
 * This is the cell scale's `coincident()` problem one level down and the answer
 * is the same one: not a rendering trick — offsetting the marks manufactures a
 * separation the model does not have, and fattening one is a halo, which is a
 * band — but a number computed from the same values the marks are drawn from,
 * printed beside the count it qualifies.
 */
test("the panel says how many of its own marks are drawn on top of each other", async () => {
  const geom = await code("./signallingGeometry.js");
  assert.match(
    geom,
    /export const ARMS_FUSE_BELOW/,
    "the activity gap at which two marks stop overlapping is not derived from the geometry",
  );
  /* THE COUNT COMES FROM THAT THRESHOLD, WHEREVER IT IS COMPUTED. This asked
     the panel to name `ARMS_FUSE_BELOW` itself, which held one implementation
     rather than the claim: on 2026-08-26 the loop moved beside the constant as
     `fusedMarks(bands)`, because the stage's standing note needs the same
     number and the panel and the canvas commit in different React roots — a
     third copy of the loop is a third chance to disagree. What has to be true
     is that the count is derived from the geometry's own fusion threshold and
     that whoever prints it says the pairs are drawn on top of each other. */
  assert.match(
    geom,
    /export function fusedMarks[\s\S]*ARMS_FUSE_BELOW/,
    "the count of marks drawn on top of each other is not derived from the geometry's own threshold",
  );
  /* AND THE PICTURE IS WHERE IT IS SAID. The misreading this guards against is
     one a person makes ON SIGHT, and until 2026-08-26 the sentence was only in
     the panel, 811 px from the marks it is about. Q3 R2 put it on the stage;
     Q3 R5 took the panel's copy out, because a measured claim on screen twice
     is one claim a viewer has to reconcile — the rule `FiberMetrics.jsx` states
     and `CellReadout.jsx` followed when the sensor table left. So the assertion
     follows the sentence rather than staying where it used to live. */
  /* AND THE PICTURE THAT NEEDED SAYING IT IS GONE — 2026-08-31.
   *
   * This asserted that `SignallingScale.jsx` puts the sentence on the canvas,
   * because the misreading it guards is one a person makes ON SIGHT and a caveat
   * against that belongs where the sight is. That was right about the census
   * picture: a hundred and twenty-one marks on five shelves, where two arms of
   * one node could land closer than a mark is wide and read as one.
   *
   * The scale draws twelve objects on a grid now, one row and one column each.
   * Nothing can fuse, so the sentence would be warning a viewer about a
   * misreading the drawing cannot produce — which is worse than silence, because
   * it teaches a reader to distrust something that is fine.
   *
   * SO BOTH HALVES ARE PINNED RATHER THAN THE REQUIREMENT DROPPED. The count
   * stays available where the fusible drawing is (`buildSignallingLevel` and
   * `fusedMarks`, above), and the scale that stopped drawing it has stopped
   * saying it. If the marks ever come back, the first assertion below is what
   * makes the sentence come back with them — deliberately, not by memory. */
  const stage = await code("./SignallingScale.jsx");
  assert.doesNotMatch(
    stage,
    /drawn as (one|a single)\b/,
    "the scale says marks are drawn on top of each other again while drawing twelve objects on a " +
      "grid — either the census came back, in which case restore the assertion this replaced, or " +
      "the sentence is warning about a misreading this picture cannot make",
  );
  assert.ok(
    !/buildSignallingLevel/.test(stage),
    "the scale is building the census again; the overlap caveat is required whenever it does, and " +
      "this file's previous assertion (git history, 2026-08-31) is the one to restore",
  );

  /* AND NOT IN BOTH PLACES. */
  const readout = await code("./SignallingReadout.jsx");
  assert.doesNotMatch(
    readout,
    /drawn as one mark|drawn as a single mark/,
    "the panel kept a copy of a claim the picture now carries",
  );
});

/**
 * FORBIDDEN: a destination the screen names in the archive's spelling.
 *
 * The bottom band is the end of the whole descent, and until 2026-08-30 it was
 * twelve anonymous marks under a plate reading `what the cell ends up doing`.
 * Naming them is the fix; naming them WRONG has two failure modes and this pins
 * both, because they pull against each other and a fix for one is the other.
 *
 * ONE — an id reaches the screen. `plainly` falls back to `readable`, which is
 * the right behaviour at runtime (a new phenotype shows up spelled out rather
 * than vanishing from a sentence a reader is counting against the band) and the
 * wrong thing to ship. `Mitochondrial_Biogenesis` was pulled off this layer on
 * 2026-08-30 as a term the depth table keeps off it, and a silent fallback is
 * exactly how it would come back. So: every phenotype the archive ships has an
 * entry, checked against the bytes rather than against the map's own keys.
 *
 * TWO — the map goes stale the other way, listing destinations the archive no
 * longer has. That is the sentence undercounting or overcounting the band drawn
 * beside it, which is the defect the doors sentence shipped with: it named two
 * of nine while the canvas drew all nine, and a reader who counts and finds the
 * panel wrong stops believing the panel. Membership is checked both directions.
 */
test("every destination the archive ships has words a first-year owns", async () => {
  // Off the shipped bytes, the way every other case in this file reads them:
  // `loadScenario` is a fetch and there is no server here, and the roles list is
  // what `routesOf` reads for the band anyway.
  const { plainly } = await import("./signallingBinding.js");
  const outputs = (await readJson(`/scenarios/${SCENARIOS.resistance}.json`)).node_roles.phenotypes;

  assert.ok(outputs.length > 0, "the archive shipped no phenotypes to name");

  const untranslated = outputs.filter((id) => plainly(id) === id.replace(/_/g, " "));
  assert.deepEqual(
    untranslated,
    [],
    `these destinations reach the screen in the archive's own spelling: ${untranslated.join(", ")}. ` +
      `A fallback is correct at runtime and wrong to ship — the depth table keeps node ids off ` +
      `this layer, and an unnoticed fallback is how one comes back.`,
  );

  // And nothing is named that is not drawn. `plainly`'s map is private, so this
  // reads it the only way the screen can: through the function, over the ids the
  // band actually holds.
  const sentence = outputs.map(plainly).join(", ");
  for (const id of outputs) {
    assert.ok(
      sentence.includes(plainly(id)),
      `${id} is drawn in the outputs band and missing from the sentence beside it`,
    );
  }
});

/**
 * FORBIDDEN: a node type the archive ships and the cell has no room for.
 *
 * The scene's layout is the authors' own `type` column mapped to a compartment —
 * receptors in the membrane, kinases in the cytosol, transcription factors and
 * genes in the nucleus. That mapping is the one thing standing between "the
 * layout is the paper's" and "the layout is ours", so an archive that adds a
 * type has to be noticed rather than absorbed.
 *
 * `COMPARTMENT_OF` falls back to the cytosol, which is right at runtime — a node
 * that lands somewhere plausible beats a node that vanishes — and is exactly the
 * kind of silence §5 calls a bug when it is the only behaviour. This is the
 * noise: every type in the shipped bytes must be named in the table.
 */
test("every node type the archive ships has a place in the cell", async () => {
  const { COMPARTMENT_OF, BANDS } = await import("./signallingGeometry.js");
  const nodes = (await readJson(`/scenarios/${SCENARIOS.resistance}.json`)).nodes;

  const shipped = [...new Set(Object.values(nodes).map((n) => (n.type ?? "").trim()))].sort();
  assert.ok(shipped.length > 0, "the archive shipped no node types to place");

  const homeless = shipped.filter((t) => !(t in COMPARTMENT_OF));
  assert.deepEqual(
    homeless,
    [],
    `these node types reach the scene with no compartment and fall to the cytosol: ${homeless.join(", ")}. ` +
      `The fallback keeps them drawn, which is right; leaving them there unnoticed is not — the layout ` +
      `stops being the authors' classification the moment a type is placed by default.`,
  );

  // And every compartment the table names is a band that exists to draw it.
  const missing = [...new Set(Object.values(COMPARTMENT_OF))].filter((c) => !(c in BANDS));
  assert.deepEqual(missing, [], `compartments with no band: ${missing.join(", ")}`);
});

/* ---- the 2026-09-06 brief, where it lands in the page rather than the model */

const here = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("the closing strip is gone, and the explorer cluster stands top-left, vertical", async () => {
  const page = await here("./SignallingScale.jsx");
  const css = await here("./signalling.css");
  /* Orchestrator, 2026-09-06: *"the closing strip ('That is the whole descent…'
     plus its four buttons) is deleted outright."* Absence, pinned: the strip
     took 80 px off the bottom of the canvas on every visit. */
  for (const trace of ["sig-close", "signals-close", "That is the whole descent"]) {
    assert.ok(!page.includes(trace), `SignallingScale.jsx still carries "${trace}"`);
    assert.ok(!css.includes(trace), `signalling.css still carries "${trace}"`);
  }
  /* Top LEFT on 2026-09-06; top RIGHT on 2026-09-07 — owner, FIBER 24: one place for the toggles on every floor (ENERGY's 16/172). */
  const block = css.match(/\.sig-explorer\s*\{[^}]*\}/)?.[0] ?? "";
  assert.match(block, /\btop:\s*\d/, ".sig-explorer is not anchored to the top");
  assert.match(block, /\bleft:\s*16px/, ".sig-explorer is not top-left (owner 2026-09-07, S3)");
  assert.match(block, /\btop:\s*56px/, ".sig-explorer does not sit under the title");
  assert.doesNotMatch(block, /translateX\(-50%\)/, ".sig-explorer is still centred");
});

test("the orbit is limited from one declaration, and the idle sway stays inside it", async () => {
  const page = await here("./SignallingScale.jsx");
  const { ORBIT_LIMITS, SIGNALLING_CAMERA } = await import("./signallingGeometry.js");
  for (const prop of ["minAzimuthAngle", "maxAzimuthAngle", "minPolarAngle", "maxPolarAngle"]) {
    assert.match(page, new RegExp(`${prop}=\\{ORBIT_LIMITS\\.${prop}\\}`), `OrbitControls does not take ${prop} from ORBIT_LIMITS`);
  }
  /* `CameraSway` turns the standing shot ±SWAY_ARC about its own azimuth while
     OrbitControls is live; an arc past the limit is a swing the controls clamp
     back every frame — a shudder at the end of every sway. */
  const arc = Number(page.match(/const SWAY_ARC = ([\d.]+)/)?.[1]);
  assert.ok(Number.isFinite(arc), "SWAY_ARC not found");
  const az = Math.atan2(SIGNALLING_CAMERA[0], SIGNALLING_CAMERA[2]);
  assert.ok(az - arc >= ORBIT_LIMITS.minAzimuthAngle && az + arc <= ORBIT_LIMITS.maxAzimuthAngle, `SWAY_ARC ${arc} swings past the orbit limit`);
});

test("the picture only ever labels what the brief allows by default", async () => {
  const page = await here("./SignallingScale.jsx");
  /* The plate filter goes through `platesShown`, which `heroMotion.test.js`
     pins; an inline filter beside it is a second rule that can disagree. */
  assert.match(page, /items=\{platesShown\(/, "Gizmos items are not chosen by platesShown");
  assert.doesNotMatch(page, /a\.kind === "outcome" \|\|/, "the outcomes are still permanently labelled by an inline rule");
});

test("Pause holds the pass and the run clock together", async () => {
  /* `code`, not `here`: the comment-stripped read, so a pattern inside a
     comment cannot satisfy this. */
  const page = await code("./SignallingScale.jsx");
  /* Tonight's rule 2, as the orchestrator put it: Pause is the only way out of a
     pass that runs on every arrival, and Resume continues at the same beat.
     `useTour`'s `paused` freezes the storyboard and shifts its clock; the page
     has to stop writing the run clock in the same breath, or the network keeps
     running under a frozen sentence. One flag, `playing`, drives both — so the
     two cannot disagree. */
  /* `heldByViewer`, not `!playing`: a shared `@t` link arrives with `playing`
     false and the pass must still play there (reviewed 2026-09-06). */
  assert.match(page, /const heldByViewer = !playing && everPlayed\.current/, "a pause is not distinguished from an arrival-stopped run");
  assert.match(page, /paused:\s*heldByViewer/, "useTour is not told about Pause");
  assert.match(
    page,
    /const passAt = tour\.running && !heldByViewer && Number\.isFinite\(beat\?\.at\)/,
    "the pass clock still writes the run clock while paused",
  );
  /* The other author of the clock. With `passAt` null while paused, this step
     is the only thing between Pause and a network free-running under a frozen
     sentence — the gated `passAt` line above leans on it. */
  assert.match(page, /const step =\s*passAt === null && playing && speed > 0 && !\(stage === "silent" && !coverOpen\)/, "the free-running step ignores Pause");
});


test("pass 5 wiring: the page tells the picture when the run stands on its last sample, hands it wall time and the seam, and veils the cut", async () => {
  /* Owner, fifth brief §1, §3, §8. Each of these is a value the scene cannot
     know on its own: `ended` (the outcomes' stone-and-arcs state), `wall` (the
     fades run on the viewer's seconds, since the clock stands still at the
     ending), `seam` (what ENERGY drew AMPK in, and how much is still held), and
     the veil over the run clock's holds. A claim held by a comment is a scar,
     so comments are stripped first. */
  const page = await code("./SignallingScale.jsx");
  const update = page.slice(page.indexOf("model.update({"), page.indexOf("})", page.indexOf("model.update({")));
  for (const key of ["ended", "wall", "seam"]) assert.ok(new RegExp(`\\b${key}\\s*[:,]`).test(update), `model.update is not handed \`${key}\``);
  assert.ok(/veilOf\(/.test(page), "the page does not compute the veil from the run clock");
  /* The record ENERGY froze at the press rides under `state.handoff` (main.jsx
     builds `below = { ...state, muscle, handoff }`); `state.ampk` is always
     undefined and reads as "no purple" without a sound. */
  assert.ok(/handedAmpk=\{state\?\.handoff\?\.ampk/.test(page), "the seam must read the AMPK record from state.handoff, where main.jsx puts the crossing");
  /* And the hold starts on the FIRST frame, not on the first beat: the pass
     only starts after SILENT_MS (1.6 s), and a hold keyed on the running tour
     alone let AMPK arrive in stone, jump to purple at the first beat and fade
     again (verifiers, 2026-09-06). */
  assert.ok(/const held = [^\n]*stage === "silent"/.test(page), "the seam hold must cover the silent stage before the pass starts");
  assert.ok(/className="sig-veil"/.test(page), "no veil element over the stage");
  const css = await readFile(new URL("./signalling.css", import.meta.url), "utf8");
  assert.ok(/\.sig-veil\s*\{[^}]*pointer-events:\s*none/.test(css), ".sig-veil must not catch the pointer");
});
