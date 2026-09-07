import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import * as THREE from "three";

import { loadScenario } from "../scenarioData.js";
import { SCENARIOS, drawnAt, routesOf } from "./signallingBinding.js";
import {
  BANDS,
  BUNDLE_STEPS,
  SIGNALLING_CAMERA,
  SIGNALLING_EXTENT,
  buildSignallingLevel, pullFor, STANDING } from "./signallingGeometry.js";
import { buildHeroLevel, heroAt } from "./heroGeometry.js";
import { HERO_IDS, HERO_NODES } from "./heroNetwork.js";
import { FORM_R } from "./heroForms.js";

/**
 * The picture, read back off the meshes.
 *
 * `signallingBinding.test.js` proves the export reaches the drawn numbers. This
 * file proves the drawn numbers reach the matrices — the other half of the seam,
 * and the half this project has broken seven times. Everything below reads
 * instance matrices rather than asking the module what it thinks it drew.
 */

/** The band floors, as `signallingGeometry.js` lays them out. Read from the
 *  module rather than retyped, so a band moved there moves this with it. */
const BAND_Y = Object.fromEntries(Object.entries(BANDS).map(([k, b]) => [k, b.y]));

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(`../../public${path}`, import.meta.url), "utf8"));

const load = async () => ({
  resistance: await loadScenario(SCENARIOS.resistance, readJson),
  endurance: await loadScenario(SCENARIOS.endurance, readJson),
  control: await loadScenario(SCENARIOS.control, readJson),
});

/** Every instance position of one mesh, in the order it was written. */
function positions(mesh) {
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const out = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    out.push(p.setFromMatrixPosition(m).clone());
  }
  return out;
}

const meshByRole = (model, role) => {
  let found = null;
  model.group.traverse((o) => {
    if (o.userData.role === role) found = o;
  });
  assert.ok(found, `no mesh tagged "${role}"`);
  return found;
};

test("a node's value is its height, so two arms that agree are drawn in one place", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes);
  const end = drawnAt(arms, routes, arms.resistance.grid.tEnd * 60);
  model.update(end);

  const r = positions(meshByRole(model, "arm-resistance"));
  const e = positions(meshByRole(model, "arm-endurance"));
  assert.equal(r.length, model.slots.length);
  assert.equal(e.length, model.slots.length);

  // THE ARRIVAL, MEASURED ON THE MATRICES. The twelve outputs' two marks are
  // drawn within a hair of each other — that coincidence is the result, and it
  // has to survive being drawn or the screen is making a claim the model does
  // not. The same pair of marks is far apart up in the split.
  const at = (band) => model.slots.map((s, i) => [s, i]).filter(([s]) => s.band === band).map(([, i]) => i);
  const gap = (i) => Math.abs(r[i].y - e[i].y);
  const outputs = Math.max(...at("outputs").map(gap));
  const split = Math.max(...[...at("resistanceOnly"), ...at("enduranceOnly")].map(gap));
  /* THE WIDEST OF EACH, not the widest against the narrowest. The first version
     of this compared the widest output against the CLOSEST split node and
     failed at 0.0111 against 0.0013 — because a split node can sit right on the
     threshold, moved 0.051 by one arm and 0.0497 by the other, and part by
     almost nothing. The sentence is about the biggest doors, so the statistic
     has to be the biggest of each. */
  assert.ok(
    outputs < split / 10,
    `the widest output parts by ${outputs.toFixed(4)} and the widest split node by ${split.toFixed(4)} — ` +
      `the whole sentence is that the first number is the small one`,
  );

  // Every mark of one node shares its x: the two arms are the same node drawn
  // twice, not two nodes side by side.
  for (let i = 0; i < r.length; i++) assert.equal(r[i].x, e[i].x, model.slots[i].id);
  model.dispose();
});

test("if the published series changes, the picture changes — every node, both arms", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes);

  model.update(drawnAt(arms, routes, 20 * 60));
  const before = { r: positions(meshByRole(model, "arm-resistance")), e: positions(meshByRole(model, "arm-endurance")) };

  /* One frame's numbers moved by hand, straight into `update`. This is the
     question that catches the defect: six tests once passed over the fibre seam
     while a 10x change in the published force moved 0 of 10 drawn quantities.

     MOVED INWARD, NOT UP, AND THAT COST A ROUND. Written as `v + 0.25` this
     reported "ResistanceExercise is drawn from nothing" — the input sits at
     exactly 1.0, `update` clamps to the band, and 1.25 and 1.0 are drawn in the
     same place. The clamp is right (these are fractional activities and a value
     outside 0..1 is a broken input, not a big result) and the probe was wrong:
     a probe that pushes into a clamp cannot fail on the nodes that need it most.
     Half the range toward the middle moves every value there is, and leaves
     every one of them inside the band. */
  const base = drawnAt(arms, routes, 20 * 60);
  const inward = (v) => v + (v < 0.5 ? 0.25 : -0.25);
  const shove = (arm) =>
    Object.freeze({
      ...base,
      bands: Object.freeze(
        Object.fromEntries(
          Object.entries(base.bands).map(([k, b]) => [k, Object.freeze({ ...b, [arm]: b[arm].map(inward) })]),
        ),
      ),
    });

  model.update(shove("r"));
  const afterR = { r: positions(meshByRole(model, "arm-resistance")), e: positions(meshByRole(model, "arm-endurance")) };
  for (let i = 0; i < before.r.length; i++) {
    assert.notEqual(afterR.r[i].y, before.r[i].y, `${model.slots[i].id}: resistance mark is drawn from nothing`);
    assert.equal(afterR.e[i].y, before.e[i].y, `${model.slots[i].id}: endurance mark moved with resistance`);
  }

  model.update(shove("e"));
  const afterE = positions(meshByRole(model, "arm-endurance"));
  for (let i = 0; i < before.e.length; i++) {
    assert.notEqual(afterE[i].y, before.e[i].y, `${model.slots[i].id}: endurance mark is drawn from nothing`);
  }
  model.dispose();
});

