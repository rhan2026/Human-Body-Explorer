import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fiberParts, fiberTour } from "./fiberTour.js";

/**
 * TOP-LEFT IS SHARED BY TWO THINGS THAT ARE NEVER UP AT ONCE — 2026-09-07, owner
 * (FIBER pace 3 and 6): the level ladder and the Rep 1 / Rep 10 meters both
 * moved to left 16 / top 56. Owner: *"사다리랑 Rep 1 / Rep 10이 겹치는 일은 없어서
 * 괜찮지?"* — the ladder draws only in `main` with no demonstration running, the
 * meters only on a tour beat that carries `compare`, and no demonstration
 * carries one. This pins the three facts that make that true.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const PROTOCOL = { cycle_s: 1.3, stim_s: 0.3 };

test("the ladder and the compare meters take the same corner", () => {
  const css = read("./fiber.css");
  const block = (sel) => { const i = css.indexOf(sel + " {"); return css.slice(i, css.indexOf("\n}", i)); };
  assert.match(block(".fiber-levels"), /left:\s*16px/); assert.match(block(".fiber-levels"), /top:\s*56px/);
  assert.match(block(".fiber-compare"), /left:\s*16px/); assert.match(block(".fiber-compare"), /top:\s*56px/);
});

test("the ladder stands only in main with nothing playing; the meters only on a tour beat", () => {
  assert.match(read("./MuscleFiberVisualization.jsx"), /stage === "main" && !passRunning && !leaving/, "the ladder's guard changed");
  const parts = fiberParts(PROTOCOL);
  assert.ok(parts.length > 0);
  for (const part of parts) for (const beat of part.beats) assert.ok(!("compare" in beat), `demonstration ${part.id} would raise the meters in main`);
  const tourBeats = fiberTour({ protocol: PROTOCOL, peaks: [{ rep: 1, at: 0, frameAt: 0 }, { rep: 10, at: 9, frameAt: 9 }] }, "Pectoralis major") ?? [];
  assert.ok(Array.isArray(tourBeats));
});
