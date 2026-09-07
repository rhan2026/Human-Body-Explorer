import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LEVELS, LEVEL_ORDER } from "./fiberGeometry.js";
import { fiberParts } from "./fiberTour.js";

/**
 * THE FASCICLE AND THE FIBRE ARE THE WAY IN. ONLY THE SARCOMERE IS EXPLORED.
 *
 * `docs/20260905-fix/fiber.md` §12C: *"괜히 세 화면 모두 explorer처럼 만들지
 * 않는다. Fascicle/Fiber = transition. Sarcomere = explorer."* The reason is not
 * tidiness — it is that there is nothing on the upper two levels to explore.
 * Their `update()` takes `(state)` with no time and reads exactly three fields,
 * `crossBridges`, `length` and `girth`. No calcium, no stimulus, no store and
 * no phosphate reach them at all. A ring on a myonucleus would promise a
 * demonstration that cannot exist.
 *
 * THIS IS AN ABSENCE TEST, AND IT IS WRITTEN BECAUSE THE ABSENCE WAS AN
 * ACCIDENT. Measured 2026-09-05: zero handles on the fascicle, zero on the
 * fibre, five on the sarcomere — which is correct, and which held only because
 * `fiberParts`' five ids happen not to collide with the other levels' anchor
 * names. Nothing said so. Add an anchor called `myosin` to `buildFiberLevel`
 * and the fibre grows a ring nobody wrote a demonstration for; rename the
 * sarcomere's `sr` and the store silently loses its own.
 *
 * So the rule is stated where it can go red: a level's pressable set is exactly
 * its own anchors intersected with the parts that have something to show, and
 * for two of the three levels that intersection must be empty.
 */

const RUN = JSON.parse(
  await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8"),
);
const PROTOCOL = RUN.protocol;

/** What `FiberScene` draws a `Handle` for: `parts.some(p => p.id === anchor.id)`. */
function pressableOn(levelId, parts) {
  const model = LEVELS[levelId].build();
  const ids = model.anchors.filter((a) => parts.some((p) => p.id === a.id)).map((a) => a.id);
  model.dispose();
  return ids.sort();
}

test("the fascicle offers nothing to press; the fibre offers exactly its four plates", () => {
  /* 2026-09-07 — owner (FIBER pace 7): *"fiber main에서 you can't really click like name tag를
     클릭 영역으로 하고 zoom in white 정도 하면 좋을 것 같아"*. Until then only the sarcomere
     pressed (this file's old name). The fascicle is still a picture. */
  const parts = fiberParts(PROTOCOL);
  assert.ok(parts.length > 0, "there are no demonstrations at all, so this gate is watching nothing");
  const ids = new Set(parts.map((p) => p.id));
  const fascicle = LEVELS.fascicle.build().anchors.map((a) => a.id);
  assert.deepEqual(fascicle.filter((id) => ids.has(id)), [], "the fascicle grew something to press");
  const fibre = LEVELS.fiber.build().anchors.map((a) => a.id).sort();
  assert.deepEqual(fibre.filter((id) => ids.has(id)), fibre, "a fibre plate has no demonstration");
});

test("the demonstrations are exactly the sarcomere's plates plus the fibre's", () => {
  const parts = fiberParts(PROTOCOL).map((p) => p.id).sort();
  const plates = [...LEVELS.sarcomere.build().anchors, ...LEVELS.fiber.build().anchors].map((a) => a.id).sort();
  assert.deepEqual(parts, plates);
});

test("every level the ladder offers is one this file has ruled on", () => {
  /* THE LADDER IS THE LIST, and a fourth rung added without a decision about
     what it is FOR would slip past the two cases above — they name their
     levels. This one names none: it asks that the set of levels is exactly the
     set this file has an opinion about. */
  assert.deepEqual(
    [...LEVEL_ORDER].sort(),
    ["fascicle", "fiber", "sarcomere"],
    "the level ladder has changed shape; decide whether the new rung is a transition or an explorer " +
      "and say so here",
  );
});