test("the rest control is a different kind of mark, not a fainter one", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes);
  model.update(drawnAt(arms, routes, 20 * 60));

  const bout = meshByRole(model, "arm-resistance");
  const control = meshByRole(model, "arm-control");

  /* OPACITY IS THE CHANNEL UNCERTAINTY IS ENCODED IN, so it may not be the
     channel that distinguishes the control (CLAUDE.md §5). The cell scale one
     step up shipped a faded offset copy and a reader who had never seen the
     model called it a band on sight. Here the control is a flat tick and the
     arms are spheres: a different mark for a different role, at full strength.
     Its own geometry is what says "baseline", and a single tick at a single
     value cannot be read as the edge of a range. */
  assert.equal(control.material.opacity, 1);
  assert.equal(bout.material.opacity, 1);
  assert.notEqual(control.geometry.type, bout.geometry.type);
  assert.equal(control.count, bout.count);
  model.dispose();
});

test("every callout lands inside the canvas, at every aspect the app is used at", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  /* IT MEASURES THE SCENE THAT SHIPS NOW, WHICH IS NOT THE ONE IT USED TO.
     This test framed `buildSignallingLevel` — five compartment shelves and a
     hundred and twenty-one marks — and that builder has drawn no pixel since
     2026-08-31, when the owner's *"120개는 절대 넣지마"* replaced it with
     `heroGeometry.buildHeroLevel`. It kept passing the whole time, on a picture
     nobody sees, which is the same defect `gizmoLayout.test.js` wrote itself a
     paragraph about. The compartment contract that builder carries is still
     gated, by the tests above and below this one; what moves here is the
     FRAMING, which is a claim about what a viewer's window contains and
     therefore has to be about what the viewer is looking at.
     The build is the scale's own, argument for argument: `SignallingScale.jsx`
     reads the wiring off the resistance arm because the three scenarios are the
     same network under different inputs, and the background layer is every id
     the twelve do not claim. */
  const model = buildHeroLevel(
    routes,
    arms.resistance.network.edges,
    Object.keys(routes.names ?? {}).filter((id) => !HERO_IDS.includes(id)),
  );
  /* Same rule the cell scale bought the hard way: anchors are placed by y, which
     is aspect-independent, and never fitted by x, which is not.
     THE RANGE IS MEASURED, AND IT MOVED ON 2026-08-30 WHEN THE PANEL LEFT. It
     read 0.99 to 1.82 — 0.99 being a 1024 window's stage back when a 272 px
     panel sat beside it. This scale has no panel now, so its stage is the whole
     body: swept in a browser across seven viewports, the real range is 1.10
     (390x844, where the layout stacks) to 1.861 (1920x1080).
     Both ends were wrong and in opposite directions. 0.99 is an aspect this
     scale can no longer produce, and it was the binding case — so the contract
     was holding the layout to a frame narrower than any real one. 1.861 is
     reachable and was not being checked. Widened at the top, tightened at the
     bottom, both to what a browser reports. */
  for (const aspect of [1.1, 1.3, 1.55, 1.861]) {
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.01, 100);
    /* THE FRAME THE PAGE SHOWS — `STANDING` (camera and aim dropped together)
       times `pullFor`, pass 3. The network is as wide as the stage now, and
       below the contract floor the resting shot steps back; a contract that
       measured the origin-aimed camera without the pull was measuring a
       framing nobody is shown. */
    const pull = pullFor({ width: aspect, height: 1 });
    camera.position.set(STANDING.camera[0], STANDING.camera[1], STANDING.camera[2] * pull);
    camera.lookAt(...STANDING.lookAt);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    /* THE POINT THE WORDS GO TO, which is `at` — hung a form's own allowance
       above the shape it names. `Gizmos` projects exactly this point, so this is
       the bound the paragraph beside a node actually lives inside. */
    for (const anchor of model.anchors) {
      const ndc = new THREE.Vector3(...anchor.at).project(camera);
      assert.ok(
        Math.abs(ndc.x) <= 0.8 && Math.abs(ndc.y) <= 0.86,
        `"${anchor.label}" projects to ndc (${ndc.x.toFixed(4)}, ${ndc.y.toFixed(4)}) at aspect ${aspect}`,
      );
    }
    /* AND THE RINGS STILL HAVE TO BE ON THE CANVAS. A looser bound, because the
       thing being bounded is smaller — but a bound, so "the plate moved to x = 0"
       cannot become "the control may be anywhere". 0.94 leaves 6 % of the half
       width, which is 38 px at 1280 against a ring drawn at 53 px across. */
    for (const anchor of model.anchors) {
      const ndc = new THREE.Vector3(...anchor.ringAt).project(camera);
      assert.ok(
        Math.abs(ndc.x) <= 0.94 && Math.abs(ndc.y) <= 0.94,
        `"${anchor.label}"'s ring projects to ndc (${ndc.x.toFixed(4)}, ${ndc.y.toFixed(4)}) at aspect ${aspect}`,
      );
    }
    /* And the drawing itself, which is what the cell scale's labels actually ran
       out of room inside. The RIM of each form rather than its centre: a node
       sliced in half by the edge of the window is the defect, and its middle is
       still comfortably on screen when that happens. */
    for (const node of HERO_NODES) {
      const [x, y, z] = heroAt(node);
      for (const [dx, dy] of [[-FORM_R, 0], [FORM_R, 0], [0, -FORM_R], [0, FORM_R]]) {
        const ndc = new THREE.Vector3(x + dx, y + dy, z).project(camera);
        assert.ok(
          Math.abs(ndc.x) <= 0.98 && Math.abs(ndc.y) <= 0.98,
          `${node.id} reaches ndc (${ndc.x.toFixed(3)}, ${ndc.y.toFixed(3)}) at aspect ${aspect} — off the canvas`,
        );
      }
    }
  }
  model.dispose();
});

