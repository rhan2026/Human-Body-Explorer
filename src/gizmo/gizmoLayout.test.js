/**
 * The gizmo layout solver, tested in the same coordinate space it runs in: px.
 *
 * The solver is pure — anchors in, plate rectangles and leader lines out — so
 * the guarantees the gate lane will hold the gizmos to (no overlap, on screen,
 * traceable line) are provable here without a browser, at every aspect, the way
 * cellGeometry.test.js already proves its anchors land inside the canvas.
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { readFile } from "node:fs/promises";

import { layoutGizmos } from "./gizmoLayout.js";
import { buildCellLevel, CELL_CAMERA } from "../cell/cellGeometry.js";
import { buildCellChainLevel } from "../cell/cellChainGeometry.js";
import { buildHeroLevel } from "../signalling/heroGeometry.js";
import { HERO_IDS } from "../signalling/heroNetwork.js";
import { SIGNALLING_CAMERA } from "../signalling/signallingGeometry.js";

/* ---- helpers ------------------------------------------------------------- */

const rectOf = (item, p) => ({ x: p.x, y: p.y, w: item.w, h: item.h });

const intersects = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const contains = (r, [px, py]) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

/** Estimated plate box for a label — the component measures real boxes; the
 * solver only ever sees w/h, so an estimate exercises it identically. */
const plate = (id, label, anchor) => ({ id, anchor, w: 18 + 6.5 * label.length, h: 22 });

function projectPx(at, aspect, W, H, from = CELL_CAMERA) {
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.01, 100);
  camera.position.set(...from);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const v = new THREE.Vector3(...at).project(camera);
  return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
}

function assertSeparatedInsideAndAnchored(items, out, W, H, margin = 8) {
  for (const item of items) {
    const p = out[item.id];
    assert.ok(p, `${item.id} was not placed`);
    const r = rectOf(item, p);
    assert.ok(
      r.x >= margin - 0.5 && r.y >= margin - 0.5 && r.x + r.w <= W - margin + 0.5 && r.y + r.h <= H - margin + 0.5,
      `${item.id} left the viewport: ${JSON.stringify(r)} in ${W}x${H}`,
    );
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = rectOf(items[i], out[items[i].id]);
      const b = rectOf(items[j], out[items[j].id]);
      assert.ok(!intersects(a, b), `${items[i].id} overlaps ${items[j].id}`);
    }
  }
  for (const item of items) {
    for (const other of items) {
      if (other === item) continue;
      assert.ok(
        !contains(rectOf(item, out[item.id]), other.anchor),
        `${item.id}'s plate covers ${other.id}'s anchor — it hides the thing another gizmo points at`,
      );
    }
  }
}

/* ---- the real constellation ---------------------------------------------- */

test("cell scale's five real anchors: separated, on screen, at every aspect the app is used at", () => {
  const model = buildCellLevel();
  for (const aspect of [0.99, 1.2, 1.55, 1.82]) {
    const H = 758;
    const W = Math.round(H * aspect);
    const items = model.anchors.map((a) => plate(a.id, a.label, projectPx(a.at, aspect, W, H)));
    const out = layoutGizmos(items, { w: W, h: H });
    assertSeparatedInsideAndAnchored(items, out, W, H);
  }
  model.dispose();
});

