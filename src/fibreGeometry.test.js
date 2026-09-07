import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { fibreGeometry } from "./fibreGeometry.js";

const rig = JSON.parse(readFileSync(new URL("../public/mapping/rig.json", import.meta.url)));

const PEC = "abdominal part of left pectoralis major";

test("returns the measured fibre line for a mesh that has one", () => {
  assert.deepEqual(fibreGeometry(rig, PEC), {
    centroid: [0.1112, 1.2581, 0.164],
    axis: [0.46683, 0.66039, -0.58818],
    fascicleLengthM: 0.1581,
  });
});

test("the name three.js hands back — spaces sanitised to underscores — finds the same entry", () => {
  // GLTFLoader runs every node name through PropertyBinding.sanitizeNodeName, so
  // App.jsx's `meshName` is never the raw rig.json key. A lookup that does not
  // account for that misses all 297 multi-word muscles and hits only the
  // single-word ones.
  assert.deepEqual(fibreGeometry(rig, "abdominal_part_of_left_pectoralis_major"), fibreGeometry(rig, PEC));
});

test("a mesh with no fibre entry is null, never the nearest one", () => {
  // soleus is in the exercise roster and in rig.meshSegments, but it is wholly
  // within one segment so the build wrote it no chain and no fibre line.
  assert.equal("left soleus" in rig.meshSegments, true);
  assert.equal(fibreGeometry(rig, "left soleus"), null);
  assert.equal(fibreGeometry(rig, "left_soleus"), null);
  assert.equal(fibreGeometry(rig, "no such mesh"), null);
  // a chain without a fibre line is legal in the schema (rig.mjs drops it below 10 mm)
  assert.equal(fibreGeometry({ meshChain: { "tiny muscle": { segments: ["a", "b"], planes: [] } } }, "tiny muscle"), null);
});

test("missing or half-loaded rig is null rather than a throw", () => {
  // useJson resolves to `false` on a failed fetch and `null` until it lands.
  for (const bad of [null, false, undefined, {}, { meshChain: null }]) {
    assert.equal(fibreGeometry(bad, PEC), null);
  }
  assert.equal(fibreGeometry(rig, null), null);
  assert.equal(fibreGeometry(rig, ""), null);
});

test("the caller cannot write through the result into the shared rig", () => {
  const got = fibreGeometry(rig, PEC);
  got.centroid[1] = 99;
  assert.equal(fibreGeometry(rig, PEC).centroid[1], 1.2581);
});
