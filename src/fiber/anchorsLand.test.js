import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import { buildCellLevel } from "../cell/cellGeometry.js";
import { LEVELS } from "./fiberGeometry.js";
import { advance, createFiberState } from "./fiberSimulation.js";

/**
 * A LEADER LINE HAS TO LAND ON SOMETHING.
 *
 * `scripts/anchors-vs-tissue.mjs` has measured this since the callouts became
 * gizmos, and `fiberGeometry.js` quotes it against itself: *"every one of these
 * sits 4-12% of the model's own size outside the tissue … but moving six anchors
 * is a change only a browser can judge, and this turn moves the two that had to
 * move."*
 *
 * Half of that is false and the script is the proof: whether an anchor is inside
 * the model needs no browser at all. What needed one was whether the SOLVER can
 * still place eight plates once their anchors cluster — and that is a different
 * question from whether the line points at the tissue.
 *
 * Measured 2026-08-27, before: 13 of 22 anchors outside, the sarcomere's six at
 * 4.4–11.9% of the model away. On screen at 1200x760 the sarcomere draws 137 px
 * tall and six leaders ended 33–91 px clear of it, in white.
 *
 * A script nobody runs is a measurement nobody has. This is the same check with
 * the same rule, in the gate.
 */
const CELL_REST = {
  atpBeads: 30, adpBeads: 5, ampBeads: 1,
  atpBeadsControl: 30, adpBeadsControl: 5, ampBeadsControl: 1,
  pAMPK: 18, pAMPKControl: 18, demand: 0.399187, demandControl: 0.399187,
};

function boxOf(group) {
  const box = new THREE.Box3();
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone();
    if (o.isInstancedMesh) {
      const m = new THREE.Matrix4();
      const inst = new THREE.Box3();
      for (let i = 0; i < o.count; i += 1) {
        o.getMatrixAt(i, m);
        inst.copy(o.geometry.boundingBox).applyMatrix4(m).applyMatrix4(o.matrixWorld);
        box.union(inst);
      }
      return;
    }
    box.union(b.applyMatrix4(o.matrixWorld));
  });
  return box;
}

test("every callout's anchor is on the model it names, not in the air beside it", () => {
  const stray = [];
  for (const [name, build, drive] of [
    ["sarcomere", LEVELS.sarcomere.build, "fibre"],
    ["fiber", LEVELS.fiber.build, "fibre"],
    ["fascicle", LEVELS.fascicle.build, "fibre"],
    ["cell", buildCellLevel, "cell"],
  ]) {
    const model = build();
    if (drive === "fibre") {
      const s = createFiberState();
      for (let i = 0; i < 30; i += 1) advance(s, 1 / 60);
      model.update(s, s.time);
    } else model.update(CELL_REST);

    const box = boxOf(model.group);
    const size = box.getSize(new THREE.Vector3()).length();
    for (const a of model.anchors) {
      const p = new THREE.Vector3(...a.at);
      if (box.containsPoint(p)) continue;
      stray.push(`${name}: "${a.label}" is ${((box.distanceToPoint(p) / size) * 100).toFixed(1)}% of the model away`);
    }
    model.dispose();
  }

  assert.deepEqual(stray, [], `a leader line pointing at nothing:\n  ${stray.join("\n  ")}`);
});
