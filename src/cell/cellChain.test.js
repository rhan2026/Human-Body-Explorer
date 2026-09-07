import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CHAIN_IDS,
  CHAIN_LINKS,
  CHAIN_NODES,
  CHAIN_RUNS,
  armStrength,
  chainReading,
  chainSeparation,
} from "./cellChain.js";

const archive = async (id) =>
  JSON.parse(await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"));

const load = async () => {
  const [bout, rest, noCa, noEnergy] = await Promise.all([
    archive(CHAIN_RUNS.bout),
    archive(CHAIN_RUNS.rest),
    archive(CHAIN_RUNS.noCalciumArm),
    archive(CHAIN_RUNS.noEnergyArm),
  ]);
  return { bout, rest, noCa, noEnergy };
};

const last = (v) => v[v.length - 1];

test("every drawn node is a series the archive ships", async () => {
  const { bout } = await load();
  for (const id of CHAIN_IDS) {
    assert.ok(
      Array.isArray(bout.series[id]),
      `"${id}" is drawn and the archive has no such series — this screen may only draw names the ` +
        "export carries",
    );
  }
});

test("every drawn arrow joins two drawn nodes", () => {
  for (const { from, to } of CHAIN_LINKS) {
    assert.ok(CHAIN_IDS.includes(from), `link from "${from}", which is not drawn`);
    assert.ok(CHAIN_IDS.includes(to), `link to "${to}", which is not drawn`);
  }
});

/**
 * THE BOUT COSTS ENERGY. If this stops being true the screen has no subject —
 * and the directions are the spec's own chain, so they are worth holding
 * separately from the finding below.
 */
test("the run spends ATP and piles up ADP and AMP", async () => {
  const { bout } = await load();
  const s = bout.series;
  assert.ok(Math.min(...s.ATP) < s.ATP[0] - 0.5, `ATP starts at ${s.ATP[0]} and never falls half a mM`);
  assert.ok(Math.min(...s.PCr) < s.PCr[0] - 0.3, "PCr does not empty; the buffer is the energy gauge");
  assert.ok(Math.max(...s.ADP) > s.ADP[0] * 1.3, "ADP does not pile up");
  assert.ok(Math.max(...s.AMP) > s.AMP[0] * 2, "AMP does not pile up");
});

/**
 * ── THE FINDING THIS SCREEN IS BUILT ON ──────────────────────────────────────
 *
 * `pAMPK_fraction` is the same in the bout and in the rest control, to four
 * decimals, at every sample — in a pair of runs whose only difference is, by the
 * control's own description, "the energy cost of the bout and nothing else".
 *
 * The drawing says so out loud. If a re-export ever separates them this goes red,
 * and it SHOULD: the picture would then be telling a story the data had stopped
 * telling, and the arrow from AMP to AMPK would need redrawing as a real one.
 */
test("the energy cost of the bout moves AMPK by nothing", async () => {
  const { bout, rest } = await load();
  const gap = chainSeparation(bout, rest);
  assert.ok(
    gap.ATP > 0.1,
    `ATP separates the two runs by only ${gap.ATP} — the bout is supposed to cost energy`,
  );
  assert.ok(
    gap.AMP > 0.05,
    `AMP separates the two runs by only ${gap.AMP}`,
  );
  assert.ok(
    gap.pAMPK_fraction < 1e-4,
    `pAMPK_fraction now separates the bout from rest by ${gap.pAMPK_fraction}. It was 0 on ` +
      "2026-08-31, which is the whole reason this screen answers its own headline the way it " +
      "does. Re-read cellChain.js's note and redraw the AMP arrow deliberately",
  );
});

/**
 * AND THE KNOCKOUTS SAY WHICH ARM DOES MOVE IT. Two claims, both measured:
 * calcium through CaMKK2 is the entire rise, and LKB1 is the entire resting
 * level. The screen draws two arms into AMPK and this is what makes that
 * drawing true rather than decorative.
 */
test("calcium is the whole of AMPK's rise, and LKB1 is the whole of its resting level", async () => {
  const { bout, noCa, noEnergy } = await load();
  const wt = bout.series.pAMPK_fraction;
  const rise = last(wt) - wt[0];
  const withoutCalcium = last(noCa.series.pAMPK_fraction) - noCa.series.pAMPK_fraction[0];
  assert.ok(rise > 0.05, `AMPK only rises ${rise.toFixed(4)} in the wild type`);
  assert.ok(
    withoutCalcium < rise * 0.1,
    `without CaMKK2 the rise is ${withoutCalcium.toFixed(4)} against ${rise.toFixed(4)} — it was ` +
      "2 % of it on 2026-08-31, which is why the calcium arm is drawn as the one that moves AMPK",
  );
  assert.ok(
    noEnergy.series.pAMPK_fraction[0] < 0.05 && wt[0] > 0.8,
    `LKB1 knocked out should start near zero against the wild type's ${wt[0].toFixed(4)}; it starts ` +
      `at ${noEnergy.series.pAMPK_fraction[0].toFixed(4)}`,
  );
});

/** The reading has to land on the run, and be usable as a 0..1 for a drawing. */
test("a reading picks the sample at or before the instant, and scales to the run", async () => {
  const { bout } = await load();
  const t = bout.series.t;
  const mid = chainReading(bout, t[Math.floor(t.length / 2)]);
  assert.equal(mid.t, t[Math.floor(t.length / 2)]);
  for (const id of CHAIN_IDS) {
    assert.ok(
      mid.level[id] >= 0 && mid.level[id] <= 1,
      `"${id}" scaled to ${mid.level[id]}, which is not a fraction of its own run`,
    );
    assert.equal(mid.value[id], bout.series[id][mid.index], `"${id}" reports a value it did not read`);
  }
  const before = chainReading(bout, -5);
  assert.equal(before.index, 0, "an instant before the run should hold at the first sample");
});

/** The drawing runs down the page: demand at the top, what AMPK does at the foot. */
test("the chain is ordered, energy on one side and calcium on the other", () => {
  const row = Object.fromEntries(CHAIN_NODES.map((n) => [n.id, n.row]));
  assert.ok(row.ATP_hydrolysis_total < row.ATP, "demand is drawn below the ATP it spends");
  assert.ok(row.ATP < row.AMP, "AMP is drawn above the ATP it comes from");
  assert.ok(row.AMP < row.pAMPK_fraction, "AMPK is drawn above the AMP that is supposed to reach it");
  assert.ok(row.pAMPK_fraction < row.pAMPK_activity, "the readout is drawn above AMPK");
  const col = Object.fromEntries(CHAIN_NODES.map((n) => [n.id, n.col]));
  assert.ok(
    col.CaMKK_active_fraction > 0 && col.AMP < 0,
    "the two arms into AMPK have to arrive from different sides, or the picture cannot show that " +
      "only one of them moves it",
  );
});

/**
 * EACH ARM MEASURED BY ITS OWN COUNTERFACTUAL, and this test exists because the
 * obvious single measure gives the wrong answer.
 *
 * `chainSeparation(bout, rest)` reports 0.00000 for `CaMKK_active_fraction` —
 * not because calcium does nothing but because the rest control holds calcium
 * identical on purpose. A drawing that read arm strength off that would have
 * shown BOTH arms into AMPK dead, which is false about calcium and would have
 * made this screen answer its headline with "nothing does".
 */
test("calcium accounts for AMPK's rise and the energy cost accounts for none of it", async () => {
  const runs = await load();
  const arm = armStrength({
    bout: runs.bout,
    rest: runs.rest,
    noCalciumArm: runs.noCa,
    noEnergyArm: runs.noEnergy,
  });
  assert.ok(
    arm.calcium > 0.9,
    `the calcium arm now accounts for ${(arm.calcium * 100).toFixed(1)} % of AMPK's rise; it was ` +
      "97.7 % on 2026-08-31 and the drawing lights that arrow because of it",
  );
  assert.ok(
    arm.energy < 0.01,
    `the energy arm now accounts for ${(arm.energy * 100).toFixed(1)} % of AMPK's rise; it was ` +
      "0.0 %, which is why the AMP arrow is drawn dark. Re-read cellChain.js before changing this",
  );
});

/** And the rest control really is the energy-only counterfactual it claims. */
test("the rest control differs from the bout in the energy cost and nothing else", async () => {
  const { bout, rest } = await load();
  const gap = chainSeparation(bout, rest);
  assert.ok(gap.ATP_hydrolysis_total > 0.5, "the rest control is not holding demand flat");
  /* A TOLERANCE, AND IT IS THE ARCHIVE'S ROUNDING AND NOT A FLOAT'S.
     `assert.equal(…, 0)` failed, and the first guess in this comment was that
     the two runs came apart by a float's worth. Measured: 1.0e-6, which is six
     decimal places — the export's own rounding, not arithmetic noise. Both runs
     integrate the same calcium and the shipped numbers agree to the last digit
     they carry. What has to hold is that calcium is the SAME experiment on both
     sides, and a difference at the size of the export's precision is. */
  assert.ok(
    gap.CaMKK_active_fraction <= 1e-5,
    "calcium now differs between the bout and the rest control; that control is what makes the " +
      `energy arm's 0 % mean anything, and if it drifts the measurement stops being clean. It is ` +
      `${gap.CaMKK_active_fraction}`,
  );
});