/**
 * THE TWO CONSTELLATIONS THAT ACTUALLY SHIP, and what the dome under them may
 * cost a plate.
 *
 * WHY THESE ARE HERE AT ALL. The test above solves `buildCellLevel`'s anchors,
 * and `buildCellLevel` has not been on screen since the cell scale was rebuilt
 * as a chain: `CellScale.jsx` draws `buildCellChainLevel` and
 * `SignallingScale.jsx` draws `buildHeroLevel`. The gate that proves plates
 * place was proving it about a picture nobody sees.
 *
 * AND THE FIRST VERSION OF THESE TWO MEASURED THE WRONG THING. They ran the
 * solver on the real anchors and asserted the same three properties as above —
 * on screen, no overlap, nobody's plate over anybody's anchor — as a guard on
 * the depth pass that put both sets of nodes on a dome. Falsified before being
 * trusted: with the dome cranked from 0.72 to 3.8, far enough to push nodes
 * through the camera, **all three properties still held**. That is not a bug in
 * the gate, it is `layoutGizmos` doing exactly what it promises — it clamps and
 * spreads whatever it is handed, so no anchor placement can make it fail. A gate
 * that cannot go red is a gate that is not watching anything.
 *
 * WHAT ACTUALLY VARIES IS THE ANCHOR, BEFORE THE SOLVER SEES IT. `Gizmos` places
 * a plate by projecting its anchor, so z given to a node moves that node's
 * projection outward, away from the centre of the screen — and the solver's
 * rescue is precisely what would HIDE that: a plate dragged back on screen from
 * an anchor that has left it is a plate no longer beside its subject. So this
 * measures the projection itself, against the flat twin of the same anchor:
 *
 *   · nothing may leave the canvas or pass behind the camera, where `project`
 *     mirrors the point rather than reporting it off-screen (`Gizmos` carries
 *     that note; a mirrored anchor is a leader line pointing the wrong way);
 *   · and no anchor may drift more than 8 % of the stage's height.
 *
 * Measured at the four aspects: the worst is 38.8 px on a 758 px stage for the
 * cell and 38.2 px for signalling, both 5.1 %. The ceiling is a little over 1.5x
 * that. The worst movers are the SIDE nodes — ADP and CaMKK2, RhoA and AMPK —
 * which is worth writing down because it is the opposite of the guess: the
 * middle nodes get the most z and the least drift, because the dome pushes a
 * projection along its radius from the screen centre and the middle has almost
 * no radius to be pushed along. The edge of the picture is where depth costs a
 * label, and the edge is where the dome gives least.
 */
/* RAISED 0.08 -> 0.105, 2026-09-02. This measures how far a plate lands from
   where it WOULD land if its node had no z — a hypothetical, not a harm. The
   harms are asserted separately in the same loop and still hold at full
   strength: nothing projects from behind the camera, nothing lands off the
   stage, and `assertSeparatedInsideAndAnchored` still runs at all four aspects.
   WHY IT MOVED: both deep scales' forms grew to reach the fibre scale's ink
   (12.6 -> 26.6 % signalling, 13.3 -> 27.6 % cell, against fibre's 27.7 %), and
   the plate anchors are derived from the form radius — `FORM_R * 1.5` and
   `CELL_FORM_R * 1.45` — so they now sit further out along the dome's radius by
   construction. The worst is `Protein_Synthesis` at 9.5 %. The note above
   already records that the side nodes drift most and the middle least; growing
   the forms moved every anchor outward, which is that same fact, larger. */
const DRIFT_BUDGET = 0.105;

function assertAnchorsSurviveTheirDepth(anchors, from, label) {
  for (const aspect of [0.99, 1.2, 1.55, 1.82]) {
    const H = 758;
    const W = Math.round(H * aspect);
    for (const a of anchors) {
      const camera = new THREE.PerspectiveCamera(38, aspect, 0.01, 100);
      camera.position.set(...from);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      const ndc = new THREE.Vector3(...a.at).project(camera);
      assert.ok(
        ndc.z < 1,
        `${label}/${a.id} projects from behind the camera at ${aspect} — its anchor is mirrored, ` +
          "not off screen, and its leader line will point the wrong way",
      );
      const here = projectPx(a.at, aspect, W, H, from);
      const flat = projectPx([a.at[0], a.at[1], 0], aspect, W, H, from);
      assert.ok(
        here[0] >= 0 && here[0] <= W && here[1] >= 0 && here[1] <= H,
        `${label}/${a.id} projects to ${here.map(Math.round)} outside ${W}x${H} — the solver will ` +
          "rescue the plate, which means dragging it away from the thing it names",
      );
      const drift = Math.hypot(here[0] - flat[0], here[1] - flat[1]);
      assert.ok(
        drift <= H * DRIFT_BUDGET,
        `${label}/${a.id} moved ${drift.toFixed(1)} px (${(drift / H * 100).toFixed(1)} % of the ` +
          `stage) at aspect ${aspect} because of its depth — past the ${DRIFT_BUDGET * 100} % this ` +
          "scale's plates are allowed to be shifted by the dome",
      );
    }
  }
}

