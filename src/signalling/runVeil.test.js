import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_S } from "../runLoop.js";
import { VEIL_IN_S, VEIL_OUT_S, veilOf } from "./runVeil.js";

/**
 * Owner, fifth brief §8 — the 44.9 → 0 cut: *"44.9 min final state ↓ 200ms
 * scene fades toward paper ↓ hidden reset to 0 ↓ 250ms idle stone network fades
 * back in"*, and *"data를 interpolate하지 않고 scene transition만 한다"*. The
 * veil is a number over the run clock's own holds (`runLoop.js`): it rises over
 * the last 200 ms of the closing hold, is full on the cut frame, and falls over
 * the first 250 ms of the opening hold. The biology is never touched.
 */

test("the veil rises over the last 200 ms of the closing hold and is full on the cut", () => {
  assert.equal(VEIL_OUT_S, 0.2);
  assert.equal(veilOf({ held: "end", holdLeft: HOLD_S }), 0, "the veil should not start with the hold");
  assert.equal(veilOf({ held: "end", holdLeft: 0.3 }), 0);
  assert.ok(Math.abs(veilOf({ held: "end", holdLeft: 0.1 }) - 0.5) < 1e-9);
  assert.equal(veilOf({ held: "end", holdLeft: 0 }), 1, "on the cut frame the scene is hidden");
});

test("the veil falls over the first 250 ms of the opening hold, then the network is back", () => {
  assert.equal(VEIL_IN_S, 0.25);
  assert.equal(veilOf({ held: "start", holdLeft: HOLD_S }), 1, "the frame after the cut is still hidden");
  assert.ok(Math.abs(veilOf({ held: "start", holdLeft: HOLD_S - 0.125 }) - 0.5) < 1e-9);
  assert.equal(veilOf({ held: "start", holdLeft: HOLD_S - 0.25 }), 0);
  assert.equal(veilOf({ held: "start", holdLeft: 0 }), 0);
});

test("a running clock has no veil, and both fades fit inside the holds", () => {
  assert.equal(veilOf({ held: null, holdLeft: 0 }), 0);
  assert.equal(veilOf(null), 0);
  assert.ok(VEIL_OUT_S <= HOLD_S && VEIL_IN_S <= HOLD_S, "a fade longer than the hold would run into the moving picture");
});