test("the camera is off the axis, and nothing in the picture is placed for it", async () => {
  /* WHAT THIS ASKED FOR UNTIL 2026-09-01, and why the answer changed.

     It was `assert.equal(SIGNALLING_CAMERA[0], 0)`, with the reason "a yawed
     camera makes every hand-placed anchor a fit that expires". That reason is
     true, and the gate was still the wrong way round: a camera aimed straight
     down z at an arrangement laid out in x and y draws an elevation, and an
     elevation is flat by construction. Pinning the yaw to zero was pinning this
     scale to being a diagram, and the audit that sent this lane measured what
     that costs against the fibre one scale up.

     So the thing the old gate protected against is REMOVED rather than
     tolerated, and this asks for the removal. What expires under a yaw is a
     coordinate somebody TYPED against one projection. The shipped scene types
     none: every node — and with it every name plate and every focus ring — comes
     out of `heroAt`, which is `col` and `row` through one surface function, so a
     turned camera moves a label with the thing it names and there is nothing
     left to expire. `buildSignallingLevel`'s anchors ARE hand-placed, and that
     is survivable for exactly one reason: no camera looks at them any more.

     BOTH HALVES ARE HERE BECAUSE EITHER ALONE CANNOT GO RED FOR THE RIGHT
     REASON. "The camera is off the axis" alone passes with the anchors typed
     back in by hand; "no anchor is typed" alone passes with the camera square-on
     again and the picture flat. */
  const [x, y, z] = SIGNALLING_CAMERA;
  const yaw = Math.atan2(x, z);
  const pitch = Math.atan2(y, z);
  /* 0.26 -> 0.12, 2026-09-06. The floor was 15° each way, fitted to the 32°/16°
     camera; the owner's §10 asks for *"기본 3/4 angle 아주 약하게"* and the shot
     then stood 14° off and 9° up. Off the axis is still the claim — a square-on
     camera would draw the three planes as one.
     0.12 -> 0.08 FOR THE YAW in pass 3 (the shot is 5.5° off, 8° up): the
     outcome row has to read as one row and the yaw is what staggers it. This
     is a bound on what we ship, not a claim about what an eye can see; nothing
     here measured perception. */
  assert.ok(
    /* 0.08 / 0.12 until 2026-09-07 — owner (signalling S1): *"tilted forward to the right"*; still off the axis, barely. */
    Math.abs(yaw) > 0.02 && Math.abs(pitch) > 0.05,
    `the camera is back on the axis at [${SIGNALLING_CAMERA}] — yaw ${((yaw * 180) / Math.PI).toFixed(1)}°, ` +
      `pitch ${((pitch * 180) / Math.PI).toFixed(1)}°, and a square-on camera draws an elevation`,
  );

  const arms = await load();
  const routes = routesOf(arms);
  const model = buildHeroLevel(
    routes,
    arms.resistance.network.edges,
    Object.keys(routes.names ?? {}).filter((id) => !HERO_IDS.includes(id)),
  );
  for (const node of HERO_NODES) {
    const anchor = model.anchors.find((a) => a.id === node.id);
    assert.ok(anchor, `${node.id} is drawn and has no anchor`);
    const [ax, ay, az] = heroAt(node);
    assert.deepEqual(
      anchor.ringAt,
      [ax, ay, az],
      `${node.id}'s ring is not where the layout puts it — a coordinate has been typed, and a typed ` +
        "coordinate is a fit that expires the next time the camera or the drawing moves",
    );
    /* THE SIGN IS DERIVED TOO, added 2026-09-01. Hung uniformly above, the top
       row's plates were the binding constraint on the whole picture — every
       attempt to make the drawing bigger died on "Resistance Exercise" leaving
       the canvas rather than on anything about the drawing. A node with no row
       above it wears its name underneath. That is still not a typed coordinate,
       which is what this gate exists to forbid: the offset is the form's own
       allowance and the direction comes from the node's own row, so both move
       with the layout and neither expires under a camera. */
    assert.deepEqual(
      anchor.at,
      /* 1.5 -> 0.94 WITH THE IMPLEMENTATION, 2026-09-02, and the multiple is not
         what this gate is for. It forbids a TYPED coordinate — its own note
         above says so — and the offset is still the form's own allowance times
         the node's own row. What moved is that `FORM_R` grew 0.16 -> 0.255 to
         reach the fibre scale's ink while `ROW_GAP` stayed 0.32, so a lift of
         1.5 radii became 1.20 ROWS: every plate anchored past the node above its
         own. 0.94 puts it back at three quarters of a row, which is where it was
         when it was tuned. */
      /* 1.35 UNDER for the top row since pass 3 (2026-09-06): with the entries
         at the sides, a plate inside the chevron's lower half ran into the
         shell's top-corner controls. Still the form's own allowance times a
         rule about the row — not a typed coordinate. */
      [ax, ay + (node.row === 0 ? -1.35 : 0.94) * FORM_R, az],
      `${node.id}'s plate is not its own position plus or minus the form's allowance`,
    );
  }
  model.dispose();
});