test("the cell chain's plates survive the depth its nodes were given", () => {
  const model = buildCellChainLevel();
  assertAnchorsSurviveTheirDepth(model.anchors, CELL_CAMERA, "cell");
  for (const aspect of [0.99, 1.2, 1.55, 1.82]) {
    const H = 758;
    const W = Math.round(H * aspect);
    const items = model.anchors.map((a) => plate(a.id, a.label, projectPx(a.at, aspect, W, H)));
    assertSeparatedInsideAndAnchored(items, layoutGizmos(items, { w: W, h: H }), W, H);
  }
  model.dispose();
});

test("the signalling network's plates survive the depth its nodes were given", async () => {
  const archive = JSON.parse(
    await readFile(new URL("../../public/scenarios/fowler_resistance.json", import.meta.url), "utf8"),
  );
  const ids = Object.keys(archive.nodes ?? {});
  const model = buildHeroLevel(
    { types: Object.fromEntries(ids.map((id) => [id, archive.nodes[id].type])), names: {} },
    archive.edges ?? [],
    ids.filter((id) => !HERO_IDS.includes(id)),
  );
  assertAnchorsSurviveTheirDepth(model.anchors, SIGNALLING_CAMERA, "signalling");
  for (const aspect of [0.99, 1.2, 1.55, 1.82]) {
    const H = 758;
    const W = Math.round(H * aspect);
    const items = model.anchors.map((a) =>
      plate(a.id, a.label, projectPx(a.at, aspect, W, H, SIGNALLING_CAMERA)),
    );
    assertSeparatedInsideAndAnchored(items, layoutGizmos(items, { w: W, h: H }), W, H);
  }
  model.dispose();
});

/* ---- the gate lane's stress cases ---------------------------------------- */

test("two coincident anchors get two disjoint plates, each with its own traceable line", () => {
  const items = [plate("a", "AMPK", [400, 300]), plate("b", "ATP · ADP · AMP", [402, 301])];
  const out = layoutGizmos(items, { w: 800, h: 600 });
  assertSeparatedInsideAndAnchored(items, out, 800, 600);
  for (const item of items) {
    const line = out[item.id].line;
    assert.ok(line, `${item.id} lost its leader line at a shared anchor`);
    assert.deepEqual([line.x1, line.y1], item.anchor, `${item.id}'s line does not start at its anchor`);
  }
});

test("320px phone, seven plates: none overlap, none leave the screen", () => {
  const labels = [
    "A-band · never changes length",
    "Z-disc",
    "Myosin · thick",
    "Triad · T-tubule + cisternae",
    "Titin",
    "Actin · thin",
    "Tropomyosin + troponin",
  ];
  // Clustered mid-screen the way a sarcomere frames: everything within ~1/3 of
  // the viewport, so the solver has to spread what the camera bunched.
  const items = labels.map((l, i) => plate(`g${i}`, l, [120 + (i % 3) * 40, 240 + Math.floor(i / 3) * 30]));
  const out = layoutGizmos(items, { w: 320, h: 568 });
  assertSeparatedInsideAndAnchored(items, out, 320, 568);
});

test("a long muscle name still fits a 320px screen", () => {
  const items = [plate("m", "abdominal part of left pectoralis major", [160, 284])];
  const out = layoutGizmos(items, { w: 320, h: 568 });
  const r = rectOf(items[0], out.m);
  // The solver cannot shrink text; it must still keep the plate on screen,
  // which forces the component to cap plate width below the viewport.
  assert.ok(r.x >= 0 && r.x + r.w <= 320, `long-name plate ${JSON.stringify(r)} leaves a 320px screen`);
});

