import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * WHAT ORDER THE AUTHORS' OWN RUN PUTS THESE IN.
 *
 * Q13 R10, 2026-08-27. The guided pass says *"It lands on troponin, and the
 * filaments pull"* — a mechanism, and a true one. It is easy to read that as a
 * claim about timing, and easier still for the next person to write the timing
 * version onto the screen. So the timing is measured here once, off the shipped
 * archive rather than off the canvas, and pinned.
 *
 * In `soce_on.json`, sampled at 9 ms, across the first five 0.65 s cycles:
 *
 *   cycle 0  calcium peak 0.153  force peak 0.108  store trough 0.153
 *   cycle 1                0.783             0.774               0.693
 *   cycle 2                1.467             1.422               1.323
 *   cycle 3                2.115             2.079               1.953
 *   cycle 4                2.763             2.736               2.601
 *
 * **Force peaks 9 to 45 ms BEFORE calcium**, every cycle. Nothing on screen
 * claims otherwise and nothing should start to: at 0.25x that gap is 36-180 ms
 * of wall time, which is long enough for somebody watching closely to see the
 * opposite of a sentence that said calcium peaks first.
 *
 * This is not a defect in the port — it is the exported run, and re-fitting the
 * authors' parameters to make it read more like a textbook is what §5 forbids
 * above everything else. What the test buys is that a re-export which changes
 * the order cannot pass quietly under a sentence written for the old one.
 */
test("the published run peaks force before calcium, every cycle", async () => {
  const raw = await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8");
  const series = JSON.parse(raw).series;
  const column = (name) =>
    Object.entries(series[name])
      .filter(([i]) => /^\d+$/.test(i))
      .sort((a, b) => +a[0] - +b[0])
      .map(([, v]) => v);

  const t = column("t");
  const force = column("force_relative");
  const calcium = column("Ca_myo_total");
  const store = column("Ca_SR_total");
  assert.ok(t.length > 100, "the archive lost its time column");

  const CYCLE = 0.65;
  let cycles = 0;
  for (let n = 0; n < 5; n += 1) {
    const window = t.map((v, i) => [v, i]).filter(([v]) => v >= n * CYCLE && v <= n * CYCLE + 0.5);
    if (window.length < 3) continue;
    cycles += 1;
    const at = (col, better) => window.reduce((m, [, i]) => (better(col[i], col[m]) ? i : m), window[0][1]);
    const caPeak = t[at(calcium, (a, b) => a > b)];
    const fPeak = t[at(force, (a, b) => a > b)];
    const srTrough = t[at(store, (a, b) => a < b)];

    assert.ok(
      fPeak <= caPeak,
      `cycle ${n}: force peaks at ${fPeak.toFixed(3)} s and calcium at ${caPeak.toFixed(3)}. The shipped run ` +
        `has always peaked force first, by 9 to 45 ms. If a re-export changed that, every sentence written ` +
        `about the order has to be re-read before this assertion is flipped`,
    );
    assert.ok(
      srTrough <= caPeak + 1e-9,
      `cycle ${n}: the store bottoms at ${srTrough.toFixed(3)} s, after calcium peaks at ${caPeak.toFixed(3)}. ` +
        `The store emptying is where the calcium comes FROM`,
    );
  }
  assert.equal(cycles, 5, "fewer than five 0.65 s cycles in the archive's first 3.25 s");
});
