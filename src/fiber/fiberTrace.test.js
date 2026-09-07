import assert from "node:assert/strict";
import test from "node:test";

import { playheadX, tracePoints } from "./fiberTrace.js";

const y = (pts, i) => +pts.split(" ")[i].split(",")[1];

test("a value at full scale reaches the top of the box, and zero the bottom", () => {
  const pts = tracePoints([0, 29.422], 29.422, 20, 1);
  assert.equal(y(pts, 0), 19, "zero sits on the floor, one pad in");
  assert.equal(y(pts, 1), 1, "full scale reaches the ceiling, one pad in");
});

test("the trace and the bar share one axis, so the playhead cannot contradict the bar", () => {
  // The bar draws value/CA_FULL_SCALE_UM as a width; the trace draws the same
  // ratio as a height. Half of full scale has to be half of the span in both.
  const pts = tracePoints([29.422 / 2], 29.422, 20, 1);
  assert.equal(y(pts, 0), 10);
});

test("a value over full scale is clamped rather than drawn outside the box", () => {
  const pts = tracePoints([50], 29.422, 20, 1);
  assert.equal(y(pts, 0), 1);
});

test("the points span the full width so the last sample lands on the right edge", () => {
  const pts = tracePoints([1, 1, 1], 1);
  assert.deepEqual(pts.split(" ").map((p) => +p.split(",")[0]), [0, 50, 100]);
});

test("an empty or unscaled series draws nothing rather than NaN", () => {
  assert.equal(tracePoints([], 1), "");
  assert.equal(tracePoints([1, 2], 0), "");
  assert.equal(tracePoints(undefined, 1), "");
});

test("the playhead is clamped, because the clock may sit outside the archive", () => {
  assert.equal(playheadX(0, 0, 13), 0);
  assert.equal(playheadX(6.5, 0, 13), 50);
  assert.equal(playheadX(13, 0, 13), 100);
  assert.equal(playheadX(99, 0, 13), 100, "off the end draws at the end, not off the plot");
  assert.equal(playheadX(-5, 0, 13), 0);
});

test("a degenerate range does not divide by zero", () => {
  assert.equal(playheadX(5, 3, 3), 0);
  assert.equal(playheadX(NaN, 0, 13), 0);
});