/* ---- the line and the ordering ------------------------------------------- */

test("leader line runs from the anchor to the plate's boundary, or is dropped when the plate sits on it", () => {
  const [item] = [plate("solo", "Titin", [400, 300])];
  const out = layoutGizmos([item], { w: 800, h: 600 });
  const { line } = out.solo;
  if (line) {
    assert.deepEqual([line.x1, line.y1], item.anchor);
    const r = rectOf(item, out.solo);
    const onEdge =
      (Math.abs(line.x2 - r.x) < 0.5 || Math.abs(line.x2 - (r.x + r.w)) < 0.5 ||
        Math.abs(line.y2 - r.y) < 0.5 || Math.abs(line.y2 - (r.y + r.h)) < 0.5) &&
      line.x2 >= r.x - 0.5 && line.x2 <= r.x + r.w + 0.5 &&
      line.y2 >= r.y - 0.5 && line.y2 <= r.y + r.h + 0.5;
    assert.ok(onEdge, `line ends at ${line.x2},${line.y2}, not on the plate ${JSON.stringify(r)}`);
  } else {
    assert.ok(
      contains(rectOf(item, out.solo), item.anchor),
      "line dropped while the plate is nowhere near its anchor — an unpointed gizmo points at nothing",
    );
  }
});

/* ---- it has to run under a moving camera --------------------------------- */

test("a full constellation solves inside a frame at 1920x1080", () => {
  const labels = [
    "A-band · never changes length", "Z-disc", "Myosin · thick", "Triad · T-tubule + cisternae",
    "Titin", "Actin · thin", "Tropomyosin + troponin",
  ];
  const items = labels.map((l, i) => plate(`g${i}`, l, [300 + i * 40, 300 + (i % 3) * 30]));
  const run = () => {
    const t = process.hrtime.bigint();
    layoutGizmos(items, { w: 1920, h: 1080 });
    return Number(process.hrtime.bigint() - t) / 1e6;
  };
  run(); // warm
  const times = Array.from({ length: 5 }, run).sort((a, b) => a - b);
  // Lane 1 is putting the camera on a timeline, so this re-solves while the
  // scene moves, and a solve costing more than a frame is a stutter the viewer
  // sees. The budget is a frame and not a tighter round number: at 10 ms this
  // went red at 10.0 while a Playwright suite had the machine, which is a gate
  // failing on the load rather than on the code. Measured 4.5 ms idle, 10.0 ms
  // under a full browser run, and 161 ms before the scan was windowed — so the
  // regression this exists to catch is an order of magnitude past the line.
  // THE MINIMUM, NOT THE MEDIAN — 2026-09-06. The note above already records
  // this case going red "while a Playwright suite had the machine", and the
  // answer then was to widen the budget from 10 ms to a frame. It was not
  // enough: measured today, alone it passes 3 of 3 and inside the full unit run
  // it fails about half the time, at 351 ms of wall clock for the whole case.
  // Widening again would be chasing the same mistake — the quantity being
  // measured is the machine's load, not the solver's cost, and no budget is
  // wide enough to make a contended median mean something.
  // The FASTEST of five runs is the one sample least contaminated by whatever
  // else the machine was doing, and it still catches what this exists to catch:
  // the regression it was written for was 161 ms, an order of magnitude past
  // the line, and no scheduling luck makes a 161 ms solve finish in 16.
  // A flaky gate is worse than a missing one — it makes every future run
  // ambiguous, which is how a real red gets read as "that one again".
  assert.ok(times[0] < 16.7, `fastest solve ${times[0].toFixed(1)} ms — a frame is 16.7`);
});

test("eight plates on one anchor still separate — the crowded case the fast path cannot serve alone", () => {
  const items = Array.from({ length: 8 }, (_, i) => plate(`c${i}`, `Callout number ${i}`, [400, 300]));
  const out = layoutGizmos(items, { w: 900, h: 700 });
  assertSeparatedInsideAndAnchored(items, out, 900, 700);
});

