import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { linePoints, xOf, repPeaks, peakChange, drop, pct, windowOf, peakXOf } from "./trace.js";

const RUN = JSON.parse(await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8"));
const T = RUN.series.t;

const pt = (s, i) => s.split(" ")[i].split(",").map(Number);

test("x is by TIME, not by sample index — the grid is dense then sparse", () => {
  // 0.009 s steps for 6.5 s, then 0.09 s: index-based x would draw the recovery
  // half at a tenth of its width.
  const w = windowOf(T, RUN.series.force_relative, 0, 13);
  const s = linePoints(w.t, w.v, { from: 0, to: 13, lo: 0, hi: 1, w: 100, h: 40, pad: 2 });
  const halfway = w.t.findIndex((t) => t >= 6.5);
  assert.ok(Math.abs(pt(s, halfway)[0] - 50) < 1, `t = 6.5 s sits at x ≈ 50, got ${pt(s, halfway)[0]}`);
});

test("a value at hi reaches the top pad and lo the bottom pad; over-range is clamped", () => {
  const s = linePoints([0, 1, 2], [0, 1, 5], { from: 0, to: 2, lo: 0, hi: 1, w: 100, h: 40, pad: 2 });
  assert.equal(pt(s, 0)[1], 38);
  assert.equal(pt(s, 1)[1], 2);
  assert.equal(pt(s, 2)[1], 2);
});

test("an empty window or a flat axis draws nothing rather than NaN", () => {
  assert.equal(linePoints([], [], { from: 0, to: 1, lo: 0, hi: 1 }), "");
  assert.equal(linePoints([0, 1], [1, 1], { from: 0, to: 1, lo: 1, hi: 1 }), "");
  assert.equal(linePoints([0, 1], [1, 1], { from: 1, to: 1, lo: 0, hi: 1 }), "");
});

test("windowOf keeps only samples inside the window, in order", () => {
  const w = windowOf(T, RUN.series.Ca_myo_total, 0.5525, 1.2025);
  assert.ok(w.t.length > 50, "one cycle on the dense grid is ~72 samples");
  assert.ok(w.t[0] >= 0.5525 && w.t[w.t.length - 1] <= 1.2025);
  assert.equal(w.t.length, w.v.length);
});

test("the cursor is clamped to the plot", () => {
  assert.equal(xOf(0, 0, 13, 100), 0);
  assert.equal(xOf(6.5, 0, 13, 100), 50);
  assert.equal(xOf(99, 0, 13, 100), 100);
  assert.equal(xOf(-1, 0, 13, 100), 0);
  assert.equal(xOf(5, 3, 3, 100), 0, "a degenerate window does not divide by zero");
  assert.equal(xOf(NaN, 0, 13, 100), 0);
});

test("per-repetition peaks come off the protocol's own cycle, and match the export", () => {
  /* THE EXPORT, NOT THE ARCHIVE: soce_on.json's own `exported_copy` says the
     archive's turning points differ (Ca 29.83 there, 29.42 here). What is on
     screen is computed off the shipped file, and this pins it to that file —
     all ten of each, measured 2026-09-07, so a window-boundary slip between
     interior repetitions cannot pass on the endpoints alone. */
  const force = repPeaks(T, RUN.series.force_relative, RUN.protocol);
  assert.deepEqual(
    force.map((p) => p.value.toFixed(3)),
    ["0.871", "0.726", "0.622", "0.544", "0.485", "0.439", "0.402", "0.371", "0.345", "0.324"],
  );
  const ca = repPeaks(T, RUN.series.Ca_myo_total, RUN.protocol);
  assert.deepEqual(
    ca.map((p) => p.value.toFixed(3)),
    ["27.145", "27.140", "26.952", "28.458", "29.422", "27.831", "25.991", "26.469", "28.010", "26.743"],
  );
  /* docs/clock-and-events.md measured the two ends by hand off the same file. */
  assert.equal(force.length, RUN.protocol.repetitions);
});

test("peakChange is last against first, and null when there is nothing to compare", () => {
  const force = repPeaks(T, RUN.series.force_relative, RUN.protocol);
  assert.equal(pct(peakChange(force)), "−63%");
  const ca = repPeaks(T, RUN.series.Ca_myo_total, RUN.protocol);
  assert.equal(pct(peakChange(ca)), "−1.5%");
  assert.equal(peakChange([]), null);
  assert.equal(peakChange([{ value: 0 }, { value: 1 }]), null, "a zero first peak has no ratio");
});

test("a protocol without a cycle yields no peaks rather than a guess", () => {
  assert.deepEqual(repPeaks(T, RUN.series.force_relative, {}), []);
  assert.deepEqual(repPeaks(T, RUN.series.force_relative, null), []);
});

test("the store's drop is its first sample against its lowest", () => {
  const d = drop(RUN.series.Ca_SR_total);
  assert.equal(Math.round(d.from), 941);
  assert.equal(Math.round(d.to), 168);
  assert.equal(drop([]), null);
});

test("pct uses the real minus sign and one decimal only under ten percent", () => {
  assert.equal(pct(-0.628), "−63%");
  assert.equal(pct(-0.0148), "−1.5%");
  assert.equal(pct(0.977), "+98%");
  assert.equal(pct(0), "0%");
  assert.equal(pct(null), "");
});

test("peakXOf is where the line is highest inside the window, on the same x axis as the cursor", () => {
  const x = peakXOf(T, RUN.series.Ca_myo_total, 0.5525, 1.2025, 100);
  const t = 0.5525 + (x / 100) * 0.65;
  assert.ok(Math.abs(t - 0.783) < 0.02, `peak of rep 2 is at 0.783 s, got ${t}`);
  assert.equal(peakXOf([], [], 0, 1, 100), 0);
});