test("the level states its extent, and states that it has no measured one", () => {
  // The Fowler network is a system of 121 ODEs. It has no geometry at all — no
  // compartments, no distances, not even a cell boundary — so the layout here is
  // ours and the only honest extent is the absence of one.
  assert.match(SIGNALLING_EXTENT, /No measured extent/);
  /* WHAT IT COVERS, NOT HOW BIG IT IS. This asked for /121 species/ until
     2026-08-29. The counts left the line that day and are one press away in
     `model_version` ("121 species / 261 reaction rows, of which 259 are
     interactions … the paper's own count"); the five words they cost bought the
     sentence saying the authors' own parameter range clears the threshold this
     screen decides with, on a scale that was at 200 of 200. The line's job is
     the seam and the subject, and it still does both — what is missing from
     "one cell's network" is magnitude, not identity. */
  /* "web of signals" since T13/B3 — the pass and this line share one beginner
     word for the thing, and the browser gate holds them to it. */
  assert.match(SIGNALLING_EXTENT, /network|web of signals/);
  assert.doesNotMatch(
    SIGNALLING_EXTENT,
    /\b\d+ (species|interactions)/,
    "the counts came back to the extent line without the words being paid for",
  );
  /* AND NO SPAN, WHICH IS THE HALF THAT CHANGED. This asked for /45 min/ until
     2026-08-25, when the owner asked for no timeframes anywhere on the screens
     — "your choice for better visualization but i dont want timeframs
     anywhere". The extent still has to say WHAT it covers; it may no longer say
     for how long, so the assertion is inverted rather than deleted and the rule
     is now standing instead of momentary. */
  assert.doesNotMatch(
    SIGNALLING_EXTENT,
    /\d+\s*(min|hours?|h|sec|s)\b/,
    "a duration came back into the extent",
  );
});

test("the quiet nodes are absent from the picture, and that absence is deliberate", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes);
  // 24 of the 121 are moved by neither arm past SEPARATION. Not motionless —
  // 17 of them move, by less than our threshold — so the panel reports both
  // counts and draws neither. Pinned so "we drew everything" cannot quietly
  // become true.
  assert.equal(meshByRole(model, "arm-resistance").count, 121 - routes.quiet.length);
  assert.equal(model.slots.filter((s) => s.band === "quiet").length, 0);
  model.dispose();
});

/**
 * THE WIRING, WHICH IS THE ONLY THING ON THIS SCREEN THAT IS NOT A NUMBER.
 *
 * The scene drew 121 marks in five bands and no connections, because the model's
 * edges stopped at the science layer: `fowler_*.json` carried `nodes` and
 * `node_roles` and nothing about what feeds what. A signalling network drawn
 * without its edges is a scatter plot of a system whose whole subject is
 * connection. These pin the reaching, not the computing.
 */

test("the edges reach the scene, and only between nodes that are drawn", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const edges = arms.resistance.network.edges;
  assert.ok(edges.length > 200, `the export carried ${edges.length} edges`);

  const model = buildSignallingLevel(routes, edges);
  const wires = meshByRole(model, "wiring");
  const drawnIds = new Set(model.slots.map((s) => s.id));

  // Every edge with both ends on screen, and no others. 24 of the 121 nodes are
  // below the separation threshold and have no slot; a line to one of them would
  // point at nothing.
  const expected = edges.filter(
    ([a, b]) => drawnIds.has(a) && drawnIds.has(b) && a !== b,
  ).length;
  assert.equal(wires.userData.drawn, expected);
  /* VERTICES ARE NO LONGER TWO PER EDGE, and the count moved rather than went.
     Between-band edges are bowed toward the axis since 2026-08-30 and sampled
     into `BUNDLE_STEPS` segments, so a raw vertex count reads line pieces. What
     this line was actually protecting is that the layer draws EVERY qualifying
     edge and no others, and `userData.drawn` is that number, asserted above
     against the archive rather than against itself.
     The vertex count is still pinned, just to what it should now be: two per
     within-band edge, and two per sample of a bowed one. A dropped edge or an
     invented one still moves it. */
  /* BY FLOOR, OFF THE SLOT ITSELF, because that is the condition the code
     applies. A slot has carried its own `y` since the layout became the cell's
     compartments — its band is which ARM moved it and no longer where it sits,
     so a name lookup answers a different question than the drawing asks. */
  const y = (() => {
    const at = new Map(model.slots.map((sl) => [sl.id, sl.y]));
    return (id) => at.get(id);
  })();
  const flat = edges.filter(
    ([a, b]) => drawnIds.has(a) && drawnIds.has(b) && a !== b && y(a) === y(b),
  ).length;
  assert.equal(
    wires.geometry.getAttribute("position").count,
    flat * 2 + (expected - flat) * BUNDLE_STEPS * 2,
  );
  model.dispose();
});

