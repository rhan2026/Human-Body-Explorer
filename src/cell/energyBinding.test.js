import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CA_QUANTUM_uM,
  CONDITIONS,
  PARTS,
  POOL,
  QUANTUM_mM,
  frameAt,
  instantsOf,
  repAt,
  responseSpan,
} from "./energyBinding.js";
import { REPS, REP_SECONDS } from "./cellBinding.js";

/* The raw JSON bytes, not the loader — same reason as cellChain.test.js: a gate
   that reads through the loader cannot catch the loader hiding something.
   `valuesOf` accepts this shape (`series` a plain object). */
const archive = async (id) =>
  JSON.parse(await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"));

const load = async () => {
  const [normal, calciumOff, ca] = await Promise.all([
    archive(CONDITIONS.normal.bout),
    archive(CONDITIONS.calciumOff.bout),
    archive("soce_on"),
  ]);
  return { normal, calciumOff, ca, span: responseSpan(normal) };
};

/** Every archived instant of `bout`, as a prev-chained sweep of frames. */
const sweep = (bout, ca, span, coupled) => {
  const out = [];
  let prev = null;
  for (const t of bout.series.t) {
    prev = frameAt({ bout, ca, span, coupled, t, prev });
    out.push(prev);
  }
  return out;
};

test("the quantum is the conserved pool split into POOL tokens", () => {
  assert.equal(POOL, 90);
  assert.ok(Math.abs(QUANTUM_mM * POOL - 8.9205) < 1e-9);
  assert.equal(CA_QUANTUM_uM, 1);
});

test("every part has an id, a name and one line, and no line carries a figure", () => {
  for (const p of PARTS) {
    assert.ok(p.id && p.name && p.line, `${p.id} incomplete`);
    assert.ok(!/\d/.test(p.line), `${p.id} line "${p.line}" has a figure in it`);
  }
});

test("the nucleotide pool is conserved at every sample, in both conditions", async () => {
  const { normal, calciumOff, ca, span } = await load();
  for (const [bout, coupled] of [[normal, true], [calciumOff, false]]) {
    for (const f of sweep(bout, ca, span, coupled)) {
      assert.equal(f.atp + f.adp + f.amp, POOL, `pool broken at t=${f.t}`);
      assert.ok(f.atp >= 0 && f.adp >= 0 && f.amp >= 0);
      assert.ok(f.pcr >= 0 && f.freePi >= 0 && f.ca >= 0);
      assert.ok(f.camkk >= 0 && f.camkk <= 1);
      assert.ok(f.demand >= 0 && f.demand <= 1);
      assert.ok(f.response >= 0 && f.response <= 1);
      assert.equal(f.coupled, coupled);
    }
  }
});

test("the resting picture is 76/13/1 tokens with 13 of PCr and no calcium", async () => {
  const { normal, ca, span } = await load();
  const t0 = normal.series.t[0];
  const f = frameAt({ bout: normal, ca, span, coupled: true, t: t0, prev: null });
  assert.deepEqual([f.atp, f.adp, f.amp, f.pcr], [76, 13, 1, 13]);
  assert.equal(f.ca, 0);
  assert.equal(f.freePi, 0, "phosphate conservation is anchored at t0");
  assert.equal(f.response, 0);
  assert.deepEqual(f.events, { hydrolysis: 0, recharge: 0, ak: 0 });
});

test("the ring reaches 1 at the Normal run's peak and never 0.05 in the calcium-off run", async () => {
  const { normal, calciumOff, ca, span } = await load();
  assert.ok(span > 0);
  const { responseMax } = instantsOf(normal, ca);
  const peak = frameAt({ bout: normal, ca, span, coupled: true, t: responseMax, prev: null });
  assert.ok(Math.abs(peak.response - 1) < 1e-9, `ring at peak is ${peak.response}`);
  for (const f of sweep(calciumOff, ca, span, false)) {
    assert.ok(f.response < 0.05, `calcium-off ring ${f.response} at t=${f.t}`);
  }
});

test("the calcium peak counts about 29 particles, on the calcium run's own clock", async () => {
  const { normal, ca, span } = await load();
  let most = 0;
  for (const t of ca.series.t) {
    most = Math.max(most, frameAt({ bout: normal, ca, span, coupled: true, t, prev: null }).ca);
  }
  assert.ok(most >= 28 && most <= 30, `peak count ${most}`);
});

test("events are never negative, hydrolysis happens, and a backwards clock yields none", async () => {
  const { normal, ca, span } = await load();
  const frames = sweep(normal, ca, span, true);
  let hydrolysis = 0;
  for (const f of frames) {
    for (const k of ["hydrolysis", "recharge", "ak"]) {
      assert.ok(Number.isInteger(f.events[k]) && f.events[k] >= 0, `${k} ${f.events[k]} at t=${f.t}`);
    }
    hydrolysis += f.events.hydrolysis;
  }
  assert.ok(hydrolysis > 0, "a bout that spends ATP has to fire at least one hydrolysis");
  const late = frames[frames.length - 1];
  const back = frameAt({ bout: normal, ca, span, coupled: true, t: normal.series.t[0], prev: late });
  assert.deepEqual(back.events, { hydrolysis: 0, recharge: 0, ak: 0 });
});

test("dt and dim pass through untouched, defaulting to 0", async () => {
  const { normal, ca, span } = await load();
  const f = frameAt({ bout: normal, ca, span, coupled: true, t: 1, prev: null, dt: 0.016, dim: 0.4 });
  assert.equal(f.dt, 0.016);
  assert.equal(f.dim, 0.4);
  const g = frameAt({ bout: normal, ca, span, coupled: true, t: 1, prev: null });
  assert.equal(g.dt, 0);
  assert.equal(g.dim, 0);
});

test("sampling is nearest-left on the run's own t", async () => {
  const { normal, ca, span } = await load();
  const t = normal.series.t;
  const between = (t[10] + t[11]) / 2;
  const f = frameAt({ bout: normal, ca, span, coupled: true, t: between, prev: null });
  assert.equal(f.ampkLevel, normal.series.pAMPK_fraction[10]);
  const before = frameAt({ bout: normal, ca, span, coupled: true, t: t[0] - 5, prev: null });
  assert.equal(before.ampkLevel, normal.series.pAMPK_fraction[0]);
});

test("every instant the tour needs is inside the grid and in the order the story tells it", async () => {
  const { normal, ca } = await load();
  const t = normal.series.t;
  const [t0, tEnd] = [t[0], t[t.length - 1]];
  const at = instantsOf(normal, ca);
  for (const [k, v] of Object.entries(at)) {
    if (k === "onsets") continue;
    assert.ok(typeof v === "number" && v >= t0 && v <= tEnd, `${k} = ${v} is outside [${t0}, ${tEnd}]`);
  }
  /* One burst onset per repetition, each inside its own rep's window, null
     only where a rep has no burst (the shipped run bursts in all ten). */
  assert.equal(at.onsets.length, REPS);
  at.onsets.forEach((v, r) => {
    if (v === null) return;
    assert.ok(v >= t0 + r * REP_SECONDS && v < t0 + (r + 1) * REP_SECONDS, `onsets[${r}] = ${v} is not inside rep ${r + 1}`);
  });
  assert.equal(at.onsets[0], at.onset, "the first rep's burst is the run's onset");
  assert.equal(at.still, t[t.length - 2]);
  assert.ok(at.caPeakRep1 <= t0 + REP_SECONDS, "the rep-1 calcium peak is inside rep 1");
  assert.ok(at.onset < at.pcrSteepest || at.onset < at.ampMax, "the demand rises before the reserve drains");
  assert.ok(at.responseMax > at.onset);
});

test("repAt puts every second of the set in a rep and the rest in the last one", () => {
  const t0 = 0;
  assert.deepEqual(repAt(0, t0), { rep: 0, from: 0, to: REP_SECONDS });
  const mid = repAt(3.5, t0);
  assert.equal(mid.rep, Math.floor(3.5 / REP_SECONDS));
  assert.ok(mid.from <= 3.5 && 3.5 < mid.to);
  assert.equal(repAt(10, t0).rep, REPS - 1);
  assert.equal(repAt(-1, t0).rep, 0);
});