test("an uncrowded plate stands clear of its subject, so the leader line is a line and not a dot", () => {
  const len = (l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);

  const solo = plate("solo", "Triad · T-tubule + cisternae", [900, 500]);
  const out = layoutGizmos([solo], { w: 1918, h: 1038 });
  assert.ok(len(out.solo.line) >= 20, `solo leader line is ${len(out.solo.line).toFixed(0)} px — the plate is sitting on what it names`);

  // Measured in the browser at 1918x1038: the shortest line on the cell scale
  // was 17 px and on the sarcomere 4 px, because the standoff was scored from
  // the plate's CENTRE. A 280 px plate centred 46 px away has its edge on top of
  // the anchor, which is a callout covering its own subject.
  const model = buildCellLevel();
  const items = model.anchors.map((a) => plate(a.id, a.label, projectPx(a.at, 1.82, 1918, 1038)));
  const cell = layoutGizmos(items, { w: 1918, h: 1038 });
  for (const item of items) {
    assert.ok(len(cell[item.id].line) >= 20, `${item.id}'s line is ${len(cell[item.id].line).toFixed(0)} px`);
  }
  model.dispose();
});

test("same input, same output — a layout that dithers between frames cannot be frozen while the camera moves", () => {
  const items = [
    plate("a", "AMPK", [200, 200]),
    plate("b", "Myofibril", [210, 210]),
    plate("c", "ATP · ADP · AMP", [220, 220]),
  ];
  const once = layoutGizmos(items, { w: 800, h: 600 });
  const twice = layoutGizmos(items, { w: 800, h: 600 });
  assert.deepEqual(once, twice);
});

/**
 * THE STAGE HAS CHROME AT BOTH ENDS, AND PLATES CLEAR BOTH.
 *
 * `Gizmos.jsx` already reserves the foot of the stage, because the transport
 * strip floats there and a plate tucked under it is text painted over text —
 * `reservedBottom` exists for exactly that and its comment names the plate it
 * caught: "ATP · ADP · AMP".
 *
 * On 2026-08-26 the one sentence on the stage moved from the transport strip to
 * the top of the picture, so that the fibre, cell and signalling scales all say
 * it in the same place. That took it OUT of the band `reservedBottom` clears —
 * and put it into a band nothing was clearing. `gate-legibility` caught it at
 * 320 px within the hour: the caption over "27 · 8 · 1" by 2074 px², over
 * "ATP · ADP · AMP", over "of 36", over "Derived".
 *
 * So the viewport carries a `top` as well as a height, and the solver treats
 * the two symmetrically. `top` defaults to 0, which is every caller that has no
 * chrome up there.
 */
test("a band reserved at the top of the stage is a band no plate is placed in", () => {
  const items = Array.from({ length: 7 }, (_, i) => ({
    id: `p${i}`,
    w: 120,
    h: 22,
    /* Anchors deliberately UP in the reserved band: a plate whose subject is
       behind the sentence still has to be placed below it. */
    anchor: [40 + i * 90, 6 + (i % 3) * 8],
  }));
  const TOP = 48;
  const out = layoutGizmos(items, { w: 900, h: 600, top: TOP });

  for (const item of items) {
    const r = out[item.id];
    if (!r) continue;
    assert.ok(
      r.y >= TOP,
      `${item.id} was placed at y ${r.y}, inside the ${TOP}px the stage's own sentence occupies`,
    );
    assert.ok(r.y + item.h <= 600, `${item.id} left the bottom of the stage`);
  }

  /* And with no reservation the same call is unchanged — the default is the
     behaviour every other caller already has. */
  const plain = layoutGizmos(items, { w: 900, h: 600 });
  const zero = layoutGizmos(items, { w: 900, h: 600, top: 0 });
  assert.deepEqual(zero, plain, "passing top: 0 changed a layout that had no chrome to clear");
});
