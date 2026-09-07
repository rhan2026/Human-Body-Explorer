import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * EVERY SCALE THAT HAS A DEEPER ONE OFFERS A WAY INTO IT, ON THE SCREEN.
 *
 * WHY THIS EXISTS, 2026-09-03. The body scale had no visitor-facing way down at
 * all. `to-fiber` was real, it worked, and it lived inside the `⌘D` inspector —
 * so the app's entire premise (body → fibre → cell → signalling) was broken at
 * its first step behind a developer keystroke, on the first screen a visitor
 * sees. `ScaleTrail`, which used to be the visible way between scales, is
 * rendered by nobody: it left every drawer at the owner's ask and never landed
 * anywhere else.
 *
 * NOTHING CAUGHT IT. The descent still worked once you were in the inspector, so
 * every browser case that descends went on passing — they open the panel or
 * navigate by hash. The gap was between a visitor and the control, and no test
 * was standing there.
 *
 * WHAT THIS ASKS IS SOURCE-LEVEL, deliberately. The real check is a pointer on a
 * screen and that belongs in the browser suite; this is the cheap one that fails
 * the moment a scale stops mounting its own door, which is exactly how the body
 * lost its.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the body scale mounts a way down that is not behind the inspector", () => {
  const src = read("../MotionScene.jsx");
  assert.match(src, /<MuscleLens/, "the body scale no longer mounts MuscleLens — it has no way down a visitor can reach");
  /* NOT INSIDE `inspect &&`. The old `to-fiber` chip is still there and still
     fine — it is a developer's shortcut. What must not happen again is that
     being the ONLY one. */
  const lensAt = src.indexOf("<MuscleLens");
  const inspectAt = src.indexOf("{inspect && (");
  assert.ok(
    inspectAt === -1 || lensAt < inspectAt,
    "MuscleLens is mounted inside the inspect block — that is where the way down was hiding before",
  );
});

test("the deep scales mount theirs too", () => {
  for (const [path, what] of [
    /* `FiberScene.jsx`, not `MuscleFiberVisualization.jsx` — the ring lives in
       the scene inside the canvas, not in the page around it. Checked rather
       than assumed: the first cut of this gate named the page and went red on a
       scale whose door was working. */
    ["../fiber/FiberScene.jsx", "the fibre"],
    ["../cell/CellScale.jsx", "the cell"],
  ]) {
    assert.match(read(path), /<WayIn/, `${what} scale no longer mounts WayIn — its way down is gone`);
  }
});

/**
 * ONE PICTURE, NOT FOURTEEN. `previewLevel` keeps a single open preview in a
 * module variable and `openPreview` disposes whatever was there, so N components
 * each opening their own would spend the mount stomping each other's render
 * targets. `MuscleLens` opens ONE and shares the still across every magnifier,
 * which it can do because `buildFiberLevel()` takes no arguments: the fibre scale
 * draws the same sarcomere whichever muscle you arrive from.
 */
test("the body's magnifiers share one preview", () => {
  const src = read("./MuscleLens.jsx");
  assert.equal(
    (src.match(/openPreview\(/g) ?? []).length,
    1,
    "MuscleLens opens the preview more than once — with one module-level target that is a race",
  );
  assert.doesNotMatch(
    read("../fiber/fiberGeometry.js"),
    /export function buildFiberLevel\([^)]+\)/,
    "buildFiberLevel takes an argument now, so the fibre may differ per muscle and one shared still is a lie",
  );
});