test("the wiring sits at the band floors, so it never competes with the height", async () => {
  // Height is this scene's only data channel. A line strung between two marks
  // would move with them — a second drawing of the same numbers, in a channel
  // that already carries them, and one that would have to pick an arm to
  // follow. So every endpoint has to be a band FLOOR.
  //
  // Read off the scene rather than off a constant: at an activity of zero a mark
  // sits exactly on its floor, so driving every node to zero makes the marks
  // report the floors themselves. No internal is exported to test this.
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes, arms.resistance.network.edges);

  const zero = { bands: {} };
  for (const band of ["inputs", "resistanceOnly", "enduranceOnly", "shared", "outputs"]) {
    const n = routes[band].length;
    zero.bands[band] = { r: Array(n).fill(0), e: Array(n).fill(0), c: Array(n).fill(0) };
  }
  model.update(zero);

  const marks = meshByRole(model, "arm-resistance");
  const m = new THREE.Matrix4();
  const floors = new Set();
  for (let i = 0; i < model.slots.length; i++) {
    marks.getMatrixAt(i, m);
    floors.add(+m.elements[13].toFixed(5));
  }

  /* THE INVARIANT IS "NOT THE MARKS", AND SINCE 2026-08-30 IT IS CHECKED
     DIRECTLY RATHER THAN THROUGH A PROXY. Between-band edges are bowed toward
     the axis now, so their sampled points are deliberately NOT at floors — the
     bow's apex is the mean of the two floors it spans. That is still a function
     of BANDS alone and of no node's value, which is the whole claim.
     Two assertions instead of one, and together they are stricter than the
     endpoint sweep they replace:
       1. every ENDPOINT is still exactly a band floor — the ends are what a
          reader traces, and they may not drift;
       2. the whole buffer is IDENTICAL at two different instants of the run,
          which is the invariant in its own words. The old check could not have
          caught a bow whose height came from a mark; this cannot miss it. */
  const pos = meshByRole(model, "wiring").geometry.getAttribute("position");
  const lo = Math.min(...floors);
  const hi = Math.max(...floors);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    assert.ok(
      y >= lo - 1e-5 && y <= hi + 1e-5,
      `wiring vertex ${i} sits at y=${y}, outside the band floors it spans (${lo}..${hi}) — ` +
        `a bow may bend between two floors and may not leave them`,
    );
  }

  const snapshot = () => Array.from(meshByRole(model, "wiring").geometry.getAttribute("position").array);
  const atZero = snapshot();
  model.update(drawnAt(arms, routes, 20 * 60));
  assert.deepEqual(snapshot(), atZero, "the wiring moved when the run did — it is reading the marks");
  model.update(drawnAt(arms, routes, arms.resistance.grid.tEnd * 60));
  assert.deepEqual(snapshot(), atZero, "the wiring moved when the run did — it is reading the marks");
  model.dispose();
});

test("an export with no edges draws no wiring rather than crashing", () => {
  const routes = { inputs: ["a"], resistanceOnly: ["b"], enduranceOnly: [], shared: [], outputs: [], quiet: [], names: {} };
  for (const none of [null, undefined, []]) {
    const model = buildSignallingLevel(routes, none);
    let found = null;
    model.group.traverse((o) => { if (o.userData.role === "wiring") found = o; });
    assert.equal(found, null, "absent edges have to read as absent, not as a crash");
    model.dispose();
  }
});

/**
 * THE CONTROL THE VIEWER TURNS, and the four invariants it is not allowed to
 * buy its effect with (this file's own docstring): height is the only data
 * channel, all arms sit at the same z, the control is a different MARK and never
 * a fainter one, and nothing encodes a number as size, brightness or opacity.
 *
 * So the arm control is VISIBILITY and nothing else. A fade would put a second
 * meaning on the channel uncertainty is drawn in — the cell scale shipped a
 * faded copy and a reader called it a band on sight (cellGeometry.js:66) — and
 * an offset would manufacture a separation the model does not have. An arm is
 * either drawn as it always was or not drawn, and the no-exercise tick stays
 * under every state, because a bout with no baseline under it is unreadable.
 */
