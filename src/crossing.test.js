import assert from "node:assert/strict";
import test from "node:test";

import { beginCrossing, CROSSING_MS } from "./crossing.js";

/**
 * The attribute a scale change is drawn from.
 *
 * Small, and worth pinning anyway: it is written on `<html>` rather than held in
 * React because the scene swap unmounts whichever component would have held it,
 * and a leak here leaves the canvas mid-transform on a screen nobody is crossing.
 */

const html = () => globalThis.document.documentElement;

/* THE STUB GREW A `style`, because the crossing writes one now. It is a real
   map rather than a spy: the rules in `styles.css` read `--crossing-x/y` through
   `var()`, so what matters is that the property is SET and CLEARED, not that a
   setter was called. `beginCrossing` reaches it through `?.`, so a stub without
   one would let every assertion below pass while nothing was written. */
function stubStyle() {
  const props = new Map();
  return {
    props,
    setProperty: (k, v) => props.set(k, v),
    removeProperty: (k) => props.delete(k),
    getPropertyValue: (k) => props.get(k) ?? "",
  };
}

test.beforeEach(() => {
  globalThis.document = { documentElement: { dataset: {}, style: stubStyle() } };
});

test("a crossing names its direction, and the direction is the meaning", () => {
  beginCrossing("down");
  assert.equal(html().dataset.crossing, "down");
  beginCrossing("up");
  assert.equal(html().dataset.crossing, "up");
});

test("it clears itself, so a settled screen carries no crossing", async () => {
  beginCrossing("down");
  await new Promise((r) => setTimeout(r, CROSSING_MS + 60));
  assert.equal(html().dataset.crossing, undefined, "the attribute outlived the move");
});

test("a second crossing restarts the beat rather than ending early on the first's timer", async () => {
  beginCrossing("down");
  await new Promise((r) => setTimeout(r, CROSSING_MS * 0.6));
  beginCrossing("up");
  // The first timer would fire around here if it had not been cleared.
  await new Promise((r) => setTimeout(r, CROSSING_MS * 0.6));
  assert.equal(html().dataset.crossing, "up", "the first crossing's timer cut the second short");
  await new Promise((r) => setTimeout(r, CROSSING_MS));
  assert.equal(html().dataset.crossing, undefined);
});

/**
 * WHERE THE DESTINATION GROWS FROM.
 *
 * The rule this feeds carried its own regret for weeks — "an origin at the
 * picked muscle would be better and is not available here" — and the owner's
 * ask on 2026-09-04 is what made it worth wiring: *"진짜 들어가는 것처럼
 * 들어가야돼"*. A push that grows out of the middle of the window while the
 * viewer is looking at a muscle in the corner is the page-turn they were
 * describing, whatever its easing.
 */
test("a crossing from a point grows from that point, and one without falls back to centre", () => {
  const style = () => html().style;

  beginCrossing("down", { x: 412, y: 268 });
  assert.equal(style().getPropertyValue("--crossing-x"), "412px");
  assert.equal(style().getPropertyValue("--crossing-y"), "268px");

  // No point: the properties are CLEARED, not left at the last press. A stale
  // origin is worse than none — the CSS falls back to 50% only when the
  // variable is absent, so leaving it puts the next crossing on the last
  // muscle pressed.
  beginCrossing("up");
  assert.equal(style().getPropertyValue("--crossing-x"), "");
  assert.equal(style().getPropertyValue("--crossing-y"), "");

  // A half-answer is no answer: a NaN coordinate would serialise as "NaNpx".
  beginCrossing("down", { x: 412, y: Number.NaN });
  assert.equal(style().getPropertyValue("--crossing-x"), "");
});

test("the stylesheet is told the one length, so the two cannot drift", () => {
  beginCrossing("down");
  assert.equal(html().style.getPropertyValue("--crossing-ms"), `${CROSSING_MS}ms`);
});
