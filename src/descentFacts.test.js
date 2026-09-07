import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { descentFacts } from "./descentFacts.js";
import { fibreGeometry } from "./fibreGeometry.js";

const rig = JSON.parse(readFileSync(new URL("../public/mapping/rig.json", import.meta.url)));

test("the pectoralis span the rig measured, against the sarcomere the fibre scale draws", () => {
  // 0.1581 m, straight out of rig.json — the ride states the ratio between the
  // two ends of the descent, and both ends have to be read rather than typed.
  const { fascicleLengthM } = fibreGeometry(rig, "abdominal part of left pectoralis major");
  assert.deepEqual(descentFacts(fascicleLengthM), { spanMm: 158, sarcomereUm: 2.2, ratio: 72000 });
});

test("the ratio claims no more precision than the sarcomere value it divides by", () => {
  // 2.2 um is two significant figures. 0.1581 / 2.2e-6 is 71863.6..., and
  // putting "71,864 x" on screen would invent three digits nothing measured.
  assert.equal(descentFacts(0.1581).ratio, 72000);
  assert.equal(descentFacts(0.0423).ratio, 19000);
  assert.equal(descentFacts(0.0423).spanMm, 42.3);
});

test("no measured span is no facts — never a zero, never a guess", () => {
  // fibreGeometry returns null for 170 of the 467 muscle meshes. The card says
  // so out loud; what it must not do is divide by a span nobody measured.
  for (const bad of [null, undefined, 0, -1, NaN, Infinity, "0.15"]) {
    assert.equal(descentFacts(bad), null, `descentFacts(${String(bad)})`);
  }
});