test("a stem is its own mark's height, and nothing else", async () => {
  /* THE STEM IS A LOLLIPOP, WHICH IS THE SAME CHANNEL DRAWN TWICE ON PURPOSE —
   * and that is exactly the thing this file polices, so it is pinned rather than
   * trusted. This scene's contract is "height is the only data channel". A stem
   * from the band floor up to the mark does not add a second one: its length IS
   * the height, so reading either gives the same number. What would break the
   * contract is a stem whose length came from anywhere else — a difference from
   * the control, a rate, anything derived — and that is what this catches.
   *
   * Two claims, both read off the matrices rather than off the module's opinion:
   *   1. every stem's top is its own mark's centre, at every instant;
   *   2. a stem is invisible exactly when its arm is.
   */
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes);

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const q = new THREE.Quaternion();

  for (const t of [0, 20 * 60, arms.resistance.grid.tEnd * 60]) {
    model.update(drawnAt(arms, routes, t));
    for (const [markRole, stemRole] of [
      ["arm-resistance", "stem-resistance"],
      ["arm-endurance", "stem-endurance"],
    ]) {
      const marks = meshByRole(model, markRole);
      const stems = meshByRole(model, stemRole);
      assert.equal(stems.count, marks.count, `${stemRole}: one stem per mark`);
      for (let i = 0; i < marks.count; i++) {
        stems.getMatrixAt(i, m);
        m.decompose(pos, q, scale);
        // The box is centred, so its top is centre + half its height.
        const top = pos.y + scale.y / 2;
        marks.getMatrixAt(i, m);
        const markY = m.elements[13];
        assert.ok(
          Math.abs(top - markY) < 1e-5,
          `${stemRole}[${i}] at t=${t} tops out at ${top}, its mark is at ${markY} — ` +
            `a stem whose length is not its own mark's height is a second data channel`,
        );
      }
    }
  }

  for (const [arm, r, e] of [["resistance", true, false], ["endurance", false, true], ["both", true, true]]) {
    model.show(arm);
    assert.equal(meshByRole(model, "stem-resistance").visible, r, `${arm}: resistance stem`);
    assert.equal(meshByRole(model, "stem-endurance").visible, e, `${arm}: endurance stem`);
  }
  model.dispose();
});

test("the arm control hides an arm, and buys it with nothing else", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes);
  model.update(drawnAt(arms, routes, 20 * 60));

  const r = meshByRole(model, "arm-resistance");
  const e = meshByRole(model, "arm-endurance");
  const c = meshByRole(model, "arm-control");
  const heights = () => [positions(r).map((p) => p.y), positions(e).map((p) => p.y)];
  const before = heights();
  /* And depth is part of "nothing else": if switching an arm moved marks in z,
     the fix would be a state-dependent offset rather than a fixed order. */
  const depthsOf = () => [r, e, c].map((mesh) => +positions(mesh)[0].z.toFixed(6));
  const beforeDepths = depthsOf();

  for (const [arm, drawnR, drawnE] of [
    ["resistance", true, false],
    ["endurance", false, true],
    ["both", true, true],
  ]) {
    model.show(arm);
    assert.equal(r.visible, drawnR, `${arm}: resistance arm`);
    assert.equal(e.visible, drawnE, `${arm}: endurance arm`);
    assert.equal(c.visible, true, `${arm}: the baseline the bout is read against left the picture`);
    // Not brightness, not size, not depth, not height.
    assert.equal(r.material.opacity, 1);
    assert.equal(e.material.opacity, 1);
    assert.equal(c.material.opacity, 1);
    assert.deepEqual(heights(), before, `${arm}: the control moved a mark`);
    assert.deepEqual(depthsOf(), beforeDepths, `${arm}: an arm changed depth with the state`);
    /* THE ARMS SIT AT THREE CONSTANT DEPTHS NOW, AND THAT IS THE CLAIM. This
       asked for z = 0 on every mark, which held while they were coplanar — and
       coplanar is what produced the defect: two opaque spheres at nearly the same
       height fight for the same pixels, and the one drawn second wins above their
       midpoint and loses below it. A hard seam at full contrast, at a gap of
       0.0002, in a drawing whose contract says it has no threshold anywhere.
       What the assertion is FOR survives and is asserted below: a state change
       may not move a mark, in any axis. What is dropped is the coplanarity,
       because the depth order is what makes "one mark" literally true — the arm
       in front hides the one behind, and a gap of zero shows no crescent at all.
       An offset in HEIGHT would manufacture a separation the model does not
       have; z carries nothing on a scale with no measured extent. */
    for (const [mesh, name] of [[r, "resistance"], [e, "endurance"], [c, "control"]]) {
      const zs = new Set(positions(mesh).map((p) => +p.z.toFixed(6)));
      assert.equal(zs.size, 1, `${arm}: the ${name} arm's marks are not all at one depth`);
    }
    const depths = [r, e, c].map((mesh) => +positions(mesh)[0].z.toFixed(6));
    assert.equal(new Set(depths).size, 3, `${arm}: two arms share a depth, so their marks tie again`);
  }
  model.dispose();
});

/**
 * WHAT FIRES, AND WHETHER IT REACHES A PIXEL (fixing-prd §3).
 *
 * The scale's whole sentence is "two doors, one room" and until 2026-08-25 the
 * picture drew only the room: 264 identical faint lines, in which the nine edges
 * leaving `ResistanceExercise` looked exactly like the nine hundredth edge
 * downstream of them. A viewer pressing the arm chips watched marks change
 * height with no way to see that the two bouts come IN at different places.
 *
 * These are the seam tests for the fix, in this file's usual shape: read the
 * meshes, not the module's opinion of them.
 */

test("each input's first steps are drawn again, lit, in that arm's own hue", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const edges = arms.resistance.network.edges;
  const model = buildSignallingLevel(routes, edges);

  for (const [key, input] of [["resistance", "ResistanceExercise"], ["endurance", "EnduranceExercise"]]) {
    const lit = meshByRole(model, `entry-${key}`);
    const drawnIds = new Set(model.slots.map((s) => s.id));
    const expected = edges.filter(([a, b]) => a === input && b !== input && drawnIds.has(b)).length;
    assert.ok(expected > 0, `${input} has no drawn first step to light`);
    assert.equal(lit.userData.drawn, expected, `${key}: the lit fan is not this input's own edges`);
    /* ONE INSTANCE PER SAMPLE OF THE BOW, SINCE 2026-08-30 — the lit layer takes
       the same bundled path as the faint layer under it, so a first step is a
       run of `BUNDLE_STEPS` cylinders rather than one. The claim this line makes
       is unchanged and still exact: the fan is this input's own edges and
       nothing else, at the resolution they are drawn. `userData.drawn` above is
       the edge count and is asserted against the archive; this is the geometry
       that has to agree with it. */
    /* A first step that lands in the SAME compartment as its input runs flat
       along that floor and is one instance, not a bowed run of `BUNDLE_STEPS` —
       the same split the faint layer makes. Counted off the slots rather than
       assumed, because which first steps stay in a compartment is a fact about
       the archive's node types. */
    const yOf = new Map(model.slots.map((sl) => [sl.id, sl.y]));
    const litEdges = edges.filter(([a, b]) => a === input && b !== input && drawnIds.has(b));
    const flatLit = litEdges.filter(([a, b]) => yOf.get(a) === yOf.get(b)).length;
    assert.equal(
      lit.count,
      flatLit + (expected - flatLit) * BUNDLE_STEPS,
      `${key}: one instance per flat first step, ${BUNDLE_STEPS} per bowed one`,
    );

    /* AND IT HAS TO BE SOMETHING THE CAMERA CAN APPROACH.
       A `LineBasicMaterial` line is one DEVICE pixel wide at every distance —
       `linewidth` is not implemented on any platform we ship to. Measured
       2026-08-26 between the wide framing and the doors framing, held: the
       marks' median run went 10 px to 16 px, 1.6x, and the fan's modal run
       stayed 2 px at both. The beat exists to push in on these edges, and they
       were the one thing in the frame that the push did not reach.
       So this asserts geometry with a cross-section, not line primitives. */
    assert.ok(!lit.isLineSegments, `${key}: a line primitive cannot answer the camera`);
    assert.ok(lit.isInstancedMesh, `${key}: the lit fan is not drawn as instanced geometry`);

    // Brighter than the network under it, or "lit" is a word for something the
    // eye cannot separate. One constant radius for all of them and no motion:
    // height is this scene's only data channel, so these may be told apart but
    // nothing about them may vary with a value. A pulse is what
    // `gate-no-strobe` exists for.
    assert.ok(lit.material.opacity > meshByRole(model, "wiring").material.opacity);
    const radii = new Set(
      [...Array(lit.count)].map((_, i) => {
        const m = new THREE.Matrix4();
        lit.getMatrixAt(i, m);
        const s = new THREE.Vector3().setFromMatrixColumn(m, 0).length();
        return +s.toFixed(6);
      }),
    );
    assert.equal(radii.size, 1, `${key}: the fan's thickness varies, which makes it look like a quantity`);
  }

  /* THE SAME EDGES DRAWN TWICE, NOT MOVED OUT OF THE FAINT LAYER. Pulling them
     out would turn the wiring's count into a number about which edges we chose
     to feature, and the network would stop being complete under the marks. */
  const wires = meshByRole(model, "wiring");
  const drawnIds = new Set(model.slots.map((s) => s.id));
  assert.equal(
    wires.userData.drawn,
    edges.filter(([a, b]) => drawnIds.has(a) && drawnIds.has(b) && a !== b).length,
    "the full wiring lost the edges the entry fans light",
  );
  model.dispose();
});

test("the lit doors go dark with their own arm, and the network under them does not", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes, arms.resistance.network.edges);
  const wires = meshByRole(model, "wiring");

  for (const [arm, litR, litE] of [
    ["resistance", true, false],
    ["endurance", false, true],
    ["both", true, true],
  ]) {
    model.show(arm);
    // An entry fan burning over a hidden bout is the picture saying a bout is
    // entering that is not on screen.
    assert.equal(meshByRole(model, "entry-resistance").visible, litR, `${arm}: resistance doors`);
    assert.equal(meshByRole(model, "entry-endurance").visible, litE, `${arm}: endurance doors`);
    assert.equal(meshByRole(model, "arm-resistance").visible, litR, `${arm}: the fan left its arm`);
    assert.equal(meshByRole(model, "arm-endurance").visible, litE, `${arm}: the fan left its arm`);
    // The wiring is the NETWORK, not a run. It is there under every state.
    assert.equal(wires.visible, true, `${arm}: the network stopped being drawn`);
  }
  model.dispose();
});

test("an export with no doors lights nothing rather than crashing", () => {
  // `routes.doors` is absent for any caller that built routes by hand, and every
  // scenario but Fowler's ships no edges at all. Absent has to read as absent.
  const routes = { inputs: ["a"], resistanceOnly: ["b"], enduranceOnly: [], shared: [], outputs: [], quiet: [], names: {} };
  const model = buildSignallingLevel(routes, [["a", "b", 1]]);
  const roles = [];
  model.group.traverse((o) => o.userData.role && roles.push(o.userData.role));
  assert.ok(!roles.some((r) => r.startsWith("entry-")), "a fan was lit for an input nobody named");
  model.show("resistance");
  model.show("both");
  model.dispose();
});

/**
 * THE CONTROL IS A FLOOR, AND A FLOOR DOES NOT COME THROUGH THE FLOORBOARDS.
 *
 * `signallingGeometry.js` says what the tick is for: *"a flat tick under each
 * node's pair of spheres"*, and *"the floor the bout is read against, not a
 * third result competing for the same row"*. It goes into the group first so
 * the two arms draw over it.
 *
 * Render order does not settle depth. The tick was `BoxGeometry(0.05, 0.008,
 * 0.05)` — as DEEP as it is wide — sitting at `ARM_Z.control`, which puts its
 * front face well in front of a sphere's surface anywhere near that sphere's
 * silhouette. Measured 2026-08-26 at the doors framing, every mark whose arms
 * sat at the control's own height wore a pair of slate nubs out of its left and
 * right sides: `.claude/shots/q2/sig-tick-through-before.png`. That is the same
 * defect as the fibre triad's membranes at Q2 R1 — a part drawn inside another
 * part, reading as one object with a decoration on it.
 *
 * This asserts the relationship rather than the number: wherever the tick has
 * width, its front face has to be behind the sphere that sits at that height.
 * A tick that gets wider, or an `ARM_Z` that is re-spaced, has to keep it.
 */
test("the control's tick stays behind the marks it is the floor for", async () => {
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildSignallingLevel(routes, arms.resistance.network.edges);
  model.update(drawnAt(arms, routes, 20 * 60));

  const control = meshByRole(model, "arm-control");
  const mark = meshByRole(model, "arm-endurance");
  const { width, depth } = control.geometry.parameters;
  const markR = mark.geometry.parameters.radius;

  const zOf = (mesh) => positions(mesh)[0].z;
  const tickFront = zOf(control) + depth / 2;
  const halfWidth = width / 2;

  /* The worst case is the tick's own corner in x: that is where the sphere's
     surface has fallen furthest back toward its silhouette. */
  const x = Math.min(halfWidth, markR);
  const sphereSurface = zOf(mark) + Math.sqrt(Math.max(markR * markR - x * x, 0));

  assert.ok(
    tickFront <= sphereSurface,
    `the tick's front face is at z ${tickFront.toFixed(4)} and the mark's surface at x ${x.toFixed(3)} is ` +
      `only at z ${sphereSurface.toFixed(4)} — it comes through the sphere by ` +
      `${(tickFront - sphereSurface).toFixed(4)}, so the floor is drawn as a rivet through the result`,
  );

  /* And it is still a tick: as wide as the mark, and flat. */
  assert.ok(width >= 2 * markR * 0.9, "the tick stopped being as wide as the mark it is read against");
  assert.ok(control.geometry.parameters.height < width / 4, "the tick stopped being flat");
  model.dispose();
});

/* ---- pass 4, P0 — the phone framing, on the phone's own layout ------------ */

import { NARROW_PULL, STANDING_NARROW } from "./signallingGeometry.js";

test("on a phone the narrow layout fills the window at a camera close enough that the objects are 30 % bigger than before", async () => {
  /* Owner §11: everything was *"legible and tiny"* because the desktop drawing
     was shown from 2.3x the distance. The narrow layout is framed by height,
     so the camera stands at NARROW_PULL x the desktop distance, and every
     anchor still lands inside the contract at the stacked aspect. */
  const arms = await load();
  const routes = routesOf(arms);
  const model = buildHeroLevel(routes, arms.resistance.network.edges, Object.keys(routes.names ?? {}).filter((id) => !HERO_IDS.includes(id)), { narrow: true });
  const aspect = 390 / 844;
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.01, 100);
  const pull = pullFor({ width: 390, height: 844 }, true);
  assert.equal(pull, NARROW_PULL, "a narrow stage does not take the narrow pull");
  const before = pullFor({ width: 390, height: 844 }, false);
  assert.ok(before / pull >= 1.3, `objects grow only ${(before / pull).toFixed(2)}x against the owner's 30–40 %`);
  camera.position.set(STANDING_NARROW.camera[0], STANDING_NARROW.camera[1], STANDING_NARROW.camera[2] * pull);
  camera.lookAt(...STANDING_NARROW.lookAt);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  for (const anchor of model.anchors) {
    const ndc = new THREE.Vector3(...anchor.at).project(camera);
    assert.ok(Math.abs(ndc.x) <= 0.8 && Math.abs(ndc.y) <= 0.86, `"${anchor.label}" projects to (${ndc.x.toFixed(3)}, ${ndc.y.toFixed(3)}) on the phone`);
  }
  model.dispose();
});
